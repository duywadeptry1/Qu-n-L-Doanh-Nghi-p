import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Sliders,
  UserCheck,
  UserX,
  X
} from 'lucide-react';
import { ApiError, apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { AuditLogItem, AuthUser, PolicySetting, UserRole } from '../types/api';
import { ROLE_META, formatVnd } from '../utils/format';

type SettingsTab = 'policy' | 'users' | 'audit';

const ALL_ROLES: UserRole[] = [
  'ADMIN',
  'MANAGER',
  'SALES',
  'WAREHOUSE',
  'ACCOUNTANT',
  'B2B_PARTNER'
];

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: 'Toàn quyền hệ thống, cấu hình VIP/Ship, quản lý tài khoản & xem Audit Log',
  MANAGER: 'Xem giá nhập/lợi nhuận, duyệt/huỷ mọi đơn, quản lý kho & hồ sơ VIP',
  SALES: 'Tạo đơn, xem doanh thu, duyệt đơn đặt mới & chăm sóc đại diện VIP (ẩn giá nhập)',
  WAREHOUSE: 'Nhập kho/mở khóa GD, xem nhật ký kho, đóng gói & giao ĐVVC (ẩn tài chính)',
  ACCOUNTANT: 'Xem đầy đủ giá nhập, lợi nhuận, sổ giao dịch, báo cáo CSV & Audit Log (chỉ đọc kho)',
  B2B_PARTNER: 'Cổng đối tác B2B xem danh mục sản phẩm & đặt/theo dõi đơn của chính mình'
};

export const SettingsPage: React.FC = () => {
  const { user: currentUser, hasPermission } = useAuth();

  const canReadPolicy = hasPermission('settings:read');
  const canUpdatePolicy = hasPermission('settings:update');
  const canManageUsers = hasPermission('users:manage');
  const canReadAudit = hasPermission('audit_logs:read');

  const availableTabs = useMemo(() => {
    const list: Array<{ key: SettingsTab; label: string }> = [];
    if (canReadPolicy) list.push({ key: 'policy', label: 'Chính sách VIP & Kho' });
    if (canManageUsers) list.push({ key: 'users', label: 'Tài khoản & RBAC' });
    if (canReadAudit) list.push({ key: 'audit', label: 'Nhật ký kiểm toán' });
    return list;
  }, [canReadPolicy, canManageUsers, canReadAudit]);

  const [activeTab, setActiveTab] = useState<SettingsTab>(availableTabs[0]?.key || 'policy');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // Tab 1: Policy
  const [policy, setPolicy] = useState<PolicySetting | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);

  // Tab 2: Users
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [uFullName, setUFullName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPhone, setUPhone] = useState('');
  const [uRole, setURole] = useState<UserRole>('SALES');
  const [uPassword, setUPassword] = useState('');
  const [uIsActive, setUIsActive] = useState(true);
  const [userSaving, setUserSaving] = useState(false);

  // Tab 3: Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditEntity, setAuditEntity] = useState('');
  const [auditRole, setAuditRole] = useState('');
  const [auditLimit, setAuditLimit] = useState(50);
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  // Loaders
  const loadPolicy = async () => {
    if (!canReadPolicy) return;
    setPolicyLoading(true);
    setError('');
    try {
      const res = await apiRequest<PolicySetting>('/settings/policy');
      setPolicy(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được cấu hình chính sách');
    } finally {
      setPolicyLoading(false);
    }
  };

  const loadUsers = async () => {
    if (!canManageUsers) return;
    setUsersLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (userSearch.trim()) params.set('search', userSearch.trim());
      if (userRoleFilter !== 'ALL') params.set('role', userRoleFilter);
      const qs = params.toString();
      const res = await apiRequest<AuthUser[]>(`/users${qs ? `?${qs}` : ''}`);
      setUsers(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được danh sách tài khoản');
    } finally {
      setUsersLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    if (!canReadAudit) return;
    setAuditLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: String(auditLimit) });
      if (auditEntity) params.set('entity', auditEntity);
      if (auditRole) params.set('actorRole', auditRole);
      const res = await apiRequest<AuditLogItem[]>(`/audit-logs?${params.toString()}`);
      setAuditLogs(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được nhật ký kiểm toán');
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'policy') void loadPolicy();
    if (activeTab === 'users') void loadUsers();
    if (activeTab === 'audit') void loadAuditLogs();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'users') {
      const timer = setTimeout(() => void loadUsers(), 200);
      return () => clearTimeout(timer);
    }
  }, [userSearch, userRoleFilter]);

  useEffect(() => {
    if (activeTab === 'audit') {
      void loadAuditLogs();
    }
  }, [auditEntity, auditRole, auditLimit]);

  // Policy Handlers
  const updateTierField = (field: keyof PolicySetting['vipTiers'], val: number) => {
    setPolicy(prev =>
      prev
        ? {
            ...prev,
            vipTiers: {
              ...prev.vipTiers,
              [field]: Math.max(0, Number.isFinite(val) ? val : 0)
            }
          }
        : prev
    );
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy || !canUpdatePolicy) return;
    setError('');
    if (policy.shippingBaseCost > policy.standardShippingFee) {
      setError('Giá vốn ship (shippingBaseCost) không được lớn hơn phí ship tiêu chuẩn.');
      return;
    }
    setPolicySaving(true);
    try {
      const saved = await apiRequest<PolicySetting>('/settings/policy', {
        method: 'PUT',
        body: {
          standardShippingFee: policy.standardShippingFee,
          shippingBaseCost: policy.shippingBaseCost,
          lowStockThreshold: policy.lowStockThreshold,
          vipTiers: policy.vipTiers
        }
      });
      setPolicy(saved);
      showToast('Đã lưu chính sách VIP & vận chuyển thành công (áp dụng ngay lập tức).');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Lưu chính sách thất bại');
    } finally {
      setPolicySaving(false);
    }
  };

  // User Modal Handlers
  const openCreateUser = () => {
    setEditingUser(null);
    setUFullName('');
    setUEmail('');
    setUPhone('');
    setURole('SALES');
    setUPassword('');
    setUIsActive(true);
    setShowUserModal(true);
  };

  const openEditUser = (u: AuthUser) => {
    setEditingUser(u);
    setUFullName(u.fullName);
    setUEmail(u.email);
    setUPhone(u.phone || '');
    setURole(u.role);
    setUPassword('');
    setUIsActive(u.isActive);
    setShowUserModal(true);
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserSaving(true);
    setError('');
    try {
      if (editingUser) {
        await apiRequest(`/users/${editingUser.id}`, {
          method: 'PATCH',
          body: {
            fullName: uFullName,
            phone: uPhone,
            role: uRole,
            isActive: uIsActive,
            ...(uPassword.trim().length >= 6 ? { password: uPassword.trim() } : {})
          }
        });
        showToast(`Đã cập nhật tài khoản ${editingUser.email}.`);
      } else {
        await apiRequest('/users', {
          method: 'POST',
          body: {
            fullName: uFullName,
            email: uEmail,
            phone: uPhone,
            role: uRole,
            password: uPassword
          }
        });
        showToast(`Đã tạo tài khoản ${uEmail} (${uRole}).`);
      }
      setShowUserModal(false);
      await loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Lưu tài khoản thất bại');
    } finally {
      setUserSaving(false);
    }
  };

  const handleQuickToggleActive = async (target: AuthUser) => {
    setError('');
    try {
      await apiRequest(`/users/${target.id}`, {
        method: 'PATCH',
        body: { isActive: !target.isActive }
      });
      showToast(`${target.isActive ? 'Đã khóa' : 'Đã mở khóa'} tài khoản ${target.email}.`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể thay đổi trạng thái tài khoản');
    }
  };

  const maxSafeShipDiscount = policy
    ? Math.max(0, policy.standardShippingFee - policy.shippingBaseCost)
    : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cài đặt Hệ thống, RBAC & Audit Log</h1>
          <p className="page-subtitle">
            Cấu hình động ngưỡng ưu đãi VIP, giá vốn vận chuyển, tài khoản nhân viên và nhật ký kiểm toán
          </p>
        </div>

        <div className="tabs">
          {availableTabs.map(t => (
            <button
              key={t.key}
              type="button"
              className={`tab-btn${activeTab === t.key ? ' active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div className="alert-banner alert-green" style={{ marginBottom: 16 }}>
          <span>{toast}</span>
        </div>
      )}
      {error && (
        <div className="alert-banner alert-red" style={{ marginBottom: 16 }}>
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: VIP & INVENTORY POLICY */}
      {activeTab === 'policy' && canReadPolicy && (
        <div>
          {!canUpdatePolicy && (
            <div className="alert-banner alert-blue" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Lock size={17} />
                <span>
                  Bạn đang ở chế độ <strong>Chỉ xem</strong>. Chỉ tài khoản <strong>ADMIN</strong> mới được phép cập nhật chính sách hệ thống.
                </span>
              </div>
            </div>
          )}

          {policyLoading || !policy ? (
            <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
              Đang tải chính sách VIP & kho...
            </div>
          ) : (
            <form onSubmit={handleSavePolicy}>
              <div className="card" style={{ marginBottom: 18 }}>
                <div className="card-header">
                  <h2 className="card-title">
                    <Sliders size={16} style={{ verticalAlign: -2, marginRight: 6 }} />
                    Cấu hình Vận chuyển & Ngưỡng tồn kho
                  </h2>
                  {canUpdatePolicy && (
                    <button type="submit" className="btn btn-primary" disabled={policySaving}>
                      <Save size={15} />
                      {policySaving ? 'Đang lưu...' : 'Lưu chính sách'}
                    </button>
                  )}
                </div>

                <div className="grid-3">
                  <div className="form-group">
                    <label className="field-label">Phí ship tiêu chuẩn (VNĐ)</label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      className="input"
                      value={policy.standardShippingFee}
                      disabled={!canUpdatePolicy}
                      onChange={e =>
                        setPolicy({ ...policy, standardShippingFee: Math.max(0, Number(e.target.value)) })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="field-label">Giá vốn ship sàn (VNĐ — không giảm thấp hơn)</label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      className="input"
                      value={policy.shippingBaseCost}
                      disabled={!canUpdatePolicy}
                      onChange={e =>
                        setPolicy({ ...policy, shippingBaseCost: Math.max(0, Number(e.target.value)) })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="field-label">Ngưỡng cảnh báo sắp hết hàng (SL)</label>
                    <input
                      type="number"
                      min={1}
                      className="input"
                      value={policy.lowStockThreshold}
                      disabled={!canUpdatePolicy}
                      onChange={e =>
                        setPolicy({ ...policy, lowStockThreshold: Math.max(0, Number(e.target.value)) })
                      }
                    />
                  </div>
                </div>

                <div className="alert-banner alert-green" style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 13 }}>
                    <strong>Biên hỗ trợ ship an toàn hiện tại:</strong> Tối đa{' '}
                    <strong>{formatVnd(maxSafeShipDiscount)}</strong> mỗi đơn (Phí chuẩn{' '}
                    {formatVnd(policy.standardShippingFee)} − Giá vốn sàn {formatVnd(policy.shippingBaseCost)}).
                    Hệ thống tự động khóa giao dịch khi tồn kho sản phẩm = 0.
                  </div>
                </div>
              </div>

              <div className="grid-3">
                {(
                  [
                    {
                      title: '⭐ Hạng VIP Bạc',
                      badgeClass: 'badge-blue',
                      minKey: 'silverMinOrders',
                      demoKey: 'silverDemoDiscountPercent',
                      shipKey: 'silverShippingDiscount'
                    },
                    {
                      title: '👑 Hạng VIP Vàng',
                      badgeClass: 'badge-amber',
                      minKey: 'goldMinOrders',
                      demoKey: 'goldDemoDiscountPercent',
                      shipKey: 'goldShippingDiscount'
                    },
                    {
                      title: '💎 Hạng VIP Kim Cương',
                      badgeClass: 'badge-indigo',
                      minKey: 'diamondMinOrders',
                      demoKey: 'diamondDemoDiscountPercent',
                      shipKey: 'diamondShippingDiscount'
                    }
                  ] as const
                ).map(tier => {
                  const rawShipDisc = policy.vipTiers[tier.shipKey];
                  const cappedShipDisc = Math.min(rawShipDisc, maxSafeShipDiscount);
                  const finalShip = policy.standardShippingFee - cappedShipDisc;

                  return (
                    <div key={tier.title} className="card">
                      <div style={{ marginBottom: 14 }}>
                        <span className={`badge ${tier.badgeClass}`}>{tier.title}</span>
                      </div>

                      <div className="form-group">
                        <label className="field-label">Số đơn tối thiểu để đạt hạng</label>
                        <input
                          type="number"
                          min={1}
                          className="input"
                          value={policy.vipTiers[tier.minKey]}
                          disabled={!canUpdatePolicy}
                          onChange={e => updateTierField(tier.minKey, Number(e.target.value))}
                        />
                      </div>

                      <div className="form-group">
                        <label className="field-label">Giảm giá Sản phẩm Mẫu (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={80}
                          className="input"
                          value={policy.vipTiers[tier.demoKey]}
                          disabled={!canUpdatePolicy}
                          onChange={e => updateTierField(tier.demoKey, Number(e.target.value))}
                        />
                      </div>

                      <div className="form-group">
                        <label className="field-label">Hỗ trợ phí vận chuyển (VNĐ)</label>
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          className="input"
                          value={rawShipDisc}
                          disabled={!canUpdatePolicy}
                          onChange={e => updateTierField(tier.shipKey, Number(e.target.value))}
                        />
                      </div>

                      <div
                        style={{
                          padding: 10,
                          borderRadius: 8,
                          background: rawShipDisc > maxSafeShipDiscount ? 'var(--amber-soft)' : '#f8fafc',
                          border: `1px solid ${rawShipDisc > maxSafeShipDiscount ? 'var(--amber-border)' : 'var(--border)'}`,
                          fontSize: 12.5
                        }}
                      >
                        <div>
                          Phí ship thực thu: <strong>{formatVnd(finalShip)}</strong>
                        </div>
                        {rawShipDisc > maxSafeShipDiscount && (
                          <div style={{ color: 'var(--amber)', marginTop: 4, fontWeight: 600 }}>
                            Tự động giới hạn ở mức tối đa {formatVnd(maxSafeShipDiscount)} để không lỗ vốn ship.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB 2: USERS & RBAC */}
      {activeTab === 'users' && canManageUsers && (
        <div>
          <div className="card" style={{ padding: 14, marginBottom: 16 }}>
            <div className="toolbar" style={{ marginBottom: 0, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: 1 }}>
                <input
                  className="input"
                  style={{ maxWidth: 280 }}
                  placeholder="Tìm theo tên, email, SĐT..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                />
                <select
                  className="select"
                  style={{ width: 190 }}
                  value={userRoleFilter}
                  onChange={e => setUserRoleFilter(e.target.value)}
                >
                  <option value="ALL">Tất cả vai trò</option>
                  {ALL_ROLES.map(r => (
                    <option key={r} value={r}>
                      {ROLE_META[r].label} ({r})
                    </option>
                  ))}
                </select>
              </div>

              <button type="button" className="btn btn-primary" onClick={openCreateUser}>
                <Plus size={15} />
                Tạo tài khoản mới
              </button>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nhân sự / Tài khoản</th>
                    <th>Số điện thoại</th>
                    <th>Vai trò RBAC</th>
                    <th>Trạng thái</th>
                    <th>Đăng nhập gần nhất</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const meta = ROLE_META[u.role];
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <tr key={u.id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>
                            {u.fullName}{' '}
                            {isSelf && <span className="badge badge-blue">Bạn</span>}
                          </div>
                          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{u.email}</div>
                        </td>
                        <td>{u.phone || '—'}</td>
                        <td>
                          <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>
                        </td>
                        <td>
                          <span className={`badge ${u.isActive ? 'badge-green' : 'badge-red'}`}>
                            {u.isActive ? 'Hoạt động' : 'Đã khóa'}
                          </span>
                        </td>
                        <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('vi-VN') : 'Chưa đăng nhập'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 8 }}>
                            <button type="button" className="btn btn-outline btn-sm" onClick={() => openEditUser(u)}>
                              Chỉnh sửa
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm ${u.isActive ? 'btn-soft-red' : 'btn-soft-green'}`}
                              onClick={() => void handleQuickToggleActive(u)}
                              title={u.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                            >
                              {u.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                              {u.isActive ? 'Khóa' : 'Mở'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!usersLoading && users.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                        Không tìm thấy tài khoản nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* RBAC Matrix Reference */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <Shield size={16} style={{ verticalAlign: -2, marginRight: 6 }} />
                Ma trận phân quyền các vai trò (RBAC)
              </h2>
            </div>
            <div className="grid-3">
              {ALL_ROLES.map(r => (
                <div
                  key={r}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: '#fafcff'
                  }}
                >
                  <div style={{ marginBottom: 6 }}>
                    <span className={`badge ${ROLE_META[r].badgeClass}`}>{ROLE_META[r].label}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{ROLE_DESCRIPTIONS[r]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === 'audit' && canReadAudit && (
        <div>
          <div className="card" style={{ padding: 14, marginBottom: 16 }}>
            <div className="toolbar" style={{ marginBottom: 0, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <select
                  className="select"
                  style={{ width: 185 }}
                  value={auditEntity}
                  onChange={e => setAuditEntity(e.target.value)}
                >
                  <option value="">Tất cả đối tượng</option>
                  <option value="Order">Đơn hàng (Order)</option>
                  <option value="Product">Sản phẩm / Kho (Product)</option>
                  <option value="CustomerProfile">Đại diện VIP (CustomerProfile)</option>
                  <option value="PolicySetting">Chính sách (PolicySetting)</option>
                  <option value="User">Tài khoản (User)</option>
                </select>

                <select
                  className="select"
                  style={{ width: 175 }}
                  value={auditRole}
                  onChange={e => setAuditRole(e.target.value)}
                >
                  <option value="">Tất cả vai trò</option>
                  {ALL_ROLES.map(r => (
                    <option key={r} value={r}>
                      {ROLE_META[r].label}
                    </option>
                  ))}
                </select>

                <select
                  className="select"
                  style={{ width: 130 }}
                  value={auditLimit}
                  onChange={e => setAuditLimit(Number(e.target.value))}
                >
                  <option value={50}>50 bản ghi</option>
                  <option value={100}>100 bản ghi</option>
                  <option value={200}>200 bản ghi</option>
                </select>
              </div>

              <button type="button" className="btn btn-outline btn-sm" onClick={() => void loadAuditLogs()} disabled={auditLoading}>
                <RefreshCw size={14} />
                Tải lại
              </button>
            </div>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Người thực hiện</th>
                    <th>Hành động</th>
                    <th>Đối tượng</th>
                    <th>Nội dung</th>
                    <th style={{ textAlign: 'right' }}>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => {
                    const expanded = expandedAuditId === log._id;
                    const roleMeta = ROLE_META[log.actorRole as UserRole];
                    return (
                      <React.Fragment key={log._id}>
                        <tr>
                          <td style={{ whiteSpace: 'nowrap', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                            {new Date(log.createdAt).toLocaleString('vi-VN')}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{log.actorEmail}</div>
                            {roleMeta ? (
                              <span className={`badge ${roleMeta.badgeClass}`} style={{ marginTop: 3 }}>
                                {roleMeta.label}
                              </span>
                            ) : (
                              <span className="badge badge-gray" style={{ marginTop: 3 }}>
                                {log.actorRole}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className="badge badge-blue">{log.action}</span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{log.entity}</div>
                            {log.entityId && (
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>#{log.entityId}</div>
                            )}
                          </td>
                          <td>{log.summary || '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => setExpandedAuditId(expanded ? null : log._id)}
                            >
                              <FileText size={14} />
                              {expanded ? 'Đóng' : 'JSON'}
                            </button>
                          </td>
                        </tr>
                        {expanded && (
                          <tr>
                            <td colSpan={6} style={{ background: '#f8fafc' }}>
                              <div className="grid-2" style={{ gap: 12 }}>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-muted)' }}>
                                    TRƯỚC KHI THAY ĐỔI (before)
                                  </div>
                                  <pre className="code-block">
                                    {log.before ? JSON.stringify(log.before, null, 2) : 'null'}
                                  </pre>
                                </div>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-muted)' }}>
                                    SAU KHI THAY ĐỔI (after)
                                  </div>
                                  <pre className="code-block">
                                    {log.after ? JSON.stringify(log.after, null, 2) : 'null'}
                                  </pre>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {!auditLoading && auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                        Chưa có bản ghi kiểm toán nào khớp bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit User Modal */}
      {showUserModal && (
        <div className="overlay-center" onClick={() => setShowUserModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="card-title">
                {editingUser ? `Chỉnh sửa tài khoản ${editingUser.email}` : 'Tạo tài khoản nhân viên mới'}
              </h2>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowUserModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="field-label">Họ và tên *</label>
                  <input
                    className="input"
                    required
                    value={uFullName}
                    onChange={e => setUFullName(e.target.value)}
                  />
                </div>

                {!editingUser && (
                  <div className="form-group">
                    <label className="field-label">Email đăng nhập *</label>
                    <input
                      type="email"
                      className="input"
                      required
                      placeholder="nhanvien@viendong.vn"
                      value={uEmail}
                      onChange={e => setUEmail(e.target.value)}
                    />
                  </div>
                )}

                <div className="grid-2" style={{ gap: 12 }}>
                  <div className="form-group">
                    <label className="field-label">Số điện thoại</label>
                    <input
                      className="input"
                      value={uPhone}
                      onChange={e => setUPhone(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="field-label">Vai trò phân quyền (RBAC)</label>
                    <select
                      className="select"
                      value={uRole}
                      onChange={e => setURole(e.target.value as UserRole)}
                    >
                      {ALL_ROLES.map(r => (
                        <option key={r} value={r}>
                          {ROLE_META[r].label} ({r})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="field-label">
                    {editingUser ? 'Đặt lại mật khẩu (để trống nếu giữ nguyên)' : 'Mật khẩu khởi tạo (≥ 6 ký tự) *'}
                  </label>
                  <input
                    type="password"
                    className="input"
                    required={!editingUser}
                    minLength={editingUser ? undefined : 6}
                    value={uPassword}
                    onChange={e => setUPassword(e.target.value)}
                  />
                </div>

                {editingUser && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={uIsActive}
                      onChange={e => setUIsActive(e.target.checked)}
                    />
                    Tài khoản đang hoạt động (bỏ chọn để khóa đăng nhập)
                  </label>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowUserModal(false)}>
                  Huỷ
                </button>
                <button type="submit" className="btn btn-primary" disabled={userSaving}>
                  {userSaving ? 'Đang lưu...' : editingUser ? 'Cập nhật' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
