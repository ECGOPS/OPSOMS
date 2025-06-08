import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { AudioProvider } from "@/contexts/AudioContext";
import { Layout } from "@/components/layout/Layout";
import ProtectedRoute from './components/access-control/ProtectedRoute';
import { AccessControlWrapper } from "@/components/access-control/AccessControlWrapper";
import { PermissionService } from "@/services/PermissionService";
import { useEffect } from "react";

import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import ReportFaultPage from "./pages/ReportFaultPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ControlSystemAnalyticsPage from "./pages/ControlSystemAnalyticsPage";
import UserManagementPage from "./pages/UserManagementPage";
import LoadMonitoringPage from "./pages/asset-management/LoadMonitoringPage";
import SubstationInspectionPage from "./pages/asset-management/SubstationInspectionPage";
import InspectionManagementPage from "./pages/asset-management/InspectionManagementPage";
import InspectionDetailsPage from "./pages/asset-management/InspectionDetailsPage";
import EditInspectionPage from "./pages/asset-management/EditInspectionPage";
import VITInspectionPage from "./pages/asset-management/VITInspectionPage";
import VITInspectionManagementPage from "./pages/asset-management/VITInspectionManagementPage";
import VITInspectionDetailsPage from "./pages/asset-management/VITInspectionDetailsPage";
import EditVITInspectionPage from "./pages/asset-management/EditVITInspectionPage";
import VITInspectionFormPage from "./pages/asset-management/VITInspectionFormPage";
import OverheadLineInspectionPage from "./pages/asset-management/OverheadLineInspectionPage";
import NotFound from "./pages/NotFound";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import CreateLoadMonitoringPage from "./pages/asset-management/CreateLoadMonitoringPage";
import EditLoadMonitoringPage from "./pages/asset-management/EditLoadMonitoringPage";
import LoadMonitoringDetailsPage from "./pages/asset-management/LoadMonitoringDetailsPage";
import EditOP5FaultPage from "@/pages/EditOP5FaultPage";
import EditControlOutagePage from "@/pages/EditControlOutagePage";
import PermissionManagementPage from './pages/system-admin/PermissionManagementPage';
import SecurityMonitoringPage from './pages/system-admin/SecurityMonitoringPage';
import SecurityTestPage from './pages/system-admin/SecurityTestPage';
import DistrictPopulationPage from './pages/DistrictPopulationPage';
import UserProfilePage from "./pages/UserProfilePage";
import EditVITAssetPage from "./pages/asset-management/EditVITAssetPage";
import UserLogsPage from "@/pages/UserLogsPage";
import SecondarySubstationInspectionPage from "./pages/asset-management/SecondarySubstationInspectionPage";
import { MusicManagementPage } from "@/pages/admin/MusicManagementPage";

const queryClient = new QueryClient();

function App() {
  useEffect(() => {
    // Initialize permissions
    const permissionService = PermissionService.getInstance();
    permissionService.initialize().catch(console.error);
  }, []);

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <DataProvider>
            <AudioProvider>
              <TooltipProvider>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<HomePage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/unauthorized" element={<UnauthorizedPage />} />

                  {/* Protected routes (feature-based) */}
                  <Route path="/dashboard" element={
                    <ProtectedRoute requiredFeature="analytics_dashboard">
                      <DashboardPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/report-fault" element={
                    <ProtectedRoute requiredFeature="fault_reporting">
                      <ReportFaultPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/analytics" element={
                    <ProtectedRoute requiredFeature="analytics_page">
                      <AnalyticsPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/control-system-analytics" element={
                    <ProtectedRoute requiredFeature="analytics_page">
                      <ControlSystemAnalyticsPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/user-management" element={
                    <ProtectedRoute requiredFeature="user_management">
                      <UserManagementPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/district-population" element={
                    <ProtectedRoute requiredFeature="district_population">
                      <DistrictPopulationPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/asset-management/load-monitoring" element={
                    <ProtectedRoute requiredFeature="load_monitoring">
                      <LoadMonitoringPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/asset-management/load-monitoring-details/:id" element={
                    <ProtectedRoute requiredFeature="load_monitoring">
                      <LoadMonitoringDetailsPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/asset-management/load-monitoring/edit/:id" element={
                    <ProtectedRoute requiredFeature="load_monitoring_update">
                      <EditLoadMonitoringPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/asset-management/create-load-monitoring" element={
                    <ProtectedRoute requiredFeature="load_monitoring">
                      <CreateLoadMonitoringPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/asset-management/inspection-management" element={
                    <ProtectedRoute requiredFeature="inspection_management">
                      <InspectionManagementPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/asset-management/inspection-details/:id" element={
                    <ProtectedRoute requiredFeature="inspection_management">
                      <InspectionDetailsPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/asset-management/substation-inspection" element={
                    <ProtectedRoute requiredFeature="substation_inspection">
                      <SubstationInspectionPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/asset-management/secondary-substation-inspection" element={
                    <ProtectedRoute requiredFeature="substation_inspection">
                      <SecondarySubstationInspectionPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/asset-management/secondary-substation-inspection/:id" element={
                    <ProtectedRoute requiredFeature="substation_inspection">
                      <SecondarySubstationInspectionPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/asset-management/edit-inspection/:id" element={
                    <ProtectedRoute requiredFeature="inspection_management_update">
                      <EditInspectionPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/asset-management/vit-inspection" element={
                    <ProtectedRoute requiredFeature="vit_inspection">
                      <VITInspectionPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/asset-management/vit-inspection-management" element={
                    <ProtectedRoute requiredFeature="vit_inspection">
                      <VITInspectionManagementPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/asset-management/vit-inspection-details/:id" element={
                    <ProtectedRoute requiredFeature="vit_inspection">
                      <VITInspectionDetailsPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/asset-management/edit-vit-inspection/:id" element={
                    <ProtectedRoute requiredFeature="vit_inspection_update">
                      <EditVITInspectionPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/asset-management/edit-vit-asset/:id" element={
                    <ProtectedRoute requiredFeature="vit_inspection_update">
                      <EditVITAssetPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/asset-management/vit-inspection-form/:id" element={
                    <ProtectedRoute requiredFeature="vit_inspection">
                      <VITInspectionFormPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/asset-management/overhead-line" element={
                    <ProtectedRoute requiredFeature="overhead_line_inspection">
                      <OverheadLineInspectionPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/asset-management/overhead-line/details/:id" element={
                    <ProtectedRoute requiredFeature="overhead_line_inspection">
                      <InspectionDetailsPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/asset-management/overhead-line/edit/:id" element={
                    <ProtectedRoute requiredFeature="overhead_line_inspection_update">
                      <EditInspectionPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/edit-op5-fault/:id" element={
                    <ProtectedRoute requiredFeature="fault_reporting_update">
                      <EditOP5FaultPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/edit-control-outage/:id" element={
                    <ProtectedRoute requiredFeature="fault_reporting_update">
                      <EditControlOutagePage />
                    </ProtectedRoute>
                  } />

                  <Route path="/system-admin/permissions" element={
                    <ProtectedRoute requiredFeature="permission_management">
                      <PermissionManagementPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/system-admin/security" element={
                    <ProtectedRoute requiredFeature="security_monitoring">
                      <SecurityMonitoringPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/test/security" element={
                    <ProtectedRoute requiredFeature="security_testing">
                      <SecurityTestPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/profile" element={<UserProfilePage />} />

                  <Route path="/user-logs" element={
                    <ProtectedRoute requiredFeature="user_logs">
                      <UserLogsPage />
                    </ProtectedRoute>
                  } />

                  <Route
                    path="/admin/music"
                    element={
                      <ProtectedRoute requiredFeature="music_management">
                        <MusicManagementPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Catch all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <Toaster />
                <Sonner />
              </TooltipProvider>
            </AudioProvider>
          </DataProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;
