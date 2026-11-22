const { canViewCostAndProfit } = require('../config/rbac');

function toPlainObject(doc) {
  if (!doc) return doc;
  return typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
}

/**
 * Strips sensitive import-cost fields from Product payloads when role lacks cost visibility
 * (e.g. SALES, WAREHOUSE, B2B_PARTNER).
 */
function sanitizeProductForRole(productDoc, role) {
  const obj = toPlainObject(productDoc);
  if (!obj) return obj;
  if (!canViewCostAndProfit(role)) {
    delete obj.importPrice;
  }
  return obj;
}

/**
 * Strips sensitive cost fields (shippingCost, item.importPrice) from Order payloads
 * when role lacks cost/profit visibility.
 */
function sanitizeOrderForRole(orderDoc, role) {
  const obj = toPlainObject(orderDoc);
  if (!obj) return obj;
  if (!canViewCostAndProfit(role)) {
    delete obj.shippingCost;
    if (Array.isArray(obj.items)) {
      obj.items = obj.items.map(item => {
        const cleanItem = toPlainObject(item);
        delete cleanItem.importPrice;
        return cleanItem;
      });
    }
  }
  return obj;
}

module.exports = {
  sanitizeProductForRole,
  sanitizeOrderForRole
};
