require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const Product = require('./models/Product');
const Order = require('./models/Order');
const Transaction = require('./models/Transaction');
const Notification = require('./models/Notification');
const CalendarDay = require('./models/CalendarDay');
const { seedDatabase } = require('./seedData');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Connect to MongoDB Atlas
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('🚀 Connected successfully to MongoDB Atlas Database!');
    await seedDatabase();
  })
  .catch(err => {
    console.error('❌ Database Connection Error:', err.message);
  });

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Viễn Đông Sales API Server is running' });
});

// --- ORDERS APIs ---

// GET /api/orders?filter=ALL|PLACED|DELIVERING|DELIVERED|CANCELLED&search=...
app.get('/api/orders', async (req, res) => {
  try {
    const { filter, search } = req.query;
    let query = {};
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

    const totalOrders = await Order.countDocuments();
    const newId = `DH-${9822 + totalOrders}`;

    const paymentLabel = paymentType === 'COD' ? 'Thanh toán khi nhận hàng (COD)'
      : paymentType === 'BANK' ? 'Chuyển khoản ngân hàng (VCB)'
      : paymentType === 'WALLET' ? 'Ví điện tử MoMo' : 'Thanh toán khi nhận hàng (COD)';

    const newOrder = new Order({
      id: newId,
      timeAgo: 'Vừa xong',
      customerName,
      customerPhone,
      address,
      status: 'PLACED',
      items: [{
        productName: product.name,
        quantity: quantity,
        unitPrice: product.price
      }],
      shippingFee: 30000,
      paymentMethodLabel: paymentLabel,
      paymentType: paymentType || 'COD',
      etaMinutes: 20,
      distanceKm: 2.5
    });

    await newOrder.save();

    // Deduct product stock & increase soldCount
    product.stock = Math.max(0, product.stock - quantity);
    product.soldCount += quantity;
    await product.save();

    // Create Notification
    const newNotif = new Notification({
      id: `notif-${newId}`,
      title: `Đơn hàng mới #${newId}`,
      message: `${customerName} vừa đặt ${quantity}x ${product.name}.`,
      timeAgo: 'Vừa xong',
      isAlert: false
    });
    await newNotif.save();

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

    let nextStatus = req.body && req.body.status ? req.body.status : order.status;
    if (!req.body || !req.body.status) {
      if (order.status === 'PLACED') nextStatus = 'DELIVERING';
      else if (order.status === 'DELIVERING') nextStatus = 'DELIVERED';
    }

    order.status = nextStatus;
    if (nextStatus === 'DELIVERED') {
      order.etaMinutes = 0;
    }
    await order.save();

    // If delivered, auto create transaction if not present
    if (nextStatus === 'DELIVERED') {
      const existingTx = await Transaction.findOne({ orderCode: `#${order.id}` });
      if (!existingTx) {
        let totalItems = 0;
        order.items.forEach(item => { totalItems += item.quantity * item.unitPrice; });
        const grandTotal = totalItems + order.shippingFee;

        const newTx = new Transaction({
          id: `tx-${order.id}`,
          orderCode: `#${order.id}`,
          methodTitle: `Đơn #${order.id} (${order.paymentType})`,
          subtitle: `${new Date().toLocaleDateString('vi-VN')} - Vừa đối soát thành công`,
          amount: grandTotal,
          paymentType: order.paymentType
        });
        await newTx.save();
      }
    }

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
    let query = {};
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

// POST /api/products
app.post('/api/products', async (req, res) => {
  try {
    const { name, category, price, stock, description, imageUrl, imageResName: customImageRes } = req.body;
    const totalProducts = await Product.countDocuments();
    const newId = `p-${totalProducts + 1}`;
    const nextSku = `VD-SP0${totalProducts + 1}`;
    const defaultRes = category === 'Thời trang' ? 'img_product_tshirt' : 'img_product_electronics';
    const imageResName = customImageRes || defaultRes;

    const newProduct = new Product({
      id: newId,
      sku: nextSku,
      name,
      category,
      price,
      stock,
      soldCount: 0,
      description: description || '',
      imageUrl: imageUrl || '',
      imageResName
    });
    await newProduct.save();

    res.status(201).json(newProduct);
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

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TRANSACTIONS APIs ---

// GET /api/transactions?type=ALL|COD|BANK|WALLET
app.get('/api/transactions', async (req, res) => {
  try {
    const { type } = req.query;
    let query = {};
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
    const notifications = await Notification.find().sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CALENDAR & DASHBOARD APIs ---

// GET /api/calendar
app.get('/api/calendar', async (req, res) => {
  try {
    const days = await CalendarDay.find().sort({ dayNumber: 1 });
    res.json(days);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/kpis
app.get('/api/dashboard/kpis', async (req, res) => {
  try {
    const orders = await Order.find();
    const placed = 47 + orders.filter(o => o.status === 'PLACED').length;
    const delivering = 13 + orders.filter(o => o.status === 'DELIVERING').length;
    const delivered = 126 + orders.filter(o => o.status === 'DELIVERED').length;
    const cancelled = 2 + orders.filter(o => o.status === 'CANCELLED').length;

    res.json({ placedCount: placed, deliveringCount: delivering, deliveredCount: delivered, cancelledCount: cancelled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`📡 Backend Server running at http://localhost:${PORT}`);
  console.log(`🔗 Health Check Endpoint: http://localhost:${PORT}/api/health`);
});
