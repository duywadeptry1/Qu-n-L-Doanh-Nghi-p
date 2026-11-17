const mongoose = require('mongoose');

const calendarDaySchema = new mongoose.Schema({
  dayNumber: { type: Number, required: true, unique: true },
  monthLabel: { type: String, required: true },
  fullDateLabel: { type: String, required: true },
  totalOrders: { type: Number, default: 0 },
  deliveredOrders: { type: Number, default: 0 },
  cancelledOrders: { type: Number, default: 0 },
  isFuture: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('CalendarDay', calendarDaySchema);
