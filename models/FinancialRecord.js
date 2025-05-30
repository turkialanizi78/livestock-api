// models/FinancialRecord.js
const mongoose = require('mongoose');

const FinancialRecordSchema = new mongoose.Schema({
  animalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal'
  },
  type: {
    type: String,
    enum: ['expense', 'income'],
    required: true
  },
  category: {
    type: String,
    enum: [
      // Income categories
      'sale', 'milk', 'breeding_income', 'other_income',
      // Expense categories
      'feed', 'medical', 'medication', 'vaccination', 'labor', 
      'equipment', 'purchase', 'maintenance', 'utilities', 'other'
    ],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  description: {
    type: String,
    trim: true
  },
  relatedTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  relatedInventoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem'
  },
  supplier: {
    type: String,
    trim: true
  },
  customer: {
    type: String,
    trim: true
  },
  paymentMethod: {
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

const FinancialRecord = mongoose.model('FinancialRecord', FinancialRecordSchema);

module.exports = FinancialRecord;