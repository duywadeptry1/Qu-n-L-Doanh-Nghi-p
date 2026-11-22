const express = require('express');
const productController = require('../controllers/productController');
const { requireAuthOrLegacy, requirePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../config/rbac');

const router = express.Router();

router.use(requireAuthOrLegacy);

router.get(
  '/',
  requirePermission(PERMISSIONS.PRODUCTS_READ),
  productController.listProducts
);
router.get(
  '/locked',
  requirePermission(PERMISSIONS.PRODUCTS_READ),
  productController.listLockedProducts
);
router.get(
  '/export',
  requirePermission(PERMISSIONS.PRODUCTS_READ),
  productController.exportProductsCsv
);
router.get(
  '/:id/stock-logs',
  requirePermission(PERMISSIONS.STOCK_LOGS_READ),
  productController.listStockLogs
);
router.post(
  '/',
  requirePermission(PERMISSIONS.PRODUCTS_CREATE),
  productController.createProduct
);
router.post(
  '/bulk',
  requirePermission(PERMISSIONS.PRODUCTS_BULK_IMPORT),
  productController.bulkCreateProducts
);
router.put(
  '/:id',
  requirePermission(PERMISSIONS.PRODUCTS_UPDATE),
  productController.updateProduct
);
router.patch(
  '/:id/restock',
  requirePermission(PERMISSIONS.PRODUCTS_RESTOCK),
  productController.restockProduct
);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.PRODUCTS_DELETE),
  productController.deleteProduct
);

module.exports = router;
