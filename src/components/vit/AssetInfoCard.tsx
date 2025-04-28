import { VITAsset } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState } from "react";

interface AssetInfoCardProps {
  asset: VITAsset;
  getRegionName: (id: string) => string;
  getDistrictName: (id: string) => string;
}

export const AssetInfoCard = ({ asset, getRegionName, getDistrictName }: AssetInfoCardProps) => {
  const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState(false);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Region</p>
              <p className="text-base">{asset.region}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">District</p>
              <p className="text-base">{asset.district}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Voltage Level</p>
              <p className="text-base">{asset.voltageLevel}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Type of Unit</p>
              <p className="text-base">{asset.typeOfUnit}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Serial Number</p>
              <p className="text-base">{asset.serialNumber}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Location</p>
              <p className="text-base">{asset.location}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">GPS Coordinates</p>
              <p className="text-base">{asset.gpsCoordinates}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <p className="text-base">{asset.status}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Protection</p>
              <p className="text-base">{asset.protection}</p>
            </div>
          </div>
          
          {asset.photoUrl && (
            <div className="mt-6">
              <p className="text-sm font-medium text-muted-foreground mb-2">Asset Photo</p>
              <img 
                src={asset.photoUrl} 
                alt={`${asset.typeOfUnit} - ${asset.serialNumber}`}
                className="w-full h-auto rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setIsPhotoDialogOpen(true)}
              />
            </div>
          )}

          <Dialog open={isPhotoDialogOpen} onOpenChange={setIsPhotoDialogOpen}>
            <DialogContent className="max-w-4xl">
              {asset.photoUrl && (
                <img 
                  src={asset.photoUrl} 
                  alt={`${asset.typeOfUnit} - ${asset.serialNumber}`}
                  className="w-full h-auto rounded-md"
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
};
