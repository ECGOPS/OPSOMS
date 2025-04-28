import React, { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { VITAssetsTable } from '../vit/VITAssetsTable';
import { VITInspectionForm } from '../vit/VITInspectionForm';
import { VITInspectionChecklist, VITAsset, YesNoOption, GoodBadOption } from '../../lib/types';
import { useNavigate } from 'react-router-dom';

export function VITInspectionManagementPage() {
  const { vitAssets, vitInspections, addVITInspection, updateVITInspection, deleteVITInspection, regions, districts } = useData();
  const { user } = useAuth();
  const [isInspectionFormOpen, setIsInspectionFormOpen] = useState(false);
  const [isEditInspectionOpen, setIsEditInspectionOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [selectedInspection, setSelectedInspection] = useState<VITInspectionChecklist | null>(null);
  const navigate = useNavigate();

  const handleAddInspection = (assetId: string) => {
    setSelectedAssetId(assetId);
    setIsInspectionFormOpen(true);
  };

  const handleEditInspection = (inspection: VITInspectionChecklist) => {
    setSelectedInspection(inspection);
    setSelectedAssetId(inspection.vitAssetId);
    setIsEditInspectionOpen(true);
  };

  const handleCloseInspectionForm = () => {
    setIsInspectionFormOpen(false);
    setIsEditInspectionOpen(false);
    setSelectedInspection(null);
  };

  const handleSubmitInspection = async (inspectionData: Partial<VITInspectionChecklist>) => {
    try {
      // Get the selected asset to ensure we have all required data
      const selectedAsset = vitAssets.find(asset => asset.id === selectedAssetId);
      if (!selectedAsset) {
        toast.error("Selected asset not found");
        return;
      }

      // Create a complete inspection data object with all required fields
      const completeInspectionData: Omit<VITInspectionChecklist, "id"> = {
        vitAssetId: selectedAssetId,
        region: selectedAsset.region,
        district: selectedAsset.district,
        inspectionDate: inspectionData.inspectionDate || new Date().toISOString(),
        inspectedBy: inspectionData.inspectedBy || user?.email || "unknown",
        rodentTermiteEncroachment: inspectionData.rodentTermiteEncroachment || "No",
        cleanDustFree: inspectionData.cleanDustFree || "No",
        protectionButtonEnabled: inspectionData.protectionButtonEnabled || "No",
        recloserButtonEnabled: inspectionData.recloserButtonEnabled || "No",
        groundEarthButtonEnabled: inspectionData.groundEarthButtonEnabled || "No",
        acPowerOn: inspectionData.acPowerOn || "No",
        batteryPowerLow: inspectionData.batteryPowerLow || "No",
        handleLockOn: inspectionData.handleLockOn || "No",
        remoteButtonEnabled: inspectionData.remoteButtonEnabled || "No",
        gasLevelLow: inspectionData.gasLevelLow || "No",
        earthingArrangementAdequate: inspectionData.earthingArrangementAdequate || "No",
        noFusesBlown: inspectionData.noFusesBlown || "No",
        noDamageToBushings: inspectionData.noDamageToBushings || "No",
        noDamageToHVConnections: inspectionData.noDamageToHVConnections || "No",
        insulatorsClean: inspectionData.insulatorsClean || "No",
        paintworkAdequate: inspectionData.paintworkAdequate || "No",
        ptFuseLinkIntact: inspectionData.ptFuseLinkIntact || "No",
        noCorrosion: inspectionData.noCorrosion || "No",
        silicaGelCondition: inspectionData.silicaGelCondition || "Good",
        correctLabelling: inspectionData.correctLabelling || "No",
        remarks: inspectionData.remarks || "",
        createdBy: user?.email || "unknown",
        createdAt: new Date().toISOString()
      };

      if (selectedInspection) {
        await updateVITInspection(selectedInspection.vitAssetId, completeInspectionData);
      } else {
        await addVITInspection(completeInspectionData);
      }
      handleCloseInspectionForm();
      toast.success(selectedInspection ? "Inspection updated successfully" : "Inspection added successfully");
    } catch (error) {
      console.error("Error saving inspection:", error);
      toast.error("Failed to save inspection");
    }
  };

  const handleAddAsset = () => {
    navigate('/asset-management/add');
  };

  const handleEditAsset = (asset: VITAsset) => {
    navigate(`/asset-management/edit/${asset.id}`);
  };

  // Filter assets based on user role
  const filteredAssets = vitAssets.filter(asset => {
    if (user?.role === "global_engineer" || user?.role === "system_admin") return true;
    if (user?.role === "regional_engineer" && user.region) {
      return asset.region === user.region;
    }
    if ((user?.role === "district_engineer" || user?.role === "technician") && user.region && user.district) {
      return asset.region === user.region && asset.district === user.district;
    }
    return false;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">VIT Inspection Management</h1>
      </div>

      <VITAssetsTable
        assets={filteredAssets}
        onAddAsset={handleAddAsset}
        onEditAsset={handleEditAsset}
        onInspect={handleAddInspection}
      />

      {isInspectionFormOpen && (
        <VITInspectionForm
          assetId={selectedAssetId}
          onSubmit={handleSubmitInspection}
          onCancel={handleCloseInspectionForm}
        />
      )}

      {isEditInspectionOpen && selectedInspection && (
        <VITInspectionForm
          inspectionData={selectedInspection}
          assetId={selectedAssetId}
          onSubmit={handleSubmitInspection}
          onCancel={handleCloseInspectionForm}
        />
      )}
    </div>
  );
} 