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
  setDoc
} from "firebase/firestore";
import { getUserRegionAndDistrict } from "@/utils/user-utils";
import { resetFirestoreConnection } from "@/config/firebase";
import { addItem, addToPendingSync, getPendingSyncItems, clearPendingSyncItem, deleteItem, getAllItems, updateItem, getItem, initDB } from "@/utils/db";
import { openDB } from "idb";

const DB_NAME = 'ecg-oms-db';
const DB_VERSION = 3;

// Add clearStore function
async function clearStore(storeName: string) {
  const db = await openDB(DB_NAME, DB_VERSION);
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  await store.clear();
  await tx.done;
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
  addControlSystemOutage: (outage: Omit<ControlSystemOutage, "id">) => Promise<string>;
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
        const offlineData = await getAllItems("vit-assets");
        const pendingDeletes = (await getPendingSyncItems())
          .filter(item => item.type === "vit-assets" && item.action === "delete")
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
              // If record exists online, only include offline version if it's newer
              return item.updatedAt > onlineRecord.updatedAt && !pendingDeletes.includes(item.id);
            })
          ];

          // Ensure no duplicates by using a Map and keeping the most recent version
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
          await clearStore("vit-assets-cache");
          for (const asset of uniqueAssets) {
            try {
              await addItem("vit-assets-cache", asset);
            } catch (e) {
              console.error("Error caching VIT asset:", e);
            }
          }
        } else {
          // Offline mode - use cached and unsynced data
          const cache = await getAllItems("vit-assets-cache");
          
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
              // If record exists in cache, only include unsynced version if it's newer
              return item.updatedAt > cachedRecord.updatedAt && !pendingDeletes.includes(item.id);
            })
          ];

          // Ensure no duplicates by using a Map and keeping the most recent version
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
        toast.error("Error updating assets list");
      }
    }, (error) => {
      console.error("Error in VIT assets subscription:", error);
      toast.error("Error connecting to database");
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
        // Find the user's district ID
        const userDistrict = districts.find(d => d.name === user.district);
        if (userDistrict) {
          q = query(collection(db, "op5Faults"), where("districtId", "==", userDistrict.id));
        }
      } else if (user.role === "regional_engineer") {
        // Find the user's region ID
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          q = query(collection(db, "op5Faults"), where("regionId", "==", userRegion.id));
        }
      }
    }

    console.log('[DataContext] Setting up OP5 faults subscription');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('[DataContext] OP5 faults snapshot received:', {
        docChanges: snapshot.docChanges().map(change => ({
          type: change.type,
          docId: change.doc.id,
          data: change.doc.data()
        }))
      });
      
      const faults = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as OP5Fault[];
      
      console.log('[DataContext] Setting new op5Faults state:', {
        count: faults.length,
        faults: faults
      });
      
      setOP5Faults(faults);
    }, (error) => {
      console.error('[DataContext] Error in OP5 faults subscription:', error);
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
        // Find the user's district ID
        const userDistrict = districts.find(d => d.name === user.district);
        if (userDistrict) {
          q = query(collection(db, "controlOutages"), where("districtId", "==", userDistrict.id));
        }
      } else if (user.role === "regional_engineer") {
        // Find the user's region ID
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          q = query(collection(db, "controlOutages"), where("regionId", "==", userRegion.id));
        }
      }
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const outages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ControlSystemOutage[];
      setControlSystemOutages(outages);
    });

    return () => unsubscribe();
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
          await addItem("vit-inspections-cache", inspection);
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
        const cache = await getAllItems("vit-inspections-cache");
        const unsynced = await getAllItems("vit-inspections");
        const pendingDeletes = (await getPendingSyncItems())
          .filter(item => item.type === "vit-inspections" && item.action === "delete")
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

  // Subscribe to load monitoring records
  useEffect(() => {
    if (!user) return;

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

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        // Get offline data regardless of online status
        const offlineData = await getAllItems("load-monitoring");
        const pendingDeletes = (await getPendingSyncItems())
          .filter(item => item.type === "load-monitoring" && item.action === "delete")
          .map(item => item.data.id);

        if (navigator.onLine) {
          // Online mode - merge with Firestore data
          const records = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as LoadMonitoringData[];

          // Store each record in local storage for offline access
          for (const record of records) {
            try {
              await addItem("load-monitoring", record);
            } catch (e) {
              console.error("Error storing record in local storage:", e);
            }
          }

          // Create a map of online records
          const onlineMap = new Map(records.map(r => [r.id, r]));
          
          // Only include offline records that:
          // 1. Are not in the online data
          // 2. Are not pending deletion
          // 3. Have a newer timestamp than their online counterpart (if they exist)
          const mergedRecords = [
            ...records,
            ...offlineData.filter(item => {
              const onlineRecord = onlineMap.get(item.id);
              if (!onlineRecord) {
                return !pendingDeletes.includes(item.id);
              }
              // If record exists online, only include offline version if it's newer
              return item.updatedAt > onlineRecord.updatedAt && !pendingDeletes.includes(item.id);
            })
          ];

          // Ensure no duplicates by using a Map and keeping the most recent version
          const uniqueRecords = Array.from(
            new Map(
              mergedRecords.map(record => [
                record.id,
                {
                  ...record,
                  updatedAt: record.updatedAt || new Date().toISOString()
                }
              ])
            ).values()
          ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

          setLoadMonitoringRecords(uniqueRecords);

          // Update cache with all current data
          await clearStore("load-monitoring-cache");
          for (const record of uniqueRecords) {
            try {
              await addItem("load-monitoring-cache", record);
            } catch (e) {
              console.error("Error caching load monitoring record:", e);
            }
          }
        } else {
          // Offline mode - use cached and unsynced data
          const cache = await getAllItems("load-monitoring-cache");
          
          // Create a map of cached items
          const cacheMap = new Map(cache.map(item => [item.id, item]));
          
          // Only include unsynced records that:
          // 1. Are not in the cache
          // 2. Are not pending deletion
          // 3. Have a newer timestamp than their cached counterpart (if they exist)
          const mergedRecords = [
            ...cache,
            ...offlineData.filter(item => {
              const cachedRecord = cacheMap.get(item.id);
              if (!cachedRecord) {
                return !pendingDeletes.includes(item.id);
              }
              // If record exists in cache, only include unsynced version if it's newer
              return item.updatedAt > cachedRecord.updatedAt && !pendingDeletes.includes(item.id);
            })
          ];

          // Ensure no duplicates by using a Map and keeping the most recent version
          const uniqueRecords = Array.from(
            new Map(
              mergedRecords.map(record => [
                record.id,
                {
                  ...record,
                  updatedAt: record.updatedAt || new Date().toISOString()
                }
              ])
            ).values()
          ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

          setLoadMonitoringRecords(uniqueRecords);
        }
      } catch (error) {
        console.error("Error updating load monitoring records:", error);
        toast.error("Error updating records list");
      }
    });

    return () => unsubscribe();
  }, [user, regions, districts]);

  // Add sync handler for when device comes back online
  useEffect(() => {
    const handleOnline = async () => {
      try {
        console.log('Device is back online, syncing pending changes...');
        const pendingItems = await getPendingSyncItems();
        
        for (const item of pendingItems) {
          try {
            switch (item.type) {
              case 'op5-faults':
                if (item.action === 'create') {
                  await addDoc(collection(db, "op5Faults"), item.data);
                } else if (item.action === 'update') {
                  await updateDoc(doc(db, "op5Faults", item.data.id), item.data);
                } else if (item.action === 'delete') {
                  await deleteDoc(doc(db, "op5Faults", item.data.id));
                }
                break;
              
              case 'control-outages':
                if (item.action === 'create') {
                  await addDoc(collection(db, "controlOutages"), item.data);
                } else if (item.action === 'update') {
                  await updateDoc(doc(db, "controlOutages", item.data.id), item.data);
                } else if (item.action === 'delete') {
                  await deleteDoc(doc(db, "controlOutages", item.data.id));
                }
                break;
              
              case 'load-monitoring':
                if (item.action === 'create') {
                  await addDoc(collection(db, "loadMonitoring"), item.data);
                } else if (item.action === 'update') {
                  await updateDoc(doc(db, "loadMonitoring", item.data.id), item.data);
                } else if (item.action === 'delete') {
                  await deleteDoc(doc(db, "loadMonitoring", item.data.id));
                }
                break;
              
              case 'vit-assets':
                if (item.action === 'create') {
                  await addDoc(collection(db, "vitAssets"), item.data);
                } else if (item.action === 'update') {
                  await updateDoc(doc(db, "vitAssets", item.data.id), item.data);
                } else if (item.action === 'delete') {
                  await deleteDoc(doc(db, "vitAssets", item.data.id));
                }
                break;
              
              case 'vit-inspections':
                if (item.action === 'create') {
                  await addDoc(collection(db, "vitInspections"), item.data);
                } else if (item.action === 'update') {
                  await updateDoc(doc(db, "vitInspections", item.data.id), item.data);
                } else if (item.action === 'delete') {
                  await deleteDoc(doc(db, "vitInspections", item.data.id));
                }
                break;
              
              case 'substation-inspections':
                if (item.action === 'create') {
                  await addDoc(collection(db, "substationInspections"), item.data);
                } else if (item.action === 'update') {
                  await updateDoc(doc(db, "substationInspections", item.data.id), item.data);
                } else if (item.action === 'delete') {
                  await deleteDoc(doc(db, "substationInspections", item.data.id));
                }
                break;
              
              case 'districts':
                if (item.action === 'update') {
                  await updateDoc(doc(db, "districts", item.data.id), item.data);
                }
                break;
            }
            
            // Clear the pending sync item after successful sync
            await clearPendingSyncItem(item);
          } catch (error) {
            console.error(`Error syncing ${item.type} ${item.action}:`, error);
            // Don't throw here, continue with other items
          }
        }

        toast.success("Sync completed successfully");
      } catch (error) {
        console.error("Error during sync:", error);
        toast.error("Error syncing data");
      }
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Remove duplicate function declarations and keep only the new ones with offline support
  const addOP5Fault = async (fault: Omit<OP5Fault, "id">) => {
    try {
      const timestamp = new Date().toISOString();
      const faultWithTimestamps = {
          ...fault, 
        createdAt: timestamp,
        updatedAt: timestamp,
        status: fault.restorationDate ? "resolved" as const : "active" as const // Set status based on restoration date
      };

      if (navigator.onLine) {
        const docRef = await addDoc(collection(db, "op5Faults"), {
          ...faultWithTimestamps,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
        toast.success("Fault saved successfully");
        return docRef.id;
      } else {
        // Offline mode - store locally
        const id = uuidv4();
        const offlineFault = {
          ...faultWithTimestamps,
          id
        };
        await addItem("op5-faults", offlineFault);
        await addToPendingSync("op5-faults", "create", offlineFault);
        toast.success("Fault saved offline");
        setOP5Faults(prev => [...prev, offlineFault]);
        return id;
      }
    } catch (error) {
      console.error("Error saving fault:", error);
      toast.error("Failed to save fault");
      throw error;
    }
  };

  const updateOP5Fault = async (faultId: string, data: Partial<OP5Fault>) => {
    try {
      console.log('[DataContext] Updating fault:', { faultId, data });
      
      // Check if the fault exists in our local state
      const existingFault = op5Faults.find(f => f.id === faultId);
      if (!existingFault) {
        console.error('[DataContext] Fault not found in local state:', faultId);
        toast.error('Fault not found. Please refresh the page and try again.');
        return;
      }

      // Clean the data by removing undefined values
      const cleanedData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);

      // Create the updated fault data
      const updatedFault = {
        ...existingFault,
        ...cleanedData,
        updatedAt: new Date().toISOString()
      };

      // Update local state first
      const updatedFaults = op5Faults.map(fault => 
        fault.id === faultId ? updatedFault : fault
      );
      setOP5Faults(updatedFaults);

      // If online, update Firestore
      if (navigator.onLine) {
        const faultRef = doc(db, 'op5Faults', faultId);
        
        // Update Firestore with cleaned data
      await updateDoc(faultRef, {
          ...cleanedData,
        updatedAt: serverTimestamp()
      });
        console.log('[DataContext] Successfully updated fault in Firestore');
      } else {
        // Handle offline update
        const offlineFaults = JSON.parse(localStorage.getItem('offlineFaults') || '[]');
        const updatedOfflineFaults = offlineFaults.map((fault: any) =>
          fault.id === faultId ? updatedFault : fault
        );
        localStorage.setItem('offlineFaults', JSON.stringify(updatedOfflineFaults));
        console.log('[DataContext] Successfully updated offline fault');
      }
    } catch (error) {
      console.error('[DataContext] Error updating fault:', error);
      toast.error('Failed to update fault. Please try again.');
    }
  };

  const deleteOP5Fault = async (id: string) => {
    try {
      if (navigator.onLine) {
      await deleteDoc(doc(db, "op5Faults", id));
      toast.success("Fault deleted successfully");
      } else {
        // Offline mode - mark for deletion
        await deleteItem("op5-faults", id);
        await addToPendingSync("op5-faults", "delete", { id });
        toast.success("Fault marked for deletion");
      }
    } catch (error) {
      console.error("Error deleting fault:", error);
      toast.error("Failed to delete fault");
    }
  };

  const addControlSystemOutage = async (outage: Omit<ControlSystemOutage, "id">) => {
    try {
      if (navigator.onLine) {
        const docRef = await addDoc(collection(db, "controlOutages"), {
      ...outage,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
        toast.success("Outage saved successfully");
        return docRef.id;
      } else {
        // Offline mode - store locally
        const id = uuidv4();
        const timestamp = new Date().toISOString();
        const offlineOutage = {
          ...outage,
          id,
          createdAt: timestamp,
          updatedAt: timestamp
        };
        await addItem("control-outages", offlineOutage);
        await addToPendingSync("control-outages", "create", offlineOutage);
        toast.success("Outage saved offline");
        setControlSystemOutages(prev => [...prev, offlineOutage]);
        return id;
      }
    } catch (error) {
      console.error("Error saving outage:", error);
      toast.error("Failed to save outage");
      throw error;
    }
  };

  const updateControlSystemOutage = async (id: string, data: Partial<ControlSystemOutage>) => {
    try {
      if (navigator.onLine) {
      const outageRef = doc(db, "controlOutages", id);
      await updateDoc(outageRef, {
          ...data,
        updatedAt: serverTimestamp()
      });
      toast.success("Outage updated successfully");
      } else {
        // Offline mode - update local storage
        const offlineOutage = {
          ...data,
          id,
          updatedAt: new Date().toISOString()
        };
        await updateItem("control-outages", offlineOutage);
        await addToPendingSync("control-outages", "update", offlineOutage);
        toast.success("Outage updated offline");
      }
    } catch (error) {
      console.error("Error updating outage:", error);
      toast.error("Failed to update outage");
    }
  };

  const deleteControlSystemOutage = async (id: string) => {
    try {
      if (navigator.onLine) {
      await deleteDoc(doc(db, "controlOutages", id));
      toast.success("Outage deleted successfully");
      } else {
        // Offline mode - mark for deletion
        await deleteItem("control-outages", id);
        await addToPendingSync("control-outages", "delete", { id });
        toast.success("Outage marked for deletion");
      }
    } catch (error) {
      console.error("Error deleting outage:", error);
      toast.error("Failed to delete outage");
    }
  };

  // Function to get filtered faults
  const getFilteredFaults = useCallback((regionId?: string, districtId?: string) => {
    console.log('[DataContext] getFilteredFaults called with:', { regionId, districtId });
    console.log('[DataContext] Current faults:', { 
      op5Faults: op5Faults,
      controlSystemOutages: controlSystemOutages
    });

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

    console.log('[DataContext] Filtered faults:', {
      op5Faults: filteredOP5Faults,
      controlOutages: filteredControlOutages
    });

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
      
      if (isOP5) {
        await updateOP5Fault(id, { 
          status: "resolved" as const, 
          restorationDate: formattedDate
        });
        toast.success("OP5 Fault resolved successfully");
      } else {
        await updateControlSystemOutage(id, { 
          status: "resolved" as const, 
          restorationDate: formattedDate
        });
        toast.success("Control System Outage resolved successfully");
      }
    } catch (error) {
      console.error("Error resolving fault:", error);
      toast.error("Failed to resolve fault");
    }
  }, []);

  // Function to delete a fault
  const deleteFault = useCallback(async (id: string, isOP5: boolean) => {
    try {
      if (isOP5) {
        await deleteOP5Fault(id);
        toast.success("OP5 Fault deleted successfully");
      } else {
        await deleteControlSystemOutage(id);
        toast.success("Control System Outage deleted successfully");
      }
    } catch (error) {
      console.error("Error deleting fault:", error);
      toast.error("Failed to delete fault");
    }
  }, []);

  // Add missing functions
  const saveLoadMonitoringRecord = async (record: Omit<LoadMonitoringData, "id">) => {
    try {
      const timestamp = new Date().toISOString();
      const recordWithTimestamps = {
        ...record,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      if (navigator.onLine) {
      const docRef = await addDoc(collection(db, "loadMonitoring"), {
          ...recordWithTimestamps,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
        toast.success("Record saved successfully");
      return docRef.id;
      } else {
        const id = uuidv4();
        const offlineRecord = {
          ...recordWithTimestamps,
          id
        };
        await addItem("load-monitoring", offlineRecord);
        await addToPendingSync("load-monitoring", "create", offlineRecord);
        toast.success("Record saved offline");
        setLoadMonitoringRecords(prev => [...(prev || []), offlineRecord]);
        return id;
      }
    } catch (error) {
      console.error("Error saving record:", error);
      toast.error("Failed to save record");
      throw error;
    }
  };

  const getLoadMonitoringRecord = async (id: string): Promise<LoadMonitoringData | undefined> => {
    try {
      if (navigator.onLine) {
        const docRef = doc(db, "loadMonitoring", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() } as LoadMonitoringData;
        }
        return undefined;
      } else {
        return await getItem("load-monitoring", id);
      }
    } catch (error) {
      console.error("Error getting record:", error);
      toast.error("Failed to get record");
      return undefined;
    }
  };

  const updateLoadMonitoringRecord = async (id: string, data: Partial<LoadMonitoringData>) => {
    try {
      if (navigator.onLine) {
        const recordRef = doc(db, "loadMonitoring", id);
        const recordDoc = await getDoc(recordRef);
        
        if (recordDoc.exists()) {
          // Document exists, update it
          await updateDoc(recordRef, {
            ...data,
            updatedAt: serverTimestamp()
          });
          toast.success("Record updated successfully");
        } else {
          // Document doesn't exist, create it
          await setDoc(recordRef, {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          toast.success("Record created successfully");
        }
      } else {
        // Offline mode - check local storage first
        const existingRecord = await getItem("load-monitoring", id);
        if (!existingRecord) {
          toast.error("Record not found in offline storage");
          return;
        }

        // Update local storage
        const offlineRecord = {
          ...existingRecord,
          ...data,
          id,
          updatedAt: new Date().toISOString()
        };
        await updateItem("load-monitoring", offlineRecord);
        await addToPendingSync("load-monitoring", "update", offlineRecord);
        
        // Update local state
        setLoadMonitoringRecords(prev => 
          prev?.map(record => record.id === id ? offlineRecord : record)
        );
        
        toast.success("Record updated offline");
      }
    } catch (error) {
      console.error("Error updating record:", error);
      toast.error("Failed to update record");
    }
  };

  const deleteLoadMonitoringRecord = async (id: string) => {
    try {
      if (navigator.onLine) {
      await deleteDoc(doc(db, "loadMonitoring", id));
        toast.success("Record deleted successfully");
      } else {
        await deleteItem("load-monitoring", id);
        await addToPendingSync("load-monitoring", "delete", { id });
        toast.success("Record marked for deletion");
      }
    } catch (error) {
      console.error("Error deleting record:", error);
      toast.error("Failed to delete record");
    }
  };

  // Add VIT asset
  const addVITAsset = async (asset: Omit<VITAsset, "id">) => {
    try {
      const timestamp = new Date().toISOString();
      const assetWithTimestamps = {
        ...asset,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      if (navigator.onLine) {
        const docRef = await addDoc(collection(db, "vitAssets"), {
          ...assetWithTimestamps,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success("Asset saved successfully");
        return docRef.id;
      } else {
        // Offline mode - store locally
        const id = uuidv4();
        const offlineAsset = {
          ...assetWithTimestamps,
          id
        };
        await addItem("vit-assets", offlineAsset);
        await addToPendingSync("vit-assets", "create", offlineAsset);
        toast.success("Asset saved offline");
        setVITAssets(prev => [...prev, offlineAsset]);
        return id;
      }
    } catch (error) {
      console.error("Error adding VIT asset:", error);
      toast.error("Failed to save asset");
      throw error;
    }
  };

  // Update VIT asset
  const updateVITAsset = async (id: string, updates: Partial<VITAsset>) => {
    try {
      const timestamp = new Date().toISOString();
      const updatesWithTimestamp = {
        ...updates,
        updatedAt: timestamp
      };

      // Update local state first for immediate feedback
      setVITAssets(prev => {
        const updatedAssets = prev.map(asset => {
          if (asset.id === id) {
            return {
              ...asset,
              ...updatesWithTimestamp,
              id // Ensure ID is preserved
            };
          }
          return asset;
        });
        console.log("Updated assets in state:", updatedAssets);
        return updatedAssets;
      });

      if (navigator.onLine) {
        try {
          // Try to update in Firestore
          const docRef = doc(db, "vitAssets", id);
          await updateDoc(docRef, {
            ...updatesWithTimestamp,
            updatedAt: serverTimestamp()
          });
          console.log("Successfully updated in Firestore");
        } catch (firestoreError) {
          console.error("Firestore update failed:", firestoreError);
          
          // If Firestore update fails, store offline
          const offlineAsset = {
            ...updatesWithTimestamp,
            id
          };
          await updateItem("vit-assets", offlineAsset);
          await addToPendingSync("vit-assets", "update", offlineAsset);
          console.log("Stored update offline");
        }
      } else {
        // Offline mode - update local storage
        const offlineAsset = {
          ...updatesWithTimestamp,
          id
        };
        await updateItem("vit-assets", offlineAsset);
        await addToPendingSync("vit-assets", "update", offlineAsset);
        console.log("Stored update offline");
      }
    } catch (error) {
      console.error("Error updating VIT asset:", error);
      // Revert local state on error
      setVITAssets(prev => prev.map(asset => 
        asset.id === id ? { ...asset } : asset
      ));
      throw error;
    }
  };

  // Delete VIT asset
  const deleteVITAsset = async (id: string) => {
    try {
      if (navigator.onLine) {
        // Check if this is an offline-created asset
        const offlineAsset = await getItem("vit-assets", id);
        if (offlineAsset) {
          // This is an offline-created asset that hasn't been synced yet
          // Delete from offline storage
          await deleteItem("vit-assets", id);
          await addToPendingSync("vit-assets", "delete", { id });
          toast.success("Asset deleted successfully");
          
          // Update local state
          setVITAssets(prev => prev.filter(asset => asset.id !== id));
          return;
        }

        // Normal online deletion
        const docRef = doc(db, "vitAssets", id);
        await deleteDoc(docRef);
        toast.success("Asset deleted successfully");
      } else {
        // Offline mode - mark for deletion
        await deleteItem("vit-assets", id);
        await addToPendingSync("vit-assets", "delete", { id });
        toast.success("Asset marked for deletion");
        
        // Update local state
        setVITAssets(prev => prev.filter(asset => asset.id !== id));
      }
    } catch (error) {
      console.error("Error deleting VIT asset:", error);
      toast.error("Failed to delete asset");
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
        await addItem("vit-inspections", offlineInspection);
        await addToPendingSync("vit-inspections", "create", offlineInspection);
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
        await updateItem("vit-inspections", offlineInspection);
        await addToPendingSync("vit-inspections", "update", offlineInspection);
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
        await deleteItem("vit-inspections", id);
        await addToPendingSync("vit-inspections", "delete", { id });
        toast.success("Inspection marked for deletion");
      }
    } catch (error) {
      console.error("Error deleting inspection:", error);
      toast.error("Failed to delete inspection");
    }
  };

  const saveInspection = async (data: Omit<SubstationInspection, "id">) => {
    try {
      const timestamp = new Date().toISOString();
      const inspectionWithTimestamps = {
        ...data,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      if (navigator.onLine) {
        const docRef = await addDoc(collection(db, "substationInspections"), {
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
        await addItem("substation-inspections", offlineInspection);
        await addToPendingSync("substation-inspections", "create", offlineInspection);
        toast.success("Inspection saved offline");
        setSavedInspections(prev => [...prev, offlineInspection]);
        return id;
      }
    } catch (error) {
      console.error("Error saving inspection:", error);
      toast.error("Failed to save inspection");
      throw error;
    }
  };

  const updateSubstationInspection = async (id: string, updates: Partial<SubstationInspection>) => {
    try {
      if (navigator.onLine) {
        const inspectionRef = doc(db, "substationInspections", id);
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
        await updateItem("substation-inspections", offlineInspection);
        await addToPendingSync("substation-inspections", "update", offlineInspection);
        toast.success("Inspection updated offline");
      }
    } catch (error) {
      console.error("Error updating inspection:", error);
      toast.error("Failed to update inspection");
    }
  };

  const deleteInspection = async (id: string) => {
    try {
      if (navigator.onLine) {
        await deleteDoc(doc(db, "substationInspections", id));
        toast.success("Inspection deleted successfully");
      } else {
        await deleteItem("substation-inspections", id);
        await addToPendingSync("substation-inspections", "delete", { id });
        toast.success("Inspection marked for deletion");
      }
    } catch (error) {
      console.error("Error deleting inspection:", error);
      toast.error("Failed to delete inspection");
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

  // Add overhead line inspection
  const addOverheadLineInspection = async (inspection: Omit<OverheadLineInspection, "id">) => {
    try {
      const timestamp = new Date().toISOString();
      const inspectionWithTimestamps = {
        ...inspection,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      if (navigator.onLine) {
        const docRef = await addDoc(collection(db, "overheadLineInspections"), {
          ...inspectionWithTimestamps,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success("Inspection saved successfully");
        return docRef.id;
      } else {
        // Offline mode - store locally
        const id = uuidv4();
        const offlineInspection = {
          ...inspectionWithTimestamps,
          id
        };
        await addItem("overhead-line-inspections", offlineInspection);
        await addToPendingSync("overhead-line-inspections", "create", offlineInspection);
        toast.success("Inspection saved offline");
        setOverheadLineInspections(prev => [...prev, offlineInspection]);
        return id;
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
      if (navigator.onLine) {
        const docRef = doc(db, "overheadLineInspections", id);
        await updateDoc(docRef, {
          ...updates,
          updatedAt: serverTimestamp()
        });
        toast.success("Inspection updated successfully");
      } else {
        // Offline mode - update local storage
        const offlineInspection = {
          ...updates,
          id,
          updatedAt: new Date().toISOString()
        };
        await updateItem("overhead-line-inspections", offlineInspection);
        await addToPendingSync("overhead-line-inspections", "update", offlineInspection);
        toast.success("Inspection updated offline");
      }
    } catch (error) {
      console.error("Error updating overhead line inspection:", error);
      toast.error("Failed to update inspection");
      throw error;
    }
  };

  // Delete overhead line inspection
  const deleteOverheadLineInspection = async (id: string) => {
    try {
      if (navigator.onLine) {
        const docRef = doc(db, "overheadLineInspections", id);
        await deleteDoc(docRef);
        toast.success("Inspection deleted successfully");
      } else {
        // Offline mode - mark for deletion
        await deleteItem("overhead-line-inspections", id);
        await addToPendingSync("overhead-line-inspections", "delete", { id });
        toast.success("Inspection marked for deletion");
      }
    } catch (error) {
      console.error("Error deleting overhead line inspection:", error);
      toast.error("Failed to delete inspection");
      throw error;
    }
  };

  // Subscribe to overhead line inspections
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
        // Get offline data regardless of online status
        const offlineData = await getAllItems("overhead-line-inspections");
        const pendingDeletes = (await getPendingSyncItems())
          .filter(item => item.type === "overhead-line-inspections" && item.action === "delete")
          .map(item => item.data.id);

        if (navigator.onLine) {
          // Online mode - merge with Firestore data
          const inspections = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as OverheadLineInspection[];

          // Create a map of online records
          const onlineMap = new Map(inspections.map(r => [r.id, r]));
          
          // Only include offline records that:
          // 1. Are not in the online data
          // 2. Are not pending deletion
          // 3. Have a newer timestamp than their online counterpart (if they exist)
          const mergedInspections = [
            ...inspections,
            ...offlineData.filter(item => {
              const onlineRecord = onlineMap.get(item.id);
              if (!onlineRecord) {
                return !pendingDeletes.includes(item.id);
              }
              // If record exists online, only include offline version if it's newer
              return item.updatedAt > onlineRecord.updatedAt && !pendingDeletes.includes(item.id);
            })
          ];

          // Ensure no duplicates by using a Map and keeping the most recent version
          const uniqueInspections = Array.from(
            new Map(
              mergedInspections.map(inspection => [
                inspection.id,
                {
                  ...inspection,
                  updatedAt: inspection.updatedAt || new Date().toISOString()
                }
              ])
            ).values()
          ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

          setOverheadLineInspections(uniqueInspections);

          // Update cache with all current data
          await clearStore("overhead-line-inspections-cache");
          for (const inspection of uniqueInspections) {
            try {
              await addItem("overhead-line-inspections-cache", inspection);
            } catch (e) {
              console.error("Error caching overhead line inspection:", e);
            }
          }
        } else {
          // Offline mode - use cached and unsynced data
          const cache = await getAllItems("overhead-line-inspections-cache");
          
          // Create a map of cached items
          const cacheMap = new Map(cache.map(item => [item.id, item]));
          
          // Only include unsynced records that:
          // 1. Are not in the cache
          // 2. Are not pending deletion
          // 3. Have a newer timestamp than their cached counterpart (if they exist)
          const mergedInspections = [
            ...cache,
            ...offlineData.filter(item => {
              const cachedRecord = cacheMap.get(item.id);
              if (!cachedRecord) {
                return !pendingDeletes.includes(item.id);
              }
              // If record exists in cache, only include unsynced version if it's newer
              return item.updatedAt > cachedRecord.updatedAt && !pendingDeletes.includes(item.id);
            })
          ];

          // Ensure no duplicates by using a Map and keeping the most recent version
          const uniqueInspections = Array.from(
            new Map(
              mergedInspections.map(inspection => [
                inspection.id,
                {
                  ...inspection,
                  updatedAt: inspection.updatedAt || new Date().toISOString()
                }
              ])
            ).values()
          ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

          setOverheadLineInspections(uniqueInspections);
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

  // Add sync handler for overhead line inspections
  useEffect(() => {
    const handleOnline = async () => {
      try {
        const pendingItems = await getPendingSyncItems();
        const overheadLineItems = pendingItems.filter(item => item.type === 'overhead-line-inspections');
        
        for (const item of overheadLineItems) {
          try {
            if (item.action === 'create') {
              await addDoc(collection(db, "overheadLineInspections"), item.data);
            } else if (item.action === 'update') {
              await updateDoc(doc(db, "overheadLineInspections", item.data.id), item.data);
            } else if (item.action === 'delete') {
              await deleteDoc(doc(db, "overheadLineInspections", item.data.id));
            }
            
            // Clear the pending sync item after successful sync
            await clearPendingSyncItem(item);
          } catch (error) {
            console.error(`Error syncing overhead line inspection ${item.action}:`, error);
            // Don't throw here, continue with other items
          }
        }
      } catch (error) {
        console.error("Error during overhead line inspections sync:", error);
        toast.error("Error syncing inspections data");
      }
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
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
