import { SubstationInspection, OverheadLineInspection } from "@/lib/types";
import { format } from "date-fns";
import { CheckCircle2, AlertCircle, ChevronLeft, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface InspectionDetailsViewProps {
  inspection: SubstationInspection | OverheadLineInspection;
  showHeader?: boolean;
  showBackButton?: boolean;
  onBack?: () => void;
  onEdit?: () => void;
}

export function InspectionDetailsView({
  inspection,
  showHeader = true,
  showBackButton = false,
  onBack,
  onEdit
}: InspectionDetailsViewProps) {
  const isSubstationInspection = (inspection: SubstationInspection | OverheadLineInspection): inspection is SubstationInspection => {
    return 'substationNo' in inspection;
  };

  const getStatusSummary = () => {
    if (!inspection) return { good: 0, requiresAttention: 0 };
    
    if (isSubstationInspection(inspection)) {
      // Calculate counts directly from inspection.items, handling undefined
      const goodItems = inspection.items ? inspection.items.filter(item => item?.status === "good").length : 0;
      const badItems = inspection.items ? inspection.items.filter(item => item?.status === "bad").length : 0;
      
      return { good: goodItems, requiresAttention: badItems };
    } else {
      // For overhead line inspections, count items based on their status
      const itemsWithStatus = inspection.items?.filter(item => item.status) || [];
      return {
        good: itemsWithStatus.filter(item => item.status === "good").length,
        requiresAttention: itemsWithStatus.filter(item => item.status === "bad").length
      };
    }
  };

  const statusSummary = getStatusSummary();

  return (
    <div>
      {showHeader && (
        <div className="mb-6">
          {showBackButton && onBack && (
            <Button
              variant="outline"
              onClick={onBack}
              className="mb-4"
            >
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to Inspections
            </Button>
          )}
          
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight">
              Inspection: {isSubstationInspection(inspection) ? inspection.substationNo : inspection.feederName}
            </h1>
            
            {onEdit && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={onEdit}
                  className="flex items-center gap-2"
                >
                  <Pencil size={16} />
                  Edit Inspection
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <Card className="mb-8">
        <CardHeader className="border-b">
          <div>
            <CardTitle className="text-2xl">Inspection Details</CardTitle>
            <CardDescription className="mt-2">
              Detailed information about the inspection
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm font-medium text-muted-foreground mb-1">Region</p>
              <p className="text-lg font-semibold">{inspection.region}</p>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm font-medium text-muted-foreground mb-1">District</p>
              <p className="text-lg font-semibold">{inspection.district}</p>
            </div>
            {isSubstationInspection(inspection) ? (
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm font-medium text-muted-foreground mb-1">Substation Number</p>
                <p className="text-lg font-semibold">{inspection.substationNo}</p>
              </div>
            ) : (
              <>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Feeder Name</p>
                  <p className="text-lg font-semibold">{inspection.feederName}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Voltage Level</p>
                  <p className="text-lg font-semibold">{inspection.voltageLevel}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Reference Pole</p>
                  <p className="text-lg font-semibold">{inspection.referencePole}</p>
                </div>
              </>
            )}
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm font-medium text-muted-foreground mb-1">Date</p>
              <p className="text-lg font-semibold">
                {inspection.date && !isNaN(new Date(inspection.date).getTime()) 
                  ? format(new Date(inspection.date), "PPP") 
                  : "N/A"}
              </p>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm font-medium text-muted-foreground mb-1">Created By</p>
              <p className="text-lg font-semibold">{isSubstationInspection(inspection) ? inspection.createdBy : inspection.inspector.name}</p>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm font-medium text-muted-foreground mb-1">Created At</p>
              <p className="text-lg font-semibold">
                {inspection.createdAt && !isNaN(new Date(inspection.createdAt).getTime()) 
                  ? format(new Date(inspection.createdAt), "PPP") 
                  : "N/A"}
              </p>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">Inspection Status Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-500/10 p-6 rounded-lg border border-green-500/20">
                <div className="flex items-center gap-3">
                  <div className="bg-green-500/20 p-2 rounded-full">
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-500">
                      {statusSummary.good}
                    </p>
                    <p className="text-sm text-green-500/80">Good Items</p>
                  </div>
                </div>
              </div>
              <div className="bg-red-500/10 p-6 rounded-lg border border-red-500/20">
                <div className="flex items-center gap-3">
                  <div className="bg-red-500/20 p-2 rounded-full">
                    <AlertCircle className="h-6 w-6 text-red-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-500">
                      {statusSummary.requiresAttention}
                    </p>
                    <p className="text-sm text-red-500/80">Items Requiring Attention</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 