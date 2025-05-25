// backend/models/EquipmentUsage.js
const mongoose = require('mongoose');

const EquipmentUsageSchema = new mongoose.Schema({
  // نوع العملية
  operationType: {
    type: String,
    enum: ['health_check', 'vaccination', 'treatment', 'maintenance', 'feeding', 'cleaning', 'other'],
    required: true
  },
  
  // العنوان
  title: {
    type: String,
    required: [true, 'يرجى إدخال عنوان العملية'],
    trim: true
  },
  
  // المعدات المستخدمة
  equipmentUsed: [{
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true
    },
    itemName: { type: String, required: true },
    quantityUsed: { type: Number, required: true },
    unit: { type: String, required: true },
    
    // حالة المعدة قبل الاستخدام
    conditionBefore: {
      type: String,
      enum: ['new', 'excellent', 'good', 'fair', 'poor'],
      default: 'good'
    },
    
    // حالة المعدة بعد الاستخدام
    conditionAfter: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor', 'damaged', 'discarded'],
      default: 'good'
    },
    
    // هل تم إرجاع المعدة للمخزون (للمعدات القابلة للإعادة)
    returnedToInventory: { type: Boolean, default: false },
    
    // كمية الإرجاع
    returnedQuantity: { type: Number, default: 0 },
    
    // ملاحظات خاصة بهذه المعدة
    notes: { type: String, trim: true }
  }],
  
  // الحيوانات المرتبطة
  relatedAnimals: [{
    animalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Animal'
    },
    animalIdentification: { type: String } // للمرجع السريع
  }],
  
  // الأحداث المرتبطة
  relatedEvents: {
    healthEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HealthEvent'
    },
    vaccinationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vaccination'
    },
    feedingRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeedingRecord'
    }
  },
  
  // معلومات الاستخدام
  usageDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  startTime: {
    type: String // مثل "08:30"
  },
  
  endTime: {
    type: String // مثل "09:15"
  },
  
  duration: {
    type: Number // بالدقائق
  },
  
  usedBy: {
    type: String,
    required: true,
    trim: true
  },
  
  assistants: [{
    type: String,
    trim: true
  }],
  
  // السبب والوصف
  reason: {
    type: String,
    required: [true, 'يرجى إدخال سبب الاستخدام'],
    trim: true
  },
  
  description: {
    type: String,
    trim: true
  },
  
  // الموقع
  location: {
    type: String,
    trim: true
  },
  
  // معلومات التكلفة
  cost: {
    materialCost: { type: Number, default: 0 },
    laborCost: { type: Number, default: 0 },
    maintenanceCost: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 }
  },
  
  // نتيجة العملية
  outcome: {
    status: {
      type: String,
      enum: ['successful', 'partially_successful', 'failed', 'pending'],
      default: 'successful'
    },
    results: { type: String, trim: true },
    recommendations: { type: String, trim: true }
  },
  
  // حالة المعدات بعد الاستخدام
  postUsageActions: {
    needsCleaning: { type: Boolean, default: false },
    needsRepair: { type: Boolean, default: false },
    needsReplacement: { type: Boolean, default: false },
    needsCalibration: { type: Boolean, default: false },
    actionNotes: { type: String, trim: true }
  },
  
  // تم خصم المواد من المخزون
  inventoryDeducted: {
    type: Boolean,
    default: false
  },
  
  // معرف معاملات المخزون
  inventoryTransactionIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryTransaction'
  }],
  
  // صور العملية (قبل وبعد)
  images: {
    before: [{ type: String }],
    during: [{ type: String }],
    after: [{ type: String }]
  },
  
  // معرف المستخدم
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

// حساب المدة الزمنية قبل الحفظ
EquipmentUsageSchema.pre('save', function(next) {
  if (this.startTime && this.endTime && !this.duration) {
    const start = this.startTime.split(':');
    const end = this.endTime.split(':');
    
    const startMinutes = parseInt(start[0]) * 60 + parseInt(start[1]);
    const endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);
    
    this.duration = endMinutes >= startMinutes ? 
      endMinutes - startMinutes : 
      (24 * 60) - startMinutes + endMinutes; // للحالات التي تمتد لليوم التالي
  }
  next();
});

// حساب التكلفة الإجمالية
EquipmentUsageSchema.pre('save', function(next) {
  this.cost.totalCost = (this.cost.materialCost || 0) + 
                       (this.cost.laborCost || 0) + 
                       (this.cost.maintenanceCost || 0);
  next();
});

// إنشاء فهارس للبحث السريع
EquipmentUsageSchema.index({ userId: 1, usageDate: -1 });
EquipmentUsageSchema.index({ operationType: 1 });
EquipmentUsageSchema.index({ 'equipmentUsed.inventoryItemId': 1 });
EquipmentUsageSchema.index({ 'relatedAnimals.animalId': 1 });

const EquipmentUsage = mongoose.model('EquipmentUsage', EquipmentUsageSchema);

module.exports = EquipmentUsage;