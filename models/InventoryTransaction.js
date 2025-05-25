// models/InventoryTransaction.js
const mongoose = require('mongoose');

const InventoryTransactionSchema = new mongoose.Schema({
  inventoryItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true
  },
  type: {
    type: String,
    enum: ['add', 'use'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  unitPrice: {
    type: Number,
    default: 0
  },
  totalPrice: {
    type: Number,
    default: 0
  },
  reason: {
    type: String,
    trim: true
  },
  relatedAnimalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal'
  },
  batchNumber: {
    type: String,
    trim: true
  },
  expiryDate: {
    type: Date
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

// حساب السعر الإجمالي قبل الحفظ
InventoryTransactionSchema.pre('save', function(next) {
  if (this.isModified('quantity') || this.isModified('unitPrice')) {
    this.totalPrice = this.quantity * this.unitPrice;
  }
  next();
});

const InventoryTransaction = mongoose.model('InventoryTransaction', InventoryTransactionSchema);

module.exports = InventoryTransaction;