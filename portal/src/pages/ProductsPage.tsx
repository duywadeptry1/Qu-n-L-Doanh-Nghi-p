import React, { useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Download, Edit3, History, PackagePlus, Plus, Trash2, Upload, X } from 'lucide-react';
import { ApiError, apiRequest, downloadAuthenticatedCsv } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { PaginatedProductsResponse, Product, StockLog } from '../types/api';
import { formatVnd } from '../utils/format';

interface ShellContext {
  refreshShell?: () => Promise<void>;
}

const CATEGORIES = ['Tất cả', 'Thiết bị điện tử', 'Phụ kiện', 'Thời trang'];

export const ProductsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const { refreshShell } = useOutletContext<ShellContext>() || {};
  const [searchParams, setSearchParams] = useSearchParams();

  const [data, setData] = useState<PaginatedProductsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Tất cả');
  const [stockStatus, setStockStatus] = useState(searchParams.get('stockStatus') || 'ALL');
  const [demoOnly, setDemoOnly] = useState(false);
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  // Modals
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [restockAmount, setRestockAmount] = useState(20);
  const [restockNote, setRestockNote] = useState('');
  const [stockLogTarget, setStockLogTarget] = useState<Product | null>(null);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');

  // Product Form state
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formCategory, setFormCategory] = useState('Thiết bị điện tử');
  const [formImportPrice, setFormImportPrice] = useState('');
  const [formExportPrice, setFormExportPrice] = useState('');
  const [formStock, setFormStock] = useState('20');
  const [formIsDemo, setFormIsDemo] = useState(false);
  const [formDescription, setFormDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const canViewCost = hasPermission('products:view_cost');
  const canCreate = hasPermission('products:create');
  const canUpdate = hasPermission('products:update');
  const canUpdateCost = hasPermission('products:update_cost');
  const canBulk = hasPermission('products:bulk_import');
  const canRestock = hasPermission('products:restock');
  const canDelete = hasPermission('products:delete');
  const canViewLogs = hasPermission('stock_logs:read');

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const loadProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: '15',
        sort
      });
      if (category !== 'Tất cả') qs.set('category', category);
      if (stockStatus !== 'ALL') qs.set('stockStatus', stockStatus);
      if (demoOnly) qs.set('isDemo', 'true');
      if (search.trim()) qs.set('search', search.trim());

      const res = await apiRequest<PaginatedProductsResponse>(`/products?${qs.toString()}`);
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Lỗi tải danh sách kho hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProducts();
  }, [page, category, stockStatus, demoOnly, sort, search]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormSku('');
    setFormCategory('Thiết bị điện tử');
    setFormImportPrice('');
    setFormExportPrice('');
    setFormStock('20');
    setFormIsDemo(false);
    setFormDescription('');
    setShowProductModal(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormSku(p.sku);
    setFormCategory(p.category);
    setFormImportPrice(p.importPrice !== undefined ? String(p.importPrice) : '');
    setFormExportPrice(String(p.price));
    setFormStock(String(p.stock));
    setFormIsDemo(Boolean(p.isDemoProduct));
    setFormDescription(p.description || '');
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        name: formName.trim(),
        category: formCategory,
        price: Number(formExportPrice) || 0,
        stock: Math.max(0, parseInt(formStock, 10) || 0),
        isDemoProduct: formIsDemo,
        description: formDescription.trim()
      };
      if (!editingProduct && formSku.trim()) payload.sku = formSku.trim();
      if (canUpdateCost && formImportPrice.trim() !== '') {
        payload.importPrice = Number(formImportPrice) || 0;
      }

      if (editingProduct) {
        await apiRequest(`/products/${editingProduct.id}`, { method: 'PUT', body: payload });
        notify(`Đã cập nhật "${formName.trim()}"`);
      } else {
        await apiRequest('/products', { method: 'POST', body: payload });
        notify(`Đã thêm sản phẩm "${formName.trim()}" vào kho`);
      }

      setShowProductModal(false);
      await loadProducts();
      await refreshShell?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể lưu sản phẩm');
    } finally {
      setSaving(false);
    }
  };

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockTarget) return;
    setSaving(true);
    try {
      const wasLocked = restockTarget.stock <= 0;
      await apiRequest(`/products/${restockTarget.id}/restock`, {
        method: 'PATCH',
        body: { amount: restockAmount, note: restockNote }
      });
      notify(
        wasLocked
          ? `🔓 Đã nhập +${restockAmount} "${restockTarget.name}" và MỞ KHÓA giao dịch!`
          : `Đã nhập thêm +${restockAmount} "${restockTarget.name}"`
      );
      setRestockTarget(null);
      setRestockNote('');
      await loadProducts();
      await refreshShell?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Lỗi nhập kho');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Product) => {
    if (!window.confirm(`Xóa sản phẩm "${p.name}" (${p.sku}) khỏi kho?`)) return;
    try {
      await apiRequest(`/products/${p.id}`, { method: 'DELETE' });
      notify(`Đã xóa "${p.name}"`);
      await loadProducts();
      await refreshShell?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể xóa sản phẩm');
    }
  };

  const openStockLogs = async (p: Product) => {
    setStockLogTarget(p);
    setStockLogs([]);
    try {
      const logs = await apiRequest<StockLog[]>(`/products/${p.id}/stock-logs`);
      setStockLogs(logs);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể tải lịch sử kho');
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = bulkText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);
    const products = lines.map(line => {
      const parts = line.split(/[|,;\t]/).map(s => s.trim());
      return {
        name: parts[0] || '',
        price: Number(parts[1]) || 0,
        stock: Number(parts[2]) || 10,
        category: parts[3] || 'Thiết bị điện tử',
        importPrice: parts[4] ? Number(parts[4]) : undefined
      };
    });
    if (products.length === 0) return;

    setSaving(true);
    try {
      const res = await apiRequest<{ insertedCount: number; skippedCount: number }>('/products/bulk', {
        method: 'POST',
        body: { products }
      });
      notify(`Đã nhập ${res.insertedCount} sản phẩm (bỏ qua ${res.skippedCount})`);
      setBulkText('');
      setShowBulkModal(false);
      await loadProducts();
      await refreshShell?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Lỗi nhập hàng loạt');
    } finally {
      setSaving(false);
    }
  };

  const previewImport = Number(formImportPrice) || 0;
  const previewExport = Number(formExportPrice) || 0;
  const previewUnitProfit = previewExport - previewImport;
  const previewMargin = previewExport > 0 ? Math.round((previewUnitProfit / previewExport) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Kho hàng & Giá Nhập / Xuất</h1>
          <p className="page-subtitle">
            Quản lý tồn kho, tự động khóa giao dịch khi hết hàng (tồn = 0) và gắn nhãn ⭐ DEMO ưu đãi VIP
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => void downloadAuthenticatedCsv('/products/export', 'viendong-products.csv')}
          >
            <Download size={15} />
            <span>Xuất CSV</span>
          </button>
          {canBulk && (
            <button type="button" className="btn btn-soft-green" onClick={() => setShowBulkModal(true)}>
              <Upload size={15} />
              <span>Nhập hàng loạt</span>
            </button>
          )}
          {canCreate && (
            <button type="button" className="btn btn-primary" onClick={openAddModal}>
              <Plus size={16} />
              <span>Thêm sản phẩm</span>
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="alert-banner alert-green" style={{ marginBottom: 14 }}>
          <strong>✅ {toast}</strong>
        </div>
      )}
      {error && (
        <div className="alert-banner alert-red" style={{ marginBottom: 14 }}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Summary Strip */}
      <div className="grid-4" style={{ marginBottom: 18 }}>
        <div className="kpi-card">
          <div className="kpi-label">Tổng mã sản phẩm</div>
          <div className="kpi-value">{data?.summary.totalProducts ?? '—'}</div>
          <div className="kpi-sub">⭐ {data?.summary.demoCount ?? 0} sản phẩm Demo VIP</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Tổng tồn kho</div>
          <div className="kpi-value" style={{ color: 'var(--blue)' }}>
            {data?.summary.totalStock ?? '—'}
          </div>
          <div className="kpi-sub">Đơn vị sẵn sàng giao dịch</div>
        </div>
        <div
          className="kpi-card"
          style={{
            cursor: 'pointer',
            borderColor: (data?.summary.lockedCount || 0) > 0 ? 'var(--red-border)' : 'var(--border)',
            background: (data?.summary.lockedCount || 0) > 0 ? 'var(--red-soft)' : 'var(--bg-card)'
          }}
          onClick={() => {
            setStockStatus(prev => (prev === 'LOCKED' ? 'ALL' : 'LOCKED'));
            setPage(1);
          }}
        >
          <div className="kpi-label">🔒 Đang khóa giao dịch</div>
          <div className="kpi-value" style={{ color: 'var(--red)' }}>
            {data?.summary.lockedCount ?? 0}
          </div>
          <div className="kpi-sub">Bấm để lọc SP hết tồn (= 0)</div>
        </div>
        <div
          className="kpi-card"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            setStockStatus(prev => (prev === 'LOW' ? 'ALL' : 'LOW'));
            setPage(1);
          }}
        >
          <div className="kpi-label">⚠️ Sắp hết hàng (1–10)</div>
          <div className="kpi-value" style={{ color: 'var(--amber)' }}>
            {data?.summary.lowStockCount ?? 0}
          </div>
          <div className="kpi-sub">Nên nhập bổ sung sớm</div>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="card">
        <div className="toolbar">
          <input
            className="input"
            style={{ maxWidth: 260 }}
            placeholder="Tìm tên sản phẩm hoặc SKU..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />

          <select
            className="select"
            style={{ maxWidth: 185 }}
            value={category}
            onChange={e => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            className="select"
            style={{ maxWidth: 195 }}
            value={stockStatus}
            onChange={e => {
              setStockStatus(e.target.value);
              if (e.target.value === 'ALL') {
                searchParams.delete('stockStatus');
                setSearchParams(searchParams, { replace: true });
              }
              setPage(1);
            }}
          >
            <option value="ALL">Mọi trạng thái kho</option>
            <option value="LOCKED">🔒 Đang khóa GD (Tồn = 0)</option>
            <option value="LOW">⚠️ Sắp hết (1 – 10)</option>
            <option value="IN_STOCK">🟢 Còn hàng (&gt; 0)</option>
          </select>

          <select
            className="select"
            style={{ maxWidth: 175 }}
            value={sort}
            onChange={e => setSort(e.target.value)}
          >
            <option value="newest">Mới nhất</option>
            <option value="stock_asc">Tồn kho thấp → cao</option>
            <option value="stock_desc">Tồn kho cao → thấp</option>
            <option value="sold_desc">Bán chạy nhất</option>
            <option value="price_desc">Giá xuất cao → thấp</option>
          </select>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={demoOnly}
              onChange={e => {
                setDemoOnly(e.target.checked);
                setPage(1);
              }}
            />
            ⭐ Chỉ SP Demo
          </label>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Sản phẩm</th>
                {canViewCost && <th>Giá nhập</th>}
                <th>Giá xuất</th>
                {canViewCost && <th>Lãi / SP</th>}
                <th>Tồn kho & Trạng thái</th>
                <th>Đã bán</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    Đang tải kho hàng...
                  </td>
                </tr>
              ) : (data?.items || []).length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    Không tìm thấy sản phẩm phù hợp bộ lọc.
                  </td>
                </tr>
              ) : (
                (data?.items || []).map(p => {
                  const isLocked = p.stock <= 0;
                  const unitProfit = p.importPrice !== undefined ? p.price - p.importPrice : null;
                  const margin =
                    unitProfit !== null && p.price > 0 ? Math.round((unitProfit / p.price) * 100) : null;
                  return (
                    <tr key={p.id} style={isLocked ? { background: '#fff8f8' } : undefined}>
                      <td>
                        <span className="badge badge-gray">{p.sku}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span>{p.name}</span>
                          {p.isDemoProduct && <span className="badge badge-amber">⭐ DEMO</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.category}</div>
                      </td>
                      {canViewCost && (
                        <td className="num" style={{ color: 'var(--text-secondary)' }}>
                          {formatVnd(p.importPrice)}
                        </td>
                      )}
                      <td className="num" style={{ fontWeight: 700, color: 'var(--blue)' }}>
                        {formatVnd(p.price)}
                      </td>
                      {canViewCost && (
                        <td className="num">
                          {unitProfit !== null && (
                            <span
                              style={{
                                fontWeight: 700,
                                color: unitProfit >= 0 ? 'var(--green)' : 'var(--red)'
                              }}
                            >
                              {unitProfit >= 0 ? '+' : ''}
                              {formatVnd(unitProfit)} ({margin}%)
                            </span>
                          )}
                        </td>
                      )}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong className="num">{p.stock}</strong>
                          {isLocked ? (
                            <span className="badge badge-red">🔒 Khóa GD</span>
                          ) : p.stock <= 10 ? (
                            <span className="badge badge-amber">Sắp hết</span>
                          ) : (
                            <span className="badge badge-green">Còn hàng</span>
                          )}
                        </div>
                      </td>
                      <td className="num">{p.soldCount}</td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          {canRestock && (
                            <button
                              type="button"
                              className={`btn btn-sm ${isLocked ? 'btn-success' : 'btn-soft-blue'}`}
                              onClick={() => {
                                setRestockTarget(p);
                                setRestockAmount(20);
                              }}
                            >
                              <PackagePlus size={14} />
                              <span>{isLocked ? '🔓 Mở khóa' : '+ Kho'}</span>
                            </button>
                          )}
                          {canViewLogs && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              title="Lịch sử tồn kho"
                              onClick={() => void openStockLogs(p)}
                            >
                              <History size={14} />
                            </button>
                          )}
                          {canUpdate && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              title="Chỉnh sửa"
                              onClick={() => openEditModal(p)}
                            >
                              <Edit3 size={14} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              className="btn btn-soft-red btn-sm"
                              title="Xóa"
                              onClick={() => void handleDelete(p)}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 14,
              fontSize: 13
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>
              Trang {data.pagination.page} / {data.pagination.totalPages} ({data.pagination.total} sản phẩm)
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                ← Trước
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Sau →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {showProductModal && (
        <div className="overlay-center">
          <div className="modal">
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>
                {editingProduct ? `Chỉnh sửa: ${editingProduct.name}` : 'Thêm sản phẩm mới vào kho'}
              </h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowProductModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={e => void handleSaveProduct(e)}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="field-label">Tên sản phẩm (*)</label>
                  <input
                    className="input"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid-2">
                  {!editingProduct && (
                    <div className="form-group">
                      <label className="field-label">Mã SKU (để trống tự sinh)</label>
                      <input
                        className="input"
                        value={formSku}
                        onChange={e => setFormSku(e.target.value)}
                        placeholder="VD-SP07"
                      />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="field-label">Danh mục</label>
                    <select
                      className="select"
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value)}
                    >
                      {CATEGORIES.filter(c => c !== 'Tất cả').map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid-2">
                  {canUpdateCost && (
                    <div className="form-group">
                      <label className="field-label">Giá nhập (VNĐ)</label>
                      <input
                        type="number"
                        min={0}
                        className="input num"
                        value={formImportPrice}
                        onChange={e => setFormImportPrice(e.target.value)}
                        placeholder="Mặc định 70% giá xuất"
                      />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="field-label">Giá xuất / bán (VNĐ) (*)</label>
                    <input
                      type="number"
                      min={1}
                      className="input num"
                      value={formExportPrice}
                      onChange={e => setFormExportPrice(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {canUpdateCost && previewExport > 0 && (
                  <div
                    className={`alert-banner ${previewUnitProfit >= 0 ? 'alert-green' : 'alert-red'}`}
                    style={{ marginBottom: 14, padding: '10px 12px', fontSize: 13 }}
                  >
                    <span>
                      {previewUnitProfit >= 0 ? '📈 Lãi dự kiến/SP:' : '⚠️ Giá xuất thấp hơn giá nhập:'}{' '}
                      <strong className="num">
                        {previewUnitProfit >= 0 ? '+' : ''}
                        {formatVnd(previewUnitProfit)} ({previewMargin}%)
                      </strong>
                    </span>
                  </div>
                )}

                <div className="grid-2">
                  <div className="form-group">
                    <label className="field-label">Số lượng tồn kho</label>
                    <input
                      type="number"
                      min={0}
                      className="input num"
                      value={formStock}
                      onChange={e => setFormStock(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: 22 }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formIsDemo}
                        onChange={e => setFormIsDemo(e.target.checked)}
                      />
                      <span>⭐ Sản phẩm Demo (Ưu đãi VIP)</span>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label className="field-label">Mô tả sản phẩm</label>
                  <textarea
                    className="textarea"
                    rows={2}
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowProductModal(false)}>
                  Huỷ
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Đang lưu...' : editingProduct ? 'Lưu thay đổi' : 'Thêm vào kho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {restockTarget && (
        <div className="overlay-center">
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>
                {restockTarget.stock <= 0 ? '🔓 Nhập kho & Mở khóa giao dịch' : '📦 Nhập thêm hàng vào kho'}
              </h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setRestockTarget(null)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={e => void handleRestock(e)}>
              <div className="modal-body">
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{restockTarget.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                  Tồn hiện tại: <strong>{restockTarget.stock}</strong> → Sau nhập:{' '}
                  <strong style={{ color: 'var(--green)' }}>{restockTarget.stock + restockAmount}</strong>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {[10, 20, 50, 100].map(n => (
                    <button
                      key={n}
                      type="button"
                      className={`btn btn-sm ${restockAmount === n ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setRestockAmount(n)}
                    >
                      +{n}
                    </button>
                  ))}
                </div>

                <div className="form-group">
                  <label className="field-label">Số lượng nhập thêm</label>
                  <input
                    type="number"
                    min={1}
                    className="input num"
                    value={restockAmount}
                    onChange={e => setRestockAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="field-label">Ghi chú nhập kho (tùy chọn)</label>
                  <input
                    className="input"
                    value={restockNote}
                    onChange={e => setRestockNote(e.target.value)}
                    placeholder="VD: Nhập lô mới từ NCC"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setRestockTarget(null)}>
                  Huỷ
                </button>
                <button type="submit" className="btn btn-success" disabled={saving}>
                  {saving ? 'Đang xử lý...' : `Xác nhận +${restockAmount} sp`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Logs Modal */}
      {stockLogTarget && (
        <div className="overlay-center">
          <div className="modal">
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Lịch sử kho: {stockLogTarget.name}</h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setStockLogTarget(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              {stockLogs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
                  Chưa có nhật ký biến động tồn kho cho sản phẩm này.
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Thay đổi</th>
                        <th>Trước → Sau</th>
                        <th>Lý do</th>
                        <th>Người thực hiện</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockLogs.map(log => (
                        <tr key={log._id}>
                          <td
                            className="num"
                            style={{ fontWeight: 800, color: log.delta >= 0 ? 'var(--green)' : 'var(--red)' }}
                          >
                            {log.delta >= 0 ? `+${log.delta}` : log.delta}
                          </td>
                          <td className="num">
                            {log.previousStock} → <strong>{log.newStock}</strong>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{log.note || log.reason}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                              {new Date(log.createdAt).toLocaleString('vi-VN')}
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-gray">{log.actorRole}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <div className="overlay-center">
          <div className="modal">
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Nhập sản phẩm hàng loạt</h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowBulkModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={e => void handleBulkSubmit(e)}>
              <div className="modal-body">
                <p style={{ marginTop: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                  Mỗi dòng 1 sản phẩm theo định dạng:
                  <br />
                  <code>Tên sản phẩm | Giá xuất | Tồn kho | Danh mục | Giá nhập (tùy chọn)</code>
                </p>
                <textarea
                  className="textarea"
                  rows={7}
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  placeholder={'Loa Bluetooth Mini | 450000 | 30 | Thiết bị điện tử | 310000\nCáp Type-C 2m | 120000 | 50 | Phụ kiện | 75000'}
                  required
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowBulkModal(false)}>
                  Huỷ
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Đang nhập...' : 'Lưu hàng loạt vào MongoDB'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
