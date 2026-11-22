const mongoose = require('mongoose');

const customerProfileSchema = new mongoose.Schema({
  normalizedPhone: { type: String, required: true, unique: true, index: true },
  phoneDisplay: { type: String, default: '' },
  customerName: { type: String, default: '' },
  companyName: { type: String, default: '' },
  defaultAddress: { type: String, default: '' },
  defaultChannel: { type: String, enum: ['B2B', 'B2C'], default: 'B2C' },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('CustomerProfile', customerProfileSchema);
