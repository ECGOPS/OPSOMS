import { OverheadLineInspection } from "@/lib/types";
import { SubstationInspection } from "@/lib/asset-types";
import { format } from "date-fns";
import { CheckCircle2, AlertCircle, ChevronLeft, Pencil, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";

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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 1;

  const isSubstationInspection = (inspection: SubstationInspection | OverheadLineInspection): inspection is SubstationInspection => {
    return 'substationNo' in inspection;
  };

  const getStatusSummary = () => {
    if (!inspection) return { good: 0, requiresAttention: 0 };
    
    if (isSubstationInspection(inspection)) {
      // Get all items from category-specific arrays
      const allItems = [
        ...(inspection.siteCondition || []),
        ...(inspection.generalBuilding || []),
        ...(inspection.controlEquipment || []),
        ...(inspection.powerTransformer || []),
        ...(inspection.outdoorEquipment || []),
        ...(inspection.basement || [])
      ].filter(item => item && item.status); // Only include items that exist and have a status
      
      const goodItems = allItems.filter(item => item.status === "good").length;
      const badItems = allItems.filter(item => item.status === "bad").length;
      
      console.log('Status Summary Calculation:', {
        totalItems: allItems.length,
        goodItems,
        badItems,
        items: allItems.map(item => ({ name: item.name, status: item.status }))
      });
      
      return { good: goodItems, requiresAttention: badItems };
    } else {
      const itemsWithStatus = Array.isArray(inspection.items) ? inspection.items.filter(item => item?.status) : [];
      return {
        good: itemsWithStatus.filter(item => item.status === "good").length,
        requiresAttention: itemsWithStatus.filter(item => item.status === "bad").length
      };
    }
  };

  const statusSummary = getStatusSummary();

  const getTotalPages = () => {
    if (isSubstationInspection(inspection)) {
      return 8; // Basic Info, Site Condition, General Building, Control Equipment, Basement, Power Transformer, Outdoor Equipment, Additional Notes
    } else {
      return 9; // Basic Info, Pole Info, Pole Condition, Stay Condition, Cross Arm, Insulator, Conductor, Lightning Arrester, Drop Out Fuse, Transformer, Recloser
    }
  };

  const renderPage = () => {
    if (isSubstationInspection(inspection)) {
      switch (currentPage) {
        case 1:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Region</p>
                    <p className="text-lg font-semibold">{inspection.region}</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">District</p>
                    <p className="text-lg font-semibold">{inspection.district}</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Substation Number</p>
                    <p className="text-lg font-semibold">{inspection.substationNo}</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Substation Name</p>
                    <p className="text-lg font-semibold">{inspection.substationName || "N/A"}</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Type</p>
                    <p className="text-lg font-semibold capitalize">{inspection.type}</p>
                  </div>
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
                    <p className="text-lg font-semibold">{inspection.createdBy || "N/A"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        case 2:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Site Condition</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {inspection.siteCondition?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.remarks && (
                          <p className="text-sm text-muted-foreground mt-1">{item.remarks}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === "good" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : item.status === "bad" ? (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <span className="text-muted-foreground">Not inspected</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        case 3:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>General Building</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {inspection.generalBuilding?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.remarks && (
                          <p className="text-sm text-muted-foreground mt-1">{item.remarks}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === "good" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : item.status === "bad" ? (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <span className="text-muted-foreground">Not inspected</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        case 4:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Control Equipment</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {inspection.controlEquipment?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.remarks && (
                          <p className="text-sm text-muted-foreground mt-1">{item.remarks}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === "good" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : item.status === "bad" ? (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <span className="text-muted-foreground">Not inspected</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        case 5:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Basement</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {inspection.basement?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.remarks && (
                          <p className="text-sm text-muted-foreground mt-1">{item.remarks}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === "good" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : item.status === "bad" ? (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <span className="text-muted-foreground">Not inspected</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        case 6:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Power Transformer</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {inspection.powerTransformer?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.remarks && (
                          <p className="text-sm text-muted-foreground mt-1">{item.remarks}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === "good" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : item.status === "bad" ? (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <span className="text-muted-foreground">Not inspected</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        case 7:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Outdoor Equipment</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {inspection.outdoorEquipment?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.remarks && (
                          <p className="text-sm text-muted-foreground mt-1">{item.remarks}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === "good" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : item.status === "bad" ? (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <span className="text-muted-foreground">Not inspected</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        case 8:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Additional Notes</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-lg font-semibold">{inspection.remarks}</p>
                </div>
              </CardContent>
            </Card>
          );
      }
    } else {
      // ... existing overhead line inspection cases ...
    }
  };

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

      {renderPage()}

      <div className="flex justify-between items-center mt-8">
        <Button
          variant="outline"
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {getTotalPages()}
        </span>
        <Button
          variant="outline"
          onClick={() => setCurrentPage(prev => Math.min(getTotalPages(), prev + 1))}
          disabled={currentPage === getTotalPages()}
        >
          Next
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
} 