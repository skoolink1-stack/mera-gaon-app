const mongoose = require('mongoose');
const paymentSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  paymentId: { type: String, default: '' },
  plan: { type: String, enum: ['monthly', 'yearly'], required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['created', 'paid'], default: 'created' },
  userId: { type: String, default: '' },   // renewal ho to user ki id, registration ho to khali
  claimed: { type: Boolean, default: false },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  paidAt: { type: Date },
  utr: { type: String, default: '' },
  rejected: { type: Boolean, default: false },
  reviewed: { type: Boolean, default: false }
}, { timestamps: true });
module.exports = mongoose.model('Payment', paymentSchema);