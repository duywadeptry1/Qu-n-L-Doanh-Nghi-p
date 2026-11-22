const express = require('express');
const customerController = require('../controllers/customerController');
const { requireAuthOrLegacy, requirePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../config/rbac');

const router = express.Router();

router.use(requireAuthOrLegacy);

router.get(
  '/vip',
  requirePermission(PERMISSIONS.CUSTOMERS_READ),
  customerController.listVipCustomers
);
router.get(
  '/:phone',
  requirePermission(PERMISSIONS.CUSTOMERS_READ),
  customerController.getCustomerDetail
);
router.patch(
  '/:phone',
  requirePermission(PERMISSIONS.CUSTOMERS_UPDATE),
  customerController.updateCustomerProfile
);

module.exports = router;
