const mongoose = require('mongoose');

const calendarDaySchema = new mongoose.Schema({
  dayNumber: { type: Number, required: true, unique: true },
  monthLabel: { type: String, required: true },
  fullDateLabel: { type: String, required: true },
  totalOrders: { type: Number, required: true },
  deliveredOrders: { type: Number, required: true },
  cancelledOrders: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('CalendarDay', calendarDaySchema);
