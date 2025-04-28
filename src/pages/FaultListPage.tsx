import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { FaultService } from "@/services/FaultService";
import { Fault } from "@/types/fault";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { PermissionService } from "@/services/PermissionService";

export default function FaultListPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { regions, districts } = useData();
  const [faults, setFaults] = useState<Fault[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const permissionService = PermissionService.getInstance();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    // Check if user has permission to view faults
    if (user && !permissionService.canAccessFeature(user.role, 'fault_reporting')) {
      navigate("/unauthorized");
      return;
    }

    const fetchFaults = async () => {
      try {
        const faultsData = await FaultService.getFaults();
        setFaults(faultsData);
      } catch (err) {
        setError("Failed to load faults");
        console.error("Error loading faults:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFaults();
  }, [isAuthenticated, navigate, user]);

  const handleCreateFault = () => {
    // Check if user has permission to report faults
    if (user && !permissionService.canAccessFeature(user.role, 'fault_reporting')) {
      navigate("/unauthorized");
      return;
    }
    
    navigate("/faults/report");
  };

  if (!isAuthenticated || loading) {
    return null;
  }

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-red-500">{error}</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8">
        <div className="flex flex-col space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Faults</h1>
              <p className="text-muted-foreground mt-1">
                View and manage all reported faults
              </p>
            </div>
            {permissionService.canAccessFeature(user?.role || '', 'fault_reporting') && (
              <Button onClick={handleCreateFault}>Report New Fault</Button>
            )}
          </div>

          <div className="grid gap-4">
            {faults.map((fault) => (
              <Card key={fault.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/faults/${fault.id}`)}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={fault.status === "open" ? "destructive" : "default"}>
                          {fault.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(fault.reportedAt), "PPp")}
                        </span>
                      </div>
                      <h3 className="font-semibold">{fault.type}</h3>
                      <p className="text-sm text-muted-foreground">
                        {regions.find(r => r.id === fault.regionId)?.name || "Unknown"} • {districts.find(d => d.id === fault.districtId)?.name || "Unknown"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={fault.reportedBy.avatar} />
                        <AvatarFallback>
                          {fault.reportedBy.name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{fault.reportedBy.name}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
} 