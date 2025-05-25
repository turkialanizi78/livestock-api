// models/DefaultWithdrawalPeriod.js
const mongoose = require('mongoose');

const DefaultWithdrawalPeriodSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['vaccine', 'medication'],
    required: true
  },
  name: {
    type: String,
    required: [true, 'يرجى إدخال اسم اللقاح أو الدواء'],
    trim: true
  },
  meatWithdrawalPeriod: {
    type: Number, // بالأيام
    default: 0
  },
  milkWithdrawalPeriod: {
    type: Number, // بالأيام
    default: 0
  },
  description: {
    type: String,
    trim: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnimalCategory'
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

// إنشاء فهرس مركب للتأكد من فريدية كل سجل
DefaultWithdrawalPeriodSchema.index({ name: 1, type: 1, userId: 1, categoryId: 1 }, { unique: true });

const DefaultWithdrawalPeriod = mongoose.model('DefaultWithdrawalPeriod', DefaultWithdrawalPeriodSchema);

module.exports = DefaultWithdrawalPeriod;