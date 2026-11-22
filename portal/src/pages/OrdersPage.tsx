import React, { useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Download, Kanban, List, Plus, Printer, X } from 'lucide-react';
import { ApiError, apiRequest, downloadAuthenticatedCsv } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CreateOrderDrawer } from '../components/CreateOrderDrawer';
import type { Order, OrderInvoiceResponse, OrderStatus } from '../types/api';
import {
  ORDER_STATUS_META,
  VIP_TIER_META,
  computeOrderTotal,
  formatVnd
} from '../utils/format';

interface ShellContext {
  refreshShell?: () => Promise<void>;
}

const STATUS_TABS: Array<{ key: 'ALL' | OrderStatus; label: string }> = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PLACED', label: 'Chờ duyệt' },
  { key: 'PREPARING', label: 'Chuẩn bị' },
  { key: 'DELIVERING', label: 'Giao ĐVVC' },
  { key: 'DELIVERED', label: 'Hoàn tất' },
  { key: 'CANCELLED', label: 'Đã huỷ' }
];

const KANBAN_STAGES: OrderStatus[] = ['PLACED', 'PREPARING', 'DELIVERING', 'DELIVERED'];

export const OrdersPage: React.FC = () => {
  const { hasPermission, hasAnyPermission } = useAuth();
  const { refreshShell } = useOutletContext<ShellContext>() || {};
  const [searchParams, setSearchParams] = useSearchParams();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [viewMode, setViewMode] = useState<'TABLE' | 'KANBAN'>('TABLE');
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'B2B' | 'B2C'>('ALL');
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(() => searchParams.get('new') === '1');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [invoice, setInvoice] = useState<OrderInvoiceResponse | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const canCreate = hasAnyPermission('orders:create', 'orders:create_own');

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const loadOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (viewMode === 'TABLE' && statusFilter !== 'ALL') qs.set('filter', statusFilter);
      if (channelFilter !== 'ALL') qs.set('channel', channelFilter);
      if (search.trim()) qs.set('search', search.trim());

      const list = await apiRequest<Order[]>(`/orders${qs.toString() ? `?${qs.toString()}` : ''}`);
      setOrders(list);
      if (selectedOrder) {
        const refreshed = list.find(o => o.id === selectedOrder.id) || null;
        setSelectedOrder(refreshed);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể tải danh sách đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, [statusFilter, channelFilter, search, viewMode]);

  const handleStatusChange = async (order: Order, targetStatus: OrderStatus) => {
    setUpdatingStatus(true);
    setError('');
    try {
      const updated = await apiRequest<Order>(`/orders/${order.id}/status`, {
        method: 'PATCH',
        body: { status: targetStatus }
      });
      setSelectedOrder(updated);
      notify(
        targetStatus === 'CANCELLED'
          ? `Đã huỷ đơn #${order.id} (đã hoàn tồn kho nếu hàng chưa giao ĐVVC)`
          : `Đã chuyển đơn #${order.id} sang "${ORDER_STATUS_META[targetStatus].label}"`
      );
      await loadOrders();
      await refreshShell?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể cập nhật trạng thái');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openInvoice = async (orderId: string) => {
    try {
      const res = await apiRequest<OrderInvoiceResponse>(`/orders/${orderId}/invoice`);
      setInvoice(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể tải phiếu giao hàng');
    }
  };

  const getAvailableActions = (order: Order) => {
    const actions: Array<{ label: string; status: OrderStatus; btnClass: string }> = [];
    if (order.status === 'PLACED' && hasPermission('orders:approve')) {
      actions.push({ label: '✅ Duyệt & Chuẩn bị hàng', status: 'PREPARING', btnClass: 'btn-primary' });
    }
    if (order.status === 'PREPARING' && hasPermission('orders:dispatch')) {
      actions.push({ label: '🚚 Bàn giao ĐVVC', status: 'DELIVERING', btnClass: 'btn-primary' });
    }
    if (order.status === 'DELIVERING' && hasPermission('orders:complete')) {
      actions.push({ label: '🎉 Xác nhận Hoàn tất', status: 'DELIVERED', btnClass: 'btn-success' });
    }
    if (order.status !== 'DELIVERED' && order.status !== 'CANCELLED') {
      const canCancel =
        hasPermission('orders:cancel_any') ||
        (order.status === 'PLACED' && hasPermission('orders:cancel_placed'));
      if (canCancel) {
        actions.push({ label: '❌ Huỷ đơn', status: 'CANCELLED', btnClass: 'btn-soft-red' });
      }
    }
    return actions;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý Đơn hàng (4 bước)</h1>
          <p className="page-subtitle">
            Theo dõi kênh 🏢 B2B / 🛍️ B2C, hạng VIP, tự khóa giao dịch khi hết tồn kho & hoàn kho khi huỷ đơn
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="tabs">
            <button
              type="button"
              className={`tab-btn${viewMode === 'TABLE' ? ' active' : ''}`}
              onClick={() => setViewMode('TABLE')}
            >
              <List size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Bảng
            </button>
            <button
              type="button"
              className={`tab-btn${viewMode === 'KANBAN' ? ' active' : ''}`}
              onClick={() => setViewMode('KANBAN')}
            >
              <Kanban size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Kanban 4 bước
            </button>
          </div>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => void downloadAuthenticatedCsv('/orders/export', 'viendong-orders.csv')}
          >
            <Download size={15} />
            <span>Xuất CSV</span>
          </button>

          {canCreate && (
            <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={16} />
              <span>Tạo đơn mới</span>
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="alert-banner alert-green" style={{ marginBottom: 14 }}>
          <strong>✅ {toast}</strong>
        </div>
      )}
      {error && (
        <div className="alert-banner alert-red" style={{ marginBottom: 14 }}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div className="toolbar" style={{ marginBottom: viewMode === 'TABLE' ? 12 : 0 }}>
          <input
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Tìm mã đơn, khách hàng, SĐT..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <select
            className="select"
            style={{ maxWidth: 185 }}
            value={channelFilter}
            onChange={e => setChannelFilter(e.target.value as 'ALL' | 'B2B' | 'B2C')}
          >
            <option value="ALL">Mọi kênh bán</option>
            <option value="B2B">🏢 Doanh nghiệp (B2B)</option>
            <option value="B2C">🛍️ Bán lẻ (B2C)</option>
          </select>

          <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
            Hiển thị {orders.length} đơn hàng
          </span>
        </div>

        {viewMode === 'TABLE' && (
          <div className="tabs">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                className={`tab-btn${statusFilter === tab.key ? ' active' : ''}`}
                onClick={() => setStatusFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content: Table or Kanban */}
      {viewMode === 'TABLE' ? (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Kênh</th>
                  <th>Khách hàng / Đại diện</th>
                  <th>Sản phẩm</th>
                  <th>Hạng VIP</th>
                  <th>Tổng thu</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'right' }}>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {loading && orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                      Đang tải đơn hàng...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                      Không có đơn hàng nào khớp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  orders.map(order => {
                    const st = ORDER_STATUS_META[order.status];
                    const vip = VIP_TIER_META[order.vipTierAtPurchase || 'STANDARD'];
                    const firstItem = order.items[0];
                    return (
                      <tr key={order.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedOrder(order)}>
                        <td style={{ fontWeight: 800 }}>
                          #{order.id}
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>
                            {order.timeAgo}
                          </div>
                        </td>
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
                          <div style={{ fontSize: 13.5 }}>
                            {firstItem ? `${firstItem.productName} ×${firstItem.quantity}` : '—'}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${vip.badgeClass}`}>{vip.label}</span>
                        </td>
                        <td className="num" style={{ fontWeight: 800 }}>
                          {formatVnd(computeOrderTotal(order))}
                        </td>
                        <td>
                          <span className={`badge ${st.badgeClass}`}>{st.label}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                            }}
                          >
                            Xử lý
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="kanban-grid">
          {KANBAN_STAGES.map(stage => {
            const colOrders = orders.filter(o => o.status === stage);
            const meta = ORDER_STATUS_META[stage];
            return (
              <div key={stage} className="kanban-col">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>
                  <strong style={{ fontSize: 13 }}>{colOrders.length} đơn</strong>
                </div>

                {colOrders.map(order => {
                  const vip = VIP_TIER_META[order.vipTierAtPurchase || 'STANDARD'];
                  return (
                    <div key={order.id} className="kanban-card" onClick={() => setSelectedOrder(order)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <strong>#{order.id}</strong>
                        <span className={`badge ${order.salesChannel === 'B2B' ? 'badge-indigo' : 'badge-blue'}`}>
                          {order.salesChannel === 'B2B' ? '🏢 B2B' : '🛍️ B2C'}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{order.customerName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 8px' }}>
                        {order.items[0]?.productName} ×{order.items[0]?.quantity}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className={`badge ${vip.badgeClass}`}>{vip.label}</span>
                        <strong className="num" style={{ color: 'var(--blue)' }}>
                          {formatVnd(computeOrderTotal(order))}
                        </strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Order Detail Drawer */}
      {selectedOrder && (
        <div className="overlay">
          <div className="drawer">
            <div className="drawer-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ margin: 0 }}>Đơn hàng #{selectedOrder.id}</h3>
                  <span className={`badge ${ORDER_STATUS_META[selectedOrder.status].badgeClass}`}>
                    {ORDER_STATUS_META[selectedOrder.status].label}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  {selectedOrder.timeAgo} • {selectedOrder.paymentMethodLabel}
                </div>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelectedOrder(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="drawer-body">
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <span className={`badge ${selectedOrder.salesChannel === 'B2B' ? 'badge-indigo' : 'badge-blue'}`}>
                  {selectedOrder.salesChannel === 'B2B' ? '🏢 Doanh nghiệp (B2B)' : '🛍️ Bán lẻ (B2C)'}
                </span>
                <span className={`badge ${VIP_TIER_META[selectedOrder.vipTierAtPurchase || 'STANDARD'].badgeClass}`}>
                  {VIP_TIER_META[selectedOrder.vipTierAtPurchase || 'STANDARD'].label}
                </span>
              </div>

              <div className="card" style={{ padding: 14, marginBottom: 14, background: '#fafcff' }}>
                <div style={{ fontWeight: 700 }}>{selectedOrder.customerName}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
                  📞 {selectedOrder.customerPhone}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  📍 {selectedOrder.address}
                </div>
              </div>

              <div style={{ fontWeight: 700, marginBottom: 8 }}>Danh sách sản phẩm</div>
              {selectedOrder.items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: '1px solid var(--border)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {item.productName}{' '}
                      {item.isDemoProduct && <span className="badge badge-amber">⭐ DEMO</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                      {formatVnd(item.unitPrice)} × {item.quantity}
                    </div>
                  </div>
                  <strong className="num">{formatVnd(item.unitPrice * item.quantity)}</strong>
                </div>
              ))}

              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5 }}>
                {selectedOrder.vipProductDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--amber)' }}>
                    <span>Giảm giá SP Demo VIP</span>
                    <strong className="num">-{formatVnd(selectedOrder.vipProductDiscount)}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>
                    Phí vận chuyển
                    {selectedOrder.shippingDiscount > 0
                      ? ` (Đã giảm ${formatVnd(selectedOrder.shippingDiscount)} VIP)`
                      : ''}
                  </span>
                  <span className="num">{formatVnd(selectedOrder.shippingFee)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 16,
                    fontWeight: 800,
                    paddingTop: 8,
                    borderTop: '1px solid var(--border)'
                  }}
                >
                  <span>Tổng thanh toán</span>
                  <span className="num" style={{ color: 'var(--blue)' }}>
                    {formatVnd(computeOrderTotal(selectedOrder))}
                  </span>
                </div>
              </div>

              {/* RBAC-filtered workflow actions */}
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {getAvailableActions(selectedOrder).map(act => (
                  <button
                    key={act.status}
                    type="button"
                    className={`btn ${act.btnClass}`}
                    disabled={updatingStatus}
                    onClick={() => void handleStatusChange(selectedOrder, act.status)}
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="drawer-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => void openInvoice(selectedOrder.id)}
              >
                <Printer size={15} />
                <span>In phiếu giao hàng</span>
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setSelectedOrder(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Invoice Modal */}
      {invoice && (
        <div className="overlay-center">
          <div className="modal">
            <div className="modal-header no-print">
              <h3 style={{ margin: 0 }}>Phiếu giao hàng / Hóa đơn {invoice.invoiceNumber}</h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setInvoice(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <h2 style={{ margin: 0 }}>{invoice.company.name}</h2>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {invoice.company.address} • Hotline: {invoice.company.hotline}
                </div>
                <div style={{ marginTop: 6, fontWeight: 700 }}>
                  MÃ HÓA ĐƠN: {invoice.invoiceNumber} — ĐƠN #{invoice.order.id}
                </div>
              </div>
              <div style={{ fontSize: 13.5, marginBottom: 14 }}>
                <div>
                  <strong>Khách hàng:</strong> {invoice.customer.name} ({invoice.customer.salesChannel})
                </div>
                <div>
                  <strong>SĐT:</strong> {invoice.customer.phone}
                </div>
                <div>
                  <strong>Địa chỉ:</strong> {invoice.customer.address}
                </div>
                <div>
                  <strong>Thanh toán:</strong> {invoice.order.paymentMethodLabel}
                </div>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>SL</th>
                    <th>Đơn giá</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.order.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.productName}</td>
                      <td className="num">{item.quantity}</td>
                      <td className="num">{formatVnd(item.unitPrice)}</td>
                      <td className="num">{formatVnd(item.unitPrice * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 14, textAlign: 'right', fontSize: 14 }}>
                {invoice.order.vipProductDiscount > 0 && (
                  <div>Giảm SP Demo VIP: -{formatVnd(invoice.order.vipProductDiscount)}</div>
                )}
                <div>Phí ship: {formatVnd(invoice.order.shippingFee)}</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
                  Tổng thanh toán: {formatVnd(invoice.order.totalPayment)}
                </div>
              </div>
            </div>
            <div className="modal-footer no-print">
              <button type="button" className="btn btn-outline" onClick={() => setInvoice(null)}>
                Đóng
              </button>
              <button type="button" className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={15} />
                <span>In ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Order Drawer */}
      {showCreate && (
        <CreateOrderDrawer
          onClose={() => {
            setShowCreate(false);
            if (searchParams.has('new')) {
              searchParams.delete('new');
              setSearchParams(searchParams, { replace: true });
            }
          }}
          onCreated={async created => {
            notify(`Đã tạo đơn ${created.salesChannel} #${created.id} thành công!`);
            await loadOrders();
            await refreshShell?.();
          }}
        />
      )}
    </div>
  );
};
