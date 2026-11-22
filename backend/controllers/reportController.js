const Order = require('../models/Order');
const Product = require('../models/Product');
const { PERMISSIONS, hasPermission } = require('../config/rbac');
const { pad2, getZonedParts, daysInMonth } = require('../dateUtils');
const { buildCsv } = require('../services/csvService');

function computeOrderRevenue(order) {
  const subtotal = (order.items || []).reduce(
    (sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 0),
    0
  );
  return Math.max(0, subtotal - (order.vipProductDiscount || 0)) + (order.shippingFee || 0);
}

function computeOrderCost(order, catalogByName) {
  const goodsCost = (order.items || []).reduce((sum, item) => {
    const unitImport = item.importPrice > 0
      ? item.importPrice
      : (catalogByName.get(String(item.productName || '').toLowerCase()) || Math.round((item.unitPrice || 0) * 0.7));
    return sum + unitImport * (item.quantity || 0);
  }, 0);
  const shipCost = (order.shippingFee || 0) > 0 ? (order.shippingCost ?? 15000) : 0;
  return goodsCost + shipCost;
}

function extractOrderZonedDay(order) {
  if (order.createdAt) {
    const d = new Date(order.createdAt);
    if (!Number.isNaN(d.getTime())) {
      const parts = getZonedParts(d);
      return { year: parts.year, month: parts.month, day: parts.day };
    }
  }
  const match = typeof order.timeAgo === 'string'
    ? order.timeAgo.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    : null;
  if (match) {
    return {
      day: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
      year: parseInt(match[3], 10)
    };
  }
  return null;
}

function dayKey(d) {
  return `${d.year}-${pad2(d.month)}-${pad2(d.day)}`;
}

function parseIsoDay(str) {
  const match = String(str || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    day: parseInt(match[3], 10)
  };
}

function offsetDayFrom(baseDay, deltaDays) {
  const dt = new Date(Date.UTC(baseDay.year, baseDay.month - 1, baseDay.day + deltaDays));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate()
  };
}

function offsetMonthFrom(baseDay, deltaMonths) {
  const dt = new Date(Date.UTC(baseDay.year, baseDay.month - 1 + deltaMonths, 1));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1
  };
}

function buildChannelSummary(orders, catalogByName, canSeeProfit, totalRevenue) {
  const revenue = orders.reduce((s, o) => s + computeOrderRevenue(o), 0);
  const cost = orders.reduce((s, o) => s + computeOrderCost(o, catalogByName), 0);
  const profit = revenue - cost;
  const sharePercent = totalRevenue > 0 ? Math.round((revenue * 100) / totalRevenue) : 0;
  const avgOrderValue = orders.length > 0 ? Math.round(revenue / orders.length) : 0;

  const base = {
    orderCount: orders.length,
    revenue,
    sharePercent,
    avgOrderValue
  };
  if (canSeeProfit) {
    base.cost = cost;
    base.profit = profit;
    base.profitMarginPercent = revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0;
  }
  return base;
}

async function computeIncomeReport({ period = 'MONTH', metric = 'REVENUE', from, to, canSeeProfit }) {
  const [deliveredOrders, products] = await Promise.all([
    Order.find({ status: 'DELIVERED' }).sort({ createdAt: -1 }).lean(),
    Product.find({}, { name: 1, importPrice: 1 }).lean()
  ]);

  const catalogByName = new Map();
  products.forEach(p => {
    if (p.name && p.importPrice > 0) {
      catalogByName.set(String(p.name).toLowerCase(), p.importPrice);
    }
  });

  const nowParts = getZonedParts(new Date());
  const today = { year: nowParts.year, month: nowParts.month, day: nowParts.day };

  const datedOrders = deliveredOrders
    .map(order => ({ order, day: extractOrderZonedDay(order) }))
    .filter(x => x.day !== null);

  let periodOrders = [];
  let buckets = [];
  let periodLabel = '';

  const normalizedPeriod = String(period || 'MONTH').toUpperCase();
  if (normalizedPeriod === 'WEEK') {
    const days = [-6, -5, -4, -3, -2, -1, 0].map(offset => offsetDayFrom(today, offset));
    const keySet = new Set(days.map(dayKey));
    const inWeek = datedOrders.filter(x => keySet.has(dayKey(x.day)));
    periodOrders = inWeek.map(x => x.order);
    buckets = days.map(d => {
      const k = dayKey(d);
      const matching = inWeek.filter(x => dayKey(x.day) === k).map(x => x.order);
      return { label: `${pad2(d.day)}/${pad2(d.month)}`, orders: matching };
    });
    periodLabel = `${buckets[0].label} - ${buckets[buckets.length - 1].label}`;
  } else if (normalizedPeriod === 'YEAR') {
    const months = [-5, -4, -3, -2, -1, 0].map(offset => offsetMonthFrom(today, offset));
    const ymSet = new Set(months.map(m => `${m.year}-${m.month}`));
    const inRange = datedOrders.filter(x => ymSet.has(`${x.day.year}-${x.day.month}`));
    periodOrders = inRange.map(x => x.order);
    buckets = months.map(m => {
      const matching = inRange.filter(x => x.day.year === m.year && x.day.month === m.month).map(x => x.order);
      return { label: `T${m.month}/${m.year}`, orders: matching };
    });
    periodLabel = `${pad2(months[0].month)}/${months[0].year} - ${pad2(today.month)}/${today.year}`;
  } else if (normalizedPeriod === 'CUSTOM' && parseIsoDay(from) && parseIsoDay(to)) {
    const fromDay = parseIsoDay(from);
    const toDay = parseIsoDay(to);
    const fromKey = dayKey(fromDay);
    const toKey = dayKey(toDay);
    const inRange = datedOrders.filter(x => {
      const k = dayKey(x.day);
      return k >= fromKey && k <= toKey;
    });
    periodOrders = inRange.map(x => x.order);

    // Build daily buckets capped at 60 days
    const startUtc = Date.UTC(fromDay.year, fromDay.month - 1, fromDay.day);
    const endUtc = Date.UTC(toDay.year, toDay.month - 1, toDay.day);
    const spanDays = Math.min(60, Math.max(0, Math.round((endUtc - startUtc) / 86_400_000)));
    for (let i = 0; i <= spanDays; i++) {
      const d = offsetDayFrom(fromDay, i);
      const k = dayKey(d);
      const matching = inRange.filter(x => dayKey(x.day) === k).map(x => x.order);
      buckets.push({ label: `${pad2(d.day)}/${pad2(d.month)}`, orders: matching });
    }
    periodLabel = `${from} → ${to}`;
  } else {
    // Default: MONTH
    const totalDays = daysInMonth(today.year, today.month);
    const mm = pad2(today.month);
    const inMonth = datedOrders.filter(x => x.day.year === today.year && x.day.month === today.month);
    periodOrders = inMonth.map(x => x.order);
    for (let start = 1; start <= totalDays; start += 7) {
      const end = Math.min(start + 6, totalDays);
      const matching = inMonth.filter(x => x.day.day >= start && x.day.day <= end).map(x => x.order);
      buckets.push({ label: `${pad2(start)}-${pad2(end)}/${mm}`, orders: matching });
    }
    periodLabel = `Tháng ${mm}/${today.year}`;
  }

  const totalRevenue = periodOrders.reduce((s, o) => s + computeOrderRevenue(o), 0);
  const totalCost = periodOrders.reduce((s, o) => s + computeOrderCost(o, catalogByName), 0);
  const totalProfit = totalRevenue - totalCost;
  const profitMarginPercent = totalRevenue > 0 ? Number(((totalProfit / totalRevenue) * 100).toFixed(1)) : 0;

  const codRevenue = periodOrders
    .filter(o => o.paymentType === 'COD')
    .reduce((s, o) => s + computeOrderRevenue(o), 0);
  const bankRevenue = periodOrders
    .filter(o => o.paymentType === 'BANK')
    .reduce((s, o) => s + computeOrderRevenue(o), 0);
  const walletRevenue = periodOrders
    .filter(o => o.paymentType === 'WALLET')
    .reduce((s, o) => s + computeOrderRevenue(o), 0);

  const b2bOrders = periodOrders.filter(o => o.salesChannel === 'B2B');
  const b2cOrders = periodOrders.filter(o => o.salesChannel !== 'B2B');
  const b2bSummary = buildChannelSummary(b2bOrders, catalogByName, canSeeProfit, totalRevenue);
  const b2cSummary = buildChannelSummary(b2cOrders, catalogByName, canSeeProfit, totalRevenue);
  if (totalRevenue > 0) {
    b2cSummary.sharePercent = Math.max(0, 100 - b2bSummary.sharePercent);
  }

  const totalVipSavings = periodOrders.reduce(
    (s, o) => s + (o.vipProductDiscount || 0) + (o.shippingDiscount || 0),
    0
  );

  const series = buckets.map(b => {
    const rev = b.orders.reduce((s, o) => s + computeOrderRevenue(o), 0);
    const point = {
      label: b.label,
      orderCount: b.orders.length,
      revenue: rev
    };
    if (canSeeProfit) {
      const cost = b.orders.reduce((s, o) => s + computeOrderCost(o, catalogByName), 0);
      point.cost = cost;
      point.profit = rev - cost;
    }
    return point;
  });

  const summary = {
    deliveredOrders: periodOrders.length,
    totalRevenue,
    codRevenue,
    bankRevenue,
    walletRevenue,
    totalVipSavings
  };
  if (canSeeProfit) {
    summary.totalCost = totalCost;
    summary.totalProfit = totalProfit;
    summary.profitMarginPercent = profitMarginPercent;
  }

  return {
    period: normalizedPeriod,
    metric: String(metric || 'REVENUE').toUpperCase(),
    periodLabel,
    canViewProfit: canSeeProfit,
    summary,
    channels: {
      B2B: { symbol: '🏢', label: 'Doanh nghiệp (B2B)', ...b2bSummary },
      B2C: { symbol: '🛍️', label: 'Bán lẻ (B2C)', ...b2cSummary }
    },
    series
  };
}

async function getIncomeReport(req, res) {
  try {
    const { period = 'MONTH', metric = 'REVENUE', from, to } = req.query;
    const canSeeProfit = hasPermission(req.user.role, PERMISSIONS.REPORTS_VIEW_PROFIT);

    if (String(metric).toUpperCase() === 'PROFIT' && !canSeeProfit) {
      return res.status(403).json({
        code: 'FORBIDDEN_PROFIT_REPORT',
        error: 'Vai trò của bạn không có quyền xem báo cáo lợi nhuận và giá vốn'
      });
    }

    const report = await computeIncomeReport({ period, metric, from, to, canSeeProfit });
    return res.json(report);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getChannelReport(req, res) {
  try {
    const { period = 'MONTH', from, to } = req.query;
    const canSeeProfit = hasPermission(req.user.role, PERMISSIONS.REPORTS_VIEW_PROFIT);
    const report = await computeIncomeReport({ period, metric: 'REVENUE', from, to, canSeeProfit });
    return res.json({
      period: report.period,
      periodLabel: report.periodLabel,
      canViewProfit: canSeeProfit,
      totalRevenue: report.summary.totalRevenue,
      totalVipSavings: report.summary.totalVipSavings,
      channels: report.channels
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getTopProductsReport(req, res) {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const canSeeProfit = hasPermission(req.user.role, PERMISSIONS.REPORTS_VIEW_PROFIT);
    const products = await Product.find().sort({ soldCount: -1 }).lean();

    const topProducts = products.slice(0, limit).map(p => {
      const estRevenue = (p.price || 0) * (p.soldCount || 0);
      const row = {
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        price: p.price,
        stock: p.stock,
        soldCount: p.soldCount,
        isDemoProduct: Boolean(p.isDemoProduct),
        isTradeLocked: (p.stock || 0) <= 0,
        estimatedRevenue: estRevenue
      };
      if (canSeeProfit) {
        const importPrice = p.importPrice > 0 ? p.importPrice : Math.round((p.price || 0) * 0.7);
        const unitProfit = (p.price || 0) - importPrice;
        row.importPrice = importPrice;
        row.unitProfit = unitProfit;
        row.estimatedProfit = unitProfit * (p.soldCount || 0);
      }
      return row;
    });

    const lockedProducts = products
      .filter(p => (p.stock || 0) <= 0)
      .map(p => ({ id: p.id, sku: p.sku, name: p.name, stock: p.stock }));

    const lowStockProducts = products
      .filter(p => p.stock > 0 && p.stock <= 10)
      .map(p => ({ id: p.id, sku: p.sku, name: p.name, stock: p.stock }));

    return res.json({
      canViewProfit: canSeeProfit,
      topProducts,
      inventoryAlerts: {
        lockedCount: lockedProducts.length,
        lowStockCount: lowStockProducts.length,
        lockedProducts,
        lowStockProducts
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function exportIncomeReportCsv(req, res) {
  try {
    const { period = 'MONTH', from, to } = req.query;
    const canSeeProfit = hasPermission(req.user.role, PERMISSIONS.REPORTS_VIEW_PROFIT);
    const report = await computeIncomeReport({ period, metric: 'REVENUE', from, to, canSeeProfit });

    const headers = canSeeProfit
      ? ['Mốc thời gian', 'Số đơn hoàn tất', 'Doanh thu (VNĐ)', 'Giá vốn & Ship (VNĐ)', 'Lợi nhuận ròng (VNĐ)']
      : ['Mốc thời gian', 'Số đơn hoàn tất', 'Doanh thu (VNĐ)'];

    const rows = report.series.map(pt => (
      canSeeProfit
        ? [pt.label, pt.orderCount, pt.revenue, pt.cost, pt.profit]
        : [pt.label, pt.orderCount, pt.revenue]
    ));

    rows.push(
      canSeeProfit
        ? ['TỔNG CỘNG', report.summary.deliveredOrders, report.summary.totalRevenue, report.summary.totalCost, report.summary.totalProfit]
        : ['TỔNG CỘNG', report.summary.deliveredOrders, report.summary.totalRevenue]
    );

    const csv = buildCsv(headers, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="viendong-income-${report.period.toLowerCase()}.csv"`);
    return res.send(csv);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  computeOrderRevenue,
  computeOrderCost,
  getIncomeReport,
  getChannelReport,
  getTopProductsReport,
  exportIncomeReportCsv
};
