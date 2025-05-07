import { useState, useMemo } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VITAssetsTable } from "@/components/vit/VITAssetsTable";
import { VITAssetForm } from "@/components/vit/VITAssetForm";
import { VITInspectionForm } from "@/components/vit/VITInspectionForm";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { VITAsset } from "@/lib/types";
import { useNavigate } from "react-router-dom";

export default function VITInspectionPage() {
  const { vitAssets, vitInspections, regions, districts } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("assets");
  const [isAssetFormOpen, setIsAssetFormOpen] = useState(false);
  const [isInspectionFormOpen, setIsInspectionFormOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<VITAsset | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  
  // Filter assets based on user role
  const filteredAssets = useMemo(() => {
    if (!user) return [];
    
    if (user.role === "system_admin" || user.role === "global_engineer") {
      return vitAssets;
    }
    
    if (user.role === "regional_engineer") {
      return vitAssets.filter(asset => asset.region === user.region);
      }
    
    if (user.role === "district_engineer" || user.role === "technician") {
      return vitAssets.filter(asset => asset.district === user.district);
      }
    
    return [];
  }, [vitAssets, user]);

  // Filter inspections based on user role
  const filteredInspections = useMemo(() => {
    if (!user) return [];
    
    if (user.role === "system_admin" || user.role === "global_engineer") {
      return vitInspections;
    }
    
    if (user.role === "regional_engineer") {
    return vitInspections.filter(inspection => {
      const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
        return asset?.region === user.region;
      });
      }
    
    if (user.role === "district_engineer" || user.role === "technician") {
      return vitInspections.filter(inspection => {
        const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
        return asset?.district === user.district;
      });
    }
    
    return [];
  }, [vitInspections, vitAssets, user]);
  
  const handleAddAsset = () => {
    setSelectedAsset(null);
    setIsAssetFormOpen(true);
  };
  
  const handleEditAsset = (asset: VITAsset) => {
    navigate(`/asset-management/edit-vit-asset/${asset.id}`);
  };
  
  const handleAddInspection = (assetId: string) => {
    setSelectedAssetId(assetId);
    setIsInspectionFormOpen(true);
  };
  
  const handleAssetFormClose = () => {
    setIsAssetFormOpen(false);
    setSelectedAsset(null);
  };
  
  const handleInspectionFormClose = () => {
    setIsInspectionFormOpen(false);
    setSelectedAssetId(null);
  };
  
  const handleViewInspections = (assetId: string) => {
    navigate(`/asset-management/vit-inspection-details/${assetId}`);
  };

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">VITs Inspection</h1>
            <p className="text-muted-foreground mt-1">
              Manage and monitor VIT assets and conduct inspections
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="assets">VIT Assets</TabsTrigger>
            <TabsTrigger value="inspections">Inspection Records</TabsTrigger>
          </TabsList>
          
          <TabsContent value="assets" className="space-y-6">
            <VITAssetsTable 
              assets={filteredAssets}
              onAddAsset={handleAddAsset} 
              onEditAsset={handleEditAsset}
              onInspect={handleAddInspection}
            />
          </TabsContent>
          
          <TabsContent value="inspections">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Inspection Records</h2>
                <Button onClick={() => navigate("/asset-management/vit-inspection-management")}>
                  View All Inspections
                </Button>
              </div>
              
              <div className="rounded-md border overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Region</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">District</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inspector</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredInspections.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                          No inspection records found
                        </td>
                      </tr>
                    ) : (
                      filteredInspections.map(inspection => {
                        const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
                        if (!asset) return null;
                        
                        const region = regions.find(r => r.name === asset.region)?.name || "Unknown";
                        const district = districts.find(d => d.name === asset.district)?.name || "Unknown";
                        
                        return (
                          <tr key={inspection.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(inspection.inspectionDate).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {asset.serialNumber}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {region}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {district}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {inspection.inspectedBy}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewInspections(asset.id)}
                              >
                                View Details
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Asset Form Sheet */}
        <Sheet open={isAssetFormOpen} onOpenChange={setIsAssetFormOpen}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{selectedAsset ? "Edit VIT Asset" : "Add New VIT Asset"}</SheetTitle>
              <SheetDescription>
                {selectedAsset 
                  ? "Update the information for this VIT asset" 
                  : "Fill in the details to add a new VIT asset"}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <VITAssetForm 
                asset={selectedAsset || undefined} 
                onSubmit={handleAssetFormClose}
                onCancel={handleAssetFormClose}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Inspection Form Sheet */}
        <Sheet open={isInspectionFormOpen} onOpenChange={setIsInspectionFormOpen}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>New Inspection</SheetTitle>
              <SheetDescription>
                Complete the inspection checklist for this VIT asset
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <VITInspectionForm 
                assetId={selectedAssetId || undefined}
                onSubmit={handleInspectionFormClose}
                onCancel={handleInspectionFormClose}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </Layout>
  );
}
