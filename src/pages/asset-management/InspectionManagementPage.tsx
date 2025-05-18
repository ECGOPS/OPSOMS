import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubstationInspection } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import { Eye, Pencil, Trash2, FileText, Download, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { formatDate } from "@/utils/calculations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportSubstationInspectionToPDF } from "@/utils/pdfExport";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PermissionService } from '@/services/PermissionService';

export default function InspectionManagementPage() {
  const { user } = useAuth();
  const { regions, districts, savedInspections, deleteInspection } = useData();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const permissionService = PermissionService.getInstance();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter districts based on selected region
  const filteredDistricts = useMemo(() => {
    if (!selectedRegion) return districts;
    return districts.filter(d => d.regionId === selectedRegion);
  }, [districts, selectedRegion]);

  const filteredInspections = useMemo(() => {
    if (!savedInspections) return [];
    
    let filtered = savedInspections;
    
    // Apply role-based filtering
    if (user?.role === 'regional_engineer') {
      filtered = filtered.filter(inspection => inspection.region === user.region);
    } else if (user?.role === 'district_engineer' || user?.role === 'technician') {
      filtered = filtered.filter(inspection => inspection.district === user.district);
    }
    
    // Apply date filter
    if (selectedDate) {
      filtered = filtered.filter(inspection => {
        const inspectionDate = new Date(inspection.date);
        return inspectionDate.toDateString() === selectedDate.toDateString();
      });
    }
    
    // Apply month filter
    if (selectedMonth) {
      filtered = filtered.filter(inspection => {
        const inspectionDate = new Date(inspection.date);
        return inspectionDate.getMonth() === selectedMonth.getMonth() && 
               inspectionDate.getFullYear() === selectedMonth.getFullYear();
      });
    }
    
    // Apply region filter (for global engineer and admin)
    if (selectedRegion && (user?.role === 'global_engineer' || user?.role === 'system_admin')) {
      // Find the region name corresponding to the selectedRegion ID
      const regionName = regions.find(r => r.id === selectedRegion)?.name;
      if (regionName) {
        filtered = filtered.filter(inspection => inspection.region === regionName);
      }
    }
    
    // Apply district filter (for regional engineer and above)
    if (selectedDistrict && 
        (user?.role === 'global_engineer' || 
         user?.role === 'system_admin' || 
         user?.role === 'regional_engineer')) {
      // Find the district name corresponding to the selectedDistrict ID
      const districtName = districts.find(d => d.id === selectedDistrict)?.name;
      if (districtName) {
        filtered = filtered.filter(inspection => inspection.district === districtName);
      }
    }
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(inspection => 
        inspection.substationNo.toLowerCase().includes(term) ||
        inspection.region.toLowerCase().includes(term) ||
        inspection.district.toLowerCase().includes(term)
      );
    }
    
    // Sort by date (and inspectionDate) descending so most recent is first
    filtered = filtered.slice().sort((a, b) => {
      // Prefer inspectionDate if available, else fallback to date
      const dateA = new Date(a.inspectionDate || a.date);
      const dateB = new Date(b.inspectionDate || b.date);
      return dateB.getTime() - dateA.getTime();
    });
    
    return filtered;
  }, [savedInspections, user, selectedDate, selectedMonth, selectedRegion, selectedDistrict, searchTerm]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredInspections.length / itemsPerPage);
  const paginatedInspections = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredInspections.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredInspections, currentPage]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, selectedMonth, selectedRegion, selectedDistrict, searchTerm]);

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedDate(null);
    setSelectedMonth(null);
    setSelectedRegion(null);
    setSelectedDistrict(null);
    setSearchTerm("");
  };

  const handleView = (id: string) => {
    navigate(`/asset-management/inspection-details/${id}`);
  };

  const handleEdit = (id: string) => {
    navigate(`/asset-management/edit-inspection/${id}`);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this inspection?")) {
      deleteInspection(id);
      toast.success("Inspection deleted successfully");
    }
  };

  const handleExportToPDF = async (inspection: SubstationInspection) => {
    try {
      console.log('Attempting to export inspection to PDF:', inspection.id);
      await exportSubstationInspectionToPDF(inspection);
      toast.success("PDF report generated successfully");
    } catch (error) {
      console.error("Error in handleExportToPDF:", error);
      if (error instanceof Error) {
        toast.error(`Failed to generate PDF: ${error.message}`);
      } else {
        toast.error("Failed to generate PDF report. Please check the console for details.");
      }
    }
  };

  const handleExportToCSV = (inspection: SubstationInspection) => {
    // Create CSV content
    const csvContent = [
      ["Substation Inspection Report"],
      ["Date", formatDate(inspection.date)],
      ["Substation No", inspection.substationNo],
      ["Region", inspection.region],
      ["District", inspection.district],
      ["Type", inspection.type],
      [],
      ["Inspection Items"],
      ["Category", "Item", "Status", "Remarks"]
    ];

    // Add inspection items
    inspection.items.forEach(item => {
      csvContent.push([
        item.category,
        item.name,
        item.status,
        item.remarks || ""
      ]);
    });

    // Convert to CSV string
    const csvString = csvContent.map(row => row.join(",")).join("\n");
    
    // Create and download file
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `substation-inspection-${inspection.substationNo}-${formatDate(inspection.date)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("CSV report generated successfully");
  };

  const handleExportAllToCSV = () => {
    // Create CSV content
    const csvContent = [
      ["Substation Inspections Report"],
      ["Generated on", new Date().toLocaleDateString()],
      [],
      ["Inspection Details"],
      ["Date", "Substation No", "Substation Name", "Region", "District", "Type", "Created By", "Created At", "Good Items", "Bad Items", "Total Items", "Percentage Good"]
    ];

    // Add each inspection
    filteredInspections.forEach(inspection => {
      const goodItems = inspection.items.filter(item => item.status === "good").length;
      const badItems = inspection.items.filter(item => item.status === "bad").length;
      const totalItems = inspection.items.length;
      const percentageGood = totalItems > 0 ? (goodItems / totalItems) * 100 : 0;

      csvContent.push([
        formatDate(inspection.date),
        inspection.substationNo,
        inspection.substationName || "Not specified",
        inspection.region,
        inspection.district,
        inspection.type,
        inspection.createdBy || "Unknown",
        inspection.createdAt ? new Date(inspection.createdAt).toLocaleString() : "Unknown",
        goodItems.toString(),
        badItems.toString(),
        totalItems.toString(),
        percentageGood.toFixed(1) + "%"
      ]);

      // Add checklist items
      csvContent.push([]);
      csvContent.push(["Checklist Items"]);
      csvContent.push(["Category", "Item Name", "Status", "Remarks"]);
      
      inspection.items.forEach(item => {
        csvContent.push([
          item.category,
          item.name,
          item.status,
          item.remarks || ""
        ]);
      });

      csvContent.push([]);
    });

    // Convert to CSV string
    const csvString = csvContent.map(row => row.join(",")).join("\n");
    
    // Create and download file
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `substation-inspections-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("All inspections exported to CSV successfully");
  };

  const handleExportAllToPDF = async () => {
    try {
      // Create a single PDF with all inspections
      const doc = await PDFDocument.create();
      const page = doc.addPage([595.28, 841.89]); // A4 size
      const { width, height } = page.getSize();
      const fontSize = 11;
      const lineHeight = fontSize * 1.5;
      const margin = 40;
      const contentWidth = width - (margin * 2);
      let y = height - margin;

      // Embed fonts
      const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
      const regularFont = await doc.embedFont(StandardFonts.Helvetica);

      // Add header with title
      page.drawText("ECG ASSET MANAGEMENT SYSTEM", {
        x: margin,
        y,
        size: 18,
        color: rgb(0, 0.2, 0.4),
        font: boldFont,
      });

      page.drawText("SUBSTATION INSPECTION REPORT", {
        x: margin,
        y: y - lineHeight,
        size: 14,
        color: rgb(0.3, 0.3, 0.3),
        font: regularFont,
      });

      y -= lineHeight * 2;

      // Add report metadata
      const metadata = [
        { label: "Report Generated", value: new Date().toLocaleString() },
        { label: "Total Inspections", value: filteredInspections.length.toString() },
        { label: "Report Period", value: `${formatDate(filteredInspections[0]?.date)} to ${formatDate(filteredInspections[filteredInspections.length - 1]?.date)}` },
      ];

      metadata.forEach(item => {
        page.drawText(item.label + ":", {
          x: margin,
          y,
          size: fontSize,
          color: rgb(0.3, 0.3, 0.3),
          font: boldFont,
        });

        page.drawText(item.value, {
          x: margin + 150,
          y,
          size: fontSize,
          color: rgb(0, 0, 0),
          font: regularFont,
        });
        y -= lineHeight;
      });

      y -= lineHeight * 2;

      // Add executive summary
      page.drawText("EXECUTIVE SUMMARY", {
        x: margin,
        y,
        size: fontSize + 2,
        color: rgb(0, 0.2, 0.4),
        font: boldFont,
      });

      y -= lineHeight * 1.5;

      // Calculate overall statistics
      const totalItems = filteredInspections.reduce((sum, inspection) => sum + inspection.items.length, 0);
      const totalGoodItems = filteredInspections.reduce((sum, inspection) => 
        sum + inspection.items.filter(item => item.status === "good").length, 0);
      const totalBadItems = filteredInspections.reduce((sum, inspection) => 
        sum + inspection.items.filter(item => item.status === "bad").length, 0);
      const overallPercentageGood = totalItems > 0 ? (totalGoodItems / totalItems) * 100 : 0;

      const summaryText = [
        `Total Substations Inspected: ${filteredInspections.length}`,
        `Total Items Checked: ${totalItems}`,
        `Items in Good Condition: ${totalGoodItems} (${overallPercentageGood.toFixed(1)}%)`,
        `Items Requiring Attention: ${totalBadItems} (${(100 - overallPercentageGood).toFixed(1)}%)`,
      ];

      summaryText.forEach(text => {
        page.drawText(text, {
          x: margin + 20,
          y,
          size: fontSize,
          color: rgb(0, 0, 0),
          font: regularFont,
        });
        y -= lineHeight;
      });

      y -= lineHeight * 2;

      // Add each inspection
      for (const inspection of filteredInspections) {
        // Check if we need a new page
        if (y < margin + 200) {
          const newPage = doc.addPage([595.28, 841.89]);
          y = height - margin;
        }

        // Add inspection header
        page.drawText(`SUBSTATION INSPECTION: ${inspection.substationNo}`, {
          x: margin,
          y,
          size: fontSize + 2,
          color: rgb(0, 0.2, 0.4),
          font: boldFont,
        });
        y -= lineHeight * 1.5;

        // Add inspection details
        const details = [
          { label: "Date", value: formatDate(inspection.date) },
          { label: "Region", value: inspection.region },
          { label: "District", value: inspection.district },
          { label: "Type", value: inspection.type },
          { label: "Substation Name", value: inspection.substationName || "Not specified" },
          { label: "Inspected By", value: inspection.createdBy || "Unknown" },
          { label: "Inspection Date", value: inspection.createdAt ? new Date(inspection.createdAt).toLocaleString() : "Unknown" },
        ];

        details.forEach(detail => {
          page.drawText(detail.label + ":", {
            x: margin,
            y,
            size: fontSize,
            color: rgb(0.3, 0.3, 0.3),
            font: boldFont,
          });

          page.drawText(detail.value, {
            x: margin + 150,
            y,
            size: fontSize,
            color: rgb(0, 0, 0),
            font: regularFont,
          });
          y -= lineHeight;
        });

        y -= lineHeight;

        // Add checklist items by category
        const categories = [...new Set(inspection.items.map(item => item.category))];
        
        categories.forEach(category => {
          // Check if we need a new page for this category
          if (y < margin + 150) {
            const newPage = doc.addPage([595.28, 841.89]);
            y = height - margin;
          }

          // Add category header
          page.drawText(category.toUpperCase(), {
            x: margin,
            y,
            size: fontSize + 1,
            color: rgb(0, 0.2, 0.4),
            font: boldFont,
          });
          y -= lineHeight * 1.2;

          const categoryItems = inspection.items.filter(item => item.category === category);
          categoryItems.forEach(item => {
            // Check if we need a new page for this item
            if (y < margin + 100) {
              const newPage = doc.addPage([595.28, 841.89]);
              y = height - margin;
            }

            const status = item.status === "good" ? "[PASS]" : "[FAIL]";
            const statusColor = item.status === "good" ? rgb(0, 0.5, 0) : rgb(0.8, 0, 0);
            
            page.drawText(status, {
              x: margin,
              y,
              size: fontSize,
              color: statusColor,
              font: boldFont,
            });

            page.drawText(item.name, {
              x: margin + 60,
              y,
              size: fontSize,
              color: rgb(0, 0, 0),
              font: regularFont,
            });
            y -= lineHeight;

            if (item.remarks) {
              page.drawText(`Remarks: ${item.remarks}`, {
                x: margin + 60,
                y,
                size: fontSize - 1,
                color: rgb(0.3, 0.3, 0.3),
                font: regularFont,
              });
              y -= lineHeight;
            }
          });

          y -= lineHeight;
        });

        // Add inspection summary
        page.drawText("INSPECTION SUMMARY", {
          x: margin,
          y,
          size: fontSize + 1,
          color: rgb(0, 0.2, 0.4),
          font: boldFont,
        });
        y -= lineHeight * 1.2;

        const goodItems = inspection.items.filter(item => item.status === "good").length;
        const badItems = inspection.items.filter(item => item.status === "bad").length;
        const totalItems = inspection.items.length;
        const percentageGood = totalItems > 0 ? (goodItems / totalItems) * 100 : 0;

        const summaryDetails = [
          `Items in Good Condition: ${goodItems} (${percentageGood.toFixed(1)}%)`,
          `Items Requiring Attention: ${badItems} (${(100 - percentageGood).toFixed(1)}%)`,
          `Overall Condition: ${percentageGood >= 80 ? "Excellent" : percentageGood >= 60 ? "Good" : "Needs Attention"}`,
        ];

        summaryDetails.forEach(detail => {
          page.drawText(detail, {
            x: margin + 20,
            y,
            size: fontSize,
            color: rgb(0, 0, 0),
            font: regularFont,
          });
          y -= lineHeight;
        });

        y -= lineHeight * 2;
      }

      // Add footer with page numbers
      const pages = doc.getPages();
      pages.forEach((page, index) => {
        const { width } = page.getSize();
        page.drawText(`Page ${index + 1} of ${pages.length}`, {
          x: width - margin - 50,
          y: margin - 20,
          size: fontSize - 1,
          color: rgb(0.3, 0.3, 0.3),
          font: regularFont,
        });
      });

      // Save the PDF
      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `substation-inspections-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("All inspections exported to PDF successfully");
    } catch (error) {
      toast.error("Failed to generate PDF report");
      console.error("Error generating PDF:", error);
    }
  };

  // Check if user can edit an inspection
  const canEditInspection = (inspection: SubstationInspection) => {
    return permissionService.canUpdateFeature(user?.role || null, 'inspection_management');
  };

  // Check if user can delete an inspection
  const canDeleteInspection = (inspection: SubstationInspection) => {
    return permissionService.canDeleteFeature(user?.role || null, 'inspection_management');
  };

  return (
    <Layout>
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Substation Inspections</h1>
          <div className="flex space-x-4">
            <Button 
              onClick={() => navigate("/asset-management/substation-inspection")}
              variant="default"
            >
              New Inspection
            </Button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="space-y-2">
            <Label>Date</Label>
            <DatePicker
              value={selectedDate}
              onChange={setSelectedDate}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Month</Label>
            <DatePicker
              value={selectedMonth}
              onChange={setSelectedMonth}
              picker="month"
            />
          </div>
          
          {(user?.role === 'global_engineer' || user?.role === 'system_admin') && (
            <div className="space-y-2">
              <Label>Region</Label>
              <div className="w-full">
                <Select
                  value={selectedRegion}
                  onValueChange={setSelectedRegion}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map(region => (
                      <SelectItem key={region.id} value={region.id}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          {(user?.role === 'global_engineer' || 
            user?.role === 'system_admin' || 
            user?.role === 'regional_engineer') && (
            <div className="space-y-2">
              <Label>District</Label>
              <div className="w-full">
                <Select
                  value={selectedDistrict}
                  onValueChange={setSelectedDistrict}
                  disabled={!selectedRegion && user?.role !== 'regional_engineer'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDistricts.map(district => (
                      <SelectItem key={district.id} value={district.id}>
                        {district.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Reset Filters Button */}
        <div className="flex justify-end mb-4">
          <Button
            variant="outline"
            onClick={handleResetFilters}
            disabled={!selectedDate && !selectedMonth && !selectedRegion && !selectedDistrict && !searchTerm}
          >
            Reset Filters
          </Button>
        </div>
        
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle>Search Inspections</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Search by substation number, region or district..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </CardContent>
        </Card>
        
        <div className="rounded-md border">
          <Table>
            <TableCaption>List of all substation inspections</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Substation No</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>District</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status Summary</TableHead>
                <TableHead>Sync Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedInspections.length > 0 ? (
                paginatedInspections.map((inspection) => {
                  // Calculate counts directly from inspection.items, handling undefined
                  const goodItems = inspection.items ? inspection.items.filter(item => item?.status === "good").length : 0;
                  const badItems = inspection.items ? inspection.items.filter(item => item?.status === "bad").length : 0;
                  const statusSummary = (
                    <div className="flex items-center gap-1">
                      <span className="text-green-600 font-medium">{goodItems} good</span>
                      <span>/</span>
                      <span className="text-red-600 font-medium">{badItems} bad</span>
                    </div>
                  );

                  const syncStatus = inspection.syncStatus === 'pending' ? (
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-600 font-medium">Pending</span>
                      <span className="text-xs text-muted-foreground">(Offline)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-green-600 font-medium">Synced</span>
                    </div>
                  );
                  
                  return (
                    <TableRow
                      key={inspection.id}
                      onClick={e => {
                        // Prevent row click if clicking inside the Actions cell
                        if ((e.target as HTMLElement).closest('td')?.classList.contains('actions-cell')) return;
                        navigate(`/asset-management/inspection-details/${inspection.id}`);
                      }}
                      className="cursor-pointer hover:bg-muted transition-colors"
                    >
                      <TableCell>{formatDate(inspection.date)}</TableCell>
                      <TableCell>{inspection.substationNo}</TableCell>
                      <TableCell>{inspection.region}</TableCell>
                      <TableCell>{inspection.district}</TableCell>
                      <TableCell className="capitalize">{inspection.type}</TableCell>
                      <TableCell>{statusSummary}</TableCell>
                      <TableCell>{syncStatus}</TableCell>
                      <TableCell className="text-right actions-cell">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => navigate(`/asset-management/inspection-details/${inspection.id}`)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportToPDF(inspection)}>
                              <FileText className="mr-2 h-4 w-4" />
                              Export to PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportToCSV(inspection)}>
                              <Download className="mr-2 h-4 w-4" />
                              Export to CSV
                            </DropdownMenuItem>
                            {canEditInspection(inspection) && (
                              <>
                                <DropdownMenuItem onClick={() => navigate(`/asset-management/edit-inspection/${inspection.id}`)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {canDeleteInspection(inspection) && (
                                  <DropdownMenuItem 
                                    onClick={() => handleDelete(inspection.id)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4">
                    No inspections found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredInspections.length)} of {filteredInspections.length} inspections
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center space-x-1">
              <span className="text-sm">Page</span>
              <Select
                value={currentPage.toString()}
                onValueChange={(value) => setCurrentPage(parseInt(value))}
              >
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue placeholder={currentPage.toString()} />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <SelectItem key={page} value={page.toString()}>
                      {page}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm">of {totalPages}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
