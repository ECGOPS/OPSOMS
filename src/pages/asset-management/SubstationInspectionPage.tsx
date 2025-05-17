import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { v4 as uuidv4 } from "uuid";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { SubstationInspection, ConditionStatus, InspectionItem } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useNavigate, useParams } from "react-router-dom";

interface Category {
  id: string;
  name: string;
  items: InspectionItem[];
}

export default function SubstationInspectionPage() {
  const { user } = useAuth();
  const { regions, districts, saveInspection, getSavedInspection, savedInspections } = useData();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [regionId, setRegionId] = useState<string>("");
  const [districtId, setDistrictId] = useState<string>("");
  const [formData, setFormData] = useState<SubstationInspection>({
    id: uuidv4(),
    region: "",
    regionId: "",
    district: "",
    districtId: "",
    substationName: "",
    substationNo: "",
    type: "indoor",
    date: new Date().toISOString(),
    inspectionDate: new Date().toISOString(),
    items: [],
    generalBuilding: [],
    controlEquipment: [],
    powerTransformer: [],
    outdoorEquipment: [],
    remarks: "",
    createdBy: user?.name || "",
    createdAt: new Date().toISOString(),
    inspectedBy: user?.name || "",
    location: "",
    voltageLevel: "",
    status: "Pending"
  });
  const [categories, setCategories] = useState<Category[]>([]);

  // Update item status
  const updateItemStatus = (categoryIndex: number, itemIndex: number, status: ConditionStatus) => {
    const categoryName = categories[categoryIndex].name.toLowerCase().replace(" ", "");
    const categoryKey = categoryName as keyof SubstationInspection;

    // Create updated items array
    const updatedItems = [...categories[categoryIndex].items];
    updatedItems[itemIndex] = { ...updatedItems[itemIndex], status };

    // Update categories state
    const newCategories = [...categories];
    newCategories[categoryIndex] = {
      ...newCategories[categoryIndex],
      items: updatedItems,
    };
    setCategories(newCategories);

    // Update formData with only the changed category
    setFormData(prev => ({
      ...prev,
      [categoryKey]: updatedItems,
    }));
  };

  // Add calculateStatusSummary function
  const calculateStatusSummary = () => {
    // Get items from each category separately to avoid duplication
    const generalBuildingItems = categories.find(c => c.name === "General Building")?.items || [];
    const controlEquipmentItems = categories.find(c => c.name === "Control Equipment")?.items || [];
    const powerTransformerItems = categories.find(c => c.name === "Power Transformer")?.items || [];
    const outdoorEquipmentItems = categories.find(c => c.name === "Outdoor Equipment")?.items || [];

    // Calculate totals for each status
    const total = generalBuildingItems.length + controlEquipmentItems.length + 
                 powerTransformerItems.length + outdoorEquipmentItems.length;
    
    const good = [
      ...generalBuildingItems,
      ...controlEquipmentItems,
      ...powerTransformerItems,
      ...outdoorEquipmentItems
    ].filter(item => item.status === "good").length;
    
    const bad = [
      ...generalBuildingItems,
      ...controlEquipmentItems,
      ...powerTransformerItems,
      ...outdoorEquipmentItems
    ].filter(item => item.status === "bad").length;

    return { total, good, bad };
  };

  // Initialize region and district based on user's assigned values
  useEffect(() => {
    if (user?.role === "district_engineer" || user?.role === "regional_engineer" || user?.role === "technician") {
      // Find region ID based on user's assigned region name
      const userRegion = regions.find(r => r.name === user.region);
      if (userRegion) {
        setRegionId(userRegion.id);
        setFormData(prev => ({ ...prev, region: userRegion.name }));
        
        // For district engineer and technician, also set the district
        if ((user.role === "district_engineer" || user?.role === "technician") && user.district) {
          const userDistrict = districts.find(d => 
            d.regionId === userRegion.id && d.name === user.district
          );
          if (userDistrict) {
            setDistrictId(userDistrict.id);
            setFormData(prev => ({ ...prev, district: userDistrict.name }));
          }
        }
      }
    }
  }, [user, regions, districts]);

  // Ensure district engineer's and technician's district is always set correctly
  useEffect(() => {
    if ((user?.role === "district_engineer" || user?.role === "technician") && user.district && user.region) {
      const userRegion = regions.find(r => r.name === user.region);
      if (userRegion) {
        const userDistrict = districts.find(d => 
          d.regionId === userRegion.id && d.name === user.district
        );
        if (userDistrict) {
          setRegionId(userRegion.id);
          setDistrictId(userDistrict.id);
          setFormData(prev => ({ 
            ...prev, 
            region: userRegion.name,
            district: userDistrict.name 
          }));
        }
      }
    }
  }, [user, regions, districts]);

  // Filter regions and districts based on user role
  const filteredRegions = user?.role === "global_engineer"
    ? regions
    : regions.filter(r => user?.region ? r.name === user.region : true);
  
  const filteredDistricts = regionId
    ? districts.filter(d => {
        // First check if district belongs to selected region
        if (d.regionId !== regionId) return false;
        
        // For district engineers and technicians, only show their assigned district
        if (user?.role === "district_engineer" || user?.role === "technician") {
          return d.name === user.district;
        }
        
        // For other roles, show all districts in the region
        return true;
      })
    : [];

  // Handle region change - prevent district engineers and technicians from changing region
  const handleRegionChange = (value: string) => {
    if (user?.role === "district_engineer" || user?.role === "technician") return; // Prevent district engineers and technicians from changing region
    
    setRegionId(value);
    const region = regions.find(r => r.id === value);
    setFormData(prev => ({ ...prev, region: region?.name || "" }));
    setDistrictId("");
    setFormData(prev => ({ ...prev, district: "" }));
  };

  // Handle district change - prevent district engineers and technicians from changing district
  const handleDistrictChange = (value: string) => {
    if (user?.role === "district_engineer" || user?.role === "technician") return; // Prevent district engineers and technicians from changing district
    
    setDistrictId(value);
    const district = districts.find(d => d.id === value);
    setFormData(prev => ({ ...prev, district: district?.name || "" }));
  };

  // Handle generic form input changes
  const handleInputChange = (field: keyof SubstationInspection, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Initialize formData with categories
  useEffect(() => {
    if (id) {
      // Edit mode - load existing inspection
      const inspection = getSavedInspection(id);
      if (inspection) {
        // Set formData without items array to avoid duplication
        const { items, ...formDataWithoutItems } = inspection;
        setFormData({
          ...formDataWithoutItems,
          id: inspection.id,
          items: [] // Clear items array to avoid duplication
        });
        
        // Set categories with the items, preserving original IDs
        setCategories([
          {
            id: inspection.generalBuilding?.[0]?.category || uuidv4(),
            name: "General Building",
            items: (inspection.generalBuilding || []).map(item => ({
              id: item.id,  // Preserve original ID
              name: item.name,
              category: "general building",
              status: item.status || undefined,
              remarks: item.remarks || ""
            })),
          },
          {
            id: inspection.controlEquipment?.[0]?.category || uuidv4(),
            name: "Control Equipment",
            items: (inspection.controlEquipment || []).map(item => ({
              id: item.id,  // Preserve original ID
              name: item.name,
              category: "control equipment",
              status: item.status || undefined,
              remarks: item.remarks || ""
            })),
          },
          {
            id: inspection.powerTransformer?.[0]?.category || uuidv4(),
            name: "Power Transformer",
            items: (inspection.powerTransformer || []).map(item => ({
              id: item.id,  // Preserve original ID
              name: item.name,
              category: "power transformer",
              status: item.status || undefined,
              remarks: item.remarks || ""
            })),
          },
          {
            id: inspection.outdoorEquipment?.[0]?.category || uuidv4(),
            name: "Outdoor Equipment",
            items: (inspection.outdoorEquipment || []).map(item => ({
              id: item.id,  // Preserve original ID
              name: item.name,
              category: "outdoor equipment",
              status: item.status || undefined,
              remarks: item.remarks || ""
            })),
          },
        ]);
      }
    } else {
      // Create mode - generate unique IDs for new items
      const defaultItems = [
        {
          id: `general-building-${uuidv4()}`,
          name: "General Building",
          items: [
            { id: `gb-structure-${uuidv4()}`, name: "Building Structure", status: undefined, remarks: "", category: "general building" },
            { id: `gb-clean-${uuidv4()}`, name: "Cleanliness", status: undefined, remarks: "", category: "general building" },
            { id: `gb-light-${uuidv4()}`, name: "Lighting", status: undefined, remarks: "", category: "general building" },
            { id: `gb-vent-${uuidv4()}`, name: "Ventilation", status: undefined, remarks: "", category: "general building" },
            { id: `gb-fire-${uuidv4()}`, name: "Fire Safety", status: undefined, remarks: "", category: "general building" },
          ],
        },
        {
          id: `control-equipment-${uuidv4()}`,
          name: "Control Equipment",
          items: [
            { id: `ce-panels-${uuidv4()}`, name: "Control Panels", status: undefined, remarks: "", category: "control equipment" },
            { id: `ce-wiring-${uuidv4()}`, name: "Wiring", status: undefined, remarks: "", category: "control equipment" },
            { id: `ce-relays-${uuidv4()}`, name: "Relays", status: undefined, remarks: "", category: "control equipment" },
            { id: `ce-batteries-${uuidv4()}`, name: "Batteries", status: undefined, remarks: "", category: "control equipment" },
            { id: `ce-comms-${uuidv4()}`, name: "Communication Systems", status: undefined, remarks: "", category: "control equipment" },
          ],
        },
        {
          id: `power-transformer-${uuidv4()}`,
          name: "Power Transformer",
          items: [
            { id: `pt-oil-${uuidv4()}`, name: "Oil Level", status: undefined, remarks: "", category: "power transformer" },
            { id: `pt-bushings-${uuidv4()}`, name: "Bushings", status: undefined, remarks: "", category: "power transformer" },
            { id: `pt-cooling-${uuidv4()}`, name: "Cooling System", status: undefined, remarks: "", category: "power transformer" },
            { id: `pt-insulation-${uuidv4()}`, name: "Insulation", status: undefined, remarks: "", category: "power transformer" },
            { id: `pt-tap-${uuidv4()}`, name: "Load Tap Changer", status: undefined, remarks: "", category: "power transformer" },
          ],
        },
        {
          id: `outdoor-equipment-${uuidv4()}`,
          name: "Outdoor Equipment",
          items: [
            { id: `oe-breakers-${uuidv4()}`, name: "Circuit Breakers", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-switches-${uuidv4()}`, name: "Disconnect Switches", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-arresters-${uuidv4()}`, name: "Surge Arresters", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-grounding-${uuidv4()}`, name: "Grounding System", status: undefined, remarks: "", category: "outdoor equipment" },
            { id: `oe-fencing-${uuidv4()}`, name: "Fencing", status: undefined, remarks: "", category: "outdoor equipment" },
          ],
        },
      ];
      
      setCategories(defaultItems);
      setFormData(prev => ({
        ...prev,
        items: [],
        generalBuilding: defaultItems[0].items,
        controlEquipment: defaultItems[1].items,
        powerTransformer: defaultItems[2].items,
        outdoorEquipment: defaultItems[3].items,
      }));
    }
  }, [id, getSavedInspection]);

  // Update item remarks
  const updateItemRemarks = (categoryIndex: number, itemIndex: number, remarks: string) => {
    setCategories(prevCategories => {
      const newCategories = [...prevCategories];
      newCategories[categoryIndex] = {
        ...newCategories[categoryIndex],
        items: newCategories[categoryIndex].items.map((item, index) =>
          index === itemIndex ? { ...item, remarks } : item
        ),
      };
      return newCategories;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Get all items from categories
      const inspectionItems = {
        generalBuilding: categories[0]?.items || [],
        controlEquipment: categories[1]?.items || [],
        powerTransformer: categories[2]?.items || [],
        outdoorEquipment: categories[3]?.items || []
      };

      // Get selected region and district names
      const selectedRegion = regions.find(r => r.id === regionId)?.name || "";
      const selectedDistrict = districts.find(d => d.id === districtId)?.name || "";
      
      const inspectionData: Omit<SubstationInspection, "id"> = {
        region: selectedRegion,
        district: selectedDistrict,
        regionId: regionId,
        districtId: districtId,
        date: formData.date || new Date().toISOString().split('T')[0],
        inspectionDate: formData.inspectionDate || new Date().toISOString().split('T')[0],
        substationNo: formData.substationNo || "",
        substationName: formData.substationName || "",
        type: formData.type || "indoor",
        items: [
          ...inspectionItems.generalBuilding,
          ...inspectionItems.controlEquipment,
          ...inspectionItems.powerTransformer,
          ...inspectionItems.outdoorEquipment
        ],
        generalBuilding: inspectionItems.generalBuilding,
        controlEquipment: inspectionItems.controlEquipment,
        powerTransformer: inspectionItems.powerTransformer,
        outdoorEquipment: inspectionItems.outdoorEquipment,
        remarks: formData.remarks || "",
        createdBy: user?.name || "Unknown",
        createdAt: new Date().toISOString(),
        inspectedBy: user?.name || "Unknown",
        location: formData.location || "",
        voltageLevel: formData.voltageLevel || "",
        status: formData.status || "Pending"
      };
      
      saveInspection(inspectionData);
      toast.success("Inspection saved successfully");
      navigate("/asset-management/inspection-management");
    } catch (error) {
      console.error("Error saving inspection:", error);
      toast.error("Failed to save inspection");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredInspections = useMemo(() => {
    if (!savedInspections) return [];
    return savedInspections.filter(inspection => {
      if (user?.role === 'global_engineer' || user?.role === 'system_admin') return true;
      if (user?.role === 'regional_engineer') return inspection.region === user.region;
      if (user?.role === 'district_engineer' || user?.role === 'technician') return inspection.district === user.district;
      return false;
    });
  }, [savedInspections, user]);

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">New Substation Inspection</h1>
            <p className="text-muted-foreground mt-1">
              Record a new inspection for a substation
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Inspection Details</CardTitle>
              <CardDescription>Enter the basic information about the inspection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <Select
                    value={regionId}
                    onValueChange={handleRegionChange}
                    required
                    disabled={user?.role === "district_engineer" || user?.role === "regional_engineer" || user?.role === "technician"}
                  >
                    <SelectTrigger id="region">
                      <SelectValue placeholder="Select Region" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredRegions.map((region) => (
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
                    value={districtId}
                    onValueChange={handleDistrictChange}
                    required
                    disabled={user?.role === "district_engineer" || user?.role === "technician" || !regionId}
                  >
                    <SelectTrigger id="district">
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
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange("date", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="substationNo">Substation Number</Label>
                  <Input
                    id="substationNo"
                    type="text"
                    value={formData.substationNo || ''}
                    onChange={(e) => handleInputChange('substationNo', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="substationName">Substation Name (Optional)</Label>
                  <Input
                    id="substationName"
                    type="text"
                    value={formData.substationName || ''}
                    onChange={(e) => handleInputChange('substationName', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => handleInputChange("type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="indoor">Indoor</SelectItem>
                      <SelectItem value="outdoor">Outdoor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inspection Checklist */}
          {categories.map((category, categoryIndex) => (
            <Card key={category.id}>
              <CardHeader>
                <CardTitle>{category.name}</CardTitle>
                <CardDescription>
                  Record the condition of each item in this category
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {category.items.map((item, itemIndex) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 gap-4">
                      <h3 className="text-base font-medium flex-1">{item.name}</h3>
                      <div className="flex items-center space-x-6">
                        <RadioGroup
                          value={item.status}
                          onValueChange={(value) => updateItemStatus(categoryIndex, itemIndex, value as "good" | "bad")}
                          className="flex items-center space-x-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="good"
                              id={`good-${item.id}`}
                              className="text-green-500 border-green-500 focus:ring-green-500"
                            />
                            <Label
                              htmlFor={`good-${item.id}`}
                              className="text-green-600"
                            >
                              Good
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="bad"
                              id={`bad-${item.id}`}
                              className="text-red-500 border-red-500 focus:ring-red-500"
                            />
                            <Label
                              htmlFor={`bad-${item.id}`}
                              className="text-red-600"
                            >
                              Bad
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Label htmlFor={`remarks-${item.id}`} className="text-sm">
                        Remarks
                      </Label>
                      <Textarea
                        id={`remarks-${item.id}`}
                        value={item.remarks}
                        onChange={(e) => updateItemRemarks(categoryIndex, itemIndex, e.target.value)}
                        placeholder="Add any comments or observations"
                        className="mt-1 h-20"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" size="lg">
              Save Inspection
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}