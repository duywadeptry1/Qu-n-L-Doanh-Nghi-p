process.env.NODE_ENV = 'test';
require('dotenv').config();

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { createApp } = require('../app');
const { seedDatabase } = require('../seedData');
const CustomerProfile = require('../models/CustomerProfile');
const { calculateDynamicVipPricing, DEFAULT_POLICY } = require('../services/policyService');

test('Policy Service: dynamic VIP pricing respects custom policy & shipping floor', () => {
  const customPolicy = {
    ...DEFAULT_POLICY,
    standardShippingFee: 25000,
    shippingBaseCost: 15000,
    vipTiers: {
      ...DEFAULT_POLICY.vipTiers,
      diamondMinOrders: 5,
      diamondDemoDiscountPercent: 25,
      diamondShippingDiscount: 20000 // Should still be clamped to 25k - 15k = 10k!
    }
  };

  const pricing = calculateDynamicVipPricing({
    unitPrice: 1_000_000,
    importPrice: 800_000,
    quantity: 1,
    isDemoProduct: true,
    existingOrderCount: 5,
    policy: customPolicy
  });

  assert.equal(pricing.vipTierAtPurchase, 'VIP_DIAMOND');
  // 25% of 1M = 250k, but capped at (1M - 800k) = 200k so selling price >= importPrice
  assert.equal(pricing.vipProductDiscount, 200_000);
  // 20k shipping discount clamped to 10k so shippingFee stays >= 15k floor
  assert.equal(pricing.shippingDiscount, 10_000);
  assert.equal(pricing.shippingFee, 15_000);
  assert.equal(pricing.shippingCost, 15_000);
});

test('HTTP Integration Stage 2: Pagination, Order Preview, Reports, VIP Customers & Exports', async t => {
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

  try {
    const adminLogin = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'admin@viendong.vn', password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123' }
    });
    const salesLogin = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'sales@viendong.vn', password: 'Sales@123' }
    });
    const adminToken = adminLogin.data.accessToken;
    const salesToken = salesLogin.data.accessToken;

    // 1. BE-06: Paginated products + summary + CSV export with cost masking
    const pagedProducts = await apiFetch('/api/v1/products?page=1&limit=3&sort=stock_asc', { token: salesToken });
    assert.equal(pagedProducts.status, 200);
    assert.equal(pagedProducts.data.items.length, 3);
    assert.equal(pagedProducts.data.pagination.page, 1);
    assert.ok(pagedProducts.data.summary.totalProducts >= 6);
    assert.equal(pagedProducts.data.items[0].importPrice, undefined);

    const adminCsv = await apiFetch('/api/v1/products/export', { token: adminToken, asText: true });
    assert.equal(adminCsv.status, 200);
    assert.ok(adminCsv.data.includes('Giá nhập'));

    const salesCsv = await apiFetch('/api/v1/products/export', { token: salesToken, asText: true });
    assert.equal(salesCsv.status, 200);
    assert.ok(!salesCsv.data.includes('Giá nhập'));

    // 2. BE-07: Order Preview (Trade Lock + VIP Demo + Shipping Floor + Cost Masking)
    const allProductsRes = await apiFetch('/api/v1/products', { token: adminToken });
    const inStockDemoProduct = allProductsRes.data.find(p => p.isDemoProduct && p.stock > 0);
    assert.ok(inStockDemoProduct, 'Expected at least one in-stock demo product in DB');

    const lockedPreview = await apiFetch('/api/v1/orders/preview', {
      method: 'POST',
      token: adminToken,
      body: {
        customerPhone: '0901 234 567',
        productId: inStockDemoProduct.id,
        quantity: inStockDemoProduct.stock + 50,
        salesChannel: 'B2B'
      }
    });
    assert.equal(lockedPreview.status, 200);
    assert.equal(lockedPreview.data.tradeLock.isLocked, true);
    assert.equal(lockedPreview.data.tradeLock.code, 'TRADE_LOCKED_INSUFFICIENT_STOCK');
    assert.equal(lockedPreview.data.tradeLock.shortage, 50);

    const vipSalesPreview = await apiFetch('/api/v1/orders/preview', {
      method: 'POST',
      token: salesToken,
      body: {
        customerPhone: '0901 234 567',
        productId: inStockDemoProduct.id,
        quantity: 1,
        salesChannel: 'B2B'
      }
    });
    assert.equal(vipSalesPreview.status, 200);
    assert.equal(vipSalesPreview.data.tradeLock.isLocked, false);
    assert.ok(['VIP_GOLD', 'VIP_DIAMOND'].includes(vipSalesPreview.data.pricing.vipTierAtPurchase));
    assert.ok(vipSalesPreview.data.pricing.vipProductDiscount > 0);
    assert.ok(vipSalesPreview.data.pricing.shippingFee >= 15000);
    // Cost fields masked for SALES
    assert.equal(vipSalesPreview.data.pricing.estimatedProfit, undefined);
    assert.equal(vipSalesPreview.data.pricing.totalImportCost, undefined);
    assert.equal(vipSalesPreview.data.pricing.shippingCost, undefined);

    // Order pagination + Invoice + CSV export
    const pagedOrders = await apiFetch('/api/v1/orders?page=1&limit=3', { token: adminToken });
    assert.equal(pagedOrders.status, 200);
    assert.equal(pagedOrders.data.items.length, 3);
    assert.ok(pagedOrders.data.pagination.total >= 8);

    const invoiceRes = await apiFetch('/api/v1/orders/DH-9824/invoice', { token: adminToken });
    assert.equal(invoiceRes.status, 200);
    assert.equal(invoiceRes.data.invoiceNumber, 'INV-DH-9824');
    assert.ok(invoiceRes.data.order.totalPayment > 0);

    // 3. BE-08: Income, Channels, Top Products & Export with RBAC Profit Guard
    const adminIncome = await apiFetch('/api/v1/reports/income?period=MONTH&metric=PROFIT', { token: adminToken });
    assert.equal(adminIncome.status, 200);
    assert.equal(adminIncome.data.canViewProfit, true);
    assert.ok(adminIncome.data.summary.totalRevenue > 0);
    assert.ok(adminIncome.data.summary.totalProfit > 0);
    assert.ok(adminIncome.data.channels.B2B.orderCount > 0);
    assert.ok(adminIncome.data.channels.B2C.orderCount > 0);

    const salesProfitForbidden = await apiFetch('/api/v1/reports/income?period=MONTH&metric=PROFIT', { token: salesToken });
    assert.equal(salesProfitForbidden.status, 403);
    assert.equal(salesProfitForbidden.data.code, 'FORBIDDEN_PROFIT_REPORT');

    const salesRevenueAllowed = await apiFetch('/api/v1/reports/income?period=MONTH&metric=REVENUE', { token: salesToken });
    assert.equal(salesRevenueAllowed.status, 200);
    assert.equal(salesRevenueAllowed.data.canViewProfit, false);
    assert.ok(salesRevenueAllowed.data.summary.totalRevenue > 0);
    assert.equal(salesRevenueAllowed.data.summary.totalProfit, undefined);
    assert.equal(salesRevenueAllowed.data.summary.totalCost, undefined);
    assert.equal(salesRevenueAllowed.data.channels.B2B.profit, undefined);

    const topProducts = await apiFetch('/api/v1/reports/top-products?limit=5', { token: adminToken });
    assert.equal(topProducts.status, 200);
    assert.equal(topProducts.data.topProducts.length, 5);

    const reportCsv = await apiFetch('/api/v1/reports/export?period=MONTH', { token: adminToken, asText: true });
    assert.equal(reportCsv.status, 200);
    assert.ok(reportCsv.data.includes('Lợi nhuận ròng'));

    // 4. BE-09: VIP Customers & Representative Profile
    const vipList = await apiFetch('/api/v1/customers/vip', { token: salesToken });
    assert.equal(vipList.status, 200);
    assert.ok(vipList.data.customers.length > 0);
    assert.equal(vipList.data.customers[0].primaryChannel, 'B2B');
    assert.equal(vipList.data.customers[0].isVip, true);
    assert.ok(['VIP_GOLD', 'VIP_DIAMOND'].includes(vipList.data.customers[0].vipTier));

    const detail = await apiFetch('/api/v1/customers/0901234567', { token: salesToken });
    assert.equal(detail.status, 200);
    assert.ok(detail.data.orders.length >= 4);
    assert.equal(detail.data.orders[0].shippingCost, undefined);

    const patched = await apiFetch('/api/v1/customers/0901234567', {
      method: 'PATCH',
      token: salesToken,
      body: { companyName: 'Cty TNHH Minh Phát', notes: 'Đối tác B2B ưu tiên', defaultChannel: 'B2B' }
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.data.companyName, 'Cty TNHH Minh Phát');

    // Clean up test profile document
    await CustomerProfile.deleteOne({ normalizedPhone: '0901234567' });
  } finally {
    await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
  }
});
