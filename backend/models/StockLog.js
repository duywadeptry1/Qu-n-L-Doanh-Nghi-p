const mongoose = require('mongoose');

const stockLogSchema = new mongoose.Schema({
  productId: { type: String, required: true, index: true },
  productName: { type: String, required: true },
  delta: { type: Number, required: true },
  previousStock: { type: Number, required: true },
  newStock: { type: Number, required: true },
  reason: {
    type: String,
    enum: ['ORDER_SALE', 'RESTOCK', 'ORDER_CANCEL_RESTORE', 'MANUAL_EDIT', 'INITIAL_CREATE'],
    required: true
  },
  orderId: { type: String, default: '' },
  note: { type: String, default: '' },
  actorId: { type: String, default: 'system' },
  actorRole: { type: String, default: 'ADMIN' }
}, { timestamps: true });

stockLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('StockLog', stockLogSchema);
