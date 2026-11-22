const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  SALES: 'SALES',
  WAREHOUSE: 'WAREHOUSE',
  ACCOUNTANT: 'ACCOUNTANT',
  B2B_PARTNER: 'B2B_PARTNER'
});

const ALL_ROLES = Object.values(ROLES);

const PERMISSIONS = Object.freeze({
  // Dashboard & Calendar
  DASHBOARD_VIEW: 'dashboard:view',
  CALENDAR_VIEW: 'calendar:view',
  NOTIFICATIONS_VIEW: 'notifications:view',

  // Products & Inventory
  PRODUCTS_READ: 'products:read',
  PRODUCTS_VIEW_COST: 'products:view_cost',
  PRODUCTS_CREATE: 'products:create',
  PRODUCTS_UPDATE: 'products:update',
  PRODUCTS_UPDATE_COST: 'products:update_cost',
  PRODUCTS_BULK_IMPORT: 'products:bulk_import',
  PRODUCTS_RESTOCK: 'products:restock',
  PRODUCTS_DELETE: 'products:delete',
  STOCK_LOGS_READ: 'stock_logs:read',

  // Orders
  ORDERS_READ: 'orders:read',
  ORDERS_READ_OWN: 'orders:read_own',
  ORDERS_CREATE: 'orders:create',
  ORDERS_CREATE_OWN: 'orders:create_own',
  ORDERS_APPROVE: 'orders:approve',          // PLACED -> PREPARING
  ORDERS_DISPATCH: 'orders:dispatch',        // PREPARING -> DELIVERING
  ORDERS_COMPLETE: 'orders:complete',        // DELIVERING -> DELIVERED
  ORDERS_CANCEL_ANY: 'orders:cancel_any',    // Cancel from PLACED/PREPARING/DELIVERING
  ORDERS_CANCEL_PLACED: 'orders:cancel_placed', // Cancel only while PLACED

  // Finance & Reports
  TRANSACTIONS_READ: 'transactions:read',
  REPORTS_VIEW_REVENUE: 'reports:view_revenue',
  REPORTS_VIEW_PROFIT: 'reports:view_profit',

  // Customers & VIP
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_UPDATE: 'customers:update',

  // System, Users & Audit
  USERS_MANAGE: 'users:manage',
  SETTINGS_READ: 'settings:read',
  SETTINGS_UPDATE: 'settings:update',
  AUDIT_LOGS_READ: 'audit_logs:read'
});

const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: Object.values(PERMISSIONS),

  [ROLES.MANAGER]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CALENDAR_VIEW,
    PERMISSIONS.NOTIFICATIONS_VIEW,
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.PRODUCTS_VIEW_COST,
    PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.PRODUCTS_UPDATE,
    PERMISSIONS.PRODUCTS_UPDATE_COST,
    PERMISSIONS.PRODUCTS_BULK_IMPORT,
    PERMISSIONS.PRODUCTS_RESTOCK,
    PERMISSIONS.STOCK_LOGS_READ,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_APPROVE,
    PERMISSIONS.ORDERS_DISPATCH,
    PERMISSIONS.ORDERS_COMPLETE,
    PERMISSIONS.ORDERS_CANCEL_ANY,
    PERMISSIONS.TRANSACTIONS_READ,
    PERMISSIONS.REPORTS_VIEW_REVENUE,
    PERMISSIONS.REPORTS_VIEW_PROFIT,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.CUSTOMERS_UPDATE,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.AUDIT_LOGS_READ
  ],

  [ROLES.SALES]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CALENDAR_VIEW,
    PERMISSIONS.NOTIFICATIONS_VIEW,
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_APPROVE,
    PERMISSIONS.ORDERS_COMPLETE,
    PERMISSIONS.ORDERS_CANCEL_PLACED,
    PERMISSIONS.REPORTS_VIEW_REVENUE,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.CUSTOMERS_UPDATE,
    PERMISSIONS.SETTINGS_READ
  ],

  [ROLES.WAREHOUSE]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CALENDAR_VIEW,
    PERMISSIONS.NOTIFICATIONS_VIEW,
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.PRODUCTS_BULK_IMPORT,
    PERMISSIONS.PRODUCTS_RESTOCK,
    PERMISSIONS.STOCK_LOGS_READ,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_DISPATCH,
    PERMISSIONS.ORDERS_COMPLETE
  ],

  [ROLES.ACCOUNTANT]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CALENDAR_VIEW,
    PERMISSIONS.NOTIFICATIONS_VIEW,
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.PRODUCTS_VIEW_COST,
    PERMISSIONS.STOCK_LOGS_READ,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_COMPLETE,
    PERMISSIONS.TRANSACTIONS_READ,
    PERMISSIONS.REPORTS_VIEW_REVENUE,
    PERMISSIONS.REPORTS_VIEW_PROFIT,
    PERMISSIONS.CUSTOMERS_READ,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.AUDIT_LOGS_READ
  ],

  [ROLES.B2B_PARTNER]: [
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.ORDERS_READ_OWN,
    PERMISSIONS.ORDERS_CREATE_OWN,
    PERMISSIONS.ORDERS_CANCEL_PLACED
  ]
});

function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || [];
}

function hasPermission(role, permission) {
  return getPermissionsForRole(role).includes(permission);
}

function canViewCostAndProfit(role) {
  return hasPermission(role, PERMISSIONS.PRODUCTS_VIEW_COST) ||
    hasPermission(role, PERMISSIONS.REPORTS_VIEW_PROFIT);
}

/**
 * Checks whether a user with `role` is allowed to transition an order
 * from `currentStatus` to `targetStatus`.
 */
function canTransitionOrderStatus(role, currentStatus, targetStatus) {
  if (currentStatus === targetStatus) return true;
  if (currentStatus === 'DELIVERED' || currentStatus === 'CANCELLED') {
    return false;
  }

  if (targetStatus === 'CANCELLED') {
    if (hasPermission(role, PERMISSIONS.ORDERS_CANCEL_ANY)) return true;
    if (currentStatus === 'PLACED' && hasPermission(role, PERMISSIONS.ORDERS_CANCEL_PLACED)) return true;
    return false;
  }

  if (currentStatus === 'PLACED' && targetStatus === 'PREPARING') {
    return hasPermission(role, PERMISSIONS.ORDERS_APPROVE);
  }
  if (currentStatus === 'PREPARING' && targetStatus === 'DELIVERING') {
    return hasPermission(role, PERMISSIONS.ORDERS_DISPATCH);
  }
  if (currentStatus === 'DELIVERING' && targetStatus === 'DELIVERED') {
    return hasPermission(role, PERMISSIONS.ORDERS_COMPLETE);
  }

  // Only Admin/Manager may jump non-adjacent stages (e.g. PLACED -> DELIVERED)
  return role === ROLES.ADMIN || role === ROLES.MANAGER;
}

module.exports = {
  ROLES,
  ALL_ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getPermissionsForRole,
  hasPermission,
  canViewCostAndProfit,
  canTransitionOrderStatus
};
