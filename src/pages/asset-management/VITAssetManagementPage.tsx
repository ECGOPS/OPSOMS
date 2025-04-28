import React, { useState, useEffect } from 'react';
import { AccessControlWrapper } from '@/components/access-control/AccessControlWrapper';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { VITAssetList } from '@/components/asset-management/VITAssetList';
import { Skeleton } from '@/components/ui/skeleton';

export function VITAssetManagementPage() {
  const { user } = useAuth();
  const { vitAssets, regions, districts } = useData();
  const [isLoading, setIsLoading] = useState(true);
  const [filteredAssets, setFilteredAssets] = useState([]);

  // Filter assets based on user's role and region/district
  useEffect(() => {
    if (vitAssets && regions && districts) {
      const filtered = vitAssets.filter(asset => {
        if (user?.role === 'global_engineer') return true;
        if (user?.role === 'regional_engineer') {
          return asset.region === user.region;
        }
        if (user?.role === 'district_engineer' || user?.role === 'technician') {
          return asset.district === user.district;
        }
        return false;
      });
      setFilteredAssets(filtered);
      setIsLoading(false);
    }
  }, [vitAssets, regions, districts, user]);

  if (isLoading) {
    return (
      <AccessControlWrapper type="asset">
        <div className="container mx-auto p-4">
          <div className="flex justify-between items-center mb-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </div>
      </AccessControlWrapper>
    );
  }

  return (
    <AccessControlWrapper type="asset">
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">VIT Asset Management</h1>
          <Button asChild>
            <Link to="/asset-management/add">Add New Asset</Link>
          </Button>
        </div>
        
        <VITAssetList assets={filteredAssets} />
      </div>
    </AccessControlWrapper>
  );
} 