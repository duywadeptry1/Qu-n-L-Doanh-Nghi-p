const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { requireAuth, requireAuthOrLegacy, requirePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../config/rbac');

const router = express.Router();

router.get(
  '/transactions',
  requireAuthOrLegacy,
  requirePermission(PERMISSIONS.TRANSACTIONS_READ),
  dashboardController.getTransactions
);
router.get(
  '/notifications',
  requireAuthOrLegacy,
  requirePermission(PERMISSIONS.NOTIFICATIONS_VIEW),
  dashboardController.getNotifications
);
router.get(
  '/calendar',
  requireAuthOrLegacy,
  requirePermission(PERMISSIONS.CALENDAR_VIEW),
  dashboardController.getCalendar
);
router.get(
  '/dashboard/kpis',
  requireAuthOrLegacy,
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  dashboardController.getDashboardKpis
);

// Strictly authenticated Admin/Portal routes
router.get(
  '/audit-logs',
  requireAuth,
  requirePermission(PERMISSIONS.AUDIT_LOGS_READ),
  dashboardController.listAuditLogs
);
router.get(
  '/settings/policy',
  requireAuth,
  requirePermission(PERMISSIONS.SETTINGS_READ),
  dashboardController.getPolicySetting
);
router.put(
  '/settings/policy',
  requireAuth,
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  dashboardController.updatePolicySetting
);

module.exports = router;
