require('dotenv').config();
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const Product = require('./models/Product');
const Order = require('./models/Order');
const Transaction = require('./models/Transaction');
const Notification = require('./models/Notification');
const CalendarDay = require('./models/CalendarDay');
const {
  seedDatabase,
  syncTransactionsFromOrders,
  syncNotificationsFromRealData,
  syncMonthlyCalendarFromOrders
} = require('./seedData');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Log every request so you can see whether the phone actually reaches the server
app.use((req, res, next) => {
  console.log(`➡️  ${req.method} ${req.originalUrl} từ ${req.ip}`);
  next();
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Connect to MongoDB Atlas
mongoose.connect(MONGODB_URI, { dbName: 'viendong' })
  .then(async () => {
    console.log(`🚀 Connected successfully to MongoDB Atlas Database (${mongoose.connection.name})!`);
    await seedDatabase();
  })
  .catch(err => {
    console.error('❌ Database Connection Error:', err.message);
  });

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Viễn Đông Sales API Server is running' });
});

async function getNextOrderId() {
  const existing = await Order.find({}, { id: 1 }).lean();
  let maxNum = 9821;
  for (const item of existing) {
    const match = typeof item.id === 'string' ? item.id.match(/^DH-(\d+)$/) : null;
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `DH-${maxNum + 1}`;
}

// --- ORDERS APIs ---

// GET /api/orders?filter=ALL|PLACED|PREPARING|DELIVERING|DELIVERED|CANCELLED&search=...
app.get('/api/orders', async (req, res) => {
  try {
    const { filter, search } = req.query;
    const query = {};
    if (filter && filter !== 'ALL') {
      query.status = filter;
    }
    if (search) {
      query.$or = [
        { id: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } }
      ];
    }
    const orders = await Order.find(query).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders/:id
app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders
app.post('/api/orders', async (req, res) => {
  try {
    const { customerName, customerPhone, address, productId, quantity, paymentType } = req.body;

    const product = await Product.findOne({ id: productId });
    if (!product) return res.status(400).json({ error: 'Sản phẩm không tồn tại' });

    const newId = await getNextOrderId();
    const qty = Math.max(1, parseInt(quantity, 10) || 1);

    const paymentLabel = paymentType === 'COD' ? 'Thanh toán khi nhận hàng (COD)'
      : paymentType === 'BANK' ? 'Chuyển khoản ngân hàng (VCB)'
      : paymentType === 'WALLET' ? 'Ví điện tử MoMo' : 'Thanh toán khi nhận hàng (COD)';

    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const newOrder = new Order({
      id: newId,
      timeAgo: `17/11/2026 • ${nowTime}`,
      customerName,
      customerPhone,
      address,
      status: 'PLACED',
      items: [{
        productName: product.name,
        quantity: qty,
        unitPrice: product.price
      }],
      shippingFee: 30000,
      paymentMethodLabel: paymentLabel,
      paymentType: paymentType || 'COD',
      createdAt: new Date('2026-11-17T15:00:00+07:00')
    });

    await newOrder.save();

    // Deduct product stock & increase soldCount
    product.stock = Math.max(0, product.stock - qty);
    product.soldCount += qty;
    await product.save();

    await syncMonthlyCalendarFromOrders();
    await syncNotificationsFromRealData();

    res.status(201).json(newOrder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/orders/:id/status
app.patch('/api/orders/:id/status', async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    let nextStatus = req.body && req.body.status ? req.body.status : null;
    if (!nextStatus) {
      if (order.status === 'PLACED') nextStatus = 'PREPARING';
      else if (order.status === 'PREPARING') nextStatus = 'DELIVERING';
      else if (order.status === 'DELIVERING') nextStatus = 'DELIVERED';
      else nextStatus = order.status;
    }

    order.status = nextStatus;
    await order.save();

    await syncTransactionsFromOrders();
    await syncMonthlyCalendarFromOrders();
    await syncNotificationsFromRealData();

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PRODUCTS APIs ---

// GET /api/products?category=...&search=...
app.get('/api/products', async (req, res) => {
  try {
    const { category, search } = req.query;
    const query = {};
    if (category && category !== 'Tất cả') {
      query.category = category;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }
    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function getNextProductSequence() {
  const existing = await Product.find({}, { id: 1 }).lean();
  let maxNum = existing.length;
  for (const item of existing) {
    const match = typeof item.id === 'string' ? item.id.match(/^p-(\d+)$/) : null;
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return maxNum + 1;
}

// POST /api/products
app.post('/api/products', async (req, res) => {
  try {
    const { sku: customSku, name, category, price, stock, description, imageUrl, imageResName: customImageRes } = req.body;
    const seq = await getNextProductSequence();
    const newId = `p-${seq}`;
    const nextSku = (customSku && String(customSku).trim()) ? String(customSku).trim() : `VD-SP${String(seq).padStart(2, '0')}`;
    const finalCategory = (category && String(category).trim()) ? String(category).trim() : 'Thiết bị điện tử';
    const defaultRes = finalCategory === 'Thời trang' ? 'img_product_tshirt' : 'img_product_electronics';
    const imageResName = customImageRes || defaultRes;

    const newProduct = new Product({
      id: newId,
      sku: nextSku,
      name,
      category: finalCategory,
      price,
      stock,
      soldCount: 0,
      description: description || '',
      imageUrl: imageUrl || '',
      imageResName
    });
    await newProduct.save();
    await syncNotificationsFromRealData();

    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/bulk (Import 100+ products at once from quick add or Excel)
app.post('/api/products/bulk', async (req, res) => {
  try {
    const rawItems = Array.isArray(req.body) ? req.body : req.body?.products;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ error: 'Danh sách sản phẩm trống hoặc không hợp lệ' });
    }

    let seq = await getNextProductSequence();
    const docsToInsert = [];
    const errors = [];

    rawItems.forEach((item, index) => {
      const rowNum = index + 1;
      const name = item?.name ? String(item.name).trim() : '';
      const price = Number(item?.price);
      const parsedStock = parseInt(item?.stock, 10);
      const stock = Number.isFinite(parsedStock) && parsedStock >= 0 ? parsedStock : 10;
      const category = item?.category && String(item.category).trim()
        ? String(item.category).trim()
        : 'Thiết bị điện tử';

      if (!name || !Number.isFinite(price) || price <= 0) {
        errors.push({
          row: rowNum,
          name: name || `Dòng ${rowNum}`,
          reason: !name ? 'Thiếu tên sản phẩm' : 'Giá bán phải lớn hơn 0'
        });
        return;
      }

      const id = `p-${seq}`;
      const sku = item?.sku && String(item.sku).trim()
        ? String(item.sku).trim()
        : `VD-SP${String(seq).padStart(2, '0')}`;
      seq++;

      const defaultRes = category === 'Thời trang' ? 'img_product_tshirt' : 'img_product_electronics';
      docsToInsert.push({
        id,
        sku,
        name,
        category,
        price: Math.round(price),
        stock,
        soldCount: 0,
        description: item?.description ? String(item.description).trim() : '',
        imageUrl: item?.imageUrl ? String(item.imageUrl).trim() : '',
        imageResName: item?.imageResName || defaultRes
      });
    });

    if (docsToInsert.length === 0) {
      return res.status(400).json({
        error: 'Không có sản phẩm hợp lệ nào để lưu',
        insertedCount: 0,
        skippedCount: errors.length,
        errors,
        products: []
      });
    }

    const inserted = await Product.insertMany(docsToInsert, { ordered: false });
    await syncNotificationsFromRealData();
    console.log(`📦 Đã nhập hàng loạt ${inserted.length} sản phẩm vào MongoDB`);

    res.status(201).json({
      insertedCount: inserted.length,
      skippedCount: errors.length,
      errors,
      products: inserted
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id (Edit product)
app.put('/api/products/:id', async (req, res) => {
  try {
    const { name, category, price, stock, description, imageUrl } = req.body;
    const product = await Product.findOne({ id: req.params.id });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (name !== undefined) product.name = name;
    if (category !== undefined) product.category = category;
    if (price !== undefined) product.price = price;
    if (stock !== undefined) product.stock = stock;
    if (description !== undefined) product.description = description;
    if (imageUrl !== undefined) product.imageUrl = imageUrl;

    await product.save();
    await syncNotificationsFromRealData();
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/products/:id/restock
app.patch('/api/products/:id/restock', async (req, res) => {
  try {
    const amount = req.body.amount || 10;
    const product = await Product.findOne({ id: req.params.id });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    product.stock += amount;
    await product.save();
    await syncNotificationsFromRealData();

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id
app.delete('/api/products/:id', async (req, res) => {
  try {
    const deleted = await Product.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ error: 'Product not found' });
    await syncNotificationsFromRealData();
    res.json({ success: true, message: 'Đã xoá sản phẩm thành công', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TRANSACTIONS APIs ---

// GET /api/transactions?type=ALL|COD|BANK|WALLET
app.get('/api/transactions', async (req, res) => {
  try {
    await syncTransactionsFromOrders();
    const { type } = req.query;
    const query = {};
    if (type && type !== 'ALL') {
      query.paymentType = type;
    }
    const transactions = await Transaction.find(query).sort({ createdAt: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- NOTIFICATIONS APIs ---

// GET /api/notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const notifications = await syncNotificationsFromRealData();
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CALENDAR & DASHBOARD APIs ---

// GET /api/calendar
app.get('/api/calendar', async (req, res) => {
  try {
    const days = await syncMonthlyCalendarFromOrders();
    res.json(days);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/kpis (100% real data, no fake base offsets)
app.get('/api/dashboard/kpis', async (req, res) => {
  try {
    const orders = await Order.find();
    const placed = orders.filter(o => o.status === 'PLACED').length;
    const preparing = orders.filter(o => o.status === 'PREPARING').length;
    const delivering = orders.filter(o => o.status === 'DELIVERING').length;
    const delivered = orders.filter(o => o.status === 'DELIVERED').length;
    const cancelled = orders.filter(o => o.status === 'CANCELLED').length;

    res.json({
      placedCount: placed,
      preparingCount: preparing,
      deliveringCount: delivering,
      deliveredCount: delivered,
      cancelledCount: cancelled
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function getLanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter(iface => iface && iface.family === 'IPv4' && !iface.internal)
    .map(iface => iface.address);
}

function setupUsbReverse(port) {
  const candidates = [
    'adb',
    path.join(os.homedir(), 'Android', 'Sdk', 'platform-tools', 'adb')
  ];
  const tryNext = index => {
    if (index >= candidates.length) return;
    execFile(candidates[index], ['reverse', `tcp:${port}`, `tcp:${port}`], err => {
      if (!err) {
        console.log(`🔌 Đã tự động bật kết nối qua cáp USB (adb reverse tcp:${port} tcp:${port})`);
      } else {
        tryNext(index + 1);
      }
    });
  };
  tryNext(0);
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`📡 Backend Server running at http://localhost:${PORT}`);
  console.log(`🔗 Health Check Endpoint: http://localhost:${PORT}/api/health`);
  setupUsbReverse(PORT);
  const lanAddresses = getLanAddresses();
  if (lanAddresses.length === 0) {
    console.log('⚠️  Không tìm thấy IP LAN nào – máy tính chưa kết nối Wi-Fi/LAN?');
  }
  lanAddresses.forEach(ip => {
    console.log(`📱 Nhập vào app (Hồ sơ → Cấu hình IP): ${ip}:${PORT}`);
    console.log(`   Kiểm tra trên trình duyệt điện thoại: http://${ip}:${PORT}/api/health`);
  });
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Cổng ${PORT} đang bị chiếm. Chạy: fuser -k ${PORT}/tcp rồi thử lại.`);
    process.exit(1);
  }
  throw err;
});
