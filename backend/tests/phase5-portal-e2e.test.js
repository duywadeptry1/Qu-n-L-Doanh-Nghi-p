process.env.NODE_ENV = 'test';
require('dotenv').config();

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { createApp } = require('../app');
const { seedDatabase } = require('../seedData');
const Product = require('../models/Product');
const Order = require('../models/Order');
const StockLog = require('../models/StockLog');
const AuditLog = require('../models/AuditLog');
const Transaction = require('../models/Transaction');

test('Stage 5 E2E: Full Portal Workflow, 5-Role RBAC Matrix, Android Legacy & SPA Hosting', async t => {
  if (!process.env.MONGODB_URI) {
    t.skip('MONGODB_URI not configured');
    return;
  }

  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'viendong' });
  await seedDatabase();

  const app = createApp();
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function apiFetch(path, { method = 'GET', token, body, asText = false } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const data = asText ? await res.text() : await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  let createdProductId = null;
  let createdOrderId = null;

  try {
    // 1. Login all 5 seeded RBAC roles
    const creds = {
      admin: ['admin@viendong.vn', process.env.SEED_ADMIN_PASSWORD || 'Admin@123'],
      manager: ['manager@viendong.vn', 'Manager@123'],
      sales: ['sales@viendong.vn', 'Sales@123'],
      warehouse: ['warehouse@viendong.vn', 'Warehouse@123'],
      accountant: ['accountant@viendong.vn', 'Accountant@123']
    };

    const tokens = {};
    for (const [role, [email, password]] of Object.entries(creds)) {
      const loginRes = await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        body: { email, password }
      });
      assert.equal(loginRes.status, 200, `${role} login should succeed`);
      assert.ok(loginRes.data.accessToken, `${role} should receive accessToken`);
      tokens[role] = loginRes.data.accessToken;
    }

    // 2. Stage 4 RBAC verification across roles
    // - Settings & Policy: Admin/Manager/Sales/Accountant can read; only Admin can update; Warehouse forbidden
    assert.equal((await apiFetch('/api/v1/settings/policy', { token: tokens.admin })).status, 200);
    assert.equal((await apiFetch('/api/v1/settings/policy', { token: tokens.sales })).status, 200);
    assert.equal((await apiFetch('/api/v1/settings/policy', { token: tokens.warehouse })).status, 403);
    assert.equal(
      (await apiFetch('/api/v1/settings/policy', {
        method: 'PUT',
        token: tokens.manager,
        body: { lowStockThreshold: 12 }
      })).status,
      403
    );

    // - Users management: Only Admin allowed
    assert.equal((await apiFetch('/api/v1/users', { token: tokens.admin })).status, 200);
    assert.equal((await apiFetch('/api/v1/users', { token: tokens.manager })).status, 403);
    assert.equal((await apiFetch('/api/v1/users', { token: tokens.sales })).status, 403);

    // - Audit Logs: Admin, Manager, Accountant allowed; Sales & Warehouse forbidden
    assert.equal((await apiFetch('/api/v1/audit-logs?limit=10', { token: tokens.admin })).status, 200);
    assert.equal((await apiFetch('/api/v1/audit-logs?limit=10', { token: tokens.accountant })).status, 200);
    assert.equal((await apiFetch('/api/v1/audit-logs?limit=10', { token: tokens.sales })).status, 403);
    assert.equal((await apiFetch('/api/v1/audit-logs?limit=10', { token: tokens.warehouse })).status, 403);

    // - Transactions & Profit Reports: Accountant allowed; Sales blocked on profit & transactions
    assert.equal((await apiFetch('/api/v1/transactions', { token: tokens.accountant })).status, 200);
    assert.equal((await apiFetch('/api/v1/transactions', { token: tokens.sales })).status, 403);
    assert.equal((await apiFetch('/api/v1/reports/income?period=MONTH&metric=PROFIT', { token: tokens.accountant })).status, 200);
    assert.equal((await apiFetch('/api/v1/reports/income?period=MONTH&metric=PROFIT', { token: tokens.sales })).status, 403);

    // 3. Full E2E Trade-Lock -> Restock Unlock -> Multi-role Order Lifecycle -> Invoice
    // 3a. Admin creates a locked (stock = 0) demo product
    const createProdRes = await apiFetch('/api/v1/products', {
      method: 'POST',
      token: tokens.admin,
      body: {
        sku: `SKU-E2E-${Date.now().toString().slice(-4)}`,
        name: 'SP Kiểm thử E2E Giai đoạn 5',
        category: 'Thiết bị điện tử',
        importPrice: 600_000,
        price: 1_000_000,
        stock: 0,
        isDemoProduct: true
      }
    });
    assert.equal(createProdRes.status, 201);
    createdProductId = createProdRes.data.id;
    assert.ok(createdProductId, 'Created product should have an id');

    // 3b. Sales attempts to create order while stock = 0 -> HTTP 409 TRADE_LOCKED
    const lockedOrderRes = await apiFetch('/api/v1/orders', {
      method: 'POST',
      token: tokens.sales,
      body: {
        customerName: 'Cty TNHH Minh Phát',
        customerPhone: '0901 234 567',
        address: '123 Lê Lợi, Q.1, TP.HCM',
        salesChannel: 'B2B',
        productId: createdProductId,
        quantity: 1,
        paymentType: 'BANK',
        paymentMethodLabel: 'Chuyển khoản ngân hàng'
      }
    });
    assert.equal(lockedOrderRes.status, 409);
    assert.equal(lockedOrderRes.data.code, 'TRADE_LOCKED_INSUFFICIENT_STOCK');

    // 3c. Warehouse unlocks trade by restocking +5 units
    const restockRes = await apiFetch(`/api/v1/products/${createdProductId}/restock`, {
      method: 'PATCH',
      token: tokens.warehouse,
      body: { amount: 5, note: 'E2E restock unlock' }
    });
    assert.equal(restockRes.status, 200);
    assert.equal(restockRes.data.stock, 5);

    // 3d. Sales previews & creates B2B order for VIP representative -> succeeds and applies VIP benefits
    const previewRes = await apiFetch('/api/v1/orders/preview', {
      method: 'POST',
      token: tokens.sales,
      body: {
        customerPhone: '0901 234 567',
        salesChannel: 'B2B',
        productId: createdProductId,
        quantity: 2
      }
    });
    assert.equal(previewRes.status, 200);
    assert.equal(previewRes.data.tradeLock.isLocked, false);
    assert.ok(previewRes.data.pricing.vipProductDiscount > 0, 'VIP demo discount should apply');
    assert.equal(previewRes.data.pricing.estimatedProfit, undefined, 'Sales must not see estimatedProfit');

    const createdOrderRes = await apiFetch('/api/v1/orders', {
      method: 'POST',
      token: tokens.sales,
      body: {
        customerName: 'Cty TNHH Minh Phát',
        customerPhone: '0901 234 567',
        address: '123 Lê Lợi, Q.1, TP.HCM',
        salesChannel: 'B2B',
        productId: createdProductId,
        quantity: 2,
        paymentType: 'BANK',
        paymentMethodLabel: 'Chuyển khoản ngân hàng'
      }
    });
    assert.equal(createdOrderRes.status, 201);
    createdOrderId = createdOrderRes.data.id;
    assert.equal(createdOrderRes.data.status, 'PLACED');

    // 3e. Workflow transitions by appropriate roles:
    // Sales approves (PLACED -> PREPARING)
    const approveRes = await apiFetch(`/api/v1/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      token: tokens.sales,
      body: { status: 'PREPARING' }
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.data.status, 'PREPARING');

    // Warehouse dispatches (PREPARING -> DELIVERING)
    const dispatchRes = await apiFetch(`/api/v1/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      token: tokens.warehouse,
      body: { status: 'DELIVERING' }
    });
    assert.equal(dispatchRes.status, 200);
    assert.equal(dispatchRes.data.status, 'DELIVERING');

    // Accountant completes (DELIVERING -> DELIVERED)
    const completeRes = await apiFetch(`/api/v1/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      token: tokens.accountant,
      body: { status: 'DELIVERED' }
    });
    assert.equal(completeRes.status, 200);
    assert.equal(completeRes.data.status, 'DELIVERED');

    // 3f. Printable Invoice JSON check
    const invoiceRes = await apiFetch(`/api/v1/orders/${createdOrderId}/invoice`, { token: tokens.accountant });
    assert.equal(invoiceRes.status, 200);
    assert.equal(invoiceRes.data.order.id, createdOrderId);
    assert.ok(invoiceRes.data.order.vipProductDiscount > 0);

    // 4. Android legacy /api/* compatibility check (without Bearer header)
    const legacyHealth = await apiFetch('/api/health');
    assert.equal(legacyHealth.status, 200);
    assert.equal(legacyHealth.data.status, 'OK');

    const legacyProducts = await apiFetch('/api/products');
    assert.equal(legacyProducts.status, 200);
    assert.ok(Array.isArray(legacyProducts.data));

    const legacyKpis = await apiFetch('/api/dashboard/kpis');
    assert.equal(legacyKpis.status, 200);
    assert.equal(typeof legacyKpis.data.deliveredCount, 'number');

    // 5. Built Portal SPA serving check
    const spaRes = await apiFetch('/', { asText: true });
    assert.equal(spaRes.status, 200);
    assert.ok(spaRes.data.includes('Viễn Đông Sales'), 'Root route should serve built Portal HTML');
  } finally {
    // Cleanup temporary E2E test records so live MongoDB Atlas stays spotless
    await Promise.all([
      createdProductId ? Product.deleteOne({ id: createdProductId }) : Promise.resolve(),
      createdProductId ? StockLog.deleteMany({ productId: createdProductId }) : Promise.resolve(),
      createdOrderId ? Order.deleteOne({ id: createdOrderId }) : Promise.resolve(),
      createdOrderId ? Transaction.deleteMany({ orderCode: createdOrderId }) : Promise.resolve(),
      AuditLog.deleteMany({ entityId: { $in: [createdProductId, createdOrderId].filter(Boolean) } })
    ]);
    await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
  }
});
