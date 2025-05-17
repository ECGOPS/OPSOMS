import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { v4 as uuidv4 } from "uuid";
import { toast } from "@/components/ui/sonner";
import {
  Region,
  District,
  OP5Fault,
  ControlSystemOutage,
  VITAsset,
  VITInspectionChecklist,
  VoltageLevel,
  VITStatus,
  YesNoOption,
  GoodBadOption,
  SubstationInspection,
  FaultType,
  InspectionItem,
  Inspection,
  AffectedPopulation,
  ReliabilityIndices,
  OverheadLineInspection
} from "@/lib/types";
import { LoadMonitoringData } from "@/lib/asset-types";
import { calculateUnservedEnergy, calculateOutageDuration, calculateMTTR } from "@/utils/calculations";
import { PermissionService } from '@/services/PermissionService';
import { db } from "@/config/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  orderBy,
  getDoc,
  setDoc,
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot
} from "firebase/firestore";
import { getUserRegionAndDistrict } from "@/utils/user-utils";
import { resetFirestoreConnection } from "@/config/firebase";
import { 
  StoreName,
  safeAddItem, 
  safeUpdateItem, 
  safeDeleteItem, 
  safeGetAllItems, 
  safeGetItem, 
  safeClearStore, 
  addToPendingSync, 
  getPendingSyncItems, 
  clearPendingSyncItem, 
  addItem, 
  updateItem, 
  deleteItem, 
  initDB 
} from '../utils/db';
import { openDB } from "idb";
import { deleteDB } from "idb";

const DB_NAME = 'ecg-oms-db';
const DB_VERSION = 3;

// Define store name constants
const STORE_NAMES = {
  OP5_FAULTS: 'op5Faults' as StoreName,
  OP5_FAULTS_CACHE: 'op5Faults-cache' as StoreName,
  CONTROL_OUTAGES: 'controlOutages' as StoreName,
  CONTROL_OUTAGES_CACHE: 'controlOutages-cache' as StoreName,
  VIT_ASSETS: 'vitAssets' as StoreName,
  VIT_ASSETS_CACHE: 'vitAssets-cache' as StoreName,
  VIT_INSPECTIONS: 'vitInspections' as StoreName,
  VIT_INSPECTIONS_CACHE: 'vitInspections-cache' as StoreName,
  LOAD_MONITORING: 'loadMonitoring' as StoreName,
  LOAD_MONITORING_CACHE: 'loadMonitoring-cache' as StoreName,
  SUBSTATION_INSPECTIONS: 'substationInspections' as StoreName,
  OVERHEAD_LINE_INSPECTIONS: 'overheadLineInspections' as StoreName,
  OVERHEAD_LINE_INSPECTIONS_CACHE: 'overheadLineInspections-cache' as StoreName,
  PENDING_SYNC: 'pending-sync' as StoreName,
  DISTRICTS: 'districts' as StoreName,
  DISTRICTS_CACHE: 'districts-cache' as StoreName,
  REGIONS: 'regions' as StoreName,
  REGIONS_CACHE: 'regions-cache' as StoreName,
  DEVICES: 'devices' as StoreName,
  DEVICES_CACHE: 'devices-cache' as StoreName,
  PERMISSIONS: 'permissions' as StoreName,
  PERMISSIONS_CACHE: 'permissions-cache' as StoreName,
  STAFF_IDS: 'staffIds' as StoreName,
  STAFF_IDS_CACHE: 'staffIds-cache' as StoreName,
  SYSTEM: 'system' as StoreName,
  SYSTEM_CACHE: 'system-cache' as StoreName,
  USERS: 'users' as StoreName,
  USERS_CACHE: 'users-cache' as StoreName
} as const;

// Add clearStore function
async function clearStore(storeName: StoreName) {
  const db = await openDB(DB_NAME, DB_VERSION);
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  await store.clear();
  await tx.done;
}

// Add these utility functions at the top of the file
const withRetry = async (operation: () => Promise<any>, maxRetries = 3) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (error.name === 'AbortError') {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        // Reinitialize DB connection
        await initDB();
      } else {
        throw error;
      }
    }
  }
  throw lastError;
};

const safeDBOperation = async (operation: () => Promise<any>) => {
  try {
    return await withRetry(operation);
  } catch (error) {
    console.error('Database operation failed:', error);
    // If we're offline, don't show error to user
    if (navigator.onLine) {
      toast.error('Database operation failed. Please try again.');
    }
    throw error;
  }
};

// Add these utility functions after the existing utility functions
async function mergeFirestoreAndOffline<T extends BaseRecord & { id: string; clientId?: string }>(
  storeName: StoreName,
  collectionName: string
): Promise<(T & { isOnline: boolean; synced: boolean })[]> {
  try {
    // Get Firestore data
    const snapshot = await getDocs(collection(db, collectionName));
    const firestoreData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as T[];

    // Get offline data
    const offlineData = await safeGetAllItems<T>(storeName);
    
    // Get pending sync items
    const pendingItems = await getPendingSyncItems();
    const syncedIds = new Set(
      pendingItems
        .filter(item => item.type === storeName)
        .map(item => item.data.id)
    );

    const recordMap = new Map<string, T & { isOnline: boolean; synced: boolean }>();

    // Add Firestore records
    firestoreData.forEach(item => {
      const key = item.clientId || item.id;
      recordMap.set(key, {
        ...item,
        isOnline: true,
        synced: true
      });
    });

    // Add offline records
    offlineData.forEach(item => {
      const key = item.clientId || item.id;
      const existing = recordMap.get(key);
      const isPending = syncedIds.has(item.id);
      const itemDate = new Date(item.updatedAt);
      const existingDate = existing ? new Date(existing.updatedAt) : null;

      if (!existing || (!isPending && existingDate && itemDate > existingDate)) {
        recordMap.set(key, {
          ...item,
          isOnline: false,
          synced: false
        });
      }
    });

    return Array.from(recordMap.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (error) {
    console.error(`Error merging data for ${storeName}:`, error);
    throw error;
  }
}

async function clearCacheAndUpdateState<T extends BaseRecord & { id: string; clientId?: string }>(
  storeName: StoreName,
  collectionName: string,
  setState: React.Dispatch<React.SetStateAction<(T & { isOnline: boolean; synced: boolean })[]>>
) {
  try {
    // Clear the cache
    await clearStore(storeName);
    
    // Get merged data
    const mergedData = await mergeFirestoreAndOffline<T>(storeName, collectionName);
    
    // Update state
    setState(mergedData);
    
    // Update cache with merged data
    for (const item of mergedData) {
      await safeAddItem(storeName, item);
    }
  } catch (error) {
    console.error(`Error clearing cache and updating state for ${storeName}:`, error);
    throw error;
  }
}

export interface DataContextType {
  regions: Region[];
  districts: District[];
  regionsLoading: boolean;
  districtsLoading: boolean;
  regionsError: string | null;
  districtsError: string | null;
  retryRegionsAndDistricts: () => Promise<void>;
  op5Faults: OP5Fault[];
  controlSystemOutages: ControlSystemOutage[];
  addOP5Fault: (fault: Omit<OP5Fault, "id">) => Promise<string>;
  updateOP5Fault: (id: string, data: Partial<OP5Fault>) => Promise<void>;
  deleteOP5Fault: (id: string) => Promise<void>;
  addControlSystemOutage: (outage: Omit<ControlSystemOutage, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">) => Promise<string>;
  updateControlSystemOutage: (id: string, data: Partial<ControlSystemOutage>) => Promise<void>;
  deleteControlSystemOutage: (id: string) => Promise<void>;
  canResolveFault: (fault: OP5Fault | ControlSystemOutage) => boolean;
  getFilteredFaults: (regionId?: string, districtId?: string) => { op5Faults: OP5Fault[]; controlOutages: ControlSystemOutage[] };
  resolveFault: (id: string, isOP5: boolean) => Promise<void>;
  deleteFault: (id: string, isOP5: boolean) => Promise<void>;
  canEditFault: (fault: OP5Fault | ControlSystemOutage) => boolean;
  loadMonitoringRecords?: LoadMonitoringData[];
  setLoadMonitoringRecords: React.Dispatch<React.SetStateAction<LoadMonitoringData[] | undefined>>;
  saveLoadMonitoringRecord: (record: Omit<LoadMonitoringData, "id">) => Promise<string>;
  getLoadMonitoringRecord: (id: string) => Promise<LoadMonitoringData | undefined>;
  updateLoadMonitoringRecord: (id: string, data: Partial<LoadMonitoringData>) => Promise<void>;
  deleteLoadMonitoringRecord: (id: string) => Promise<void>;
  vitAssets: VITAsset[];
  vitInspections: VITInspectionChecklist[];
  addVITAsset: (asset: Omit<VITAsset, "id" | "createdAt" | "updatedAt">) => Promise<string>;
  updateVITAsset: (id: string, updates: Partial<VITAsset>) => Promise<void>;
  deleteVITAsset: (id: string) => Promise<void>;
  addVITInspection: (inspection: Omit<VITInspectionChecklist, "id">) => Promise<string>;
  updateVITInspection: (id: string, updates: Partial<VITInspectionChecklist>) => Promise<void>;
  deleteVITInspection: (id: string) => Promise<void>;
  savedInspections: SubstationInspection[];
  setSavedInspections: React.Dispatch<React.SetStateAction<SubstationInspection[]>>;
  saveInspection: (data: Omit<SubstationInspection, "id">) => Promise<string>;
  updateSubstationInspection: (id: string, updates: Partial<SubstationInspection>) => Promise<void>;
  deleteInspection: (id: string) => Promise<void>;
  updateDistrict: (id: string, updates: Partial<District>) => Promise<void>;
  canEditAsset: (asset: VITAsset) => boolean;
  canEditInspection: (inspection: VITInspectionChecklist | SubstationInspection) => boolean;
  canDeleteAsset: (asset: VITAsset) => boolean;
  canDeleteInspection: (inspection: VITInspectionChecklist | SubstationInspection) => boolean;
  setVITAssets: React.Dispatch<React.SetStateAction<VITAsset[]>>;
  setVITInspections: React.Dispatch<React.SetStateAction<VITInspectionChecklist[]>>;
  getSavedInspection: (id: string) => SubstationInspection | undefined;
  canAddAsset: (regionName: string, districtName: string) => boolean;
  canAddInspection: (regionId: string, districtId: string) => boolean;
  getOP5FaultById: (id: string) => OP5Fault | undefined;
  overheadLineInspections: OverheadLineInspection[];
  addOverheadLineInspection: (inspection: Omit<OverheadLineInspection, "id">) => Promise<string>;
  updateOverheadLineInspection: (id: string, updates: Partial<OverheadLineInspection>) => Promise<void>;
  deleteOverheadLineInspection: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Add after the imports and before the DataProvider component
const getCacheStoreName = (storeType: StoreName): StoreName => {
  switch (storeType) {
    case STORE_NAMES.OP5_FAULTS:
      return STORE_NAMES.OP5_FAULTS_CACHE;
    case STORE_NAMES.CONTROL_OUTAGES:
      return STORE_NAMES.CONTROL_OUTAGES_CACHE;
    case STORE_NAMES.LOAD_MONITORING:
      return STORE_NAMES.LOAD_MONITORING_CACHE;
    case STORE_NAMES.VIT_ASSETS:
      return STORE_NAMES.VIT_ASSETS_CACHE;
    case STORE_NAMES.VIT_INSPECTIONS:
      return STORE_NAMES.VIT_INSPECTIONS_CACHE;
    case STORE_NAMES.OVERHEAD_LINE_INSPECTIONS:
      return STORE_NAMES.OVERHEAD_LINE_INSPECTIONS_CACHE;
    default:
      throw new Error(`No cache store for store name: ${storeType}`);
  }
};

const collectionMap: Partial<Record<StoreName, string>> = {
  [STORE_NAMES.OP5_FAULTS]: 'op5Faults',
  [STORE_NAMES.CONTROL_OUTAGES]: 'controlOutages',
  [STORE_NAMES.LOAD_MONITORING]: 'loadMonitoring',
  [STORE_NAMES.VIT_ASSETS]: 'vitAssets',
  [STORE_NAMES.VIT_INSPECTIONS]: 'vitInspections',
  [STORE_NAMES.SUBSTATION_INSPECTIONS]: 'substationInspections',
  [STORE_NAMES.OVERHEAD_LINE_INSPECTIONS]: 'overheadLineInspections'
};

// Add this function after the existing utility functions
async function clearAndReinitializeDB() {
  try {
    console.log('=== CLEARING AND REINITIALIZING DATABASE ===');
    // Close the current database connection
    const db = await openDB(DB_NAME, DB_VERSION);
    await db.close();
    
    // Delete the database
    await deleteDB(DB_NAME);
    console.log('Database deleted');
    
    // Reinitialize the database
    await initDB();
    console.log('Database reinitialized');
    
    return true;
  } catch (error) {
    console.error('Error clearing and reinitializing database:', error);
    return false;
  }
}

// Add these types at the top of the file after imports
interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// Add these utility functions
async function saveToFirebase<T extends DocumentData>(
  collectionName: string,
  data: T,
  isUpdate: boolean = false
): Promise<T> {
  try {
    if (isUpdate) {
      // Update existing document
      const docRef = doc(db, collectionName, data.id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      return data;
    } else {
      // Create new document
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return {
        ...data,
        id: docRef.id
      };
    }
  } catch (error) {
    console.error('Error saving to Firebase:', error);
    throw error;
  }
}

async function saveToLocal<T extends BaseRecord>(
  storeName: StoreName,
  data: T
): Promise<T> {
  try {
    const localData = {
      ...data,
      syncStatus: 'local' as const,
      lastModified: Date.now()
    };
    await safeAddItem(storeName, localData);
    return localData;
  } catch (error) {
    console.error('Error saving to local storage:', error);
    throw error;
  }
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [districtsLoading, setDistrictsLoading] = useState(true);
  const [regionsError, setRegionsError] = useState<string | null>(null);
  const [districtsError, setDistrictsError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [op5Faults, setOP5Faults] = useState<OP5Fault[]>([]);
  const [controlSystemOutages, setControlSystemOutages] = useState<ControlSystemOutage[]>([]);
  const [loadMonitoringRecords, setLoadMonitoringRecords] = useState<LoadMonitoringData[]>([]);
  const [vitAssets, setVITAssets] = useState<VITAsset[]>([]);
  const [vitInspections, setVITInspections] = useState<VITInspectionChecklist[]>([]);
  const [savedInspections, setSavedInspections] = useState<SubstationInspection[]>([]);
  const [overheadLineInspections, setOverheadLineInspections] = useState<OverheadLineInspection[]>([]);

  useEffect(() => {
    // Initialize the database when the component mounts
    initDB().catch(error => {
      console.error('Failed to initialize database:', error);
      toast.error('Failed to initialize offline storage');
    });
  }, []);

  // Fetch regions and districts with retry logic
  const fetchRegionsAndDistricts = async (retryAttempt = 0) => {
    try {
      setRegionsLoading(true);
      setDistrictsLoading(true);
      setRegionsError(null);
      setDistrictsError(null);

      // Check if we're offline
      if (!navigator.onLine) {
        console.log('Device is offline, attempting to reset Firestore connection...');
        await resetFirestoreConnection();
      }

      // Fetch regions
      const regionsSnapshot = await getDocs(collection(db, "regions"));
      const regionsList = regionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Region[];
      
      console.log("Regions loaded:", regionsList.length);
      setRegions(regionsList);
      setRegionsLoading(false);

      // Fetch districts
      const districtsSnapshot = await getDocs(collection(db, "districts"));
      const districtsList = districtsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as District[];
      
      console.log("Districts loaded:", districtsList.length);
      setDistricts(districtsList);
      setDistrictsLoading(false);
      
      // Reset retry count on success
      setRetryCount(0);
    } catch (error: any) {
      console.error("Error fetching regions and districts:", error);
      
      // If we get an offline error and haven't exceeded retries, try again
      if (error.message?.includes('client is offline') && retryAttempt < MAX_RETRIES) {
        console.log(`Retrying fetch (attempt ${retryAttempt + 1}/${MAX_RETRIES})...`);
        setRetryCount(retryAttempt + 1);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        
        // Try to reset the connection and fetch again
        await resetFirestoreConnection();
        return fetchRegionsAndDistricts(retryAttempt + 1);
      }
      
      // If we've exhausted retries or it's a different error
      setRegionsError("Failed to load regions. Please try again.");
      setDistrictsError("Failed to load districts. Please try again.");
      setRegionsLoading(false);
      setDistrictsLoading(false);
      
      toast.error("Failed to load regions and districts. Please refresh the page.");
    }
  };

  // Initial load of regions and districts
  useEffect(() => {
    fetchRegionsAndDistricts();
  }, []);

  // Subscribe to regions in real-time
  useEffect(() => {
    if (!user || regions.length === 0) return;

    let q = query(collection(db, "regions"));
    
    // Apply role-based filtering
    if (user.role === "regional_engineer" || user.role === "district_engineer") {
      q = query(collection(db, "regions"), where("name", "==", user.region));
    }

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const regionsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Region[];
        setRegions(regionsData);
      },
      (error) => {
        console.error("Error in regions snapshot:", error);
        setRegionsError("Failed to update regions in real-time.");
      }
    );

    return () => unsubscribe();
  }, [user, regions.length]);

  // Subscribe to districts in real-time
  useEffect(() => {
    if (!user || districts.length === 0) return;

    let q = query(collection(db, "districts"));
    
    // Apply role-based filtering
    if (user.role === "district_engineer" || user.role === "regional_engineer") {
      const userRegion = regions.find(r => r.name === user.region);
      if (userRegion) {
        q = query(collection(db, "districts"), where("regionId", "==", userRegion.id));
      }
    }

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const districtsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as District[];
        setDistricts(districtsData);
      },
      (error) => {
        console.error("Error in districts snapshot:", error);
        setDistrictsError("Failed to update districts in real-time.");
      }
    );

    return () => unsubscribe();
  }, [user, regions, districts.length]);

  // Subscribe to VIT assets
  useEffect(() => {
    if (!user) return;

    let q = query(collection(db, "vitAssets"));
    
    // Only apply filters if not system_admin or global_engineer
    if (user.role !== "system_admin" && user.role !== "global_engineer") {
      if (user.role === "district_engineer" || user.role === "technician") {
        q = query(collection(db, "vitAssets"), where("district", "==", user.district));
      } else if (user.role === "regional_engineer") {
        q = query(collection(db, "vitAssets"), where("region", "==", user.region));
      }
    }

    console.log("Setting up VIT assets subscription...");

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        console.log("Received VIT assets snapshot:", snapshot.docs.length, "documents");
        
        // Get offline data regardless of online status
        const offlineData = await safeGetAllItems<VITAsset & BaseRecord>(STORE_NAMES.VIT_ASSETS);
        const pendingDeletes = (await getPendingSyncItems())
          .filter(item => item.type === STORE_NAMES.VIT_ASSETS && item.action === "delete")
          .map(item => item.data.id);

        if (navigator.onLine) {
          // Online mode - merge with Firestore data
      const assets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as VITAsset[];

          console.log("Processing online data:", assets.length, "assets");

          // Create a map of online records
          const onlineMap = new Map(assets.map(r => [r.id, r]));
          
          // Only include offline records that:
          // 1. Are not in the online data
          // 2. Are not pending deletion
          // 3. Have a newer timestamp than their online counterpart (if they exist)
          const mergedAssets = [
            ...assets,
            ...offlineData.filter(item => {
              const onlineRecord = onlineMap.get(item.id);
              if (!onlineRecord) {
                return !pendingDeletes.includes(item.id);
              }
              return item.updatedAt > onlineRecord.updatedAt && !pendingDeletes.includes(item.id);
            })
          ];

          // Ensure no duplicates
          const uniqueAssets = Array.from(
            new Map(
              mergedAssets.map(asset => [
                asset.id,
                {
                  ...asset,
                  updatedAt: asset.updatedAt || new Date().toISOString()
                }
              ])
            ).values()
          ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

          console.log("Setting VIT assets state with:", uniqueAssets.length, "assets");
          setVITAssets(uniqueAssets);

          // Update cache with all current data
          await clearStore(STORE_NAMES.VIT_ASSETS);
          for (const asset of uniqueAssets) {
            try {
              await safeAddItem(STORE_NAMES.VIT_ASSETS, asset);
            } catch (e) {
              console.error("Error caching VIT asset:", e);
            }
          }
        } else {
          // Offline mode - use cached and unsynced data
          const cache = await safeGetAllItems<VITAsset & BaseRecord>(STORE_NAMES.VIT_ASSETS_CACHE);
          
          // Create a map of cached items
          const cacheMap = new Map(cache.map(item => [item.id, item]));
          
          // Only include unsynced records that:
          // 1. Are not in the cache
          // 2. Are not pending deletion
          // 3. Have a newer timestamp than their cached counterpart (if they exist)
          const mergedAssets = [
            ...cache,
            ...offlineData.filter(item => {
              const cachedRecord = cacheMap.get(item.id);
              if (!cachedRecord) {
                return !pendingDeletes.includes(item.id);
              }
              return item.updatedAt > cachedRecord.updatedAt && !pendingDeletes.includes(item.id);
            })
          ];

          // Ensure no duplicates
          const uniqueAssets = Array.from(
            new Map(
              mergedAssets.map(asset => [
                asset.id,
                {
                  ...asset,
                  updatedAt: asset.updatedAt || new Date().toISOString()
                }
              ])
            ).values()
          ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

          console.log("Setting VIT assets state with:", uniqueAssets.length, "assets (offline)");
          setVITAssets(uniqueAssets);
        }
      } catch (error) {
        console.error("Error updating VIT assets:", error);
        if (navigator.onLine) {
          toast.error("Error updating assets list");
        }
      }
    }, (error) => {
      console.error("Error in VIT assets subscription:", error);
      if (navigator.onLine) {
        toast.error("Error connecting to database");
      }
    });

    return () => {
      console.log("Cleaning up VIT assets subscription");
      unsubscribe();
    };
  }, [user]);

  // Subscribe to OP5 faults
  useEffect(() => {
    if (!user) return;

    let q = query(collection(db, "op5Faults"));
    
    // Only apply filters if not system_admin or global_engineer
    if (user.role !== "system_admin" && user.role !== "global_engineer") {
      if (user.role === "district_engineer" || user.role === "technician") {
        const userDistrict = districts.find(d => d.name === user.district);
        if (userDistrict) {
          q = query(collection(db, "op5Faults"), where("districtId", "==", userDistrict.id));
        }
      } else if (user.role === "regional_engineer") {
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          q = query(collection(db, "op5Faults"), where("regionId", "==", userRegion.id));
        }
      }
    }

    console.log('[DataContext] Setting up OP5 faults subscription');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        console.log('[DataContext] OP5 faults snapshot update received.', { docChanges: snapshot.docChanges().map(change => ({ type: change.type, docId: change.doc.id })) });
        const faults = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as OP5Fault[];
        
        // Update state with Firestore data
        console.log('[DataContext] OP5 faults after mapping:', faults.length, 'faults');
        setOP5Faults(faults);
      } catch (error) {
        console.error('[DataContext] Error updating OP5 faults:', error);
        toast.error("Error updating faults list");
      }
    });

    return () => {
      console.log('[DataContext] Cleaning up OP5 faults subscription');
      unsubscribe();
    };
  }, [user, regions, districts]);

  // Subscribe to control outages
  useEffect(() => {
    if (!user) return;

    let q = query(collection(db, "controlOutages"));
    
    // Only apply filters if not system_admin or global_engineer
    if (user.role !== "system_admin" && user.role !== "global_engineer") {
      if (user.role === "district_engineer" || user.role === "technician") {
        const userDistrict = districts.find(d => d.name === user.district);
        if (userDistrict) {
          q = query(collection(db, "controlOutages"), where("districtId", "==", userDistrict.id));
        }
      } else if (user.role === "regional_engineer") {
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          q = query(collection(db, "controlOutages"), where("regionId", "==", userRegion.id));
        }
      }
    }

    console.log('[DataContext] Setting up control outages subscription');
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        console.log('[DataContext] Control outages snapshot update received.', { docChanges: snapshot.docChanges().map(change => ({ type: change.type, docId: change.doc.id })) });
        // Get Firestore data (online)
        const firestoreData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ControlSystemOutage[];

        console.log('[DataContext] Control outages firestore data:', firestoreData.length, 'outages');

        // Update state directly with Firestore data
        setControlSystemOutages(firestoreData);
        console.log('[DataContext] Control outages state updated directly from Firestore:', firestoreData.length, 'outages');
      } catch (error) {
        console.error('[DataContext] Error updating control outages:', error);
        if (navigator.onLine) {
          toast.error("Error updating outages list");
        }
      }
    });

    return () => {
      console.log('[DataContext] Cleaning up control outages subscription');
      unsubscribe();
    };
  }, [user, regions, districts]);

  // Subscribe to VIT inspections
  useEffect(() => {
    if (!user) return;

    let q = query(collection(db, "vitInspections"));
    
    // Only apply filters if not system_admin or global_engineer
    if (user.role !== "system_admin" && user.role !== "global_engineer") {
      if (user.role === "district_engineer" || user.role === "technician") {
        q = query(collection(db, "vitInspections"), where("district", "==", user.district));
      } else if (user.role === "regional_engineer") {
        q = query(collection(db, "vitInspections"), where("region", "==", user.region));
      }
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const inspections = snapshot.docs.map(doc => {
        const data = doc.data();
        // Preserve timestamps from Firestore
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt
        } as VITInspectionChecklist;
      });
      setVITInspections(inspections);
      // Cache to IndexedDB
      for (const inspection of inspections) {
        try {
          await safeAddItem(STORE_NAMES.VIT_INSPECTIONS_CACHE, inspection);
        } catch (e) {
          // Ignore duplicate errors
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Merged offline view effect for VIT inspections
  useEffect(() => {
    async function loadMergedOfflineInspections() {
      if (!navigator.onLine) {
        const cache = await safeGetAllItems<VITInspectionChecklist>(STORE_NAMES.VIT_INSPECTIONS_CACHE);
        const unsynced = await safeGetAllItems<VITInspectionChecklist>(STORE_NAMES.VIT_INSPECTIONS);
        const pendingDeletes = (await getPendingSyncItems())
          .filter(item => item.type === STORE_NAMES.VIT_INSPECTIONS && item.action === "delete")
          .map(item => item.data.id);

        // Create a map of cached items
        const cacheMap = new Map(cache.map(item => [item.id, item]));
        
        // Merge unsynced items that are not in cache and not pending delete
        const mergedInspections = [
          ...cache,
          ...unsynced.filter(item => 
            !cacheMap.has(item.id) && !pendingDeletes.includes(item.id)
          )
        ];

        setVITInspections(mergedInspections);
      }
    }
    loadMergedOfflineInspections();
    window.addEventListener("offline", loadMergedOfflineInspections);
    return () => {
      window.removeEventListener("offline", loadMergedOfflineInspections);
    };
  }, []);

  // Subscribe to substation inspections
  useEffect(() => {
    if (!user) return;

    let q = query(collection(db, "substationInspections"));
    
    // Only apply filters if not system_admin or global_engineer
    if (user.role !== "system_admin" && user.role !== "global_engineer") {
      if (user.role === "district_engineer" || user.role === "technician") {
        q = query(collection(db, "substationInspections"), where("district", "==", user.district));
      } else if (user.role === "regional_engineer") {
        q = query(collection(db, "substationInspections"), where("region", "==", user.region));
      }
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const inspections = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          region: data.region || '',
          district: data.district || '',
          substationNo: data.substationNo || '',
          substationName: data.substationName || '',
          type: data.type || 'indoor',
          date: data.date || '', // Assuming date is stored as string
          inspectionDate: data.inspectionDate || '', // Assuming date is stored as string
          remarks: data.remarks || '',
          createdBy: data.createdBy || '',
          inspectedBy: data.inspectedBy || '',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || '', // Convert Timestamp
          // Explicitly map items, ensuring status is present or null
          items: (data.items || []).map((item: any) => ({
            id: item.id || uuidv4(), // Ensure ID exists
            category: item.category || '',
            name: item.name || '',
            status: item.status || null, // Default missing status to null (or undefined)
            remarks: item.remarks || ''
          })),
          // Also map category-specific arrays if needed (adjust based on data model)
          generalBuilding: (data.generalBuilding || []).map((item: any) => ({ /* ... map item ... */ id: item.id, name: item.name, category: item.category, status: item.status || null, remarks: item.remarks || '' })),
          controlEquipment: (data.controlEquipment || []).map((item: any) => ({ /* ... map item ... */ id: item.id, name: item.name, category: item.category, status: item.status || null, remarks: item.remarks || '' })),
          powerTransformer: (data.powerTransformer || []).map((item: any) => ({ /* ... map item ... */ id: item.id, name: item.name, category: item.category, status: item.status || null, remarks: item.remarks || '' })),
          outdoorEquipment: (data.outdoorEquipment || []).map((item: any) => ({ /* ... map item ... */ id: item.id, name: item.name, category: item.category, status: item.status || null, remarks: item.remarks || '' }))
        } as SubstationInspection;
      });
      setSavedInspections(inspections);
    });

    return () => unsubscribe();
  }, [user]);

  // Initialize load monitoring records
  useEffect(() => {
    const initializeLoadMonitoring = async () => {
      if (!user) return;

      console.log("Initializing load monitoring records...");
      try {
        let q = query(collection(db, "loadMonitoring"));
        const { regionId, districtId } = getUserRegionAndDistrict(user, regions, districts);

        // Filter based on role
        if (user.role === "district_engineer" || user.role === "technician") {
          if (districtId) {
            q = query(collection(db, "loadMonitoring"), where("districtId", "==", districtId));
          }
        } else if (user.role === "regional_engineer") {
          if (regionId) {
            q = query(collection(db, "loadMonitoring"), where("regionId", "==", regionId));
          }
        }

        const snapshot = await getDocs(q);
        const records = snapshot.docs.map(doc => {
          const data = doc.data();
          const now = new Date().toISOString();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || now,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || now
          } as LoadMonitoringData;
        });

        console.log("Initial load monitoring records:", records.length);
        
        // Clear existing records before adding new ones
        await clearStore(STORE_NAMES.LOAD_MONITORING);
        await clearStore(STORE_NAMES.LOAD_MONITORING_CACHE);
        
        // Store in local storage with error handling
        for (const record of records) {
          try {
            await safeAddItem(STORE_NAMES.LOAD_MONITORING, record);
            await safeAddItem(STORE_NAMES.LOAD_MONITORING_CACHE, record);
          } catch (error) {
            if (error.name === 'ConstraintError') {
              console.log(`Record ${record.id} already exists, updating instead`);
              await safeUpdateItem(STORE_NAMES.LOAD_MONITORING, record);
              await safeUpdateItem(STORE_NAMES.LOAD_MONITORING_CACHE, record);
            } else {
              console.error(`Error storing record ${record.id}:`, error);
            }
          }
        }

        setLoadMonitoringRecords(records);
      } catch (error) {
        console.error("Error initializing load monitoring records:", error);
        // Try to recover by loading from cache
        try {
          const cachedRecords = await safeGetAllItems<LoadMonitoringData>(STORE_NAMES.LOAD_MONITORING_CACHE);
          if (cachedRecords.length > 0) {
            console.log("Recovered from cache:", cachedRecords.length, "records");
            setLoadMonitoringRecords(cachedRecords);
          }
        } catch (cacheError) {
          console.error("Failed to recover from cache:", cacheError);
        }
      }
    };

    initializeLoadMonitoring();
  }, [user, regions, districts]);

  // Subscribe to load monitoring records
  useEffect(() => {
    if (!user) {
      console.log("No user, skipping load monitoring subscription");
      return;
    }

    console.log("=== Starting Load Monitoring Subscription ===");
    console.log("User:", user.role);
    
    let q = query(collection(db, "loadMonitoring"), orderBy("date", "desc"));
    const { regionId, districtId } = getUserRegionAndDistrict(user, regions, districts);
    console.log("User region and district:", { regionId, districtId });

    // Filter based on role
    if (user.role === "district_engineer" || user.role === "technician") {
      if (districtId) {
        q = query(collection(db, "loadMonitoring"), where("districtId", "==", districtId), orderBy("date", "desc"));
        console.log("Filtering by district:", districtId);
      }
    } else if (user.role === "regional_engineer") {
      if (regionId) {
        q = query(collection(db, "loadMonitoring"), where("regionId", "==", regionId), orderBy("date", "desc"));
        console.log("Filtering by region:", regionId);
        }
      } else {
      console.log("No filters applied for role:", user.role);
    }

    console.log("Setting up load monitoring subscription...");

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        console.log("=== Load Monitoring Snapshot Received ===");
        console.log("Snapshot size:", snapshot.docs.length, "documents");
        
        // Get pending deletes
        const pendingDeletes = (await getPendingSyncItems())
          .filter(item => item.type === STORE_NAMES.LOAD_MONITORING && item.action === "delete")
          .map(item => item.data.id);

        if (navigator.onLine) {
          // Online mode - use Firestore data directly
          const records = snapshot.docs.map(doc => {
            const data = doc.data();
            const now = new Date().toISOString();
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || now,
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || now
            } as LoadMonitoringData;
          });

          // Cache to IndexedDB
          for (const record of records) {
            try {
              await safeAddItem(STORE_NAMES.LOAD_MONITORING_CACHE, record);
            } catch (e) {
              // Ignore duplicate errors
            }
          }

          setLoadMonitoringRecords(records);
        }
      } catch (error) {
        console.error("Error in load monitoring subscription:", error);
      }
    });

    return () => {
      console.log("=== Cleaning up Load Monitoring Subscription ===");
      unsubscribe();
    };
  }, [user, regions, districts]);

  // Add VIT asset
  const addVITAsset = async (asset: Omit<VITAsset, "id">) => {
    try {
      const now = new Date().toISOString();
      const newAsset: VITAsset = {
      ...asset,
        id: uuidv4(),
        createdAt: now,
        updatedAt: now
      };

      if (navigator.onLine) {
        // Online mode - save to Firestore
        const docRef = await addDoc(collection(db, "vitAssets"), newAsset);
        newAsset.id = docRef.id;
      } else {
        // Offline mode - save to IndexedDB
        await safeAddItem(STORE_NAMES.VIT_ASSETS, newAsset);
        await addToPendingSync(STORE_NAMES.VIT_ASSETS, "create", newAsset);
      }

      setVITAssets(prev => [...prev, newAsset]);
      return newAsset.id;
      } catch (error) {
      console.error("Error adding VIT asset:", error);
      throw error;
    }
  };

  // Update VIT asset
  const updateVITAsset = async (id: string, updates: Partial<VITAsset>) => {
    try {
      const now = new Date().toISOString();
      const updatedData = {
        ...updates,
        updatedAt: now
      };

      if (navigator.onLine) {
        // Online mode - update Firestore
        const docRef = doc(db, "vitAssets", id);
        await updateDoc(docRef, updatedData);
      } else {
        // Offline mode - update IndexedDB
        const existingAsset = await safeGetItem<VITAsset>(STORE_NAMES.VIT_ASSETS, id);
        if (existingAsset) {
          const updatedAsset = {
            ...existingAsset,
            ...updatedData
          };
          await safeUpdateItem(STORE_NAMES.VIT_ASSETS, updatedAsset);
          await addToPendingSync(STORE_NAMES.VIT_ASSETS, "update", updatedAsset);
        }
      }

      setVITAssets(prev => 
        prev.map(asset => asset.id === id ? { ...asset, ...updatedData } : asset)
      );
    } catch (error) {
      console.error("Error updating VIT asset:", error);
      throw error;
    }
  };

  // Delete VIT asset
  const deleteVITAsset = async (id: string) => {
    try {
      if (navigator.onLine) {
        // Online mode - delete from Firestore
      await deleteDoc(doc(db, "vitAssets", id));
      } else {
        // Offline mode - delete from IndexedDB
        await safeDeleteItem(STORE_NAMES.VIT_ASSETS, id);
        await addToPendingSync(STORE_NAMES.VIT_ASSETS, "delete", { id });
      }

      setVITAssets(prev => prev.filter(asset => asset.id !== id));
    } catch (error) {
      console.error("Error deleting VIT asset:", error);
      throw error;
    }
  };

  const addVITInspection = async (inspection: Omit<VITInspectionChecklist, "id">) => {
    try {
      const timestamp = new Date().toISOString();
      const inspectionWithTimestamps = {
        ...inspection,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      if (navigator.onLine) {
        const docRef = await addDoc(collection(db, "vitInspections"), {
          ...inspectionWithTimestamps,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success("Inspection saved successfully");
        return docRef.id;
      } else {
        const id = uuidv4();
        const offlineInspection = {
          ...inspectionWithTimestamps,
          id
        };
        await safeAddItem(STORE_NAMES.VIT_INSPECTIONS, offlineInspection);
        await addToPendingSync(STORE_NAMES.VIT_INSPECTIONS, "create", offlineInspection);
        toast.success("Inspection saved offline");
        setVITInspections(prev => [...prev, offlineInspection]);
        return id;
      }
    } catch (error) {
      console.error("Error saving inspection:", error);
      toast.error("Failed to save inspection");
      throw error;
    }
  };

  const updateVITInspection = async (id: string, updates: Partial<VITInspectionChecklist>) => {
    try {
      if (navigator.onLine) {
        const inspectionRef = doc(db, "vitInspections", id);
        await updateDoc(inspectionRef, {
        ...updates,
          updatedAt: serverTimestamp()
        });
        toast.success("Inspection updated successfully");
      } else {
        const offlineInspection = {
          ...updates,
          id,
          updatedAt: new Date().toISOString()
        };
        await updateItem("vitInspections", offlineInspection);
        await addToPendingSync("vitInspections", "update", offlineInspection);
        toast.success("Inspection updated offline");
      }
    } catch (error) {
      console.error("Error updating inspection:", error);
      toast.error("Failed to update inspection");
    }
  };
  
  const deleteVITInspection = async (id: string) => {
    try {
      if (navigator.onLine) {
        await deleteDoc(doc(db, "vitInspections", id));
        toast.success("Inspection deleted successfully");
      } else {
        await deleteItem("vitInspections", id);
        await addToPendingSync("vitInspections", "delete", { id });
        toast.success("Inspection marked for deletion");
      }
    } catch (error) {
      console.error("Error deleting inspection:", error);
      toast.error("Failed to delete inspection");
    }
  };

  const saveInspection = async (data: Omit<SubstationInspection, "id">) => {
    try {
      const now = new Date().toISOString();
      const newInspection: SubstationInspection & BaseRecord = {
        ...data,
        id: uuidv4(),
        createdAt: now,
        updatedAt: now,
        // Ensure all required fields have valid values
        region: data.region || "",
        regionId: data.regionId || "",
        district: data.district || "",
        districtId: data.districtId || "",
        substationNo: data.substationNo || "",
        substationName: data.substationName || "",
        type: data.type || "indoor",
        date: data.date || now,
        inspectionDate: data.inspectionDate || now,
        items: data.items || [],
        generalBuilding: data.generalBuilding || [],
        controlEquipment: data.controlEquipment || [],
        powerTransformer: data.powerTransformer || [],
        outdoorEquipment: data.outdoorEquipment || [],
        remarks: data.remarks || "",
        createdBy: data.createdBy || "Unknown",
        inspectedBy: data.inspectedBy || "Unknown",
        location: data.location || "",
        voltageLevel: data.voltageLevel || "",
        status: data.status || "Pending"
      };

      if (navigator.onLine) {
        // Online mode - save to Firestore
        const docRef = await addDoc(collection(db, "substationInspections"), newInspection);
        newInspection.id = docRef.id;
      } else {
        // Offline mode - save to IndexedDB
        await safeAddItem(STORE_NAMES.SUBSTATION_INSPECTIONS, newInspection);
        await addToPendingSync(STORE_NAMES.SUBSTATION_INSPECTIONS, "create", newInspection);
      }

      setSavedInspections(prev => [...prev, newInspection]);
      return newInspection.id;
    } catch (error) {
      console.error("Error saving inspection:", error);
      throw error;
    }
  };

  const updateSubstationInspection = async (id: string, updates: Partial<SubstationInspection>) => {
    try {
      const now = new Date().toISOString();
      const baseRecord: BaseRecord = {
        id,
        updatedAt: now,
        createdAt: now
      };

      if (navigator.onLine) {
      // Online mode - update Firestore
        const docRef = doc(db, "substationInspections", id);
        await updateDoc(docRef, {
          ...updates,
        updatedAt: serverTimestamp()
      });
    } else {
        // Offline mode - update IndexedDB
        const updatedData = {
          ...updates,
          ...baseRecord
        };
        await safeUpdateItem(STORE_NAMES.SUBSTATION_INSPECTIONS, updatedData);
        await addToPendingSync(STORE_NAMES.SUBSTATION_INSPECTIONS, "update", updatedData);
      }
    } catch (error) {
      console.error("Error updating inspection:", error);
      toast.error("Failed to update inspection");
    }
  };

  const updateDistrict = async (id: string, updates: Partial<District>) => {
    try {
      if (navigator.onLine) {
      const districtRef = doc(db, "districts", id);
        await updateDoc(districtRef, {
          ...updates,
          updatedAt: serverTimestamp()
        });
        toast.success("District updated successfully");
      } else {
        const offlineDistrict = {
          ...updates,
          id,
          updatedAt: new Date().toISOString()
        };
        await updateItem("districts", offlineDistrict);
        await addToPendingSync("districts", "update", offlineDistrict);
        toast.success("District updated offline");
      }
        } catch (error) {
      console.error("Error updating district:", error);
      toast.error("Failed to update district");
    }
  };

  const canEditAsset = useCallback((asset: VITAsset) => {
    if (!user) return false;
    return PermissionService.getInstance().canAccessFeature(user.role, 'asset_editing');
  }, [user]);

  const canEditInspection = useCallback((inspection: VITInspectionChecklist | SubstationInspection) => {
    if (!user) return false;
    return PermissionService.getInstance().canAccessFeature(user.role, 'inspection_editing');
  }, [user]);

  const canDeleteAsset = useCallback((asset: VITAsset) => {
    if (!user) return false;
    return PermissionService.getInstance().canAccessFeature(user.role, 'asset_deletion');
  }, [user]);

  const canDeleteInspection = useCallback((inspection: VITInspectionChecklist | SubstationInspection) => {
    if (!user) return false;
    return PermissionService.getInstance().canAccessFeature(user.role, 'inspection_deletion');
  }, [user]);

  const getSavedInspection = useCallback((id: string) => {
    return savedInspections.find(inspection => inspection.id === id);
  }, [savedInspections]);

  const canAddAsset = useCallback((regionName: string, districtName: string) => {
    return regions.some(region => region.name === regionName) && districts.some(district => district.name === districtName);
  }, [regions, districts]);

  const canAddInspection = useCallback((regionId: string, districtId: string) => {
    return regions.some(region => region.id === regionId) && districts.some(district => district.id === districtId);
  }, [regions, districts]);

  const getOP5FaultById = useCallback((id: string) => {
    return op5Faults.find(fault => fault.id === id);
  }, [op5Faults]);

  // Overhead line inspections subscription
  useEffect(() => {
    if (!user) return;

    let q = query(collection(db, "overheadLineInspections"), orderBy("createdAt", "desc"));
    // Apply role-based filtering
    if (user.role === "regional_engineer" && user.region) {
      q = query(
        collection(db, "overheadLineInspections"),
        where("region", "==", user.region),
        orderBy("createdAt", "desc")
      );
    } else if (user.role === "district_engineer" && user.region && user.district) {
      q = query(
        collection(db, "overheadLineInspections"),
        where("region", "==", user.region),
        where("district", "==", user.district),
        orderBy("createdAt", "desc")
      );
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        console.log("Received snapshot with", snapshot.docs.length, "documents");
        // Get offline data and pending deletes
        const offlineData = await safeGetAllItems<OverheadLineInspection & BaseRecord>(STORE_NAMES.OVERHEAD_LINE_INSPECTIONS);
        const pendingDeletes = (await getPendingSyncItems())
          .filter(item => item.type === STORE_NAMES.OVERHEAD_LINE_INSPECTIONS && item.action === "delete")
          .map(item => item.data.id);

        // Process Firestore data
        const inspections = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as OverheadLineInspection[];

        // Create a map of all records by ID and originalOfflineId
        const recordMap = new Map<string, OverheadLineInspection>();
        // Add Firestore records to map
        inspections.forEach(inspection => {
          recordMap.set(inspection.id, inspection);
          if ((inspection as any).originalOfflineId) {
            recordMap.set((inspection as any).originalOfflineId, inspection);
          }
        });
        // Add offline records that aren't in Firestore and aren't pending deletion
        offlineData.forEach(item => {
          if (!recordMap.has(item.id) && !pendingDeletes.includes(item.id)) {
            recordMap.set(item.id, item);
          }
        });
        // Convert map to array and sort by updatedAt
        const allInspections = Array.from(recordMap.values()).sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        // Update UI
        setOverheadLineInspections(allInspections);
        // Update cache with all current data
        await clearStore(STORE_NAMES.OVERHEAD_LINE_INSPECTIONS_CACHE);
        for (const inspection of allInspections) {
          await safeAddItem(STORE_NAMES.OVERHEAD_LINE_INSPECTIONS_CACHE, {
            ...inspection,
            createdAt: inspection.createdAt || new Date().toISOString(),
            updatedAt: inspection.updatedAt || new Date().toISOString(),
          });
      }
    } catch (error) {
        console.error("Error updating overhead line inspections:", error);
        toast.error("Error updating inspections list");
      }
    }, (error) => {
      console.error("Error in overhead line inspections snapshot:", error);
      toast.error("Error connecting to database");
    });
    return () => unsubscribe();
  }, [user]);

  // Delete overhead line inspection
  const deleteOverheadLineInspection = async (id: string) => {
    try {
      const cachedRecord = await safeGetItem<OverheadLineInspection & BaseRecord>(STORE_NAMES.OVERHEAD_LINE_INSPECTIONS_CACHE, id);
      if (navigator.onLine) {
        // Try to find the record by both ID and originalOfflineId
        const recordRef = doc(db, "overheadLineInspections", id);
        const recordSnap = await getDoc(recordRef);
        if (recordSnap.exists()) {
          await deleteDoc(recordRef);
        } else if (cachedRecord && (cachedRecord as any).originalOfflineId) {
          const q = query(
            collection(db, "overheadLineInspections"),
            where("originalOfflineId", "==", (cachedRecord as any).originalOfflineId)
          );
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            const docToDelete = querySnap.docs[0];
            await deleteDoc(doc(db, "overheadLineInspections", docToDelete.id));
            await safeDeleteItem(STORE_NAMES.OVERHEAD_LINE_INSPECTIONS_CACHE, docToDelete.id);
          }
        }
        // Remove from both stores
        await safeDeleteItem(STORE_NAMES.OVERHEAD_LINE_INSPECTIONS, id);
        await safeDeleteItem(STORE_NAMES.OVERHEAD_LINE_INSPECTIONS_CACHE, id);
        setOverheadLineInspections(prev => prev.filter(inspection => inspection.id !== id));
        toast.success("Inspection deleted successfully");
      } else {
        // Offline mode - mark for deletion in Firebase
        const record = await safeGetItem<OverheadLineInspection & BaseRecord>(STORE_NAMES.OVERHEAD_LINE_INSPECTIONS, id) || cachedRecord;
          if (record) {
          await addToPendingSync(STORE_NAMES.OVERHEAD_LINE_INSPECTIONS, "delete", record);
          await safeDeleteItem(STORE_NAMES.OVERHEAD_LINE_INSPECTIONS, id);
          await safeDeleteItem(STORE_NAMES.OVERHEAD_LINE_INSPECTIONS_CACHE, id);
          setOverheadLineInspections(prev => prev.filter(inspection => inspection.id !== id));
          toast.success("Inspection marked for deletion");
        } else {
          toast.error("Record not found");
        }
      }
    } catch (error) {
      console.error("Error deleting overhead line inspection:", error);
      toast.error("Failed to delete inspection");
      throw error;
    }
  };

  // Add overhead line inspection
  const addOverheadLineInspection = async (inspection: Omit<OverheadLineInspection, "id">) => {
    try {
      const timestamp = new Date().toISOString();
      const newInspection: OverheadLineInspection & BaseRecord = {
        ...inspection,
        id: uuidv4(),
        createdAt: timestamp,
        updatedAt: timestamp
      };
      if (navigator.onLine) {
        const docRef = await addDoc(collection(db, "overheadLineInspections"), {
          ...newInspection,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
        toast.success("Inspection saved successfully");
        return docRef.id;
      } else {
        await safeAddItem(STORE_NAMES.OVERHEAD_LINE_INSPECTIONS, newInspection);
        await addToPendingSync(STORE_NAMES.OVERHEAD_LINE_INSPECTIONS, "create", newInspection);
        toast.success("Inspection saved offline");
        setOverheadLineInspections(prev => [...prev, newInspection]);
        return newInspection.id;
      }
    } catch (error) {
      console.error("Error adding overhead line inspection:", error);
      toast.error("Failed to save inspection");
      throw error;
    }
  };

  // Update overhead line inspection
  const updateOverheadLineInspection = async (id: string, updates: Partial<OverheadLineInspection>) => {
    try {
      const cachedRecord = await safeGetItem<OverheadLineInspection & BaseRecord>(STORE_NAMES.OVERHEAD_LINE_INSPECTIONS_CACHE, id);
      const now = new Date().toISOString();
      if (navigator.onLine) {
        let firebaseId = id;
        const recordRef = doc(db, "overheadLineInspections", id);
        const recordSnap = await getDoc(recordRef);
        if (!recordSnap.exists() && cachedRecord && (cachedRecord as any).originalOfflineId) {
          const q = query(
            collection(db, "overheadLineInspections"),
            where("originalOfflineId", "==", (cachedRecord as any).originalOfflineId)
          );
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            firebaseId = querySnap.docs[0].id;
          } else {
            throw new Error("Record not found in Firebase");
          }
        }
        const correctRef = doc(db, "overheadLineInspections", firebaseId);
        await updateDoc(correctRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
        const updatedRecord = {
          ...cachedRecord,
          ...updates,
          id: firebaseId,
          updatedAt: now,
          createdAt: cachedRecord?.createdAt || now
        };
        await safeUpdateItem(STORE_NAMES.OVERHEAD_LINE_INSPECTIONS_CACHE, updatedRecord);
        setOverheadLineInspections(prev =>
          prev.map(inspection =>
            inspection.id === id || inspection.id === firebaseId ? updatedRecord : inspection
          )
        );
        toast.success("Inspection updated successfully");
      } else {
        const offlineInspection = {
          ...updates,
          id,
          updatedAt: now,
          createdAt: cachedRecord?.createdAt || now
        };
        await safeUpdateItem(STORE_NAMES.OVERHEAD_LINE_INSPECTIONS, offlineInspection);
        await addToPendingSync(STORE_NAMES.OVERHEAD_LINE_INSPECTIONS, "update", offlineInspection);
        setOverheadLineInspections(prev =>
          prev.map(inspection =>
            inspection.id === id ? { ...inspection, ...offlineInspection } : inspection
          )
        );
        toast.success("Inspection updated offline");
        }
    } catch (error) {
      console.error("Error updating overhead line inspection:", error);
      toast.error("Failed to update inspection");
      throw error;
    }
  };

  const deleteInspection = async (id: string) => {
    try {
    if (navigator.onLine) {
        // Online mode - delete from Firestore
        await deleteDoc(doc(db, "substationInspections", id));
      } else {
        // Offline mode - delete from IndexedDB
        await safeDeleteItem(STORE_NAMES.SUBSTATION_INSPECTIONS, id);
        await addToPendingSync(STORE_NAMES.SUBSTATION_INSPECTIONS, "delete", { id });
      }
      setSavedInspections(prev => prev.filter(inspection => inspection.id !== id));
    } catch (error) {
      console.error("Error deleting inspection:", error);
      throw error;
    }
  };

  // Function to delete a fault
  const deleteFault = useCallback(async (id: string, isOP5: boolean) => {
    try {
      const storeName = isOP5 ? STORE_NAMES.OP5_FAULTS : STORE_NAMES.CONTROL_OUTAGES;
      const collectionName = isOP5 ? "op5Faults" : "controlOutages";

      if (navigator.onLine) {
        // Online mode - delete from Firestore
        await deleteDoc(doc(db, collectionName, id));
        
        // Clear cache and update state
    if (isOP5) {
          await clearCacheAndUpdateState<OP5Fault>(
            storeName,
            collectionName,
            setOP5Faults as React.Dispatch<React.SetStateAction<(OP5Fault & { isOnline: boolean; synced: boolean })[]>>
          );
        } else {
          await clearCacheAndUpdateState<ControlSystemOutage>(
            storeName,
            collectionName,
            setControlSystemOutages as React.Dispatch<React.SetStateAction<(ControlSystemOutage & { isOnline: boolean; synced: boolean })[]>>
          );
        }
        
        toast.success(`${isOP5 ? "OP5 Fault" : "Control System Outage"} deleted successfully`);
    } else {
        // Offline mode - mark for deletion
        await safeDeleteItem(storeName, id);
        await addToPendingSync(storeName, "delete", { id });
        
        // Clear cache and update state
    if (isOP5) {
          await clearCacheAndUpdateState<OP5Fault>(
            storeName,
            collectionName,
            setOP5Faults as React.Dispatch<React.SetStateAction<(OP5Fault & { isOnline: boolean; synced: boolean })[]>>
          );
    } else {
          await clearCacheAndUpdateState<ControlSystemOutage>(
            storeName,
            collectionName,
            setControlSystemOutages as React.Dispatch<React.SetStateAction<(ControlSystemOutage & { isOnline: boolean; synced: boolean })[]>>
          );
        }
        
        toast.success(`${isOP5 ? "OP5 Fault" : "Control System Outage"} marked for deletion`);
      }
    } catch (error) {
      console.error("Error deleting fault:", error);
      toast.error("Failed to delete fault");
    }
  }, []);

  // Function to get filtered faults
  const getFilteredFaults = useCallback((regionId?: string, districtId?: string) => {
    console.log('[DataContext] getFilteredFaults called with:', { regionId, districtId });
    
    let filteredOP5Faults = [...op5Faults];
    let filteredControlOutages = [...controlSystemOutages];

    if (regionId) {
      filteredOP5Faults = filteredOP5Faults.filter(fault => fault.regionId === regionId);
      filteredControlOutages = filteredControlOutages.filter(outage => outage.regionId === regionId);
    }

    if (districtId) {
      filteredOP5Faults = filteredOP5Faults.filter(fault => fault.districtId === districtId);
      filteredControlOutages = filteredControlOutages.filter(outage => outage.districtId === districtId);
    }

    return {
      op5Faults: filteredOP5Faults,
      controlOutages: filteredControlOutages
    };
  }, [op5Faults, controlSystemOutages]);

  // Function to check if user can resolve faults
  const canResolveFault = useCallback((fault: OP5Fault | ControlSystemOutage) => {
    if (!user) return false;
    return PermissionService.getInstance().canAccessFeature(user.role, 'fault_resolution');
  }, [user]);

  // Function to check if user can edit faults
  const canEditFault = useCallback((fault: OP5Fault | ControlSystemOutage) => {
    if (!user) return false;

    // Check if user has permission to edit faults
    if (!PermissionService.getInstance().canAccessFeature(user.role, 'fault_reporting_update')) {
      return false;
    }

    // System admins and global engineers can edit any fault
    if (user.role === "system_admin" || user.role === "global_engineer") {
      return true;
    }

    // Regional engineers can edit faults in their region
    if (user.role === "regional_engineer") {
      const userRegion = regions.find(r => r.name === user.region);
      return userRegion?.id === fault.regionId;
    }

    // District engineers and technicians can edit faults in their district
    if (user.role === "district_engineer" || user.role === "technician") {
      const userDistrict = districts.find(d => d.name === user.district);
      return userDistrict?.id === fault.districtId;
    }

    return false;
  }, [user, regions, districts]);

  // Function to resolve a fault
  const resolveFault = useCallback(async (id: string, isOP5: boolean) => {
    try {
      const formattedDate = new Date().toISOString();
      const updateData = {
        status: "resolved" as const,
        restorationDate: formattedDate,
        updatedAt: serverTimestamp()
      };
      
      // Get the current fault/outage data
      const currentData = isOP5 
        ? op5Faults.find(f => f.id === id)
        : controlSystemOutages.find(o => o.id === id);

      if (!currentData) {
        throw new Error("Fault not found");
      }

      // Update Firestore
      const collectionName = isOP5 ? "op5Faults" : "controlOutages";
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, updateData);

      // Update local state
      if (isOP5) {
        setOP5Faults(prevFaults => 
          prevFaults.map(fault => 
            fault.id === id 
              ? { ...fault, ...updateData, updatedAt: formattedDate }
              : fault
          )
        );
      } else {
        setControlSystemOutages(prevOutages => 
          prevOutages.map(outage => 
            outage.id === id 
              ? { ...outage, ...updateData, updatedAt: formattedDate }
              : outage
          )
        );
      }

      toast.success(`${isOP5 ? "OP5 Fault" : "Control System Outage"} resolved successfully`);
    } catch (error) {
      console.error("Error resolving fault:", error);
      toast.error("Failed to resolve fault");
    }
  }, [op5Faults, controlSystemOutages]);

  // Add control system outage functions
  const addControlSystemOutage = async (outage: Omit<ControlSystemOutage, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">) => {
    try {
      // Access user directly from the hook within the function
      const docRef = await addDoc(collection(db, "controlOutages"), {
        ...outage,
        createdAt: serverTimestamp(), // Use server timestamp for Firestore
        updatedAt: serverTimestamp(), // Use server timestamp for Firestore
        createdBy: user?.id || 'unknown', // Use user ID from AuthContext, fallback to 'unknown'
        updatedBy: user?.id || 'unknown'  // Use user ID from AuthContext, fallback to 'unknown'
      });
      
      const newOutage: ControlSystemOutage = {
        ...outage,
        id: docRef.id,
        createdAt: new Date().toISOString(), // Use client timestamp for immediate state update
        updatedAt: new Date().toISOString(), // Use client timestamp for immediate state update
        createdBy: user?.id || 'unknown', // Include user ID in local state
        updatedBy: user?.id || 'unknown'  // Include user ID in local state
      };
      
      setControlSystemOutages(prev => [...prev, newOutage]);
      toast.success("Outage saved successfully");
      return docRef.id;
    } catch (error) {
      console.error("Error saving outage:", error);
      toast.error("Failed to save outage");
      throw error;
    }
  };

  const updateControlSystemOutage = async (id: string, data: Partial<ControlSystemOutage>) => {
    try {
      const outageRef = doc(db, "controlOutages", id);
      await updateDoc(outageRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      
      setControlSystemOutages(prev => prev.map(outage => 
        outage.id === id 
          ? { ...outage, ...data, updatedAt: new Date().toISOString() }
          : outage
      ));
      
      toast.success("Outage updated successfully");
    } catch (error) {
      console.error("Error updating outage:", error);
      toast.error("Failed to update outage");
    }
  };

  const deleteControlSystemOutage = async (id: string) => {
    try {
      await deleteDoc(doc(db, "controlOutages", id));
      setControlSystemOutages(prev => prev.filter(outage => outage.id !== id));
      toast.success("Outage deleted successfully");
    } catch (error) {
      console.error("Error deleting outage:", error);
      toast.error("Failed to delete outage");
    }
  };

  // Add OP5 fault functions
  const addOP5Fault = async (fault: Omit<OP5Fault, "id">) => {
    try {
      const docRef = await addDoc(collection(db, "op5Faults"), {
        ...fault,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      const newFault: OP5Fault = {
        ...fault,
        id: docRef.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      setOP5Faults(prev => [...prev, newFault]);
      toast.success("Fault saved successfully");
      return docRef.id;
    } catch (error) {
      console.error("Error saving fault:", error);
      toast.error("Failed to save fault");
      throw error;
    }
  };

  const updateOP5Fault = async (id: string, data: Partial<OP5Fault>) => {
    try {
      const faultRef = doc(db, "op5Faults", id);
      await updateDoc(faultRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      
      setOP5Faults(prev => prev.map(fault => 
        fault.id === id 
          ? { ...fault, ...data, updatedAt: new Date().toISOString() }
          : fault
      ));
      
      toast.success("Fault updated successfully");
    } catch (error) {
      console.error("Error updating fault:", error);
      toast.error("Failed to update fault");
    }
  };

  const deleteOP5Fault = async (id: string) => {
    try {
      await deleteDoc(doc(db, "op5Faults", id));
      setOP5Faults(prev => prev.filter(fault => fault.id !== id));
      toast.success("Fault deleted successfully");
    } catch (error) {
      console.error("Error deleting fault:", error);
      toast.error("Failed to delete fault");
    }
  };

  // Add load monitoring functions
  const saveLoadMonitoringRecord = async (record: Omit<LoadMonitoringData, "id">) => {
    try {
      const docRef = await addDoc(collection(db, "loadMonitoring"), {
        ...record,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      const newRecord: LoadMonitoringData = {
        ...record,
        id: docRef.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      setLoadMonitoringRecords(prev => [...prev, newRecord]);
      toast.success("Load monitoring record saved successfully");
      return docRef.id;
    } catch (error) {
      console.error("Error saving load monitoring record:", error);
      toast.error("Failed to save load monitoring record");
      throw error;
    }
  };

  const getLoadMonitoringRecord = async (id: string) => {
    try {
      const docRef = doc(db, "loadMonitoring", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as LoadMonitoringData;
      }
      return null;
    } catch (error) {
      console.error("Error getting load monitoring record:", error);
      toast.error("Failed to get load monitoring record");
      return null;
    }
  };

  const updateLoadMonitoringRecord = async (id: string, data: Partial<LoadMonitoringData>) => {
    try {
      const recordRef = doc(db, "loadMonitoring", id);
      await updateDoc(recordRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      
      setLoadMonitoringRecords(prev => prev.map(record => 
        record.id === id 
          ? { ...record, ...data, updatedAt: new Date().toISOString() }
          : record
      ));
      
      toast.success("Load monitoring record updated successfully");
    } catch (error) {
      console.error("Error updating load monitoring record:", error);
      toast.error("Failed to update load monitoring record");
    }
  };

  const deleteLoadMonitoringRecord = async (id: string) => {
    try {
      await deleteDoc(doc(db, "loadMonitoring", id));
      setLoadMonitoringRecords(prev => prev.filter(record => record.id !== id));
      toast.success("Load monitoring record deleted successfully");
    } catch (error) {
      console.error("Error deleting load monitoring record:", error);
      toast.error("Failed to delete load monitoring record");
    }
  };

  useEffect(() => {
    // Listen for offline fault additions
    const handleFaultAdded = (event: CustomEvent) => {
      const { fault, type, status, error } = event.detail;
      
      if (status === 'error') {
        console.error('[DataContext] Error saving fault offline:', error);
        toast.error('Failed to save fault offline. Please try again.');
        return;
      }

      if (status === 'success') {
        if (type === 'op5') {
          setOP5Faults(prev => [...prev, fault]);
        } else {
          setControlSystemOutages(prev => [...prev, fault]);
        }
      }
    };

    window.addEventListener('faultAdded', handleFaultAdded as EventListener);

    return () => {
      window.removeEventListener('faultAdded', handleFaultAdded as EventListener);
    };
  }, []);

  return (
    <DataContext.Provider
      value={{
        regions,
        districts,
        regionsLoading,
        districtsLoading,
        regionsError,
        districtsError,
        retryRegionsAndDistricts: () => fetchRegionsAndDistricts(),
        op5Faults,
        controlSystemOutages,
        addOP5Fault,
        updateOP5Fault,
        deleteOP5Fault,
        addControlSystemOutage,
        updateControlSystemOutage,
        deleteControlSystemOutage,
        canResolveFault,
        getFilteredFaults,
        resolveFault,
        deleteFault,
        canEditFault,
        loadMonitoringRecords,
        setLoadMonitoringRecords,
        saveLoadMonitoringRecord,
        getLoadMonitoringRecord,
        updateLoadMonitoringRecord,
        deleteLoadMonitoringRecord,
        vitAssets,
        setVITAssets,
        vitInspections,
        setVITInspections,
        addVITAsset,
        updateVITAsset,
        deleteVITAsset,
        addVITInspection,
        updateVITInspection,
        deleteVITInspection,
        savedInspections,
        setSavedInspections,
        saveInspection,
        updateSubstationInspection,
        deleteInspection,
        updateDistrict,
        canEditAsset,
        canEditInspection,
        canDeleteAsset,
        canDeleteInspection,
        getSavedInspection,
        canAddAsset,
        canAddInspection,
        getOP5FaultById,
        overheadLineInspections,
        addOverheadLineInspection,
        updateOverheadLineInspection,
        deleteOverheadLineInspection
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
