export type UserRole =
  | 'ADMIN'
  | 'MANAGER'
  | 'SALES'
  | 'WAREHOUSE'
  | 'ACCOUNTANT'
  | 'B2B_PARTNER';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  permissions: string[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  importPrice?: number;
  price: number;
  stock: number;
  soldCount: number;
  isDemoProduct: boolean;
  description?: string;
  imageUrl?: string;
  imageResName?: string;
}

export interface PaginatedProductsResponse {
  items: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalProducts: number;
    totalStock: number;
    lockedCount: number;
    lowStockCount: number;
    demoCount: number;
  };
}

export interface StockLog {
  _id: string;
  productId: string;
  productName: string;
  delta: number;
  previousStock: number;
  newStock: number;
  reason: string;
  orderId?: string;
  note?: string;
  actorId: string;
  actorRole: string;
  createdAt: string;
}

export type OrderStatus =
  | 'PLACED'
  | 'PREPARING'
  | 'DELIVERING'
  | 'DELIVERED'
  | 'CANCELLED';

export type SalesChannel = 'B2B' | 'B2C';
export type PaymentType = 'COD' | 'BANK' | 'WALLET';
export type VipTier = 'STANDARD' | 'VIP_SILVER' | 'VIP_GOLD' | 'VIP_DIAMOND';

export interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  importPrice?: number;
  isDemoProduct?: boolean;
}

export interface Order {
  id: string;
  timeAgo: string;
  customerName: string;
  customerPhone: string;
  address: string;
  status: OrderStatus;
  salesChannel: SalesChannel;
  vipTierAtPurchase: VipTier;
  vipProductDiscount: number;
  shippingDiscount: number;
  shippingCost?: number;
  items: OrderItem[];
  shippingFee: number;
  paymentMethodLabel: string;
  paymentType: PaymentType;
  createdAt?: string;
}

export interface OrderPreviewResponse {
  salesChannel: SalesChannel;
  product: {
    id: string;
    sku: string;
    name: string;
    price: number;
    stock: number;
    isDemoProduct: boolean;
  };
  tradeLock: {
    isLocked: boolean;
    code: string;
    availableStock: number;
    requestedQuantity: number;
    shortage: number;
    message: string;
  };
  pricing: {
    vipTierAtPurchase: VipTier;
    vipBadge: string;
    demoDiscountPercent: number;
    existingOrderCount: number;
    nextTier: VipTier | null;
    ordersToNextTier: number;
    subtotal: number;
    vipProductDiscount: number;
    baseShippingFee: number;
    shippingDiscount: number;
    shippingFee: number;
    shippingCost?: number;
    totalImportCost?: number;
    totalPayment: number;
    estimatedProfit?: number;
  };
}

export interface OrderInvoiceResponse {
  invoiceNumber: string;
  issuedAt: string;
  company: {
    name: string;
    hotline: string;
    address: string;
  };
  customer: {
    name: string;
    phone: string;
    address: string;
    salesChannel: SalesChannel;
    vipTierAtPurchase: VipTier;
  };
  order: {
    id: string;
    status: OrderStatus;
    timeAgo: string;
    paymentMethodLabel: string;
    paymentType: PaymentType;
    items: OrderItem[];
    subtotal: number;
    vipProductDiscount: number;
    shippingDiscount: number;
    shippingFee: number;
    totalPayment: number;
  };
}

export interface DashboardKpis {
  placedCount: number;
  preparingCount: number;
  deliveringCount: number;
  deliveredCount: number;
  cancelledCount: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timeAgo: string;
  isAlert: boolean;
}

export interface CalendarDay {
  dayNumber: number;
  monthLabel: string;
  fullDateLabel: string;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  isFuture: boolean;
}

export interface ChannelSummary {
  symbol: string;
  label: string;
  orderCount: number;
  revenue: number;
  sharePercent: number;
  avgOrderValue: number;
  cost?: number;
  profit?: number;
  profitMarginPercent?: number;
}

export interface IncomeReportResponse {
  period: string;
  metric: string;
  periodLabel: string;
  canViewProfit: boolean;
  summary: {
    deliveredOrders: number;
    totalRevenue: number;
    codRevenue: number;
    bankRevenue: number;
    walletRevenue: number;
    totalVipSavings: number;
    totalCost?: number;
    totalProfit?: number;
    profitMarginPercent?: number;
  };
  channels: {
    B2B: ChannelSummary;
    B2C: ChannelSummary;
  };
  series: Array<{
    label: string;
    orderCount: number;
    revenue: number;
    cost?: number;
    profit?: number;
  }>;
}

export interface VipTierConfig {
  silverMinOrders: number;
  silverDemoDiscountPercent: number;
  silverShippingDiscount: number;
  goldMinOrders: number;
  goldDemoDiscountPercent: number;
  goldShippingDiscount: number;
  diamondMinOrders: number;
  diamondDemoDiscountPercent: number;
  diamondShippingDiscount: number;
}

export interface PolicySetting {
  key?: string;
  standardShippingFee: number;
  shippingBaseCost: number;
  lowStockThreshold: number;
  vipTiers: VipTierConfig;
  updatedAt?: string;
}

export interface VipCustomerSummary {
  normalizedPhone: string;
  customerName: string;
  companyName: string;
  customerPhone: string;
  defaultAddress: string;
  primaryChannel: SalesChannel;
  channelSymbol: string;
  notes: string;
  orderCount: number;
  deliveredCount: number;
  totalSpent: number;
  totalVipSavings: number;
  vipTier: VipTier;
  vipBadge: string;
  isVip: boolean;
  nextTier: VipTier | null;
  ordersToNextTier: number;
  benefits?: {
    demoDiscountPercent: number;
    shippingDiscount: number;
    finalShippingFee: number;
    shippingCostFloor: number;
  };
  lastOrderAt?: string | null;
}

export interface VipCustomersResponse {
  distribution: {
    VIP_DIAMOND: number;
    VIP_GOLD: number;
    VIP_SILVER: number;
    STANDARD: number;
    totalCustomers: number;
    totalVipSavings: number;
  };
  policy?: {
    standardShippingFee: number;
    shippingBaseCost: number;
    vipTiers: VipTierConfig;
  };
  customers: VipCustomerSummary[];
}

export interface CustomerDetailResponse {
  profile: VipCustomerSummary;
  orders: Order[];
}

export interface TopProductReportRow {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  soldCount: number;
  isDemoProduct: boolean;
  isTradeLocked: boolean;
  estimatedRevenue: number;
  importPrice?: number;
  unitProfit?: number;
  estimatedProfit?: number;
}

export interface TopProductsReportResponse {
  canViewProfit: boolean;
  topProducts: TopProductReportRow[];
  inventoryAlerts: {
    lockedCount: number;
    lowStockCount: number;
    lockedProducts: Array<{ id: string; sku: string; name: string; stock: number }>;
    lowStockProducts: Array<{ id: string; sku: string; name: string; stock: number }>;
  };
}

export interface TransactionItem {
  id: string;
  orderCode: string;
  methodTitle: string;
  subtitle: string;
  amount: number;
  paymentType: PaymentType;
  createdAt?: string;
}

export interface AuditLogItem {
  _id: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  before: unknown;
  after: unknown;
  ip: string;
  createdAt: string;
}

