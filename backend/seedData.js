const Product = require('./models/Product');
const Order = require('./models/Order');
const Transaction = require('./models/Transaction');
const Notification = require('./models/Notification');
const CalendarDay = require('./models/CalendarDay');

const initialProducts = [
  {
    id: 'p-1',
    sku: 'VD-AT01',
    name: 'Áo Thun Nam Co Giãn Premium',
    category: 'Thời trang',
    price: 210000,
    stock: 64,
    soldCount: 84,
    imageResName: 'img_product_tshirt'
  },
  {
    id: 'p-2',
    sku: 'VD-TN02',
    name: 'Tai Nghe Chống Ồn Viễn Đông ANC',
    category: 'Thiết bị điện tử',
    price: 1220000,
    stock: 18,
    soldCount: 39,
    imageResName: 'img_product_electronics'
  },
  {
    id: 'p-3',
    sku: 'VD-HB03',
    name: 'Hub USB-C Đa Năng 7-in-1',
    category: 'Phụ kiện',
    price: 820000,
    stock: 8,
    soldCount: 27,
    imageResName: 'img_product_electronics'
  },
  {
    id: 'p-4',
    sku: 'VD-PL04',
    name: 'Áo Polo Đồng Phục Doanh Nghiệp',
    category: 'Thời trang',
    price: 420000,
    stock: 112,
    soldCount: 45,
    imageResName: 'img_product_tshirt'
  },
  {
    id: 'p-5',
    sku: 'VD-CS05',
    name: 'Củ Sạc Nhanh GaN 65W Chính Hãng',
    category: 'Phụ kiện',
    price: 325000,
    stock: 6,
    soldCount: 52,
    imageResName: 'img_product_electronics'
  },
  {
    id: 'p-6',
    sku: 'VD-TB06',
    name: 'Bộ Chia Mạng Gigabit B2B Pro',
    category: 'Thiết bị điện tử',
    price: 950000,
    stock: 40,
    soldCount: 19,
    imageResName: 'img_product_electronics'
  }
];

const initialOrders = [
  {
    id: 'DH-9821',
    timeAgo: '17/11/2026 • 10 phút trước',
    customerName: 'Nguyễn Văn An',
    customerPhone: '0988 123 456',
    address: '45/2 Lê Văn Sỹ, P.13, Q.3, TP.HCM',
    status: 'DELIVERING',
    items: [{ productName: 'Áo Thun Nam Co Giãn Premium', quantity: 2, unitPrice: 210000 }],
    shippingFee: 30000,
    paymentMethodLabel: 'Thanh toán khi nhận hàng (COD)',
    paymentType: 'COD',
    createdAt: new Date('2026-11-17T14:20:00+07:00')
  },
  {
    id: 'DH-9820',
    timeAgo: '17/11/2026 • 25 phút trước',
    customerName: 'Trần Thị Mai',
    customerPhone: '0912 999 888',
    address: '102 Võ Văn Tần, Q.3, TP.HCM',
    status: 'PREPARING',
    items: [{ productName: 'Tai Nghe Chống Ồn Viễn Đông ANC', quantity: 1, unitPrice: 1220000 }],
    shippingFee: 30000,
    paymentMethodLabel: 'Chuyển khoản ngân hàng (VCB)',
    paymentType: 'BANK',
    createdAt: new Date('2026-11-17T11:15:00+07:00')
  },
  {
    id: 'DH-9819',
    timeAgo: '16/11/2026 • 16:40',
    customerName: 'Lê Hoàng Long',
    customerPhone: '0933 444 555',
    address: '78 Nguyễn Thị Minh Khai, Q.1, TP.HCM',
    status: 'DELIVERED',
    items: [{ productName: 'Hub USB-C Đa Năng 7-in-1', quantity: 1, unitPrice: 820000 }],
    shippingFee: 30000,
    paymentMethodLabel: 'Ví điện tử MoMo',
    paymentType: 'WALLET',
    createdAt: new Date('2026-11-16T16:40:00+07:00')
  },
  {
    id: 'DH-9818',
    timeAgo: '15/11/2026 • 14:10',
    customerName: 'Phạm Quốc Bảo',
    customerPhone: '0977 111 222',
    address: '12 Đường số 5, Q.7, TP.HCM',
    status: 'CANCELLED',
    items: [{ productName: 'Áo Polo Đồng Phục Doanh Nghiệp', quantity: 5, unitPrice: 420000 }],
    shippingFee: 0,
    paymentMethodLabel: 'Thanh toán khi nhận hàng (COD)',
    paymentType: 'COD',
    createdAt: new Date('2026-11-15T14:10:00+07:00')
  },
  {
    id: 'DH-9817',
    timeAgo: '14/11/2026 • 09:30',
    customerName: 'Đặng Thu Thảo',
    customerPhone: '0908 777 666',
    address: '55 Điện Biên Phủ, Bình Thạnh, TP.HCM',
    status: 'DELIVERED',
    items: [{ productName: 'Củ Sạc Nhanh GaN 65W Chính Hãng', quantity: 2, unitPrice: 325000 }],
    shippingFee: 30000,
    paymentMethodLabel: 'Thanh toán khi nhận hàng (COD)',
    paymentType: 'COD',
    createdAt: new Date('2026-11-14T09:30:00+07:00')
  }
];

async function syncTransactionsFromOrders() {
  const deliveredOrders = await Order.find({ status: 'DELIVERED' }).sort({ createdAt: -1 });
  for (const order of deliveredOrders) {
    const orderCode = `#${order.id}`;
    const existing = await Transaction.findOne({ orderCode });
    let totalItems = 0;
    (order.items || []).forEach(item => {
      totalItems += (item.quantity || 0) * (item.unitPrice || 0);
    });
    const grandTotal = totalItems + (order.shippingFee || 0);
    const createdDate = order.createdAt ? new Date(order.createdAt) : new Date('2026-11-17T10:00:00+07:00');
    const dateStr = createdDate.toLocaleDateString('vi-VN');
    const methodLabel = order.paymentType === 'BANK' ? 'Chuyển khoản'
      : order.paymentType === 'WALLET' ? 'Ví MoMo' : 'COD';

    if (!existing) {
      await Transaction.create({
        id: `tx-${order.id}`,
        orderCode,
        methodTitle: `Đơn #${order.id} (${methodLabel})`,
        subtitle: `${dateStr} - Đã giao đến tay khách & đối soát`,
        amount: grandTotal,
        paymentType: order.paymentType || 'COD',
        createdAt
      });
    }
  }
  // Remove orphan transactions whose orders are not DELIVERED
  const deliveredCodes = deliveredOrders.map(o => `#${o.id}`);
  await Transaction.deleteMany({ orderCode: { $nin: deliveredCodes } });
}

async function syncNotificationsFromRealData() {
  const orders = await Order.find().sort({ createdAt: -1 });
  const products = await Product.find();

  const generated = [];

  // 1. Low stock alerts from real products
  const lowStockProducts = products.filter(p => p.stock <= 10);
  if (lowStockProducts.length > 0) {
    const names = lowStockProducts.slice(0, 3).map(p => `${p.name} (còn ${p.stock})`).join(', ');
    generated.push({
      id: 'notif-low-stock',
      title: `Cảnh báo tồn kho thấp (${lowStockProducts.length} sản phẩm)`,
      message: `${names} cần nhập thêm hàng vào kho.`,
      timeAgo: '17/11/2026',
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
      let total = (order.shippingFee || 0);
      (order.items || []).forEach(i => { total += i.quantity * i.unitPrice; });
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
      timeAgo: order.timeAgo || '17/11/2026',
      isAlert
    });
  });

  await Notification.deleteMany({});
  if (generated.length > 0) {
    await Notification.insertMany(generated);
  }
  return generated;
}

async function syncMonthlyCalendarFromOrders() {
  const orders = await Order.find();
  const TODAY_DAY = 17; // 17/11/2026

  const dayStats = {};
  for (let d = 1; d <= 30; d++) {
    dayStats[d] = { total: 0, delivered: 0, activeOrOther: 0 };
  }

  orders.forEach(order => {
    // Parse day from timeAgo if formatted like "dd/11/2026", otherwise from createdAt, default to 17
    let day = TODAY_DAY;
    const match = typeof order.timeAgo === 'string' ? order.timeAgo.match(/^(\d{1,2})\/11\/2026/) : null;
    if (match) {
      day = parseInt(match[1], 10);
    } else if (order.createdAt) {
      const dt = new Date(order.createdAt);
      if (!isNaN(dt.getTime()) && dt.getMonth() === 10) {
        day = dt.getDate();
      }
    }
    if (day < 1 || day > TODAY_DAY) day = TODAY_DAY;

    dayStats[day].total += 1;
    if (order.status === 'DELIVERED') {
      dayStats[day].delivered += 1;
    } else if (order.status !== 'CANCELLED') {
      dayStats[day].activeOrOther += 1;
    }
  });

  const bulkOps = [];
  for (let d = 1; d <= 30; d++) {
    const isFuture = d > TODAY_DAY;
    const dayStr = String(d).padStart(2, '0');
    const doc = {
      dayNumber: d,
      monthLabel: 'Thg 11',
      fullDateLabel: isFuture ? `Ngày ${dayStr}/11/2026 (Chưa tới)` : (d === TODAY_DAY ? `Hôm nay, ${dayStr}/11/2026` : `Ngày ${dayStr}/11/2026`),
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
  await CalendarDay.bulkWrite(bulkOps);
  return CalendarDay.find().sort({ dayNumber: 1 });
}

async function seedDatabase() {
  try {
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      await Product.insertMany(initialProducts);
      console.log('✅ Seeded Products into MongoDB Atlas');
    }

    const orderCount = await Order.countDocuments();
    if (orderCount === 0) {
      await Order.insertMany(initialOrders);
      console.log('✅ Seeded Orders into MongoDB Atlas');
    }

    await syncTransactionsFromOrders();
    await syncNotificationsFromRealData();
    await syncMonthlyCalendarFromOrders();
    console.log('✅ Synchronized real Transactions, Notifications, and November Calendar (1..30, today=17/11)');
  } catch (err) {
    console.error('❌ Error seeding/syncing database:', err);
  }
}

module.exports = {
  seedDatabase,
  syncTransactionsFromOrders,
  syncNotificationsFromRealData,
  syncMonthlyCalendarFromOrders
};
