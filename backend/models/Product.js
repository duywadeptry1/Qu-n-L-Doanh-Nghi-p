const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  sku: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  importPrice: { type: Number, default: 0 },
  price: { type: Number, required: true }, // Export / selling price (Giá xuất)
  stock: { type: Number, required: true },
  soldCount: { type: Number, default: 0 },
  isDemoProduct: { type: Boolean, default: false },
  description: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  imageResName: { type: String, default: 'img_product_electronics' }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
