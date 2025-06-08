import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useData, DataContextType } from "@/contexts/DataContext";
import { useAuth, AuthContextType } from "@/contexts/AuthContext";
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
import { Loader2, InfoIcon, Clock, Zap } from "lucide-react";
import { FaultType, ControlSystemOutage, UnplannedFaultType, EmergencyFaultType, AffectedPopulation } from "@/lib/types";
import { 
    calculateDurationHours, 
    calculateUnservedEnergy,
    formatDuration
} from "@/utils/calculations";
import { toast } from "@/components/ui/sonner";
import { Layout } from "@/components/layout/Layout";
import LoggingService from "@/services/LoggingService";

// Helper function to format date for input field safely
const formatDateForInput = (dateString: string | null | undefined): string => {
  if (dateString === null || dateString === undefined || dateString === "") return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return ""; 
    return date.toISOString().slice(0, 16); 
  } catch (error) {
    console.error("[formatDateForInput] Error formatting date string:", dateString, error);
    return "";
  }
};

export default function EditControlOutagePage() {
  const { id } = useParams<{ id: string }>();
  const { controlSystemOutages, updateControlSystemOutage, regions, districts } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [outage, setOutage] = useState<ControlSystemOutage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state initialized as partial
  const [formData, setFormData] = useState<Partial<ControlSystemOutage>>({});

  // State for calculated values
  const [calculatedDuration, setCalculatedDuration] = useState<number | null>(null);
  const [calculatedUnservedEnergy, setCalculatedUnservedEnergy] = useState<number | null>(null);

  // Fetch outage data
  useEffect(() => {
    if (!controlSystemOutages) {
      setIsLoading(true);
      return;
    }

    if (id) {
      const fetchedOutage = controlSystemOutages.find(o => o.id === id);
      if (fetchedOutage) {
        setOutage(fetchedOutage);
        setFormData({
          ...fetchedOutage,
          occurrenceDate: formatDateForInput(fetchedOutage.occurrenceDate),
          restorationDate: formatDateForInput(fetchedOutage.restorationDate),
          customersAffected: fetchedOutage.customersAffected || { rural: 0, urban: 0, metro: 0 }
        });
      } else {
         console.error(`[EditControlOutagePage] Outage with ID ${id} not found.`);
         toast.error("Outage not found.");
         navigate("/dashboard");
      }
      setIsLoading(false);
    } else {
       console.error("[EditControlOutagePage] No outage ID provided in URL.");
      navigate("/dashboard"); // Redirect if no ID
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate, controlSystemOutages]);

  // Calculate metrics in real-time
  useEffect(() => {
     const { occurrenceDate: occStr, restorationDate: resStr, loadMW } = formData;
     
     let duration: number | null = null;
     let energy: number | null = null;

     let occDate: Date | null = null;
     let resDate: Date | null = null;

     if (occStr) { try { occDate = new Date(occStr); if(isNaN(occDate.getTime())) occDate = null; } catch { occDate = null; } }
     if (resStr) { try { resDate = new Date(resStr); if(isNaN(resDate.getTime())) resDate = null; } catch { resDate = null; } }

     const currentLoad = typeof loadMW === 'number' && loadMW > 0 ? loadMW : null;

     // Calculate Duration
     if (occDate && resDate && resDate > occDate) {
         try { duration = calculateDurationHours(occStr!, resStr!); } catch (e) { console.error("Error calc duration:", e); duration = null; }
     }

     // Calculate Unserved Energy
     if (duration !== null && currentLoad !== null) {
         try { energy = calculateUnservedEnergy(currentLoad, duration); } catch (e) { console.error("Error calc energy:", e); energy = null; }
     }

     setCalculatedDuration(duration);
     setCalculatedUnservedEnergy(energy);

  }, [formData.occurrenceDate, formData.restorationDate, formData.loadMW]);

  // Generic handler for most inputs
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    
    // Handle date validations
    if (id === 'repairStartDate') {
      const repairStartDateTime = new Date(value);
      const occurrenceDateTime = formData.occurrenceDate ? new Date(formData.occurrenceDate) : null;

      if (occurrenceDateTime && repairStartDateTime < occurrenceDateTime) {
        toast.error("Repair start date cannot be before occurrence date");
        return;
      }
    }

    if (id === 'repairEndDate') {
      const repairEndDateTime = new Date(value);
      const repairStartDateTime = formData.repairStartDate ? new Date(formData.repairStartDate) : null;

      if (repairStartDateTime && repairEndDateTime <= repairStartDateTime) {
        toast.error("Repair end date must be after repair start date");
        return;
      }
    }

    if (id === 'restorationDate') {
      const restorationDateTime = new Date(value);
      const occurrenceDateTime = formData.occurrenceDate ? new Date(formData.occurrenceDate) : null;
      const repairStartDateTime = formData.repairStartDate ? new Date(formData.repairStartDate) : null;
      const repairEndDateTime = formData.repairEndDate ? new Date(formData.repairEndDate) : null;

      if (occurrenceDateTime && restorationDateTime <= occurrenceDateTime) {
        toast.error("Restoration date must be after occurrence date");
        return;
      }

      if (repairStartDateTime && restorationDateTime <= repairStartDateTime) {
        toast.error("Restoration date must be after repair start date");
        return;
      }

      if (repairEndDateTime && restorationDateTime <= repairEndDateTime) {
        toast.error("Restoration date must be after repair end date");
        return;
      }
    }

    if (id === 'loadMW' && type === 'number') {
      const numValue = value === "" ? null : parseFloat(value); 
      setFormData(prev => ({ ...prev, [id]: (numValue !== null && numValue >= 0) ? numValue : null })); // Store null if empty or negative
    } else {
      setFormData(prev => ({ ...prev, [id]: value }));
    }
  };

  // Generic handler for Select components
  const handleSelectChange = (id: keyof ControlSystemOutage, value: string) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  // Specific handler for affected population inputs (Removed as not present in ControlSystemOutage form)
  // const handleAffectedPopulationChange = ... 

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outage || typeof updateControlSystemOutage !== 'function') { toast.error("Cannot submit: Component not ready."); return; }
    if (!formData.regionId || !formData.districtId) { toast.error("Please select region and district"); return; }
    if (!formData.occurrenceDate) { toast.error("Occurrence Date is required."); return; }
    if (formData.loadMW === null || formData.loadMW <= 0) { toast.error("Load (MW) must be a positive number."); return; }

    let occurrenceDateTime: Date | null = null;
    let restorationDateTime: Date | null = null;

    if (formData.occurrenceDate) { try { occurrenceDateTime = new Date(formData.occurrenceDate); if(isNaN(occurrenceDateTime.getTime())) occurrenceDateTime = null; } catch { occurrenceDateTime = null; } }
    if (formData.restorationDate) { try { restorationDateTime = new Date(formData.restorationDate); if(isNaN(restorationDateTime.getTime())) restorationDateTime = null; } catch { restorationDateTime = null; } }
    
    if (!occurrenceDateTime) { toast.error("Invalid Occurrence Date format."); return; }
    if (restorationDateTime && occurrenceDateTime && restorationDateTime <= occurrenceDateTime) { toast.error("Restoration date must be after occurrence date"); return; }

    setIsSubmitting(true);
    try {
      const formattedOccurrenceDate = occurrenceDateTime.toISOString();
      const formattedRestorationDate = restorationDateTime ? restorationDateTime.toISOString() : null;
      
      // Use the final calculated unserved energy from state
      const finalUnservedEnergy = calculatedUnservedEnergy ?? 0;

      const formDataToSubmit: Partial<ControlSystemOutage> = {
        regionId: formData.regionId,
        districtId: formData.districtId,
        occurrenceDate: formattedOccurrenceDate,
        restorationDate: formattedRestorationDate,
        faultType: formData.faultType as FaultType,
        specificFaultType: formData.specificFaultType,
        reason: formData.reason,
        controlPanelIndications: formData.controlPanelIndications,
        areaAffected: formData.areaAffected,
        loadMW: formData.loadMW,
        unservedEnergyMWh: finalUnservedEnergy,
        customersAffected: formData.customersAffected || { rural: 0, urban: 0, metro: 0 },
        status: formData.restorationDate ? 'resolved' : 'pending',
        feederName: formData.feederName || "",
        voltageLevel: formData.voltageLevel || "",
        repairStartDate: formData.repairStartDate,
        repairEndDate: formData.repairEndDate,
        feederType: formData.feederType || "",
        customerInterruptions: formData.customerInterruptions || { metro: 0, urban: 0, rural: 0 },
        feederCustomers: formData.feederCustomers || { metro: 0, urban: 0, rural: 0 }
      };

      await updateControlSystemOutage(outage.id, formDataToSubmit);
      
      toast.success("Control System Outage updated successfully");
      navigate("/dashboard");
    } catch (error) {
      console.error("Error updating outage:", error);
      toast.error("Failed to update outage. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter districts based on selected region and user role
  const filteredDistricts = formData.regionId && Array.isArray(districts)
    ? districts.filter(d => {
        if (d.regionId !== formData.regionId) return false;
        if (user?.role === "district_engineer" && d.name !== user.district) return false;
        const userRegionObj = Array.isArray(regions) ? regions.find(r => r.name === user?.region) : null;
        if (user?.role === "regional_engineer" && userRegionObj && d.regionId !== userRegionObj.id) return false;
        return true; 
      })
    : [];

  // --- JSX Rendering --- 
  if (isLoading) {
      return (
        <Layout>
            <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        </Layout>
    ); 
   }
  if (!outage) {
      return (
        <Layout>
            <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)]">
            <p className="text-lg text-muted-foreground mb-4">Outage not found.</p>
            <Button onClick={() => navigate("/dashboard")} variant="outline">Go to Dashboard</Button>
            </div>
        </Layout>
    );
   }

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6 max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">Edit Control System Outage</h1>
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-8">
             {/* --- Section 1: Identification & Location --- */}
              <div className="space-y-4 p-4 border rounded-md bg-background/30"> 
                 <h2 className="text-lg font-semibold border-b pb-2">Identification & Location</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                     <div className="space-y-2">
                       <Label htmlFor="regionId">Region</Label>
                       <Select value={formData.regionId || ''} onValueChange={(value) => handleSelectChange('regionId', value)} disabled={user?.role === "district_engineer" || user?.role === "regional_engineer" || user?.role === "technician" || user?.role === "regional_general_manager"}> 
                         <SelectTrigger className="h-10"><SelectValue placeholder="Select region" /></SelectTrigger>
                         <SelectContent>{regions.map(r => (<SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>))}</SelectContent>
                       </Select>
                     </div>
                     <div className="space-y-2">
                       <Label htmlFor="districtId">District</Label>
                       <Select value={formData.districtId || ''} onValueChange={(value) => handleSelectChange('districtId', value)} disabled={user?.role === "district_engineer" || user?.role === "technician" || !formData.regionId}>
                         <SelectTrigger className="h-10"><SelectValue placeholder="Select district" /></SelectTrigger>
                         <SelectContent>{filteredDistricts.map(d => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}</SelectContent>
                       </Select>
                     </div>
                     <div className="space-y-2 md:col-span-2">
                         <Label htmlFor="areaAffected">Area Affected</Label>
                         <Input id="areaAffected" value={formData.areaAffected || ""} onChange={handleInputChange} placeholder="E.g., North Sector, Industrial Zone" className="h-10"/>
                     </div>
                 </div>
              </div>

              {/* --- Section 2: Outage Details --- */}
              <div className="space-y-4 p-4 border rounded-md bg-background/30">
                 <h2 className="text-lg font-semibold border-b pb-2">Outage Details</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-2">
                       <Label htmlFor="faultType">Fault Type</Label>
                       <Select value={formData.faultType || ''} onValueChange={(value) => handleSelectChange('faultType', value as FaultType)}>
                         <SelectTrigger className="h-10"><SelectValue placeholder="Select fault type" /></SelectTrigger>
                         <SelectContent>
                           <SelectItem value="Planned">Planned</SelectItem>
                           <SelectItem value="Unplanned">Unplanned</SelectItem>
                           <SelectItem value="Emergency">Emergency</SelectItem>
                           <SelectItem value="ECG Load Shedding">ECG Load Shedding</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
                     <div className="space-y-2">
                       <Label htmlFor="feederName">Feeder Name</Label>
                       <Input
                         id="feederName"
                         type="text"
                         value={formData.feederName || ""}
                         onChange={handleInputChange}
                         placeholder="Enter feeder name"
                         className="h-10"
                         required
                       />
                     </div>
                     <div className="space-y-2">
                       <Label htmlFor="loadMW">Load (MW) *</Label>
                       <Input id="loadMW" type="number" value={formData.loadMW ?? ""} onChange={handleInputChange} placeholder="Enter load in MW" min="0" step="0.01" className="h-10" required/>
                     </div>
                     <div className="space-y-2 md:col-span-2">
                       <Label htmlFor="reason">Reason for Outage</Label>
                       <Textarea id="reason" value={formData.reason || ""} onChange={handleInputChange} placeholder="Describe the reason..." rows={3} className="text-sm"/>
                     </div>
                     <div className="space-y-2 md:col-span-2">
                       <Label htmlFor="controlPanelIndications">Control Panel Indications</Label>
                       <Textarea id="controlPanelIndications" value={formData.controlPanelIndications || ""} onChange={handleInputChange} placeholder="Describe indications..." rows={3} className="text-sm"/>
                     </div>
                 </div>

                 {/* Feeder/Equipment Details Section */}
                 <div className="space-y-4 pt-4">
                   <h3 className="text-lg font-semibold">Feeder/Equipment Details</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                       <Label htmlFor="voltageLevel" className="text-sm font-medium">Voltage Level</Label>
                       <Select value={formData.voltageLevel || ''} onValueChange={(value) => handleSelectChange('voltageLevel', value)}>
                         <SelectTrigger className="h-10">
                           <SelectValue placeholder="Select voltage level" />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="11kv">11kV</SelectItem>
                           <SelectItem value="33kv">33kV</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
                     <div className="space-y-2">
                       <Label htmlFor="feederType" className="text-sm font-medium">Type of Feeder</Label>
                       <Select value={formData.feederType || ''} onValueChange={(value) => handleSelectChange('feederType', value)}>
                         <SelectTrigger className="h-10">
                           <SelectValue placeholder="Select feeder type" />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="underground">Underground</SelectItem>
                           <SelectItem value="overhead">Overhead</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                       <Label htmlFor="repairStartDate" className="text-sm font-medium">Repair Start</Label>
                       <Input
                         id="repairStartDate"
                         type="datetime-local"
                         value={formData.repairStartDate || ""}
                         onChange={handleInputChange}
                         className="h-10"
                       />
                       <p className="text-xs text-muted-foreground">
                         Must be after or equal to occurrence date
                       </p>
                     </div>
                     <div className="space-y-2">
                       <Label htmlFor="repairEndDate" className="text-sm font-medium">Repair End</Label>
                       <Input
                         id="repairEndDate"
                         type="datetime-local"
                         value={formData.repairEndDate || ""}
                         onChange={handleInputChange}
                         className="h-10"
                       />
                       <p className="text-xs text-muted-foreground">
                         Must be after repair start date
                       </p>
                     </div>
                   </div>
                 </div>

                 {/* Customers Affected Section */}
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 pt-4">
                   <div className="space-y-2">
                     <Label htmlFor="ruralAffected" className="font-medium flex items-center text-sm">Rural Customers Affected</Label>
                     <Input
                       id="ruralAffected"
                       type="number"
                       min="0"
                       value={formData.customersAffected?.rural ?? ""}
                       onChange={e => setFormData(prev => ({
                         ...prev,
                         customersAffected: {
                           ...prev.customersAffected,
                           rural: parseInt(e.target.value) || 0,
                         },
                       }))}
                       className="bg-background/50 border-muted h-9 sm:h-10"
                       placeholder="Enter number of affected customers"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="urbanAffected" className="font-medium flex items-center text-sm">Urban Customers Affected</Label>
                     <Input
                       id="urbanAffected"
                       type="number"
                       min="0"
                       value={formData.customersAffected?.urban ?? ""}
                       onChange={e => setFormData(prev => ({
                         ...prev,
                         customersAffected: {
                           ...prev.customersAffected,
                           urban: parseInt(e.target.value) || 0,
                         },
                       }))}
                       className="bg-background/50 border-muted h-9 sm:h-10"
                       placeholder="Enter number of affected customers"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="metroAffected" className="font-medium flex items-center text-sm">Metro Customers Affected</Label>
                     <Input
                       id="metroAffected"
                       type="number"
                       min="0"
                       value={formData.customersAffected?.metro ?? ""}
                       onChange={e => setFormData(prev => ({
                         ...prev,
                         customersAffected: {
                           ...prev.customersAffected,
                           metro: parseInt(e.target.value) || 0,
                         },
                       }))}
                       className="bg-background/50 border-muted h-9 sm:h-10"
                       placeholder="Enter number of affected customers"
                     />
                   </div>
                 </div>

                 {/* Feeder Customers Section */}
                 <div className="space-y-4 pt-4">
                   <h3 className="text-lg font-semibold">Feeder Customers</h3>
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                     <div className="space-y-2">
                       <Label htmlFor="metroFeederCustomers" className="font-medium flex items-center text-sm">Metro</Label>
                       <Input
                         id="metroFeederCustomers"
                         type="number"
                         min="0"
                         value={formData.feederCustomers?.metro ?? ""}
                         onChange={e => setFormData(prev => ({
                           ...prev,
                           feederCustomers: {
                             ...prev.feederCustomers,
                             metro: parseInt(e.target.value) || 0,
                           },
                         }))}
                         className="bg-background/50 border-muted h-9 sm:h-10"
                         placeholder="Enter number of customers"
                       />
                     </div>
                     <div className="space-y-2">
                       <Label htmlFor="urbanFeederCustomers" className="font-medium flex items-center text-sm">Urban</Label>
                       <Input
                         id="urbanFeederCustomers"
                         type="number"
                         min="0"
                         value={formData.feederCustomers?.urban ?? ""}
                         onChange={e => setFormData(prev => ({
                           ...prev,
                           feederCustomers: {
                             ...prev.feederCustomers,
                             urban: parseInt(e.target.value) || 0,
                           },
                         }))}
                         className="bg-background/50 border-muted h-9 sm:h-10"
                         placeholder="Enter number of customers"
                       />
                     </div>
                     <div className="space-y-2">
                       <Label htmlFor="ruralFeederCustomers" className="font-medium flex items-center text-sm">Rural</Label>
                       <Input
                         id="ruralFeederCustomers"
                         type="number"
                         min="0"
                         value={formData.feederCustomers?.rural ?? ""}
                         onChange={e => setFormData(prev => ({
                           ...prev,
                           feederCustomers: {
                             ...prev.feederCustomers,
                             rural: parseInt(e.target.value) || 0,
                           },
                         }))}
                         className="bg-background/50 border-muted h-9 sm:h-10"
                         placeholder="Enter number of customers"
                       />
                     </div>
                   </div>
                 </div>
              </div>

              {/* --- Section 3: Timing & Calculations --- */} 
              <div className="space-y-4 p-4 border rounded-md bg-background/30">
                 <h2 className="text-lg font-semibold border-b pb-2">Timing & Calculations</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                     <div className="space-y-2">
                       <Label htmlFor="occurrenceDate">Occurrence Date & Time *</Label>
                       <Input id="occurrenceDate" type="datetime-local" value={formData.occurrenceDate || ""} onChange={handleInputChange} className="w-full h-10" required/>
                     </div>
                     <div className="space-y-2">
                       <Label htmlFor="restorationDate">Restoration Date & Time</Label>
                       <Input 
                         id="restorationDate" 
                         type="datetime-local" 
                         value={formData.restorationDate || ""} 
                         onChange={handleInputChange} 
                         className="w-full h-10"
                       />
                       <p className="text-xs text-muted-foreground">
                         Must be after occurrence date and repair dates
                       </p>
                     </div>
                 </div>
                 {/* Calculated Values Display */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                      {/* Duration Display (Read-only) */}
                      <div className="space-y-2">
                         <Label className="font-medium text-sm flex items-center gap-1">
                            <Clock className="h-4 w-4 text-muted-foreground"/> Outage Duration
                         </Label>
                         <div className="bg-muted/50 rounded-md p-3 text-sm border border-muted min-h-[40px] flex items-center">
                           {calculatedDuration !== null 
                             ? formatDuration(calculatedDuration) 
                             : <span className="text-muted-foreground italic text-xs">Requires valid Occurrence & Restoration Dates</span>}
                         </div>
                       </div>
                        {/* Unserved Energy Display (Read-only) */}
                       <div className="space-y-2">
                         <Label className="font-medium text-sm flex items-center gap-1">
                             <Zap className="h-4 w-4 text-muted-foreground"/> Unserved Energy (MWh)
                         </Label>
                         <div className="bg-muted/50 rounded-md p-3 text-sm border border-muted min-h-[40px] flex items-center">
                           {calculatedUnservedEnergy !== null 
                             ? calculatedUnservedEnergy.toFixed(2) + " MWh" 
                             : <span className="text-muted-foreground italic text-xs">{'Requires valid Duration & Load > 0'}</span>}
                         </div>
                       </div>
                 </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                  <Button type="submit" disabled={isSubmitting} className="w-full h-11 text-base font-medium">
                    {isSubmitting ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" />Updating...</>) : ("Update Outage Report")}
                  </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
} 