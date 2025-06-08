import { OverheadLineInspection } from "@/lib/types";
import { format } from "date-fns";
import { CheckCircle2, AlertCircle, ChevronLeft, Pencil, ChevronRight, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OverheadLineInspectionDetailsViewProps {
  inspection: OverheadLineInspection;
  showHeader?: boolean;
  showBackButton?: boolean;
  onBack?: () => void;
  onEdit?: () => void;
}

export function OverheadLineInspectionDetailsView({
  inspection,
  showHeader = true,
  showBackButton = false,
  onBack,
  onEdit
}: OverheadLineInspectionDetailsViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const totalPages = 10;

  const getStatusSummary = () => {
    if (!inspection) return { good: 0, requiresAttention: 0 };
    
    // Count conditions that are true as requiring attention
    const conditions = [
      inspection.poleCondition,
      inspection.stayCondition,
      inspection.crossArmCondition,
      inspection.insulatorCondition,
      inspection.conductorCondition,
      inspection.lightningArresterCondition,
      inspection.dropOutFuseCondition,
      inspection.transformerCondition,
      inspection.recloserCondition
    ];

    let requiresAttention = 0;
    conditions.forEach(condition => {
      if (condition) {
        Object.entries(condition).forEach(([key, value]) => {
          if (key !== 'notes' && value === true) {
            requiresAttention++;
          }
        });
      }
    });

    return { good: 0, requiresAttention };
  };

  const statusSummary = getStatusSummary();

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const renderPage = () => {
    switch (currentPage) {
      case 1:
        return (
          <Card className="mb-8">
            <CardHeader className="border-b">
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Region</p>
                  <p>{inspection.region || "Unknown"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">District</p>
                  <p>{inspection.district || "Unknown"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Feeder Name</p>
                  <p>{inspection.feederName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Voltage Level</p>
                  <p>{inspection.voltageLevel}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reference Pole</p>
                  <p>{inspection.referencePole}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <p>{inspection.status}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Created At</p>
                  <p>{inspection.date 
                    ? `${inspection.date}${inspection.time ? ` ${inspection.time}` : ''}`
                    : inspection.createdAt && !isNaN(new Date(inspection.createdAt).getTime())
                    ? format(new Date(inspection.createdAt), "dd/MM/yyyy HH:mm")
                    : new Date().toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                  <p>{inspection.updatedAt && !isNaN(new Date(inspection.updatedAt).getTime())
                    ? format(new Date(inspection.updatedAt), "dd/MM/yyyy HH:mm")
                    : new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case 2:
        return (
          <Card className="mb-8">
            <CardHeader className="border-b">
              <CardTitle>Pole Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pole ID</p>
                  <p>{inspection.poleId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pole Height</p>
                  <p>{inspection.poleHeight}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pole Type</p>
                  <p>{inspection.poleType}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pole Location</p>
                  <p>{inspection.poleLocation}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case 3:
        return (
          <Card className="mb-8">
            <CardHeader className="border-b">
              <CardTitle>Pole Condition</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tilted</p>
                  <p>{inspection.poleCondition?.tilted ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Rotten</p>
                  <p>{inspection.poleCondition?.rotten ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Burnt</p>
                  <p>{inspection.poleCondition?.burnt ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Substandard</p>
                  <p>{inspection.poleCondition?.substandard ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Conflict with LV</p>
                  <p>{inspection.poleCondition?.conflictWithLV ? "Yes" : "No"}</p>
                </div>
              </div>
              {inspection.poleCondition?.notes && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-muted-foreground">Notes</p>
                  <p>{inspection.poleCondition.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      case 4:
        return (
          <Card className="mb-8">
            <CardHeader className="border-b">
              <CardTitle>Stay Condition</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Required but not available</p>
                  <p>{inspection.stayCondition?.requiredButNotAvailable ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cut</p>
                  <p>{inspection.stayCondition?.cut ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Misaligned</p>
                  <p>{inspection.stayCondition?.misaligned ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Defective Stay</p>
                  <p>{inspection.stayCondition?.defectiveStay ? "Yes" : "No"}</p>
                </div>
              </div>
              {inspection.stayCondition?.notes && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-muted-foreground">Notes</p>
                  <p>{inspection.stayCondition.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      case 5:
        return (
          <Card className="mb-8">
            <CardHeader className="border-b">
              <CardTitle>Cross Arm Condition</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Misaligned</p>
                  <p>{inspection.crossArmCondition?.misaligned ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Bend</p>
                  <p>{inspection.crossArmCondition?.bend ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Corroded</p>
                  <p>{inspection.crossArmCondition?.corroded ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Substandard</p>
                  <p>{inspection.crossArmCondition?.substandard ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Others</p>
                  <p>{inspection.crossArmCondition?.others ? "Yes" : "No"}</p>
                </div>
              </div>
              {inspection.crossArmCondition?.notes && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-muted-foreground">Notes</p>
                  <p>{inspection.crossArmCondition.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      case 6:
        return (
          <Card className="mb-8">
            <CardHeader className="border-b">
              <CardTitle>Insulator Condition</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Broken/Cracked</p>
                  <p>{inspection.insulatorCondition?.brokenOrCracked ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Burnt/Flash over</p>
                  <p>{inspection.insulatorCondition?.burntOrFlashOver ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Shattered</p>
                  <p>{inspection.insulatorCondition?.shattered ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Defective Binding</p>
                  <p>{inspection.insulatorCondition?.defectiveBinding ? "Yes" : "No"}</p>
                </div>
              </div>
              {inspection.insulatorCondition?.notes && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-muted-foreground">Notes</p>
                  <p>{inspection.insulatorCondition.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      case 7:
        return (
          <Card className="mb-8">
            <CardHeader className="border-b">
              <CardTitle>Conductor Condition</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Loose Connectors</p>
                  <p>{inspection.conductorCondition?.looseConnectors ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Weak Jumpers</p>
                  <p>{inspection.conductorCondition?.weakJumpers ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Burnt Lugs</p>
                  <p>{inspection.conductorCondition?.burntLugs ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Sagged Line</p>
                  <p>{inspection.conductorCondition?.saggedLine ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Undersized</p>
                  <p>{inspection.conductorCondition?.undersized ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Linked</p>
                  <p>{inspection.conductorCondition?.linked ? "Yes" : "No"}</p>
                </div>
              </div>
              {inspection.conductorCondition?.notes && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-muted-foreground">Notes</p>
                  <p>{inspection.conductorCondition.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      case 8:
        return (
          <Card className="mb-8">
            <CardHeader className="border-b">
              <CardTitle>Lightning Arrester & Drop Out Fuse Condition</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Lightning Arrester</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Broken/Cracked</p>
                      <p>{inspection.lightningArresterCondition?.brokenOrCracked ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Flash over</p>
                      <p>{inspection.lightningArresterCondition?.flashOver ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Missing</p>
                      <p>{inspection.lightningArresterCondition?.missing ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">No Earthing</p>
                      <p>{inspection.lightningArresterCondition?.noEarthing ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">By-passed</p>
                      <p>{inspection.lightningArresterCondition?.bypassed ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">No Arrester</p>
                      <p>{inspection.lightningArresterCondition?.noArrester ? "Yes" : "No"}</p>
                    </div>
                  </div>
                  {inspection.lightningArresterCondition?.notes && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-muted-foreground">Notes</p>
                      <p>{inspection.lightningArresterCondition.notes}</p>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Drop Out Fuse</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Broken/Cracked</p>
                      <p>{inspection.dropOutFuseCondition?.brokenOrCracked ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Flash over</p>
                      <p>{inspection.dropOutFuseCondition?.flashOver ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Insufficient Clearance</p>
                      <p>{inspection.dropOutFuseCondition?.insufficientClearance ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Loose or No Earthing</p>
                      <p>{inspection.dropOutFuseCondition?.looseOrNoEarthing ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Corroded</p>
                      <p>{inspection.dropOutFuseCondition?.corroded ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Linked HV Fuses</p>
                      <p>{inspection.dropOutFuseCondition?.linkedHVFuses ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Others</p>
                      <p>{inspection.dropOutFuseCondition?.others ? "Yes" : "No"}</p>
                    </div>
                  </div>
                  {inspection.dropOutFuseCondition?.notes && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-muted-foreground">Notes</p>
                      <p>{inspection.dropOutFuseCondition.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case 9:
        return (
          <Card className="mb-8">
            <CardHeader className="border-b">
              <CardTitle>Transformer & Recloser Condition</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Transformer</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Leaking Oil</p>
                      <p>{inspection.transformerCondition?.leakingOil ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Missing Earth leads</p>
                      <p>{inspection.transformerCondition?.missingEarthLeads ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Linked HV Fuses</p>
                      <p>{inspection.transformerCondition?.linkedHVFuses ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Rusted Tank</p>
                      <p>{inspection.transformerCondition?.rustedTank ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Cracked Bushing</p>
                      <p>{inspection.transformerCondition?.crackedBushing ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Others</p>
                      <p>{inspection.transformerCondition?.others ? "Yes" : "No"}</p>
                    </div>
                  </div>
                  {inspection.transformerCondition?.notes && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-muted-foreground">Notes</p>
                      <p>{inspection.transformerCondition.notes}</p>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Recloser</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Low Gas Level</p>
                      <p>{inspection.recloserCondition?.lowGasLevel ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Low Battery Level</p>
                      <p>{inspection.recloserCondition?.lowBatteryLevel ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Burnt Voltage Transformers</p>
                      <p>{inspection.recloserCondition?.burntVoltageTransformers ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Protection Disabled</p>
                      <p>{inspection.recloserCondition?.protectionDisabled ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">By-passed</p>
                      <p>{inspection.recloserCondition?.bypassed ? "Yes" : "No"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Others</p>
                      <p>{inspection.recloserCondition?.others ? "Yes" : "No"}</p>
                    </div>
                  </div>
                  {inspection.recloserCondition?.notes && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-muted-foreground">Notes</p>
                      <p>{inspection.recloserCondition.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case 10:
        return (
          <>
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Images</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {inspection.images && inspection.images.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {inspection.images.map((image, index) => (
                      <div 
                        key={index} 
                        className="relative aspect-video cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setEnlargedImage(image)}
                      >
                        <img
                          src={image}
                          alt={`Inspection image ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No images available</p>
                )}
              </CardContent>
            </Card>

            <Dialog open={!!enlargedImage} onOpenChange={() => setEnlargedImage(null)}>
              <DialogContent className="max-w-4xl w-full">
                <DialogHeader>
                  <DialogTitle className="flex justify-between items-center">
                    <span>Inspection Image</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEnlargedImage(null)}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </DialogTitle>
                </DialogHeader>
                {enlargedImage && (
                  <div className="relative w-full aspect-video">
                    <img
                      src={enlargedImage}
                      alt="Enlarged inspection image"
                      className="w-full h-full object-contain rounded-lg"
                    />
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </>
        );
    }
  };

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {showBackButton && onBack && (
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Overhead Line Inspection Details</h2>
              <p className="text-muted-foreground">Feeder: {inspection.feederName}</p>
            </div>
          </div>
          {onEdit && (
            <Button onClick={onEdit} className="gap-2">
              <Pencil className="h-4 w-4" />
              Edit Inspection
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-blue-50 dark:bg-blue-950">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{statusSummary.good + statusSummary.requiresAttention}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-950">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Good Condition</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">{statusSummary.good}</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 dark:bg-amber-950">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requires Attention</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{statusSummary.requiresAttention}</div>
          </CardContent>
        </Card>
      </div>

      {renderPage()}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePreviousPage}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          onClick={handleNextPage}
          disabled={currentPage === totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
} 