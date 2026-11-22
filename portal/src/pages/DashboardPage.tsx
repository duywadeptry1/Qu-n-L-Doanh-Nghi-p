import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, RefreshCw } from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type {
  CalendarDay,
  DashboardKpis,
  IncomeReportResponse,
  Order,
  Product
} from '../types/api';
import {
  ORDER_STATUS_META,
  VIP_TIER_META,
  computeOrderTotal,
  formatVnd,
  formatVndCompact
} from '../utils/format';

export const DashboardPage: React.FC = () => {
  const { hasPermission, hasAnyPermission } = useAuth();
  const navigate = useNavigate();

  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [lockedProducts, setLockedProducts] = useState<Product[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [income, setIncome] = useState<IncomeReportResponse | null>(null);
  const [metric, setMetric] = useState<'REVENUE' | 'PROFIT'>('REVENUE');
  const [loading, setLoading] = useState(true);

  const canSeeReports = hasAnyPermission('reports:view_revenue', 'reports:view_profit');
  const canSeeProfit = hasPermission('reports:view_profit');

  const loadDashboard = async (selectedMetric: 'REVENUE' | 'PROFIT' = metric) => {
    setLoading(true);
    try {
      const safeMetric = selectedMetric === 'PROFIT' && !canSeeProfit ? 'REVENUE' : selectedMetric;
      const tasks: Promise<unknown>[] = [
        apiRequest<DashboardKpis>('/dashboard/kpis').then(setKpis),
        hasPermission('products:read')
          ? apiRequest<Product[]>('/products/locked').then(setLockedProducts)
          : Promise.resolve(),
        hasAnyPermission('orders:read', 'orders:read_own')
          ? apiRequest<Order[]>('/orders').then(list => setRecentOrders(list.slice(0, 6)))
          : Promise.resolve(),
        hasPermission('calendar:view')
          ? apiRequest<CalendarDay[]>('/calendar').then(setCalendarDays)
          : Promise.resolve(),
        canSeeReports
          ? apiRequest<IncomeReportResponse>(`/reports/income?period=WEEK&metric=${safeMetric}`).then(setIncome)
          : Promise.resolve()
      ];
      await Promise.allSettled(tasks);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard(metric);
  }, [metric]);

  const series = income?.series || [];
  const maxBarValue = Math.max(
    1,
    ...series.map(pt => (metric === 'PROFIT' && income?.canViewProfit ? Math.max(0, pt.profit || 0) : pt.revenue))
  );

  const activeCalendarWindow = (() => {
    const past = calendarDays.filter(d => !d.isFuture);
    return past.slice(-7);
  })();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tổng quan vận hành</h1>
          <p className="page-subtitle">
            Theo dõi đơn hàng 4 bước, cảnh báo khóa tồn kho, doanh thu/lợi nhuận và kênh B2B/B2C
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-outline" onClick={() => void loadDashboard(metric)}>
            <RefreshCw size={15} />
            <span>Làm mới</span>
          </button>
          {hasPermission('products:restock') && (
            <button type="button" className="btn btn-soft-green" onClick={() => navigate('/products')}>
              + Nhập kho
            </button>
          )}
          {hasAnyPermission('orders:create', 'orders:create_own') && (
            <button type="button" className="btn btn-primary" onClick={() => navigate('/orders?new=1')}>
              <Plus size={16} />
              <span>Tạo đơn mới</span>
            </button>
          )}
        </div>
      </div>

      {/* 5 KPI Cards */}
      <div className="grid-kpi-5" style={{ marginBottom: 18 }}>
        <div className="kpi-card">
          <div className="kpi-label">🆕 Chờ duyệt (PLACED)</div>
          <div className="kpi-value" style={{ color: 'var(--blue)' }}>
            {kpis?.placedCount ?? '—'}
          </div>
          <div className="kpi-sub">Đơn mới cần xác nhận</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">📦 Chuẩn bị hàng</div>
          <div className="kpi-value" style={{ color: 'var(--indigo)' }}>
            {kpis?.preparingCount ?? '—'}
          </div>
          <div className="kpi-sub">Đang đóng gói tại kho</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">🚚 Đang giao ĐVVC</div>
          <div className="kpi-value" style={{ color: 'var(--amber)' }}>
            {kpis?.deliveringCount ?? '—'}
          </div>
          <div className="kpi-sub">Đang trên đường giao</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">✅ Giao thành công</div>
          <div className="kpi-value" style={{ color: 'var(--green)' }}>
            {kpis?.deliveredCount ?? '—'}
          </div>
          <div className="kpi-sub">Đã ghi nhận doanh thu</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">❌ Đơn đã huỷ</div>
          <div className="kpi-value" style={{ color: 'var(--red)' }}>
            {kpis?.cancelledCount ?? '—'}
          </div>
          <div className="kpi-sub">Tự hoàn kho nếu chưa ship</div>
        </div>
      </div>

      {/* Trade-Lock Alert Banner */}
      {lockedProducts.length > 0 && (
        <div className="alert-banner alert-red" style={{ marginBottom: 18 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14.5 }}>
              🔒 CẢNH BÁO KHÓA GIAO DỊCH: {lockedProducts.length} sản phẩm đã hết tồn kho (tồn = 0)
            </div>
            <div style={{ fontSize: 13, marginTop: 2 }}>
              Đang khóa: {lockedProducts.slice(0, 3).map(p => `${p.name} (${p.sku})`).join(', ')}
              {lockedProducts.length > 3 ? ` và ${lockedProducts.length - 3} mã khác` : ''}. Nhập thêm hàng để mở khóa tạo đơn.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => navigate('/products?stockStatus=LOCKED')}
          >
            🔓 Nhập kho mở khóa <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Charts + B2B/B2C Comparison */}
      {canSeeReports && income && (
        <div className="grid-dashboard-main" style={{ marginBottom: 18 }}>
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  {metric === 'PROFIT' && income.canViewProfit
                    ? 'Lợi nhuận ròng 7 ngày gần nhất'
                    : 'Doanh thu thực tế 7 ngày gần nhất'}
                </h2>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  Kỳ {income.periodLabel} • {income.summary.deliveredOrders} đơn hoàn tất
                </div>
              </div>

              <div className="tabs">
                <button
                  type="button"
                  className={`tab-btn${metric === 'REVENUE' ? ' active' : ''}`}
                  onClick={() => setMetric('REVENUE')}
                >
                  Doanh thu
                </button>
                {canSeeProfit && (
                  <button
                    type="button"
                    className={`tab-btn${metric === 'PROFIT' ? ' active' : ''}`}
                    onClick={() => setMetric('PROFIT')}
                  >
                    Lợi nhuận
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tổng doanh thu</div>
                <div className="num" style={{ fontSize: 20, fontWeight: 800, color: 'var(--blue)' }}>
                  {formatVnd(income.summary.totalRevenue)}
                </div>
              </div>
              {income.canViewProfit && (
                <>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Lợi nhuận ròng</div>
                    <div className="num" style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)' }}>
                      {formatVnd(income.summary.totalProfit)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Giá vốn & Ship</div>
                    <div className="num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {formatVnd(income.summary.totalCost)} ({income.summary.profitMarginPercent}%)
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="bar-chart">
              {series.map(pt => {
                const rawVal =
                  metric === 'PROFIT' && income.canViewProfit ? Math.max(0, pt.profit || 0) : pt.revenue;
                const pct = Math.max(4, Math.round((rawVal / maxBarValue) * 100));
                const color =
                  metric === 'PROFIT' && income.canViewProfit ? 'var(--green)' : 'var(--blue)';
                return (
                  <div key={pt.label} className="bar-col" title={`${pt.label}: ${formatVnd(rawVal)}`}>
                    <div className="bar-value num">{rawVal > 0 ? formatVndCompact(rawVal) : '0'}</div>
                    <div
                      className="bar-fill"
                      style={{
                        height: `${pct}%`,
                        background: rawVal > 0 ? color : 'var(--border)'
                      }}
                    />
                    <div className="bar-label">{pt.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="card-header">
                <h2 className="card-title">So sánh kênh 🏢 B2B vs 🛍️ B2C</h2>
                <span className="badge badge-amber">🎁 VIP: -{formatVnd(income.summary.totalVipSavings)}</span>
              </div>

              {/* Proportional bar */}
              <div
                style={{
                  height: 14,
                  borderRadius: 999,
                  overflow: 'hidden',
                  display: 'flex',
                  background: 'var(--bg-subtle)',
                  marginBottom: 16
                }}
              >
                <div
                  style={{
                    width: `${income.channels.B2B.sharePercent}%`,
                    background: 'var(--indigo)'
                  }}
                />
                <div
                  style={{
                    width: `${income.channels.B2C.sharePercent}%`,
                    background: 'var(--blue)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(['B2B', 'B2C'] as const).map(ch => {
                  const stats = income.channels[ch];
                  return (
                    <div
                      key={ch}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        background: ch === 'B2B' ? 'var(--indigo-soft)' : 'var(--blue-soft)',
                        border: `1px solid ${ch === 'B2B' ? 'var(--indigo-border)' : 'var(--blue-border)'}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>
                          {stats.symbol} {stats.label}
                        </strong>
                        <span className="badge badge-gray">{stats.sharePercent}%</span>
                      </div>
                      <div
                        className="num"
                        style={{ marginTop: 6, fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}
                      >
                        {formatVnd(stats.revenue)}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {stats.orderCount} đơn hoàn tất
                        {income.canViewProfit && stats.profit !== undefined
                          ? ` • Lãi ròng: +${formatVnd(stats.profit)} (${stats.profitMarginPercent}%)`
                          : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {activeCalendarWindow.length > 0 && (
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
                  📅 Mật độ đơn 7 ngày qua
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                  {activeCalendarWindow.map((day, idx) => {
                    const isToday = idx === activeCalendarWindow.length - 1;
                    return (
                      <div
                        key={day.dayNumber}
                        title={day.fullDateLabel}
                        style={{
                          textAlign: 'center',
                          padding: '8px 4px',
                          borderRadius: 10,
                          background: isToday ? 'var(--blue)' : 'var(--bg-subtle)',
                          color: isToday ? '#ffffff' : 'var(--text-primary)'
                        }}
                      >
                        <div style={{ fontSize: 11, opacity: 0.8 }}>{day.monthLabel}</div>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{day.dayNumber}</div>
                        <div style={{ fontSize: 11, fontWeight: 700 }}>{day.totalOrders}đ</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Đơn hàng gần đây</h2>
          <Link to="/orders" className="btn btn-outline btn-sm">
            Xem tất cả <ArrowRight size={14} />
          </Link>
        </div>

        {loading && recentOrders.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--text-muted)' }}>Đang tải dữ liệu...</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Kênh</th>
                  <th>Khách hàng / Đại diện</th>
                  <th>Hạng VIP</th>
                  <th>Tổng thanh toán</th>
                  <th>Trạng thái</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(order => {
                  const st = ORDER_STATUS_META[order.status];
                  const vip = VIP_TIER_META[order.vipTierAtPurchase || 'STANDARD'];
                  return (
                    <tr key={order.id}>
                      <td style={{ fontWeight: 700 }}>#{order.id}</td>
                      <td>
                        <span className={`badge ${order.salesChannel === 'B2B' ? 'badge-indigo' : 'badge-blue'}`}>
                          {order.salesChannel === 'B2B' ? '🏢 B2B' : '🛍️ B2C'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{order.customerName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{order.customerPhone}</div>
                      </td>
                      <td>
                        <span className={`badge ${vip.badgeClass}`}>{vip.label}</span>
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {formatVnd(computeOrderTotal(order))}
                      </td>
                      <td>
                        <span className={`badge ${st.badgeClass}`}>{st.label}</span>
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{order.timeAgo}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
