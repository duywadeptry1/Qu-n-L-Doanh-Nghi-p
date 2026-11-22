const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const AuditLog = require('../models/AuditLog');
const PolicySetting = require('../models/PolicySetting');
const {
  syncTransactionsFromOrders,
  syncNotificationsFromRealData,
  syncMonthlyCalendarFromOrders
} = require('../seedData');
const { invalidatePolicyCache } = require('../services/policyService');
const { recordAudit } = require('../services/auditService');

async function getTransactions(req, res) {
  try {
    await syncTransactionsFromOrders();
    const { type } = req.query;
    const query = {};
    if (type && type !== 'ALL') {
      query.paymentType = type;
    }
    const transactions = await Transaction.find(query).sort({ createdAt: -1 });
    return res.json(transactions);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getNotifications(_req, res) {
  try {
    const notifications = await syncNotificationsFromRealData();
    return res.json(notifications);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getCalendar(_req, res) {
  try {
    const days = await syncMonthlyCalendarFromOrders();
    return res.json(days);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getDashboardKpis(_req, res) {
  try {
    const orders = await Order.find();
    const placed = orders.filter(o => o.status === 'PLACED').length;
    const preparing = orders.filter(o => o.status === 'PREPARING').length;
    const delivering = orders.filter(o => o.status === 'DELIVERING').length;
    const delivered = orders.filter(o => o.status === 'DELIVERED').length;
    const cancelled = orders.filter(o => o.status === 'CANCELLED').length;

    return res.json({
      placedCount: placed,
      preparingCount: preparing,
      deliveringCount: delivering,
      deliveredCount: delivered,
      cancelledCount: cancelled
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function listAuditLogs(req, res) {
  try {
    const { entity, action, actorRole } = req.query;
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const query = {};
    if (entity) query.entity = entity;
    if (action) query.action = action;
    if (actorRole) query.actorRole = actorRole;

    const logs = await AuditLog.find(query).sort({ createdAt: -1 }).limit(limit);
    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getPolicySetting(_req, res) {
  try {
    let policy = await PolicySetting.findOne({ key: 'default' });
    if (!policy) {
      policy = await PolicySetting.create({ key: 'default' });
    }
    return res.json(policy);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function updatePolicySetting(req, res) {
  try {
    let policy = await PolicySetting.findOne({ key: 'default' });
    if (!policy) {
      policy = new PolicySetting({ key: 'default' });
    }
    const before = policy.toObject();

    const { standardShippingFee, shippingBaseCost, lowStockThreshold, vipTiers } = req.body || {};
    if (Number.isFinite(Number(standardShippingFee)) && Number(standardShippingFee) >= 0) {
      policy.standardShippingFee = Math.round(Number(standardShippingFee));
    }
    if (Number.isFinite(Number(shippingBaseCost)) && Number(shippingBaseCost) >= 0) {
      policy.shippingBaseCost = Math.round(Number(shippingBaseCost));
    }
    if (policy.shippingBaseCost > policy.standardShippingFee) {
      return res.status(400).json({
        error: 'Giá vốn ship (shippingBaseCost) không được lớn hơn phí ship tiêu chuẩn'
      });
    }
    if (Number.isFinite(Number(lowStockThreshold)) && Number(lowStockThreshold) >= 0) {
      policy.lowStockThreshold = Math.round(Number(lowStockThreshold));
    }
    if (vipTiers && typeof vipTiers === 'object') {
      Object.keys(policy.vipTiers.toObject ? policy.vipTiers.toObject() : policy.vipTiers).forEach(k => {
        if (vipTiers[k] !== undefined && Number.isFinite(Number(vipTiers[k])) && Number(vipTiers[k]) >= 0) {
          policy.vipTiers[k] = Math.round(Number(vipTiers[k]));
        }
      });
    }

    await policy.save();
    invalidatePolicyCache();
    await recordAudit(req, {
      action: 'POLICY_UPDATE',
      entity: 'PolicySetting',
      entityId: 'default',
      summary: 'Cập nhật chính sách VIP & phí vận chuyển',
      before,
      after: policy.toObject()
    });

    return res.json(policy);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getTransactions,
  getNotifications,
  getCalendar,
  getDashboardKpis,
  listAuditLogs,
  getPolicySetting,
  updatePolicySetting
};
