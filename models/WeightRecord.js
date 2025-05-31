// models/WeightRecord.js
const mongoose = require('mongoose');

const weightRecordSchema = new mongoose.Schema({
  animalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal',
    required: [true, 'معرف الحيوان مطلوب']
  },
  weight: {
    type: Number,
    required: [true, 'الوزن مطلوب'],
    min: [0, 'الوزن يجب أن يكون أكبر من صفر']
  },
  unit: {
    type: String,
    enum: ['kg', 'lb'],
    default: 'kg'
  },
  recordDate: {
    type: Date,
    required: [true, 'تاريخ التسجيل مطلوب'],
    default: Date.now
  },
  recordedBy: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  // حقول محسوبة
  weightChange: {
    type: Number,
    default: 0 // التغيير من القراءة السابقة
  },
  changePercentage: {
    type: Number,
    default: 0 // نسبة التغيير
  },
  growthRate: {
    type: Number,
    default: 0 // معدل النمو اليومي
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// فهرس مركب للحصول على سجلات الوزن لحيوان معين مرتبة بالتاريخ
weightRecordSchema.index({ animalId: 1, recordDate: -1 });
weightRecordSchema.index({ userId: 1 });

// دالة للحصول على آخر وزن مسجل للحيوان
weightRecordSchema.statics.getLatestWeight = async function(animalId) {
  const latestRecord = await this.findOne({ animalId })
    .sort({ recordDate: -1 })
    .limit(1);
  return latestRecord;
};

// دالة للحصول على متوسط معدل النمو
weightRecordSchema.statics.getAverageGrowthRate = async function(animalId, days = 30) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const records = await this.find({
    animalId,
    recordDate: { $gte: startDate, $lte: endDate }
  }).sort({ recordDate: 1 });

  if (records.length < 2) return 0;

  const firstRecord = records[0];
  const lastRecord = records[records.length - 1];
  const daysDiff = Math.ceil((lastRecord.recordDate - firstRecord.recordDate) / (1000 * 60 * 60 * 24));
  
  if (daysDiff === 0) return 0;
  
  return (lastRecord.weight - firstRecord.weight) / daysDiff;
};

module.exports = mongoose.model('WeightRecord', weightRecordSchema);