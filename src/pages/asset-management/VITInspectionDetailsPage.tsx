import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { ChevronLeft } from "lucide-react";
import { VITAsset, VITInspectionChecklist } from "@/lib/types";
import { AssetInfoCard } from "@/components/vit/AssetInfoCard";
import { InspectionRecord } from "@/components/vit/InspectionRecord";

export default function VITInspectionDetailsPage() {
  const { id: assetId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vitAssets, vitInspections, regions, districts, deleteVITInspection } = useData();
  
  const [asset, setAsset] = useState<VITAsset | null>(null);
  const [inspections, setInspections] = useState<VITInspectionChecklist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  useEffect(() => {
    if (assetId) {
      setLoading(true);
      // Find the asset
      const foundAsset = vitAssets.find(a => a.id === assetId);
      if (foundAsset) {
        setAsset(foundAsset);
        
        // Find all inspections for this asset
        const assetInspections = vitInspections.filter(i => i.vitAssetId === assetId);
        setInspections(assetInspections);
        setLoading(false);
      } else {
        toast.error("Asset not found");
        navigate("/asset-management/vit-inspection");
      }
    }
  }, [assetId, vitAssets, vitInspections, navigate]);
  
  const getRegionName = (regionId: string) => {
    const region = regions.find(r => r.id === regionId);
    return region ? region.name : "Unknown";
  };
  
  const getDistrictName = (districtId: string) => {
    const district = districts.find(d => d.id === districtId);
    return district ? district.name : "Unknown";
  };
  
  const handleEdit = (inspectionId: string) => {
    navigate(`/asset-management/edit-vit-inspection/${inspectionId}`);
  };
  
  const handleDelete = (inspectionId: string) => {
    if (window.confirm("Are you sure you want to delete this inspection record?")) {
      deleteVITInspection(inspectionId);
      // Update the local state to reflect the deletion
      setInspections(prev => prev.filter(i => i.id !== inspectionId));
      toast.success("Inspection record deleted successfully");
    }
  };
  
  if (loading || !asset) {
    return (
      <Layout>
        <div className="container py-8">
          <p className="text-center">Loading asset details...</p>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <div className="container py-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/asset-management/vit-inspection")} 
          className="mb-4"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to VIT Inspection
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">VIT Asset Details</h1>
            <p className="text-muted-foreground mt-1">
              View asset information and inspection history
            </p>
          </div>
          
          <Button 
            onClick={() => navigate(`/asset-management/vit-inspection-form/${asset.id}`)}
            className="mt-4 md:mt-0"
          >
            New Inspection
          </Button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Asset Information Card */}
          <div className="lg:col-span-1">
            <AssetInfoCard 
              asset={asset}
              getRegionName={getRegionName}
              getDistrictName={getDistrictName}
            />
          </div>
          
          {/* Inspection History */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border shadow-sm">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Inspection History</h2>
                
                {inspections.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No inspection records found for this asset.</p>
                    <Button 
                      onClick={() => navigate(`/asset-management/vit-inspection-form/${asset.id}`)}
                      className="mt-4"
                    >
                      Conduct First Inspection
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {inspections
                      .sort((a, b) => new Date(b.inspectionDate).getTime() - new Date(a.inspectionDate).getTime())
                      .map((inspection) => (
                      <InspectionRecord
                        key={inspection.id}
                        inspection={inspection}
                        asset={asset}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        getRegionName={getRegionName}
                        getDistrictName={getDistrictName}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
