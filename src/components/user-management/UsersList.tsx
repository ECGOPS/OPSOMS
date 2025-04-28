import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { User, UserRole } from "@/lib/types";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData } from "@/contexts/DataContext";
import { EditIcon, PlusCircle, Trash2, Copy, KeyRound, Search } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { validateUserRoleAssignment, getFilteredRegionsAndDistricts } from "@/utils/user-utils";
import { hashPassword } from "@/utils/security";
import { getFirestore, getDocs, collection } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";

export function UsersList() {
  const { user: currentUser, users, setUsers, addUser, updateUser, deleteUser, toggleUserStatus, adminResetUserPassword } = useAuth();
  const { regions, districts } = useData();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // New user form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>(null);
  const [newRegion, setNewRegion] = useState("");
  const [newDistrict, setNewDistrict] = useState("");
  const [tempPassword, setTempPassword] = useState<string>("");
  const [showCredentials, setShowCredentials] = useState(false);
  const [showTempPasswordDialog, setShowTempPasswordDialog] = useState(false);
  const [tempPasswordInfo, setTempPasswordInfo] = useState<{ tempPassword: string; email: string } | null>(null);
  
  // Check if current user is system admin or global engineer
  const isSystemAdmin = currentUser?.role === "system_admin";
  const isGlobalEngineer = currentUser?.role === "global_engineer";
  const canManageUsers = isSystemAdmin || isGlobalEngineer;
  
  const [filteredUsers, setFilteredUsers] = useState<User[]>(users);
  const [searchTerm, setSearchTerm] = useState('');
  
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
  
  // Function to generate a random temporary password
  const generateTempPassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }
    return password;
  };
  
  const handleAddUser = async () => {
    if (!newName || !newEmail || !newRole) {
      toast.error("Please fill all required fields");
      return;
    }
    
    // For system admin and global engineer, skip region/district validation
    if (newRole !== "system_admin" && newRole !== "global_engineer") {
      const validation = validateUserRoleAssignment(newRole, newRegion, newDistrict, regions, districts);
      if (!validation.isValid) {
        toast.error(validation.error);
        return;
      }
    }

    // Generate temporary password
    const tempPass = generateTempPassword();
    setTempPassword(tempPass);
    
    try {
      // Find region and district IDs
      const region = regions.find(r => r.name === newRegion);
      const district = districts.find(d => d.name === newDistrict && d.regionId === region?.id);
      
      const newUserData: Omit<User, "id"> = {
      name: newName,
      email: newEmail,
      role: newRole,
      region: (newRole !== "system_admin" && newRole !== "global_engineer") ? newRegion : undefined,
        regionId: (newRole !== "system_admin" && newRole !== "global_engineer") ? region?.id : undefined,
        district: (newRole === "district_engineer" || newRole === "technician") ? newDistrict : undefined,
        districtId: (newRole === "district_engineer" || newRole === "technician") ? district?.id : undefined,
      tempPassword: tempPass,
      mustChangePassword: true,
      password: hashPassword(tempPass)
    };
    
      // Add user to Firestore via AuthContext function
      await addUser(newUserData);
    
    resetForm();
    setIsAddDialogOpen(false);
    setShowCredentials(true);
    } catch (error) {
      console.error("Error adding user:", error);
    }
  };
  
  const handleEditUser = async () => {
    if (!selectedUser) return;
    
    if (!newName || !newEmail || !newRole) {
      toast.error("Please fill all required fields");
      return;
    }
    
    // For system admin and global engineer, skip region/district validation
    if (newRole !== "system_admin" && newRole !== "global_engineer") {
      const validation = validateUserRoleAssignment(newRole, newRegion, newDistrict, regions, districts);
      if (!validation.isValid) {
        toast.error(validation.error);
        return;
      }
    }
    
    try {
      // Find region and district IDs
      let regionId = '';
      let districtId = '';
      
      if (newRegion) {
        const region = regions.find(r => r.name === newRegion);
        if (region) {
          regionId = region.id;
        }
      }
      
      if (newDistrict && regionId) {
        const district = districts.find(d => d.name === newDistrict && d.regionId === regionId);
        if (district) {
          districtId = district.id;
        }
      }
      
      // Update user in Firestore via AuthContext function
      await updateUser(selectedUser.id, {
        name: newName,
        email: newEmail,
        role: newRole,
        region: (newRole !== "system_admin" && newRole !== "global_engineer") ? newRegion : undefined,
        regionId: (newRole !== "system_admin" && newRole !== "global_engineer") ? regionId : undefined,
        district: (newRole === "district_engineer" || newRole === "technician") ? newDistrict : undefined,
        districtId: (newRole === "district_engineer" || newRole === "technician") ? districtId : undefined
      });
    
      resetForm();
      setIsEditDialogOpen(false);
      toast.success("User updated successfully");
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    }
  };
  
  const handleDeleteUser = async () => {
    if (!selectedUser || !isSystemAdmin) return;
    
    try {
      // Delete user from Firestore via AuthContext function
      await deleteUser(selectedUser.id);
      
    setSelectedUser(null);
    setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };
  
  const handleDisableUser = async (user: User) => {
    if (!user || !isSystemAdmin) return;
    
    try {
      // Toggle user status in Firestore via AuthContext function
      await toggleUserStatus(user.id, !user.disabled);
    } catch (error) {
      console.error("Error toggling user status:", error);
    }
  };
  
  const handleResetPassword = async (userId: string) => {
    try {
      const result = await adminResetUserPassword(userId);
      if (result.tempPassword) {
        setTempPasswordInfo(result);
        setShowTempPasswordDialog(true);
      }
    } catch (error) {
      console.error("Error resetting password:", error);
    }
  };
  
  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setNewName(user.name);
    setNewEmail(user.email);
    setNewRole(user.role);
    setNewRegion(user.region || "");
    setNewDistrict(user.district || "");
    setIsEditDialogOpen(true);
  };
  
  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };
  
  const resetForm = () => {
    setNewName("");
    setNewEmail("");
    setNewRole(null);
    setNewRegion("");
    setNewDistrict("");
    setSelectedUser(null);
  };
  
  // Get filtered regions and districts based on user role
  const { filteredRegions, filteredDistricts } = getFilteredRegionsAndDistricts(
    currentUser,
    regions,
    districts,
    newRegion ? regions.find(r => r.name === newRegion)?.id : undefined
  );

  // Simplified district filtering - just get districts for the selected region
  const availableDistricts = newRegion
    ? districts.filter(d => {
        const selectedRegion = regions.find(r => r.name === newRegion);
        return d.regionId === selectedRegion?.id;
      })
    : [];
  
  // Function to manually fetch users data
  const fetchUsersManually = useCallback(async () => {
    setIsLoading(true);
    console.log("UsersList: Manual fetch initiated");
    try {
      // Direct fetch of users collection
      const db = getFirestore();
      const usersSnapshot = await getDocs(collection(db, "users"));
      const usersList: User[] = [];
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        usersList.push({
          id: doc.id,
          name: data.name || '',
          email: data.email || '',
          role: data.role || 'technician',
          region: data.region || undefined,
          regionId: data.regionId || undefined,
          district: data.district || undefined,
          districtId: data.districtId || undefined,
          staffId: data.staffId || undefined,
          disabled: data.disabled || false,
          mustChangePassword: data.mustChangePassword || false,
          lastActive: data.lastActive || null,
          lastIpAddress: data.lastIpAddress || null
        });
      });
      console.log(`UsersList: Manually fetched ${usersList.length} users`);
      setUsers(usersList);
      toast.success(`${usersList.length} users loaded successfully`);
    } catch (error) {
      console.error("Manual fetch error:", error);
      toast.error("Failed to load users data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [setUsers]);
  
  // When region changes, reset district selection
  useEffect(() => {
    setNewDistrict("");
  }, [newRegion]);
  
  // Fetch users when component mounts
  useEffect(() => {
    console.log("UsersList: Component mounted, fetching users data");
    fetchUsersManually();
  }, [fetchUsersManually]);
  
  // Monitor users array and update loading state
  useEffect(() => {
    if (users && users.length > 0) {
      setIsLoading(false);
    }
  }, [users]);
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };
  
  // Recalculate filtered users when search term or original users list changes
  useEffect(() => {
    if (!users) return;
    
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = users.filter(user => {
      // Check against multiple fields
      return (
        user.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        user.email.toLowerCase().includes(lowerCaseSearchTerm) ||
        (user.staffId && user.staffId.toLowerCase().includes(lowerCaseSearchTerm)) ||
        user.role.toLowerCase().includes(lowerCaseSearchTerm)
      );
    });
    setFilteredUsers(filtered);
  }, [users, searchTerm]);
  
  return (
    <div className="space-y-4">
      {/* Search and Add User Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-auto sm:min-w-[300px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 w-full"
          />
        </div>
        {canManageUsers && (
          <Button onClick={() => setIsAddDialogOpen(true)} className="w-full sm:w-auto">
            <PlusCircle size={16} className="mr-2" />
            Add User
          </Button>
        )}
      </div>
      
      {/* Users Table Section */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading user data...</p>
        </div>
      ) : users && users.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>List of system users</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Name</TableHead>
                    <TableHead className="whitespace-nowrap">Email</TableHead>
                    <TableHead className="whitespace-nowrap">Role</TableHead>
                    <TableHead className="whitespace-nowrap">Region</TableHead>
                    <TableHead className="whitespace-nowrap">District</TableHead>
                    <TableHead className="whitespace-nowrap">Staff ID</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="whitespace-nowrap">{user.name}</TableCell>
                        <TableCell className="whitespace-nowrap">{user.email}</TableCell>
                        <TableCell>
                          <Badge className={getRoleBadgeColor(user.role)}>
                            {getRoleLabel(user.role)}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{user.region || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{user.district || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{user.staffId || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={user.disabled ? "destructive" : "default"}>
                            {user.disabled ? "Disabled" : "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {canManageUsers && (
                              <>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => openEditDialog(user)}
                                  className="h-8 w-8"
                                >
                                  <EditIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleResetPassword(user.id)}
                                  className="h-8 w-8"
                                >
                                  <KeyRound className="h-4 w-4" />
                                </Button>
                                {isSystemAdmin && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => openDeleteDialog(user)}
                                    className="h-8 w-8"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}
                            {isSystemAdmin && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDisableUser(user)}
                                className="h-8"
                              >
                                {user.disabled ? "Enable" : "Disable"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">
                        {searchTerm ? 'No users match your search.' : 'No users found.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-10 border rounded-lg">
          <p className="text-muted-foreground">No users found</p>
          <p className="text-sm mt-2">Create a new user by clicking the "Add User" button above</p>
        </div>
      )}
      
      {/* Add User Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Fill in the details to create a new user account.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={newRole || ""} onValueChange={(value) => setNewRole(value as UserRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system_admin">System Administrator</SelectItem>
                  <SelectItem value="global_engineer">Global Engineer</SelectItem>
                  <SelectItem value="regional_engineer">Regional Engineer</SelectItem>
                  <SelectItem value="district_engineer">District Engineer</SelectItem>
                  <SelectItem value="technician">Technician</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {(newRole === "district_engineer" || newRole === "regional_engineer" || newRole === "technician") && (
              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Select value={newRegion} onValueChange={setNewRegion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredRegions.map(region => (
                      <SelectItem key={region.id} value={region.name}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {(newRole === "district_engineer" || newRole === "technician") && newRegion && (
              <div className="space-y-2">
                <Label htmlFor="district">District</Label>
                <Select value={newDistrict} onValueChange={setNewDistrict}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDistricts.map(district => (
                      <SelectItem key={district.id} value={district.name}>
                        {district.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                resetForm();
                setIsAddDialogOpen(false);
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddUser}
              className="w-full sm:w-auto"
            >
              Add User
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Credentials Dialog */}
      <Dialog open={showCredentials} onOpenChange={setShowCredentials}>
        <DialogContent className="w-[95vw] sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>New User Credentials</DialogTitle>
            <DialogDescription>
              Please provide these credentials to the new user. They will be required to change their password on first login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <div className="flex items-center space-x-2">
                <Input value={newEmail} readOnly />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(newEmail)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Temporary Password</Label>
              <div className="flex items-center space-x-2">
                <Input value={tempPassword} readOnly />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(tempPassword)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowCredentials(false)} className="w-full sm:w-auto">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Temporary Password Dialog */}
      <Dialog open={showTempPasswordDialog} onOpenChange={setShowTempPasswordDialog}>
        <DialogContent className="w-[95vw] sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Temporary Password</DialogTitle>
            <DialogDescription>
              Please provide these credentials to the user. They will be required to change their password on first login.
            </DialogDescription>
          </DialogHeader>
          {tempPasswordInfo && (
            <div className="space-y-4">
              <div>
                <Label>Email</Label>
                <div className="flex items-center space-x-2">
                  <Input value={tempPasswordInfo.email} readOnly />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(tempPasswordInfo.email)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Temporary Password</Label>
                <div className="flex items-center space-x-2">
                  <Input value={tempPasswordInfo.tempPassword} readOnly />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(tempPasswordInfo.tempPassword)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowTempPasswordDialog(false)} className="w-full sm:w-auto">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details and permissions
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                placeholder="John Doe"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="john@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={newRole || ""} onValueChange={(value) => setNewRole(value as UserRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system_admin">System Administrator</SelectItem>
                  <SelectItem value="global_engineer">Global Engineer</SelectItem>
                  <SelectItem value="regional_engineer">Regional Engineer</SelectItem>
                  <SelectItem value="district_engineer">District Engineer</SelectItem>
                  <SelectItem value="technician">Technician</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {(newRole === "regional_engineer" || newRole === "district_engineer" || newRole === "technician") && (
              <div className="space-y-2">
                <Label htmlFor="edit-region">Region</Label>
                <Select value={newRegion} onValueChange={setNewRegion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map(region => (
                      <SelectItem key={region.id} value={region.name}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {(newRole === "district_engineer" || newRole === "technician") && newRegion && (
              <div className="space-y-2">
                <Label htmlFor="edit-district">District</Label>
                <Select value={newDistrict} onValueChange={setNewDistrict}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    {districts
                      .filter(d => d.regionId === regions.find(r => r.name === newRegion)?.id)
                      .map(district => (
                        <SelectItem key={district.id} value={district.name}>
                          {district.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                resetForm();
                setIsEditDialogOpen(false);
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleEditUser}
              className="w-full sm:w-auto"
            >
              Update User
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Delete User Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="py-2">
              <p><strong>Name:</strong> {selectedUser.name}</p>
              <p><strong>Email:</strong> {selectedUser.email}</p>
              <p><strong>Role:</strong> {getRoleLabel(selectedUser.role)}</p>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setSelectedUser(null);
                setIsDeleteDialogOpen(false);
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteUser}
              className="w-full sm:w-auto"
            >
              Delete User
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
