import { useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Settings, IdCard } from "lucide-react";
import { UsersList } from "@/components/user-management/UsersList";
import { DistrictPopulationForm } from "@/components/user-management/DistrictPopulationForm";
import { StaffIdManagement } from "@/components/user-management/StaffIdManagement";
import { AccessControlWrapper } from "@/components/access-control/AccessControlWrapper";
import { Button } from "@/components/ui/button";

export default function UserManagementPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isDistrictPopulationRoute = location.pathname === "/district-population";
  const isStaffIdsRoute = location.pathname === "/staff-ids";
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    
    // District engineers can only update their district population
    if (user?.role === "district_engineer") {
      if (!isDistrictPopulationRoute) {
        navigate("/district-population");
      }
    } else if (user?.role === "regional_engineer") {
      if (!isDistrictPopulationRoute) {
        navigate("/dashboard");
      }
    } else if (user?.role !== "system_admin" && user?.role !== "global_engineer") {
      navigate("/dashboard");
    }

    // Redirect non-system admins from staff IDs page
    if (isStaffIdsRoute && user?.role !== "system_admin") {
      navigate("/dashboard");
    }
  }, [isAuthenticated, user, navigate, isDistrictPopulationRoute, isStaffIdsRoute]);
  
  if (!isAuthenticated) {
    return null;
  }

  // Set default tab based on user role
  const defaultTab = user?.role === "district_engineer" ? "district-population" : "users";

  const isSystemAdmin = user?.role === "system_admin";

  return (
    <Layout>
      <div className="container mx-auto p-4">
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-2xl font-bold">User Management</h1>
            {isSystemAdmin && (
              <Button onClick={() => navigate('/system-admin/permissions')}>
                Manage Permissions
              </Button>
            )}
          </div>
          
          <Tabs defaultValue="users" className="w-full">
            <TabsList className="w-full flex flex-col sm:flex-row h-auto sm:h-10">
              <TabsTrigger value="users" className="w-full sm:w-auto py-2 sm:py-0">
                Users
              </TabsTrigger>
              <TabsTrigger value="staff-ids" className="w-full sm:w-auto py-2 sm:py-0">
                Staff IDs
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="users" className="mt-4">
              <AccessControlWrapper requiredRole="global_engineer">
                <UsersList />
              </AccessControlWrapper>
            </TabsContent>
            
            <TabsContent value="staff-ids" className="mt-4">
              <AccessControlWrapper requiredRole="system_admin">
                <StaffIdManagement />
              </AccessControlWrapper>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
