import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Lock, RefreshCw, TrendingUp } from 'lucide-react';
import { ApiError, apiRequest, downloadAuthenticatedCsv } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type {
  IncomeReportResponse,
  PaymentType,
  TopProductsReportResponse,
  TransactionItem
} from '../types/api';
import { formatVnd, formatVndCompact } from '../utils/format';

type ReportPeriod = 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM';
type ChartView = 'REVENUE' | 'PROFIT' | 'BOTH';

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function monthStartIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export const ReportsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const canViewProfit = hasPermission('reports:view_profit');
  const canViewTransactions = hasPermission('transactions:read');

  const [period, setPeriod] = useState<ReportPeriod>('MONTH');
  const [fromDate, setFromDate] = useState(monthStartIso());
  const [toDate, setToDate] = useState(todayIso());
  const [chartView, setChartView] = useState<ChartView>(canViewProfit ? 'BOTH' : 'REVENUE');

  const [income, setIncome] = useState<IncomeReportResponse | null>(null);
  const [topProducts, setTopProducts] = useState<TopProductsReportResponse | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [txFilter, setTxFilter] = useState<'ALL' | PaymentType>('ALL');

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const buildPeriodQuery = () => {
    const params = new URLSearchParams({ period });
    if (period === 'CUSTOM') {
      params.set('from', fromDate);
      params.set('to', toDate);
    }
    return params.toString();
  };

  const loadReports = async () => {
    setLoading(true);
    setError('');
    try {
      const qs = buildPeriodQuery();
      const [incRes, topRes] = await Promise.all([
        apiRequest<IncomeReportResponse>(`/reports/income?${qs}`),
        apiRequest<TopProductsReportResponse>('/reports/top-products?limit=15')
      ]);
      setIncome(incRes);
      setTopProducts(topRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được dữ liệu báo cáo');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (type: 'ALL' | PaymentType) => {
    if (!canViewTransactions) return;
    try {
      const list = await apiRequest<TransactionItem[]>(`/transactions?type=${type}`);
      setTransactions(list);
    } catch {
      // non-blocking
    }
  };

  useEffect(() => {
    if (period !== 'CUSTOM') {
      void loadReports();
    }
  }, [period]);

  useEffect(() => {
    void loadTransactions(txFilter);
  }, [txFilter, canViewTransactions]);

  const handleExportCsv = async () => {
    setExporting(true);
    setError('');
    try {
      const qs = buildPeriodQuery();
      await downloadAuthenticatedCsv(`/reports/export?${qs}`, `viendong-baocao-${period.toLowerCase()}.csv`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xuất CSV thất bại');
    } finally {
      setExporting(false);
    }
  };

  const effectiveChartView: ChartView = canViewProfit ? chartView : 'REVENUE';
  const series = income?.series || [];
  const maxBarVal = Math.max(
    1,
    ...series.map(pt => {
      if (effectiveChartView === 'PROFIT') return Math.max(0, pt.profit || 0);
      if (effectiveChartView === 'BOTH') return Math.max(pt.revenue, Math.max(0, pt.profit || 0));
      return pt.revenue;
    })
  );

  const b2b = income?.channels.B2B;
  const b2c = income?.channels.B2C;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Báo cáo Doanh thu, Lợi nhuận & Kênh B2B/B2C</h1>
          <p className="page-subtitle">
            Thống kê đơn hoàn tất theo kỳ{income?.periodLabel ? `: ${income.periodLabel}` : ''}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-outline" onClick={() => void loadReports()} disabled={loading}>
            <RefreshCw size={15} />
            Làm mới
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void handleExportCsv()} disabled={exporting}>
            <Download size={15} />
            {exporting ? 'Đang xuất...' : 'Xuất CSV báo cáo'}
          </button>
        </div>
      </div>

      {/* Period Filter Bar */}
      <div className="card" style={{ padding: 14, marginBottom: 18 }}>
        <div className="toolbar" style={{ marginBottom: 0, justifyContent: 'space-between' }}>
          <div className="tabs">
            {(
              [
                { key: 'WEEK', label: '7 ngày gần đây' },
                { key: 'MONTH', label: 'Tháng hiện tại' },
                { key: 'YEAR', label: '6 tháng gần đây' },
                { key: 'CUSTOM', label: 'Tùy chọn ngày' }
              ] as Array<{ key: ReportPeriod; label: string }>
            ).map(item => (
              <button
                key={item.key}
                type="button"
                className={`tab-btn${period === item.key ? ' active' : ''}`}
                onClick={() => setPeriod(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {period === 'CUSTOM' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="date"
                className="input"
                style={{ width: 155 }}
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
              />
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>→</span>
              <input
                type="date"
                className="input"
                style={{ width: 155 }}
                value={toDate}
                onChange={e => setToDate(e.target.value)}
              />
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void loadReports()}>
                Áp dụng
              </button>
            </div>
          )}
        </div>
      </div>

      {!canViewProfit && (
        <div className="alert-banner alert-blue" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Lock size={18} />
            <div>
              <strong>Chế độ xem Doanh thu (RBAC):</strong> Vai trò hiện tại chỉ được xem doanh thu và cơ cấu kênh B2B/B2C.
              Số liệu giá nhập & lợi nhuận ròng chỉ hiển thị với Admin, Quản lý và Kế toán.
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="alert-banner alert-red" style={{ marginBottom: 18 }}>
          <span>{error}</span>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <div className="kpi-card">
          <div className="kpi-label">Tổng Doanh thu (Đơn hoàn tất)</div>
          <div className="kpi-value" style={{ color: 'var(--blue)' }}>
            {loading ? '...' : formatVnd(income?.summary.totalRevenue || 0)}
          </div>
          <div className="kpi-sub">
            {income?.summary.deliveredOrders || 0} đơn giao thành công
          </div>
        </div>

        {canViewProfit ? (
          <div className="kpi-card">
            <div className="kpi-label">Lợi nhuận ròng</div>
            <div className="kpi-value" style={{ color: 'var(--green)' }}>
              {loading ? '...' : formatVnd(income?.summary.totalProfit || 0)}
            </div>
            <div className="kpi-sub">
              Biên lợi nhuận: <strong>{income?.summary.profitMarginPercent ?? 0}%</strong>
            </div>
          </div>
        ) : (
          <div className="kpi-card">
            <div className="kpi-label">🏢 Doanh thu B2B</div>
            <div className="kpi-value" style={{ color: 'var(--indigo)' }}>
              {loading ? '...' : formatVnd(b2b?.revenue || 0)}
            </div>
            <div className="kpi-sub">
              {b2b?.orderCount || 0} đơn ({b2b?.sharePercent || 0}%)
            </div>
          </div>
        )}

        {canViewProfit ? (
          <div className="kpi-card">
            <div className="kpi-label">Tổng Giá vốn & Chi phí Ship</div>
            <div className="kpi-value" style={{ color: 'var(--text-primary)' }}>
              {loading ? '...' : formatVnd(income?.summary.totalCost || 0)}
            </div>
            <div className="kpi-sub">Bao gồm giá nhập hàng & giá vốn vận chuyển</div>
          </div>
        ) : (
          <div className="kpi-card">
            <div className="kpi-label">🛍️ Doanh thu B2C</div>
            <div className="kpi-value" style={{ color: 'var(--green)' }}>
              {loading ? '...' : formatVnd(b2c?.revenue || 0)}
            </div>
            <div className="kpi-sub">
              {b2c?.orderCount || 0} đơn ({b2c?.sharePercent || 0}%)
            </div>
          </div>
        )}

        <div className="kpi-card">
          <div className="kpi-label">👑 Tổng Ưu đãi VIP đã cấp</div>
          <div className="kpi-value" style={{ color: 'var(--amber)' }}>
            {loading ? '...' : formatVnd(income?.summary.totalVipSavings || 0)}
          </div>
          <div className="kpi-sub">Chiết khấu SP mẫu & hỗ trợ phí vận chuyển</div>
        </div>
      </div>

      {/* Main Charts & Channels Row */}
      <div className="grid-dashboard-main" style={{ marginBottom: 18 }}>
        {/* Bar Chart */}
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap' }}>
            <div>
              <h2 className="card-title">
                <TrendingUp size={16} style={{ verticalAlign: -2, marginRight: 6 }} />
                Biểu đồ {effectiveChartView === 'PROFIT' ? 'Lợi nhuận' : effectiveChartView === 'BOTH' ? 'Doanh thu & Lợi nhuận' : 'Doanh thu'}
              </h2>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                Kỳ báo cáo: {income?.periodLabel || '—'}
              </div>
            </div>

            {canViewProfit && (
              <div className="tabs">
                <button
                  type="button"
                  className={`tab-btn${effectiveChartView === 'BOTH' ? ' active' : ''}`}
                  onClick={() => setChartView('BOTH')}
                >
                  So sánh
                </button>
                <button
                  type="button"
                  className={`tab-btn${effectiveChartView === 'REVENUE' ? ' active' : ''}`}
                  onClick={() => setChartView('REVENUE')}
                >
                  Doanh thu
                </button>
                <button
                  type="button"
                  className={`tab-btn${effectiveChartView === 'PROFIT' ? ' active' : ''}`}
                  onClick={() => setChartView('PROFIT')}
                >
                  Lợi nhuận
                </button>
              </div>
            )}
          </div>

          {series.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
              Chưa có dữ liệu đơn hàng hoàn tất trong kỳ này.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div className="bar-chart" style={{ minWidth: Math.max(420, series.length * 64) }}>
                {series.map(pt => {
                  const revPct = Math.round((pt.revenue / maxBarVal) * 100);
                  const profVal = Math.max(0, pt.profit || 0);
                  const profPct = Math.round((profVal / maxBarVal) * 100);

                  return (
                    <div key={pt.label} className="bar-col" title={`${pt.label}: ${pt.orderCount} đơn`}>
                      <div className="bar-value">
                        {effectiveChartView === 'PROFIT'
                          ? formatVndCompact(pt.profit || 0)
                          : formatVndCompact(pt.revenue)}
                      </div>

                      {effectiveChartView === 'BOTH' ? (
                        <div className="dual-bar-group">
                          <div
                            className="bar-fill"
                            style={{
                              height: `${Math.max(4, revPct)}%`,
                              background: 'var(--blue)'
                            }}
                            title={`Doanh thu: ${formatVnd(pt.revenue)}`}
                          />
                          <div
                            className="bar-fill"
                            style={{
                              height: `${Math.max(4, profPct)}%`,
                              background: 'var(--green)'
                            }}
                            title={`Lợi nhuận: ${formatVnd(pt.profit || 0)}`}
                          />
                        </div>
                      ) : (
                        <div
                          className="bar-fill"
                          style={{
                            height: `${Math.max(4, effectiveChartView === 'PROFIT' ? profPct : revPct)}%`,
                            background: effectiveChartView === 'PROFIT' ? 'var(--green)' : 'var(--blue)'
                          }}
                        />
                      )}

                      <div className="bar-label">{pt.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Legend & Payment Method Breakdown */}
          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: '1px solid var(--border)',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: 10,
              fontSize: 12.5
            }}
          >
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--blue)' }} />
                Doanh thu
              </span>
              {canViewProfit && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--green)' }} />
                  Lợi nhuận
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge badge-gray">COD: {formatVnd(income?.summary.codRevenue || 0)}</span>
              <span className="badge badge-blue">Chuyển khoản: {formatVnd(income?.summary.bankRevenue || 0)}</span>
              <span className="badge badge-indigo">Ví điện tử: {formatVnd(income?.summary.walletRevenue || 0)}</span>
            </div>
          </div>
        </div>

        {/* B2B vs B2C Channel Breakdown */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">So sánh kênh 🏢 B2B và 🛍️ B2C</h2>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              <span style={{ color: 'var(--indigo)' }}>🏢 B2B: {b2b?.sharePercent || 0}%</span>
              <span style={{ color: 'var(--green)' }}>🛍️ B2C: {b2c?.sharePercent || 0}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${b2b?.sharePercent || 0}%`, background: 'var(--indigo)' }} />
              <div className="progress-fill" style={{ width: `${b2c?.sharePercent || 0}%`, background: 'var(--green)' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {[b2b, b2c].map((ch, idx) => {
              if (!ch) return null;
              const isB2b = idx === 0;
              return (
                <div
                  key={ch.label}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: `1px solid ${isB2b ? 'var(--indigo-border)' : 'var(--green-border)'}`,
                    background: isB2b ? 'var(--indigo-soft)' : 'var(--green-soft)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong style={{ fontSize: 14.5 }}>
                      {ch.symbol} {ch.label}
                    </strong>
                    <span className={`badge ${isB2b ? 'badge-indigo' : 'badge-green'}`}>
                      {ch.orderCount} đơn
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Doanh thu</div>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{formatVnd(ch.revenue)}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Giá trị TB / đơn</div>
                      <div style={{ fontWeight: 700 }}>{formatVnd(ch.avgOrderValue)}</div>
                    </div>
                    {canViewProfit && (
                      <>
                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Lợi nhuận ròng</div>
                          <div style={{ fontWeight: 800, color: 'var(--green)' }}>
                            {formatVnd(ch.profit || 0)}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Biên lãi</div>
                          <div style={{ fontWeight: 700 }}>{ch.profitMarginPercent ?? 0}%</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Products P&L & Inventory Alerts */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header" style={{ flexWrap: 'wrap' }}>
          <div>
            <h2 className="card-title">Hiệu quả kinh doanh theo Sản phẩm (Top 15 bán chạy)</h2>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
              Thống kê sản lượng bán, tồn kho và biên lợi nhuận dự kiến
            </div>
          </div>

          {topProducts && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {topProducts.inventoryAlerts.lockedCount > 0 && (
                <Link to="/products?stockStatus=LOCKED" className="btn btn-soft-red btn-sm">
                  🔒 {topProducts.inventoryAlerts.lockedCount} SP đang khóa GD
                </Link>
              )}
              {topProducts.inventoryAlerts.lowStockCount > 0 && (
                <Link to="/products?stockStatus=LOW_STOCK" className="btn btn-outline btn-sm">
                  ⚠️ {topProducts.inventoryAlerts.lowStockCount} SP sắp hết hàng
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Danh mục</th>
                <th>Tồn kho</th>
                <th>Đã bán</th>
                {canViewProfit && <th>Giá nhập</th>}
                <th>Giá bán</th>
                {canViewProfit && <th>Lãi / SP</th>}
                <th>Doanh thu ước tính</th>
                {canViewProfit && <th>Lãi gộp ước tính</th>}
              </tr>
            </thead>
            <tbody>
              {(topProducts?.topProducts || []).map(row => (
                <tr key={row.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{row.name}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.sku}</span>
                      {row.isDemoProduct && <span className="badge badge-indigo">SP Mẫu</span>}
                      {row.isTradeLocked && <span className="badge badge-red">🔒 Khóa GD</span>}
                    </div>
                  </td>
                  <td>{row.category}</td>
                  <td>
                    <span
                      className={`badge ${
                        row.stock <= 0 ? 'badge-red' : row.stock <= 10 ? 'badge-amber' : 'badge-green'
                      }`}
                    >
                      {row.stock}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700 }}>{row.soldCount}</td>
                  {canViewProfit && <td>{formatVnd(row.importPrice || 0)}</td>}
                  <td style={{ fontWeight: 600 }}>{formatVnd(row.price)}</td>
                  {canViewProfit && (
                    <td style={{ color: (row.unitProfit || 0) >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                      {formatVnd(row.unitProfit || 0)}
                    </td>
                  )}
                  <td style={{ fontWeight: 700, color: 'var(--blue)' }}>{formatVnd(row.estimatedRevenue)}</td>
                  {canViewProfit && (
                    <td style={{ fontWeight: 800, color: 'var(--green)' }}>
                      {formatVnd(row.estimatedProfit || 0)}
                    </td>
                  )}
                </tr>
              ))}
              {!loading && (topProducts?.topProducts.length || 0) === 0 && (
                <tr>
                  <td colSpan={canViewProfit ? 9 : 6} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                    Chưa có dữ liệu sản phẩm.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Ledger for Accountant / Manager / Admin */}
      {canViewTransactions && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap' }}>
            <div>
              <h2 className="card-title">Sổ đối soát Giao dịch thanh toán</h2>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                Đồng bộ trực tiếp từ các đơn hàng hoàn tất
              </div>
            </div>

            <div className="tabs">
              {(
                [
                  { key: 'ALL', label: 'Tất cả' },
                  { key: 'COD', label: 'Tiền mặt (COD)' },
                  { key: 'BANK', label: 'Chuyển khoản' },
                  { key: 'WALLET', label: 'Ví điện tử' }
                ] as Array<{ key: 'ALL' | PaymentType; label: string }>
              ).map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  className={`tab-btn${txFilter === tab.key ? ' active' : ''}`}
                  onClick={() => setTxFilter(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã GD</th>
                  <th>Mã đơn</th>
                  <th>Phương thức</th>
                  <th>Chi tiết</th>
                  <th>Số tiền</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 20).map(tx => (
                  <tr key={tx.id}>
                    <td style={{ fontWeight: 600 }}>{tx.id}</td>
                    <td>
                      <span className="badge badge-gray">{tx.orderCode}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          tx.paymentType === 'BANK'
                            ? 'badge-blue'
                            : tx.paymentType === 'WALLET'
                              ? 'badge-indigo'
                              : 'badge-green'
                        }`}
                      >
                        {tx.methodTitle}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{tx.subtitle}</td>
                    <td style={{ fontWeight: 800, color: 'var(--green)' }}>+{formatVnd(tx.amount)}</td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                      Không có giao dịch nào trong nhóm thanh toán này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
