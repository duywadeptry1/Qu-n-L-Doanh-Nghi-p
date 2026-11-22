import type { Order, OrderStatus, UserRole, VipTier } from '../types/api';

const vndFormatter = new Intl.NumberFormat('vi-VN');

export function formatVnd(amount: number | undefined | null): string {
  const safe = typeof amount === 'number' && Number.isFinite(amount) ? Math.round(amount) : 0;
  return `${vndFormatter.format(safe)}đ`;
}

export function formatVndCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1).replace(/\.0$/, '')}tr`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `${Math.round(amount / 1_000)}k`;
  }
  return `${amount}đ`;
}

export function computeOrderTotal(order: Order): number {
  const subtotal = (order.items || []).reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  return Math.max(0, subtotal - (order.vipProductDiscount || 0)) + (order.shippingFee || 0);
}

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; badgeClass: string }
> = {
  PLACED: { label: 'Chờ duyệt', badgeClass: 'badge-blue' },
  PREPARING: { label: 'Chuẩn bị hàng', badgeClass: 'badge-indigo' },
  DELIVERING: { label: 'Giao ĐVVC', badgeClass: 'badge-amber' },
  DELIVERED: { label: 'Hoàn tất', badgeClass: 'badge-green' },
  CANCELLED: { label: 'Đã huỷ', badgeClass: 'badge-red' }
};

export const VIP_TIER_META: Record<VipTier, { label: string; badgeClass: string }> = {
  STANDARD: { label: 'Khách thường', badgeClass: 'badge-gray' },
  VIP_SILVER: { label: '⭐ VIP Bạc', badgeClass: 'badge-blue' },
  VIP_GOLD: { label: '👑 VIP Vàng', badgeClass: 'badge-amber' },
  VIP_DIAMOND: { label: '💎 VIP Kim Cương', badgeClass: 'badge-indigo' }
};

export const ROLE_META: Record<UserRole, { label: string; badgeClass: string }> = {
  ADMIN: { label: 'Quản trị (ADMIN)', badgeClass: 'badge-indigo' },
  MANAGER: { label: 'Quản lý (MANAGER)', badgeClass: 'badge-blue' },
  SALES: { label: 'Kinh doanh (SALES)', badgeClass: 'badge-amber' },
  WAREHOUSE: { label: 'Thủ kho (WAREHOUSE)', badgeClass: 'badge-green' },
  ACCOUNTANT: { label: 'Kế toán (ACCOUNTANT)', badgeClass: 'badge-gray' },
  B2B_PARTNER: { label: 'Đối tác B2B', badgeClass: 'badge-blue' }
};
