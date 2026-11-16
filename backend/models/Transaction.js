const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  orderCode: { type: String, required: true },
  methodTitle: { type: String, required: true },
  subtitle: { type: String, required: true },
  amount: { type: Number, required: true },
  paymentType: { type: String, enum: ['ALL', 'COD', 'BANK', 'WALLET'], default: 'COD' }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
