import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, InfoIcon, Users, MapPin, Calculator, FileText } from "lucide-react";
import { FaultType, UnplannedFaultType, EmergencyFaultType, ControlSystemOutage } from "@/lib/types";
import { 
  calculateDurationHours,
  calculateUnservedEnergy
} from "@/utils/calculations";
import { toast } from "@/components/ui/sonner";
import { showNotification, showServiceWorkerNotification } from '@/utils/notifications';
import { PermissionService } from "@/services/PermissionService";
import OfflineStorageService from "@/services/OfflineStorageService";

interface ControlSystemOutageFormProps {
  defaultRegionId?: string;
  defaultDistrictId?: string;
}

export function ControlSystemOutageForm({ defaultRegionId = "", defaultDistrictId = "" }: ControlSystemOutageFormProps) {
  const { regions, districts, addControlSystemOutage } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const permissionService = PermissionService.getInstance();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [regionId, setRegionId] = useState<string>(defaultRegionId);
  const [districtId, setDistrictId] = useState<string>(defaultDistrictId);
  const [occurrenceDate, setOccurrenceDate] = useState<string>("");
  const [faultType, setFaultType] = useState<FaultType>("Unplanned");
  const [ruralAffected, setRuralAffected] = useState<number | null>(null);
  const [urbanAffected, setUrbanAffected] = useState<number | null>(null);
  const [metroAffected, setMetroAffected] = useState<number | null>(null);
  const [restorationDate, setRestorationDate] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [indications, setIndications] = useState<string>("");
  const [areaAffected, setAreaAffected] = useState<string>("");
  const [loadMW, setLoadMW] = useState<number>(0);
  
  // Derived values
  const [durationHours, setDurationHours] = useState<number | null>(null);
  const [unservedEnergyMWh, setUnservedEnergyMWh] = useState<number | null>(null);
  const [specificFaultType, setSpecificFaultType] = useState<UnplannedFaultType | EmergencyFaultType | undefined>(undefined);
  
  // Check if user has permission to report faults
  useEffect(() => {
    if (user && !permissionService.canAccessFeature(user.role, 'fault_reporting')) {
      navigate("/unauthorized");
      return;
    }
  }, [user, navigate]);
  
  // Initialize region and district based on user's assigned values
  useEffect(() => {
    if (!user) return;

    console.log("[ControlSystemOutageForm] Initializing with user:", {
      role: user.role,
      districtId: user.districtId,
      regionId: user.regionId
    });

    if (user.role === "district_engineer" || user.role === "regional_engineer" || user.role === "technician") {
      // For district engineers and technicians, find their region through their district
      if ((user.role === "district_engineer" || user.role === "technician") && user.districtId) {
        const userDistrict = districts.find(d => d.id === user.districtId);
        console.log("[ControlSystemOutageForm] Found user district:", userDistrict);
        
        if (userDistrict) {
          setDistrictId(userDistrict.id);
          setRegionId(userDistrict.regionId);
          console.log("[ControlSystemOutageForm] Set district and region:", {
            districtId: userDistrict.id,
            regionId: userDistrict.regionId
          });
          return;
        } else {
          console.error("[ControlSystemOutageForm] Could not find district for user:", user.districtId);
        }
      }
      
      // For regional engineers, find region by name
      if (user.role === "regional_engineer") {
        const userRegion = regions.find(r => r.name === user.region);
        console.log("[ControlSystemOutageForm] Found user region:", userRegion);
        
        if (userRegion) {
          setRegionId(userRegion.id);
          console.log("[ControlSystemOutageForm] Set region:", userRegion.id);
        } else {
          console.error("[ControlSystemOutageForm] Could not find region for user:", user.region);
        }
      }
    }
  }, [user, regions, districts]);
  
  // Update region and district when props change
  useEffect(() => {
    if (defaultRegionId) {
      setRegionId(defaultRegionId);
    }
    
    if (defaultDistrictId) {
      setDistrictId(defaultDistrictId);
    }
  }, [defaultRegionId, defaultDistrictId]);
  
  // Filter regions and districts based on user role
  const filteredRegions = regions.filter(region => {
    // Global engineers and system admins can see all regions
    if (user?.role === "global_engineer" || user?.role === "system_admin") return true;
    
    // Regional engineers can only see their assigned region
    if (user?.role === "regional_engineer") return region.id === user.regionId;
    
    // District engineers and technicians can only see their assigned region
    if (user?.role === "district_engineer" || user?.role === "technician") {
      const userDistrict = districts.find(d => d.id === user.districtId);
      return userDistrict ? region.id === userDistrict.regionId : false;
    }
    
    return false;
  });

  const filteredDistricts = districts.filter(district => {
    if (!regionId) return false;
    
    // Global engineers and system admins can see all districts in the selected region
    if (user?.role === "global_engineer" || user?.role === "system_admin") 
      return district.regionId === regionId;
    
    // Regional engineers can see all districts in their region
    if (user?.role === "regional_engineer") 
      return district.regionId === user.regionId;
    
    // District engineers and technicians can only see their assigned district
    if (user?.role === "district_engineer" || user?.role === "technician") 
      return district.id === user.districtId;
    
    return false;
  });
  
  // Calculate metrics when dates or load changes
  useEffect(() => {
    if (occurrenceDate && restorationDate && loadMW > 0) {
      // Ensure restoration date is after occurrence date
      if (new Date(restorationDate) <= new Date(occurrenceDate)) {
        toast.error("Restoration date must be after occurrence date");
        return;
      }
      
      const duration = calculateDurationHours(occurrenceDate, restorationDate);
      setDurationHours(duration);
      
      const unservedEnergy = calculateUnservedEnergy(loadMW, duration);
      setUnservedEnergyMWh(unservedEnergy);
    }
  }, [occurrenceDate, restorationDate, loadMW]);
  
  // Add these helper functions before the handleSubmit function
  const getRegionName = (id: string) => regions.find(r => r.id === id)?.name || "Unknown";
  const getDistrictName = (id: string) => districts.find(d => d.id === id)?.name || "Unknown";
  
  const resetForm = () => {
    setRegionId(defaultRegionId);
    setDistrictId(defaultDistrictId);
    setOccurrenceDate("");
    setFaultType("Unplanned");
    setRuralAffected(null);
    setUrbanAffected(null);
    setMetroAffected(null);
    setRestorationDate("");
    setReason("");
    setIndications("");
    setAreaAffected("");
    setLoadMW(0);
    setDurationHours(null);
    setUnservedEnergyMWh(null);
    setSpecificFaultType(undefined);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user has permission to report faults
    if (user && !permissionService.canAccessFeature(user.role, 'fault_reporting')) {
      navigate("/unauthorized");
      return;
    }
    
    if (!occurrenceDate || !faultType || !regionId || !districtId || !loadMW) {
      toast.error("Please fill all required fields");
      return;
    }
    
    // Validate that at least one affected population field is filled
    if (ruralAffected === null && urbanAffected === null && metroAffected === null) {
      toast.error("Please fill at least one affected population field");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Format dates
      const formattedOccurrenceDate = new Date(occurrenceDate).toISOString();
      const formattedRestorationDate = restorationDate ? new Date(restorationDate).toISOString() : null;

      // Construct the base data object without audit fields
      const formDataToSubmit: Omit<ControlSystemOutage, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "isOffline"> = {
        regionId: regionId || "",
        districtId: districtId || "",
        occurrenceDate: formattedOccurrenceDate,
        restorationDate: formattedRestorationDate,
        faultType: faultType as FaultType,
        status: restorationDate ? "resolved" as const : "active" as const,
        loadMW: loadMW || 0,
        unservedEnergyMWh: unservedEnergyMWh || 0,
        reason: reason || "",
        controlPanelIndications: indications || "",
        areaAffected: areaAffected || "",
        customersAffected: {
          rural: ruralAffected ?? 0,
          urban: urbanAffected ?? 0,
          metro: metroAffected ?? 0
        },
      };

      const offlineStorage = OfflineStorageService.getInstance();
      const isOnline = offlineStorage.isInternetAvailable();
      console.log('[ControlSystemOutageForm] Internet available:', isOnline);

      if (isOnline) {
        console.log('[ControlSystemOutageForm] Submitting outage online...');
        await addControlSystemOutage(formDataToSubmit as Omit<ControlSystemOutage, "id">);
        toast.success("Outage report submitted successfully");
        resetForm();
        navigate("/dashboard");
      } else {
        console.log('[ControlSystemOutageForm] Saving outage offline...');
        try {
          // When offline, explicitly add client-side timestamp and 'offline_user'
          const offlineDataWithAudit = {
            ...formDataToSubmit,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: user?.id || 'offline_user',
            updatedBy: user?.id || 'offline_user',
            isOffline: true
          };
          await offlineStorage.saveFaultOffline(offlineDataWithAudit as Omit<ControlSystemOutage, "id">, 'control');
          toast.success("Outage report saved offline. It will be synced when internet connection is restored.");
          resetForm();
          navigate("/dashboard");
        } catch (error) {
          console.error('[ControlSystemOutageForm] Error saving outage offline:', error);
          toast.error("Failed to save outage offline. Please try again when you have internet connection.");
        } finally {
          setIsSubmitting(false);
        }
      }
    } catch (error) {
      console.error("[ControlSystemOutageForm] Error submitting outage:", error);
      toast.error("Failed to submit outage report. Please try again.");
      setIsSubmitting(false);
    }
  };
  
  // Reset specific fault type when fault type changes
  useEffect(() => {
    if (faultType !== "Unplanned" && faultType !== "Emergency") {
      setSpecificFaultType(undefined);
    }
  }, [faultType]);
  
  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-2xl font-serif">Control System Outage Report</CardTitle>
        <CardDescription>
          Report a control system outage with detailed information
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label htmlFor="region" className="text-base font-medium">Region</Label>
              <Select 
                value={regionId} 
                onValueChange={setRegionId}
                disabled={user?.role === "district_engineer" || user?.role === "regional_engineer" || user?.role === "technician"}
                required
              >
                <SelectTrigger className="h-12 text-base bg-background/50 border-muted">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {filteredRegions.map(region => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-3">
              <Label htmlFor="district" className="text-base font-medium">District</Label>
              <Select 
                value={districtId} 
                onValueChange={setDistrictId}
                disabled={user?.role === "district_engineer" || user?.role === "technician" || !regionId}
                required
              >
                <SelectTrigger className="h-12 text-base bg-background/50 border-muted">
                  <SelectValue placeholder="Select district" />
                </SelectTrigger>
                <SelectContent>
                  {regionId && filteredDistricts
                    .filter(d => d.regionId === regionId)
                    .map(district => (
                      <SelectItem key={district.id} value={district.id}>
                        {district.name}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label htmlFor="occurrenceDate" className="text-base font-medium">Outage Occurrence Date & Time</Label>
              <Input
                id="occurrenceDate"
                type="datetime-local"
                value={occurrenceDate}
                onChange={(e) => setOccurrenceDate(e.target.value)}
                required
                className="h-12 text-base bg-background/50 border-muted"
              />
            </div>
            
            <div className="space-y-3">
              <Label htmlFor="faultType" className="text-base font-medium">Type of Fault</Label>
              <Select value={faultType} onValueChange={(value) => setFaultType(value as FaultType)} required>
                <SelectTrigger className="h-12 text-base bg-background/50 border-muted">
                  <SelectValue placeholder="Select fault type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Planned">Planned</SelectItem>
                  <SelectItem value="Unplanned">Unplanned</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                  <SelectItem value="Load Shedding">Load Shedding</SelectItem>
                  <SelectItem value="GridCo Outages">GridCo Outages</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Show specific fault type dropdown when Unplanned or Emergency is selected */}
          {(faultType === "Unplanned" || faultType === "Emergency") && (
            <div className="space-y-3">
              <Label htmlFor="specificFaultType" className="text-base font-medium">Specific Fault Type</Label>
              <Select 
                value={specificFaultType} 
                onValueChange={(value) => setSpecificFaultType(
                  faultType === "Unplanned" 
                    ? value as UnplannedFaultType 
                    : value as EmergencyFaultType
                )}
                required
              >
                <SelectTrigger className="h-12 text-base bg-background/50 border-muted">
                  <SelectValue placeholder="Select specific fault type" />
                </SelectTrigger>
                <SelectContent>
                  {faultType === "Unplanned" ? (
                    <>
                      <SelectItem value="JUMPER CUT">Jumper Cut</SelectItem>
                      <SelectItem value="CONDUCTOR CUT">Conductor Cut</SelectItem>
                      <SelectItem value="MERGED CONDUCTOR">Merged Conductor</SelectItem>
                      <SelectItem value="HV/LV LINE CONTACT">HV/LV Line Contact</SelectItem>
                      <SelectItem value="VEGETATION">Vegetation</SelectItem>
                      <SelectItem value="CABLE FAULT">Cable Fault</SelectItem>
                      <SelectItem value="TERMINATION FAILURE">Termination Failure</SelectItem>
                      <SelectItem value="BROKEN POLES">Broken Poles</SelectItem>
                      <SelectItem value="BURNT POLE">Burnt Pole</SelectItem>
                      <SelectItem value="FAULTY ARRESTER/INSULATOR">Faulty Arrester/Insulator</SelectItem>
                      <SelectItem value="EQIPMENT FAILURE">Equipment Failure</SelectItem>
                      <SelectItem value="PUNCTURED CABLE">Punctured Cable</SelectItem>
                      <SelectItem value="ANIMAL INTERRUPTION">Animal Interruption</SelectItem>
                      <SelectItem value="BAD WEATHER">Bad Weather</SelectItem>
                      <SelectItem value="TRANSIENT FAULTS">Transient Faults</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="MEND CABLE">Mend Cable</SelectItem>
                      <SelectItem value="WORK ON EQUIPMENT">Work on Equipment</SelectItem>
                      <SelectItem value="FIRE">Fire</SelectItem>
                      <SelectItem value="IMPROVE HV">Improve HV</SelectItem>
                      <SelectItem value="JUMPER REPLACEMENT">Jumper Replacement</SelectItem>
                      <SelectItem value="MEND BROKEN">Mend Broken</SelectItem>
                      <SelectItem value="MEND JUMPER">Mend Jumper</SelectItem>
                      <SelectItem value="MEND TERMINATION">Mend Termination</SelectItem>
                      <SelectItem value="BROKEN POLE">Broken Pole</SelectItem>
                      <SelectItem value="BURNT POLE">Burnt Pole</SelectItem>
                      <SelectItem value="ANIMAL CONTACT">Animal Contact</SelectItem>
                      <SelectItem value="VEGETATION SAFETY">Vegetation Safety</SelectItem>
                      <SelectItem value="TRANSFER/RESTORE">Transfer/Restore</SelectItem>
                      <SelectItem value="TROUBLE SHOOTING">Trouble Shooting</SelectItem>
                      <SelectItem value="MEND LOOSE">Mend Loose</SelectItem>
                      <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                      <SelectItem value="REPLACE FUSE">Replace Fuse</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <Tabs defaultValue="affected" className="w-full">
            <TabsList className="grid grid-cols-3 w-full max-w-lg mx-auto mb-8 gap-2 bg-transparent p-0">
              <TabsTrigger
                value="affected"
                className="flex items-center justify-center gap-2 w-full min-h-[44px] px-2 py-2 rounded-full font-bold text-xs sm:text-sm shadow transition-all duration-200
                  data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-blue-600
                  data-[state=active]:text-white data-[state=active]:shadow-lg
                  data-[state=inactive]:bg-white data-[state=inactive]:text-primary border border-primary/30
                  focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="truncate">Affected Customers</span>
              </TabsTrigger>
              <TabsTrigger
                value="details"
                className="flex items-center justify-center gap-2 w-full min-h-[44px] px-2 py-2 rounded-full font-bold text-xs sm:text-sm shadow transition-all duration-200
                  data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-blue-600
                  data-[state=active]:text-white data-[state=active]:shadow-lg
                  data-[state=inactive]:bg-white data-[state=inactive]:text-primary border border-primary/30
                  focus-visible:ring-2 focus-visible:ring-primary"
              >
                <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="truncate">Outage Details</span>
              </TabsTrigger>
              <TabsTrigger
                value="calculations"
                className="flex items-center justify-center gap-2 w-full min-h-[44px] px-2 py-2 rounded-full font-bold text-xs sm:text-sm shadow transition-all duration-200
                  data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-blue-600
                  data-[state=active]:text-white data-[state=active]:shadow-lg
                  data-[state=inactive]:bg-white data-[state=inactive]:text-primary border border-primary/30
                  focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Calculator className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="truncate">Calculations</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="affected" className="space-y-4 sm:space-y-6 pt-4 sm:pt-6">
              <div className="bg-muted/50 p-4 rounded-lg border border-muted">
                <h4 className="font-medium mb-2">Enter Number of Customers Affected by this Outage</h4>
                <p className="text-sm text-muted-foreground">
                  Please enter the number of customers affected in each population category. 
                  At least one category must have affected customers to proceed.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <Label htmlFor="ruralAffected" className="font-medium flex items-center text-sm">
                    Rural Customers Affected *
                    <InfoIcon className="h-3 w-3 sm:h-4 sm:w-4 ml-1 text-muted-foreground" />
                  </Label>
                  <Input
                    id="ruralAffected"
                    type="number"
                    min="0"
                    value={ruralAffected === null ? "" : ruralAffected}
                    onChange={(e) => setRuralAffected(e.target.value === "" ? null : parseInt(e.target.value))}
                    className="bg-background/50 border-muted h-9 sm:h-10"
                    required
                    placeholder="Enter number of affected customers"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="urbanAffected" className="font-medium flex items-center text-sm">
                    Urban Customers Affected *
                    <InfoIcon className="h-3 w-3 sm:h-4 sm:w-4 ml-1 text-muted-foreground" />
                  </Label>
                  <Input
                    id="urbanAffected"
                    type="number"
                    min="0"
                    value={urbanAffected === null ? "" : urbanAffected}
                    onChange={(e) => setUrbanAffected(e.target.value === "" ? null : parseInt(e.target.value))}
                    className="bg-background/50 border-muted h-9 sm:h-10"
                    required
                    placeholder="Enter number of affected customers"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="metroAffected" className="font-medium flex items-center text-sm">
                    Metro Customers Affected *
                    <InfoIcon className="h-3 w-3 sm:h-4 sm:w-4 ml-1 text-muted-foreground" />
                  </Label>
                  <Input
                    id="metroAffected"
                    type="number"
                    min="0"
                    value={metroAffected === null ? "" : metroAffected}
                    onChange={(e) => setMetroAffected(e.target.value === "" ? null : parseInt(e.target.value))}
                    className="bg-background/50 border-muted h-9 sm:h-10"
                    required
                    placeholder="Enter number of affected customers"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                * At least one population type must have affected customers
              </p>
            </TabsContent>
            
            <TabsContent value="details" className="space-y-4 sm:space-y-6 pt-4 sm:pt-6">
              <div className="space-y-2">
                <Label htmlFor="reason" className="text-sm font-medium">Reason for Outage</Label>
                <Textarea
                  id="reason"
                  placeholder="Describe the reason for the outage"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="bg-background/50 border-muted h-20 sm:h-24"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="indications" className="text-sm font-medium">Indications on Control Panel</Label>
                <Textarea
                  id="indications"
                  placeholder="Describe the indications observed on the control panel"
                  value={indications}
                  onChange={(e) => setIndications(e.target.value)}
                  rows={2}
                  className="bg-background/50 border-muted h-20 sm:h-24"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="areaAffected" className="text-sm font-medium">Area Affected</Label>
                <Input
                  id="areaAffected"
                  type="text"
                  placeholder="E.g., North Sector, Industrial Zone"
                  value={areaAffected}
                  onChange={(e) => setAreaAffected(e.target.value)}
                  className="h-9 sm:h-10 text-sm bg-background/50 border-muted"
                />
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="load" className="text-base font-medium flex items-center gap-2">
                  Load (MW)
                  <InfoIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Enter the load in Megawatts (MW) at the time of the outage
                  </span>
                </Label>
                <Input
                  id="load"
                  type="number"
                  min="0"
                  step="0.1"
                  value={loadMW}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (value >= 0) {
                      setLoadMW(value);
                    }
                  }}
                  className="h-12 text-base bg-background/50 border-muted"
                  required
                />
                {loadMW > 0 && durationHours !== null && unservedEnergyMWh !== null && (
                  <div className="text-sm text-muted-foreground">
                    Unserved Energy: {unservedEnergyMWh} MWh
                    <br />
                    (Load: {loadMW} MW × Duration: {durationHours.toFixed(2)} hours)
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="restorationDate" className="text-sm font-medium">Restoration Date & Time</Label>
                <Input
                  id="restorationDate"
                  type="datetime-local"
                  value={restorationDate}
                  onChange={(e) => setRestorationDate(e.target.value)}
                  className="h-9 sm:h-10 text-sm bg-background/50 border-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty if the outage is still active
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="calculations" className="pt-4 sm:pt-6">
              <div className="space-y-4 sm:space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="durationHours" className="font-medium text-sm">Duration of Outage</Label>
                    <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                      {durationHours !== null 
                        ? `${durationHours.toFixed(2)} hours` 
                        : "Not calculated yet"}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="unservedEnergyMWh" className="font-medium text-sm">Unserved Energy (MWh)</Label>
                    <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                      {unservedEnergyMWh !== null 
                        ? `${unservedEnergyMWh.toFixed(2)} MWh` 
                        : "Not calculated yet"}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </form>
      </CardContent>
      <CardFooter className="px-0 pt-4">
        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Outage Report"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
