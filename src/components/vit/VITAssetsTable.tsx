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
import { MoreHorizontal, FileText, Edit, Trash2, Download, Search, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.ceil(filteredAssets.length / pageSize);

  useEffect(() => {
    const sourceAssets = propAssets || vitAssets;
    // Use a Map to ensure unique assets by ID
    const uniqueAssets = new Map<string, VITAsset>();
    sourceAssets.forEach(asset => {
      if (!uniqueAssets.has(asset.id)) {
        uniqueAssets.set(asset.id, asset);
      }
    });
    
    const uniqueAssetsArray = Array.from(uniqueAssets.values());
    
    if (searchTerm) {
      setFilteredAssets(
        uniqueAssetsArray.filter(
          (asset) =>
            asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            asset.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
            asset.typeOfUnit.toLowerCase().includes(searchTerm.toLowerCase()) ||
            asset.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
            asset.district.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredAssets(uniqueAssetsArray);
    }
    // Reset to first page when search term changes
    setCurrentPage(1);
  }, [searchTerm, propAssets, vitAssets]);

  // Get current page items
  const currentItems = filteredAssets.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

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

  const confirmDelete = async () => {
    if (assetToDelete) {
      try {
        await deleteVITAsset(assetToDelete.id);
        setIsDeleteDialogOpen(false);
        setAssetToDelete(null);
      } catch (error) {
        console.error("Error deleting asset:", error);
      }
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
      "Feeder Name",
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
      asset.feederName || "Not specified",
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
            {currentItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                  {searchTerm 
                    ? "No assets found matching your search criteria" 
                    : "No VIT assets found. Add some to get started!"}
                </TableCell>
              </TableRow>
            ) : (
              currentItems.map((asset, index) => (
                <TableRow
                  key={`vit-asset-${asset.id}-${index}`}
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

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
        <div className="flex items-center space-x-2">
          <p className="text-sm text-muted-foreground hidden sm:block">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredAssets.length)} of {filteredAssets.length} assets
          </p>
          <p className="text-sm text-muted-foreground sm:hidden">
            {filteredAssets.length} assets
          </p>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50].map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="hidden sm:inline-flex"
          >
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium">{currentPage}</span>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">{totalPages}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="hidden sm:inline-flex"
          >
            Last
          </Button>
        </div>
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
