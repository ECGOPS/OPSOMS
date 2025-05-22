import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
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
  FaultType,
  InspectionItem,
  AffectedPopulation,
  ReliabilityIndices,
  OverheadLineInspection,
  ConditionStatus
} from "@/lib/types";
import { LoadMonitoringData, SubstationInspection } from "@/lib/asset-types";
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
  QueryDocumentSnapshot,
  limit,
  startAfter,
  getCountFromServer
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
import { FaultService } from '@/services/FaultService';
import { LoadMonitoringService } from '@/services/LoadMonitoringService';
import { SubstationInspectionService } from '@/services/SubstationInspectionService';
import { syncPendingChanges } from '@/utils/sync';
import { getAllItems } from "@/lib/indexedDB";
import { SMSService } from "@/services/SMSService";

const DB_NAME = 'ecg-oms-db';
const DB_VERSION = 4;  // Update from 3 to 4

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
  SUBSTATION_INSPECTIONS_CACHE: 'substationInspections-cache' as StoreName,
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
  resolveFault: (id: string, isOP5: boolean, restorationDate: string) => Promise<void>;
  deleteFault: (id: string, isOP5: boolean) => Promise<void>;
  canEditFault: (fault: OP5Fault | ControlSystemOutage) => boolean;
  loadMonitoringRecords?: LoadMonitoringData[];
  setLoadMonitoringRecords: React.Dispatch<React.SetStateAction<LoadMonitoringData[] | undefined>>;
  saveLoadMonitoringRecord: (record: Omit<LoadMonitoringData, "id">) => Promise<string>;
  getLoadMonitoringRecord: (id: string) => Promise<LoadMonitoringData | undefined>;
  updateLoadMonitoringRecord: (id: string, data: Partial<LoadMonitoringData>) => Promise<void>;
  deleteLoadMonitoringRecord: (id: string) => Promise<void>;
  initializeLoadMonitoring: () => Promise<void>;
  vitAssets: VITAsset[];
  vitInspections: VITInspectionChecklist[];
  addVITAsset: (asset: Omit<VITAsset, "id">) => Promise<string>;
  updateVITAsset: (id: string, updates: Partial<VITAsset>) => Promise<void>;
  deleteVITAsset: (id: string) => Promise<void>;
  addVITInspection: (inspection: Omit<VITInspectionChecklist, "id">) => Promise<string>;
  updateVITInspection: (id: string, updates: Partial<VITInspectionChecklist>) => Promise<void>;
  deleteVITInspection: (id: string) => Promise<void>;
  savedInspections: SubstationInspection[];
  setSavedInspections: React.Dispatch<React.SetStateAction<SubstationInspection[]>>;
  saveInspection: (inspection: SubstationInspection) => Promise<string>;
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
  canEditLoadMonitoring: boolean;
  canDeleteLoadMonitoring: boolean;
  refreshInspections: () => Promise<void>;
}

export const DataContext = createContext<DataContextType>({
  regions: [],
  districts: [],
  regionsLoading: true,
  districtsLoading: true,
  regionsError: null,
  districtsError: null,
  retryRegionsAndDistricts: () => Promise.resolve(),
  op5Faults: [],
  controlSystemOutages: [],
  addOP5Fault: async () => '',
  updateOP5Fault: async () => {},
  deleteOP5Fault: async () => {},
  addControlSystemOutage: async () => '',
  updateControlSystemOutage: async () => {},
  deleteControlSystemOutage: async () => {},
  canResolveFault: () => false,
  getFilteredFaults: () => ({ op5Faults: [], controlOutages: [] }),
  resolveFault: async () => {},
  deleteFault: async () => {},
  canEditFault: () => false,
  loadMonitoringRecords: undefined,
  setLoadMonitoringRecords: () => {},
  saveLoadMonitoringRecord: async () => '',
  getLoadMonitoringRecord: async () => undefined,
  updateLoadMonitoringRecord: async () => {},
  deleteLoadMonitoringRecord: async () => {},
  initializeLoadMonitoring: async () => {},
  vitAssets: [],
  vitInspections: [],
  addVITAsset: async () => '',
  updateVITAsset: async () => {},
  deleteVITAsset: async () => {},
  addVITInspection: async () => '',
  updateVITInspection: async () => {},
  deleteVITInspection: async () => {},
  savedInspections: [],
  setSavedInspections: () => {},
  saveInspection: async () => '',
  updateSubstationInspection: async () => {},
  deleteInspection: async () => {},
  updateDistrict: async () => {},
  canEditAsset: () => false,
  canEditInspection: () => false,
  canDeleteAsset: () => false,
  canDeleteInspection: () => false,
  setVITAssets: () => {},
  setVITInspections: () => {},
  getSavedInspection: () => undefined,
  canAddAsset: () => false,
  canAddInspection: () => false,
  getOP5FaultById: () => undefined,
  overheadLineInspections: [],
  addOverheadLineInspection: async () => '',
  updateOverheadLineInspection: async () => {},
  deleteOverheadLineInspection: async () => {},
  canEditLoadMonitoring: false,
  canDeleteLoadMonitoring: false,
  refreshInspections: async () => {},
});

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
  const [canEditLoadMonitoring, setCanEditLoadMonitoring] = useState(false);
  const [canDeleteLoadMonitoring, setCanDeleteLoadMonitoring] = useState(false);
  const inspectionService = SubstationInspectionService.getInstance();

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
      if (user.role === "district_engineer" || user.role === "technician" || user.role === "district_manager") {
        q = query(collection(db, "vitAssets"), where("district", "==", user.district));
      } else if (user.role === "regional_engineer" || user.role === "regional_general_manager") {
        q = query(collection(db, "vitAssets"), where("region", "==", user.region));
      }
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        // Use a Map to ensure unique assets by ID
        const assetMap = new Map<string, VITAsset>();
        
        snapshot.docs.forEach(doc => {
          const asset = {
            id: doc.id,
            ...doc.data()
          } as VITAsset;
          assetMap.set(doc.id, asset);
        });
        
        // Convert Map back to array
        const assets = Array.from(assetMap.values());
        setVITAssets(assets);
      } catch (error) {
        console.error("Error updating VIT assets:", error);
        toast.error("Error updating assets list");
      }
    });

    return () => unsubscribe();
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

    let q = query(collection(db, "substationInspections"), orderBy("createdAt", "desc"));
    
    // Only apply filters if not system_admin or global_engineer
    if (user.role !== "system_admin" && user.role !== "global_engineer") {
      if (user.role === "district_engineer" || user.role === "technician" || user.role === "district_manager") {
        const userDistrict = districts.find(d => d.name === user.district);
        const userRegion = regions.find(r => r.name === user.region);
        if (userDistrict && userRegion) {
          q = query(
            collection(db, "substationInspections"),
            where("districtId", "==", userDistrict.id),
            where("regionId", "==", userRegion.id),
            orderBy("createdAt", "desc")
          );
        }
      } else if (user.role === "regional_engineer" || user.role === "regional_general_manager") {
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          q = query(
            collection(db, "substationInspections"),
            where("regionId", "==", userRegion.id),
            orderBy("createdAt", "desc")
          );
        }
      }
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const inspections = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt
          } as SubstationInspection;
        });
        setSavedInspections(inspections);
      } catch (error) {
        console.error("Error updating substation inspections:", error);
        toast.error("Error updating inspections list");
      }
    });

    return () => unsubscribe();
  }, [user, regions, districts]);

  // Add OP5 fault functions
  const addOP5Fault = async (fault: Omit<OP5Fault, "id">) => {
    try {
      const docRef = await addDoc(collection(db, "op5Faults"), {
        ...fault,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error("Error adding OP5 fault:", error);
      toast.error("Failed to add fault");
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
      toast.success("Fault updated successfully");
    } catch (error) {
      console.error("Error updating OP5 fault:", error);
      toast.error("Failed to update fault");
    }
  };

  const deleteOP5Fault = async (id: string) => {
    try {
      await deleteDoc(doc(db, "op5Faults", id));
      toast.success("Fault deleted successfully");
    } catch (error) {
      console.error("Error deleting OP5 fault:", error);
      toast.error("Failed to delete fault");
    }
  };

  // Add control system outage functions
  const addControlSystemOutage = async (outage: Omit<ControlSystemOutage, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">) => {
    try {
      const docRef = await addDoc(collection(db, "controlOutages"), {
        ...outage,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.id || 'unknown',
        updatedBy: user?.id || 'unknown'
      });
      return docRef.id;
    } catch (error) {
      console.error("Error adding control system outage:", error);
      toast.error("Failed to add outage");
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
      toast.success("Outage updated successfully");
    } catch (error) {
      console.error("Error updating control system outage:", error);
      toast.error("Failed to update outage");
    }
  };

  const deleteControlSystemOutage = async (id: string) => {
    try {
      await deleteDoc(doc(db, "controlOutages", id));
      toast.success("Outage deleted successfully");
    } catch (error) {
      console.error("Error deleting control system outage:", error);
      toast.error("Failed to delete outage");
    }
  };

  // Add fault utility functions
  const canResolveFault = useCallback((fault: OP5Fault | ControlSystemOutage) => {
    if (!user) return false;
    return PermissionService.getInstance().canAccessFeature(user.role, 'fault_resolution');
  }, [user]);

  const getFilteredFaults = useCallback((regionId?: string, districtId?: string) => {
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

  const resolveFault = useCallback(async (id: string, isOP5: boolean, restorationDate: string) => {
    try {
      const updateData = {
        status: "resolved" as const,
        restorationDate,
        updatedAt: serverTimestamp()
      };
      
      const collectionName = isOP5 ? "op5Faults" : "controlOutages";
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, updateData);
      
      toast.success(`${isOP5 ? "OP5 Fault" : "Control System Outage"} resolved successfully`);
    } catch (error) {
      console.error("Error resolving fault:", error);
      toast.error("Failed to resolve fault");
    }
  }, []);

  const deleteFault = useCallback(async (id: string, isOP5: boolean) => {
    try {
      const collectionName = isOP5 ? "op5Faults" : "controlOutages";
      await deleteDoc(doc(db, collectionName, id));
      toast.success(`${isOP5 ? "OP5 Fault" : "Control System Outage"} deleted successfully`);
    } catch (error) {
      console.error("Error deleting fault:", error);
      toast.error("Failed to delete fault");
    }
  }, []);

  // Add load monitoring functions
  const saveLoadMonitoringRecord = async (record: Omit<LoadMonitoringData, "id">) => {
    try {
      const docRef = await addDoc(collection(db, "loadMonitoring"), {
        ...record,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error("Error saving load monitoring record:", error);
      toast.error("Failed to save record");
      throw error;
    }
  };

  const getLoadMonitoringRecord = async (id: string) => {
    try {
      const docRef = doc(db, "loadMonitoring", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as LoadMonitoringData;
      }
      return undefined;
    } catch (error) {
      console.error("Error getting load monitoring record:", error);
      toast.error("Failed to get record");
      throw error;
    }
  };

  const updateLoadMonitoringRecord = async (id: string, data: Partial<LoadMonitoringData>) => {
    try {
      const docRef = doc(db, "loadMonitoring", id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      toast.success("Record updated successfully");
    } catch (error) {
      console.error("Error updating load monitoring record:", error);
      toast.error("Failed to update record");
      throw error;
    }
  };

  const deleteLoadMonitoringRecord = async (id: string) => {
    try {
      await deleteDoc(doc(db, "loadMonitoring", id));
      toast.success("Record deleted successfully");
    } catch (error) {
      console.error("Error deleting load monitoring record:", error);
      toast.error("Failed to delete record");
      throw error;
    }
  };

  // Subscribe to load monitoring records
  useEffect(() => {
    if (!user) return;

    let q = query(collection(db, "loadMonitoring"));
    
    // Only apply filters if not system_admin or global_engineer
    if (user.role !== "system_admin" && user.role !== "global_engineer") {
      if (user.role === "district_engineer" || user.role === "technician" || user.role === "district_manager") {
        const userDistrict = districts.find(d => d.name === user.district);
        const userRegion = regions.find(r => r.name === user.region);
        if (userDistrict && userRegion) {
          q = query(
            collection(db, "loadMonitoring"),
            where("districtId", "==", userDistrict.id),
            where("regionId", "==", userRegion.id)
          );
        }
      } else if (user.role === "regional_engineer" || user.role === "regional_general_manager") {
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          q = query(
            collection(db, "loadMonitoring"),
            where("regionId", "==", userRegion.id)
          );
        }
      }
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LoadMonitoringData[];
      setLoadMonitoringRecords(records);
    });

    return () => unsubscribe();
  }, [user, regions, districts]);

  // Set permissions for load monitoring
  useEffect(() => {
    if (!user) return;
    
    const canEdit = user.role === "system_admin" || 
                   user.role === "global_engineer" || 
                   user.role === "regional_engineer" || 
                   user.role === "district_engineer";
    
    const canDelete = user.role === "system_admin" || 
                     user.role === "global_engineer";
    
    setCanEditLoadMonitoring(canEdit);
    setCanDeleteLoadMonitoring(canDelete);
  }, [user]);

  const initializeLoadMonitoring = async () => {
    try {
      let q = query(collection(db, "loadMonitoring"));
      
      // Only apply filters if not system_admin or global_engineer
      if (user?.role !== "system_admin" && user?.role !== "global_engineer") {
        if (user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") {
          const userDistrict = districts.find(d => d.name === user.district);
          const userRegion = regions.find(r => r.name === user.region);
          if (userDistrict && userRegion) {
            q = query(
              collection(db, "loadMonitoring"),
              where("districtId", "==", userDistrict.id),
              where("regionId", "==", userRegion.id)
            );
          }
        } else if (user?.role === "regional_engineer" || user?.role === "regional_general_manager") {
          const userRegion = regions.find(r => r.name === user.region);
          if (userRegion) {
            q = query(
              collection(db, "loadMonitoring"),
              where("regionId", "==", userRegion.id)
            );
          }
        }
      }

      const snapshot = await getDocs(q);
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LoadMonitoringData[];
      setLoadMonitoringRecords(records);
    } catch (error) {
      console.error("Error initializing load monitoring:", error);
      toast.error("Failed to initialize load monitoring");
      throw error;
    }
  };

  // Add this function to actually update a district in Firestore
  const updateDistrict = async (id: string, updates: Partial<District>) => {
    try {
      const districtRef = doc(db, "districts", id);
      await updateDoc(districtRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      toast.success("District updated successfully");
      // Optionally update local state immediately for responsiveness
      setDistricts((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
        )
      );
    } catch (error) {
      console.error("Error updating district:", error);
      toast.error("Failed to update district");
      throw error;
    }
  };

  // Update context value
  const contextValue: DataContextType = {
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
    canEditFault: () => true,
    loadMonitoringRecords,
    setLoadMonitoringRecords,
    saveLoadMonitoringRecord,
    getLoadMonitoringRecord,
    updateLoadMonitoringRecord,
    deleteLoadMonitoringRecord,
    initializeLoadMonitoring,
    vitAssets,
    vitInspections,
    addVITAsset: async () => '',
    updateVITAsset: async () => {},
    deleteVITAsset: async () => {},
    addVITInspection: async () => '',
    updateVITInspection: async () => {},
    deleteVITInspection: async () => {},
    savedInspections,
    setSavedInspections: () => {},
    saveInspection: async () => '',
    updateSubstationInspection: async () => {},
    deleteInspection: async () => {},
    updateDistrict,
    canEditAsset: () => true,
    canEditInspection: () => true,
    canDeleteAsset: () => true,
    canDeleteInspection: () => true,
    setVITAssets: () => {},
    setVITInspections: () => {},
    getSavedInspection: () => undefined,
    canAddAsset: () => true,
    canAddInspection: () => true,
    getOP5FaultById: (id: string) => op5Faults.find(f => f.id === id),
    overheadLineInspections,
    addOverheadLineInspection: async () => '',
    updateOverheadLineInspection: async () => {},
    deleteOverheadLineInspection: async () => {},
    canEditLoadMonitoring,
    canDeleteLoadMonitoring,
    refreshInspections: async () => {},
  };

  return (
    <DataContext.Provider value={contextValue}>
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
