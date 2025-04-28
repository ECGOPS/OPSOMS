import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, ZapOff, ClipboardList, User, Building2 } from "lucide-react";
import { OP5Form } from "@/components/faults/OP5Form";
import { ControlSystemOutageForm } from "@/components/faults/ControlSystemOutageForm";
import { Card, CardContent } from "@/components/ui/card";
import { useData } from "@/contexts/DataContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getUserRegionAndDistrict } from "@/utils/user-utils";
import { PermissionService } from "@/services/PermissionService";

export default function ReportFaultPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const permissionService = PermissionService.getInstance();
  const { regions, districts } = useData();

  // Get default region and district based on user role
  const { regionId: defaultRegionId, districtId: defaultDistrictId } = getUserRegionAndDistrict(user, regions, districts);

  // Check if user has permission to report faults
  useEffect(() => {
    if (user && !permissionService.canAccessFeature(user.role, 'fault_reporting')) {
      navigate("/unauthorized");
      return;
    }
  }, [user, navigate]);

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  return (
    <Layout>
      <div className="container max-w-5xl py-6 space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-serif">Report Fault</h1>
              <p className="text-muted-foreground">Create a new fault report</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">
                {user?.role?.replace(/_/g, ' ').toUpperCase()}
              </Badge>
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.photoURL || undefined} />
                <AvatarFallback>
                  {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>

        <Card className="border border-border/50 bg-card/50 shadow-sm">
          <CardContent className="p-6">
            <Tabs defaultValue="op5" className="w-full">
              <TabsList className="mb-8 w-full grid grid-cols-2 bg-muted/50 p-1 rounded-md">
                <TabsTrigger value="op5" className="flex items-center gap-1 text-[11px] leading-tight sm:text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">
                  <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-destructive shrink-0" />
                  <span className="truncate">OP5 Fault</span>
                </TabsTrigger>
                <TabsTrigger value="control" className="flex items-center gap-1 text-[11px] leading-tight sm:text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">
                  <ZapOff className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500 shrink-0" />
                  <span className="truncate">Control System Outage</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="op5" className="mt-0">
                <OP5Form 
                  defaultRegionId={defaultRegionId || ""} 
                  defaultDistrictId={defaultDistrictId || ""}
                />
              </TabsContent>
              
              <TabsContent value="control" className="mt-0">
                <ControlSystemOutageForm 
                  defaultRegionId={defaultRegionId || ""} 
                  defaultDistrictId={defaultDistrictId || ""}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
