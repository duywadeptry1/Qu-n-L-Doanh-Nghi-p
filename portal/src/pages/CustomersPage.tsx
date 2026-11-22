import React, { useEffect, useState } from 'react';
import { Crown, Eye, RefreshCw, Save, X } from 'lucide-react';
import { ApiError, apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type {
  CustomerDetailResponse,
  SalesChannel,
  VipCustomerSummary,
  VipCustomersResponse,
  VipTier
} from '../types/api';
import {
  ORDER_STATUS_META,
  VIP_TIER_META,
  computeOrderTotal,
  formatVnd
} from '../utils/format';

export const CustomersPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission('customers:update');

  const [data, setData] = useState<VipCustomersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'ALL' | VipTier>('ALL');
  const [channelFilter, setChannelFilter] = useState<'ALL' | SalesChannel>('ALL');

  // Detail Drawer
  const [detail, setDetail] = useState<CustomerDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formChannel, setFormChannel] = useState<SalesChannel>('B2B');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const loadCustomers = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (tierFilter !== 'ALL') params.set('tier', tierFilter);
      if (channelFilter !== 'ALL') params.set('channel', channelFilter);
      const qs = params.toString();
      const res = await apiRequest<VipCustomersResponse>(`/customers/vip${qs ? `?${qs}` : ''}`);
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được danh sách khách hàng VIP');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCustomers();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, tierFilter, channelFilter]);

  const openDetail = async (customer: VipCustomerSummary) => {
    setDetailLoading(true);
    setError('');
    try {
      const phoneKey = encodeURIComponent(customer.customerPhone || customer.normalizedPhone);
      const res = await apiRequest<CustomerDetailResponse>(`/customers/${phoneKey}`);
      setDetail(res);
      setFormName(res.profile.customerName || '');
      setFormCompany(res.profile.companyName || '');
      setFormChannel(res.profile.primaryChannel || 'B2B');
      setFormAddress(res.profile.defaultAddress || '');
      setFormNotes(res.profile.notes || '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được chi tiết đại diện');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !canUpdate) return;
    setSavingProfile(true);
    setError('');
    try {
      const phoneKey = encodeURIComponent(detail.profile.customerPhone || detail.profile.normalizedPhone);
      await apiRequest(`/customers/${phoneKey}`, {
        method: 'PATCH',
        body: {
          customerName: formName,
          companyName: formCompany,
          defaultChannel: formChannel,
          defaultAddress: formAddress,
          notes: formNotes
        }
      });
      setToast('Đã cập nhật hồ sơ đại diện thành công.');
      await Promise.all([loadCustomers(), openDetail(detail.profile)]);
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Cập nhật hồ sơ thất bại');
    } finally {
      setSavingProfile(false);
    }
  };

  const dist = data?.distribution;
  const policy = data?.policy;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý Đại diện & Khách hàng VIP</h1>
          <p className="page-subtitle">
            Tự động phân hạng theo tần suất mua hàng — áp dụng ưu đãi sản phẩm mẫu & hỗ trợ ship không thấp hơn giá vốn
          </p>
        </div>

        <button type="button" className="btn btn-outline" onClick={() => void loadCustomers()} disabled={loading}>
          <RefreshCw size={15} />
          Làm mới
        </button>
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

      {/* Tier Summary Cards (Clickable Filters) */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className="kpi-card"
          style={{
            textAlign: 'left',
            cursor: 'pointer',
            borderColor: tierFilter === 'VIP_DIAMOND' ? 'var(--indigo)' : undefined
          }}
          onClick={() => setTierFilter(prev => (prev === 'VIP_DIAMOND' ? 'ALL' : 'VIP_DIAMOND'))}
        >
          <div className="kpi-label">💎 VIP Kim Cương</div>
          <div className="kpi-value" style={{ color: 'var(--indigo)' }}>
            {dist?.VIP_DIAMOND ?? 0}
          </div>
          <div className="kpi-sub">
            Từ {policy?.vipTiers.diamondMinOrders ?? 6} đơn · Giảm {policy?.vipTiers.diamondDemoDiscountPercent ?? 20}% SP mẫu
          </div>
        </button>

        <button
          type="button"
          className="kpi-card"
          style={{
            textAlign: 'left',
            cursor: 'pointer',
            borderColor: tierFilter === 'VIP_GOLD' ? 'var(--amber)' : undefined
          }}
          onClick={() => setTierFilter(prev => (prev === 'VIP_GOLD' ? 'ALL' : 'VIP_GOLD'))}
        >
          <div className="kpi-label">👑 VIP Vàng</div>
          <div className="kpi-value" style={{ color: 'var(--amber)' }}>
            {dist?.VIP_GOLD ?? 0}
          </div>
          <div className="kpi-sub">
            Từ {policy?.vipTiers.goldMinOrders ?? 4} đơn · Giảm {policy?.vipTiers.goldDemoDiscountPercent ?? 15}% SP mẫu
          </div>
        </button>

        <button
          type="button"
          className="kpi-card"
          style={{
            textAlign: 'left',
            cursor: 'pointer',
            borderColor: tierFilter === 'VIP_SILVER' ? 'var(--blue)' : undefined
          }}
          onClick={() => setTierFilter(prev => (prev === 'VIP_SILVER' ? 'ALL' : 'VIP_SILVER'))}
        >
          <div className="kpi-label">⭐ VIP Bạc</div>
          <div className="kpi-value" style={{ color: 'var(--blue)' }}>
            {dist?.VIP_SILVER ?? 0}
          </div>
          <div className="kpi-sub">
            Từ {policy?.vipTiers.silverMinOrders ?? 2} đơn · Giảm {policy?.vipTiers.silverDemoDiscountPercent ?? 10}% SP mẫu
          </div>
        </button>

        <div className="kpi-card">
          <div className="kpi-label">Tổng Ưu đãi VIP đã trao</div>
          <div className="kpi-value" style={{ color: 'var(--green)' }}>
            {formatVnd(dist?.totalVipSavings || 0)}
          </div>
          <div className="kpi-sub">
            Trên tổng số <strong>{dist?.totalCustomers ?? 0}</strong> khách hàng / đại diện
          </div>
        </div>
      </div>

      {/* Policy Safeguard Strip */}
      {policy && (
        <div className="alert-banner alert-amber" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Crown size={18} />
            <div style={{ fontSize: 13 }}>
              <strong>Quy tắc bảo toàn chi phí vận chuyển:</strong> Phí ship tiêu chuẩn{' '}
              <strong>{formatVnd(policy.standardShippingFee)}</strong>, giá vốn ship sàn{' '}
              <strong>{formatVnd(policy.shippingBaseCost)}</strong> → Hỗ trợ ship tối đa cho VIP là{' '}
              <strong>{formatVnd(Math.max(0, policy.standardShippingFee - policy.shippingBaseCost))}</strong> (không bao giờ giảm dưới giá vốn).
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: 14, marginBottom: 16 }}>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <input
            type="text"
            className="input"
            style={{ maxWidth: 320 }}
            placeholder="Tìm theo tên đại diện, công ty, số điện thoại..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <select
            className="select"
            style={{ width: 190 }}
            value={tierFilter}
            onChange={e => setTierFilter(e.target.value as 'ALL' | VipTier)}
          >
            <option value="ALL">Tất cả hạng VIP</option>
            <option value="VIP_DIAMOND">💎 VIP Kim Cương</option>
            <option value="VIP_GOLD">👑 VIP Vàng</option>
            <option value="VIP_SILVER">⭐ VIP Bạc</option>
            <option value="STANDARD">Khách thường</option>
          </select>

          <div className="tabs">
            {(
              [
                { key: 'ALL', label: 'Mọi kênh' },
                { key: 'B2B', label: '🏢 B2B' },
                { key: 'B2C', label: '🛍️ B2C' }
              ] as Array<{ key: 'ALL' | SalesChannel; label: string }>
            ).map(ch => (
              <button
                key={ch.key}
                type="button"
                className={`tab-btn${channelFilter === ch.key ? ' active' : ''}`}
                onClick={() => setChannelFilter(ch.key)}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Đại diện / Khách hàng</th>
                <th>Kênh</th>
                <th>Hạng VIP</th>
                <th>Tần suất mua</th>
                <th>Quyền lợi hiện hưởng</th>
                <th>Tổng chi tiêu</th>
                <th>Đã tiết kiệm VIP</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {(data?.customers || []).map(c => {
                const tierMeta = VIP_TIER_META[c.vipTier];
                return (
                  <tr key={c.normalizedPhone || c.customerName} style={{ cursor: 'pointer' }} onClick={() => void openDetail(c)}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{c.customerName}</div>
                      {c.companyName && (
                        <div style={{ fontSize: 12.5, color: 'var(--indigo)', fontWeight: 600 }}>
                          {c.companyName}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.customerPhone}</div>
                    </td>
                    <td>
                      <span className={`badge ${c.primaryChannel === 'B2B' ? 'badge-indigo' : 'badge-green'}`}>
                        {c.channelSymbol} {c.primaryChannel}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${tierMeta.badgeClass}`}>{tierMeta.label}</span>
                      {c.nextTier && c.ordersToNextTier > 0 && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                          +{c.ordersToNextTier} đơn → {VIP_TIER_META[c.nextTier].label}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{c.orderCount} đơn</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {c.deliveredCount} hoàn tất
                      </div>
                    </td>
                    <td>
                      {c.isVip && c.benefits ? (
                        <div style={{ fontSize: 12.5 }}>
                          <div>
                            SP mẫu: <strong>-{c.benefits.demoDiscountPercent}%</strong>
                          </div>
                          <div>
                            Ship: <strong>-{formatVnd(c.benefits.shippingDiscount)}</strong> (còn{' '}
                            {formatVnd(c.benefits.finalShippingFee)})
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Chưa đạt VIP</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--blue)' }}>{formatVnd(c.totalSpent)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--green)' }}>
                      {c.totalVipSavings > 0 ? `-${formatVnd(c.totalVipSavings)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={e => {
                          e.stopPropagation();
                          void openDetail(c);
                        }}
                      >
                        <Eye size={14} />
                        Hồ sơ
                      </button>
                    </td>
                  </tr>
                );
              })}

              {!loading && (data?.customers.length || 0) === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    Không tìm thấy đại diện / khách hàng phù hợp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail & Edit Slide-Over Drawer */}
      {(detail || detailLoading) && (
        <div className="overlay" onClick={() => setDetail(null)}>
          <div className="drawer" style={{ width: 600 }} onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h2 className="card-title">
                  {detail ? detail.profile.customerName : 'Đang tải hồ sơ...'}
                </h2>
                {detail && (
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    SĐT: {detail.profile.customerPhone}
                  </div>
                )}
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setDetail(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="drawer-body">
              {detailLoading || !detail ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Đang tải lịch sử mua hàng & thông tin ưu đãi...
                </div>
              ) : (
                <>
                  {/* VIP Status Summary */}
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      background: '#f8fafc',
                      border: '1px solid var(--border)',
                      marginBottom: 18
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span className={`badge ${VIP_TIER_META[detail.profile.vipTier].badgeClass}`}>
                        {VIP_TIER_META[detail.profile.vipTier].label}
                      </span>
                      <span className={`badge ${detail.profile.primaryChannel === 'B2B' ? 'badge-indigo' : 'badge-green'}`}>
                        {detail.profile.channelSymbol} {detail.profile.primaryChannel}
                      </span>
                    </div>

                    <div className="grid-3" style={{ gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Đơn hợp lệ</div>
                        <div style={{ fontWeight: 800, fontSize: 18 }}>{detail.profile.orderCount}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tổng chi tiêu</div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--blue)' }}>
                          {formatVnd(detail.profile.totalSpent)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Đã tiết kiệm VIP</div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--green)' }}>
                          {formatVnd(detail.profile.totalVipSavings)}
                        </div>
                      </div>
                    </div>

                    {detail.profile.benefits && (
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 13 }}>
                        <div>
                          • Giảm giá sản phẩm mẫu (Demo): <strong>{detail.profile.benefits.demoDiscountPercent}%</strong>
                        </div>
                        <div>
                          • Hỗ trợ phí ship: <strong>{formatVnd(detail.profile.benefits.shippingDiscount)}</strong>{' '}
                          (Phí thực thu: <strong>{formatVnd(detail.profile.benefits.finalShippingFee)}</strong> · Sàn vốn:{' '}
                          {formatVnd(detail.profile.benefits.shippingCostFloor)})
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CRM Edit Form */}
                  <form onSubmit={handleSaveProfile} style={{ marginBottom: 22 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 14.5 }}>Thông tin hồ sơ đại diện</h3>

                    <div className="grid-2" style={{ gap: 12 }}>
                      <div className="form-group">
                        <label className="field-label">Tên đại diện / Khách hàng</label>
                        <input
                          className="input"
                          value={formName}
                          onChange={e => setFormName(e.target.value)}
                          disabled={!canUpdate}
                        />
                      </div>

                      <div className="form-group">
                        <label className="field-label">Tên doanh nghiệp (B2B)</label>
                        <input
                          className="input"
                          placeholder="VD: Công ty TNHH..."
                          value={formCompany}
                          onChange={e => setFormCompany(e.target.value)}
                          disabled={!canUpdate}
                        />
                      </div>
                    </div>

                    <div className="grid-2" style={{ gap: 12 }}>
                      <div className="form-group">
                        <label className="field-label">Kênh mặc định</label>
                        <select
                          className="select"
                          value={formChannel}
                          onChange={e => setFormChannel(e.target.value as SalesChannel)}
                          disabled={!canUpdate}
                        >
                          <option value="B2B">🏢 Doanh nghiệp (B2B)</option>
                          <option value="B2C">🛍️ Bán lẻ (B2C)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="field-label">Địa chỉ mặc định</label>
                        <input
                          className="input"
                          value={formAddress}
                          onChange={e => setFormAddress(e.target.value)}
                          disabled={!canUpdate}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="field-label">Ghi chú chăm sóc khách hàng</label>
                      <textarea
                        className="textarea"
                        rows={2}
                        placeholder="Ghi chú lịch lấy hàng, công nợ, ưu đãi riêng..."
                        value={formNotes}
                        onChange={e => setFormNotes(e.target.value)}
                        disabled={!canUpdate}
                      />
                    </div>

                    {canUpdate && (
                      <button type="submit" className="btn btn-primary btn-sm" disabled={savingProfile}>
                        <Save size={14} />
                        {savingProfile ? 'Đang lưu...' : 'Lưu hồ sơ đại diện'}
                      </button>
                    )}
                  </form>

                  {/* Order History */}
                  <div>
                    <h3 style={{ margin: '0 0 10px', fontSize: 14.5 }}>
                      Lịch sử đơn hàng ({detail.orders.length})
                    </h3>

                    <div style={{ display: 'grid', gap: 10 }}>
                      {detail.orders.map(order => {
                        const statusMeta = ORDER_STATUS_META[order.status];
                        const total = computeOrderTotal(order);
                        const saved = (order.vipProductDiscount || 0) + (order.shippingDiscount || 0);
                        return (
                          <div
                            key={order.id}
                            style={{
                              padding: 12,
                              borderRadius: 10,
                              border: '1px solid var(--border)',
                              background: '#ffffff'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <strong>{order.id}</strong>
                              <span className={`badge ${statusMeta.badgeClass}`}>{statusMeta.label}</span>
                            </div>
                            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6 }}>
                              {order.items.map(i => `${i.productName} ×${i.quantity}`).join(', ')}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                              <span style={{ color: 'var(--text-muted)' }}>{order.timeAgo}</span>
                              <span>
                                {saved > 0 && (
                                  <span style={{ color: 'var(--green)', marginRight: 10, fontWeight: 600 }}>
                                    VIP -{formatVnd(saved)}
                                  </span>
                                )}
                                <strong style={{ color: 'var(--blue)' }}>{formatVnd(total)}</strong>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
