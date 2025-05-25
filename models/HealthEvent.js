// models/HealthEvent.js
const mongoose = require('mongoose');

const HealthEventSchema = new mongoose.Schema({
  animalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal',
    required: true
  },
  eventType: {
    type: String,
    enum: ['disease', 'injury', 'treatment', 'examination'],
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  description: {
    type: String,
    required: [true, 'يرجى إدخال وصف للحدث الصحي'],
    trim: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  treatmentGiven: {
    type: String,
    trim: true
  },
  treatedBy: {
    type: String,
    trim: true
  },
  productWithdrawalPeriod: {
    type: Number, // بالأيام
    default: 0
  },
  withdrawalEndDate: {
    type: Date
  },
  cost: {
    type: Number,
    default: 0
  },
  outcome: {
    type: String,
    enum: ['successful', 'unsuccessful', 'ongoing'],
    default: 'ongoing'
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

// حساب تاريخ انتهاء فترة الحظر عند إضافة حدث صحي
HealthEventSchema.pre('save', function(next) {
  if (this.isModified('productWithdrawalPeriod') && this.productWithdrawalPeriod > 0) {
    const eventDate = new Date(this.date);
    this.withdrawalEndDate = new Date(eventDate.setDate(eventDate.getDate() + this.productWithdrawalPeriod));
  }
  next();
});

const HealthEvent = mongoose.model('HealthEvent', HealthEventSchema);

module.exports = HealthEvent;