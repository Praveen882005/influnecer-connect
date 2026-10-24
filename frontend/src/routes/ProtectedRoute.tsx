import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RouteLoading } from '../components/feedback';
import type { WorkspaceRole } from '../layouts/types';

interface ProtectedRouteProps {
  allowedRoles?: WorkspaceRole[];
  children: React.ReactNode;
}

/**
 * Usability route guard verifying that the user has an active session
 * and is directed to their appropriate workspace.
 *
 * NOTE: Frontend route guards exist strictly for user experience.
 * Authorization is strictly enforced server-side on every API endpoint.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { user, token, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <RouteLoading label="Verifying session credentials..." />;
  }

  // If not authenticated, redirect to sign-in page with redirect target
  if (!isAuthenticated && !token) {
    return <Navigate to="/auth/sign-in" state={{ from: location }} replace />;
  }

  // Role routing for usability
  if (user && allowedRoles && allowedRoles.length > 0) {
    const userWorkspaceRole: WorkspaceRole = user.role === 'creator' ? 'influencer' : (user.role as WorkspaceRole);
    if (!allowedRoles.includes(userWorkspaceRole) && userWorkspaceRole !== 'admin') {
      if (userWorkspaceRole === 'influencer') {
        return <Navigate to="/influencer/overview" replace />;
      } else if (userWorkspaceRole === 'brand') {
        return <Navigate to="/brand/overview" replace />;
      } else if (userWorkspaceRole === 'admin') {
        return <Navigate to="/admin/overview" replace />;
      }
    }
  }

  return <>{children}</>;
};
