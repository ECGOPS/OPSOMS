import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { toast } from "@/components/ui/sonner";
import { UserRole } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Plus, Download, Upload, Search, Users, Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getFirestore, getDocs, collection, getCountFromServer, query, orderBy, limit, startAt } from "firebase/firestore";

export type StaffIdEntry = {
  id: string;
  name: string;
  role: UserRole;
  region?: string;
  district?: string;
};

export function StaffIdManagement() {
  const { staffIds, setStaffIds, addStaffId, updateStaffId, deleteStaffId } = useAuth();
  const { regions, districts } = useData();
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newEntry, setNewEntry] = useState<Omit<StaffIdEntry, "id"> & { customId?: string }>({
    name: "",
    role: "technician",
    region: undefined,
    district: undefined,
    customId: undefined
  });
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredStaffIds, setFilteredStaffIds] = useState(staffIds);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [districtFilter, setDistrictFilter] = useState<string>("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  // Optimize initial data loading with pagination
  useEffect(() => {
    const loadInitialData = async () => {
      if (isInitialLoad) {
        setIsLoading(true);
        try {
          const db = getFirestore();
          const staffIdsRef = collection(db, "staffIds");
          
          // Get total count
          const countSnapshot = await getCountFromServer(staffIdsRef);
          setTotalItems(countSnapshot.data().count);

          // Get first page
          const q = query(
            staffIdsRef,
            orderBy("name"),
            limit(pageSize)
          );
          
          const staffIdsSnapshot = await getDocs(q);
          const staffIdsList: StaffIdEntry[] = [];
          staffIdsSnapshot.forEach((doc) => {
            staffIdsList.push({ id: doc.id, ...doc.data() } as StaffIdEntry);
          });
          
          setStaffIds(staffIdsList);
          setFilteredStaffIds(staffIdsList);
        } catch (error) {
          console.error("Error loading staff IDs:", error);
          toast.error("Failed to load staff IDs");
        } finally {
          setIsLoading(false);
          setIsInitialLoad(false);
        }
      }
    };

    loadInitialData();
  }, [isInitialLoad, setStaffIds, pageSize]);

  // Optimize search filtering with pagination
  useEffect(() => {
    if (!staffIds) return;
    
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = staffIds.filter(idObj => {
      const matchesSearch = 
        idObj.id.toLowerCase().includes(lowerCaseSearchTerm) ||
        idObj.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        (idObj.region && idObj.region.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (idObj.district && idObj.district.toLowerCase().includes(lowerCaseSearchTerm));

      const matchesRole = roleFilter === "all" || idObj.role === roleFilter;
      const matchesRegion = regionFilter === "all" || idObj.region === regionFilter;
      const matchesDistrict = districtFilter === "all" || idObj.district === districtFilter;

      return matchesSearch && matchesRole && matchesRegion && matchesDistrict;
    });

    setTotalItems(filtered.length);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    setFilteredStaffIds(filtered.slice(startIndex, endIndex));
  }, [staffIds, searchTerm, roleFilter, regionFilter, districtFilter, currentPage, pageSize]);

  // Optimize refresh function with pagination
  const refreshStaffIds = useCallback(async () => {
    setIsLoading(true);
    try {
      const db = getFirestore();
      const staffIdsRef = collection(db, "staffIds");
      
      // Get total count
      const countSnapshot = await getCountFromServer(staffIdsRef);
      setTotalItems(countSnapshot.data().count);

      // Get current page
      const q = query(
        staffIdsRef,
        orderBy("name"),
        limit(pageSize),
        startAt((currentPage - 1) * pageSize)
      );
      
      const staffIdsSnapshot = await getDocs(q);
      const staffIdsList: StaffIdEntry[] = [];
      staffIdsSnapshot.forEach((doc) => {
        staffIdsList.push({ id: doc.id, ...doc.data() } as StaffIdEntry);
      });
      
      setStaffIds(staffIdsList);
      setFilteredStaffIds(staffIdsList);
      toast.success(`${staffIdsList.length} staff IDs loaded`);
    } catch (error) {
      console.error("Error refreshing staff IDs:", error);
      toast.error("Failed to refresh staff IDs");
    } finally {
      setIsLoading(false);
    }
  }, [setStaffIds, currentPage, pageSize]);

  // Optimize add function
  const handleAdd = async () => {
    setError(null);
    if (!validateEntry(newEntry)) return;

    try {
      const staffIdData = {
        ...newEntry,
        customId: newEntry.customId?.trim() || undefined
      };
      
      await addStaffId(staffIdData);
      setIsAdding(false);
      resetForm();
      toast.success("Staff ID added successfully");
    } catch (error) {
      console.error("Staff ID add error:", error);
      setError(error instanceof Error ? error.message : "Failed to add staff ID");
    }
  };

  // Optimize update function
  const handleUpdate = async (id: string) => {
    setError(null);
    const entry = staffIds.find(e => e.id === id);
    if (!entry) return;

    if (!validateEntry(entry)) return;

    try {
      await updateStaffId(id, {
        name: entry.name,
        role: entry.role,
        region: entry.region,
        district: entry.district
      });
      setIsEditing(null);
      toast.success("Staff ID updated successfully");
    } catch (error) {
      setError((error as Error).message);
    }
  };

  // Optimize delete function
  const handleDelete = async (id: string) => {
    try {
      await deleteStaffId(id);
      toast.success("Staff ID deleted successfully");
    } catch (error) {
      setError((error as Error).message);
    }
  };

  // Validation helper
  const validateEntry = (entry: Omit<StaffIdEntry, "id">) => {
    if (!entry.name) {
      setError("Name is required");
      return false;
    }
    if (!entry.role) {
      setError("Role is required");
      return false;
    }
    if (entry.role !== "global_engineer" && entry.role !== "system_admin" && !entry.region) {
      setError("Region is required for this role");
      return false;
    }
    if ((entry.role === "district_engineer" || entry.role === "technician") && !entry.district) {
      setError("District is required for district engineers and technicians");
      return false;
    }
    return true;
  };

  // Reset form helper
  const resetForm = () => {
    setNewEntry({
      name: "",
      role: "technician",
      region: undefined,
      district: undefined,
      customId: undefined
    });
    setIsAdding(false);
    setIsEditing(null);
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case "district_engineer":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "regional_engineer":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case "global_engineer":
        return "bg-purple-100 text-purple-800 hover:bg-purple-100";
      case "system_admin":
        return "bg-red-100 text-red-800 hover:bg-red-100";
      case "technician":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100";
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case "district_engineer":
        return "District Engineer";
      case "regional_engineer":
        return "Regional Engineer";
      case "global_engineer":
        return "Global Engineer";
      case "system_admin":
        return "System Administrator";
      case "technician":
        return "Technician";
      default:
        return "Unknown Role";
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const text = await file.text();
      const rows = text.split('\n').map(row => row.trim()).filter(row => row);
      
      // Skip header row
      const dataRows = rows.slice(1);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const row of dataRows) {
        const [name, role, region, district, customId] = row.split(',').map(cell => cell.trim());
        
        try {
          // Validate role is a valid UserRole
          if (!['system_admin', 'global_engineer', 'regional_engineer', 'district_engineer', 'technician'].includes(role)) {
            throw new Error(`Invalid role: ${role}`);
          }

          addStaffId({
            name,
            role: role as UserRole,
            region,
            district,
            customId: customId || undefined
          });
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`Failed to add staff: ${name}`, error);
        }
      }
      
      toast.success(`Upload complete: ${successCount} successful, ${errorCount} failed`);
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error('Failed to process the CSV file');
    } finally {
      setIsUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const downloadSample = () => {
    const sampleData = `name,role,region,district,customId
John Doe,regional_engineer,Greater Accra,,ECG001
Jane Smith,district_engineer,Ashanti,Kumasi,ECG002
Mike Johnson,technician,Western,Takoradi,ECG003
Sarah Williams,global_engineer,,,ECG004
Kwame Asante,technician,Central,Cape Coast,ECG005
Admin User,system_admin,,,ECGADMIN`;

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'staff_id_sample.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Add reset filters function
  const resetFilters = () => {
    setSearchTerm("");
    setRoleFilter("all");
    setRegionFilter("all");
    setDistrictFilter("all");
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Staff ID Management</CardTitle>
        <CardDescription className="mb-6">
          Manage staff IDs and their associated information
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <Alert>
          <AlertTitle>CSV Upload Guide</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>You can upload staff information using a CSV file with the following format:</p>
            <ul className="list-disc pl-4">
              <li>First row must be headers: name,role,region,district,customId</li>
              <li>Each subsequent row represents one staff member</li>
              <li>Fields should be separated by commas</li>
              <li>Leave district empty for regional engineers</li>
              <li>Leave region and district empty for global engineers and system administrators</li>
              <li>Custom ID is optional (6-10 alphanumeric characters)</li>
            </ul>
            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={downloadSample} className="w-full sm:w-auto">
                <Download className="w-4 h-4 mr-2" />
                Download Sample CSV
              </Button>
              <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                <Label htmlFor="csv-upload">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload CSV
                  <input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                </Label>
              </Button>
            </div>
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-auto sm:min-w-[300px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search staff IDs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-full"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={refreshStaffIds} disabled={isLoading} className="w-full sm:w-auto">
                {isLoading ? "Loading..." : "Refresh"}
              </Button>
              <Button onClick={() => setIsAdding(true)} className="w-full sm:w-auto">Add New Staff ID</Button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium text-muted-foreground">Filters</h3>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={resetFilters}
                className="text-xs"
              >
                Reset Filters
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Filter by Role</Label>
                <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as UserRole | "all")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="system_admin">System Admin</SelectItem>
                    <SelectItem value="global_engineer">Global Engineer</SelectItem>
                    <SelectItem value="regional_engineer">Regional Engineer</SelectItem>
                    <SelectItem value="district_engineer">District Engineer</SelectItem>
                    <SelectItem value="technician">Technician</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Filter by Region</Label>
                <Select value={regionFilter} onValueChange={setRegionFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    {regions?.map(region => (
                      <SelectItem key={region.id} value={region.name}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Filter by District</Label>
                <Select value={districtFilter} onValueChange={setDistrictFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Districts</SelectItem>
                    {districts
                      ?.filter(d => regionFilter === "all" || d.regionId === regions?.find(r => r.name === regionFilter)?.id)
                      ?.map(district => (
                        <SelectItem key={district.id} value={district.name}>
                          {district.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-2">
            <div className="flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-md">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm">Total Staff:</span>
              <span className="font-bold text-primary">{staffIds.length}</span>
            </div>
            <div className="flex items-center gap-2 bg-muted/10 px-4 py-2 rounded-md">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Showing:</span>
              <span className="font-bold text-muted-foreground">{filteredStaffIds.length}</span>
              {filteredStaffIds.length !== staffIds.length && (
                <span className="text-sm text-muted-foreground">of {staffIds.length}</span>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {isAdding && (
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="text-lg font-semibold">Add New Staff ID</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Custom Staff ID (Optional)</Label>
                <Input
                  value={newEntry.customId || ""}
                  onChange={(e) => setNewEntry({ ...newEntry, customId: e.target.value })}
                  placeholder="Enter custom ID (6-10 alphanumeric characters)"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to generate an ECGXXX format ID
                </p>
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  value={newEntry.name}
                  onChange={(e) => setNewEntry({ ...newEntry, name: e.target.value })}
                  placeholder="Enter name"
                  className="w-full"
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select
                  value={newEntry.role}
                  onValueChange={(value) => setNewEntry({ ...newEntry, role: value as UserRole })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system_admin">System Admin</SelectItem>
                    <SelectItem value="global_engineer">Global Engineer</SelectItem>
                    <SelectItem value="regional_engineer">Regional Engineer</SelectItem>
                    <SelectItem value="district_engineer">District Engineer</SelectItem>
                    <SelectItem value="technician">Technician</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newEntry.role !== "global_engineer" && newEntry.role !== "system_admin" && (
                <>
                  <div>
                    <Label>Region</Label>
                    <Select
                      value={newEntry.region}
                      onValueChange={(value) => setNewEntry({ ...newEntry, region: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        {regions?.map(region => (
                          <SelectItem key={region.id} value={region.name}>
                            {region.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(newEntry.role === "district_engineer" || newEntry.role === "technician") && newEntry.region && (
                    <div>
                      <Label>District</Label>
                      <Select
                        value={newEntry.district}
                        onValueChange={(value) => setNewEntry({ ...newEntry, district: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select district" />
                        </SelectTrigger>
                        <SelectContent>
                          {districts
                            ?.filter(d => d.regionId === regions?.find(r => r.name === newEntry.region)?.id)
                            ?.map(district => (
                              <SelectItem key={district.id} value={district.name}>
                                {district.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAdding(false)} className="w-full sm:w-auto">Cancel</Button>
              <Button onClick={handleAdd} className="w-full sm:w-auto">Add</Button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Registered Staff IDs</h3>
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-10">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="mt-4 text-sm text-muted-foreground">Loading staff IDs...</p>
            </div>
          ) : filteredStaffIds.length === 0 ? (
            <div className="text-center p-10">
              <p className="text-muted-foreground">No staff IDs found</p>
              <p className="text-sm mt-2">Create a new staff ID by clicking the "Add New Staff ID" button above</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Staff ID</TableHead>
                      <TableHead className="whitespace-nowrap">Name</TableHead>
                      <TableHead className="whitespace-nowrap">Role</TableHead>
                      <TableHead className="whitespace-nowrap">Region</TableHead>
                      <TableHead className="whitespace-nowrap">District</TableHead>
                      <TableHead className="whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaffIds.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap">{entry.id}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {isEditing === entry.id ? (
                            <Input
                              value={entry.name}
                              onChange={(e) => {
                                const updatedEntry = { ...entry, name: e.target.value };
                                updateStaffId(entry.id, updatedEntry);
                              }}
                              className="w-full"
                            />
                          ) : (
                            entry.name
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {isEditing === entry.id ? (
                            <Select
                              value={entry.role}
                              onValueChange={(value) => {
                                const updatedEntry = { ...entry, role: value as UserRole };
                                updateStaffId(entry.id, updatedEntry);
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="system_admin">System Admin</SelectItem>
                                <SelectItem value="global_engineer">Global Engineer</SelectItem>
                                <SelectItem value="regional_engineer">Regional Engineer</SelectItem>
                                <SelectItem value="district_engineer">District Engineer</SelectItem>
                                <SelectItem value="technician">Technician</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={getRoleBadgeColor(entry.role)}>
                              {getRoleLabel(entry.role)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {isEditing === entry.id ? (
                            <Select
                              value={entry.region}
                              onValueChange={(value) => {
                                const updatedEntry = { ...entry, region: value, district: undefined };
                                updateStaffId(entry.id, updatedEntry);
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select region" />
                              </SelectTrigger>
                              <SelectContent>
                                {regions?.map(region => (
                                  <SelectItem key={region.id} value={region.name}>
                                    {region.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            entry.region || "-"
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {isEditing === entry.id ? (
                            <Select
                              value={entry.district}
                              onValueChange={(value) => {
                                const updatedEntry = { ...entry, district: value };
                                updateStaffId(entry.id, updatedEntry);
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select district" />
                              </SelectTrigger>
                              <SelectContent>
                                {districts
                                  ?.filter(d => d.regionId === regions?.find(r => r.name === entry.region)?.id)
                                  ?.map(district => (
                                    <SelectItem key={district.id} value={district.name}>
                                      {district.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            entry.district || "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {isEditing === entry.id ? (
                              <>
                                <Button variant="outline" size="sm" onClick={() => setIsEditing(null)} className="w-full sm:w-auto">Cancel</Button>
                                <Button size="sm" onClick={() => handleUpdate(entry.id)} className="w-full sm:w-auto">Save</Button>
                              </>
                            ) : (
                              <>
                                <Button variant="outline" size="sm" onClick={() => setIsEditing(entry.id)} className="w-full sm:w-auto">Edit</Button>
                                <Button variant="destructive" size="sm" onClick={() => handleDelete(entry.id)} className="w-full sm:w-auto">Delete</Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination Controls */}
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} entries
                  </p>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => {
                      setPageSize(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue placeholder={pageSize.toString()} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalItems / pageSize)))}
                    disabled={currentPage === Math.ceil(totalItems / pageSize)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 