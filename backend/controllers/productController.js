const Product = require('../models/Product');
const StockLog = require('../models/StockLog');
const { PERMISSIONS, hasPermission, canViewCostAndProfit } = require('../config/rbac');
const { sanitizeProductForRole } = require('../middlewares/fieldMask');
const { syncNotificationsFromRealData } = require('../seedData');
const { recordAudit, recordStockLog } = require('../services/auditService');
const { buildCsv } = require('../services/csvService');
const { escapeRegex } = require('../services/helpers');

async function getNextProductSequence() {
  const existing = await Product.find({}, { id: 1 }).lean();
  let maxNum = existing.length;
  for (const item of existing) {
    const match = typeof item.id === 'string' ? item.id.match(/^p-(\d+)$/) : null;
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return maxNum + 1;
}

function buildProductQuery(queryParams = {}) {
  const { category, search, stockStatus, isDemo } = queryParams;
  const query = {};
  if (category && category !== 'Tất cả') {
    query.category = category;
  }
  if (isDemo === 'true' || isDemo === 'false') {
    query.isDemoProduct = isDemo === 'true';
  }
  if (stockStatus === 'LOCKED') {
    query.stock = { $lte: 0 };
  } else if (stockStatus === 'LOW') {
    query.stock = { $gt: 0, $lte: 10 };
  } else if (stockStatus === 'IN_STOCK') {
    query.stock = { $gt: 0 };
  }
  if (search) {
    const pattern = escapeRegex(search);
    query.$or = [
      { name: { $regex: pattern, $options: 'i' } },
      { sku: { $regex: pattern, $options: 'i' } }
    ];
  }
  return query;
}

function resolveProductSort(sortParam) {
  switch (sortParam) {
    case 'stock_asc': return { stock: 1, createdAt: -1 };
    case 'stock_desc': return { stock: -1, createdAt: -1 };
    case 'price_asc': return { price: 1 };
    case 'price_desc': return { price: -1 };
    case 'sold_desc': return { soldCount: -1 };
    default: return { createdAt: -1 };
  }
}

async function listProducts(req, res) {
  try {
    const query = buildProductQuery(req.query);
    const sortSpec = resolveProductSort(req.query.sort);
    const role = req.user.role;
    const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;

    if (!isPaginated) {
      const products = await Product.find(query).sort(sortSpec);
      return res.json(products.map(p => sanitizeProductForRole(p, role)));
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [items, total, allForSummary] = await Promise.all([
      Product.find(query).sort(sortSpec).skip(skip).limit(limit),
      Product.countDocuments(query),
      Product.find({}, { stock: 1, isDemoProduct: 1 }).lean()
    ]);

    return res.json({
      items: items.map(p => sanitizeProductForRole(p, role)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      },
      summary: {
        totalProducts: allForSummary.length,
        totalStock: allForSummary.reduce((sum, p) => sum + (p.stock || 0), 0),
        lockedCount: allForSummary.filter(p => (p.stock || 0) <= 0).length,
        lowStockCount: allForSummary.filter(p => p.stock > 0 && p.stock <= 10).length,
        demoCount: allForSummary.filter(p => Boolean(p.isDemoProduct)).length
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function exportProductsCsv(req, res) {
  try {
    const query = buildProductQuery(req.query);
    const products = await Product.find(query).sort(resolveProductSort(req.query.sort)).lean();
    const includeCost = canViewCostAndProfit(req.user.role);

    const headers = includeCost
      ? ['SKU', 'Tên sản phẩm', 'Danh mục', 'SP Demo', 'Giá nhập (VNĐ)', 'Giá xuất (VNĐ)', 'Lãi/SP (VNĐ)', 'Tồn kho', 'Trạng thái GD', 'Đã bán']
      : ['SKU', 'Tên sản phẩm', 'Danh mục', 'SP Demo', 'Giá xuất (VNĐ)', 'Tồn kho', 'Trạng thái GD', 'Đã bán'];

    const rows = products.map(p => {
      const lockLabel = (p.stock || 0) <= 0 ? 'KHÓA GIAO DỊCH (HẾT HÀNG)' : (p.stock <= 10 ? 'SẮP HẾT' : 'CÒN HÀNG');
      const demoLabel = p.isDemoProduct ? 'Có (VIP)' : 'Không';
      if (includeCost) {
        const importPrice = p.importPrice > 0 ? p.importPrice : Math.round((p.price || 0) * 0.7);
        const unitProfit = (p.price || 0) - importPrice;
        return [p.sku, p.name, p.category, demoLabel, importPrice, p.price, unitProfit, p.stock, lockLabel, p.soldCount];
      }
      return [p.sku, p.name, p.category, demoLabel, p.price, p.stock, lockLabel, p.soldCount];
    });

    const csv = buildCsv(headers, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="viendong-products.csv"');
    return res.send(csv);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function listLockedProducts(req, res) {
  try {
    const locked = await Product.find({ stock: { $lte: 0 } }).sort({ updatedAt: -1 });
    const role = req.user.role;
    return res.json(locked.map(p => sanitizeProductForRole(p, role)));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function listStockLogs(req, res) {
  try {
    const logs = await StockLog.find({ productId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function createProduct(req, res) {
  try {
    const {
      sku: customSku,
      name,
      category,
      importPrice,
      price,
      exportPrice,
      stock,
      isDemoProduct,
      description,
      imageUrl,
      imageResName: customImageRes
    } = req.body;

    const seq = await getNextProductSequence();
    const newId = `p-${seq}`;
    const nextSku = (customSku && String(customSku).trim())
      ? String(customSku).trim()
      : `VD-SP${String(seq).padStart(2, '0')}`;
    const finalCategory = (category && String(category).trim())
      ? String(category).trim()
      : 'Thiết bị điện tử';
    const defaultRes = finalCategory === 'Thời trang'
      ? 'img_product_tshirt'
      : 'img_product_electronics';
    const imageResName = customImageRes || defaultRes;
    const finalExportPrice = Number(exportPrice !== undefined ? exportPrice : price) || 0;
    const parsedImport = Number(importPrice);
    const finalImportPrice = Number.isFinite(parsedImport) && parsedImport >= 0
      ? Math.round(parsedImport)
      : Math.round(finalExportPrice * 0.7);
    const finalStock = Math.max(0, parseInt(stock, 10) || 0);

    const newProduct = new Product({
      id: newId,
      sku: nextSku,
      name,
      category: finalCategory,
      importPrice: finalImportPrice,
      price: Math.round(finalExportPrice),
      stock: finalStock,
      soldCount: 0,
      isDemoProduct: Boolean(isDemoProduct),
      description: description || '',
      imageUrl: imageUrl || '',
      imageResName
    });

    await newProduct.save();
    await recordStockLog(req, {
      productId: newProduct.id,
      productName: newProduct.name,
      delta: finalStock,
      previousStock: 0,
      newStock: finalStock,
      reason: 'INITIAL_CREATE',
      note: 'Tạo sản phẩm mới'
    });
    await recordAudit(req, {
      action: 'PRODUCT_CREATE',
      entity: 'Product',
      entityId: newProduct.id,
      summary: `Thêm sản phẩm ${newProduct.name} (Xuất: ${newProduct.price}, Nhập: ${newProduct.importPrice}, Tồn: ${newProduct.stock})`,
      after: { id: newProduct.id, sku: newProduct.sku, name: newProduct.name, price: newProduct.price, importPrice: newProduct.importPrice, stock: newProduct.stock }
    });
    await syncNotificationsFromRealData();

    return res.status(201).json(sanitizeProductForRole(newProduct, req.user.role));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function bulkCreateProducts(req, res) {
  try {
    const rawItems = Array.isArray(req.body) ? req.body : req.body?.products;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ error: 'Danh sách sản phẩm trống hoặc không hợp lệ' });
    }

    const canSetCost = hasPermission(req.user.role, PERMISSIONS.PRODUCTS_UPDATE_COST);
    let seq = await getNextProductSequence();
    const docsToInsert = [];
    const errors = [];

    rawItems.forEach((item, index) => {
      const rowNum = index + 1;
      const name = item?.name ? String(item.name).trim() : '';
      const price = Number(item?.price);
      const parsedStock = parseInt(item?.stock, 10);
      const stock = Number.isFinite(parsedStock) && parsedStock >= 0 ? parsedStock : 10;
      const category = item?.category && String(item.category).trim()
        ? String(item.category).trim()
        : 'Thiết bị điện tử';

      if (!name || !Number.isFinite(price) || price <= 0) {
        errors.push({
          row: rowNum,
          name: name || `Dòng ${rowNum}`,
          reason: !name ? 'Thiếu tên sản phẩm' : 'Giá bán phải lớn hơn 0'
        });
        return;
      }

      const id = `p-${seq}`;
      const sku = item?.sku && String(item.sku).trim()
        ? String(item.sku).trim()
        : `VD-SP${String(seq).padStart(2, '0')}`;
      seq++;

      const defaultRes = category === 'Thời trang' ? 'img_product_tshirt' : 'img_product_electronics';
      const parsedImport = Number(item?.importPrice);
      const finalImportPrice = canSetCost && Number.isFinite(parsedImport) && parsedImport > 0
        ? Math.round(parsedImport)
        : Math.round(price * 0.7);

      docsToInsert.push({
        id,
        sku,
        name,
        category,
        importPrice: finalImportPrice,
        price: Math.round(price),
        stock,
        soldCount: 0,
        isDemoProduct: Boolean(item?.isDemoProduct),
        description: item?.description ? String(item.description).trim() : '',
        imageUrl: item?.imageUrl ? String(item.imageUrl).trim() : '',
        imageResName: item?.imageResName || defaultRes
      });
    });

    if (docsToInsert.length === 0) {
      return res.status(400).json({
        error: 'Không có sản phẩm hợp lệ nào để lưu',
        insertedCount: 0,
        skippedCount: errors.length,
        errors,
        products: []
      });
    }

    const inserted = await Product.insertMany(docsToInsert, { ordered: false });
    await recordAudit(req, {
      action: 'PRODUCT_BULK_IMPORT',
      entity: 'Product',
      entityId: `${inserted.length}-items`,
      summary: `Nhập hàng loạt ${inserted.length} sản phẩm (bỏ qua ${errors.length})`
    });
    await syncNotificationsFromRealData();
    console.log(`📦 Đã nhập hàng loạt ${inserted.length} sản phẩm vào MongoDB`);

    return res.status(201).json({
      insertedCount: inserted.length,
      skippedCount: errors.length,
      errors,
      products: inserted.map(p => sanitizeProductForRole(p, req.user.role))
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function updateProduct(req, res) {
  try {
    const {
      name,
      category,
      importPrice,
      price,
      exportPrice,
      stock,
      isDemoProduct,
      description,
      imageUrl
    } = req.body;

    if (importPrice !== undefined && !hasPermission(req.user.role, PERMISSIONS.PRODUCTS_UPDATE_COST)) {
      return res.status(403).json({
        code: 'FORBIDDEN_COST_UPDATE',
        error: 'Bạn không có quyền chỉnh sửa giá nhập sản phẩm'
      });
    }

    const product = await Product.findOne({ id: req.params.id });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const before = {
      name: product.name,
      importPrice: product.importPrice,
      price: product.price,
      stock: product.stock,
      isDemoProduct: product.isDemoProduct
    };
    const previousStock = product.stock;

    if (name !== undefined) product.name = name;
    if (category !== undefined) product.category = category;
    if (importPrice !== undefined) {
      const parsedImport = Number(importPrice);
      if (Number.isFinite(parsedImport) && parsedImport >= 0) {
        product.importPrice = Math.round(parsedImport);
      }
    }
    const nextExport = exportPrice !== undefined ? exportPrice : price;
    if (nextExport !== undefined) product.price = Math.round(Number(nextExport));
    if (stock !== undefined) product.stock = Math.max(0, parseInt(stock, 10) || 0);
    if (isDemoProduct !== undefined) product.isDemoProduct = Boolean(isDemoProduct);
    if (description !== undefined) product.description = description;
    if (imageUrl !== undefined) product.imageUrl = imageUrl;

    await product.save();

    if (product.stock !== previousStock) {
      await recordStockLog(req, {
        productId: product.id,
        productName: product.name,
        delta: product.stock - previousStock,
        previousStock,
        newStock: product.stock,
        reason: 'MANUAL_EDIT',
        note: 'Chỉnh sửa tồn kho trực tiếp'
      });
    }

    await recordAudit(req, {
      action: 'PRODUCT_UPDATE',
      entity: 'Product',
      entityId: product.id,
      summary: `Cập nhật sản phẩm ${product.name}`,
      before,
      after: {
        name: product.name,
        importPrice: product.importPrice,
        price: product.price,
        stock: product.stock,
        isDemoProduct: product.isDemoProduct
      }
    });
    await syncNotificationsFromRealData();

    return res.json(sanitizeProductForRole(product, req.user.role));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function restockProduct(req, res) {
  try {
    const parsedAmount = parseInt(req.body?.amount, 10);
    const amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 10;
    const note = req.body?.note ? String(req.body.note).trim() : '';

    const product = await Product.findOne({ id: req.params.id });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const previousStock = product.stock;
    product.stock += amount;
    await product.save();

    await recordStockLog(req, {
      productId: product.id,
      productName: product.name,
      delta: amount,
      previousStock,
      newStock: product.stock,
      reason: 'RESTOCK',
      note: note || (previousStock === 0 ? 'Nhập kho mở khóa giao dịch' : 'Nhập thêm hàng vào kho')
    });
    await recordAudit(req, {
      action: 'PRODUCT_RESTOCK',
      entity: 'Product',
      entityId: product.id,
      summary: `Nhập thêm +${amount} ${product.name} (${previousStock} → ${product.stock})`,
      before: { stock: previousStock },
      after: { stock: product.stock }
    });
    await syncNotificationsFromRealData();

    return res.json(sanitizeProductForRole(product, req.user.role));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function deleteProduct(req, res) {
  try {
    const deleted = await Product.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ error: 'Product not found' });

    await recordAudit(req, {
      action: 'PRODUCT_DELETE',
      entity: 'Product',
      entityId: req.params.id,
      summary: `Xóa sản phẩm ${deleted.name} (${deleted.sku})`,
      before: { id: deleted.id, sku: deleted.sku, name: deleted.name, stock: deleted.stock }
    });
    await syncNotificationsFromRealData();

    return res.json({ success: true, message: 'Đã xoá sản phẩm thành công', id: req.params.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listProducts,
  listLockedProducts,
  listStockLogs,
  exportProductsCsv,
  createProduct,
  bulkCreateProducts,
  updateProduct,
  restockProduct,
  deleteProduct
};
