process.env.NODE_ENV = 'test';
require('dotenv').config();

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { createApp } = require('../app');
const { seedDatabase } = require('../seedData');
const {
  ROLES,
  PERMISSIONS,
  hasPermission,
  canViewCostAndProfit,
  canTransitionOrderStatus
} = require('../config/rbac');
const {
  sanitizeProductForRole,
  sanitizeOrderForRole
} = require('../middlewares/fieldMask');
const {
  hashPassword,
  comparePassword,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
} = require('../services/authService');

test('RBAC: role permissions and cost visibility matrix', () => {
  assert.equal(canViewCostAndProfit(ROLES.ADMIN), true);
  assert.equal(canViewCostAndProfit(ROLES.MANAGER), true);
  assert.equal(canViewCostAndProfit(ROLES.ACCOUNTANT), true);
  assert.equal(canViewCostAndProfit(ROLES.SALES), false);
  assert.equal(canViewCostAndProfit(ROLES.WAREHOUSE), false);
  assert.equal(canViewCostAndProfit(ROLES.B2B_PARTNER), false);

  assert.equal(hasPermission(ROLES.ADMIN, PERMISSIONS.USERS_MANAGE), true);
  assert.equal(hasPermission(ROLES.MANAGER, PERMISSIONS.USERS_MANAGE), false);
  assert.equal(hasPermission(ROLES.WAREHOUSE, PERMISSIONS.PRODUCTS_RESTOCK), true);
  assert.equal(hasPermission(ROLES.SALES, PERMISSIONS.PRODUCTS_RESTOCK), false);
  assert.equal(hasPermission(ROLES.ACCOUNTANT, PERMISSIONS.TRANSACTIONS_READ), true);
  assert.equal(hasPermission(ROLES.WAREHOUSE, PERMISSIONS.TRANSACTIONS_READ), false);
});

test('RBAC: order status transition guard by role', () => {
  // SALES can approve PLACED -> PREPARING and cancel while PLACED, cannot dispatch or cancel PREPARING
  assert.equal(canTransitionOrderStatus(ROLES.SALES, 'PLACED', 'PREPARING'), true);
  assert.equal(canTransitionOrderStatus(ROLES.SALES, 'PLACED', 'CANCELLED'), true);
  assert.equal(canTransitionOrderStatus(ROLES.SALES, 'PREPARING', 'DELIVERING'), false);
  assert.equal(canTransitionOrderStatus(ROLES.SALES, 'PREPARING', 'CANCELLED'), false);

  // WAREHOUSE can dispatch PREPARING -> DELIVERING, cannot approve PLACED -> PREPARING or cancel
  assert.equal(canTransitionOrderStatus(ROLES.WAREHOUSE, 'PREPARING', 'DELIVERING'), true);
  assert.equal(canTransitionOrderStatus(ROLES.WAREHOUSE, 'PLACED', 'PREPARING'), false);
  assert.equal(canTransitionOrderStatus(ROLES.WAREHOUSE, 'PLACED', 'CANCELLED'), false);

  // ADMIN/MANAGER can cancel unshipped or delivering orders, nobody transitions after DELIVERED
  assert.equal(canTransitionOrderStatus(ROLES.ADMIN, 'PREPARING', 'CANCELLED'), true);
  assert.equal(canTransitionOrderStatus(ROLES.ADMIN, 'DELIVERED', 'CANCELLED'), false);
});

test('Field Masking: strips importPrice and shippingCost for non-cost roles', () => {
  const sampleProduct = { id: 'p-1', name: 'Test', importPrice: 500000, price: 800000, stock: 10 };
  const sampleOrder = {
    id: 'DH-1',
    shippingFee: 20000,
    shippingCost: 15000,
    items: [{ productName: 'Test', quantity: 1, unitPrice: 800000, importPrice: 500000 }]
  };

  assert.equal(sanitizeProductForRole(sampleProduct, ROLES.ADMIN).importPrice, 500000);
  assert.equal(sanitizeProductForRole(sampleProduct, ROLES.ACCOUNTANT).importPrice, 500000);
  assert.equal(sanitizeProductForRole(sampleProduct, ROLES.SALES).importPrice, undefined);
  assert.equal(sanitizeProductForRole(sampleProduct, ROLES.WAREHOUSE).importPrice, undefined);

  const salesOrder = sanitizeOrderForRole(sampleOrder, ROLES.SALES);
  assert.equal(salesOrder.shippingCost, undefined);
  assert.equal(salesOrder.items[0].importPrice, undefined);
  assert.equal(salesOrder.shippingFee, 20000);

  const adminOrder = sanitizeOrderForRole(sampleOrder, ROLES.ADMIN);
  assert.equal(adminOrder.shippingCost, 15000);
  assert.equal(adminOrder.items[0].importPrice, 500000);
});

test('Auth Service: bcrypt hashing and JWT access/refresh separation', async () => {
  const hash = await hashPassword('Secret@123');
  assert.equal(await comparePassword('Secret@123', hash), true);
  assert.equal(await comparePassword('WrongPass', hash), false);

  const fakeUser = { id: 'u-99', email: 'test@viendong.vn', role: ROLES.SALES, fullName: 'Test User' };
  const access = signAccessToken(fakeUser);
  const refresh = signRefreshToken(fakeUser);

  assert.equal(verifyAccessToken(access).sub, 'u-99');
  assert.equal(verifyRefreshToken(refresh).sub, 'u-99');
  assert.throws(() => verifyAccessToken(refresh));
  assert.throws(() => verifyRefreshToken(access));
});

test('HTTP Integration: Auth, RBAC, Field Masking & Android Legacy Compatibility', async t => {
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

  async function apiFetch(path, { method = 'GET', token, body } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  }

  try {
    // 1. Legacy Android route works without token while /api/v1 strictly requires JWT
    const legacyHealth = await apiFetch('/api/health');
    assert.equal(legacyHealth.status, 200);

    const legacyProducts = await apiFetch('/api/products');
    assert.equal(legacyProducts.status, 200);
    assert.ok(Array.isArray(legacyProducts.json) && legacyProducts.json.length > 0);

    const strictNoToken = await apiFetch('/api/v1/products');
    assert.equal(strictNoToken.status, 401);
    assert.equal(strictNoToken.json.code, 'AUTH_REQUIRED');

    // 2. Login with default seeded accounts (ADMIN, SALES, WAREHOUSE, ACCOUNTANT)
    const adminLogin = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'admin@viendong.vn', password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123' }
    });
    assert.equal(adminLogin.status, 200);
    assert.ok(adminLogin.json.accessToken);
    assert.ok(adminLogin.json.refreshToken);
    assert.equal(adminLogin.json.user.role, ROLES.ADMIN);

    const salesLogin = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'sales@viendong.vn', password: 'Sales@123' }
    });
    assert.equal(salesLogin.status, 200);
    assert.equal(salesLogin.json.user.role, ROLES.SALES);

    const warehouseLogin = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'warehouse@viendong.vn', password: 'Warehouse@123' }
    });
    assert.equal(warehouseLogin.status, 200);
    assert.equal(warehouseLogin.json.user.role, ROLES.WAREHOUSE);

    const accountantLogin = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'accountant@viendong.vn', password: 'Accountant@123' }
    });
    assert.equal(accountantLogin.status, 200);
    assert.equal(accountantLogin.json.user.role, ROLES.ACCOUNTANT);

    // 3. /auth/me & refresh token rotation
    const meRes = await apiFetch('/api/v1/auth/me', { token: salesLogin.json.accessToken });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.json.user.email, 'sales@viendong.vn');

    const refreshed = await apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: salesLogin.json.refreshToken }
    });
    assert.equal(refreshed.status, 200);
    assert.ok(refreshed.json.accessToken);

    // Old rotated refresh token must be rejected
    const oldRefreshRetry = await apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: salesLogin.json.refreshToken }
    });
    assert.equal(oldRefreshRetry.status, 401);

    // 4. Field-level cost masking over HTTP
    const adminProducts = await apiFetch('/api/v1/products', { token: adminLogin.json.accessToken });
    assert.equal(adminProducts.status, 200);
    assert.ok(adminProducts.json[0].importPrice > 0);

    const salesProducts = await apiFetch('/api/v1/products', { token: salesLogin.json.accessToken });
    assert.equal(salesProducts.status, 200);
    assert.equal(salesProducts.json[0].importPrice, undefined);

    const salesOrders = await apiFetch('/api/v1/orders', { token: salesLogin.json.accessToken });
    assert.equal(salesOrders.status, 200);
    assert.equal(salesOrders.json[0].shippingCost, undefined);
    assert.equal(salesOrders.json[0].items[0].importPrice, undefined);

    // 5. RBAC endpoint enforcement
    const salesUsers = await apiFetch('/api/v1/users', { token: salesLogin.json.accessToken });
    assert.equal(salesUsers.status, 403);

    const salesPolicyUpdate = await apiFetch('/api/v1/settings/policy', {
      method: 'PUT',
      token: salesLogin.json.accessToken,
      body: { standardShippingFee: 25000 }
    });
    assert.equal(salesPolicyUpdate.status, 403);

    const warehouseTx = await apiFetch('/api/v1/transactions', { token: warehouseLogin.json.accessToken });
    assert.equal(warehouseTx.status, 403);

    const accountantTx = await apiFetch('/api/v1/transactions', { token: accountantLogin.json.accessToken });
    assert.equal(accountantTx.status, 200);

    const accountantCreateProduct = await apiFetch('/api/v1/products', {
      method: 'POST',
      token: accountantLogin.json.accessToken,
      body: { name: 'Forbidden', price: 100000, stock: 5 }
    });
    assert.equal(accountantCreateProduct.status, 403);

    const adminUsers = await apiFetch('/api/v1/users', { token: adminLogin.json.accessToken });
    assert.equal(adminUsers.status, 200);
    assert.ok(adminUsers.json.length >= 5);

    const adminPolicy = await apiFetch('/api/v1/settings/policy', { token: adminLogin.json.accessToken });
    assert.equal(adminPolicy.status, 200);
    assert.equal(adminPolicy.json.shippingBaseCost, 15000);

    const adminAudit = await apiFetch('/api/v1/audit-logs', { token: adminLogin.json.accessToken });
    assert.equal(adminAudit.status, 200);
    assert.ok(adminAudit.json.length > 0);

    // 6. Logout revokes refresh token
    const logoutRes = await apiFetch('/api/v1/auth/logout', {
      method: 'POST',
      token: refreshed.json.accessToken,
      body: { refreshToken: refreshed.json.refreshToken }
    });
    assert.equal(logoutRes.status, 200);
    const afterLogoutRefresh = await apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: refreshed.json.refreshToken }
    });
    assert.equal(afterLogoutRefresh.status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
  }
});
