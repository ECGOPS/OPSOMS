import { ReactNode, useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/lib/types';
import { PermissionService } from '@/services/PermissionService';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole | UserRole[];
  allowedRegion?: string;
  allowedDistrict?: string;
  requiredFeature?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole, allowedRegion, allowedDistrict, requiredFeature }) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const permissionService = PermissionService.getInstance();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initPermissions = async () => {
      const initialized = await permissionService.initialize();
      setIsInitialized(initialized);
    };
    initPermissions();
  }, []);

  // Check if user is authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Wait for permissions to be initialized
  if (!isInitialized) {
    return <div>Loading...</div>;
  }

  // Check feature-based access
  if (requiredFeature && !permissionService.canAccessFeature(user.role, requiredFeature)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check role-based access
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!roles.some(role => permissionService.hasRequiredRole(user.role, role))) {
      // Allow technicians to access asset management pages
      if (location.pathname.startsWith('/asset-management') && user.role === 'technician') {
        return <>{children}</>;
      }
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Check region-based access
  if (allowedRegion && user?.role !== 'global_engineer' && user?.role !== 'system_admin') {
    if (user?.region !== allowedRegion) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Check district-based access
  if (allowedDistrict && user?.role === 'district_engineer') {
    if (user?.district !== allowedDistrict) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute; 