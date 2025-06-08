import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusCircle, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { toast } from "sonner";
import { FeederLeg, LoadMonitoringData } from "@/lib/asset-types";
import { Region, District } from "@/lib/types"; // Import Region and District types
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useNavigate, useParams } from "react-router-dom";

export default function EditLoadMonitoringPage() {
  const { user } = useAuth();
  const { getLoadMonitoringRecord, updateLoadMonitoringRecord, regions, districts } = useData(); // Get regions & districts
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // State for filtered districts based on selected region
  const [filteredDistricts, setFilteredDistricts] = useState<District[]>([]);

  const [formData, setFormData] = useState<Partial<LoadMonitoringData>>({
    feederLegs: []
  });
  const [isLoading, setIsLoading] = useState(true);

  const [loadInfo, setLoadInfo] = useState<{
    ratedLoad: number;
    redPhaseBulkLoad: number;
    yellowPhaseBulkLoad: number;
    bluePhaseBulkLoad: number;
    averageCurrent: number;
    percentageLoad: number;
    tenPercentFullLoadNeutral: number;
    calculatedNeutral: number;
    neutralWarningLevel: "normal" | "warning" | "critical";
    neutralWarningMessage: string;
    imbalancePercentage: number;
    imbalanceWarningLevel: "normal" | "warning" | "critical";
    imbalanceWarningMessage: string;
    maxPhaseCurrent: number;
    minPhaseCurrent: number;
    avgPhaseCurrent: number;
  }>({
    ratedLoad: 0,
    redPhaseBulkLoad: 0,
    yellowPhaseBulkLoad: 0,
    bluePhaseBulkLoad: 0,
    averageCurrent: 0,
    percentageLoad: 0,
    tenPercentFullLoadNeutral: 0,
    calculatedNeutral: 0,
    neutralWarningLevel: "normal",
    neutralWarningMessage: "",
    imbalancePercentage: 0,
    imbalanceWarningLevel: "normal",
    imbalanceWarningMessage: "",
    maxPhaseCurrent: 0,
    minPhaseCurrent: 0,
    avgPhaseCurrent: 0
  });

  // Fetch existing record data and set initial dropdown state
  useEffect(() => {
    const initializeRecord = async () => {
      if (id && getLoadMonitoringRecord && regions && districts) {
        try {
          const record = await getLoadMonitoringRecord(id);
          if (record) {
            // Find the region and district IDs based on their names
            const existingRegion = regions.find(r => r.name === record.region);
            const existingDistrict = districts.find(d => d.name === record.district && d.regionId === existingRegion?.id);
            
            if (existingRegion) {
              // Set region and filter districts
              setFormData(prev => ({
                ...record,
                regionId: existingRegion.id,
                region: record.region
              }));
              
              // Filter districts for the selected region
              const regionDistricts = districts.filter(d => d.regionId === existingRegion.id);
              setFilteredDistricts(regionDistricts);
              
              // Set district if found
              if (existingDistrict) {
                setFormData(prev => ({
                  ...prev,
                  districtId: existingDistrict.id,
                  district: record.district
                }));
              }
            } else {
              // Region from record not found? Reset both.
              setFormData(prev => ({ ...prev, regionId: "", region: "", districtId: "", district: "" }));
              setFilteredDistricts([]);
            }
          } else {
            toast.error("Load monitoring record not found.");
            navigate("/asset-management/load-monitoring");
          }
        } catch (error) {
          console.error("Error loading record:", error);
          toast.error("Failed to load record. Please try again.");
          navigate("/asset-management/load-monitoring");
        }
        setIsLoading(false);
      } else if (!isLoading && (!regions || !districts)) {
          toast.error("Region/District data not loaded. Cannot edit.");
          navigate("/asset-management/load-monitoring");
          setIsLoading(false);
      } else if (!isLoading && !id) { // Added check for missing ID after loading
          toast.error("Invalid record ID.");
          navigate("/asset-management/load-monitoring");
          setIsLoading(false);
      }
    };

    initializeRecord();
  }, [id, getLoadMonitoringRecord, regions, districts, navigate, isLoading]);

  // --- Form Handling Functions ---
  const addFeederLeg = () => {
    if ((formData.feederLegs?.length || 0) >= 8) {
      toast.warning("Maximum of 8 feeder legs allowed");
      return;
    }
    setFormData(prev => ({
      ...prev,
      feederLegs: [
        ...(prev.feederLegs || []),
        {
          id: uuidv4(),
          redPhaseCurrent: 0,
          yellowPhaseCurrent: 0,
          bluePhaseCurrent: 0,
          neutralCurrent: 0
        }
      ]
    }));
  };

  const removeFeederLeg = (legId: string) => {
    if ((formData.feederLegs?.length || 0) <= 1) {
      toast.warning("At least one feeder leg is required");
      return;
    }
    setFormData(prev => ({
      ...prev,
      feederLegs: prev.feederLegs?.filter(leg => leg.id !== legId) || []
    }));
  };

 const updateFeederLeg = (legId: string, field: keyof FeederLeg, value: string) => {
    const numericValue = value === '' ? 0 : parseFloat(value);
    setFormData(prev => ({
      ...prev,
      feederLegs: prev.feederLegs?.map(leg =>
        leg.id === legId ? { ...leg, [field]: isNaN(numericValue) ? value : numericValue } : leg
      ) || []
    }));
  };

  const handleInputChange = (field: keyof LoadMonitoringData, value: any) => {
    if (field === 'region' || field === 'district') return;
     if (field === 'rating') {
       setFormData(prev => ({
        ...prev,
        [field]: value === '' ? undefined : Number(value)
      }));
    } else {
       setFormData(prev => ({
         ...prev,
         [field]: value
       }));
    }
  };

  // Handle Region Change
  const handleRegionChange = (regionId: string) => {
    const selectedRegion = regions?.find(r => r.id === regionId);
    if (selectedRegion && districts) {
      const regionDistricts = districts.filter(d => d.regionId === regionId);
      setFilteredDistricts(regionDistricts);
      setFormData(prev => ({
        ...prev,
        regionId: regionId,
        region: selectedRegion.name,
        districtId: "",
        district: ""
      }));
    } else {
      setFilteredDistricts([]);
      setFormData(prev => ({ 
        ...prev, 
        regionId: "", 
        region: "", 
        districtId: "", 
        district: "" 
      }));
    }
  };

  // Handle District Change
  const handleDistrictChange = (districtId: string) => {
    const selectedDistrict = districts?.find(d => d.id === districtId);
    if (selectedDistrict) {
      setFormData(prev => ({ 
        ...prev, 
        districtId: districtId,
        district: selectedDistrict.name
      }));
    }
  };

  // --- Load Calculation Logic ---
   useEffect(() => {
    if (isLoading) return;

    const rating = Number(formData.rating);
    const feederLegs = formData.feederLegs || [];

    const areFeederCurrentsValid = feederLegs.every(leg =>
        typeof leg.redPhaseCurrent === 'number' && !isNaN(leg.redPhaseCurrent) &&
        typeof leg.yellowPhaseCurrent === 'number' && !isNaN(leg.yellowPhaseCurrent) &&
        typeof leg.bluePhaseCurrent === 'number' && !isNaN(leg.bluePhaseCurrent) &&
        typeof leg.neutralCurrent === 'number' && !isNaN(leg.neutralCurrent)
    );

    if (isNaN(rating) || rating <= 0 || feederLegs.length === 0 || !areFeederCurrentsValid) {
      setLoadInfo({
        ratedLoad: 0, redPhaseBulkLoad: 0, yellowPhaseBulkLoad: 0, bluePhaseBulkLoad: 0,
        averageCurrent: 0, percentageLoad: 0, tenPercentFullLoadNeutral: 0, calculatedNeutral: 0,
        neutralWarningLevel: "normal",
        neutralWarningMessage: "",
        imbalancePercentage: 0,
        imbalanceWarningLevel: "normal",
        imbalanceWarningMessage: "",
        maxPhaseCurrent: 0,
        minPhaseCurrent: 0,
        avgPhaseCurrent: 0
      });
      return;
    }

    const redPhaseBulkLoad = feederLegs.reduce((sum, leg) => sum + Number(leg.redPhaseCurrent), 0);
    const yellowPhaseBulkLoad = feederLegs.reduce((sum, leg) => sum + Number(leg.yellowPhaseCurrent), 0);
    const bluePhaseBulkLoad = feederLegs.reduce((sum, leg) => sum + Number(leg.bluePhaseCurrent), 0);

    const averageCurrent = (redPhaseBulkLoad + yellowPhaseBulkLoad + bluePhaseBulkLoad) / 3;
    const ratedLoad = rating * 1.334;
    const percentageLoad = ratedLoad > 0 ? (averageCurrent * 100) / ratedLoad : 0;
    const tenPercentFullLoadNeutral = 0.1 * ratedLoad;

    // Standard neutral current calculation for three-phase systems
    console.log("Calculating neutral with standard formula:", {
      redPhaseBulkLoad,
      yellowPhaseBulkLoad,
      bluePhaseBulkLoad
    });
    
    // Standard formula: In = √(IR² + IY² + IB² - IR·IY - IR·IB - IY·IB)
    const calculatedNeutral = Math.sqrt(
      Math.max(0,
        Math.pow(redPhaseBulkLoad, 2) + 
        Math.pow(yellowPhaseBulkLoad, 2) + 
        Math.pow(bluePhaseBulkLoad, 2) - 
        (redPhaseBulkLoad * yellowPhaseBulkLoad) - 
        (redPhaseBulkLoad * bluePhaseBulkLoad) - 
        (yellowPhaseBulkLoad * bluePhaseBulkLoad)
      )
    );
    
    console.log("Calculated neutral result:", calculatedNeutral);

    // Calculate phase imbalance analysis
    const maxPhaseCurrent = Math.max(redPhaseBulkLoad, yellowPhaseBulkLoad, bluePhaseBulkLoad);
    const minPhaseCurrent = Math.max(0, Math.min(redPhaseBulkLoad, yellowPhaseBulkLoad, bluePhaseBulkLoad));
    const avgPhaseCurrent = (redPhaseBulkLoad + yellowPhaseBulkLoad + bluePhaseBulkLoad) / 3;
    const imbalancePercentage = maxPhaseCurrent > 0 ? ((maxPhaseCurrent - minPhaseCurrent) / maxPhaseCurrent) * 100 : 0;
    
    // Determine neutral current warning level
    let neutralWarningLevel: "normal" | "warning" | "critical" = "normal";
    let neutralWarningMessage = "";
    
    if (calculatedNeutral > tenPercentFullLoadNeutral * 2) {
      neutralWarningLevel = "critical";
      neutralWarningMessage = "Critical: Neutral current exceeds 200% of rated neutral";
    } else if (calculatedNeutral > tenPercentFullLoadNeutral) {
      neutralWarningLevel = "warning";
      neutralWarningMessage = "Warning: Neutral current exceeds rated neutral";
    }
    
    // Determine phase imbalance warning level
    let imbalanceWarningLevel: "normal" | "warning" | "critical" = "normal";
    let imbalanceWarningMessage = "";
    
    if (imbalancePercentage > 50) {
      imbalanceWarningLevel = "critical";
      imbalanceWarningMessage = "Critical: Severe phase imbalance detected";
    } else if (imbalancePercentage > 30) {
      imbalanceWarningLevel = "warning";
      imbalanceWarningMessage = "Warning: Significant phase imbalance detected";
    }

    setLoadInfo({
      ratedLoad,
      redPhaseBulkLoad,
      yellowPhaseBulkLoad,
      bluePhaseBulkLoad,
      averageCurrent,
      percentageLoad,
      tenPercentFullLoadNeutral,
      calculatedNeutral: isNaN(calculatedNeutral) ? 0 : calculatedNeutral,
      neutralWarningLevel,
      neutralWarningMessage,
      imbalancePercentage,
      imbalanceWarningLevel,
      imbalanceWarningMessage,
      maxPhaseCurrent,
      minPhaseCurrent,
      avgPhaseCurrent
    });
  }, [formData.rating, formData.feederLegs, isLoading]);


  // --- Form Submission ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!id) {
        toast.error("Record ID is missing. Cannot update.");
        return;
    }

    const invalidFeeder = formData.feederLegs?.find(leg =>
        isNaN(Number(leg.redPhaseCurrent)) || isNaN(Number(leg.yellowPhaseCurrent)) ||
        isNaN(Number(leg.bluePhaseCurrent)) || isNaN(Number(leg.neutralCurrent))
    );

    if (invalidFeeder) {
        toast.error("Please ensure all feeder leg currents are valid numbers.");
        return;
    }

    if (!formData.date || !formData.time || !formData.regionId || !formData.districtId || !formData.substationName || !formData.substationNumber || formData.rating === undefined || formData.rating <= 0 || !formData.feederLegs) {
      toast.error("Please fill all required fields, including a valid rating (KVA > 0).");
      return;
    }

    // Get region and district names from IDs
    const region = regions?.find(r => r.id === formData.regionId);
    const district = districts?.find(d => d.id === formData.districtId);

    if (!region || !district) {
      toast.error("Invalid region or district selected.");
      return;
    }

    const processedFeederLegs = formData.feederLegs.map(leg => ({
        ...leg,
        redPhaseCurrent: Number(leg.redPhaseCurrent),
        yellowPhaseCurrent: Number(leg.yellowPhaseCurrent),
        bluePhaseCurrent: Number(leg.bluePhaseCurrent),
        neutralCurrent: Number(leg.neutralCurrent),
    }));

    const completeData: LoadMonitoringData = {
      id: id,
      date: formData.date,
      time: formData.time,
      regionId: formData.regionId,
      districtId: formData.districtId,
      region: region.name,
      district: district.name,
      substationName: formData.substationName,
      substationNumber: formData.substationNumber,
      location: formData.location || "",
      rating: formData.rating,
      peakLoadStatus: formData.peakLoadStatus || "day",
      feederLegs: processedFeederLegs,
      ratedLoad: loadInfo.ratedLoad,
      redPhaseBulkLoad: loadInfo.redPhaseBulkLoad,
      yellowPhaseBulkLoad: loadInfo.yellowPhaseBulkLoad,
      bluePhaseBulkLoad: loadInfo.bluePhaseBulkLoad,
      averageCurrent: loadInfo.averageCurrent,
      percentageLoad: loadInfo.percentageLoad,
      tenPercentFullLoadNeutral: loadInfo.tenPercentFullLoadNeutral,
      calculatedNeutral: loadInfo.calculatedNeutral,
      neutralWarningLevel: loadInfo.neutralWarningLevel,
      neutralWarningMessage: loadInfo.neutralWarningMessage,
      imbalancePercentage: loadInfo.imbalancePercentage,
      imbalanceWarningLevel: loadInfo.imbalanceWarningLevel,
      imbalanceWarningMessage: loadInfo.imbalanceWarningMessage,
      maxPhaseCurrent: loadInfo.maxPhaseCurrent,
      minPhaseCurrent: loadInfo.minPhaseCurrent,
      avgPhaseCurrent: loadInfo.avgPhaseCurrent,
      createdBy: formData.createdBy || {
        id: user?.id || '',
        name: user?.name || 'Unknown'
      }
    };

    if (updateLoadMonitoringRecord) {
      updateLoadMonitoringRecord(id, completeData);
      navigate("/asset-management/load-monitoring");
    } else {
      toast.error("Failed to update data. Context function not available.");
    }
  };

  if (isLoading) {
      return <Layout><div>Loading record...</div></Layout>;
  }

 return ( // Ensure component returns JSX
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Edit Load Record</h1>
          <p className="text-muted-foreground mt-2">
            Update the details for this transformer load record.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:gap-6">
            {/* Basic Information Card */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Record when and where the load monitoring is taking place
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                   <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date || ''}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={formData.time || ''}
                      onChange={(e) => handleInputChange('time', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <Select
                      value={formData.regionId || ""}
                      onValueChange={handleRegionChange}
                      required
                      disabled={user?.role === "district_engineer" || user?.role === "district_manager" || user?.role === "regional_engineer" || user?.role === "regional_general_manager" || user?.role === "technician"}
                    >
                      <SelectTrigger id="region">
                        <SelectValue placeholder="Select Region" />
                      </SelectTrigger>
                      <SelectContent>
                        {regions?.map((region) => (
                          <SelectItem key={region.id} value={region.id}>
                            {region.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="district">District</Label>
                    <Select
                      value={formData.districtId || ""}
                      onValueChange={handleDistrictChange}
                      required
                      disabled={user?.role === "district_engineer" || user?.role === "district_manager" || user?.role === "technician" || !formData.regionId || filteredDistricts.length === 0}
                    >
                      <SelectTrigger id="district" className={user?.role === "district_engineer" || user?.role === "district_manager" ? "bg-muted" : ""}>
                        <SelectValue placeholder="Select District" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredDistricts.map((district) => (
                          <SelectItem key={district.id} value={district.id}>
                            {district.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="substationName">Substation Name</Label>
                    <Input
                      id="substationName"
                      type="text"
                      value={formData.substationName || ''}
                      onChange={(e) => handleInputChange('substationName', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="substationNumber">Substation Number</Label>
                    <Input
                      id="substationNumber"
                      type="text"
                      value={formData.substationNumber || ''}
                      onChange={(e) => handleInputChange('substationNumber', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      type="text"
                      value={formData.location || ''}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rating">Rating (KVA)</Label>
                    <Input
                      id="rating"
                      type="number"
                      value={formData.rating ?? ''}
                      onChange={(e) => handleInputChange('rating', e.target.value)}
                      min="0"
                      placeholder="Enter KVA rating"
                      required
                    />
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="peakLoadStatus">Peak Load Status</Label>
                    <Select
                      value={formData.peakLoadStatus || 'day'}
                      onValueChange={(value) => handleInputChange('peakLoadStatus', value as 'day' | 'night')}
                    >
                      <SelectTrigger id="peakLoadStatus">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Day Peak</SelectItem>
                        <SelectItem value="night">Night Peak</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feeder Legs Card */}
             <Card>
              <CardHeader>
                <CardTitle>Feeder Legs Current (Amps)</CardTitle>
                <CardDescription>Enter current readings for each feeder leg. Maximum 8 legs.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {formData.feederLegs?.map((leg, index) => (
                    <div key={leg.id} className="grid grid-cols-5 gap-4 items-center border p-4 rounded-md">
                      <Label className="col-span-5 font-medium">Feeder Leg {index + 1}</Label>
                      <div className="space-y-1">
                        <Label htmlFor={`red-${leg.id}`}>Red Phase</Label>
                        <Input
                          id={`red-${leg.id}`}
                          type="number"
                          value={leg.redPhaseCurrent ?? ''} // Handle potential non-number value during typing
                          onChange={(e) => updateFeederLeg(leg.id, 'redPhaseCurrent', e.target.value)}
                          placeholder="Amps"
                          min="0"
                          step="any"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`yellow-${leg.id}`}>Yellow Phase</Label>
                        <Input
                          id={`yellow-${leg.id}`}
                          type="number"
                           value={leg.yellowPhaseCurrent ?? ''}
                          onChange={(e) => updateFeederLeg(leg.id, 'yellowPhaseCurrent', e.target.value)}
                          placeholder="Amps"
                          min="0"
                          step="any"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`blue-${leg.id}`}>Blue Phase</Label>
                        <Input
                          id={`blue-${leg.id}`}
                          type="number"
                           value={leg.bluePhaseCurrent ?? ''}
                          onChange={(e) => updateFeederLeg(leg.id, 'bluePhaseCurrent', e.target.value)}
                          placeholder="Amps"
                          min="0"
                          step="any"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`neutral-${leg.id}`}>Neutral</Label>
                        <Input
                          id={`neutral-${leg.id}`}
                          type="number"
                          value={leg.neutralCurrent ?? ''}
                          onChange={(e) => updateFeederLeg(leg.id, 'neutralCurrent', e.target.value)}
                          placeholder="Amps"
                          min="0"
                          step="any"
                          required
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFeederLeg(leg.id)}
                        disabled={(formData.feederLegs?.length || 0) <= 1}
                        className="justify-self-end"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addFeederLeg}
                  className="mt-4"
                  disabled={(formData.feederLegs?.length || 0) >= 8}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Feeder Leg
                </Button>
              </CardContent>
            </Card>

            {/* Calculated Load Information Card */}
            <Card>
              <CardHeader>
                <CardTitle>Calculated Load Information</CardTitle>
                <CardDescription>Automatically calculated based on your inputs.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">Rated Load (A)</Label>
                  <p className="text-lg font-semibold">{loadInfo.ratedLoad.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">Avg. Current (A)</Label>
                  <p className="text-lg font-semibold">{loadInfo.averageCurrent.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">% Load</Label>
                  <p className="text-lg font-semibold">{loadInfo.percentageLoad.toFixed(2)} %</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">Calculated Neutral (A)</Label>
                  <p className={`text-lg font-semibold ${
                    loadInfo.neutralWarningLevel === "critical" ? "text-red-500" : 
                    loadInfo.neutralWarningLevel === "warning" ? "text-yellow-500" : ""
                  }`}>
                    {loadInfo.calculatedNeutral.toFixed(2)}
                  </p>
                  {loadInfo.neutralWarningMessage && (
                    <p className={`text-sm ${
                      loadInfo.neutralWarningLevel === "critical" ? "text-red-500" : "text-yellow-500"
                    }`}>
                      {loadInfo.neutralWarningMessage}
                    </p>
                  )}
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">10% Rated Neutral (A)</Label>
                  <p className="text-lg font-semibold">{loadInfo.tenPercentFullLoadNeutral.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">Phase Imbalance (%)</Label>
                  <p className={`text-lg font-semibold ${
                    loadInfo.imbalanceWarningLevel === "critical" ? "text-red-500" : 
                    loadInfo.imbalanceWarningLevel === "warning" ? "text-yellow-500" : ""
                  }`}>
                    {loadInfo.imbalancePercentage.toFixed(2)}%
                  </p>
                  {loadInfo.imbalanceWarningMessage && (
                    <p className={`text-sm ${
                      loadInfo.imbalanceWarningLevel === "critical" ? "text-red-500" : "text-yellow-500"
                    }`}>
                      {loadInfo.imbalanceWarningMessage}
                    </p>
                  )}
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">Max Phase Current (A)</Label>
                  <p className="text-lg font-semibold">{loadInfo.maxPhaseCurrent.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">Min Phase Current (A)</Label>
                  <p className="text-lg font-semibold">{loadInfo.minPhaseCurrent.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">Avg Phase Current (A)</Label>
                  <p className="text-lg font-semibold">{loadInfo.avgPhaseCurrent.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>

            {/* Submit/Cancel Buttons */}
            <div className="flex justify-end gap-4 mt-2">
                <Button type="button" variant="outline" onClick={() => navigate("/asset-management/load-monitoring")}>
                    Cancel
                </Button>
                <Button type="submit">
                    Update Record
                </Button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
} // Added closing brace
