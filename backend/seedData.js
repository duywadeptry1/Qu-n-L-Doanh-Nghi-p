const Product = require('./models/Product');
const Order = require('./models/Order');
const Transaction = require('./models/Transaction');
const Notification = require('./models/Notification');
const CalendarDay = require('./models/CalendarDay');
const {
  pad2,
  getZonedParts,
  formatDateLabel,
  formatOrderTimeLabel,
  daysInMonth
} = require('./dateUtils');

const STANDARD_SHIPPING_FEE = 30000;
const SHIPPING_BASE_COST = 15000;

function computeVipBenefits(orderCount) {
  if (orderCount >= 6) {
    return { tier: 'VIP_DIAMOND', demoDiscountPercent: 20, shippingDiscount: 15000 };
  }
  if (orderCount >= 4) {
    return { tier: 'VIP_GOLD', demoDiscountPercent: 15, shippingDiscount: 10000 };
  }
  if (orderCount >= 2) {
    return { tier: 'VIP_SILVER', demoDiscountPercent: 10, shippingDiscount: 5000 };
  }
  return { tier: 'STANDARD', demoDiscountPercent: 0, shippingDiscount: 0 };
}

/**
 * Calculates VIP product discount (on demo products, never below import cost)
 * and shipping discount (capped so shippingFee never goes below SHIPPING_BASE_COST).
 */
function calculateVipPricing({ unitPrice, importPrice = 0, quantity = 1, isDemoProduct = false, existingOrderCount = 0, baseShippingFee = STANDARD_SHIPPING_FEE }) {
  const { tier, demoDiscountPercent, shippingDiscount: rawShipDiscount } = computeVipBenefits(existingOrderCount);
  const subtotal = unitPrice * quantity;
  const totalImportCost = (importPrice || 0) * quantity;

  let vipProductDiscount = 0;
  if (isDemoProduct && demoDiscountPercent > 0) {
    const desiredDiscount = Math.round(subtotal * demoDiscountPercent / 100);
    // Keep selling price at or above import cost so demo discounts don't lose money
    const maxSafeProductDiscount = totalImportCost > 0 ? Math.max(0, subtotal - totalImportCost) : desiredDiscount;
    vipProductDiscount = Math.min(desiredDiscount, maxSafeProductDiscount);
  }

  // Never discount shipping below shipping cost floor (SHIPPING_BASE_COST)
  const maxSafeShippingDiscount = Math.max(0, baseShippingFee - SHIPPING_BASE_COST);
  const shippingDiscount = Math.min(rawShipDiscount, maxSafeShippingDiscount);
  const finalShippingFee = baseShippingFee - shippingDiscount;

  return {
    vipTierAtPurchase: tier,
    vipProductDiscount,
    shippingDiscount,
    shippingFee: finalShippingFee,
    shippingCost: SHIPPING_BASE_COST
  };
}

const initialProducts = [
  {
    id: 'p-1',
    sku: 'VD-BP01',
    name: 'Bàn Phím Cơ Bluetooth K8 Pro',
    category: 'Thiết bị điện tử',
    importPrice: 890000,
    price: 1290000,
    stock: 25,
    soldCount: 45,
    isDemoProduct: false,
    imageResName: 'img_product_electronics'
  },
  {
    id: 'p-2',
    sku: 'VD-TN02',
    name: 'Tai Nghe Chống Ồn Viễn Đông ANC (Demo)',
    category: 'Thiết bị điện tử',
    importPrice: 820000,
    price: 1220000,
    stock: 18,
    soldCount: 39,
    isDemoProduct: true,
    imageResName: 'img_product_electronics'
  },
  {
    id: 'p-3',
    sku: 'VD-HB03',
    name: 'Hub USB-C Đa Năng 7-in-1 (Demo)',
    category: 'Phụ kiện',
    importPrice: 540000,
    price: 820000,
    stock: 8,
    soldCount: 27,
    isDemoProduct: true,
    imageResName: 'img_product_electronics'
  },
  {
    id: 'p-4',
    sku: 'VD-CH04',
    name: 'Chuột Không Dây Công Thái Học M331',
    category: 'Phụ kiện',
    importPrice: 240000,
    price: 380000,
    stock: 42,
    soldCount: 60,
    isDemoProduct: false,
    imageResName: 'img_product_electronics'
  },
  {
    id: 'p-5',
    sku: 'VD-CS05',
    name: 'Củ Sạc Nhanh GaN 65W Chính Hãng',
    category: 'Phụ kiện',
    importPrice: 210000,
    price: 325000,
    stock: 6,
    soldCount: 52,
    isDemoProduct: false,
    imageResName: 'img_product_electronics'
  },
  {
    id: 'p-6',
    sku: 'VD-TB06',
    name: 'Bộ Chia Mạng Gigabit B2B Pro',
    category: 'Thiết bị điện tử',
    importPrice: 650000,
    price: 950000,
    stock: 40,
    soldCount: 19,
    isDemoProduct: false,
    imageResName: 'img_product_electronics'
  }
];

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

// Demo orders, dated relative to "now", covering B2B/B2C channels and VIP frequency tiers
const initialOrderTemplates = [
  {
    id: 'DH-9824',
    ageMs: 10 * MINUTE_MS,
    customerName: 'Cty TNHH Minh Phát (Đại diện: A. Hoàng)',
    customerPhone: '0901 234 567',
    address: '88 Nguyễn Huệ, Q.1, TP.HCM',
    status: 'DELIVERED',
    salesChannel: 'B2B',
    vipTierAtPurchase: 'VIP_GOLD',
    vipProductDiscount: 183000,
    shippingDiscount: 10000,
    shippingCost: SHIPPING_BASE_COST,
    items: [{ productName: 'Tai Nghe Chống Ồn Viễn Đông ANC (Demo)', quantity: 1, unitPrice: 1220000, importPrice: 820000, isDemoProduct: true }],
    shippingFee: 20000,
    paymentMethodLabel: 'Chuyển khoản ngân hàng (VCB)',
    paymentType: 'BANK'
  },
  {
    id: 'DH-9823',
    ageMs: 25 * MINUTE_MS,
    customerName: 'Nguyễn Văn An',
    customerPhone: '0988 123 456',
    address: '45/2 Lê Văn Sỹ, P.13, Q.3, TP.HCM',
    status: 'DELIVERING',
    salesChannel: 'B2C',
    vipTierAtPurchase: 'VIP_SILVER',
    vipProductDiscount: 0,
    shippingDiscount: 5000,
    shippingCost: SHIPPING_BASE_COST,
    items: [{ productName: 'Chuột Không Dây Công Thái Học M331', quantity: 2, unitPrice: 380000, importPrice: 240000, isDemoProduct: false }],
    shippingFee: 25000,
    paymentMethodLabel: 'Thanh toán khi nhận hàng (COD)',
    paymentType: 'COD'
  },
  {
    id: 'DH-9822',
    ageMs: 45 * MINUTE_MS,
    customerName: 'Cty TNHH Minh Phát (Đại diện: A. Hoàng)',
    customerPhone: '0901 234 567',
    address: '88 Nguyễn Huệ, Q.1, TP.HCM',
    status: 'DELIVERED',
    salesChannel: 'B2B',
    vipTierAtPurchase: 'VIP_SILVER',
    vipProductDiscount: 0,
    shippingDiscount: 5000,
    shippingCost: SHIPPING_BASE_COST,
    items: [{ productName: 'Bộ Chia Mạng Gigabit B2B Pro', quantity: 5, unitPrice: 950000, importPrice: 650000, isDemoProduct: false }],
    shippingFee: 25000,
    paymentMethodLabel: 'Chuyển khoản ngân hàng (VCB)',
    paymentType: 'BANK'
  },
  {
    id: 'DH-9821',
    ageMs: 1 * DAY_MS,
    customerName: 'Lê Hoàng Long',
    customerPhone: '0933 444 555',
    address: '78 Nguyễn Thị Minh Khai, Q.1, TP.HCM',
    status: 'DELIVERED',
    salesChannel: 'B2C',
    vipTierAtPurchase: 'STANDARD',
    vipProductDiscount: 0,
    shippingDiscount: 0,
    shippingCost: SHIPPING_BASE_COST,
    items: [{ productName: 'Hub USB-C Đa Năng 7-in-1 (Demo)', quantity: 1, unitPrice: 820000, importPrice: 540000, isDemoProduct: true }],
    shippingFee: 30000,
    paymentMethodLabel: 'Ví điện tử MoMo',
    paymentType: 'WALLET'
  },
  {
    id: 'DH-9820',
    ageMs: 1 * DAY_MS + 180 * MINUTE_MS,
    customerName: 'Cty TNHH Minh Phát (Đại diện: A. Hoàng)',
    customerPhone: '0901 234 567',
    address: '88 Nguyễn Huệ, Q.1, TP.HCM',
    status: 'DELIVERED',
    salesChannel: 'B2B',
    vipTierAtPurchase: 'VIP_SILVER',
    vipProductDiscount: 0,
    shippingDiscount: 5000,
    shippingCost: SHIPPING_BASE_COST,
    items: [{ productName: 'Bàn Phím Cơ Bluetooth K8 Pro', quantity: 3, unitPrice: 1290000, importPrice: 890000, isDemoProduct: false }],
    shippingFee: 25000,
    paymentMethodLabel: 'Chuyển khoản ngân hàng (VCB)',
    paymentType: 'BANK'
  },
  {
    id: 'DH-9819',
    ageMs: 2 * DAY_MS,
    customerName: 'Nguyễn Văn An',
    customerPhone: '0988 123 456',
    address: '45/2 Lê Văn Sỹ, P.13, Q.3, TP.HCM',
    status: 'DELIVERED',
    salesChannel: 'B2C',
    vipTierAtPurchase: 'STANDARD',
    vipProductDiscount: 0,
    shippingDiscount: 0,
    shippingCost: SHIPPING_BASE_COST,
    items: [{ productName: 'Củ Sạc Nhanh GaN 65W Chính Hãng', quantity: 2, unitPrice: 325000, importPrice: 210000, isDemoProduct: false }],
    shippingFee: 30000,
    paymentMethodLabel: 'Thanh toán khi nhận hàng (COD)',
    paymentType: 'COD'
  },
  {
    id: 'DH-9818',
    ageMs: 2 * DAY_MS + 120 * MINUTE_MS,
    customerName: 'Phạm Quốc Bảo',
    customerPhone: '0977 111 222',
    address: '12 Đường số 5, Q.7, TP.HCM',
    status: 'CANCELLED',
    salesChannel: 'B2C',
    vipTierAtPurchase: 'STANDARD',
    vipProductDiscount: 0,
    shippingDiscount: 0,
    shippingCost: 0,
    items: [{ productName: 'Bàn Phím Cơ Bluetooth K8 Pro', quantity: 2, unitPrice: 1290000, importPrice: 890000, isDemoProduct: false }],
    shippingFee: 0,
    paymentMethodLabel: 'Thanh toán khi nhận hàng (COD)',
    paymentType: 'COD'
  },
  {
    id: 'DH-9817',
    ageMs: 3 * DAY_MS,
    customerName: 'Cty TNHH Minh Phát (Đại diện: A. Hoàng)',
    customerPhone: '0901 234 567',
    address: '88 Nguyễn Huệ, Q.1, TP.HCM',
    status: 'DELIVERED',
    salesChannel: 'B2B',
    vipTierAtPurchase: 'STANDARD',
    vipProductDiscount: 0,
    shippingDiscount: 0,
    shippingCost: SHIPPING_BASE_COST,
    items: [{ productName: 'Chuột Không Dây Công Thái Học M331', quantity: 10, unitPrice: 380000, importPrice: 240000, isDemoProduct: false }],
    shippingFee: 30000,
    paymentMethodLabel: 'Chuyển khoản ngân hàng (VCB)',
    paymentType: 'BANK'
  }
];

function buildInitialOrders(now = new Date()) {
  return initialOrderTemplates.map(({ ageMs, ...order }) => {
    const createdAt = new Date(now.getTime() - ageMs);
    return { ...order, timeAgo: formatOrderTimeLabel(createdAt), createdAt };
  });
}

/** Returns { year, month, day } of an order in the business time zone, or null if unknown. */
function getOrderDateParts(order) {
  if (order.createdAt) {
    const dt = new Date(order.createdAt);
    if (!isNaN(dt.getTime())) return getZonedParts(dt);
  }
  const match = typeof order.timeAgo === 'string'
    ? order.timeAgo.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    : null;
  if (match) {
    return { day: parseInt(match[1], 10), month: parseInt(match[2], 10), year: parseInt(match[3], 10) };
  }
  return null;
}

async function syncTransactionsFromOrders() {
  const deliveredOrders = await Order.find({ status: 'DELIVERED' }).sort({ createdAt: -1 });
  const validIds = deliveredOrders.map(o => `tx-${o.id}`);
  await Transaction.deleteMany({ id: { $nin: validIds } });

  for (const order of deliveredOrders) {
    const txId = `tx-${order.id}`;
    const orderCode = `#${order.id}`;
    let totalItems = 0;
    (order.items || []).forEach(item => {
      totalItems += (item.quantity || 0) * (item.unitPrice || 0);
    });
    const grandTotal = Math.max(0, totalItems - (order.vipProductDiscount || 0)) + (order.shippingFee || 0);
    const createdDate = order.createdAt ? new Date(order.createdAt) : new Date();
    const dateStr = formatDateLabel(createdDate);
    const methodLabel = order.paymentType === 'BANK' ? 'Chuyển khoản'
      : order.paymentType === 'WALLET' ? 'Ví MoMo' : 'COD';

    await Transaction.findOneAndUpdate(
      { id: txId },
      {
        $set: {
          id: txId,
          orderCode,
          methodTitle: `Đơn #${order.id} (${methodLabel})`,
          subtitle: `${dateStr} - Đã giao đến tay khách & đối soát`,
          amount: grandTotal,
          paymentType: order.paymentType || 'COD',
          createdAt: createdDate
        }
      },
      { upsert: true, new: true }
    );
  }
}

async function syncNotificationsFromRealData() {
  const orders = await Order.find().sort({ createdAt: -1 });
  const products = await Product.find();

  const generated = [];

  // 1. Out-of-stock trade-lock alerts & low-stock warnings from real products
  const outOfStockProducts = products.filter(p => (p.stock || 0) <= 0);
  if (outOfStockProducts.length > 0) {
    const names = outOfStockProducts.slice(0, 3).map(p => p.name).join(', ');
    generated.push({
      id: 'notif-trade-locked',
      title: `🔒 Đã khóa giao dịch (${outOfStockProducts.length} SP hết hàng)`,
      message: `${names} đã hết tồn kho (tồn: 0). Giao dịch bị khóa cho tới khi nhập thêm hàng.`,
      timeAgo: formatDateLabel(new Date()),
      isAlert: true
    });
  }

  const lowStockProducts = products.filter(p => p.stock > 0 && p.stock <= 10);
  if (lowStockProducts.length > 0) {
    const names = lowStockProducts.slice(0, 3).map(p => `${p.name} (còn ${p.stock})`).join(', ');
    generated.push({
      id: 'notif-low-stock',
      title: `Cảnh báo tồn kho thấp (${lowStockProducts.length} sản phẩm)`,
      message: `${names} cần nhập thêm hàng vào kho.`,
      timeAgo: formatDateLabel(new Date()),
      isAlert: true
    });
  }

  // 2. Real order notifications based on current 4-stage workflow
  orders.slice(0, 12).forEach(order => {
    let title = '';
    let message = '';
    let isAlert = false;

    if (order.status === 'PLACED') {
      title = `Đơn mới #${order.id} chờ duyệt`;
      message = `${order.customerName} vừa đặt hàng. Cần duyệt đơn và chuẩn bị hàng.`;
      isAlert = true;
    } else if (order.status === 'PREPARING') {
      title = `Đang chuẩn bị hàng #${order.id}`;
      message = `Đơn của ${order.customerName} đã duyệt, đang đóng gói chuẩn bị bàn giao ĐVVC.`;
      isAlert = false;
    } else if (order.status === 'DELIVERING') {
      title = `Đã giao ĐVVC đơn #${order.id}`;
      message = `Đơn hàng của ${order.customerName} đang được đơn vị vận chuyển giao tới khách.`;
      isAlert = false;
    } else if (order.status === 'DELIVERED') {
      let total = 0;
      (order.items || []).forEach(i => { total += i.quantity * i.unitPrice; });
      total = Math.max(0, total - (order.vipProductDiscount || 0)) + (order.shippingFee || 0);
      title = `Giao thành công #${order.id}`;
      message = `Đơn hàng đã đến tay ${order.customerName}. Đã ghi nhận thu nhập ${total.toLocaleString('vi-VN')}đ.`;
      isAlert = false;
    } else if (order.status === 'CANCELLED') {
      title = `Đơn hàng #${order.id} đã huỷ`;
      message = `Đơn của ${order.customerName} đã được xác nhận huỷ.`;
      isAlert = true;
    }

    generated.push({
      id: `notif-order-${order.id}`,
      title,
      message,
      timeAgo: order.timeAgo || formatOrderTimeLabel(order.createdAt ? new Date(order.createdAt) : new Date()),
      isAlert
    });
  });

  const activeIds = generated.map(item => item.id);
  if (generated.length > 0) {
    await Notification.bulkWrite(
      generated.map(item => ({
        updateOne: {
          filter: { id: item.id },
          update: { $set: item },
          upsert: true
        }
      }))
    );
  }
  await Notification.deleteMany({ id: { $nin: activeIds } });
  return generated;
}

async function syncMonthlyCalendarFromOrders() {
  const orders = await Order.find();
  const { year, month, day: today } = getZonedParts(new Date());
  const totalDays = daysInMonth(year, month);
  const monthYear = `${pad2(month)}/${year}`;

  const dayStats = {};
  for (let d = 1; d <= totalDays; d++) {
    dayStats[d] = { total: 0, delivered: 0, activeOrOther: 0 };
  }

  orders.forEach(order => {
    // Only orders placed in the current month (business time zone) belong on this calendar
    const parts = getOrderDateParts(order);
    if (!parts || parts.year !== year || parts.month !== month) return;
    const day = Math.min(parts.day, today);
    if (!dayStats[day]) return;

    dayStats[day].total += 1;
    if (order.status === 'DELIVERED') {
      dayStats[day].delivered += 1;
    } else if (order.status !== 'CANCELLED') {
      dayStats[day].activeOrOther += 1;
    }
  });

  const bulkOps = [];
  for (let d = 1; d <= totalDays; d++) {
    const isFuture = d > today;
    const dateStr = `${pad2(d)}/${monthYear}`;
    const doc = {
      dayNumber: d,
      monthLabel: `Thg ${month}`,
      fullDateLabel: isFuture ? `Ngày ${dateStr} (Chưa tới)` : (d === today ? `Hôm nay, ${dateStr}` : `Ngày ${dateStr}`),
      totalOrders: isFuture ? 0 : dayStats[d].total,
      deliveredOrders: isFuture ? 0 : dayStats[d].delivered,
      cancelledOrders: isFuture ? 0 : dayStats[d].activeOrOther,
      isFuture
    };
    bulkOps.push({
      updateOne: {
        filter: { dayNumber: d },
        update: { $set: doc },
        upsert: true
      }
    });
  }
  // Drop leftover days from a longer previous month (e.g. day 31 when the current month has 30 days)
  await CalendarDay.deleteMany({ dayNumber: { $gt: totalDays } });
  await CalendarDay.bulkWrite(bulkOps);
  return CalendarDay.find({ dayNumber: { $lte: totalDays } }).sort({ dayNumber: 1 });
}

async function seedDatabase() {
  try {
    const PolicySetting = require('./models/PolicySetting');
    const { seedDefaultUsers } = require('./services/authService');

    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      await Product.insertMany(initialProducts);
      console.log('✅ Seeded Products into MongoDB Atlas');
    } else {
      // Backfill missing importPrice on legacy products so profit stats work seamlessly
      const missingImport = await Product.find({ $or: [{ importPrice: { $exists: false } }, { importPrice: 0 }] });
      for (const p of missingImport) {
        p.importPrice = Math.round((p.price || 0) * 0.7);
        await p.save();
      }
    }

    const orderCount = await Order.countDocuments();
    if (orderCount === 0) {
      await Order.insertMany(buildInitialOrders());
      console.log('✅ Seeded Orders into MongoDB Atlas');
    }

    const existingPolicy = await PolicySetting.findOne({ key: 'default' });
    if (!existingPolicy) {
      await PolicySetting.create({ key: 'default' });
      console.log('✅ Seeded default PolicySetting into MongoDB Atlas');
    }

    await seedDefaultUsers();

    await syncTransactionsFromOrders();
    await syncNotificationsFromRealData();
    await syncMonthlyCalendarFromOrders();
    console.log(`✅ Synchronized real Transactions, Notifications, and Calendar (today=${formatDateLabel(new Date())})`);
  } catch (err) {
    console.error('❌ Error seeding/syncing database:', err);
  }
}

module.exports = {
  STANDARD_SHIPPING_FEE,
  SHIPPING_BASE_COST,
  computeVipBenefits,
  calculateVipPricing,
  seedDatabase,
  syncTransactionsFromOrders,
  syncNotificationsFromRealData,
  syncMonthlyCalendarFromOrders
};
