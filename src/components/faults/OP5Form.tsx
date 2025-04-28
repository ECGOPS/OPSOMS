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
import { Loader2, InfoIcon, Users, Clock, ActivityIcon, FileText, Calculator, X, PlusCircle } from "lucide-react";
import { 
    FaultType, 
    UnplannedFaultType, 
    EmergencyFaultType, 
    OP5Fault, 
    AffectedPopulation, 
    ReliabilityIndices,
    MaterialUsed
} from "@/lib/types";
import { 
  calculateOutageDuration, 
  calculateMTTR, 
  calculateCustomerLostHours,
  calculateReliabilityIndicesByType
} from "@/lib/calculations";
import { toast } from "@/components/ui/sonner";
import { formatDuration } from "@/utils/calculations";
import { v4 as uuidv4 } from 'uuid';
import { showNotification, showServiceWorkerNotification } from '@/utils/notifications';
import { PermissionService } from "@/services/PermissionService";

interface OP5FormProps {
  defaultRegionId?: string;
  defaultDistrictId?: string;
  onSubmit?: (formData: Partial<OP5Fault>) => void;
}

export function OP5Form({ defaultRegionId = "", defaultDistrictId = "", onSubmit }: OP5FormProps) {
  const { regions, districts, addOP5Fault } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const permissionService = PermissionService.getInstance();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [regionId, setRegionId] = useState<string>(defaultRegionId);
  const [districtId, setDistrictId] = useState<string>(defaultDistrictId);
  const [outageType, setOutageType] = useState<string>("");
  const [outageSubType, setOutageSubType] = useState<string>("");
  const [outageDescription, setOutageDescription] = useState<string>("");
  const [faultLocation, setFaultLocation] = useState<string>("");
  const [occurrenceDate, setOccurrenceDate] = useState<string>("");
  const [repairDate, setRepairDate] = useState<string>("");
  const [restorationDate, setRestorationDate] = useState<string>("");
  const [ruralAffected, setRuralAffected] = useState<number | null>(null);
  const [urbanAffected, setUrbanAffected] = useState<number | null>(null);
  const [metroAffected, setMetroAffected] = useState<number | null>(null);
  const [specificFaultType, setSpecificFaultType] = useState<UnplannedFaultType | EmergencyFaultType | undefined>(undefined);
  
  // Derived values
  const [outageDuration, setOutageDuration] = useState<number | null>(null);
  const [mttr, setMttr] = useState<number | null>(null);
  const [customerLostHours, setCustomerLostHours] = useState<number | null>(null);
  
  // Replace the existing reliability indices state with:
  const [reliabilityIndices, setReliabilityIndices] = useState<{
    rural: ReliabilityIndices;
    urban: ReliabilityIndices;
    metro: ReliabilityIndices;
  }>({
    rural: { saidi: 0, saifi: 0, caidi: 0 },
    urban: { saidi: 0, saifi: 0, caidi: 0 },
    metro: { saidi: 0, saifi: 0, caidi: 0 }
  });
  
  // Check if user has permission to report faults
  useEffect(() => {
    if (user && !permissionService.canAccessFeature(user.role, 'fault_reporting')) {
      navigate("/unauthorized");
      return;
    }
  }, [user, navigate]);
  
  // Filter regions and districts based on user role
  const filteredRegions = regions.filter(region => {
    if (user?.role === "global_engineer") return true;
    if (user?.role === "regional_engineer") return region.id === user.regionId;
    if (user?.role === "district_engineer" || user?.role === "technician") {
      // For district engineers and technicians, show their assigned region
      const userDistrict = districts.find(d => d.id === user.districtId);
      console.log("[OP5Form] Filtering regions for district engineer/technician:", {
        userDistrict,
        regionId: region.id,
        userDistrictRegionId: userDistrict?.regionId
      });
      return userDistrict ? region.id === userDistrict.regionId : false;
    }
    return false;
  });

  const filteredDistricts = districts.filter(district => {
    if (!regionId) return false;
    if (user?.role === "global_engineer") return district.regionId === regionId;
    if (user?.role === "regional_engineer") return district.regionId === user.regionId;
    if (user?.role === "district_engineer" || user?.role === "technician") {
      console.log("[OP5Form] Filtering districts for district engineer/technician:", {
        districtId: district.id,
        userDistrictId: user.districtId
      });
      return district.id === user.districtId;
    }
    return false;
  });

  // Calculate metrics when dates change
  useEffect(() => {
    if (occurrenceDate && restorationDate) {
      // Ensure restoration date is after occurrence date
      if (new Date(restorationDate) <= new Date(occurrenceDate)) {
        toast.error("Restoration date must be after occurrence date");
        return;
      }

      // Ensure restoration date is after repair date if repair date exists
      if (repairDate && new Date(restorationDate) <= new Date(repairDate)) {
        toast.error("Restoration date must be after repair date");
        return;
      }
      
      const duration = calculateOutageDuration(occurrenceDate, restorationDate);
      setOutageDuration(duration);
      
      // Calculate MTTR if repair date is available
      if (repairDate) {
        const mttr = calculateMTTR(occurrenceDate, repairDate);
        setMttr(mttr);
      }
      
      // Calculate customer lost hours
      const lostHours = calculateCustomerLostHours(duration, {
        rural: ruralAffected || 0,
        urban: urbanAffected || 0,
        metro: metroAffected || 0
      });
      setCustomerLostHours(lostHours);
      
      const selectedDistrict = districts.find(d => d.id === districtId);
      if (selectedDistrict?.population) {
        // Calculate indices for rural population
        const ruralIndices = calculateReliabilityIndicesByType(
          duration,
          { rural: ruralAffected || 0, urban: 0, metro: 0 },
          selectedDistrict.population.rural || 0
        );

        // Calculate indices for urban population
        const urbanIndices = calculateReliabilityIndicesByType(
          duration,
          { rural: 0, urban: urbanAffected || 0, metro: 0 },
          selectedDistrict.population.urban || 0
        );

        // Calculate indices for metro population
        const metroIndices = calculateReliabilityIndicesByType(
          duration,
          { rural: 0, urban: 0, metro: metroAffected || 0 },
          selectedDistrict.population.metro || 0
        );

        setReliabilityIndices({
          rural: ruralIndices,
          urban: urbanIndices,
          metro: metroIndices
        });
      }
    }
  }, [occurrenceDate, repairDate, restorationDate, ruralAffected, urbanAffected, metroAffected, districtId, districts]);
  
  // Reset specific fault type when fault type changes
  useEffect(() => {
    if (specificFaultType !== undefined) {
      setSpecificFaultType(undefined);
    }
  }, [specificFaultType]);
  
  // --- State for Materials Used --- 
  const [materialsUsed, setMaterialsUsed] = useState<MaterialUsed[]>([]);
  const [currentMaterialType, setCurrentMaterialType] = useState<string>("");
  const [currentMaterialDetails, setCurrentMaterialDetails] = useState<Partial<MaterialUsed>>({});
  // --- End State for Materials Used --- 
  
  // Add these helper functions before the handleSubmit function
  const getRegionName = (id: string) => regions.find(r => r.id === id)?.name || "Unknown";
  const getDistrictName = (id: string) => districts.find(d => d.id === id)?.name || "Unknown";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user has permission to report faults
    if (user && !permissionService.canAccessFeature(user.role, 'fault_reporting')) {
      navigate("/unauthorized");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Format dates
      const formattedOccurrenceDate = new Date(occurrenceDate).toISOString();
      const formattedRepairDate = repairDate ? new Date(repairDate).toISOString() : null;
      const formattedRestorationDate = restorationDate ? new Date(restorationDate).toISOString() : null;

      const formDataToSubmit: Omit<OP5Fault, "id" | "status"> = {
        regionId: regionId || "",
        districtId: districtId || "",
        occurrenceDate: formattedOccurrenceDate,
        repairDate: formattedRepairDate,
        restorationDate: formattedRestorationDate,
        outageType: outageType as FaultType,
        outageSubType: outageSubType || "",
        specificFaultType: specificFaultType || "",
        outageDescription: outageDescription || "",
        faultLocation: faultLocation || "",
        customersAffected: {
          rural: ruralAffected || 0,
          urban: urbanAffected || 0,
          metro: metroAffected || 0
        },
        outageDuration: outageDuration || 0,
        mttr: mttr || 0,
        customerLostHours: customerLostHours || 0,
        reliabilityIndices: reliabilityIndices,
        createdBy: user?.id || 'unknown',
        createdAt: new Date().toISOString()
      };

      await addOP5Fault(formDataToSubmit);
      
      // Show notification for successful fault creation
      const notificationTitle = 'OP5 Fault Created';
      const notificationBody = `New ${outageType} fault created in ${getRegionName(regionId)} - ${getDistrictName(districtId)}`;
      
      // Show both types of notifications
      showServiceWorkerNotification(notificationTitle, {
        body: notificationBody,
        data: { url: window.location.href }
      });
      
      showNotification(notificationTitle, notificationBody);
      
      toast.success("OP5 fault created successfully");
      navigate("/dashboard");
    } catch (error) {
      console.error("Error creating OP5 fault:", error);
      toast.error("Failed to create OP5 fault");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // --- Handlers for Materials --- 
  const handleMaterialTypeChange = (value: string) => {
    setCurrentMaterialType(value);
    setCurrentMaterialDetails({ type: value }); // Reset details when type changes
  };

  const handleMaterialDetailChange = (field: keyof MaterialUsed, value: string | number) => {
    setCurrentMaterialDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleAddMaterial = () => {
    let materialToAdd: MaterialUsed | null = null;
    const id = uuidv4(); // Generate unique ID

    if (!currentMaterialType) {
      toast.error("Please select a material type.");
      return;
    }

    switch (currentMaterialType) {
      case "Fuse":
        if (!currentMaterialDetails.rating || !currentMaterialDetails.quantity || currentMaterialDetails.quantity <= 0) {
          toast.error("Please enter valid fuse rating and quantity (> 0).");
          return;
        }
        materialToAdd = { 
          id,
          type: "Fuse", 
          rating: currentMaterialDetails.rating, 
          quantity: Number(currentMaterialDetails.quantity) 
        };
        break;
      case "Conductor":
        if (!currentMaterialDetails.conductorType || !currentMaterialDetails.length || currentMaterialDetails.length <= 0) {
          toast.error("Please enter valid conductor type and length (> 0).");
          return;
        }
        materialToAdd = { 
          id,
          type: "Conductor", 
          conductorType: currentMaterialDetails.conductorType, 
          length: Number(currentMaterialDetails.length) 
        };
        break;
      case "Others":
        if (!currentMaterialDetails.description || !currentMaterialDetails.quantity || currentMaterialDetails.quantity <= 0) {
          toast.error("Please enter a description and quantity (> 0) for other materials.");
          return;
        }
        materialToAdd = { 
          id,
          type: "Others", 
          description: currentMaterialDetails.description, 
          quantity: Number(currentMaterialDetails.quantity) 
        };
        break;
      default:
        toast.error("Invalid material type selected.");
        return;
    }

    if (materialToAdd) {
      console.log("[handleAddMaterial] Adding material:", materialToAdd);
      setMaterialsUsed(prev => [...prev, materialToAdd!]);
      // Reset inputs
      setCurrentMaterialType("");
      setCurrentMaterialDetails({});
    }
  };

  const handleRemoveMaterial = (idToRemove: string) => {
    console.log("[handleRemoveMaterial] Removing material with ID:", idToRemove);
    setMaterialsUsed(prev => prev.filter(material => material.id !== idToRemove));
  };
  // --- End Handlers for Materials --- 
  
  // Initialize region and district based on user's assigned values
  useEffect(() => {
    if (!user) return;

    console.log("[OP5Form] Initializing with user:", {
      role: user.role,
      districtId: user.districtId,
      regionId: user.regionId
    });

    if (user.role === "district_engineer" || user.role === "regional_engineer" || user.role === "technician") {
      // For district engineers and technicians, find their region through their district
      if ((user.role === "district_engineer" || user.role === "technician") && user.districtId) {
        const userDistrict = districts.find(d => d.id === user.districtId);
        console.log("[OP5Form] Found user district:", userDistrict);
        
        if (userDistrict) {
          setDistrictId(userDistrict.id);
          setRegionId(userDistrict.regionId);
          console.log("[OP5Form] Set district and region:", {
            districtId: userDistrict.id,
            regionId: userDistrict.regionId
          });
          return;
        } else {
          console.error("[OP5Form] Could not find district for user:", user.districtId);
        }
      }
      
      // For regional engineers, find region by name
      if (user.role === "regional_engineer") {
        const userRegion = regions.find(r => r.name === user.region);
        console.log("[OP5Form] Found user region:", userRegion);
        
        if (userRegion) {
          setRegionId(userRegion.id);
          console.log("[OP5Form] Set region:", userRegion.id);
        } else {
          console.error("[OP5Form] Could not find region for user:", user.region);
        }
      }
    }
  }, [user, regions, districts]);
  
  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-2xl font-serif">OP5 Fault Report</CardTitle>
        <CardDescription>
          Report an OP5 fault with detailed information
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
              <Label htmlFor="outageType" className="text-base font-medium">Type of Fault</Label>
              <Select value={outageType} onValueChange={(value) => setOutageType(value as string)}>
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
            
            <div className="space-y-3">
              <Label htmlFor="faultLocation" className="text-base font-medium">Fault Location *</Label>
              <Input
                id="faultLocation"
                value={faultLocation}
                onChange={(e) => setFaultLocation(e.target.value)}
                placeholder="Enter fault location"
                className="h-12 text-base bg-background/50 border-muted"
                required
              />
            </div>
          </div>
          
          <div className="space-y-3">
            <Label htmlFor="outageDescription" className="text-base font-medium">Fault Description</Label>
            <Textarea
              id="outageDescription"
              value={outageDescription}
              onChange={(e) => setOutageDescription(e.target.value)}
              className="h-12 text-base bg-background/50 border-muted"
            />
          </div>

          {/* --- Material Use Section --- */}
          <div className="space-y-4 p-4 border rounded-md bg-background/30">
              <h3 className="text-lg font-semibold border-b pb-2">Materials Used</h3>
              
              {/* Material Input Row */}
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                  {/* Material Type Select */}
                  <div className="space-y-1 flex-1">
                      <Label htmlFor="materialType">Material Type</Label>
                      <Select value={currentMaterialType} onValueChange={handleMaterialTypeChange}>
                          <SelectTrigger className="h-10">
                              <SelectValue placeholder="Select Type" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="Fuse">Fuse</SelectItem>
                              <SelectItem value="Conductor">Conductor</SelectItem>
                              <SelectItem value="Others">Others</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                  
                  {/* Conditional Detail Inputs */} 
                  {currentMaterialType === "Fuse" && (
                      <>
                           <div className="space-y-1 flex-1">
                              <Label htmlFor="fuseRating">Rating</Label>
                              <Input 
                                id="fuseRating" 
                                type="number"
                                min="0"
                                step="1"
                                value={currentMaterialDetails.rating || ""} 
                                onChange={(e) => handleMaterialDetailChange('rating', e.target.value)} 
                                placeholder="e.g., 100" 
                                className="h-10" 
                              />
                           </div>
                           <div className="space-y-1" style={{ flexBasis: '100px'}}> {/* Fixed width for quantity */}
                              <Label htmlFor="fuseQuantity">Quantity</Label>
                              <Input id="fuseQuantity" type="number" value={currentMaterialDetails.quantity || ""} onChange={(e) => handleMaterialDetailChange('quantity', e.target.value)} placeholder="Qty" min="1" className="h-10" />
                           </div>
                      </>
                  )}
                  {currentMaterialType === "Conductor" && (
                       <>
                           <div className="space-y-1 flex-1">
                              <Label htmlFor="conductorType">Conductor Type</Label>
                              <Input id="conductorType" value={currentMaterialDetails.conductorType || ""} onChange={(e) => handleMaterialDetailChange('conductorType', e.target.value)} placeholder="e.g., ACSR 150mm²" className="h-10" />
                           </div>
                           <div className="space-y-1" style={{ flexBasis: '120px'}}>{/* Fixed width */}
                              <Label htmlFor="conductorLength">Length (m)</Label>
                              <Input id="conductorLength" type="number" value={currentMaterialDetails.length || ""} onChange={(e) => handleMaterialDetailChange('length', e.target.value)} placeholder="Length" min="0.1" step="0.1" className="h-10" />
                           </div>
                      </>
                  )}
                   {currentMaterialType === "Others" && (
                       <>
                           <div className="space-y-1 flex-1">
                              <Label htmlFor="otherDescription">Description</Label>
                              <Input id="otherDescription" value={currentMaterialDetails.description || ""} onChange={(e) => handleMaterialDetailChange('description', e.target.value)} placeholder="Material description" className="h-10" />
                           </div>
                           <div className="space-y-1" style={{ flexBasis: '100px'}}> {/* Fixed width */}
                              <Label htmlFor="otherQuantity">Quantity</Label>
                              <Input id="otherQuantity" type="number" value={currentMaterialDetails.quantity || ""} onChange={(e) => handleMaterialDetailChange('quantity', e.target.value)} placeholder="Qty" min="1" className="h-10" />
                           </div>
                      </>
                  )}

                  {/* Add Button (Aligned with inputs) */} 
                   <Button 
                       type="button" 
                       onClick={handleAddMaterial} 
                       disabled={!currentMaterialType}
                       variant="outline"
                       size="icon"
                       className="h-10 w-10 flex-shrink-0"
                       title="Add Material"
                   >
                      <PlusCircle className="h-5 w-5" />
                   </Button>
              </div>

              {/* Display Added Materials */} 
              {materialsUsed.length > 0 && (
                  <div className="mt-4 space-y-2 border-t pt-4">
                      <h4 className="text-sm font-medium text-muted-foreground">Added Materials:</h4>
                      <ul className="list-none space-y-1">
                          {materialsUsed.map((material) => (
                              <li key={material.id} className="flex items-center justify-between bg-muted/30 p-2 rounded text-sm">
                                  <span>
                                      {material.type === "Fuse" && `Fuse: ${material.rating}, Qty: ${material.quantity}`}
                                      {material.type === "Conductor" && `Conductor: ${material.conductorType}, Length: ${material.length}m`}
                                      {material.type === "Others" && `Other: ${material.description}, Qty: ${material.quantity}`}
                                  </span>
                                  <Button 
                                      type="button" 
                                      onClick={() => handleRemoveMaterial(material.id)} 
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                  >
                                      <X className="h-4 w-4 text-destructive" />
                                  </Button>
                              </li>
                          ))}
                      </ul>
                  </div>
              )}
          </div>
          {/* --- End Material Use Section --- */}
          
          <Tabs defaultValue="affected" className="w-full">
            <TabsList className="grid w-full grid-cols-3 gap-1">
              <TabsTrigger value="affected" className="flex items-center gap-1 text-xs sm:text-sm">
                <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Affected</span>
                <span className="sm:hidden">Aff.</span>
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center gap-1 text-xs sm:text-sm">
                <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Details</span>
                <span className="sm:hidden">Det.</span>
              </TabsTrigger>
              <TabsTrigger value="calculations" className="flex items-center gap-1 text-xs sm:text-sm">
                <Calculator className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Calculations</span>
                <span className="sm:hidden">Calc.</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="affected" className="space-y-6 pt-6">
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg border border-muted">
                  <h4 className="font-medium mb-2">Enter Number of Customers Affected by this Outage</h4>
                  <p className="text-sm text-muted-foreground">
                    Please enter the number of customers affected in each population category. 
                    At least one category must have affected customers to proceed.
                  </p>
                </div>
                
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                    <Label htmlFor="ruralControl" className="font-medium flex items-center">
                      Rural Population Affected *
                      <InfoIcon className="h-4 w-4 ml-1 text-muted-foreground" />
                    </Label>
                    <Input
                      id="ruralControl"
                      type="number"
                      min="0"
                      value={ruralAffected === null ? "" : ruralAffected}
                      onChange={(e) => setRuralAffected(e.target.value === "" ? null : parseInt(e.target.value))}
                      className="bg-background/50 border-muted"
                      placeholder="Enter number of affected customers"
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <Label htmlFor="urbanControl" className="font-medium flex items-center">
                      Urban Population Affected *
                    <InfoIcon className="h-4 w-4 ml-1 text-muted-foreground" />
                  </Label>
                  <Input
                      id="urbanControl"
                    type="number"
                    min="0"
                      value={urbanAffected === null ? "" : urbanAffected}
                      onChange={(e) => setUrbanAffected(e.target.value === "" ? null : parseInt(e.target.value))}
                    className="bg-background/50 border-muted"
                      placeholder="Enter number of affected customers"
                  />
                </div>
                
                <div className="space-y-3">
                    <Label htmlFor="metroControl" className="font-medium flex items-center">
                      Metro Population Affected *
                    <InfoIcon className="h-4 w-4 ml-1 text-muted-foreground" />
                  </Label>
                  <Input
                      id="metroControl"
                    type="number"
                    min="0"
                      value={metroAffected === null ? "" : metroAffected}
                      onChange={(e) => setMetroAffected(e.target.value === "" ? null : parseInt(e.target.value))}
                    className="bg-background/50 border-muted"
                      placeholder="Enter number of affected customers"
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  * At least one population type must have affected customers
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="details" className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label htmlFor="occurrenceDate" className="text-base font-medium">Fault Occurrence Date & Time *</Label>
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
                  <Label htmlFor="repairDate" className="text-base font-medium">Repair Start Date & Time *</Label>
                  <Input
                    id="repairDate"
                    type="datetime-local"
                    value={repairDate}
                    onChange={(e) => setRepairDate(e.target.value)}
                    required
                    className="h-12 text-base bg-background/50 border-muted"
                  />
                </div>
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="restorationDate" className="text-base font-medium">Fault Restoration Date & Time</Label>
                <Input
                  id="restorationDate"
                  type="datetime-local"
                  value={restorationDate}
                  onChange={(e) => setRestorationDate(e.target.value)}
                  className="h-12 text-base bg-background/50 border-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty if the fault is still active
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="calculations" className="pt-4 sm:pt-6">
              <div className="space-y-4 sm:space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="outageDuration" className="font-medium text-sm">Outage Duration</Label>
                    <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                      {outageDuration !== null 
                        ? formatDuration(outageDuration)
                        : "Not calculated yet"}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="mttr" className="font-medium text-sm">MTTR (Mean Time To Repair)</Label>
                    <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                      {mttr !== null 
                        ? formatDuration(mttr)
                        : "Not calculated yet"}
                    </div>
                    </div>
                  </div>

                <div className="space-y-2">
                  <Label htmlFor="customerLostHours" className="font-medium text-sm">Customer Lost Hours</Label>
                  <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                      {customerLostHours !== null 
                      ? formatDuration(customerLostHours)
                        : "Not calculated yet"}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <Label className="font-medium text-sm">Reliability Indices</Label>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="font-medium text-sm">Rural Population</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                        <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                      <div className="font-medium">SAIDI</div>
                          <div>{(reliabilityIndices.rural.saidi ?? 0).toFixed(2)}</div>
                        </div>
                        <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                          <div className="font-medium">SAIFI</div>
                          <div>{(reliabilityIndices.rural.saifi ?? 0).toFixed(2)}</div>
                        </div>
                        <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                          <div className="font-medium">CAIDI</div>
                          <div>{(reliabilityIndices.rural.caidi ?? 0).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="font-medium text-sm">Urban Population</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                        <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                          <div className="font-medium">SAIDI</div>
                          <div>{(reliabilityIndices.urban.saidi ?? 0).toFixed(2)}</div>
                        </div>
                        <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                      <div className="font-medium">SAIFI</div>
                          <div>{(reliabilityIndices.urban.saifi ?? 0).toFixed(2)}</div>
                        </div>
                        <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                          <div className="font-medium">CAIDI</div>
                          <div>{(reliabilityIndices.urban.caidi ?? 0).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="font-medium text-sm">Metro Population</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                        <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                          <div className="font-medium">SAIDI</div>
                          <div>{(reliabilityIndices.metro.saidi ?? 0).toFixed(2)}</div>
                        </div>
                        <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                          <div className="font-medium">SAIFI</div>
                          <div>{(reliabilityIndices.metro.saifi ?? 0).toFixed(2)}</div>
                        </div>
                        <div className="bg-muted/50 rounded-md p-2 sm:p-3 text-sm border border-muted">
                      <div className="font-medium">CAIDI</div>
                          <div>{(reliabilityIndices.metro.caidi ?? 0).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          {/* Show specific fault type dropdown when Unplanned or Emergency is selected */}
          {(outageType === "Unplanned" || outageType === "Emergency") && (
            <div className="space-y-3">
              <Label htmlFor="specificFaultType" className="text-base font-medium">Specific Fault Type</Label>
              <Select 
                value={specificFaultType} 
                onValueChange={(value) => setSpecificFaultType(
                  outageType === "Unplanned" 
                    ? value as UnplannedFaultType 
                    : value as EmergencyFaultType
                )}
              >
                <SelectTrigger className="h-12 text-base bg-background/50 border-muted">
                  <SelectValue placeholder="Select specific fault type" />
                </SelectTrigger>
                <SelectContent>
                  {outageType === "Unplanned" ? (
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
            "Submit Fault Report"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
