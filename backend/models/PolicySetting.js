const mongoose = require('mongoose');

const policySettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'default' },
  standardShippingFee: { type: Number, default: 30000 },
  shippingBaseCost: { type: Number, default: 15000 },
  lowStockThreshold: { type: Number, default: 10 },
  vipTiers: {
    silverMinOrders: { type: Number, default: 2 },
    silverDemoDiscountPercent: { type: Number, default: 10 },
    silverShippingDiscount: { type: Number, default: 5000 },
    goldMinOrders: { type: Number, default: 4 },
    goldDemoDiscountPercent: { type: Number, default: 15 },
    goldShippingDiscount: { type: Number, default: 10000 },
    diamondMinOrders: { type: Number, default: 6 },
    diamondDemoDiscountPercent: { type: Number, default: 20 },
    diamondShippingDiscount: { type: Number, default: 15000 }
  }
}, { timestamps: true });

module.exports = mongoose.model('PolicySetting', policySettingSchema);
