import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { VITAsset } from "@/lib/types";
import { formatDate } from "@/utils/calculations";
import { useData } from "@/contexts/DataContext";
import { MoreHorizontal, FileText, Edit, Trash2, Download, Search, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface VITAssetsTableProps {
  assets?: VITAsset[];
  onAddAsset: () => void;
  onEditAsset: (asset: VITAsset) => void;
  onInspect: (assetId: string) => void;
}

export function VITAssetsTable({ assets: propAssets, onAddAsset, onEditAsset, onInspect }: VITAssetsTableProps) {
  const { vitAssets, deleteVITAsset } = useData();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredAssets, setFilteredAssets] = useState<VITAsset[]>(propAssets || vitAssets);
  const [assetToDelete, setAssetToDelete] = useState<VITAsset | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (searchTerm) {
      setFilteredAssets(
        (propAssets || vitAssets).filter(
          (asset) =>
            asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            asset.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
            asset.typeOfUnit.toLowerCase().includes(searchTerm.toLowerCase()) ||
            asset.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
            asset.district.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredAssets(propAssets || vitAssets);
    }
  }, [searchTerm, propAssets, vitAssets]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Operational":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "Under Maintenance":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "Faulty":
        return "bg-red-100 text-red-800 hover:bg-red-100";
      case "Decommissioned":
        return "bg-gray-100 text-gray-800 hover:bg-gray-100";
      default:
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    }
  };

  const handleDeleteClick = (asset: VITAsset) => {
    setAssetToDelete(asset);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (assetToDelete) {
      deleteVITAsset(assetToDelete.id);
      setIsDeleteDialogOpen(false);
      setAssetToDelete(null);
    }
  };

  const handleViewDetails = (assetId: string) => {
    navigate(`/asset-management/vit-inspection-details/${assetId}`);
  };

  const exportToCsv = () => {
    // Create headers row
    const headers = [
      "Serial Number",
      "Type",
      "Voltage Level",
      "Region",
      "District",
      "Location",
      "GPS Coordinates",
      "Status",
      "Protection",
      "Created At"
    ];

    // Create data rows
    const csvData = filteredAssets.map(asset => [
      asset.serialNumber,
      asset.typeOfUnit,
      asset.voltageLevel,
      asset.region || "Unknown Region",
      asset.district || "Unknown District",
      asset.location,
      asset.gpsCoordinates,
      asset.status,
      asset.protection,
      formatDate(asset.createdAt)
    ]);

    // Combine headers and data rows
    const csvContent = [headers.join(","), ...csvData.map(row => row.join(","))].join("\n");

    // Create and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `vit-assets-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 w-full sm:w-[250px]"
          />
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={exportToCsv}
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          
          <Button 
            size="sm" 
            className="flex-1 sm:flex-none"
            onClick={onAddAsset}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Asset
          </Button>
        </div>
      </div>

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-medium">Created At</TableHead>
              <TableHead className="font-medium">Region</TableHead>
              <TableHead className="font-medium">District</TableHead>
              <TableHead className="font-medium">Serial Number</TableHead>
              <TableHead className="font-medium">Type</TableHead>
              <TableHead className="font-medium">Voltage</TableHead>
              <TableHead className="font-medium">Location</TableHead>
              <TableHead className="font-medium">Status</TableHead>
              <TableHead className="text-right font-medium">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                  {searchTerm 
                    ? "No assets found matching your search criteria" 
                    : "No VIT assets found. Add some to get started!"}
                </TableCell>
              </TableRow>
            ) : (
              filteredAssets.map((asset) => (
                <TableRow
                  key={asset.id}
                  onClick={() => handleViewDetails(asset.id)}
                  className="cursor-pointer hover:bg-muted transition-colors"
                >
                  <TableCell>{formatDate(asset.createdAt)}</TableCell>
                  <TableCell>{asset.region || "Unknown Region"}</TableCell>
                  <TableCell>{asset.district || "Unknown District"}</TableCell>
                  <TableCell className="font-medium">{asset.serialNumber}</TableCell>
                  <TableCell>{asset.typeOfUnit}</TableCell>
                  <TableCell>{asset.voltageLevel}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={asset.location}>
                    {asset.location}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(asset.status)}>
                      {asset.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          className="h-8 w-8 p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(asset.id);
                        }}>
                          <FileText className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          onEditAsset(asset);
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Asset
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          onInspect(asset.id);
                        }}>
                          <FileText className="h-4 w-4 mr-2" />
                          Add Inspection
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(asset);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Asset
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the VIT asset "{assetToDelete?.serialNumber}"? This will also delete all associated inspection records. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
