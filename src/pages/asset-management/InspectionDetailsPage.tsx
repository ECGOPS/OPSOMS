import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubstationInspection, InspectionItem } from "@/lib/types";
import { useData } from "@/contexts/DataContext";
import { format } from "date-fns";
import { ChevronLeft, Pencil, CheckCircle2, AlertCircle, ClipboardList } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export default function InspectionDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getSavedInspection } = useData();
  const [inspection, setInspection] = useState<SubstationInspection | null>(null);
  const [activeTab, setActiveTab] = useState("general");

  useEffect(() => {
    if (id) {
      const loadedInspection = getSavedInspection(id);
      if (loadedInspection) {
        setInspection(loadedInspection);
      } else {
        toast.error("Inspection not found");
        navigate("/asset-management/inspection-management");
      }
    }
  }, [id, getSavedInspection, navigate]);

  const getItemsByCategory = (categoryName: string) => {
    switch (categoryName.toLowerCase()) {
      case "general building":
        return inspection?.generalBuilding || [];
      case "control equipment":
        return inspection?.controlEquipment || [];
      case "power transformer":
        return inspection?.powerTransformer || [];
      case "outdoor equipment":
        return inspection?.outdoorEquipment || [];
      default:
        return [];
    }
  };

  const getStatusSummary = () => {
    if (!inspection) return { good: 0, requiresAttention: 0 };
    
    const allItems = [
      ...(inspection.generalBuilding || []),
      ...(inspection.controlEquipment || []),
      ...(inspection.powerTransformer || []),
      ...(inspection.outdoorEquipment || [])
    ];
    
    return allItems.reduce((acc: { good: number; requiresAttention: number }, item) => {
      if (item.status === 'good') {
        acc.good++;
      } else if (item.status === 'bad') {
        acc.requiresAttention++;
      }
      return acc;
    }, { good: 0, requiresAttention: 0 });
  };

  // Debug function to log inspection data
  useEffect(() => {
    if (inspection) {
      console.log('Inspection Data:', inspection);
      if (inspection.generalBuilding) console.log('General Building:', inspection.generalBuilding);
      if (inspection.controlEquipment) console.log('Control Equipment:', inspection.controlEquipment);
      if (inspection.powerTransformer) console.log('Power Transformer:', inspection.powerTransformer);
      if (inspection.outdoorEquipment) console.log('Outdoor Equipment:', inspection.outdoorEquipment);
    }
  }, [inspection]);

  // Log items array for debugging whenever inspection data changes
  useEffect(() => {
    if (inspection?.items) {
      console.log('Items for summary calculation:', inspection.items);
    }
  }, [inspection]);

  if (!inspection) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <Card>
            <CardContent className="pt-6">
              <p>Loading inspection details...</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => navigate("/asset-management/inspection-management")}
            className="mb-4"
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Inspections
          </Button>
          
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight">
              Inspection: {inspection.substationNo}
            </h1>
            
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => navigate(`/asset-management/edit-inspection/${id}`)}
                className="flex items-center gap-2"
              >
                <Pencil size={16} />
                Edit Inspection
              </Button>
            </div>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader className="border-b">
            <div>
              <CardTitle className="text-2xl">Inspection Details</CardTitle>
              <CardDescription className="mt-2">
                Detailed information about the substation inspection
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm font-medium text-muted-foreground mb-1">Region</p>
                <p className="text-lg font-semibold">{inspection.region}</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm font-medium text-muted-foreground mb-1">District</p>
                <p className="text-lg font-semibold">{inspection.district}</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm font-medium text-muted-foreground mb-1">Substation Number</p>
                <p className="text-lg font-semibold">{inspection.substationNo}</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm font-medium text-muted-foreground mb-1">Type</p>
                <p className="text-lg font-semibold capitalize">{inspection.type}</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm font-medium text-muted-foreground mb-1">Date</p>
                <p className="text-lg font-semibold">
                  {inspection.date && !isNaN(new Date(inspection.date).getTime()) 
                    ? format(new Date(inspection.date), "PPP") 
                    : "N/A"}
                </p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm font-medium text-muted-foreground mb-1">Created By</p>
                <p className="text-lg font-semibold">{inspection.createdBy || "N/A"}</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm font-medium text-muted-foreground mb-1">Created At</p>
                <p className="text-lg font-semibold">
                  {inspection.createdAt && !isNaN(new Date(inspection.createdAt).getTime()) 
                    ? format(new Date(inspection.createdAt), "PPP") 
                    : "N/A"}
                </p>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Inspection Status Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50/50 p-6 rounded-lg border border-green-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-full">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-700">
                        {inspection.items?.filter(item => item.status === "good").length || 0}
                      </p>
                      <p className="text-sm text-green-600">Good Items</p>
                    </div>
                  </div>
                </div>
                <div className="bg-red-50/50 p-6 rounded-lg border border-red-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-red-100 p-2 rounded-full">
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-700">
                        {inspection.items?.filter(item => item.status === "bad").length || 0}
                      </p>
                      <p className="text-sm text-red-600">Items Requiring Attention</p>
                    </div>
                  </div>
                </div>
                <div className="bg-blue-50/50 p-6 rounded-lg border border-blue-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <ClipboardList className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-700">
                        {inspection.items?.length || 0}
                      </p>
                      <p className="text-sm text-blue-600">Total Items</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-2xl">Inspection Checklist Results</CardTitle>
            <CardDescription className="mt-2">
              Detailed results of the inspection checklist
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="general" key="general-tab">General Building</TabsTrigger>
                <TabsTrigger value="control" key="control-tab">Control Equipment</TabsTrigger>
                <TabsTrigger value="transformer" key="transformer-tab">Power Transformer</TabsTrigger>
                <TabsTrigger value="outdoor" key="outdoor-tab">Outdoor Equipment</TabsTrigger>
              </TabsList>

              <TabsContent value="general" key="general-content" className="space-y-4">
                {getItemsByCategory("General Building").map((item) => (
                  <div key={`general-${item.id}`} className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-lg mb-2">{item.name}</h3>
                        <div className="flex items-center gap-2">
                          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.status === "good" 
                              ? "bg-green-100 text-green-800" 
                              : "bg-red-100 text-red-800"
                          }`}>
                            {item.status === "good" ? "Good" : "Requires Attention"}
                          </div>
                        </div>
                      </div>
                    </div>
                    {item.remarks && (
                      <div className="mt-3">
                        <p className="text-sm text-muted-foreground">Remarks:</p>
                        <p className="text-sm mt-1">{item.remarks}</p>
                      </div>
                    )}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="control" key="control-content" className="space-y-4">
                {getItemsByCategory("Control Equipment").map((item) => (
                  <div key={`control-${item.id}`} className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-lg mb-2">{item.name}</h3>
                        <div className="flex items-center gap-2">
                          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.status === "good" 
                              ? "bg-green-100 text-green-800" 
                              : "bg-red-100 text-red-800"
                          }`}>
                            {item.status === "good" ? "Good" : "Requires Attention"}
                          </div>
                        </div>
                      </div>
                    </div>
                    {item.remarks && (
                      <div className="mt-3">
                        <p className="text-sm text-muted-foreground">Remarks:</p>
                        <p className="text-sm mt-1">{item.remarks}</p>
                      </div>
                    )}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="transformer" key="transformer-content" className="space-y-4">
                {getItemsByCategory("Power Transformer").map((item) => (
                  <div key={`transformer-${item.id}`} className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-lg mb-2">{item.name}</h3>
                        <div className="flex items-center gap-2">
                          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.status === "good" 
                              ? "bg-green-100 text-green-800" 
                              : "bg-red-100 text-red-800"
                          }`}>
                            {item.status === "good" ? "Good" : "Requires Attention"}
                          </div>
                        </div>
                      </div>
                    </div>
                    {item.remarks && (
                      <div className="mt-3">
                        <p className="text-sm text-muted-foreground">Remarks:</p>
                        <p className="text-sm mt-1">{item.remarks}</p>
                      </div>
                    )}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="outdoor" key="outdoor-content" className="space-y-4">
                {getItemsByCategory("Outdoor Equipment").map((item) => (
                  <div key={`outdoor-${item.id}`} className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-lg mb-2">{item.name}</h3>
                        <div className="flex items-center gap-2">
                          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.status === "good" 
                              ? "bg-green-100 text-green-800" 
                              : "bg-red-100 text-red-800"
                          }`}>
                            {item.status === "good" ? "Good" : "Requires Attention"}
                          </div>
                        </div>
                      </div>
                    </div>
                    {item.remarks && (
                      <div className="mt-3">
                        <p className="text-sm text-muted-foreground">Remarks:</p>
                        <p className="text-sm mt-1">{item.remarks}</p>
                      </div>
                    )}
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
