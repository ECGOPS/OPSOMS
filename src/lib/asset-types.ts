import { InspectionItem } from './types';

export interface FeederLeg {
  id: string;
  redPhaseCurrent: number | '';
  yellowPhaseCurrent: number | '';
  bluePhaseCurrent: number | '';
  neutralCurrent: number | '';
}

export interface LoadMonitoringData {
  id: string;
  date: string;
  time: string;
  regionId: string;
  districtId: string;
  region: string;
  district: string;
  
  // Substation Information
  substationName: string;
  substationNumber: string;
  location: string;
  rating: number;
  peakLoadStatus: 'day' | 'night';
  
  // Feeder Information
  feederLegs: FeederLeg[];
  
  // Load Information (calculated values)
  ratedLoad: number;
  redPhaseBulkLoad: number;
  yellowPhaseBulkLoad: number;
  bluePhaseBulkLoad: number;
  averageCurrent: number;
  percentageLoad: number;
  tenPercentFullLoadNeutral: number;
  calculatedNeutral: number;
  
  // Warning Information (optional calculated values)
  neutralWarningLevel?: "normal" | "warning" | "critical";
  neutralWarningMessage?: string;
  imbalancePercentage?: number;
  imbalanceWarningLevel?: "normal" | "warning" | "critical";
  imbalanceWarningMessage?: string;
  maxPhaseCurrent?: number;
  minPhaseCurrent?: number;
  avgPhaseCurrent?: number;

  // User Information
  createdBy: {
    id: string;
    name: string;
  };
}

export type ConditionStatus = 'good' | 'bad';
export type YesNoStatus = 'yes' | 'no';
export type GoodBadStatus = 'good' | 'bad';

export interface SubstationInspectionData {
  id: string;
  region: string;
  district: string;
  date: string;
  substationNo: string;
  substationName?: string;
  type: 'indoor' | 'outdoor';
  items: InspectionItem[];
  createdAt: string;
  createdBy: string;
}

export interface VITItem {
  id: string;
  name: string;
  status: YesNoStatus | GoodBadStatus;
  remarks: string;
}

export interface VITInspectionData {
  id: string;
  region: string;
  district: string;
  date: string;
  voltageLevel: '11KV' | '33KV';
  typeOfUnit: string;
  serialNumber: string;
  location: string;
  gpsLocation: string;
  status: string;
  protection: string;
  photoUrl?: string;
  items: VITItem[];
  createdAt: string;
  createdBy: string;
}

export type SubstationInspection = {
  id: string;
  regionId: string;
  districtId: string;
  inspectionDate: string;
  inspectedBy: string;
  generalBuilding: InspectionItem[];
  controlEquipment: InspectionItem[];
  powerTransformer: InspectionItem[];
  outdoorEquipment: InspectionItem[];
  remarks: string;
  createdBy: string;
  createdAt: string;
};
