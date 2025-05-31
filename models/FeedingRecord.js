// backend/models/FeedingRecord.js
const mongoose = require('mongoose');

const FeedingRecordSchema = new mongoose.Schema({
  recordId: {
    type: String,
    unique: true,
    required: true
  },
  
  // الحيوانات المغذاة
  animals: [{
    animalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Animal',
      required: true
    },
    animalIdentification: { type: String }, // رقم تعريف الحيوان للمرجع السريع
    weight: { type: Number }, // وزن الحيوان وقت التغذية
    calculatedAmount: { type: Number } // الكمية المحسوبة لهذا الحيوان
  }],
  
  // نوع العلف
  feedType: {
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true
    },
    name: { type: String, required: true },
    unit: { type: String, required: true }
  },
  
  // الكمية الإجمالية
  totalAmount: {
    type: Number,
    required: true
  },
  
  // طريقة الحساب
  calculationMethod: {
    type: String,
    enum: ['automatic', 'manual'],
    default: 'automatic'
  },
  
  // معايير الحساب التلقائي
  calculationCriteria: {
    percentageOfWeight: { type: Number }, // نسبة من الوزن
    fixedAmountPerAnimal: { type: Number }, // كمية ثابتة لكل حيوان
    customFormula: { type: String } // معادلة مخصصة
  },
  
  // معلومات التسجيل
  feedingDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  feedingTime: {
    type: String, // مثل "07:30"
    required: true
  },
  
  // الشخص المسؤول
  fedBy: {
    type: String,
    trim: true
  },
  
  // معلومات الجدولة (إذا كان مجدولاً)
  scheduledFeedingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeedingSchedule'
  },
  
  // تم خصم الكمية من المخزون
  inventoryDeducted: {
    type: Boolean,
    default: false
  },
  
  // معرف معاملة المخزون المرتبطة
  inventoryTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryTransaction'
  },
  
  // ملاحظات
  notes: {
    type: String,
    trim: true
  },
  
  // معلومات التكلفة
  cost: {
    unitCost: { type: Number, default: 0 }, // تكلفة الوحدة
    totalCost: { type: Number, default: 0 }  // التكلفة الإجمالية
  },
  
  // نوع التغذية
  feedingType: {
    type: String,
    enum: ['regular', 'supplement', 'emergency', 'medical'],
    default: 'regular'
  },
  
  // الموقع
  location: {
    type: String,
    trim: true
  },
  
  // معرف المستخدم
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // علامة تجاوز فحص المخزون (مؤقتة)
  skipInventoryCheck: {
    type: Boolean,
    default: false
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// توليد recordId تلقائياً قبل الحفظ
FeedingRecordSchema.pre('save', function(next) {
  if (this.isNew && !this.recordId) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '');
    this.recordId = `FEED-${dateStr}-${timeStr}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  }
  next();
});

// حساب التكلفة الإجمالية قبل الحفظ
FeedingRecordSchema.pre('save', function(next) {
  if (this.isModified('totalAmount') || this.isModified('cost.unitCost')) {
    this.cost.totalCost = (this.cost.unitCost || 0) * (this.totalAmount || 0);
  }
  next();
});

// خصم الكمية من المخزون عند إنشاء سجل جديد
FeedingRecordSchema.pre('save', async function(next) {
  if (this.isNew && this.feedType && this.feedType.inventoryItemId && !this.skipInventoryCheck) {
    try {
      const InventoryItem = mongoose.model('InventoryItem');
      const inventoryItem = await InventoryItem.findById(this.feedType.inventoryItemId);
      
      if (inventoryItem) {
        if (inventoryItem.quantity >= this.totalAmount) {
          inventoryItem.quantity -= this.totalAmount;
          await inventoryItem.save();
          
          // حفظ تكلفة الوحدة
          this.cost.unitCost = inventoryItem.unitCost || 0;
          this.cost.totalCost = this.cost.unitCost * this.totalAmount;
        } else {
          return next(new Error(`الكمية المطلوبة (${this.totalAmount}) أكبر من المخزون المتاح (${inventoryItem.quantity})`));
        }
      } else {
        // إذا لم يوجد عنصر المخزون، احسب التكلفة افتراضياً
        this.cost.unitCost = this.cost.unitCost || 0;
        this.cost.totalCost = this.cost.unitCost * this.totalAmount;
      }
    } catch (error) {
      return next(error);
    }
  } else if (this.isNew) {
    // إذا كان تخطي فحص المخزون، احسب التكلفة فقط
    this.cost.totalCost = (this.cost.unitCost || 0) * this.totalAmount;
  }
  next();
});

// إرجاع الكمية إلى المخزون عند حذف السجل
FeedingRecordSchema.pre('remove', async function(next) {
  if (this.feedType && this.feedType.inventoryItemId) {
    try {
      const InventoryItem = mongoose.model('InventoryItem');
      const inventoryItem = await InventoryItem.findById(this.feedType.inventoryItemId);
      
      if (inventoryItem) {
        inventoryItem.quantity += this.totalAmount;
        await inventoryItem.save();
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// إنشاء فهرس للبحث السريع
FeedingRecordSchema.index({ userId: 1, feedingDate: -1 });
FeedingRecordSchema.index({ 'feedType.inventoryItemId': 1 });
FeedingRecordSchema.index({ 'animals.animalId': 1 });

const FeedingRecord = mongoose.model('FeedingRecord', FeedingRecordSchema);

module.exports = FeedingRecord;