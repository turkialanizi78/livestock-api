// models/Vaccination.js
const mongoose = require('mongoose');

const VaccinationSchema = new mongoose.Schema({
  animalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal',
    required: true
  },
  name: {
    type: String,
    required: [true, 'يرجى إدخال اسم التطعيم'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  dose: {
    type: String,
    trim: true
  },
  scheduleDate: {
    type: Date,
    required: true
  },
  administrationDate: {
    type: Date
  },
  administrator: {
    type: String,
    trim: true
  },
  supplier: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'delayed'],
    default: 'pending'
  },
  meatWithdrawalPeriod: {
    type: Number, // بالأيام
    default: 0
  },
  milkWithdrawalPeriod: {
    type: Number, // بالأيام
    default: 0
  },
  withdrawalEndDate: {
    type: Date
  },
  batchNumber: {
    type: String,
    trim: true
  },
  notes: {
    type: String
  },
  vaccinationScheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VaccinationSchedule'
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

// حساب تاريخ انتهاء فترة الحظر عند إكمال التطعيم
VaccinationSchema.pre('save', function(next) {
  if (this.isModified('administrationDate') && this.administrationDate) {
    // تم تنفيذ التطعيم، حساب تاريخ انتهاء فترة الحظر
    const adminDate = new Date(this.administrationDate);
    
    // اختيار أطول فترة حظر (اللحم أو الحليب)
    const maxWithdrawalPeriod = Math.max(this.meatWithdrawalPeriod, this.milkWithdrawalPeriod);
    
    if (maxWithdrawalPeriod > 0) {
      this.withdrawalEndDate = new Date(adminDate.setDate(adminDate.getDate() + maxWithdrawalPeriod));
    }
    
    this.status = 'completed';
  }
  next();
});

const Vaccination = mongoose.model('Vaccination', VaccinationSchema);

module.exports = Vaccination;