const express = require('express');
const reportController = require('../controllers/reportController');
const { requireAuthOrLegacy, requirePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../config/rbac');

const router = express.Router();

router.use(requireAuthOrLegacy);

router.get(
  '/income',
  requirePermission(PERMISSIONS.REPORTS_VIEW_REVENUE, PERMISSIONS.REPORTS_VIEW_PROFIT),
  reportController.getIncomeReport
);
router.get(
  '/channels',
  requirePermission(PERMISSIONS.REPORTS_VIEW_REVENUE, PERMISSIONS.REPORTS_VIEW_PROFIT),
  reportController.getChannelReport
);
router.get(
  '/top-products',
  requirePermission(PERMISSIONS.REPORTS_VIEW_REVENUE, PERMISSIONS.REPORTS_VIEW_PROFIT),
  reportController.getTopProductsReport
);
router.get(
  '/export',
  requirePermission(PERMISSIONS.REPORTS_VIEW_REVENUE, PERMISSIONS.REPORTS_VIEW_PROFIT),
  reportController.exportIncomeReportCsv
);

module.exports = router;
