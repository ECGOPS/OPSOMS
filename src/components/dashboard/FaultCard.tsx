import { useState } from "react";
import { OP5Fault, ControlSystemOutage } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDuration } from "@/utils/calculations";
import { AlertTriangle, BarChart, Clock, MapPin, Users, CheckCircle2, XCircle, Edit, Trash2, FileText } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import { useNavigate } from "react-router-dom";
import { PermissionService } from "@/services/PermissionService";

// Type augmentation to fix type errors
interface EnhancedOP5Fault extends OP5Fault {
  mttr?: number;
}

interface EnhancedControlSystemOutage extends ControlSystemOutage {
  unservedEnergyMWh?: number;
}

type FaultCardProps = {
  fault: OP5Fault | ControlSystemOutage;
  type: "op5" | "control";
};

export function FaultCard({ fault, type }: FaultCardProps) {
  const { regions, districts, resolveFault, deleteFault, canEditFault } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const permissionService = PermissionService.getInstance();
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  const region = regions.find(r => r.id === fault.regionId);
  const district = districts.find(d => d.id === fault.districtId);
  
  const isOP5 = type === "op5";
  const op5Fault = isOP5 ? fault as EnhancedOP5Fault : null;
  const controlOutage = !isOP5 ? fault as EnhancedControlSystemOutage : null;
  
  const getTotalAffectedCustomers = () => {
    if (isOP5 && op5Fault?.affectedPopulation) {
      return op5Fault.affectedPopulation.rural + 
             op5Fault.affectedPopulation.urban + 
             op5Fault.affectedPopulation.metro;
    } else if (!isOP5 && controlOutage?.customersAffected) {
      return controlOutage.customersAffected.rural + 
             controlOutage.customersAffected.urban + 
             controlOutage.customersAffected.metro;
    }
    return 'N/A';
  };
  
  const getBadgeColor = (type: string) => {
    switch (type) {
      case "Planned":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case "Unplanned":
        return "bg-red-100 text-red-800 hover:bg-red-100";
      case "Emergency":
        return "bg-orange-100 text-orange-800 hover:bg-orange-100";
      case "Load Shedding":
        return "bg-purple-100 text-purple-800 hover:bg-purple-100";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100";
    }
  };
  
  const getCardColors = (faultType: string) => {
    switch (faultType) {
      case "Planned":
        return "border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-800/30";
      case "Unplanned":
        return "border-l-4 border-l-red-500 bg-gradient-to-br from-red-50 to-white dark:from-red-950/30 dark:to-gray-800/30";
      case "Emergency":
        return "border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/30 dark:to-gray-800/30";
      case "Load Shedding":
        return "border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-gray-800/30";
      case "GridCo Outage":
        return "border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-gray-800/30";
      default:
        return "border-l-4 border-l-gray-500 bg-gradient-to-br from-gray-50 to-white dark:from-gray-950/30 dark:to-gray-800/30";
    }
  };
  
  const statusClass = fault.status === "active" 
    ? "bg-red-100 text-red-800 border border-red-200" 
    : "bg-green-100 text-green-800 border border-green-200";
  
  const durationText = fault.occurrenceDate && fault.restorationDate 
    ? formatDuration((new Date(fault.restorationDate).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60))
    : "Ongoing";
  
  const canResolve = () => {
    if (fault.status === "resolved") return false;
    
    // Check if user has permission to manage faults
    const feature = isOP5 ? 'fault_reporting' : 'fault_reporting';
    if (!user || !permissionService.canAccessFeature(user.role, feature)) {
      return false;
    }
    
    // Technicians can resolve faults in their district
    if (user.role === "technician") {
      return user.district === district?.name;
    }
    
    // District engineers for their district or higher roles can resolve
    if (user.role === "district_engineer") {
      return user.district === district?.name;
    }
    
    // Regional engineers can resolve in their region
    if (user.role === "regional_engineer") {
      return user.region === region?.name;
    }
    
    // Global engineers and system admins can resolve anywhere
    return user.role === "global_engineer" || user.role === "system_admin";
  };

  const canEdit = () => {
    return canEditFault(fault);
  };

  const canDelete = () => {
    // Check if user has permission to manage faults
    const feature = isOP5 ? 'fault_reporting_delete' : 'fault_reporting_delete';
    if (!user || !permissionService.canAccessFeature(user.role, feature)) {
      return false;
    }
    
    // Technicians can delete faults in their district
    if (user.role === "technician") {
      return user.district === district?.name;
    }
    
    // District engineers for their district or higher roles can delete
    if (user.role === "district_engineer") {
      return user.district === district?.name;
    }
    
    // Regional engineers can delete in their region
    if (user.role === "regional_engineer") {
      return user.region === region?.name;
    }
    
    // Global engineers and system admins can delete anywhere
    return user.role === "global_engineer" || user.role === "system_admin";
  };
  
  const affectedPopulation = op5Fault?.affectedPopulation || { rural: 0, urban: 0, metro: 0 };
  
  const handleResolve = () => {
    // Check if user has permission to manage faults
    const feature = isOP5 ? 'fault_reporting' : 'fault_reporting';
    if (user && !permissionService.canAccessFeature(user.role, feature)) {
      toast.error("You don't have permission to resolve faults");
      return;
    }
    
    resolveFault(fault.id, isOP5);
    setIsResolveOpen(false);
    toast.success("Fault has been marked as resolved");
  };

  const handleDelete = () => {
    // Check if user has permission to manage faults
    const feature = isOP5 ? 'fault_reporting' : 'fault_reporting';
    if (user && !permissionService.canAccessFeature(user.role, feature)) {
      toast.error("You don't have permission to delete faults");
      return;
    }
    
    deleteFault(fault.id, isOP5);
    setIsDeleteOpen(false);
    toast.success("Fault has been deleted");
  };
  
  const handleEdit = () => {
    if (!canEdit()) {
      toast.error("You don't have permission to edit this fault");
      return;
    }
    
    if (isOP5) {
      navigate(`/edit-op5-fault/${fault.id}`);
    } else {
      navigate(`/edit-control-outage/${fault.id}`);
    }
  };
  
  return (
    <Card className={`h-full flex flex-col shadow-md hover:shadow-lg transition-all duration-200 ease-out hover:scale-[1.01] overflow-hidden ${getCardColors(fault.faultType)}`}>
      <CardHeader className="p-4 pb-2 bg-white/80 dark:bg-gray-800/50">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold">
            {isOP5 ? "OP5 Fault" : "Control System Outage"}
          </CardTitle>
          <Badge className={`${statusClass} shadow-sm`}>
            {fault.status === "active" ? "Active" : "Resolved"}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-1">
          <MapPin size={14} className="text-muted-foreground" />
          {region?.name}, {district?.name}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-4 flex-grow">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge className={getBadgeColor(fault.faultType)}>
              {fault.faultType}
            </Badge>
            {(fault as any).specificFaultType && (
              <Badge variant="outline" className="text-xs">
                {(fault as any).specificFaultType}
              </Badge>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock size={14} />
              <span>Duration: {durationText}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users size={14} />
              <span>Affected: {getTotalAffectedCustomers().toLocaleString()} customers</span>
            </div>
            
            {isOP5 && op5Fault?.mttr && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BarChart size={14} />
                <span>MTTR: {formatDuration(op5Fault.mttr)}</span>
              </div>
            )}
            
            {!isOP5 && controlOutage?.unservedEnergyMWh && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BarChart size={14} />
                <span>Unserved Energy: {controlOutage.unservedEnergyMWh.toFixed(2)} MWh</span>
              </div>
            )}
          </div>
          
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="details" className="border-b-0">
              <AccordionTrigger className="text-sm py-2">View Details</AccordionTrigger>
              <AccordionContent className="text-xs space-y-2 bg-white/50 dark:bg-gray-900/30 p-2 rounded-md">
                <div>
                  <div className="font-medium text-muted-foreground">Occurred:</div>
                  <div>{formatDate(fault.occurrenceDate)}</div>
                </div>
                
                {fault.restorationDate && (
                  <div>
                    <div className="font-medium text-muted-foreground">Restored:</div>
                    <div>{formatDate(fault.restorationDate)}</div>
                  </div>
                )}
                
                {isOP5 && op5Fault?.repairDate && (
                  <div>
                    <div className="font-medium text-muted-foreground">Repair Started:</div>
                    <div>{formatDate(op5Fault.repairDate)}</div>
                  </div>
                )}
                
                {(fault as any).faultLocation && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin size={14} />
                    <span>Location: {(fault as any).faultLocation}</span>
                  </div>
                )}
                
                {(fault as any).outageDescription && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText size={14} />
                    <span>Description: {(fault as any).outageDescription}</span>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-4 bg-white/80 dark:bg-gray-800/50 mt-auto">
        <div className="flex flex-col gap-2 w-full sm:flex-row">
          {canResolve() && (
            <Dialog open={isResolveOpen} onOpenChange={setIsResolveOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1 border-green-200 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-900/30">
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                  Resolve
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Resolve Fault</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to mark this fault as resolved?
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsResolveOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleResolve} className="bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Confirm Resolve
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          
          {canEdit() && (
            <Button 
              variant="outline" 
              className="flex-1 border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30"
              onClick={handleEdit}
            >
              <Edit className="mr-2 h-4 w-4 text-blue-500" />
              Edit
            </Button>
          )}
          
          {canDelete() && (
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1 border-red-200 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/30">
                  <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                  Delete
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Fault</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this fault? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
