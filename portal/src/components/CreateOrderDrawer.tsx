import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ApiError, apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type {
  Order,
  OrderPreviewResponse,
  PaymentType,
  Product,
  SalesChannel,
  VipCustomerSummary,
  VipCustomersResponse
} from '../types/api';
import { formatVnd } from '../utils/format';

interface CreateOrderDrawerProps {
  onClose: () => void;
  onCreated: (order: Order) => Promise<void> | void;
}

export const CreateOrderDrawer: React.FC<CreateOrderDrawerProps> = ({ onClose, onCreated }) => {
  const { hasPermission } = useAuth();
  const canRestock = hasPermission('products:restock');

  const [products, setProducts] = useState<Product[]>([]);
  const [vipCustomers, setVipCustomers] = useState<VipCustomerSummary[]>([]);

  const [salesChannel, setSalesChannel] = useState<SalesChannel>('B2C');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [paymentType, setPaymentType] = useState<PaymentType>('COD');

  const [preview, setPreview] = useState<OrderPreviewResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [restocking, setRestocking] = useState(false);
  const [error, setError] = useState('');

  const loadProducts = async (keepSelection = false) => {
    const list = await apiRequest<Product[]>('/products');
    setProducts(list);
    if (!keepSelection && list.length > 0) {
      const firstTradable = list.find(p => p.stock > 0) || list[0];
      setProductId(firstTradable.id);
    }
  };

  useEffect(() => {
    void loadProducts(false);
    if (hasPermission('customers:read')) {
      apiRequest<VipCustomersResponse>('/customers/vip')
        .then(res => setVipCustomers(res.customers))
        .catch(() => undefined);
    }
  }, []);

  // Live debounced preview (Trade Lock + VIP Demo & Cost-Floored Shipping)
  useEffect(() => {
    if (!productId) return;
    const timer = setTimeout(() => {
      apiRequest<OrderPreviewResponse>('/orders/preview', {
        method: 'POST',
        body: { customerPhone, productId, quantity, salesChannel }
      })
        .then(setPreview)
        .catch(() => undefined);
    }, 180);
    return () => clearTimeout(timer);
  }, [customerPhone, productId, quantity, salesChannel, products]);

  const handleQuickPickVip = (phoneKey: string) => {
    const found = vipCustomers.find(c => c.normalizedPhone === phoneKey);
    if (!found) return;
    setCustomerName(found.customerName);
    setCustomerPhone(found.customerPhone);
    if (found.defaultAddress) setAddress(found.defaultAddress);
    setSalesChannel(found.primaryChannel);
  };

  const handleQuickRestock = async () => {
    if (!preview) return;
    setRestocking(true);
    setError('');
    try {
      const shortage = Math.max(10, preview.tradeLock.shortage);
      const amount = Math.ceil(shortage / 10) * 10;
      await apiRequest(`/products/${preview.product.id}/restock`, {
        method: 'PATCH',
        body: { amount, note: 'Nhập kho nhanh để mở khóa tạo đơn trên Portal' }
      });
      await loadProducts(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể nhập kho nhanh');
    } finally {
      setRestocking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview?.tradeLock.isLocked) {
      setError(preview.tradeLock.message);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const created = await apiRequest<Order>('/orders', {
        method: 'POST',
        body: {
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          address: address.trim(),
          productId,
          quantity,
          paymentType,
          salesChannel
        }
      });
      await onCreated(created);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(err.message);
        await loadProducts(true);
      } else {
        setError(err instanceof ApiError ? err.message : 'Không thể tạo đơn hàng');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isLocked = Boolean(preview?.tradeLock.isLocked);

  return (
    <div className="overlay">
      <div className="drawer">
        <div className="drawer-header">
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>Tạo đơn hàng mới</h3>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              Tự động kiểm tra khóa tồn kho & áp dụng ưu đãi VIP
            </div>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={e => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="drawer-body">
            {error && (
              <div className="alert-banner alert-red" style={{ marginBottom: 14, fontSize: 13 }}>
                <span>{error}</span>
              </div>
            )}

            {/* B2B vs B2C toggle */}
            <div className="form-group">
              <label className="field-label">Kênh bán hàng</label>
              <div className="grid-2" style={{ gap: 10 }}>
                <button
                  type="button"
                  className={`btn ${salesChannel === 'B2B' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setSalesChannel('B2B')}
                >
                  🏢 Doanh nghiệp (B2B)
                </button>
                <button
                  type="button"
                  className={`btn ${salesChannel === 'B2C' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setSalesChannel('B2C')}
                >
                  🛍️ Bán lẻ (B2C)
                </button>
              </div>
            </div>

            {/* Quick pick VIP customer */}
            {vipCustomers.length > 0 && (
              <div className="form-group">
                <label className="field-label">⭐ Chọn nhanh khách hàng / đại diện VIP</label>
                <select
                  className="select"
                  defaultValue=""
                  onChange={e => handleQuickPickVip(e.target.value)}
                >
                  <option value="">-- Nhập thủ công hoặc chọn từ danh sách VIP --</option>
                  {vipCustomers.map(c => (
                    <option key={c.normalizedPhone} value={c.normalizedPhone}>
                      {c.vipBadge} • {c.customerName} ({c.customerPhone}) — {c.orderCount} đơn •{' '}
                      {c.channelSymbol} {c.primaryChannel}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="field-label">Tên khách hàng / Người đại diện (*)</label>
              <input
                className="input"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="VD: Cty TNHH Minh Phát (Đại diện: A. Hoàng)"
                required
              />
            </div>

            <div className="form-group">
              <label className="field-label">Số điện thoại (tự nhận diện hạng VIP) (*)</label>
              <input
                className="input"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="VD: 0901 234 567"
                required
              />
            </div>

            <div className="form-group">
              <label className="field-label">Địa chỉ giao hàng (*)</label>
              <input
                className="input"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="VD: 88 Nguyễn Huệ, Q.1, TP.HCM"
                required
              />
            </div>

            <div className="form-group">
              <label className="field-label">Chọn sản phẩm (*)</label>
              <select
                className="select"
                value={productId}
                onChange={e => setProductId(e.target.value)}
                required
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.stock <= 0 ? '🔒 [KHÓA • HẾT HÀNG] ' : ''}
                    {p.name}
                    {p.isDemoProduct ? ' [⭐ DEMO]' : ''} ({formatVnd(p.price)} • Tồn: {p.stock})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid-2" style={{ gap: 10 }}>
              <div className="form-group">
                <label className="field-label">Số lượng (*)</label>
                <input
                  type="number"
                  min={1}
                  className="input num"
                  value={quantity}
                  onChange={e => setQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="field-label">Thanh toán</label>
                <select
                  className="select"
                  value={paymentType}
                  onChange={e => setPaymentType(e.target.value as PaymentType)}
                >
                  <option value="COD">COD (Shipper thu hộ)</option>
                  <option value="BANK">Chuyển khoản (VCB)</option>
                  <option value="WALLET">Ví điện tử MoMo</option>
                </select>
              </div>
            </div>

            {/* Live VIP Pricing Card */}
            {preview && (
              <div
                className={`alert-banner ${preview.pricing.vipTierAtPurchase !== 'STANDARD' ? 'alert-amber' : 'alert-blue'}`}
                style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6, marginBottom: 12 }}
              >
                <div style={{ fontWeight: 800, fontSize: 13.5 }}>
                  {preview.pricing.vipBadge} ({preview.pricing.existingOrderCount} đơn đã mua)
                  {preview.pricing.ordersToNextTier > 0 &&
                    ` • Thêm ${preview.pricing.ordersToNextTier} đơn để lên hạng tiếp theo`}
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                  <div>• Tiền hàng: {formatVnd(preview.pricing.subtotal)}</div>
                  {preview.pricing.vipProductDiscount > 0 && (
                    <div>
                      • Ưu đãi SP Demo (-{preview.pricing.demoDiscountPercent}%):{' '}
                      <strong>-{formatVnd(preview.pricing.vipProductDiscount)}</strong>
                    </div>
                  )}
                  <div>
                    • Phí ship:{' '}
                    {preview.pricing.shippingDiscount > 0 ? (
                      <>
                        <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>
                          {formatVnd(preview.pricing.baseShippingFee)}
                        </span>{' '}
                        <strong>{formatVnd(preview.pricing.shippingFee)}</strong> (giảm{' '}
                        {formatVnd(preview.pricing.shippingDiscount)}, giữ sàn giá vốn)
                      </>
                    ) : (
                      formatVnd(preview.pricing.shippingFee)
                    )}
                  </div>
                </div>
                <div className="num" style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>
                  Tổng thanh toán: {formatVnd(preview.pricing.totalPayment)}
                  {preview.pricing.estimatedProfit !== undefined && (
                    <span style={{ color: 'var(--green)', marginLeft: 10, fontSize: 13.5 }}>
                      (Lãi dự kiến: +{formatVnd(preview.pricing.estimatedProfit)})
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Live Inventory Trade-Lock Banner */}
            {preview?.tradeLock.isLocked && (
              <div
                className="alert-banner alert-red"
                style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13.5 }}>
                    🔒 ĐÃ KHÓA GIAO DỊCH — TỒN KHO KHÔNG ĐỦ
                  </div>
                  <div style={{ fontSize: 12.5, marginTop: 3 }}>{preview.tradeLock.message}</div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {preview.tradeLock.availableStock > 0 && (
                    <button
                      type="button"
                      className="btn btn-soft-blue btn-sm"
                      onClick={() => setQuantity(preview.tradeLock.availableStock)}
                    >
                      Đặt tối đa ({preview.tradeLock.availableStock})
                    </button>
                  )}
                  {canRestock && (
                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      disabled={restocking}
                      onClick={() => void handleQuickRestock()}
                    >
                      {restocking ? 'Đang nhập kho...' : '🔓 Nhập kho nhanh để mở khóa'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="drawer-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Huỷ
            </button>
            <button
              type="submit"
              className={`btn ${isLocked ? 'btn-danger' : 'btn-primary'}`}
              disabled={submitting || isLocked}
            >
              {isLocked
                ? `🔒 Khóa giao dịch (Tồn: ${preview?.tradeLock.availableStock ?? 0})`
                : submitting
                  ? 'Đang tạo đơn...'
                  : 'Xác nhận & Tạo đơn'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
