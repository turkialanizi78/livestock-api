// backend/models/FeedCalculationTemplate.js
const mongoose = require('mongoose');

const FeedCalculationTemplateSchema = new mongoose.Schema({
  // اسم القالب
  name: {
    type: String,
    required: [true, 'يرجى إدخال اسم القالب'],
    trim: true
  },
  
  // نوع القالب
  templateType: {
    type: String,
    enum: ['category_based', 'age_based', 'weight_based', 'production_based', 'custom'],
    default: 'weight_based'
  },
  
  // معايير التطبيق
  applicableTo: {
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
    gender: { type: String, enum: ['male', 'female', 'both'], default: 'both' },
    productionStage: { 
      type: String, 
      enum: ['growing', 'adult', 'pregnant', 'lactating', 'breeding'], 
      default: 'adult' 
    }
  },
  
  // قواعد الحساب
  calculationRules: [{
    feedTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true
    },
    feedTypeName: { type: String, required: true },
    
    // طريقة الحساب
    method: {
      type: String,
      enum: ['percentage_of_weight', 'fixed_amount', 'per_kg_bodyweight', 'formula'],
      required: true
    },
    
    // معاملات الحساب
    parameters: {
      percentage: { type: Number }, // نسبة من وزن الجسم
      fixedAmount: { type: Number }, // كمية ثابتة
      amountPerKg: { type: Number }, // كمية لكل كيلو من وزن الجسم
      formula: { type: String }, // معادلة مخصصة
      multiplier: { type: Number, default: 1 }, // معامل ضرب
      baseAmount: { type: Number, default: 0 } // كمية أساسية
    },
    
    // حدود الكمية
    limits: {
      minAmount: { type: Number },
      maxAmount: { type: Number }
    },
    
    // أوقات التطبيق
    feedingTimes: [{
      time: { type: String }, // مثل "07:30"
      percentage: { type: Number, default: 100 } // نسبة من الكمية الإجمالية
    }],
    
    // شروط خاصة
    conditions: {
      weather: [{ type: String, enum: ['hot', 'cold', 'normal', 'rainy'] }],
      season: [{ type: String, enum: ['spring', 'summer', 'autumn', 'winter'] }],
      activityLevel: { type: String, enum: ['low', 'medium', 'high'] }
    }
  }],
  
  // معاملات تعديل خاصة
  adjustmentFactors: {
    pregnant: { type: Number, default: 1.2 }, // زيادة 20% للحامل
    lactating: { type: Number, default: 1.5 }, // زيادة 50% للمرضع
    young: { type: Number, default: 1.3 }, // زيادة 30% للصغار
    old: { type: Number, default: 0.9 }, // تقليل 10% للكبار
    sick: { type: Number, default: 0.8 }, // تقليل 20% للمرضى
    hotWeather: { type: Number, default: 0.95 }, // تقليل 5% في الطقس الحار
    coldWeather: { type: Number, default: 1.1 } // زيادة 10% في الطقس البارد
  },
  
  // معلومات إضافية
  description: {
    type: String,
    trim: true
  },
  
  notes: {
    type: String,
    trim: true
  },
  
  // المصدر أو المرجع
  source: {
    type: String,
    trim: true
  },
  
  // حالة التنشيط
  isActive: {
    type: Boolean,
    default: true
  },
  
  // تاريخ الصلاحية
  validFrom: {
    type: Date,
    default: Date.now
  },
  validTo: {
    type: Date
  },
  
  // إحصائيات الاستخدام
  usageStats: {
    timesUsed: { type: Number, default: 0 },
    animalsAffected: { type: Number, default: 0 },
    lastUsed: { type: Date }
  },
  
  // معرف المستخدم
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

// دالة لحساب كمية العلف لحيوان محدد
FeedCalculationTemplateSchema.methods.calculateFeedForAnimal = function(animal, conditions = {}) {
  const result = {
    totalAmount: 0,
    breakdown: [],
    adjustments: []
  };
  
  // تطبيق قواعد الحساب
  this.calculationRules.forEach(rule => {
    let amount = 0;
    
    switch (rule.method) {
      case 'percentage_of_weight':
        amount = (animal.weight?.currentWeight || 0) * (rule.parameters.percentage || 0) / 100;
        break;
      case 'fixed_amount':
        amount = rule.parameters.fixedAmount || 0;
        break;
      case 'per_kg_bodyweight':
        amount = (animal.weight?.currentWeight || 0) * (rule.parameters.amountPerKg || 0);
        break;
      case 'formula':
        // تقييم المعادلة المخصصة (يمكن تطوير هذا أكثر)
        amount = eval(rule.parameters.formula?.replace('weight', animal.weight?.currentWeight || 0) || '0');
        break;
    }
    
    // تطبيق المعاملات
    amount = amount * (rule.parameters.multiplier || 1) + (rule.parameters.baseAmount || 0);
    
    // تطبيق الحدود
    if (rule.limits.minAmount && amount < rule.limits.minAmount) {
      amount = rule.limits.minAmount;
    }
    if (rule.limits.maxAmount && amount > rule.limits.maxAmount) {
      amount = rule.limits.maxAmount;
    }
    
    result.breakdown.push({
      feedType: rule.feedTypeName,
      amount: amount,
      method: rule.method
    });
    
    result.totalAmount += amount;
  });
  
  // تطبيق معاملات التعديل
  let adjustmentFactor = 1;
  
  if (conditions.isPregnant && this.adjustmentFactors.pregnant) {
    adjustmentFactor *= this.adjustmentFactors.pregnant;
    result.adjustments.push('حامل');
  }
  
  if (conditions.isLactating && this.adjustmentFactors.lactating) {
    adjustmentFactor *= this.adjustmentFactors.lactating;
    result.adjustments.push('مرضع');
  }
  
  // يمكن إضافة المزيد من التعديلات هنا
  
  result.totalAmount *= adjustmentFactor;
  result.adjustmentFactor = adjustmentFactor;
  
  return result;
};

// إنشاء فهارس
FeedCalculationTemplateSchema.index({ userId: 1, isActive: 1 });
FeedCalculationTemplateSchema.index({ templateType: 1 });
FeedCalculationTemplateSchema.index({ 'applicableTo.categoryIds': 1 });

const FeedCalculationTemplate = mongoose.model('FeedCalculationTemplate', FeedCalculationTemplateSchema);

module.exports = FeedCalculationTemplate;