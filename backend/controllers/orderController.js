const Product = require('../models/Product');
const Order = require('../models/Order');
const {
  PERMISSIONS,
  hasPermission,
  canViewCostAndProfit,
  canTransitionOrderStatus
} = require('../config/rbac');
const { sanitizeOrderForRole } = require('../middlewares/fieldMask');
const {
  syncTransactionsFromOrders,
  syncNotificationsFromRealData,
  syncMonthlyCalendarFromOrders
} = require('../seedData');
const { formatOrderTimeLabel } = require('../dateUtils');
const { getActivePolicy, calculateDynamicVipPricing } = require('../services/policyService');
const { recordAudit, recordStockLog } = require('../services/auditService');
const { buildCsv } = require('../services/csvService');
const { escapeRegex, normalizePhone } = require('../services/helpers');

async function getNextOrderId() {
  const existing = await Order.find({}, { id: 1 }).lean();
  let maxNum = 9821;
  for (const item of existing) {
    const match = typeof item.id === 'string' ? item.id.match(/^DH-(\d+)$/) : null;
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `DH-${maxNum + 1}`;
}

function isPartnerOwnOrderOnly(user) {
  return !hasPermission(user.role, PERMISSIONS.ORDERS_READ) &&
    hasPermission(user.role, PERMISSIONS.ORDERS_READ_OWN);
}

function buildOrderQuery(queryParams = {}) {
  const { filter, search, channel, vipTier, from, to } = queryParams;
  const query = {};
  if (filter && filter !== 'ALL') {
    query.status = filter;
  }
  if (channel === 'B2B' || channel === 'B2C') {
    query.salesChannel = channel;
  }
  if (vipTier && vipTier !== 'ALL') {
    query.vipTierAtPurchase = vipTier;
  }
  if (from || to) {
    query.createdAt = {};
    if (from) {
      const dFrom = new Date(`${from}T00:00:00+07:00`);
      if (!Number.isNaN(dFrom.getTime())) query.createdAt.$gte = dFrom;
    }
    if (to) {
      const dTo = new Date(`${to}T23:59:59.999+07:00`);
      if (!Number.isNaN(dTo.getTime())) query.createdAt.$lte = dTo;
    }
    if (Object.keys(query.createdAt).length === 0) delete query.createdAt;
  }
  if (search) {
    const pattern = escapeRegex(search);
    query.$or = [
      { id: { $regex: pattern, $options: 'i' } },
      { customerName: { $regex: pattern, $options: 'i' } },
      { customerPhone: { $regex: pattern, $options: 'i' } },
      { address: { $regex: pattern, $options: 'i' } }
    ];
  }
  return query;
}

async function countPriorActiveOrders(customerPhone) {
  const normalizedPhone = normalizePhone(customerPhone);
  if (!normalizedPhone) return 0;
  const priorOrders = await Order.find({ status: { $ne: 'CANCELLED' } }, { customerPhone: 1 }).lean();
  return priorOrders.filter(o => normalizePhone(o.customerPhone) === normalizedPhone).length;
}

async function listOrders(req, res) {
  try {
    const query = buildOrderQuery(req.query);
    const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;
    const partnerOnly = isPartnerOwnOrderOnly(req.user);

    let orders = await Order.find(query).sort({ createdAt: -1 });
    if (partnerOnly) {
      const ownPhone = normalizePhone(req.user.phone);
      orders = orders.filter(o => ownPhone && normalizePhone(o.customerPhone) === ownPhone);
    }

    const sanitized = orders.map(o => sanitizeOrderForRole(o, req.user.role));
    if (!isPaginated) {
      return res.json(sanitized);
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const total = sanitized.length;
    const start = (page - 1) * limit;

    return res.json({
      items: sanitized.slice(start, start + limit),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getOrderById(req, res) {
  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (isPartnerOwnOrderOnly(req.user)) {
      const ownPhone = normalizePhone(req.user.phone);
      if (!ownPhone || normalizePhone(order.customerPhone) !== ownPhone) {
        return res.status(403).json({
          code: 'FORBIDDEN',
          error: 'Bạn chỉ có quyền xem đơn hàng của chính mình'
        });
      }
    }

    return res.json(sanitizeOrderForRole(order, req.user.role));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Non-mutating order preview for Web Portal / App:
 * Returns live inventory trade-lock status + dynamic VIP pricing breakdown.
 */
async function previewOrder(req, res) {
  try {
    const { customerPhone = '', productId, quantity = 1, salesChannel = 'B2C' } = req.body || {};
    const product = await Product.findOne({ id: productId }).lean();
    if (!product) {
      return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
    }

    const requestedQty = parseInt(quantity, 10) || 0;
    const availableStock = Math.max(0, product.stock || 0);
    const shortage = Math.max(0, requestedQty - availableStock);
    const isLocked = requestedQty <= 0 || availableStock <= 0 || requestedQty > availableStock;

    let lockMessage = '';
    if (requestedQty <= 0) {
      lockMessage = 'Số lượng đặt hàng phải lớn hơn 0.';
    } else if (availableStock <= 0) {
      lockMessage = `🔒 Đã khóa giao dịch: "${product.name}" đã hết hàng trong kho (tồn: 0). Vui lòng nhập thêm hàng để mở khóa.`;
    } else if (requestedQty > availableStock) {
      lockMessage = `🔒 Đã khóa giao dịch: "${product.name}" chỉ còn ${availableStock} sp trong kho (bạn đặt ${requestedQty}, thiếu ${shortage}).`;
    }

    const [existingOrderCount, policy] = await Promise.all([
      countPriorActiveOrders(customerPhone),
      getActivePolicy()
    ]);

    const itemImportPrice = product.importPrice > 0 ? product.importPrice : Math.round(product.price * 0.7);
    const pricing = calculateDynamicVipPricing({
      unitPrice: product.price,
      importPrice: itemImportPrice,
      quantity: Math.max(1, requestedQty),
      isDemoProduct: Boolean(product.isDemoProduct),
      existingOrderCount,
      policy
    });

    const canSeeCost = canViewCostAndProfit(req.user.role);
    const safePricing = { ...pricing };
    if (!canSeeCost) {
      delete safePricing.totalImportCost;
      delete safePricing.shippingCost;
      delete safePricing.estimatedProfit;
    }

    return res.json({
      salesChannel: salesChannel === 'B2B' ? 'B2B' : 'B2C',
      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        stock: availableStock,
        isDemoProduct: Boolean(product.isDemoProduct)
      },
      tradeLock: {
        isLocked,
        code: isLocked ? 'TRADE_LOCKED_INSUFFICIENT_STOCK' : 'OK',
        availableStock,
        requestedQuantity: requestedQty,
        shortage,
        message: lockMessage
      },
      pricing: safePricing
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getOrderInvoice(req, res) {
  try {
    const order = await Order.findOne({ id: req.params.id }).lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (isPartnerOwnOrderOnly(req.user)) {
      const ownPhone = normalizePhone(req.user.phone);
      if (!ownPhone || normalizePhone(order.customerPhone) !== ownPhone) {
        return res.status(403).json({ error: 'Bạn chỉ có quyền xem hóa đơn của chính mình' });
      }
    }

    const subtotal = (order.items || []).reduce((s, i) => s + (i.unitPrice || 0) * (i.quantity || 0), 0);
    const totalPayment = Math.max(0, subtotal - (order.vipProductDiscount || 0)) + (order.shippingFee || 0);
    const safeOrder = sanitizeOrderForRole(order, req.user.role);

    return res.json({
      invoiceNumber: `INV-${order.id}`,
      issuedAt: order.createdAt || new Date().toISOString(),
      company: {
        name: 'Công Ty TNHH Thương Mại Viễn Đông',
        hotline: '1900 8868',
        address: 'TP. Hồ Chí Minh, Việt Nam'
      },
      customer: {
        name: order.customerName,
        phone: order.customerPhone,
        address: order.address,
        salesChannel: order.salesChannel || 'B2C',
        vipTierAtPurchase: order.vipTierAtPurchase || 'STANDARD'
      },
      order: {
        id: safeOrder.id,
        status: safeOrder.status,
        timeAgo: safeOrder.timeAgo,
        paymentMethodLabel: safeOrder.paymentMethodLabel,
        paymentType: safeOrder.paymentType,
        items: safeOrder.items,
        subtotal,
        vipProductDiscount: safeOrder.vipProductDiscount || 0,
        shippingDiscount: safeOrder.shippingDiscount || 0,
        shippingFee: safeOrder.shippingFee || 0,
        totalPayment
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function exportOrdersCsv(req, res) {
  try {
    const query = buildOrderQuery(req.query);
    let orders = await Order.find(query).sort({ createdAt: -1 }).lean();
    if (isPartnerOwnOrderOnly(req.user)) {
      const ownPhone = normalizePhone(req.user.phone);
      orders = orders.filter(o => ownPhone && normalizePhone(o.customerPhone) === ownPhone);
    }

    const includeCost = canViewCostAndProfit(req.user.role);
    const headers = includeCost
      ? ['Mã đơn', 'Thời gian', 'Kênh', 'Khách hàng', 'SĐT', 'Hạng VIP', 'Trạng thái', 'Sản phẩm', 'Giảm VIP (VNĐ)', 'Phí ship (VNĐ)', 'Tổng thu (VNĐ)', 'Giá vốn & Ship (VNĐ)', 'Lợi nhuận (VNĐ)']
      : ['Mã đơn', 'Thời gian', 'Kênh', 'Khách hàng', 'SĐT', 'Hạng VIP', 'Trạng thái', 'Sản phẩm', 'Giảm VIP (VNĐ)', 'Phí ship (VNĐ)', 'Tổng thu (VNĐ)'];

    const rows = orders.map(o => {
      const subtotal = (o.items || []).reduce((s, i) => s + (i.unitPrice || 0) * (i.quantity || 0), 0);
      const totalPayment = Math.max(0, subtotal - (o.vipProductDiscount || 0)) + (o.shippingFee || 0);
      const itemsText = (o.items || []).map(i => `${i.productName} x${i.quantity}`).join('; ');
      const vipSavings = (o.vipProductDiscount || 0) + (o.shippingDiscount || 0);

      if (includeCost) {
        const goodsCost = (o.items || []).reduce((s, i) => {
          const imp = i.importPrice > 0 ? i.importPrice : Math.round((i.unitPrice || 0) * 0.7);
          return s + imp * (i.quantity || 0);
        }, 0);
        const totalCost = goodsCost + ((o.shippingFee || 0) > 0 ? (o.shippingCost ?? 15000) : 0);
        const profit = totalPayment - totalCost;
        return [o.id, o.timeAgo, o.salesChannel || 'B2C', o.customerName, o.customerPhone, o.vipTierAtPurchase || 'STANDARD', o.status, itemsText, vipSavings, o.shippingFee || 0, totalPayment, totalCost, profit];
      }
      return [o.id, o.timeAgo, o.salesChannel || 'B2C', o.customerName, o.customerPhone, o.vipTierAtPurchase || 'STANDARD', o.status, itemsText, vipSavings, o.shippingFee || 0, totalPayment];
    });

    const csv = buildCsv(headers, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="viendong-orders.csv"');
    return res.send(csv);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function createOrder(req, res) {
  let reservedProductId = null;
  let reservedQty = 0;
  try {
    const {
      customerName,
      customerPhone,
      address,
      productId,
      quantity,
      paymentType,
      salesChannel
    } = req.body;

    const qty = parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty < 1) {
      return res.status(400).json({ error: 'Số lượng đặt hàng phải lớn hơn 0' });
    }

    // Atomically lock & deduct inventory only when stock >= qty (prevents overselling / race conditions)
    const product = await Product.findOneAndUpdate(
      { id: productId, stock: { $gte: qty } },
      { $inc: { stock: -qty, soldCount: qty } },
      { new: true }
    );

    if (!product) {
      const latest = await Product.findOne({ id: productId }).lean();
      if (!latest) {
        return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
      }
      const availableStock = Math.max(0, latest.stock || 0);
      const shortage = Math.max(1, qty - availableStock);
      const reason = availableStock <= 0
        ? `🔒 Đã khóa giao dịch: "${latest.name}" đã hết hàng trong kho (tồn: 0). Vui lòng nhập thêm hàng trước khi tạo đơn.`
        : `🔒 Đã khóa giao dịch: "${latest.name}" chỉ còn ${availableStock} sản phẩm trong kho (cần ${qty}, thiếu ${shortage}).`;
      return res.status(409).json({
        code: 'TRADE_LOCKED_INSUFFICIENT_STOCK',
        tradeLocked: true,
        error: reason,
        productId: latest.id,
        productName: latest.name,
        availableStock,
        requestedQuantity: qty,
        shortage
      });
    }

    reservedProductId = product.id;
    reservedQty = qty;

    const [newId, existingOrderCount, policy] = await Promise.all([
      getNextOrderId(),
      countPriorActiveOrders(customerPhone),
      getActivePolicy()
    ]);

    const channel = salesChannel === 'B2B' ? 'B2B' : 'B2C';
    const itemImportPrice = product.importPrice > 0 ? product.importPrice : Math.round(product.price * 0.7);
    const pricing = calculateDynamicVipPricing({
      unitPrice: product.price,
      importPrice: itemImportPrice,
      quantity: qty,
      isDemoProduct: Boolean(product.isDemoProduct),
      existingOrderCount,
      policy
    });

    const paymentLabel = paymentType === 'COD' ? 'Thanh toán khi nhận hàng (COD)'
      : paymentType === 'BANK' ? 'Chuyển khoản ngân hàng (VCB)'
      : paymentType === 'WALLET' ? 'Ví điện tử MoMo' : 'Thanh toán khi nhận hàng (COD)';

    const now = new Date();
    const newOrder = new Order({
      id: newId,
      timeAgo: formatOrderTimeLabel(now),
      customerName,
      customerPhone,
      address,
      status: 'PLACED',
      salesChannel: channel,
      vipTierAtPurchase: pricing.vipTierAtPurchase,
      vipProductDiscount: pricing.vipProductDiscount,
      shippingDiscount: pricing.shippingDiscount,
      shippingCost: pricing.shippingCost,
      items: [{
        productName: product.name,
        quantity: qty,
        unitPrice: product.price,
        importPrice: itemImportPrice,
        isDemoProduct: Boolean(product.isDemoProduct)
      }],
      shippingFee: pricing.shippingFee,
      paymentMethodLabel: paymentLabel,
      paymentType: paymentType || 'COD',
      createdAt: now
    });

    await newOrder.save();
    reservedProductId = null;

    await recordStockLog(req, {
      productId: product.id,
      productName: product.name,
      delta: -qty,
      previousStock: product.stock + qty,
      newStock: product.stock,
      reason: 'ORDER_SALE',
      orderId: newOrder.id,
      note: `Xuất kho cho đơn #${newOrder.id} (${channel})`
    });
    await recordAudit(req, {
      action: 'ORDER_CREATE',
      entity: 'Order',
      entityId: newOrder.id,
      summary: `Tạo đơn #${newOrder.id} (${channel}, ${pricing.vipTierAtPurchase}) - ${product.name} x${qty}`
    });

    await syncMonthlyCalendarFromOrders();
    await syncNotificationsFromRealData();

    return res.status(201).json(sanitizeOrderForRole(newOrder, req.user.role));
  } catch (err) {
    if (reservedProductId && reservedQty > 0) {
      try {
        await Product.updateOne(
          { id: reservedProductId },
          { $inc: { stock: reservedQty, soldCount: -reservedQty } }
        );
      } catch (rollbackErr) {
        console.error('❌ Failed to rollback stock reservation:', rollbackErr);
      }
    }
    return res.status(500).json({ error: err.message });
  }
}

async function updateOrderStatus(req, res) {
  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const previousStatus = order.status;
    let nextStatus = req.body && req.body.status ? req.body.status : null;
    if (!nextStatus) {
      if (order.status === 'PLACED') nextStatus = 'PREPARING';
      else if (order.status === 'PREPARING') nextStatus = 'DELIVERING';
      else if (order.status === 'DELIVERING') nextStatus = 'DELIVERED';
      else nextStatus = order.status;
    }

    if (!canTransitionOrderStatus(req.user.role, previousStatus, nextStatus)) {
      return res.status(403).json({
        code: 'FORBIDDEN_STATUS_TRANSITION',
        error: `Vai trò ${req.user.role} không có quyền chuyển đơn từ ${previousStatus} sang ${nextStatus}`,
        role: req.user.role,
        from: previousStatus,
        to: nextStatus
      });
    }

    order.status = nextStatus;
    await order.save();

    // Restore inventory if an unshipped order (PLACED / PREPARING) is cancelled
    if (nextStatus === 'CANCELLED' && (previousStatus === 'PLACED' || previousStatus === 'PREPARING')) {
      for (const item of order.items || []) {
        const matchedProduct = await Product.findOne({ name: item.productName });
        if (matchedProduct && item.quantity > 0) {
          const prevStock = matchedProduct.stock;
          matchedProduct.stock += item.quantity;
          matchedProduct.soldCount = Math.max(0, matchedProduct.soldCount - item.quantity);
          await matchedProduct.save();
          await recordStockLog(req, {
            productId: matchedProduct.id,
            productName: matchedProduct.name,
            delta: item.quantity,
            previousStock: prevStock,
            newStock: matchedProduct.stock,
            reason: 'ORDER_CANCEL_RESTORE',
            orderId: order.id,
            note: `Hoàn tồn kho do hủy đơn #${order.id}`
          });
        }
      }
    }

    await recordAudit(req, {
      action: 'ORDER_STATUS_CHANGE',
      entity: 'Order',
      entityId: order.id,
      summary: `Chuyển trạng thái đơn #${order.id}: ${previousStatus} → ${nextStatus}`,
      before: { status: previousStatus },
      after: { status: nextStatus }
    });

    await syncTransactionsFromOrders();
    await syncMonthlyCalendarFromOrders();
    await syncNotificationsFromRealData();

    return res.json(sanitizeOrderForRole(order, req.user.role));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listOrders,
  getOrderById,
  previewOrder,
  getOrderInvoice,
  exportOrdersCsv,
  createOrder,
  updateOrderStatus
};
