import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { useAuth } from '../context';
import { LoadingSpinner } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import type { UserRole } from '@/types/auth';

export interface ProtectedRouteProps {
  requiredRole?: UserRole;
  children?: React.ReactNode;
}

export function ProtectedRoute({ requiredRole, children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-8">
        <LoadingSpinner size="lg" label="Đang xác thực tài khoản..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Preserve intended destination to return after successful login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div
          role="alert"
          className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-4"
        >
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center">
            <ShieldX className="w-7 h-7" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Truy cập bị từ chối</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Tài khoản của bạn ({user?.email}) với vai trò <span className="font-semibold">{user?.role}</span> không
              có quyền truy cập khu vực giới hạn này.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <Button
              variant="primary"
              size="md"
              onClick={() => window.location.assign('/')}
            >
              Quay về trang chủ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
}

export default ProtectedRoute;
