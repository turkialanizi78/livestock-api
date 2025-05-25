// backend/models/FeedingSchedule.js
const mongoose = require('mongoose');

const FeedingScheduleSchema = new mongoose.Schema({
  // اسم الجدولة
  name: {
    type: String,
    required: [true, 'يرجى إدخال اسم الجدولة'],
    trim: true
  },
  
  // نوع الجدولة
  scheduleType: {
    type: String,
    enum: ['daily', 'weekly', 'custom'],
    default: 'daily'
  },
  
  // أوقات التغذية
  feedingTimes: [{
    time: { type: String, required: true }, // مثل "07:30"
    name: { type: String, trim: true }, // مثل "إفطار", "غداء"
    isActive: { type: Boolean, default: true }
  }],
  
  // قواعد التطبيق
  applicationRules: [{
    // اسم القاعدة
    ruleName: { type: String, trim: true },
    
    // معايير الحيوانات
    animalCriteria: {
      categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AnimalCategory' }],
      breedIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AnimalBreed' }],
      ageRange: {
        min: { type: Number }, // بالشهور
        max: { type: Number }
      },
      weightRange: {
        min: { type: Number }, // بالكيلو
        max: { type: Number }
      },
      genders: [{ type: String, enum: ['male', 'female'] }],
      statuses: [{ type: String, enum: ['alive', 'pregnant', 'lactating'] }],
      specificAnimals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Animal' }] // حيوانات محددة
    },
    
    // نوع العلف
    feedType: {
      inventoryItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InventoryItem',
        required: true
      },
      name: { type: String, required: true }
    },
    
    // طريقة حساب الكمية
    calculationMethod: {
      type: String,
      enum: ['percentage_of_weight', 'fixed_amount', 'custom_formula'],
      required: true
    },
    
    // معايير الحساب
    calculationParams: {
      percentage: { type: Number }, // نسبة من الوزن
      fixedAmount: { type: Number }, // كمية ثابتة
      formula: { type: String }, // معادلة مخصصة
      minAmount: { type: Number }, // حد أدنى
      maxAmount: { type: Number }  // حد أقصى
    },
    
    // أيام التطبيق (للجدولة الأسبوعية)
    applicableDays: [{ 
      type: String, 
      enum: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] 
    }],
    
    // حالة تنشيط القاعدة
    isActive: { type: Boolean, default: true }
  }],
  
  // حالة التنشيط العامة
  isActive: {
    type: Boolean,
    default: true
  },
  
  // تواريخ الصلاحية
  validFrom: {
    type: Date,
    default: Date.now
  },
  validTo: {
    type: Date
  },
  
  // معلومات التنفيذ التلقائي
  autoExecution: {
    enabled: { type: Boolean, default: false },
    tolerance: { type: Number, default: 30 }, // هامش الخطأ بالدقائق
    notificationBefore: { type: Number, default: 15 } // تنبيه قبل التنفيذ بالدقائق
  },
  
  // إحصائيات الاستخدام
  stats: {
    totalExecutions: { type: Number, default: 0 },
    lastExecuted: { type: Date },
    averageCost: { type: Number, default: 0 },
    totalAnimalsAffected: { type: Number, default: 0 },
    totalFeedUsed: { type: Number, default: 0 }
  },
  
  // معلومات إضافية
  description: {
    type: String,
    trim: true
  },
  
  // معرف المستخدم
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

// دالة للتحقق من صلاحية الجدولة
FeedingScheduleSchema.methods.isValidAt = function(date = new Date()) {
  if (!this.isActive) return false;
  
  if (this.validFrom && date < this.validFrom) return false;
  if (this.validTo && date > this.validTo) return false;
  
  return true;
};

// دالة للحصول على الحيوانات المؤهلة للقاعدة
FeedingScheduleSchema.methods.getEligibleAnimals = async function(ruleIndex = 0) {
  const rule = this.applicationRules[ruleIndex];
  if (!rule || !rule.isActive) return [];
  
  const Animal = mongoose.model('Animal');
  let query = { userId: this.userId };
  
  // تطبيق معايير الحيوانات
  if (rule.animalCriteria.categoryIds && rule.animalCriteria.categoryIds.length > 0) {
    query.categoryId = { $in: rule.animalCriteria.categoryIds };
  }
  
  if (rule.animalCriteria.breedIds && rule.animalCriteria.breedIds.length > 0) {
    query.breedId = { $in: rule.animalCriteria.breedIds };
  }
  
  if (rule.animalCriteria.genders && rule.animalCriteria.genders.length > 0) {
    query.gender = { $in: rule.animalCriteria.genders };
  }
  
  if (rule.animalCriteria.specificAnimals && rule.animalCriteria.specificAnimals.length > 0) {
    query._id = { $in: rule.animalCriteria.specificAnimals };
  }
  
  // يمكن إضافة معايير العمر والوزن هنا
  
  return await Animal.find(query);
};

// إنشاء فهارس للبحث السريع
FeedingScheduleSchema.index({ userId: 1, isActive: 1 });
FeedingScheduleSchema.index({ 'applicationRules.feedType.inventoryItemId': 1 });

const FeedingSchedule = mongoose.model('FeedingSchedule', FeedingScheduleSchema);

module.exports = FeedingSchedule;