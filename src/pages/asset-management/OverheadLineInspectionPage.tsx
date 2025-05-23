import { useState, useEffect, useMemo } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OverheadLineInspectionForm } from "@/components/overhead-line/OverheadLineInspectionForm";
import { OverheadLineInspectionsTable } from "@/components/overhead-line/OverheadLineInspectionsTable";
import { PlusCircle } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { OverheadLineInspection } from "@/lib/types";
import { OverheadLineInspectionDetails } from "@/components/overhead-line/OverheadLineInspectionDetails";
import { AccessControlWrapper } from "@/components/access-control/AccessControlWrapper";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { InspectionDetailsView } from "@/components/inspection/InspectionDetailsView";
import { useNavigate } from "react-router-dom";

export default function OverheadLineInspectionPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("inspections");
  const [isInspectionFormOpen, setIsInspectionFormOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<OverheadLineInspection | null>(null);
  const [editingInspection, setEditingInspection] = useState<OverheadLineInspection | null>(null);
  const { overheadLineInspections, updateOverheadLineInspection, deleteOverheadLineInspection, addOverheadLineInspection, districts, regions } = useData();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const navigate = useNavigate();

  // Filter districts based on selected region
  const filteredDistricts = useMemo(() => {
    if (!selectedRegion) return districts;
    return districts.filter(d => d.regionId === selectedRegion);
  }, [districts, selectedRegion]);

  // Filter inspections based on user's role and assigned district/region
  const filteredInspections = useMemo(() => {
    if (!overheadLineInspections) return [];
    
    let filtered = overheadLineInspections;
    
    // Apply role-based filtering
    if (user?.role === 'district_engineer' || user?.role === 'technician') {
      filtered = filtered.filter(inspection => inspection.district === user.district);
    } else if (user?.role === 'regional_engineer') {
      filtered = filtered.filter(inspection => inspection.region === user.region);
    }
    
    // Apply date filter
    if (selectedDate) {
      filtered = filtered.filter(inspection => {
        const inspectionDate = new Date(inspection.date || inspection.createdAt);
        return inspectionDate.toDateString() === selectedDate.toDateString();
      });
    }
    
    // Apply month filter
    if (selectedMonth) {
      filtered = filtered.filter(inspection => {
        const inspectionDate = new Date(inspection.date || inspection.createdAt);
        return inspectionDate.getMonth() === selectedMonth.getMonth() && 
               inspectionDate.getFullYear() === selectedMonth.getFullYear();
      });
    }
    
    // Apply region filter (for global engineer and admin)
    if (selectedRegion && (user?.role === 'global_engineer' || user?.role === 'system_admin')) {
      filtered = filtered.filter(inspection => inspection.region === selectedRegion);
    }
    
    // Apply district filter (for regional engineer and above)
    if (selectedDistrict && 
        (user?.role === 'global_engineer' || 
         user?.role === 'system_admin' || 
         user?.role === 'regional_engineer')) {
      filtered = filtered.filter(inspection => inspection.district === selectedDistrict);
    }
    
    return filtered;
  }, [overheadLineInspections, user, selectedDate, selectedMonth, selectedRegion, selectedDistrict]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredInspections.length / pageSize);
  const paginatedInspections = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInspections.slice(start, start + pageSize);
  }, [filteredInspections, currentPage, pageSize]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, selectedMonth, selectedRegion, selectedDistrict, overheadLineInspections]);

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedDate(null);
    setSelectedMonth(null);
    setSelectedRegion(null);
    setSelectedDistrict(null);
  };

  const handleAddInspection = () => {
    setEditingInspection(null);
    setIsInspectionFormOpen(true);
  };

  const handleInspectionFormClose = () => {
    setIsInspectionFormOpen(false);
    setEditingInspection(null);
  };

  const handleViewInspection = (inspection: OverheadLineInspection) => {
    setSelectedInspection(inspection);
    setIsDetailsDialogOpen(true);
  };

  const handleEditInspection = (inspection: OverheadLineInspection) => {
    setEditingInspection(inspection);
    setIsInspectionFormOpen(true);
  };

  const handleDeleteInspection = async (inspection: OverheadLineInspection) => {
    try {
      await deleteOverheadLineInspection(inspection.id);
      toast.success("Inspection deleted successfully");
    } catch (error) {
      toast.error("Failed to delete inspection");
    }
  };

  const handleFormSubmit = async (inspection: OverheadLineInspection) => {
    try {
      if (editingInspection) {
        await updateOverheadLineInspection(editingInspection.id, inspection);
        toast.success("Inspection updated successfully");
      } else {
        await addOverheadLineInspection(inspection);
        toast.success("Inspection created successfully");
      }
      setIsInspectionFormOpen(false);
      setEditingInspection(null);
    } catch (error) {
      toast.error(editingInspection ? "Failed to update inspection" : "Failed to create inspection");
    }
  };

  return (
    <AccessControlWrapper type="inspection">
      <Layout>
        <div className="container py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Overhead Line Inspection</h1>
              <p className="text-muted-foreground mt-1">
                Manage and monitor overhead line inspections
              </p>
            </div>
            {(user?.role === 'global_engineer' || user?.role === 'district_engineer' || user?.role === 'regional_engineer' || user?.role === 'technician' || user?.role === 'system_admin') && (
              <Button onClick={handleAddInspection} className="mt-4 md:mt-0">
                <PlusCircle className="mr-2 h-4 w-4" />
                New Inspection
              </Button>
            )}
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
              disabled={!selectedDate && !selectedMonth && !selectedRegion && !selectedDistrict}
            >
              Reset Filters
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-1">
              <TabsTrigger value="inspections">Inspection Records</TabsTrigger>
            </TabsList>

            <TabsContent value="inspections" className="space-y-4">
              <OverheadLineInspectionsTable 
                inspections={paginatedInspections}
                onEdit={handleEditInspection}
                onDelete={handleDeleteInspection}
                onView={handleViewInspection}
                userRole={user?.role}
              />
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <Pagination className="mt-4">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={e => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1)); }}
                        aria-disabled={currentPage === 1}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <PaginationItem key={i}>
                        <PaginationLink
                          href="#"
                          isActive={currentPage === i + 1}
                          onClick={e => { e.preventDefault(); setCurrentPage(i + 1); }}
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={e => { e.preventDefault(); setCurrentPage(p => Math.min(totalPages, p + 1)); }}
                        aria-disabled={currentPage === totalPages}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </TabsContent>
          </Tabs>

          {/* Inspection Form Sheet */}
          <Sheet open={isInspectionFormOpen} onOpenChange={setIsInspectionFormOpen}>
            <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>
                  {editingInspection ? "Edit Overhead Line Inspection" : "New Overhead Line Inspection"}
                </SheetTitle>
                <SheetDescription>
                  {editingInspection ? "Update the inspection details." : "Complete the inspection checklist for the overhead line."}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6">
                <OverheadLineInspectionForm
                  inspection={editingInspection}
                  onSubmit={handleFormSubmit}
                  onCancel={handleInspectionFormClose}
                />
              </div>
            </SheetContent>
          </Sheet>

          {/* Inspection Details Dialog */}
          <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Overhead Line Inspection Details</DialogTitle>
                <DialogDescription>
                  Inspection performed on {selectedInspection 
                    ? (selectedInspection.date 
                       ? selectedInspection.date
                       : selectedInspection.createdAt && !isNaN(new Date(selectedInspection.createdAt).getTime())
                         ? new Date(selectedInspection.createdAt).toLocaleDateString()
                         : "today")
                    : ""}
                </DialogDescription>
              </DialogHeader>
              {selectedInspection && (
                <InspectionDetailsView
                  inspection={selectedInspection}
                  showHeader={false}
                  showBackButton={false}
                  onEdit={() => navigate(`/asset-management/overhead-line/edit/${selectedInspection.id}`)}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </Layout>
    </AccessControlWrapper>
  );
} 