import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Crown,
  LayoutDashboard,
  LogOut,
  Package,
  RefreshCw,
  Settings,
  ShoppingBag
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import type { NotificationItem, Product } from '../types/api';
import { ROLE_META } from '../utils/format';

export const AppShell: React.FC = () => {
  const { user, logout, hasPermission, hasAnyPermission } = useAuth();
  const navigate = useNavigate();

  const [lockedCount, setLockedCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  const loadShellBadges = async () => {
    try {
      if (hasPermission('products:read')) {
        const locked = await apiRequest<Product[]>('/products/locked');
        setLockedCount(locked.length);
      }
      if (hasPermission('notifications:view')) {
        const notifs = await apiRequest<NotificationItem[]>('/notifications');
        setNotifications(notifs);
      }
    } catch {
      // Non-blocking header badges
    }
  };

  useEffect(() => {
    void loadShellBadges();
  }, [user?.id]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const alertCount = notifications.filter(n => n.isAlert).length;
  const roleMeta = user ? ROLE_META[user.role] : null;

  return (
    <div className="shell">
      <aside className="sidebar no-print">
        <div className="sidebar-brand">
          <div className="brand-mark">VĐ</div>
          <div>
            <div className="brand-title">Viễn Đông Sales</div>
            <div className="brand-sub">Portal Quản trị</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Vận hành</div>

          {hasPermission('dashboard:view') && (
            <NavLink to="/dashboard" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <LayoutDashboard size={18} />
              <span>Tổng quan</span>
            </NavLink>
          )}

          {hasPermission('products:read') && (
            <NavLink to="/products" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Package size={18} />
              <span>Kho hàng</span>
              {lockedCount > 0 && <span className="nav-badge-red">🔒 {lockedCount}</span>}
            </NavLink>
          )}

          {hasAnyPermission('orders:read', 'orders:read_own') && (
            <NavLink to="/orders" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <ShoppingBag size={18} />
              <span>Đơn hàng</span>
            </NavLink>
          )}

          <div className="nav-section-label">Phân tích & Khách hàng</div>

          {hasAnyPermission('reports:view_revenue', 'reports:view_profit') && (
            <NavLink to="/reports" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <BarChart3 size={18} />
              <span>Báo cáo & Lãi</span>
            </NavLink>
          )}

          {hasPermission('customers:read') && (
            <NavLink to="/customers" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Crown size={18} />
              <span>Đại diện VIP</span>
            </NavLink>
          )}

          {hasAnyPermission('settings:read', 'users:manage', 'audit_logs:read') && (
            <>
              <div className="nav-section-label">Hệ thống</div>
              <NavLink to="/settings" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <Settings size={18} />
                <span>Cài đặt & RBAC</span>
              </NavLink>
            </>
          )}
        </nav>

        {user && (
          <div className="sidebar-footer">
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>
              {user.fullName}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              {user.email}
            </div>
            {roleMeta && <span className={`badge ${roleMeta.badgeClass}`}>{roleMeta.label}</span>}
          </div>
        )}
      </aside>

      <div className="main-area">
        <header className="topbar no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="badge badge-green">● Kết nối MongoDB Atlas</span>
            {lockedCount > 0 && (
              <button
                type="button"
                className="btn btn-soft-red btn-sm"
                onClick={() => navigate('/products?stockStatus=LOCKED')}
              >
                🔒 {lockedCount} sản phẩm đang khóa GD
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => void loadShellBadges()}
              title="Làm mới cảnh báo"
            >
              <RefreshCw size={15} />
            </button>

            {hasPermission('notifications:view') && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowNotifs(prev => !prev)}
                >
                  <Bell size={16} />
                  {alertCount > 0 && <span className="badge badge-red">{alertCount}</span>}
                </button>

                {showNotifs && (
                  <div
                    className="card"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 44,
                      width: 360,
                      maxHeight: 420,
                      overflowY: 'auto',
                      zIndex: 40,
                      boxShadow: 'var(--shadow-lg)',
                      padding: 14
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 10
                      }}
                    >
                      <strong>Thông báo hệ thống</strong>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setShowNotifs(false)}
                      >
                        Đóng
                      </button>
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Chưa có thông báo.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {notifications.slice(0, 8).map(n => (
                          <div
                            key={n.id}
                            style={{
                              padding: 10,
                              borderRadius: 10,
                              background: n.isAlert ? 'var(--red-soft)' : 'var(--bg-subtle)',
                              border: `1px solid ${n.isAlert ? 'var(--red-border)' : 'var(--border)'}`
                            }}
                          >
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{n.title}</div>
                            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                              {n.message}
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                              {n.timeAgo}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <button type="button" className="btn btn-outline btn-sm" onClick={() => void handleLogout()}>
              <LogOut size={15} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </header>

        <main className="page-content">
          <Outlet context={{ refreshShell: loadShellBadges }} />
        </main>
      </div>
    </div>
  );
};
