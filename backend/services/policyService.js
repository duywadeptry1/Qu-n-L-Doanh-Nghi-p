const PolicySetting = require('../models/PolicySetting');

const DEFAULT_POLICY = Object.freeze({
  standardShippingFee: 30000,
  shippingBaseCost: 15000,
  lowStockThreshold: 10,
  vipTiers: {
    silverMinOrders: 2,
    silverDemoDiscountPercent: 10,
    silverShippingDiscount: 5000,
    goldMinOrders: 4,
    goldDemoDiscountPercent: 15,
    goldShippingDiscount: 10000,
    diamondMinOrders: 6,
    diamondDemoDiscountPercent: 20,
    diamondShippingDiscount: 15000
  }
});

let cachedPolicy = null;
let cachedAt = 0;
const CACHE_TTL_MS = 15_000;

function invalidatePolicyCache() {
  cachedPolicy = null;
  cachedAt = 0;
}

function normalizePolicy(doc) {
  if (!doc) return DEFAULT_POLICY;
  const raw = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const tiers = raw.vipTiers || {};
  return {
    standardShippingFee: Number.isFinite(raw.standardShippingFee) ? raw.standardShippingFee : DEFAULT_POLICY.standardShippingFee,
    shippingBaseCost: Number.isFinite(raw.shippingBaseCost) ? raw.shippingBaseCost : DEFAULT_POLICY.shippingBaseCost,
    lowStockThreshold: Number.isFinite(raw.lowStockThreshold) ? raw.lowStockThreshold : DEFAULT_POLICY.lowStockThreshold,
    vipTiers: {
      silverMinOrders: tiers.silverMinOrders ?? DEFAULT_POLICY.vipTiers.silverMinOrders,
      silverDemoDiscountPercent: tiers.silverDemoDiscountPercent ?? DEFAULT_POLICY.vipTiers.silverDemoDiscountPercent,
      silverShippingDiscount: tiers.silverShippingDiscount ?? DEFAULT_POLICY.vipTiers.silverShippingDiscount,
      goldMinOrders: tiers.goldMinOrders ?? DEFAULT_POLICY.vipTiers.goldMinOrders,
      goldDemoDiscountPercent: tiers.goldDemoDiscountPercent ?? DEFAULT_POLICY.vipTiers.goldDemoDiscountPercent,
      goldShippingDiscount: tiers.goldShippingDiscount ?? DEFAULT_POLICY.vipTiers.goldShippingDiscount,
      diamondMinOrders: tiers.diamondMinOrders ?? DEFAULT_POLICY.vipTiers.diamondMinOrders,
      diamondDemoDiscountPercent: tiers.diamondDemoDiscountPercent ?? DEFAULT_POLICY.vipTiers.diamondDemoDiscountPercent,
      diamondShippingDiscount: tiers.diamondShippingDiscount ?? DEFAULT_POLICY.vipTiers.diamondShippingDiscount
    }
  };
}

async function getActivePolicy() {
  const now = Date.now();
  if (cachedPolicy && (now - cachedAt) < CACHE_TTL_MS) {
    return cachedPolicy;
  }
  try {
    const doc = await PolicySetting.findOne({ key: 'default' }).lean();
    cachedPolicy = normalizePolicy(doc);
    cachedAt = now;
    return cachedPolicy;
  } catch (_err) {
    return DEFAULT_POLICY;
  }
}

function computeVipTierInfo(orderCount, policy = DEFAULT_POLICY) {
  const t = (policy && policy.vipTiers) || DEFAULT_POLICY.vipTiers;
  if (orderCount >= t.diamondMinOrders) {
    return {
      tier: 'VIP_DIAMOND',
      badge: '💎 VIP Kim Cương',
      demoDiscountPercent: t.diamondDemoDiscountPercent,
      shippingDiscount: t.diamondShippingDiscount,
      nextTier: null,
      ordersToNextTier: 0
    };
  }
  if (orderCount >= t.goldMinOrders) {
    return {
      tier: 'VIP_GOLD',
      badge: '👑 VIP Vàng',
      demoDiscountPercent: t.goldDemoDiscountPercent,
      shippingDiscount: t.goldShippingDiscount,
      nextTier: 'VIP_DIAMOND',
      ordersToNextTier: Math.max(0, t.diamondMinOrders - orderCount)
    };
  }
  if (orderCount >= t.silverMinOrders) {
    return {
      tier: 'VIP_SILVER',
      badge: '⭐ VIP Bạc',
      demoDiscountPercent: t.silverDemoDiscountPercent,
      shippingDiscount: t.silverShippingDiscount,
      nextTier: 'VIP_GOLD',
      ordersToNextTier: Math.max(0, t.goldMinOrders - orderCount)
    };
  }
  return {
    tier: 'STANDARD',
    badge: 'Khách thường',
    demoDiscountPercent: 0,
    shippingDiscount: 0,
    nextTier: 'VIP_SILVER',
    ordersToNextTier: Math.max(0, t.silverMinOrders - orderCount)
  };
}

/**
 * Dynamic policy-driven VIP pricing calculator:
 * - Demo product discount capped at (subtotal - totalImportCost)
 * - Shipping discount strictly floored at policy.shippingBaseCost (never below cost)
 */
function calculateDynamicVipPricing({
  unitPrice,
  importPrice = 0,
  quantity = 1,
  isDemoProduct = false,
  existingOrderCount = 0,
  baseShippingFee,
  policy = DEFAULT_POLICY
}) {
  const effectivePolicy = normalizePolicy(policy);
  const shipBase = Number.isFinite(baseShippingFee) ? baseShippingFee : effectivePolicy.standardShippingFee;
  const shipCostFloor = effectivePolicy.shippingBaseCost;

  const tierInfo = computeVipTierInfo(existingOrderCount, effectivePolicy);
  const subtotal = unitPrice * quantity;
  const totalImportCost = (importPrice || 0) * quantity;

  let vipProductDiscount = 0;
  if (isDemoProduct && tierInfo.demoDiscountPercent > 0) {
    const desired = Math.round(subtotal * tierInfo.demoDiscountPercent / 100);
    const maxSafe = totalImportCost > 0 ? Math.max(0, subtotal - totalImportCost) : desired;
    vipProductDiscount = Math.min(desired, maxSafe);
  }

  const maxSafeShippingDiscount = Math.max(0, shipBase - shipCostFloor);
  const shippingDiscount = Math.min(tierInfo.shippingDiscount, maxSafeShippingDiscount);
  const shippingFee = shipBase - shippingDiscount;
  const totalPayment = Math.max(0, subtotal - vipProductDiscount) + shippingFee;
  const estimatedProfit = totalPayment - totalImportCost - (shippingFee > 0 ? shipCostFloor : 0);

  return {
    vipTierAtPurchase: tierInfo.tier,
    vipBadge: tierInfo.badge,
    demoDiscountPercent: tierInfo.demoDiscountPercent,
    existingOrderCount,
    nextTier: tierInfo.nextTier,
    ordersToNextTier: tierInfo.ordersToNextTier,
    subtotal,
    vipProductDiscount,
    baseShippingFee: shipBase,
    shippingDiscount,
    shippingFee,
    shippingCost: shipCostFloor,
    totalImportCost,
    totalPayment,
    estimatedProfit
  };
}

module.exports = {
  DEFAULT_POLICY,
  getActivePolicy,
  invalidatePolicyCache,
  computeVipTierInfo,
  calculateDynamicVipPricing
};
