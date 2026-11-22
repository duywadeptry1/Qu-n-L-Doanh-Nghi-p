const express = require('express');
const orderController = require('../controllers/orderController');
const { requireAuthOrLegacy, requirePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../config/rbac');

const router = express.Router();

router.use(requireAuthOrLegacy);

router.get(
  '/',
  requirePermission(PERMISSIONS.ORDERS_READ, PERMISSIONS.ORDERS_READ_OWN),
  orderController.listOrders
);
router.get(
  '/export',
  requirePermission(PERMISSIONS.ORDERS_READ, PERMISSIONS.ORDERS_READ_OWN),
  orderController.exportOrdersCsv
);
router.post(
  '/preview',
  requirePermission(PERMISSIONS.ORDERS_CREATE, PERMISSIONS.ORDERS_CREATE_OWN),
  orderController.previewOrder
);
router.get(
  '/:id/invoice',
  requirePermission(PERMISSIONS.ORDERS_READ, PERMISSIONS.ORDERS_READ_OWN),
  orderController.getOrderInvoice
);
router.get(
  '/:id',
  requirePermission(PERMISSIONS.ORDERS_READ, PERMISSIONS.ORDERS_READ_OWN),
  orderController.getOrderById
);
router.post(
  '/',
  requirePermission(PERMISSIONS.ORDERS_CREATE, PERMISSIONS.ORDERS_CREATE_OWN),
  orderController.createOrder
);
router.patch(
  '/:id/status',
  requirePermission(
    PERMISSIONS.ORDERS_APPROVE,
    PERMISSIONS.ORDERS_DISPATCH,
    PERMISSIONS.ORDERS_COMPLETE,
    PERMISSIONS.ORDERS_CANCEL_ANY,
    PERMISSIONS.ORDERS_CANCEL_PLACED
  ),
  orderController.updateOrderStatus
);

module.exports = router;
