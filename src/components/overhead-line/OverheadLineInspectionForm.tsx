import { useState, useEffect, useMemo, useCallback } from "react";
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
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/sonner";
import { Loader2, MapPin } from "lucide-react";
import { OverheadLineInspection, ConditionStatus } from "@/lib/types";
import { getRegions, getDistricts } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { showNotification, showServiceWorkerNotification } from '@/utils/notifications';
import { serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

interface OverheadLineInspectionFormProps {
  inspection?: OverheadLineInspection | null;
  onSubmit: (inspection: OverheadLineInspection) => void;
  onCancel: () => void;
}

export function OverheadLineInspectionForm({ inspection, onSubmit, onCancel }: OverheadLineInspectionFormProps) {
  const { regions, districts } = useData();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const navigate = useNavigate();
  const { addOverheadLineInspection, updateOverheadLineInspection } = useData();

  const defaultInsulatorCondition = {
    brokenOrCracked: false,
    burntOrFlashOver: false,
    shattered: false,
    defectiveBinding: false,
    notes: ""
  };

  const [formData, setFormData] = useState<OverheadLineInspection>(() => {
    const defaultFormData: OverheadLineInspection = {
      id: "",
      region: "",
      district: "",
      feederName: "",
      voltageLevel: "",
      referencePole: "",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      latitude: 0,
      longitude: 0,
      items: [],
      inspector: {
        id: user?.id || "",
        name: user?.name || "",
        email: user?.email || ""
      },
      poleId: "",
      poleHeight: "8m",
      poleType: "CP",
      poleLocation: "",
      poleCondition: {
        tilted: false,
        rotten: false,
        burnt: false,
        substandard: false,
        conflictWithLV: false,
        notes: ""
      },
      stayCondition: {
        requiredButNotAvailable: false,
        cut: false,
        misaligned: false,
        defectiveStay: false,
        notes: ""
      },
      crossArmCondition: {
        misaligned: false,
        bend: false,
        corroded: false,
        substandard: false,
        others: false,
        notes: ""
      },
      insulatorCondition: defaultInsulatorCondition,
      conductorCondition: {
        looseConnectors: false,
        weakJumpers: false,
        burntLugs: false,
        saggedLine: false,
        undersized: false,
        linked: false,
        notes: ""
      },
      lightningArresterCondition: {
        brokenOrCracked: false,
        flashOver: false,
        missing: false,
        noEarthing: false,
        bypassed: false,
        noArrester: false,
        notes: ""
      },
      dropOutFuseCondition: {
        brokenOrCracked: false,
        flashOver: false,
        insufficientClearance: false,
        looseOrNoEarthing: false,
        corroded: false,
        linkedHVFuses: false,
        others: false,
        notes: ""
      },
      transformerCondition: {
        leakingOil: false,
        missingEarthLeads: false,
        linkedHVFuses: false,
        rustedTank: false,
        crackedBushing: false,
        others: false,
        notes: ""
      },
      recloserCondition: {
        lowGasLevel: false,
        lowBatteryLevel: false,
        burntVoltageTransformers: false,
        protectionDisabled: false,
        bypassed: false,
        others: false,
        notes: ""
      },
      additionalNotes: "",
      images: [],
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5)
    };

    // Set region and district based on user role
    if (user) {
      if ((user.role === "district_engineer" || user.role === "technician") && user.region && user.district) {
        defaultFormData.region = user.region;
        defaultFormData.district = user.district;
      } else if (user.role === "regional_engineer" && user.region) {
        defaultFormData.region = user.region;
      } else if (user.role === "system_admin" && regions.length > 0) {
      defaultFormData.region = regions[0].name;
      if (districts.length > 0) {
        defaultFormData.district = districts[0].name;
        }
      }
    }

    if (inspection) {
      return {
        ...defaultFormData,
        ...inspection,
        date: inspection.date ? inspection.date.split('T')[0] : new Date().toISOString().split('T')[0],
        time: inspection.time,
        status: inspection.status || "pending"
      };
    }

    return defaultFormData;
  });

  // Filter regions and districts based on user role
  const filteredRegions = useMemo(() => {
    if (!user) return [];
    if (user.role === "global_engineer" || user.role === "system_admin") return regions;
    if (user.role === "regional_engineer" && user.region) {
      return regions.filter(r => r.name === user.region);
    }
    if ((user.role === "district_engineer" || user.role === "technician") && user.region) {
      return regions.filter(r => r.name === user.region);
    }
    return [];
  }, [regions, user]);

  const filteredDistricts = useMemo(() => {
    if (!user || !formData.region) return [];
    const region = regions.find(r => r.name === formData.region);
    if (!region) return [];

    if (user.role === "global_engineer" || user.role === "system_admin") {
      return districts.filter(d => d.regionId === region.id);
    }
    if (user.role === "regional_engineer") {
      return districts.filter(d => d.regionId === region.id);
    }
    if ((user.role === "district_engineer" || user.role === "technician") && user.district) {
      return districts.filter(d => d.name === user.district && d.regionId === region.id);
    }
    return [];
  }, [districts, formData.region, user, regions]);

  // Handle region change
  const handleRegionChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      region: value,
      district: "" // Reset district when region changes
    }));
  };

  // Handle district change
  const handleDistrictChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      district: value
    }));
  };

  // Show loading state while auth is being checked
  if (loading) {
    return <div>Loading...</div>;
  }

  // Update form data when user or regions/districts change
  useEffect(() => {
    if (user && !inspection) {
      if ((user.role === "district_engineer" || user.role === "technician") && user.region && user.district) {
      setFormData(prev => ({
        ...prev,
          region: user.region,
          district: user.district,
        inspector: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      }));
      } else if (user.role === "regional_engineer" && user.region) {
        setFormData(prev => ({
          ...prev,
          region: user.region,
          inspector: {
            id: user.id,
            name: user.name,
            email: user.email
          }
        }));
      }
    }
  }, [user, inspection]);

  // Update form data when inspection prop changes
  useEffect(() => {
    if (inspection) {
      setFormData(currentData => ({
        ...currentData,
        ...inspection,
        date: inspection.date ? inspection.date.split('T')[0] : new Date().toISOString().split('T')[0],
        time: inspection.time,
        status: inspection.status || "pending"
      }));
    }
  }, [inspection]);

  // Memoize handlers
  const handleGetLocation = useCallback(() => {
    setIsGettingLocation(true);
    
    if (!navigator.geolocation) {
      setIsGettingLocation(false);
      toast({
        title: "Error",
        description: "Geolocation is not supported by your browser",
        variant: "destructive",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setFormData(prev => ({ ...prev, latitude, longitude }));
        setIsGettingLocation(false);
        toast({
          title: "Success",
          description: "Location obtained successfully!",
        });
      },
      (error) => {
        setIsGettingLocation(false);
        toast({
          title: "Error",
          description: "Could not get your location. Please try again or enter coordinates manually.",
          variant: "destructive",
        });
      }
    );
  }, [toast]);

  const handleStatusChange = (status: "pending" | "in-progress" | "completed" | "rejected") => {
    setFormData(currentData => ({
      ...currentData,
      status
    }));

    // Show notification for status change
    const notificationTitle = 'Inspection Status Updated';
    const notificationBody = `Status changed to ${status}`;
    showNotification(notificationTitle, { body: notificationBody });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const cleanValue = (value: any): any => {
        if (value === null || value === undefined || value === "") return undefined;
        if (typeof value === "object" && Object.keys(value).length === 0) return undefined;
        return value;
      };

      const cleanData = {
        ...formData,
        date: formData.date || new Date().toISOString().split('T')[0],
        time: formData.time || new Date().toTimeString().slice(0, 5),
        updatedAt: new Date().toISOString()
      };

      const finalData = Object.fromEntries(
        Object.entries(cleanData)
          .map(([key, value]) => [key, cleanValue(value)])
          .filter(([_, value]) => value !== undefined)
      ) as OverheadLineInspection;

      if (inspection) {
        try {
          await updateOverheadLineInspection(inspection.id, finalData);
          toast({ title: "Success", description: "Inspection updated successfully" });
        } catch (error) {
          if (error instanceof Error && error.message.includes("not found")) {
            // If the inspection was not found, create a new one instead
            const { id, ...dataWithoutId } = finalData;
            await addOverheadLineInspection(dataWithoutId);
            toast({ 
              title: "Success", 
              description: "Inspection was not found and has been recreated" 
            });
          } else {
            throw error;
          }
        }
      } else {
        const { id, ...dataWithoutId } = finalData;
        await addOverheadLineInspection(dataWithoutId);
        toast({ title: "Success", description: "Inspection created successfully" });
      }
      
      setIsSubmitting(false);
      onCancel();
    } catch (error) {
      console.error("Error saving inspection:", error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to save inspection",
        variant: "destructive"
      });
      setIsSubmitting(false);
    }
  };

  // Load regions only once on mount
  useEffect(() => {
    async function loadRegions() {
      try {
        const regions = await getRegions();
        if (regions.length > 0 && !formData.region) {
          setFormData(prev => ({ ...prev, region: regions[0].name }));
        }
      } catch (error) {
        toast({
          title: "Error loading regions",
          description: "Failed to load regions. Please try again.",
          variant: "destructive",
        });
      }
    }
    loadRegions();
  }, [toast]);

  // Load districts when region changes
  useEffect(() => {
    async function loadDistricts() {
      if (!formData.region) return;
      try {
        const districts = await getDistricts(regions.find(r => r.name === formData.region)?.id);
        if (districts.length > 0 && !formData.district) {
          setFormData(prev => ({ ...prev, district: districts[0].name }));
        }
      } catch (error) {
        toast({
          title: "Error loading districts",
          description: "Failed to load districts. Please try again.",
          variant: "destructive",
        });
      }
    }
    loadDistricts();
  }, [formData.region, toast]);

  // Memoize form sections
  const renderInspectorInfo = useMemo(() => (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Inspector Name</Label>
            <p className="text-sm">{formData.inspector.name}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Inspector Email</Label>
            <p className="text-sm">{formData.inspector.email}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  const renderBasicInformation = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">Region *</Label>
            <Select
              value={formData.region}
              onValueChange={handleRegionChange}
              disabled={user?.role === "district_engineer" || user?.role === "regional_engineer" || user?.role === "technician"}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                {filteredRegions.map((region) => (
                  <SelectItem key={region.id} value={region.name}>
                    {region.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="district">District *</Label>
            <Select
              value={formData.district}
              onValueChange={handleDistrictChange}
              disabled={user?.role === "district_engineer" || user?.role === "technician" || !formData.region}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select district" />
              </SelectTrigger>
              <SelectContent>
                {filteredDistricts.map((district) => (
                  <SelectItem key={district.id} value={district.name}>
                    {district.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feederName">Feeder Name *</Label>
            <Input
              id="feederName"
              value={formData.feederName}
              onChange={(e) => setFormData({ ...formData, feederName: e.target.value })}
              placeholder="Enter feeder name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="voltageLevel">Voltage Level *</Label>
            <Input
              id="voltageLevel"
              value={formData.voltageLevel}
              onChange={(e) => setFormData({ ...formData, voltageLevel: e.target.value })}
              placeholder="Enter voltage level"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="referencePole">Reference Pole *</Label>
            <Input
              id="referencePole"
              value={formData.referencePole}
              onChange={(e) => setFormData({ ...formData, referencePole: e.target.value })}
              placeholder="Enter reference pole"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={formData.date || new Date().toISOString().split('T')[0]}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Time *</Label>
            <Input
              id="time"
              type="time"
              value={formData.time || new Date().toTimeString().slice(0, 5)}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Latitude"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
              />
              <Input
                type="number"
                placeholder="Longitude"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleGetLocation}
                disabled={isGettingLocation}
              >
                {isGettingLocation ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData, filteredRegions, filteredDistricts, handleGetLocation, isGettingLocation]);

  // Add pole information section
  const renderPoleInformation = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Pole Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="poleId">Pole ID / No. (Range)</Label>
            <Input
              id="poleId"
              value={formData.poleId}
              onChange={(e) => setFormData({ ...formData, poleId: e.target.value })}
              placeholder="Enter pole ID"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="poleHeight">Pole Height</Label>
            <Select
              value={formData.poleHeight}
              onValueChange={(value) => setFormData({ ...formData, poleHeight: value as any })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select pole height" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8m">8m</SelectItem>
                <SelectItem value="9m">9m</SelectItem>
                <SelectItem value="10m">10m</SelectItem>
                <SelectItem value="11m">11m</SelectItem>
                <SelectItem value="14m">14m</SelectItem>
                <SelectItem value="others">Others</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="poleType">Pole Type</Label>
            <Select
              value={formData.poleType}
              onValueChange={(value) => setFormData({ ...formData, poleType: value as any })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select pole type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CP">CP - Concrete</SelectItem>
                <SelectItem value="WP">WP - Wood</SelectItem>
                <SelectItem value="SP">SP - Steel Tubular</SelectItem>
                <SelectItem value="ST">ST - Steel Tower</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="poleLocation">Pole Location</Label>
            <Input
              id="poleLocation"
              value={formData.poleLocation}
              onChange={(e) => setFormData({ ...formData, poleLocation: e.target.value })}
              placeholder="Enter pole location"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Update pole condition section
  const renderPoleCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Pole Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="poleTilted"
              checked={formData.poleCondition.tilted}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  poleCondition: { ...formData.poleCondition, tilted: checked as boolean },
                })
              }
            />
            <Label htmlFor="poleTilted">Tilted</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="poleRotten"
              checked={formData.poleCondition.rotten}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  poleCondition: { ...formData.poleCondition, rotten: checked as boolean },
                })
              }
            />
            <Label htmlFor="poleRotten">Rotten</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="poleBurnt"
              checked={formData.poleCondition.burnt}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  poleCondition: { ...formData.poleCondition, burnt: checked as boolean },
                })
              }
            />
            <Label htmlFor="poleBurnt">Burnt</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="poleSubstandard"
              checked={formData.poleCondition.substandard}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  poleCondition: { ...formData.poleCondition, substandard: checked as boolean },
                })
              }
            />
            <Label htmlFor="poleSubstandard">Substandard</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="poleConflictWithLV"
              checked={formData.poleCondition.conflictWithLV}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  poleCondition: { ...formData.poleCondition, conflictWithLV: checked as boolean },
                })
              }
            />
            <Label htmlFor="poleConflictWithLV">Conflict with LV</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="poleNotes">Notes</Label>
            <Textarea
              id="poleNotes"
              value={formData.poleCondition.notes}
              onChange={(e) => setFormData({ ...formData, poleCondition: { ...formData.poleCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Update stay condition section
  const renderStayCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Stay Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="stayRequiredButNotAvailable"
              checked={formData.stayCondition.requiredButNotAvailable}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  stayCondition: { ...formData.stayCondition, requiredButNotAvailable: checked as boolean },
                })
              }
            />
            <Label htmlFor="stayRequiredButNotAvailable">Required but not available</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="stayCut"
              checked={formData.stayCondition.cut}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  stayCondition: { ...formData.stayCondition, cut: checked as boolean },
                })
              }
            />
            <Label htmlFor="stayCut">Cut</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="stayMisaligned"
              checked={formData.stayCondition.misaligned}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  stayCondition: { ...formData.stayCondition, misaligned: checked as boolean },
                })
              }
            />
            <Label htmlFor="stayMisaligned">Misaligned</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="stayDefectiveStay"
              checked={formData.stayCondition.defectiveStay}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  stayCondition: { ...formData.stayCondition, defectiveStay: checked as boolean },
                })
              }
            />
            <Label htmlFor="stayDefectiveStay">Defective Stay (Spread)</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="stayNotes">Notes</Label>
            <Textarea
              id="stayNotes"
              value={formData.stayCondition.notes}
              onChange={(e) => setFormData({ ...formData, stayCondition: { ...formData.stayCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add cross arm condition section
  const renderCrossArmCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Cross Arm Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="crossArmMisaligned"
              checked={formData.crossArmCondition.misaligned}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  crossArmCondition: { ...formData.crossArmCondition, misaligned: checked as boolean },
                })
              }
            />
            <Label htmlFor="crossArmMisaligned">Misaligned</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="crossArmBend"
              checked={formData.crossArmCondition.bend}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  crossArmCondition: { ...formData.crossArmCondition, bend: checked as boolean },
                })
              }
            />
            <Label htmlFor="crossArmBend">Bend</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="crossArmCorroded"
              checked={formData.crossArmCondition.corroded}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  crossArmCondition: { ...formData.crossArmCondition, corroded: checked as boolean },
                })
              }
            />
            <Label htmlFor="crossArmCorroded">Corroded</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="crossArmSubstandard"
              checked={formData.crossArmCondition.substandard}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  crossArmCondition: { ...formData.crossArmCondition, substandard: checked as boolean },
                })
              }
            />
            <Label htmlFor="crossArmSubstandard">Substandard</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="crossArmOthers"
              checked={formData.crossArmCondition.others}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  crossArmCondition: { ...formData.crossArmCondition, others: checked as boolean },
                })
              }
            />
            <Label htmlFor="crossArmOthers">Others</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="crossArmNotes">Notes</Label>
            <Textarea
              id="crossArmNotes"
              value={formData.crossArmCondition.notes}
              onChange={(e) => setFormData({ ...formData, crossArmCondition: { ...formData.crossArmCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add insulator condition section
  const renderInsulatorCondition = useMemo(() => {
    return (
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Insulator Condition</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="insulatorBrokenOrCracked"
                checked={formData.insulatorCondition.brokenOrCracked}
                onCheckedChange={(checked) => 
                  setFormData({
                    ...formData,
                    insulatorCondition: { ...formData.insulatorCondition, brokenOrCracked: checked as boolean },
                  })
                }
              />
              <Label htmlFor="insulatorBrokenOrCracked">Broken/Cracked</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="insulatorBurntOrFlashOver"
                checked={formData.insulatorCondition.burntOrFlashOver}
                onCheckedChange={(checked) => 
                  setFormData({
                    ...formData,
                    insulatorCondition: { ...formData.insulatorCondition, burntOrFlashOver: checked as boolean },
                  })
                }
              />
              <Label htmlFor="insulatorBurntOrFlashOver">Burnt/Flash over</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="insulatorShattered"
                checked={formData.insulatorCondition.shattered}
                onCheckedChange={(checked) => 
                  setFormData({
                    ...formData,
                    insulatorCondition: { ...formData.insulatorCondition, shattered: checked as boolean },
                  })
                }
              />
              <Label htmlFor="insulatorShattered">Shattered</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="insulatorDefectiveBinding"
                checked={formData.insulatorCondition.defectiveBinding}
                onCheckedChange={(checked) => 
                  setFormData({
                    ...formData,
                    insulatorCondition: { ...formData.insulatorCondition, defectiveBinding: checked as boolean },
                  })
                }
              />
              <Label htmlFor="insulatorDefectiveBinding">Defective Binding</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="insulatorNotes">Notes</Label>
              <Textarea
                id="insulatorNotes"
                value={formData.insulatorCondition.notes}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  insulatorCondition: { ...formData.insulatorCondition, notes: e.target.value } 
                })}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }, [formData]);

  // Add conductor condition section
  const renderConductorCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Conductor Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="conductorLooseConnectors"
              checked={formData.conductorCondition.looseConnectors}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  conductorCondition: { ...formData.conductorCondition, looseConnectors: checked as boolean },
                })
              }
            />
            <Label htmlFor="conductorLooseConnectors">Loose Connectors</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="conductorWeakJumpers"
              checked={formData.conductorCondition.weakJumpers}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  conductorCondition: { ...formData.conductorCondition, weakJumpers: checked as boolean },
                })
              }
            />
            <Label htmlFor="conductorWeakJumpers">Weak Jumpers</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="conductorBurntLugs"
              checked={formData.conductorCondition.burntLugs}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  conductorCondition: { ...formData.conductorCondition, burntLugs: checked as boolean },
                })
              }
            />
            <Label htmlFor="conductorBurntLugs">Burnt Lugs</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="conductorSaggedLine"
              checked={formData.conductorCondition.saggedLine}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  conductorCondition: { ...formData.conductorCondition, saggedLine: checked as boolean },
                })
              }
            />
            <Label htmlFor="conductorSaggedLine">Sagged Line</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="conductorUndersized"
              checked={formData.conductorCondition.undersized}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  conductorCondition: { ...formData.conductorCondition, undersized: checked as boolean },
                })
              }
            />
            <Label htmlFor="conductorUndersized">Undersized</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="conductorLinked"
              checked={formData.conductorCondition.linked}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  conductorCondition: { ...formData.conductorCondition, linked: checked as boolean },
                })
              }
            />
            <Label htmlFor="conductorLinked">Linked</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="conductorNotes">Notes</Label>
            <Textarea
              id="conductorNotes"
              value={formData.conductorCondition.notes}
              onChange={(e) => setFormData({ ...formData, conductorCondition: { ...formData.conductorCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add lightning arrester condition section
  const renderLightningArresterCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Lightning Arrester Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="arresterBrokenOrCracked"
              checked={formData.lightningArresterCondition.brokenOrCracked}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  lightningArresterCondition: { ...formData.lightningArresterCondition, brokenOrCracked: checked as boolean },
                })
              }
            />
            <Label htmlFor="arresterBrokenOrCracked">Broken/Cracked</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="arresterFlashOver"
              checked={formData.lightningArresterCondition.flashOver}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  lightningArresterCondition: { ...formData.lightningArresterCondition, flashOver: checked as boolean },
                })
              }
            />
            <Label htmlFor="arresterFlashOver">Flash over</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="arresterMissing"
              checked={formData.lightningArresterCondition.missing}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  lightningArresterCondition: { ...formData.lightningArresterCondition, missing: checked as boolean },
                })
              }
            />
            <Label htmlFor="arresterMissing">Missing</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="arresterNoEarthing"
              checked={formData.lightningArresterCondition.noEarthing}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  lightningArresterCondition: { ...formData.lightningArresterCondition, noEarthing: checked as boolean },
                })
              }
            />
            <Label htmlFor="arresterNoEarthing">No Earthing</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="arresterBypassed"
              checked={formData.lightningArresterCondition.bypassed}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  lightningArresterCondition: { ...formData.lightningArresterCondition, bypassed: checked as boolean },
                })
              }
            />
            <Label htmlFor="arresterBypassed">By-passed</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="arresterNoArrester"
              checked={formData.lightningArresterCondition.noArrester}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  lightningArresterCondition: { ...formData.lightningArresterCondition, noArrester: checked as boolean },
                })
              }
            />
            <Label htmlFor="arresterNoArrester">No Arrester</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="arresterNotes">Notes</Label>
            <Textarea
              id="arresterNotes"
              value={formData.lightningArresterCondition.notes}
              onChange={(e) => setFormData({ ...formData, lightningArresterCondition: { ...formData.lightningArresterCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add drop out fuse condition section
  const renderDropOutFuseCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Drop Out Fuse/Isolator Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuseBrokenOrCracked"
              checked={formData.dropOutFuseCondition.brokenOrCracked}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  dropOutFuseCondition: { ...formData.dropOutFuseCondition, brokenOrCracked: checked as boolean },
                })
              }
            />
            <Label htmlFor="fuseBrokenOrCracked">Broken/Cracked</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuseFlashOver"
              checked={formData.dropOutFuseCondition.flashOver}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  dropOutFuseCondition: { ...formData.dropOutFuseCondition, flashOver: checked as boolean },
                })
              }
            />
            <Label htmlFor="fuseFlashOver">Flash over</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuseInsufficientClearance"
              checked={formData.dropOutFuseCondition.insufficientClearance}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  dropOutFuseCondition: { ...formData.dropOutFuseCondition, insufficientClearance: checked as boolean },
                })
              }
            />
            <Label htmlFor="fuseInsufficientClearance">Insufficient Clearance</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuseLooseOrNoEarthing"
              checked={formData.dropOutFuseCondition.looseOrNoEarthing}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  dropOutFuseCondition: { ...formData.dropOutFuseCondition, looseOrNoEarthing: checked as boolean },
                })
              }
            />
            <Label htmlFor="fuseLooseOrNoEarthing">Loose or No Earthing</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuseCorroded"
              checked={formData.dropOutFuseCondition.corroded}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  dropOutFuseCondition: { ...formData.dropOutFuseCondition, corroded: checked as boolean },
                })
              }
            />
            <Label htmlFor="fuseCorroded">Corroded</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuseLinkedHVFuses"
              checked={formData.dropOutFuseCondition.linkedHVFuses}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  dropOutFuseCondition: { ...formData.dropOutFuseCondition, linkedHVFuses: checked as boolean },
                })
              }
            />
            <Label htmlFor="fuseLinkedHVFuses">Linked HV Fuses</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuseOthers"
              checked={formData.dropOutFuseCondition.others}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  dropOutFuseCondition: { ...formData.dropOutFuseCondition, others: checked as boolean },
                })
              }
            />
            <Label htmlFor="fuseOthers">Others</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fuseNotes">Notes</Label>
            <Textarea
              id="fuseNotes"
              value={formData.dropOutFuseCondition.notes}
              onChange={(e) => setFormData({ ...formData, dropOutFuseCondition: { ...formData.dropOutFuseCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add transformer condition section
  const renderTransformerCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Transformer Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="transformerLeakingOil"
              checked={formData.transformerCondition.leakingOil}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  transformerCondition: { ...formData.transformerCondition, leakingOil: checked as boolean },
                })
              }
            />
            <Label htmlFor="transformerLeakingOil">Leaking Oil</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="transformerMissingEarthLeads"
              checked={formData.transformerCondition.missingEarthLeads}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  transformerCondition: { ...formData.transformerCondition, missingEarthLeads: checked as boolean },
                })
              }
            />
            <Label htmlFor="transformerMissingEarthLeads">Missing Earth leads (HV/LV)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="transformerLinkedHVFuses"
              checked={formData.transformerCondition.linkedHVFuses}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  transformerCondition: { ...formData.transformerCondition, linkedHVFuses: checked as boolean },
                })
              }
            />
            <Label htmlFor="transformerLinkedHVFuses">Linked HV Fuses</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="transformerRustedTank"
              checked={formData.transformerCondition.rustedTank}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  transformerCondition: { ...formData.transformerCondition, rustedTank: checked as boolean },
                })
              }
            />
            <Label htmlFor="transformerRustedTank">Rusted Tank</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="transformerCrackedBushing"
              checked={formData.transformerCondition.crackedBushing}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  transformerCondition: { ...formData.transformerCondition, crackedBushing: checked as boolean },
                })
              }
            />
            <Label htmlFor="transformerCrackedBushing">Cracked Bushing</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="transformerOthers"
              checked={formData.transformerCondition.others}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  transformerCondition: { ...formData.transformerCondition, others: checked as boolean },
                })
              }
            />
            <Label htmlFor="transformerOthers">Others</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="transformerNotes">Notes</Label>
            <Textarea
              id="transformerNotes"
              value={formData.transformerCondition.notes}
              onChange={(e) => setFormData({ ...formData, transformerCondition: { ...formData.transformerCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add recloser condition section
  const renderRecloserCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recloser/Sectionalizer (VIT) Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="recloserLowGasLevel"
              checked={formData.recloserCondition.lowGasLevel}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  recloserCondition: { ...formData.recloserCondition, lowGasLevel: checked as boolean },
                })
              }
            />
            <Label htmlFor="recloserLowGasLevel">Low Gas Level</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="recloserLowBatteryLevel"
              checked={formData.recloserCondition.lowBatteryLevel}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  recloserCondition: { ...formData.recloserCondition, lowBatteryLevel: checked as boolean },
                })
              }
            />
            <Label htmlFor="recloserLowBatteryLevel">Low Battery level</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="recloserBurntVoltageTransformers"
              checked={formData.recloserCondition.burntVoltageTransformers}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  recloserCondition: { ...formData.recloserCondition, burntVoltageTransformers: checked as boolean },
                })
              }
            />
            <Label htmlFor="recloserBurntVoltageTransformers">Burnt Voltage Transformers</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="recloserProtectionDisabled"
              checked={formData.recloserCondition.protectionDisabled}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  recloserCondition: { ...formData.recloserCondition, protectionDisabled: checked as boolean },
                })
              }
            />
            <Label htmlFor="recloserProtectionDisabled">Protection Disabled</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="recloserBypassed"
              checked={formData.recloserCondition.bypassed}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  recloserCondition: { ...formData.recloserCondition, bypassed: checked as boolean },
                })
              }
            />
            <Label htmlFor="recloserBypassed">By-passed</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="recloserOthers"
              checked={formData.recloserCondition.others}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  recloserCondition: { ...formData.recloserCondition, others: checked as boolean },
                })
              }
            />
            <Label htmlFor="recloserOthers">Others</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="recloserNotes">Notes</Label>
            <Textarea
              id="recloserNotes"
              value={formData.recloserCondition.notes}
              onChange={(e) => setFormData({ ...formData, recloserCondition: { ...formData.recloserCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  const renderAdditionalNotes = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Additional Notes</h3>
        <div className="space-y-2">
          <Textarea
            value={formData.additionalNotes}
            onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
            placeholder="Enter any additional observations or notes..."
            className="min-h-[100px]"
          />
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {inspection ? "Edit Overhead Line Inspection" : "New Overhead Line Inspection"}
        </h2>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {renderInspectorInfo}
        {renderBasicInformation}
        {renderPoleInformation}
        {renderPoleCondition}
        {renderStayCondition}
        {renderCrossArmCondition}
        {renderInsulatorCondition}
        {renderConductorCondition}
        {renderLightningArresterCondition}
        {renderDropOutFuseCondition}
        {renderTransformerCondition}
        {renderRecloserCondition}
        {renderAdditionalNotes}

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {inspection ? "Updating..." : "Submitting..."}
              </>
            ) : (
              inspection ? "Update Inspection" : "Submit Inspection"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
} 