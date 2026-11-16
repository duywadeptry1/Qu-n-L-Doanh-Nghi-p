const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  sku: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  stock: { type: Number, required: true },
  soldCount: { type: Number, default: 0 },
  description: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  imageResName: { type: String, default: 'img_product_electronics' }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
