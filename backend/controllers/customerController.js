const Order = require('../models/Order');
const CustomerProfile = require('../models/CustomerProfile');
const { sanitizeOrderForRole } = require('../middlewares/fieldMask');
const { getActivePolicy, computeVipTierInfo } = require('../services/policyService');
const { computeOrderRevenue } = require('./reportController');
const { recordAudit } = require('../services/auditService');
const { normalizePhone } = require('../services/helpers');

function buildVipSummaryForOrders(ordersForCustomer, savedProfile, policy) {
  const latest = ordersForCustomer[0] || null;
  const b2bCount = ordersForCustomer.filter(o => o.salesChannel === 'B2B').length;
  const b2cCount = ordersForCustomer.length - b2bCount;
  const inferredChannel = b2bCount > 0 && b2bCount >= b2cCount ? 'B2B' : 'B2C';

  const orderCount = ordersForCustomer.length;
  const deliveredCount = ordersForCustomer.filter(o => o.status === 'DELIVERED').length;
  const totalSpent = ordersForCustomer.reduce((sum, o) => sum + computeOrderRevenue(o), 0);
  const totalVipSavings = ordersForCustomer.reduce(
    (sum, o) => sum + (o.vipProductDiscount || 0) + (o.shippingDiscount || 0),
    0
  );

  const tierInfo = computeVipTierInfo(orderCount, policy);
  const effectiveShippingDiscount = Math.min(
    tierInfo.shippingDiscount,
    Math.max(0, policy.standardShippingFee - policy.shippingBaseCost)
  );

  return {
    normalizedPhone: savedProfile?.normalizedPhone || normalizePhone(latest?.customerPhone || ''),
    customerName: savedProfile?.customerName || latest?.customerName || '',
    companyName: savedProfile?.companyName || '',
    customerPhone: savedProfile?.phoneDisplay || latest?.customerPhone || '',
    defaultAddress: savedProfile?.defaultAddress || latest?.address || '',
    primaryChannel: savedProfile?.defaultChannel || inferredChannel,
    channelSymbol: (savedProfile?.defaultChannel || inferredChannel) === 'B2B' ? '🏢' : '🛍️',
    notes: savedProfile?.notes || '',
    orderCount,
    deliveredCount,
    totalSpent,
    totalVipSavings,
    vipTier: tierInfo.tier,
    vipBadge: tierInfo.badge,
    isVip: tierInfo.tier !== 'STANDARD',
    nextTier: tierInfo.nextTier,
    ordersToNextTier: tierInfo.ordersToNextTier,
    benefits: {
      demoDiscountPercent: tierInfo.demoDiscountPercent,
      shippingDiscount: effectiveShippingDiscount,
      finalShippingFee: policy.standardShippingFee - effectiveShippingDiscount,
      shippingCostFloor: policy.shippingBaseCost
    },
    lastOrderAt: latest?.createdAt || null
  };
}

async function listVipCustomers(req, res) {
  try {
    const { search, tier, channel } = req.query;
    const [activeOrders, savedProfiles, policy] = await Promise.all([
      Order.find({ status: { $ne: 'CANCELLED' } }).sort({ createdAt: -1 }).lean(),
      CustomerProfile.find().lean(),
      getActivePolicy()
    ]);

    const profileMap = new Map();
    savedProfiles.forEach(p => profileMap.set(p.normalizedPhone, p));

    const grouped = new Map();
    for (const order of activeOrders) {
      const key = normalizePhone(order.customerPhone) || String(order.customerName || '').trim().toLowerCase();
      if (!key) continue;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(order);
    }

    let customers = [];
    for (const [key, ordersForCustomer] of grouped.entries()) {
      const saved = profileMap.get(key) || null;
      customers.push(buildVipSummaryForOrders(ordersForCustomer, saved, policy));
    }

    customers.sort((a, b) => (b.orderCount - a.orderCount) || (b.totalSpent - a.totalSpent));

    const distribution = {
      VIP_DIAMOND: customers.filter(c => c.vipTier === 'VIP_DIAMOND').length,
      VIP_GOLD: customers.filter(c => c.vipTier === 'VIP_GOLD').length,
      VIP_SILVER: customers.filter(c => c.vipTier === 'VIP_SILVER').length,
      STANDARD: customers.filter(c => c.vipTier === 'STANDARD').length,
      totalCustomers: customers.length,
      totalVipSavings: customers.reduce((s, c) => s + c.totalVipSavings, 0)
    };

    if (tier && tier !== 'ALL') {
      customers = customers.filter(c => c.vipTier === tier);
    }
    if (channel === 'B2B' || channel === 'B2C') {
      customers = customers.filter(c => c.primaryChannel === channel);
    }
    if (search) {
      const q = String(search).trim().toLowerCase();
      customers = customers.filter(c =>
        c.customerName.toLowerCase().includes(q) ||
        c.customerPhone.toLowerCase().includes(q) ||
        c.companyName.toLowerCase().includes(q)
      );
    }

    return res.json({
      distribution,
      policy: {
        standardShippingFee: policy.standardShippingFee,
        shippingBaseCost: policy.shippingBaseCost,
        vipTiers: policy.vipTiers
      },
      customers
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getCustomerDetail(req, res) {
  try {
    const normPhone = normalizePhone(req.params.phone);
    if (!normPhone) {
      return res.status(400).json({ error: 'Số điện thoại không hợp lệ' });
    }

    const [allOrders, savedProfile, policy] = await Promise.all([
      Order.find().sort({ createdAt: -1 }).lean(),
      CustomerProfile.findOne({ normalizedPhone: normPhone }).lean(),
      getActivePolicy()
    ]);

    const customerOrders = allOrders.filter(o => normalizePhone(o.customerPhone) === normPhone);
    if (customerOrders.length === 0 && !savedProfile) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng / đại diện này' });
    }

    const activeOrders = customerOrders.filter(o => o.status !== 'CANCELLED');
    const summary = buildVipSummaryForOrders(activeOrders, savedProfile, policy);

    return res.json({
      profile: summary,
      orders: customerOrders.map(o => sanitizeOrderForRole(o, req.user.role))
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function updateCustomerProfile(req, res) {
  try {
    const normPhone = normalizePhone(req.params.phone);
    if (!normPhone) {
      return res.status(400).json({ error: 'Số điện thoại không hợp lệ' });
    }

    const { customerName, companyName, defaultAddress, defaultChannel, notes } = req.body || {};
    const existing = await CustomerProfile.findOne({ normalizedPhone: normPhone });
    const before = existing ? existing.toObject() : null;

    const updateDoc = {
      normalizedPhone: normPhone,
      phoneDisplay: req.params.phone
    };
    if (customerName !== undefined) updateDoc.customerName = String(customerName).trim();
    if (companyName !== undefined) updateDoc.companyName = String(companyName).trim();
    if (defaultAddress !== undefined) updateDoc.defaultAddress = String(defaultAddress).trim();
    if (defaultChannel === 'B2B' || defaultChannel === 'B2C') updateDoc.defaultChannel = defaultChannel;
    if (notes !== undefined) updateDoc.notes = String(notes).trim();

    const saved = await CustomerProfile.findOneAndUpdate(
      { normalizedPhone: normPhone },
      { $set: updateDoc },
      { upsert: true, new: true }
    );

    await recordAudit(req, {
      action: 'CUSTOMER_PROFILE_UPDATE',
      entity: 'CustomerProfile',
      entityId: normPhone,
      summary: `Cập nhật hồ sơ đại diện ${saved.customerName || normPhone}`,
      before,
      after: saved.toObject()
    });

    return res.json(saved);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listVipCustomers,
  getCustomerDetail,
  updateCustomerProfile
};
