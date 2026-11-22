import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  requiredPermissions?: string[];
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requiredPermissions = [],
  children
}) => {
  const { user, loading, hasAnyPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="login-page">
        <div className="card" style={{ padding: '28px 36px', textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Đang kiểm tra phiên đăng nhập...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPermissions.length > 0 && !hasAnyPermission(...requiredPermissions)) {
    return (
      <div className="page-content">
        <div className="card" style={{ maxWidth: 560, margin: '48px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🔒</div>
          <h2 style={{ margin: '0 0 8px' }}>Không có quyền truy cập</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            Tài khoản <strong>{user.email}</strong> (vai trò <strong>{user.role}</strong>) không có quyền xem mục này.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
