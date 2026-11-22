const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const productRoutes = require('./productRoutes');
const orderRoutes = require('./orderRoutes');
const reportRoutes = require('./reportRoutes');
const customerRoutes = require('./customerRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const { resolveAuth } = require('../middlewares/auth');

function createApiRouter({ strictAuth = false } = {}) {
  const router = express.Router();

  router.use((req, _res, next) => {
    req.strictAuth = strictAuth;
    next();
  });

  // Public health check
  router.get('/health', (_req, res) => {
    res.json({
      status: 'OK',
      message: 'Viễn Đông Sales API Server is running',
      authMode: strictAuth || process.env.REQUIRE_AUTH === 'true' ? 'strict-jwt' : 'transition-compatible'
    });
  });

  // Resolve Bearer JWT once for all routes below
  router.use(resolveAuth);

  router.use('/auth', authRoutes);
  router.use('/users', userRoutes);
  router.use('/products', productRoutes);
  router.use('/orders', orderRoutes);
  router.use('/reports', reportRoutes);
  router.use('/customers', customerRoutes);
  router.use('/', dashboardRoutes);

  return router;
}

module.exports = { createApiRouter };
