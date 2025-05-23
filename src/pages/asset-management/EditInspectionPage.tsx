import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { ConditionStatus, InspectionItem } from "@/lib/types";
import { SubstationInspection } from "@/lib/asset-types";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { ChevronLeft } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

export default function EditInspectionPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { getSavedInspection, updateSubstationInspection, regions, districts } = useData();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("general");
  const [formData, setFormData] = useState<Partial<SubstationInspection>>({
    region: "",
    district: "",
    date: new Date().toISOString().split('T')[0],
    type: "indoor",
    items: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      const inspection = getSavedInspection(id);
      if (inspection) {
        // Set form data with all category-specific arrays preserved
        setFormData({
          ...inspection,
          region: inspection.region || "",
          district: inspection.district || "",
          date: inspection.date || new Date().toISOString().split('T')[0],
          type: inspection.type || "indoor",
          // Preserve all category-specific arrays
          siteCondition: inspection.siteCondition || [],
          generalBuilding: inspection.generalBuilding || [],
          controlEquipment: inspection.controlEquipment || [],
          powerTransformer: inspection.powerTransformer || [],
          outdoorEquipment: inspection.outdoorEquipment || [],
          basement: inspection.basement || [],
          remarks: inspection.remarks || "", // This is used for additional notes
          // Combine items for backward compatibility
          items: [
            ...(inspection.siteCondition || []),
            ...(inspection.generalBuilding || []),
            ...(inspection.controlEquipment || []),
            ...(inspection.powerTransformer || []),
            ...(inspection.outdoorEquipment || []),
            ...(inspection.basement || [])
          ]
        });
        setLoading(false);
      } else {
        toast.error("Inspection not found");
        navigate("/asset-management/inspection-management");
      }
    }
  }, [id, getSavedInspection, navigate]);

  // Initialize region and district based on user's assigned values
  useEffect(() => {
    if (user?.role === "district_engineer" || user?.role === "regional_engineer" || user?.role === "technician" || user?.role === "district_manager") {
      // Find region ID based on user's assigned region name
      const userRegion = regions.find(r => r.name === user.region);
      if (userRegion) {
        setFormData(prev => ({ ...prev, region: userRegion.name }));
        
        // For district engineer, technician, and district manager, also set the district
        if ((user.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") && user.district) {
          const userDistrict = districts.find(d => 
            d.regionId === userRegion.id && d.name === user.district
          );
          if (userDistrict) {
            setFormData(prev => ({ ...prev, district: userDistrict.name }));
          }
        }
      }
    }
  }, [user, regions, districts]);

  // Ensure district engineer's, technician's, and district manager's district is always set correctly
  useEffect(() => {
    if ((user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") && user.district && user.region) {
      const userRegion = regions.find(r => r.name === user.region);
      if (userRegion) {
        const userDistrict = districts.find(d => 
          d.regionId === userRegion.id && d.name === user.district
        );
        if (userDistrict) {
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
  
  const filteredDistricts = formData.region
    ? districts.filter(d => {
        // First check if district belongs to selected region
        const region = regions.find(r => r.name === formData.region);
        if (!region || d.regionId !== region.id) return false;
        
        // For district engineers, technicians, and district managers, only show their assigned district
        if (user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") {
          return d.name === user.district;
        }
        
        // For other roles, show all districts in the region
        return true;
      })
    : [];

  // Handle region change - prevent district engineers, technicians, and district managers from changing region
  const handleRegionChange = (value: string) => {
    if (user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") return; // Prevent district engineers, technicians, and district managers from changing region
    
    setFormData(prev => ({ ...prev, region: value, district: "" }));
  };

  // Handle district change - prevent district engineers, technicians, and district managers from changing district
  const handleDistrictChange = (value: string) => {
    if (user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") return; // Prevent district engineers, technicians, and district managers from changing district
    
    setFormData(prev => ({ ...prev, district: value }));
  };

  // Handle generic form input changes
  const handleInputChange = (field: keyof SubstationInspection, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Update inspection item
  const updateInspectionItem = (id: string, field: keyof InspectionItem, value: any) => {
    setFormData(prev => {
      // Find which category the item belongs to
      const categoryMap: { [key: string]: string } = {
        "general building": "generalBuilding",
        "control equipment": "controlEquipment",
        "power transformer": "powerTransformer",
        "outdoor equipment": "outdoorEquipment",
        "site condition": "siteCondition",
        "basement": "basement"
      };

      // Find the item and its category
      const item = prev.items?.find(item => item.id === id);
      const categoryKey = item?.category ? categoryMap[item.category.toLowerCase()] : null;

      if (!categoryKey) {
        console.error('Could not find category for item:', id);
        return prev;
      }

      // Update the category-specific array
      const categoryArray = prev[categoryKey as keyof SubstationInspection] as InspectionItem[] | undefined;
      const updatedCategoryItems = categoryArray?.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      ) || [];

      // Update the combined items array
      const updatedItems = prev.items?.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      ) || [];

      return {
        ...prev,
        [categoryKey]: updatedCategoryItems,
        items: updatedItems
      };
    });
  };

  // Filter items by category
  const getItemsByCategory = (category: string) => {
    const categoryMap: { [key: string]: string } = {
      "general": "general building",
      "control": "control equipment",
      "transformer": "power transformer",
      "outdoor": "outdoor equipment",
      "site": "site condition",
      "basement": "basement"
    };
    return formData.items?.filter(item => item.category.toLowerCase() === categoryMap[category].toLowerCase()) || [];
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.region || !formData.district || !formData.date || !formData.substationNo) {
      toast.error("Please fill all required fields");
      return;
    }
    
    if (id) {
      // Ensure all category-specific arrays are properly set
      const updatedData: Partial<SubstationInspection> = {
        ...formData,
        siteCondition: formData.siteCondition || [],
        generalBuilding: formData.generalBuilding || [],
        controlEquipment: formData.controlEquipment || [],
        powerTransformer: formData.powerTransformer || [],
        outdoorEquipment: formData.outdoorEquipment || [],
        basement: formData.basement || [],
        remarks: formData.remarks || "",
        // Update the combined items array to match category-specific arrays
        items: [
          ...(formData.siteCondition || []),
          ...(formData.generalBuilding || []),
          ...(formData.controlEquipment || []),
          ...(formData.powerTransformer || []),
          ...(formData.outdoorEquipment || []),
          ...(formData.basement || [])
        ]
      };
      
      console.log('Submitting inspection data:', updatedData);
      
      updateSubstationInspection(id, updatedData)
        .then(() => {
          toast.success("Inspection updated successfully");
          navigate("/asset-management/inspection-management");
        })
        .catch((error) => {
          console.error("Error updating inspection:", error);
          toast.error("Failed to update inspection");
        });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <Card>
            <CardContent className="pt-6">
              <p>Loading inspection data...</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8">
        <Button
          variant="outline"
          onClick={() => navigate(`/asset-management/inspection-details/${id}`)}
          className="mb-6"
        >
          <ChevronLeft className="mr-2 h-4 w-4" /> Back to Inspection Details
        </Button>
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Edit Inspection</h1>
          <p className="text-muted-foreground mt-2">
            Update the inspection data for Substation {formData.substationNo}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-8">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Inspection Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <Select
                      value={formData.region}
                      onValueChange={handleRegionChange}
                      required
                      disabled={user?.role === "district_engineer" || user?.role === "regional_engineer" || user?.role === "technician" || user?.role === "district_manager"}
                    >
                      <SelectTrigger id="region">
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredRegions.map(region => (
                          <SelectItem key={region.id} value={region.name}>
                            {region.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="district">District</Label>
                    <Select
                      value={formData.district}
                      onValueChange={handleDistrictChange}
                      required
                      disabled={user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager" || !formData.region}
                    >
                      <SelectTrigger id="district" className={user?.role === "district_engineer" || user?.role === "district_manager" ? "bg-muted" : ""}>
                        <SelectValue placeholder="Select district" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredDistricts.map(district => (
                          <SelectItem key={district.id} value={district.name}>
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
                      onChange={(e) => handleInputChange('date', e.target.value)}
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
                    <Label htmlFor="type">Substation Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => handleInputChange('type', value as 'indoor' | 'outdoor')}
                    >
                      <SelectTrigger id="type">
                        <SelectValue placeholder="Select substation type" />
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
            <Card>
              <CardHeader>
                <CardTitle>Inspection Checklist</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs 
                  defaultValue="general" 
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="w-full"
                >
                  <TabsList className="grid grid-cols-6 gap-4">
                    <TabsTrigger value="general">General Building</TabsTrigger>
                    <TabsTrigger value="control">Control Equipment</TabsTrigger>
                    <TabsTrigger value="transformer">Power Transformer</TabsTrigger>
                    <TabsTrigger value="outdoor">Outdoor Equipment</TabsTrigger>
                    <TabsTrigger value="site">Site Condition</TabsTrigger>
                    <TabsTrigger value="basement">Basement</TabsTrigger>
                  </TabsList>
                  
                  {/* General Building */}
                  <TabsContent value="general" className="space-y-4">
                    {getItemsByCategory("general").map((item) => (
                      <div key={item.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h4 className="font-medium">{item.name}</h4>
                          </div>
                          <RadioGroup
                            value={item.status}
                            onValueChange={(value) => updateInspectionItem(item.id, 'status', value as ConditionStatus)}
                            className="flex items-center space-x-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="good" id={`${item.id}-good`} />
                              <Label htmlFor={`${item.id}-good`}>Good</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="bad" id={`${item.id}-bad`} />
                              <Label htmlFor={`${item.id}-bad`}>Bad</Label>
                            </div>
                          </RadioGroup>
                        </div>
                        <div className="mt-4">
                          <Label htmlFor={`remarks-${item.id}`}>Remarks</Label>
                          <Textarea
                            id={`remarks-${item.id}`}
                            value={item.remarks || ''}
                            onChange={(e) => updateInspectionItem(item.id, 'remarks', e.target.value)}
                            placeholder="Add remarks about this item"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  {/* Control Equipment */}
                  <TabsContent value="control" className="space-y-4">
                    {getItemsByCategory("control").map((item) => (
                      <div key={item.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h4 className="font-medium">{item.name}</h4>
                          </div>
                          <RadioGroup
                            value={item.status}
                            onValueChange={(value) => updateInspectionItem(item.id, 'status', value as ConditionStatus)}
                            className="flex items-center space-x-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="good" id={`${item.id}-good`} />
                              <Label htmlFor={`${item.id}-good`}>Good</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="bad" id={`${item.id}-bad`} />
                              <Label htmlFor={`${item.id}-bad`}>Bad</Label>
                            </div>
                          </RadioGroup>
                        </div>
                        <div className="mt-4">
                          <Label htmlFor={`remarks-${item.id}`}>Remarks</Label>
                          <Textarea
                            id={`remarks-${item.id}`}
                            value={item.remarks || ''}
                            onChange={(e) => updateInspectionItem(item.id, 'remarks', e.target.value)}
                            placeholder="Add remarks about this item"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  {/* Power Transformer */}
                  <TabsContent value="transformer" className="space-y-4">
                    {getItemsByCategory("transformer").map((item) => (
                      <div key={item.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h4 className="font-medium">{item.name}</h4>
                          </div>
                          <RadioGroup
                            value={item.status}
                            onValueChange={(value) => updateInspectionItem(item.id, 'status', value as ConditionStatus)}
                            className="flex items-center space-x-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="good" id={`${item.id}-good`} />
                              <Label htmlFor={`${item.id}-good`}>Good</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="bad" id={`${item.id}-bad`} />
                              <Label htmlFor={`${item.id}-bad`}>Bad</Label>
                            </div>
                          </RadioGroup>
                        </div>
                        <div className="mt-4">
                          <Label htmlFor={`remarks-${item.id}`}>Remarks</Label>
                          <Textarea
                            id={`remarks-${item.id}`}
                            value={item.remarks || ''}
                            onChange={(e) => updateInspectionItem(item.id, 'remarks', e.target.value)}
                            placeholder="Add remarks about this item"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  {/* Outdoor Equipment */}
                  <TabsContent value="outdoor" className="space-y-4">
                    {getItemsByCategory("outdoor").map((item) => (
                      <div key={item.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h4 className="font-medium">{item.name}</h4>
                          </div>
                          <RadioGroup
                            value={item.status}
                            onValueChange={(value) => updateInspectionItem(item.id, 'status', value as ConditionStatus)}
                            className="flex items-center space-x-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="good" id={`${item.id}-good`} />
                              <Label htmlFor={`${item.id}-good`}>Good</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="bad" id={`${item.id}-bad`} />
                              <Label htmlFor={`${item.id}-bad`}>Bad</Label>
                            </div>
                          </RadioGroup>
                        </div>
                        <div className="mt-4">
                          <Label htmlFor={`remarks-${item.id}`}>Remarks</Label>
                          <Textarea
                            id={`remarks-${item.id}`}
                            value={item.remarks || ''}
                            onChange={(e) => updateInspectionItem(item.id, 'remarks', e.target.value)}
                            placeholder="Add remarks about this item"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  {/* Site Condition */}
                  <TabsContent value="site" className="space-y-4">
                    {getItemsByCategory("site").map((item) => (
                      <div key={item.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h4 className="font-medium">{item.name}</h4>
                          </div>
                          <RadioGroup
                            value={item.status}
                            onValueChange={(value) => updateInspectionItem(item.id, 'status', value as ConditionStatus)}
                            className="flex items-center space-x-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="good" id={`${item.id}-good`} />
                              <Label htmlFor={`${item.id}-good`}>Good</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="bad" id={`${item.id}-bad`} />
                              <Label htmlFor={`${item.id}-bad`}>Bad</Label>
                            </div>
                          </RadioGroup>
                        </div>
                        <div className="mt-4">
                          <Label htmlFor={`remarks-${item.id}`}>Remarks</Label>
                          <Textarea
                            id={`remarks-${item.id}`}
                            value={item.remarks || ''}
                            onChange={(e) => updateInspectionItem(item.id, 'remarks', e.target.value)}
                            placeholder="Add remarks about this item"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  {/* Basement */}
                  <TabsContent value="basement" className="space-y-4">
                    {getItemsByCategory("basement").map((item) => (
                      <div key={item.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h4 className="font-medium">{item.name}</h4>
                          </div>
                          <RadioGroup
                            value={item.status}
                            onValueChange={(value) => updateInspectionItem(item.id, 'status', value as ConditionStatus)}
                            className="flex items-center space-x-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="good" id={`${item.id}-good`} />
                              <Label htmlFor={`${item.id}-good`}>Good</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="bad" id={`${item.id}-bad`} />
                              <Label htmlFor={`${item.id}-bad`}>Bad</Label>
                            </div>
                          </RadioGroup>
                        </div>
                        <div className="mt-4">
                          <Label htmlFor={`remarks-${item.id}`}>Remarks</Label>
                          <Textarea
                            id={`remarks-${item.id}`}
                            value={item.remarks || ''}
                            onChange={(e) => updateInspectionItem(item.id, 'remarks', e.target.value)}
                            placeholder="Add remarks about this item"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Additional Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="remarks">Additional Notes</Label>
                    <Textarea
                      id="remarks"
                      value={formData.remarks || ''}
                      onChange={(e) => handleInputChange('remarks', e.target.value)}
                      placeholder="Add any additional notes or observations"
                      className="h-32"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end space-x-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate(`/asset-management/inspection-details/${id}`)}
              >
                Cancel
              </Button>
              <Button type="submit" size="lg">
                Save Changes
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}