const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true }
});

const orderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  timeAgo: { type: String, default: 'Vừa xong' },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  address: { type: String, required: true },
  status: { type: String, enum: ['PLACED', 'DELIVERING', 'DELIVERED', 'CANCELLED'], default: 'PLACED' },
  items: [orderItemSchema],
  shippingFee: { type: Number, default: 30000 },
  paymentMethodLabel: { type: String, required: true },
  paymentType: { type: String, enum: ['ALL', 'COD', 'BANK', 'WALLET'], default: 'COD' },
  etaMinutes: { type: Number, default: 20 },
  distanceKm: { type: Number, default: 2.5 }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
