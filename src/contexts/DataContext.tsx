import React, { createContext, useContext, useState, useEffect } from "react";
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

export interface DataContextType {
  op5Faults: OP5Fault[];
  controlOutages: ControlSystemOutage[];
  regions: Region[];
  districts: District[];
  setOP5Faults: React.Dispatch<React.SetStateAction<OP5Fault[]>>;
  setControlOutages: React.Dispatch<React.SetStateAction<ControlSystemOutage[]>>;
  setRegions: React.Dispatch<React.SetStateAction<Region[]>>;
  setDistricts: React.Dispatch<React.SetStateAction<District[]>>;
  resolveFault: (id: string, isOP5: boolean) => void;
  deleteFault: (id: string, isOP5: boolean) => void;
  updateOP5Fault: (id: string, data: Partial<OP5Fault>) => void;
  updateControlOutage: (id: string, data: Partial<ControlSystemOutage>) => void;
  canEditFault: (fault: OP5Fault | ControlSystemOutage) => boolean;
  vitAssets: VITAsset[];
  setVITAssets: React.Dispatch<React.SetStateAction<VITAsset[]>>;
  vitInspections: VITInspectionChecklist[];
  setVITInspections: React.Dispatch<React.SetStateAction<VITInspectionChecklist[]>>;
  savedInspections: SubstationInspection[];
  setSavedInspections: React.Dispatch<React.SetStateAction<SubstationInspection[]>>;
  loadMonitoringRecords?: LoadMonitoringData[];
  setLoadMonitoringRecords: React.Dispatch<React.SetStateAction<LoadMonitoringData[] | undefined>>;
  addOP5Fault: (fault: Omit<OP5Fault, "id" | "status">) => void;
  deleteOP5Fault: (id: string) => void;
  addControlOutage: (outage: Omit<ControlSystemOutage, "id" | "status">) => void;
  deleteControlOutage: (id: string) => void;
  getFilteredFaults: (regionId?: string, districtId?: string) => { op5Faults: OP5Fault[]; controlOutages: ControlSystemOutage[] };
  addVITAsset: (asset: Omit<VITAsset, "id" | "createdAt" | "updatedAt">) => void;
  updateVITAsset: (id: string, updates: Partial<VITAsset>) => void;
  deleteVITAsset: (id: string) => void;
  addVITInspection: (inspection: Omit<VITInspectionChecklist, "id">) => void;
  updateVITInspection: (id: string, inspection: Partial<VITInspectionChecklist>) => void;
  deleteVITInspection: (id: string) => void;
  updateDistrict: (id: string, updates: Partial<District>) => void;
  saveInspection: (data: Omit<SubstationInspection, "id">) => Promise<string>;
  getSavedInspection: (id: string) => SubstationInspection | undefined;
  updateSubstationInspection: (id: string, data: Partial<SubstationInspection>) => void;
  deleteInspection: (id: string) => void;
  saveLoadMonitoringRecord: (data: Omit<LoadMonitoringData, "id">) => Promise<string>;
  getLoadMonitoringRecord: (id: string) => Promise<LoadMonitoringData | undefined>;
  updateLoadMonitoringRecord: (id: string, data: Partial<LoadMonitoringData>) => Promise<void>;
  deleteLoadMonitoringRecord: (id: string) => Promise<void>;
  canEditAsset: (asset: VITAsset) => boolean;
  canEditInspection: (inspection: VITInspectionChecklist | SubstationInspection) => boolean;
  canAddAsset: (regionName: string, districtName: string) => boolean;
  canAddInspection: (assetId?: string, regionId?: string, districtId?: string) => boolean;
  canResolveFault: (fault: OP5Fault | ControlSystemOutage) => boolean;
  canEditOutage: (outage: ControlSystemOutage) => boolean;
  canDeleteFault: (fault: OP5Fault | ControlSystemOutage) => boolean;
  canDeleteOutage: (outage: ControlSystemOutage) => boolean;
  canDeleteAsset: (asset: VITAsset) => boolean;
  canDeleteInspection: (inspection: VITInspectionChecklist | SubstationInspection) => boolean;
  canEditLoadMonitoring: (record: LoadMonitoringData) => boolean;
  canDeleteLoadMonitoring: (record: LoadMonitoringData) => boolean;
  getOP5FaultById: (id: string) => OP5Fault | undefined;
  overheadLineInspections: OverheadLineInspection[];
  addOverheadLineInspection: (inspection: Omit<OverheadLineInspection, "id" | "createdAt" | "updatedAt">) => void;
  updateOverheadLineInspection: (id: string, updates: Partial<OverheadLineInspection>) => void;
  deleteOverheadLineInspection: (id: string) => void;
  isLoadingRegions: boolean;
  isLoadingDistricts: boolean;
  regionsError: string | null;
  districtsError: string | null;
  retryRegionsAndDistricts: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [isLoadingRegions, setIsLoadingRegions] = useState(true);
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(true);
  const [regionsError, setRegionsError] = useState<string | null>(null);
  const [districtsError, setDistrictsError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [op5Faults, setOP5Faults] = useState<OP5Fault[]>([]);
  const [controlOutages, setControlOutages] = useState<ControlSystemOutage[]>([]);
  const [vitAssets, setVITAssets] = useState<VITAsset[]>([]);
  const [vitInspections, setVITInspections] = useState<VITInspectionChecklist[]>([]);
  const [savedInspections, setSavedInspections] = useState<SubstationInspection[]>([]);
  const [loadMonitoringRecords, setLoadMonitoringRecords] = useState<LoadMonitoringData[]>([]);
  const [overheadLineInspections, setOverheadLineInspections] = useState<OverheadLineInspection[]>([]);

  // Fetch regions and districts with retry logic
  const fetchRegionsAndDistricts = async (retryAttempt = 0) => {
    try {
      setIsLoadingRegions(true);
      setIsLoadingDistricts(true);
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
      setIsLoadingRegions(false);

      // Fetch districts
      const districtsSnapshot = await getDocs(collection(db, "districts"));
      const districtsList = districtsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as District[];
      
      console.log("Districts loaded:", districtsList.length);
      setDistricts(districtsList);
      setIsLoadingDistricts(false);
      
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
      setIsLoadingRegions(false);
      setIsLoadingDistricts(false);
      
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

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const assets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as VITAsset[];
      setVITAssets(assets);
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

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const faults = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as OP5Fault[];
      setOP5Faults(faults);
    });

    return () => unsubscribe();
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
      setControlOutages(outages);
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

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const inspections = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as VITInspectionChecklist[];
      setVITInspections(inspections);
    });

    return () => unsubscribe();
  }, [user]);

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
    // system_admin and global_engineer get all records (no filter)

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LoadMonitoringData[];
      setLoadMonitoringRecords(records);
    });

    return () => unsubscribe();
  }, [user, regions, districts]);

  // Subscribe to overhead line inspections
  useEffect(() => {
    if (!user) return;

    let q = query(collection(db, "overheadLineInspections"));
    
    // Only apply filters if not system_admin or global_engineer
    if (user.role !== "system_admin" && user.role !== "global_engineer") {
      if (user.role === "district_engineer" || user.role === "technician") {
        q = query(collection(db, "overheadLineInspections"), where("district", "==", user.district));
      } else if (user.role === "regional_engineer") {
        q = query(collection(db, "overheadLineInspections"), where("region", "==", user.region));
      }
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const inspections = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as OverheadLineInspection[];
      setOverheadLineInspections(inspections);
    });

    return () => unsubscribe();
  }, [user]);

  // Update CRUD operations to use Firestore
  const addOP5Fault = async (fault: Omit<OP5Fault, "id" | "status">) => {
    try {
      const status = fault.restorationDate ? "resolved" : "active";
      await addDoc(collection(db, "op5Faults"), {
          ...fault, 
      status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    toast.success("OP5 Fault report submitted successfully");
    } catch (error) {
      console.error("Error adding OP5 fault:", error);
      toast.error("Failed to add fault");
    }
  };

  const updateOP5Fault = async (id: string, updatedFault: Partial<OP5Fault>) => {
    try {
      const faultRef = doc(db, "op5Faults", id);
      await updateDoc(faultRef, {
          ...updatedFault,
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

  const addControlOutage = async (outage: Omit<ControlSystemOutage, "id" | "status">) => {
    try {
    const status = outage.restorationDate ? "resolved" : "active";
      await addDoc(collection(db, "controlOutages"), {
      ...outage,
      status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    toast.success("Control System Outage report submitted successfully");
    } catch (error) {
      console.error("Error adding control outage:", error);
      toast.error("Failed to add outage");
    }
  };

  const updateControlOutage = async (id: string, updatedOutage: Partial<ControlSystemOutage>) => {
    try {
      const outageRef = doc(db, "controlOutages", id);
      await updateDoc(outageRef, {
          ...updatedOutage,
        updatedAt: serverTimestamp()
      });
      toast.success("Outage updated successfully");
    } catch (error) {
      console.error("Error updating control outage:", error);
      toast.error("Failed to update outage");
    }
  };

  const deleteControlOutage = async (id: string) => {
    try {
      await deleteDoc(doc(db, "controlOutages", id));
      toast.success("Outage deleted successfully");
    } catch (error) {
      console.error("Error deleting control outage:", error);
      toast.error("Failed to delete outage");
    }
  };

  const addVITAsset = async (asset: Omit<VITAsset, "id">) => {
    try {
      await addDoc(collection(db, "vitAssets"), {
        ...asset,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success("Asset added successfully");
    } catch (error) {
      console.error("Error adding VIT asset:", error);
      toast.error("Failed to add asset");
    }
  };

  const updateVITAsset = async (id: string, asset: Partial<VITAsset>) => {
    try {
      const assetRef = doc(db, "vitAssets", id);
      await updateDoc(assetRef, {
      ...asset,
        updatedAt: serverTimestamp()
      });
      toast.success("Asset updated successfully");
    } catch (error) {
      console.error("Error updating VIT asset:", error);
      toast.error("Failed to update asset");
    }
  };

  const deleteVITAsset = async (id: string) => {
    try {
      await deleteDoc(doc(db, "vitAssets", id));
      toast.success("Asset deleted successfully");
    } catch (error) {
      console.error("Error deleting VIT asset:", error);
      toast.error("Failed to delete asset");
    }
  };

  const addVITInspection = async (inspection: Omit<VITInspectionChecklist, "id">) => {
    try {
      await addDoc(collection(db, "vitInspections"), {
      ...inspection,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    toast.success("VIT Inspection added successfully");
    } catch (error) {
      console.error("Error adding VIT inspection:", error);
      toast.error("Failed to add inspection");
    }
  };

  const updateVITInspection = async (id: string, inspection: Partial<VITInspectionChecklist>) => {
    try {
      const inspectionRef = doc(db, "vitInspections", id);
      await updateDoc(inspectionRef, {
        ...inspection,
        updatedAt: serverTimestamp()
      });
    toast.success("VIT Inspection updated successfully");
    } catch (error) {
      console.error("Error updating VIT inspection:", error);
      toast.error("Failed to update inspection");
    }
  };
  
  const deleteVITInspection = async (id: string) => {
    try {
      await deleteDoc(doc(db, "vitInspections", id));
    toast.success("VIT Inspection deleted successfully");
    } catch (error) {
      console.error("Error deleting VIT inspection:", error);
      toast.error("Failed to delete inspection");
    }
  };

  const saveInspection = async (data: Omit<SubstationInspection, "id">) => {
    try {
      // Find region and district IDs
      const region = regions.find(r => r.name === data.region);
      const district = districts.find(d => d.name === data.district);

      // Helper function to clean nested objects and arrays
      const cleanValue = (value: any): any => {
        if (value === undefined || value === null) return null;
        if (Array.isArray(value)) {
          return value.map(item => cleanValue(item));
        }
        if (typeof value === 'object') {
          return Object.fromEntries(
            Object.entries(value)
              .map(([key, val]) => [key, cleanValue(val)])
              .filter(([_, val]) => val !== undefined)
          );
        }
        return value;
      };

      // Clean up the data by removing undefined values and providing defaults
      const cleanData = {
      ...data,
        regionId: region?.id || "",
        districtId: district?.id || "",
        items: cleanValue(data.items) || [],
        generalBuilding: cleanValue(data.generalBuilding) || [],
        controlEquipment: cleanValue(data.controlEquipment) || [],
        powerTransformer: cleanValue(data.powerTransformer) || [],
        outdoorEquipment: cleanValue(data.outdoorEquipment) || [],
        remarks: data.remarks || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Remove any remaining undefined values
      const finalData = Object.fromEntries(
        Object.entries(cleanData)
          .map(([key, value]) => [key, cleanValue(value)])
          .filter(([_, value]) => value !== undefined)
      );

      const docRef = await addDoc(collection(db, "substationInspections"), finalData);
    toast.success("Inspection saved successfully");
      return docRef.id;
    } catch (error) {
      console.error("Error saving inspection:", error);
      toast.error("Failed to save inspection");
      throw error;
    }
  };

  const updateSubstationInspection = async (id: string, data: Partial<SubstationInspection>) => {
    try {
      const inspectionRef = doc(db, "substationInspections", id);
      await updateDoc(inspectionRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    toast.success("Inspection updated successfully");
    } catch (error) {
      console.error("Error updating inspection:", error);
      toast.error("Failed to update inspection");
    }
  };

  const deleteInspection = async (id: string) => {
    try {
      await deleteDoc(doc(db, "substationInspections", id));
    toast.success("Inspection deleted successfully");
    } catch (error) {
      console.error("Error deleting inspection:", error);
      toast.error("Failed to delete inspection");
    }
  };

  const saveLoadMonitoringRecord = async (data: Omit<LoadMonitoringData, "id">) => {
    try {
      const docRef = await addDoc(collection(db, "loadMonitoring"), {
      ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    toast.success("Load monitoring record saved successfully");
      return docRef.id;
    } catch (error) {
      console.error("Error saving load monitoring record:", error);
      toast.error("Failed to save record");
      throw error;
    }
  };

  const updateLoadMonitoringRecord = async (id: string, data: Partial<LoadMonitoringData>) => {
    try {
      const recordRef = doc(db, "loadMonitoring", id);
      await updateDoc(recordRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    toast.success("Load monitoring record updated successfully");
    } catch (error) {
      console.error("Error updating load monitoring record:", error);
      toast.error("Failed to update record");
    }
  };

  const deleteLoadMonitoringRecord = async (id: string) => {
    try {
      await deleteDoc(doc(db, "loadMonitoring", id));
    toast.success("Load monitoring record deleted successfully");
    } catch (error) {
      console.error("Error deleting load monitoring record:", error);
      toast.error("Failed to delete record");
    }
  };

  const addOverheadLineInspection = async (inspection: Omit<OverheadLineInspection, "id" | "createdAt" | "updatedAt">) => {
    try {
      // Helper function to clean nested objects and arrays
      const cleanValue = (value: any): any => {
        if (value === undefined || value === null) return null;
        if (Array.isArray(value)) {
          return value.map(item => cleanValue(item));
        }
        if (typeof value === 'object') {
          return Object.fromEntries(
            Object.entries(value)
              .map(([key, val]) => [key, cleanValue(val)])
              .filter(([_, val]) => val !== undefined)
          );
        }
        return value;
      };

      // Clean the inspection data
      const cleanData = {
        ...inspection,
        inspector: cleanValue(inspection.inspector) || { name: "", designation: "" },
        items: cleanValue(inspection.items) || [],
        region: inspection.region,
        district: inspection.district,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Remove any remaining undefined values
      const finalData = Object.fromEntries(
        Object.entries(cleanData)
          .map(([key, value]) => [key, cleanValue(value)])
          .filter(([_, value]) => value !== undefined)
      );

      await addDoc(collection(db, "overheadLineInspections"), finalData);
      toast.success("Overhead line inspection added successfully");
    } catch (error) {
      console.error("Error adding overhead line inspection:", error);
      toast.error("Failed to add inspection");
    }
  };

  const updateOverheadLineInspection = async (id: string, updates: Partial<OverheadLineInspection>) => {
    try {
      const inspectionRef = doc(db, "overheadLineInspections", id);
      await updateDoc(inspectionRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      toast.success("Overhead line inspection updated successfully");
    } catch (error) {
      console.error("Error updating overhead line inspection:", error);
      toast.error("Failed to update inspection");
    }
  };

  const deleteOverheadLineInspection = async (id: string) => {
    try {
      if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new Error("Invalid document ID");
      }
      
      const docRef = doc(db, "overheadLineInspections", id.trim());
      await deleteDoc(docRef);
      toast.success("Overhead line inspection deleted successfully");
    } catch (error) {
      console.error("Error deleting overhead line inspection:", error);
      toast.error("Failed to delete inspection");
    }
  };

  // Function to get filtered faults
  const getFilteredFaults = (regionId?: string, districtId?: string) => {
    if (!user) {
      return { op5Faults: [], controlOutages: [] };
    }

    let filteredOP5Faults = [...op5Faults];
    let filteredControlOutages = [...controlOutages];

    // Apply role-based filtering
    if (user.role === "district_engineer" || user.role === "technician") {
      // District engineers and technicians can only see faults in their district
      const userDistrict = districts.find(d => d.name === user.district);
      if (userDistrict) {
        filteredOP5Faults = filteredOP5Faults.filter(fault => fault.districtId === userDistrict.id);
        filteredControlOutages = filteredControlOutages.filter(outage => outage.districtId === userDistrict.id);
      }
    } else if (user.role === "regional_engineer") {
      // Regional engineers can see all faults in their region
      const userRegion = regions.find(r => r.name === user.region);
      if (userRegion) {
        // Filter by both regionId and region name to ensure consistency
        filteredOP5Faults = filteredOP5Faults.filter(fault => {
          const faultRegion = regions.find(r => r.id === fault.regionId);
          return faultRegion?.name === user.region;
        });
        filteredControlOutages = filteredControlOutages.filter(outage => {
          const outageRegion = regions.find(r => r.id === outage.regionId);
          return outageRegion?.name === user.region;
        });
      }
    }
    // Global engineers and system admins can see all faults, no additional filtering needed

    // Apply additional filters if provided
    if (regionId && regionId !== "all") {
      filteredOP5Faults = filteredOP5Faults.filter(fault => fault.regionId === regionId);
      filteredControlOutages = filteredControlOutages.filter(outage => outage.regionId === regionId);
    }
    
    if (districtId && districtId !== "all") {
      filteredOP5Faults = filteredOP5Faults.filter(fault => fault.districtId === districtId);
      filteredControlOutages = filteredControlOutages.filter(outage => outage.districtId === districtId);
    }

    return {
      op5Faults: filteredOP5Faults,
      controlOutages: filteredControlOutages
    };
  };

  // Function to check if user can edit a fault
  const canEditFault = (fault: OP5Fault | ControlSystemOutage): boolean => {
    if (!user) return false;
    
    const region = regions.find(r => r.id === fault.regionId);
    const district = districts.find(d => d.id === fault.districtId);
    
    return PermissionService.getInstance().canEditAsset(
      user.role,
      user.region,
      user.district,
      region?.name || '',
      district?.name || ''
    );
  };

  // Function to check if user can resolve a fault
  const canResolveFault = (fault: OP5Fault | ControlSystemOutage): boolean => {
    if (!user) return false;
    if (fault.status === "resolved") return false;
    return canEditFault(fault);
  };

  // Function to resolve a fault
  const resolveFault = (id: string, isOP5: boolean) => {
    const now = new Date();
    const formattedDate = now.toISOString();

    if (isOP5) {
       const fault = getOP5FaultById(id);
       if (!fault) return; // Fault not found
       
       let mttr = fault.mttr; // Keep existing MTTR if already calculated
       // Calculate MTTR only if repairDate exists and restoration is happening now
       if (fault.repairDate && !fault.restorationDate) { 
           mttr = calculateMTTR(fault.occurrenceDate, formattedDate); // Calculate based on current time
       }

      updateOP5Fault(id, { 
          status: "resolved", 
          restorationDate: formattedDate,
          mttr: mttr // Update MTTR
      });
    } else {
      const outage = controlOutages.find(o => o.id === id);
      if (!outage) return;
      
      let unservedEnergy = outage.unservedEnergyMWh || 0;
      if (!outage.restorationDate) { // Calculate only if not already resolved
         const duration = calculateOutageDuration(outage.occurrenceDate, formattedDate);
         unservedEnergy = calculateUnservedEnergy(outage.loadMW, duration);
      }
      updateControlOutage(id, { 
          status: "resolved", 
          restorationDate: formattedDate, 
          unservedEnergyMWh: unservedEnergy 
      });
    }
  };

  // Function to delete a fault
  const deleteFault = (id: string, isOP5: boolean) => {
    if (isOP5) {
      deleteOP5Fault(id);
      toast.success("OP5 Fault deleted successfully");
    } else {
      deleteControlOutage(id);
      toast.success("Control System Outage deleted successfully");
    }
  };

  // Function to check if user can edit an outage
  const canEditOutage = (outage: ControlSystemOutage): boolean => {
    if (!user) return false;
    
    // Global engineers can edit any outage
    if (user.role === "global_engineer") return true;
    
    // Regional engineers can edit outages in their region
    if (user.role === "regional_engineer") {
      const region = regions.find(r => r.id === outage.regionId);
      return region?.name === user.region;
    }
    
    // District engineers can edit outages in their district
    if (user.role === "district_engineer") {
      const district = districts.find(d => d.id === outage.districtId);
      return district?.name === user.district;
    }
    
    return false;
  };

  const canEditLoadMonitoring = (record: LoadMonitoringData): boolean => {
    if (!user) return false;
    if (user.role === "system_admin" || user.role === "global_engineer" || user.role === "technician") return true;
    if (user.role === "regional_engineer") {
      const region = regions.find(r => r.id === record.regionId);
      return region?.name === user.region;
    }
    if (user.role === "district_engineer") {
      const district = districts.find(d => d.id === record.districtId);
      return district?.name === user.district;
    }
    return false;
  };

  const canDeleteLoadMonitoring = (record: LoadMonitoringData): boolean => {
    return canEditLoadMonitoring(record);
  };

  // Function to get a specific OP5 Fault by ID
  const getOP5FaultById = (id: string): OP5Fault | undefined => {
    return op5Faults.find(fault => fault.id === id);
  };

  // Function to update district
  const updateDistrict = async (id: string, updates: Partial<District>) => {
    try {
      // Update Firestore
      const districtRef = doc(db, "districts", id);
      await updateDoc(districtRef, updates);
      
      // Update local state
      setDistricts(prev => 
        prev.map(district => 
          district.id === id
            ? { ...district, ...updates }
            : district
        )
      );
      toast.success("District information updated successfully");
    } catch (error) {
      console.error("Error updating district:", error);
      toast.error("Failed to update district information");
    }
  };

  const getSavedInspection = (id: string) => {
    return savedInspections.find(inspection => inspection.id === id);
  };

  // Function to check if user can edit an asset
  const canEditAsset = (asset: VITAsset): boolean => {
    if (!user) return false;
    
    // Find region/district objects using asset's region/district names
    const region = regions.find(r => r.name === asset.region);
    const district = districts.find(d => d.name === asset.district);
    
    return PermissionService.getInstance().canEditAsset(
      user.role,
      user.region,
      user.district,
      region?.name || '',
      district?.name || ''
    );
  };

  // Function to check if user can edit an inspection
  const canEditInspection = (inspection: VITInspectionChecklist | SubstationInspection): boolean => {
    if (!user) return false;
    
    // For VIT inspections, check the associated asset's region/district
    if ('vitAssetId' in inspection) {
      const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
      if (!asset) return false;
      
      const region = regions.find(r => r.id === asset.regionId);
      const district = districts.find(d => d.id === asset.districtId);
      
      return PermissionService.getInstance().canEditInspection(
        user.role,
        user.region,
        user.district,
        region?.name || '',
        district?.name || ''
      );
    }
    // For substation inspections, check the region/district directly
    else {
      return PermissionService.getInstance().canEditInspection(
        user.role,
        user.region,
        user.district,
        inspection.region,
        inspection.district
      );
    }
  };

  // Function to check if user can delete an asset
  const canDeleteAsset = (asset: VITAsset): boolean => {
    if (!user) return false;
    // Find region/district objects using asset's region/district names
    const region = regions.find(r => r.name === asset.region);
    const district = districts.find(d => d.name === asset.district);

    // Use the canDeleteAsset method with region/district names
    return PermissionService.getInstance().canDeleteAsset(
      user.role,
      user.region,
      user.district,
      region?.name || '',
      district?.name || ''
    );
  };

  // Function to check if user can delete an inspection
  const canDeleteInspection = (inspection: VITInspectionChecklist | SubstationInspection): boolean => {
    return canEditInspection(inspection);
  };

  // Function to check if user can add an asset
  const canAddAsset = (regionName: string, districtName: string): boolean => {
    if (!user) return false;
    
    // Use canEditAsset logic, as adding implies editing permission in the target location
    return PermissionService.getInstance().canEditAsset(
      user.role,
      user.region, // User's region
      user.district, // User's district
      regionName, // Target asset's region name
      districtName // Target asset's district name
    );
  };

  // Function to check if user can add an inspection
  const canAddInspection = (regionId: string, districtId: string): boolean => {
    if (!user) return false;
    
    const region = regions.find(r => r.id === regionId);
    const district = districts.find(d => d.id === districtId);
    
    return PermissionService.getInstance().canEditInspection(
      user.role,
      user.region,
      user.district,
      region?.name || '',
      district?.name || ''
    );
  };

  // This is a special implementation that both checks local state and fetches from Firestore
  const getLoadMonitoringRecord = async (id: string): Promise<LoadMonitoringData | undefined> => {
    // First, check if we have the record in local state already
    const recordFromState = loadMonitoringRecords.find(record => record.id === id);
    if (recordFromState) {
      return recordFromState;
    }

    // If not in state, fetch from Firestore
    try {
      const docRef = doc(db, "loadMonitoring", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const fetchedRecord = {
          id: docSnap.id,
          ...docSnap.data()
        } as LoadMonitoringData;
        
        // Update the state with the fetched record
        setLoadMonitoringRecords(prev => [...(prev || []), fetchedRecord]);
        return fetchedRecord;
      }
      return undefined;
    } catch (error) {
      console.error("Error getting load monitoring record:", error);
      toast.error("Failed to get record");
      return undefined;
    }
  };

  return (
    <DataContext.Provider
      value={{
        regions,
        districts,
        isLoadingRegions,
        isLoadingDistricts,
        regionsError,
        districtsError,
        retryRegionsAndDistricts: () => fetchRegionsAndDistricts(),
        op5Faults,
        controlOutages,
        vitAssets,
        vitInspections,
        savedInspections,
        loadMonitoringRecords,
        setRegions,
        setDistricts,
        setOP5Faults,
        setControlOutages,
        setVITAssets,
        setVITInspections,
        setSavedInspections,
        setLoadMonitoringRecords,
        saveLoadMonitoringRecord,
        getLoadMonitoringRecord,
        updateLoadMonitoringRecord,
        deleteLoadMonitoringRecord,
        addOP5Fault,
        updateOP5Fault,
        deleteOP5Fault,
        deleteFault,
        addControlOutage,
        updateControlOutage,
        deleteControlOutage,
        canResolveFault,
        getFilteredFaults,
        addVITAsset,
        updateVITAsset,
        deleteVITAsset,
        addVITInspection,
        updateVITInspection,
        deleteVITInspection,
        saveInspection,
        updateDistrict,
        getSavedInspection,
        updateSubstationInspection,
        deleteInspection,
        canEditFault,
        canEditOutage,
        canEditAsset,
        canEditInspection,
        canDeleteFault: canEditFault,
        canDeleteOutage: canEditFault,
        canDeleteAsset: canDeleteAsset,
        canDeleteInspection: canDeleteInspection,
        canAddAsset: canAddAsset,
        canAddInspection: canAddInspection,
        resolveFault,
        canEditLoadMonitoring,
        canDeleteLoadMonitoring,
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
