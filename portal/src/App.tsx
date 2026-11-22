import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/ProductsPage';
import { OrdersPage } from './pages/OrdersPage';
import { ReportsPage } from './pages/ReportsPage';
import { CustomersPage } from './pages/CustomersPage';
import { SettingsPage } from './pages/SettingsPage';

const DefaultRedirect: React.FC = () => {
  const { hasPermission, hasAnyPermission } = useAuth();
  if (hasPermission('dashboard:view')) return <Navigate to="/dashboard" replace />;
  if (hasPermission('products:read')) return <Navigate to="/products" replace />;
  if (hasAnyPermission('orders:read', 'orders:read_own')) return <Navigate to="/orders" replace />;
  if (hasAnyPermission('reports:view_revenue', 'reports:view_profit')) return <Navigate to="/reports" replace />;
  return <Navigate to="/login" replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<DefaultRedirect />} />

            <Route
              path="dashboard"
              element={
                <ProtectedRoute requiredPermissions={['dashboard:view']}>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="products"
              element={
                <ProtectedRoute requiredPermissions={['products:read']}>
                  <ProductsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="orders"
              element={
                <ProtectedRoute requiredPermissions={['orders:read', 'orders:read_own']}>
                  <OrdersPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="reports"
              element={
                <ProtectedRoute requiredPermissions={['reports:view_revenue', 'reports:view_profit']}>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="customers"
              element={
                <ProtectedRoute requiredPermissions={['customers:read']}>
                  <CustomersPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="settings"
              element={
                <ProtectedRoute requiredPermissions={['settings:read', 'users:manage', 'audit_logs:read']}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
