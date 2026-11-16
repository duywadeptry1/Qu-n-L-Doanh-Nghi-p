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
    timeAgo: '10 phút trước',
    customerName: 'Nguyễn Văn An',
    customerPhone: '0988 123 456',
    address: '45/2 Lê Văn Sỹ, P.13, Q.3, TP.HCM',
    status: 'DELIVERING',
    items: [{ productName: 'Áo Thun Nam Co Giãn Premium', quantity: 2, unitPrice: 210000 }],
    shippingFee: 30000,
    paymentMethodLabel: 'Thanh toán khi nhận hàng (COD)',
    paymentType: 'COD',
    etaMinutes: 12,
    distanceKm: 2.4
  },
  {
    id: 'DH-9820',
    timeAgo: '25 phút trước',
    customerName: 'Trần Thị Mai',
    customerPhone: '0912 999 888',
    address: '102 Võ Văn Tần, Q.3, TP.HCM',
    status: 'PLACED',
    items: [{ productName: 'Tai Nghe Chống Ồn Viễn Đông ANC', quantity: 1, unitPrice: 1220000 }],
    shippingFee: 30000,
    paymentMethodLabel: 'Chuyển khoản ngân hàng (VCB)',
    paymentType: 'BANK',
    etaMinutes: 25,
    distanceKm: 3.1
  },
  {
    id: 'DH-9819',
    timeAgo: '2 giờ trước',
    customerName: 'Lê Hoàng Long',
    customerPhone: '0933 444 555',
    address: '78 Nguyễn Thị Minh Khai, Q.1, TP.HCM',
    status: 'DELIVERED',
    items: [{ productName: 'Hub USB-C Đa Năng 7-in-1', quantity: 1, unitPrice: 820000 }],
    shippingFee: 30000,
    paymentMethodLabel: 'Ví điện tử MoMo',
    paymentType: 'WALLET',
    etaMinutes: 0,
    distanceKm: 1.2
  },
  {
    id: 'DH-9818',
    timeAgo: 'Hôm qua',
    customerName: 'Phạm Quốc Bảo',
    customerPhone: '0977 111 222',
    address: '12 Đường số 5, Q.7, TP.HCM',
    status: 'CANCELLED',
    items: [{ productName: 'Combo Áo Polo Doanh Nghiệp', quantity: 5, unitPrice: 420000 }],
    shippingFee: 0,
    paymentMethodLabel: 'Thanh toán khi nhận hàng (COD)',
    paymentType: 'COD',
    etaMinutes: 0,
    distanceKm: 6.5
  },
  {
    id: 'DH-9817',
    timeAgo: 'Hôm qua',
    customerName: 'Đặng Thu Thảo',
    customerPhone: '0908 777 666',
    address: '55 Điện Biên Phủ, Bình Thạnh, TP.HCM',
    status: 'DELIVERED',
    items: [{ productName: 'Củ Sạc Nhanh GaN 65W Viễn Đông', quantity: 2, unitPrice: 325000 }],
    shippingFee: 30000,
    paymentMethodLabel: 'Thanh toán khi nhận hàng (COD)',
    paymentType: 'COD',
    etaMinutes: 0,
    distanceKm: 3.8
  }
];

const initialTransactions = [
  {
    id: 'tx-1',
    orderCode: '#DH-9821',
    methodTitle: 'Đơn #DH-9821 (COD)',
    subtitle: '15/11/2026 - Thu bởi Shipper',
    amount: 450000,
    paymentType: 'COD'
  },
  {
    id: 'tx-2',
    orderCode: '#DH-9820',
    methodTitle: 'Đơn #DH-9820 (Chuyển khoản)',
    subtitle: '15/11/2026 - Ngân hàng Vietcombank',
    amount: 1250000,
    paymentType: 'BANK'
  },
  {
    id: 'tx-3',
    orderCode: '#DH-9819',
    methodTitle: 'Đơn #DH-9819 (Ví MoMo)',
    subtitle: '15/11/2026 - Ví điện tử',
    amount: 850000,
    paymentType: 'WALLET'
  }
];

const initialNotifications = [
  {
    id: 'n-1',
    title: 'Shipper đang giao #DH-9821',
    message: 'Đơn hàng của Nguyễn Văn An đang trên đường Lê Văn Sỹ, dự kiến giao sau 12 phút.',
    timeAgo: '10 phút trước',
    isAlert: true
  },
  {
    id: 'n-2',
    title: 'Đơn mới #DH-9820 đã thanh toán VCB',
    message: 'Trần Thị Mai đã chuyển khoản 1.250.000đ. Chờ xuất kho đóng gói.',
    timeAgo: '25 phút trước',
    isAlert: false
  },
  {
    id: 'n-3',
    title: 'Cảnh báo tồn kho thấp',
    message: 'Hub USB-C 7-in-1 (còn 8) và Củ Sạc GaN 65W (còn 6) cần nhập thêm.',
    timeAgo: '1 giờ trước',
    isAlert: true
  }
];

const initialCalendarDays = [
  { dayNumber: 11, monthLabel: 'Thg 11', fullDateLabel: 'Ngày 11/11/2026', totalOrders: 18, deliveredOrders: 18, cancelledOrders: 0 },
  { dayNumber: 12, monthLabel: 'Thg 11', fullDateLabel: 'Ngày 12/11/2026', totalOrders: 9, deliveredOrders: 9, cancelledOrders: 0 },
  { dayNumber: 13, monthLabel: 'Thg 11', fullDateLabel: 'Ngày 13/11/2026', totalOrders: 14, deliveredOrders: 14, cancelledOrders: 0 },
  { dayNumber: 14, monthLabel: 'Thg 11', fullDateLabel: 'Ngày 14/11/2026', totalOrders: 11, deliveredOrders: 10, cancelledOrders: 1 },
  { dayNumber: 15, monthLabel: 'Thg 11', fullDateLabel: 'Ngày 15/11/2026', totalOrders: 12, deliveredOrders: 10, cancelledOrders: 2 },
  { dayNumber: 16, monthLabel: 'Thg 11', fullDateLabel: 'Ngày 16/11/2026', totalOrders: 7, deliveredOrders: 5, cancelledOrders: 2 },
  { dayNumber: 17, monthLabel: 'Thg 11', fullDateLabel: 'Ngày 17/11/2026', totalOrders: 5, deliveredOrders: 3, cancelledOrders: 2 }
];

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

    const txCount = await Transaction.countDocuments();
    if (txCount === 0) {
      await Transaction.insertMany(initialTransactions);
      console.log('✅ Seeded Payment Transactions into MongoDB Atlas');
    }

    const notifCount = await Notification.countDocuments();
    if (notifCount === 0) {
      await Notification.insertMany(initialNotifications);
      console.log('✅ Seeded Notifications into MongoDB Atlas');
    }

    const calCount = await CalendarDay.countDocuments();
    if (calCount === 0) {
      await CalendarDay.insertMany(initialCalendarDays);
      console.log('✅ Seeded Calendar Days into MongoDB Atlas');
    }
  } catch (err) {
    console.error('❌ Error seeding database:', err);
  }
}

module.exports = { seedDatabase };
