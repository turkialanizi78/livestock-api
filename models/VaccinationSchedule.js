// models/VaccinationSchedule.js
const mongoose = require('mongoose');

const VaccinationScheduleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'يرجى إدخال اسم التطعيم'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnimalCategory',
    required: true
  },
  requiredAge: {
    type: Number, // بالأيام
    required: true
  },
  repeatInterval: {
    type: Number, // بالأيام
    default: 0 // 0 يعني لا حاجة للتكرار
  },
  isRequired: {
    type: Boolean,
    default: true
  },
  meatWithdrawalPeriod: {
    type: Number, // بالأيام
    default: 0
  },
  milkWithdrawalPeriod: {
    type: Number, // بالأيام
    default: 0
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

const VaccinationSchedule = mongoose.model('VaccinationSchedule', VaccinationScheduleSchema);

module.exports = VaccinationSchedule;