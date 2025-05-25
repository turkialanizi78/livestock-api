// models/Transaction.js
const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  animalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal',
    required: true
  },
  type: {
    type: String,
    enum: ['purchase', 'sale', 'slaughter'],
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  price: {
    type: Number,
    required: function() {
      return this.type === 'purchase' || this.type === 'sale';
    }
  },
  weight: {
    type: Number // بالكيلوغرام
  },
  buyer: {
    name: { type: String, trim: true },
    contact: { type: String, trim: true },
    address: { type: String, trim: true }
  },
  seller: {
    name: { type: String, trim: true },
    contact: { type: String, trim: true },
    address: { type: String, trim: true }
  },
  paymentMethod: {
    type: String,
    trim: true
  },
  restrictionChecked: {
    type: Boolean,
    default: false
  },
  invoiceNumber: {
    type: String,
    trim: true
  },
  notes: {
    type: String
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', TransactionSchema);

module.exports = Transaction;