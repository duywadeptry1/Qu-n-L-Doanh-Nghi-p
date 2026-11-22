const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  importPrice: { type: Number, default: 0 },
  isDemoProduct: { type: Boolean, default: false }
});

const orderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  timeAgo: { type: String, default: 'Vừa xong' },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  address: { type: String, required: true },
  status: {
    type: String,
    enum: ['PLACED', 'PREPARING', 'DELIVERING', 'DELIVERED', 'CANCELLED'],
    default: 'PLACED'
  },
  salesChannel: {
    type: String,
    enum: ['B2B', 'B2C'],
    default: 'B2C'
  },
  vipTierAtPurchase: {
    type: String,
    enum: ['STANDARD', 'VIP_SILVER', 'VIP_GOLD', 'VIP_DIAMOND'],
    default: 'STANDARD'
  },
  vipProductDiscount: { type: Number, default: 0 },
  shippingDiscount: { type: Number, default: 0 },
  shippingCost: { type: Number, default: 15000 },
  items: [orderItemSchema],
  shippingFee: { type: Number, default: 30000 },
  paymentMethodLabel: { type: String, required: true },
  paymentType: { type: String, enum: ['ALL', 'COD', 'BANK', 'WALLET'], default: 'COD' }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
