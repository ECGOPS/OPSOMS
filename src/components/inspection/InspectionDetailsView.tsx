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
      const goodItems = Array.isArray(inspection.items) ? inspection.items.filter(item => item?.status === "good").length : 0;
      const badItems = Array.isArray(inspection.items) ? inspection.items.filter(item => item?.status === "bad").length : 0;
      
      return { good: goodItems, requiresAttention: badItems };
    } else {
      // For overhead line inspections, count items based on their status
      const itemsWithStatus = Array.isArray(inspection.items) ? inspection.items.filter(item => item?.status) : [];
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

      {!isSubstationInspection(inspection) && (
        <>
          {/* Pole Information */}
          <Card className="mb-8">
            <CardHeader className="border-b">
              <CardTitle>Pole Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Pole ID</p>
                  <p className="text-lg font-semibold">{inspection.poleId || "N/A"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Pole Height</p>
                  <p className="text-lg font-semibold">{inspection.poleHeight || "N/A"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Pole Type</p>
                  <p className="text-lg font-semibold">{inspection.poleType || "N/A"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Pole Location</p>
                  <p className="text-lg font-semibold">{inspection.poleLocation || "N/A"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pole Condition */}
          <Card className="mb-8">
            <CardHeader className="border-b">
              <CardTitle>Pole Condition</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Tilted</p>
                  <p className="text-lg font-semibold">{inspection.poleCondition?.tilted ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Rotten</p>
                  <p className="text-lg font-semibold">{inspection.poleCondition?.rotten ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Burnt</p>
                  <p className="text-lg font-semibold">{inspection.poleCondition?.burnt ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Substandard</p>
                  <p className="text-lg font-semibold">{inspection.poleCondition?.substandard ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Conflict with LV</p>
                  <p className="text-lg font-semibold">{inspection.poleCondition?.conflictWithLV ? "Yes" : "No"}</p>
                </div>
                {inspection.poleCondition?.notes && (
                  <div className="col-span-2 bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
                    <p className="text-lg font-semibold">{inspection.poleCondition.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stay Condition */}
          <Card className="mb-8">
            <CardHeader className="border-b">
              <CardTitle>Stay Condition</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Required but not available</p>
                  <p className="text-lg font-semibold">{inspection.stayCondition?.requiredButNotAvailable ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Cut</p>
                  <p className="text-lg font-semibold">{inspection.stayCondition?.cut ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Misaligned</p>
                  <p className="text-lg font-semibold">{inspection.stayCondition?.misaligned ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Defective Stay</p>
                  <p className="text-lg font-semibold">{inspection.stayCondition?.defectiveStay ? "Yes" : "No"}</p>
                </div>
                {inspection.stayCondition?.notes && (
                  <div className="col-span-2 bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
                    <p className="text-lg font-semibold">{inspection.stayCondition.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Cross Arm Condition */}
          <Card className="mb-8">
            <CardHeader className="border-b">
              <CardTitle>Cross Arm Condition</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Misaligned</p>
                  <p className="text-lg font-semibold">{inspection.crossArmCondition?.misaligned ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Bend</p>
                  <p className="text-lg font-semibold">{inspection.crossArmCondition?.bend ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Corroded</p>
                  <p className="text-lg font-semibold">{inspection.crossArmCondition?.corroded ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Substandard</p>
                  <p className="text-lg font-semibold">{inspection.crossArmCondition?.substandard ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Others</p>
                  <p className="text-lg font-semibold">{inspection.crossArmCondition?.others ? "Yes" : "No"}</p>
                </div>
                {inspection.crossArmCondition?.notes && (
                  <div className="col-span-2 bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
                    <p className="text-lg font-semibold">{inspection.crossArmCondition.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Insulator Condition */}
          <Card className="mb-8">
            <CardHeader className="border-b">
              <CardTitle>Insulator Condition</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Broken/Cracked</p>
                  <p className="text-lg font-semibold">{inspection.insulatorCondition?.brokenOrCracked ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Burnt/Flash over</p>
                  <p className="text-lg font-semibold">{inspection.insulatorCondition?.burntOrFlashOver ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Shattered</p>
                  <p className="text-lg font-semibold">{inspection.insulatorCondition?.shattered ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Defective Binding</p>
                  <p className="text-lg font-semibold">{inspection.insulatorCondition?.defectiveBinding ? "Yes" : "No"}</p>
                </div>
                {inspection.insulatorCondition?.notes && (
                  <div className="col-span-2 bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
                    <p className="text-lg font-semibold">{inspection.insulatorCondition.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Conductor Condition */}
          <Card className="mb-8">
            <CardHeader className="border-b">
              <CardTitle>Conductor Condition</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Loose Connectors</p>
                  <p className="text-lg font-semibold">{inspection.conductorCondition?.looseConnectors ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Weak Jumpers</p>
                  <p className="text-lg font-semibold">{inspection.conductorCondition?.weakJumpers ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Burnt Lugs</p>
                  <p className="text-lg font-semibold">{inspection.conductorCondition?.burntLugs ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Sagged Line</p>
                  <p className="text-lg font-semibold">{inspection.conductorCondition?.saggedLine ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Undersized</p>
                  <p className="text-lg font-semibold">{inspection.conductorCondition?.undersized ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Linked</p>
                  <p className="text-lg font-semibold">{inspection.conductorCondition?.linked ? "Yes" : "No"}</p>
                </div>
                {inspection.conductorCondition?.notes && (
                  <div className="col-span-2 bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
                    <p className="text-lg font-semibold">{inspection.conductorCondition.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lightning Arrester Condition */}
          <Card className="mb-8">
            <CardHeader className="border-b">
              <CardTitle>Lightning Arrester Condition</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Broken/Cracked</p>
                  <p className="text-lg font-semibold">{inspection.lightningArresterCondition?.brokenOrCracked ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Flash over</p>
                  <p className="text-lg font-semibold">{inspection.lightningArresterCondition?.flashOver ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Missing</p>
                  <p className="text-lg font-semibold">{inspection.lightningArresterCondition?.missing ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">No Earthing</p>
                  <p className="text-lg font-semibold">{inspection.lightningArresterCondition?.noEarthing ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">By-passed</p>
                  <p className="text-lg font-semibold">{inspection.lightningArresterCondition?.bypassed ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">No Arrester</p>
                  <p className="text-lg font-semibold">{inspection.lightningArresterCondition?.noArrester ? "Yes" : "No"}</p>
                </div>
                {inspection.lightningArresterCondition?.notes && (
                  <div className="col-span-2 bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
                    <p className="text-lg font-semibold">{inspection.lightningArresterCondition.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Drop Out Fuse Condition */}
          <Card className="mb-8">
            <CardHeader className="border-b">
              <CardTitle>Drop Out Fuse/Isolator Condition</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Broken/Cracked</p>
                  <p className="text-lg font-semibold">{inspection.dropOutFuseCondition?.brokenOrCracked ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Flash over</p>
                  <p className="text-lg font-semibold">{inspection.dropOutFuseCondition?.flashOver ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Insufficient Clearance</p>
                  <p className="text-lg font-semibold">{inspection.dropOutFuseCondition?.insufficientClearance ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Loose or No Earthing</p>
                  <p className="text-lg font-semibold">{inspection.dropOutFuseCondition?.looseOrNoEarthing ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Corroded</p>
                  <p className="text-lg font-semibold">{inspection.dropOutFuseCondition?.corroded ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Linked HV Fuses</p>
                  <p className="text-lg font-semibold">{inspection.dropOutFuseCondition?.linkedHVFuses ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Others</p>
                  <p className="text-lg font-semibold">{inspection.dropOutFuseCondition?.others ? "Yes" : "No"}</p>
                </div>
                {inspection.dropOutFuseCondition?.notes && (
                  <div className="col-span-2 bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
                    <p className="text-lg font-semibold">{inspection.dropOutFuseCondition.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Transformer Condition */}
          <Card className="mb-8">
            <CardHeader className="border-b">
              <CardTitle>Transformer Condition</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Leaking Oil</p>
                  <p className="text-lg font-semibold">{inspection.transformerCondition?.leakingOil ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Missing Earth leads</p>
                  <p className="text-lg font-semibold">{inspection.transformerCondition?.missingEarthLeads ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Linked HV Fuses</p>
                  <p className="text-lg font-semibold">{inspection.transformerCondition?.linkedHVFuses ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Rusted Tank</p>
                  <p className="text-lg font-semibold">{inspection.transformerCondition?.rustedTank ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Cracked Bushing</p>
                  <p className="text-lg font-semibold">{inspection.transformerCondition?.crackedBushing ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Others</p>
                  <p className="text-lg font-semibold">{inspection.transformerCondition?.others ? "Yes" : "No"}</p>
                </div>
                {inspection.transformerCondition?.notes && (
                  <div className="col-span-2 bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
                    <p className="text-lg font-semibold">{inspection.transformerCondition.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recloser Condition */}
          <Card className="mb-8">
            <CardHeader className="border-b">
              <CardTitle>Recloser/Sectionalizer (VIT) Condition</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Low Gas Level</p>
                  <p className="text-lg font-semibold">{inspection.recloserCondition?.lowGasLevel ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Low Battery level</p>
                  <p className="text-lg font-semibold">{inspection.recloserCondition?.lowBatteryLevel ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Burnt Voltage Transformers</p>
                  <p className="text-lg font-semibold">{inspection.recloserCondition?.burntVoltageTransformers ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Protection Disabled</p>
                  <p className="text-lg font-semibold">{inspection.recloserCondition?.protectionDisabled ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">By-passed</p>
                  <p className="text-lg font-semibold">{inspection.recloserCondition?.bypassed ? "Yes" : "No"}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Others</p>
                  <p className="text-lg font-semibold">{inspection.recloserCondition?.others ? "Yes" : "No"}</p>
                </div>
                {inspection.recloserCondition?.notes && (
                  <div className="col-span-2 bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
                    <p className="text-lg font-semibold">{inspection.recloserCondition.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Additional Notes */}
          {inspection.additionalNotes && (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Additional Notes</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-lg font-semibold">{inspection.additionalNotes}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
} 