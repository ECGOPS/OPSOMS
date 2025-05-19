import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useData } from "@/contexts/DataContext";
import { VITAssetForm } from "@/components/vit/VITAssetForm";
import { toast } from "@/components/ui/sonner";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VITAsset } from "@/lib/types";

export default function EditVITAssetPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vitAssets } = useData();
  const [asset, setAsset] = useState<VITAsset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (id) {
      const foundAsset = vitAssets.find(a => a.id === id);
      if (foundAsset) {
        setAsset(foundAsset);
        setIsLoading(false);
      } else {
        toast.error("Asset not found");
        navigate("/asset-management/vit-inspection");
      }
    }
  }, [id, vitAssets, navigate]);
  
  const handleSubmit = () => {
    toast.success("Asset updated successfully");
    navigate(`/asset-management/vit-inspection-details/${id}`);
  };
  
  const handleCancel = () => {
    navigate(`/asset-management/vit-inspection-details/${id}`);
  };
  
  if (isLoading) {
    return (
      <Layout>
        <div className="container py-8">
          <p>Loading asset data...</p>
        </div>
      </Layout>
    );
  }
  
  if (!asset) {
    return (
      <Layout>
        <div className="container py-8">
          <p>Asset not found</p>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <div className="container py-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate(`/asset-management/vit-inspection-details/${id}`)}
          className="mb-4"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Asset Details
        </Button>
        
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Edit VIT Asset</h1>
          <p className="text-muted-foreground mt-1">
            Update the asset information
          </p>
        </div>
        
        <div className="rounded-lg border shadow-sm p-6">
          <VITAssetForm
            asset={asset}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </Layout>
  );
} 