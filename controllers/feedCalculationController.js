// backend/controllers/feedCalculationController.js
const FeedCalculationTemplate = require('../models/FeedCalculationTemplate');
const Animal = require('../models/Animal');
const AnimalCategory = require('../models/AnimalCategory');
const AnimalBreed = require('../models/AnimalBreed');
const InventoryItem = require('../models/InventoryItem');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');

// @desc    الحصول على جميع قوالب حساب التغذية
// @route   GET /api/feed-calculation
// @access  Private
exports.getFeedTemplates = asyncHandler(async (req, res) => {
  let query = { userId: req.user.id };

  // فلترة حسب نوع القالب
  if (req.query.templateType) {
    query.templateType = req.query.templateType;
  }

  // فلترة حسب الحالة
  if (req.query.isActive !== undefined) {
    query.isActive = req.query.isActive === 'true';
  }

  // فلترة حسب الفئة
  if (req.query.categoryId) {
    query['applicableTo.categoryIds'] = req.query.categoryId;
  }

  const templates = await FeedCalculationTemplate.find(query)
    .populate('applicableTo.categoryIds', 'name')
    .populate('applicableTo.breedIds', 'name')
    .populate('calculationRules.feedTypeId', 'name unit unitPrice')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: templates.length,
    data: templates
  });
});

// @desc    الحصول على قالب حساب واحد
// @route   GET /api/feed-calculation/:id
// @access  Private
exports.getFeedTemplate = asyncHandler(async (req, res) => {
  const template = await FeedCalculationTemplate.findOne({
    _id: req.params.id,
    userId: req.user.id
  })
    .populate('applicableTo.categoryIds', 'name')
    .populate('applicableTo.breedIds', 'name')
    .populate('calculationRules.feedTypeId', 'name unit unitPrice availableQuantity');

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'قالب الحساب غير موجود'
    });
  }

  res.status(200).json({
    success: true,
    data: template
  });
});

// @desc    إنشاء قالب حساب جديد
// @route   POST /api/feed-calculation
// @access  Private
exports.createFeedTemplate = asyncHandler(async (req, res) => {
  // إضافة معرف المستخدم
  req.body.userId = req.user.id;

  // التحقق من وجود أنواع العلف في قواعد الحساب
  if (req.body.calculationRules && req.body.calculationRules.length > 0) {
    for (const rule of req.body.calculationRules) {
      if (rule.feedTypeId) {
        const feedItem = await InventoryItem.findOne({
          _id: rule.feedTypeId,
          userId: req.user.id
        });

        if (!feedItem) {
          return res.status(404).json({
            success: false,
            message: `نوع العلف ${rule.feedTypeName} غير موجود في المخزون`
          });
        }

        // تحديث اسم العلف
        rule.feedTypeName = feedItem.name;
      }
    }
  }

  // التحقق من صحة أوقات التغذية
  if (req.body.calculationRules) {
    for (const rule of req.body.calculationRules) {
      if (rule.feedingTimes && rule.feedingTimes.length > 0) {
        for (const feedingTime of rule.feedingTimes) {
          const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
          if (!timeRegex.test(feedingTime.time)) {
            return res.status(400).json({
              success: false,
              message: `وقت التغذية ${feedingTime.time} غير صحيح. يجب أن يكون بتنسيق HH:MM`
            });
          }
        }
      }
    }
  }

  const template = await FeedCalculationTemplate.create(req.body);

  // إعادة جلب القالب مع البيانات المرتبطة
  const populatedTemplate = await FeedCalculationTemplate.findById(template._id)
    .populate('applicableTo.categoryIds', 'name')
    .populate('applicableTo.breedIds', 'name')
    .populate('calculationRules.feedTypeId', 'name unit unitPrice');

  res.status(201).json({
    success: true,
    data: populatedTemplate
  });
});

// @desc    تحديث قالب حساب
// @route   PUT /api/feed-calculation/:id
// @access  Private
exports.updateFeedTemplate = asyncHandler(async (req, res) => {
  let template = await FeedCalculationTemplate.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'قالب الحساب غير موجود'
    });
  }

  // التحقق من وجود أنواع العلف الجديدة
  if (req.body.calculationRules && req.body.calculationRules.length > 0) {
    for (const rule of req.body.calculationRules) {
      if (rule.feedTypeId) {
        const feedItem = await InventoryItem.findOne({
          _id: rule.feedTypeId,
          userId: req.user.id
        });

        if (!feedItem) {
          return res.status(404).json({
            success: false,
            message: `نوع العلف ${rule.feedTypeName} غير موجود في المخزون`
          });
        }

        rule.feedTypeName = feedItem.name;
      }
    }
  }

  template = await FeedCalculationTemplate.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  })
    .populate('applicableTo.categoryIds', 'name')
    .populate('applicableTo.breedIds', 'name')
    .populate('calculationRules.feedTypeId', 'name unit unitPrice');

  res.status(200).json({
    success: true,
    data: template
  });
});

// @desc    حذف قالب حساب
// @route   DELETE /api/feed-calculation/:id
// @access  Private
exports.deleteFeedTemplate = asyncHandler(async (req, res) => {
  const template = await FeedCalculationTemplate.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'قالب الحساب غير موجود'
    });
  }

  await FeedCalculationTemplate.findByIdAndDelete(template._id);

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    اختبار قالب حساب مع حيوان معين
// @route   POST /api/feed-calculation/:id/test
// @access  Private
exports.testTemplate = asyncHandler(async (req, res) => {
  const template = await FeedCalculationTemplate.findOne({
    _id: req.params.id,
    userId: req.user.id
  }).populate('calculationRules.feedTypeId', 'name unit unitPrice');

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'قالب الحساب غير موجود'
    });
  }

  const { animalId, conditions = {} } = req.body;

  if (!animalId) {
    return res.status(400).json({
      success: false,
      message: 'يرجى تحديد معرف الحيوان للاختبار'
    });
  }

  // جلب بيانات الحيوان
  const animal = await Animal.findOne({
    _id: animalId,
    userId: req.user.id
  }).populate('categoryId', 'name')
    .populate('breedId', 'name');

  if (!animal) {
    return res.status(404).json({
      success: false,
      message: 'الحيوان غير موجود'
    });
  }

  // حساب كمية العلف باستخدام القالب
  const calculation = template.calculateFeedForAnimal(animal, conditions);

  // حساب التكلفة التقديرية
  let estimatedCost = 0;
  const detailedBreakdown = calculation.breakdown.map(item => {
    const rule = template.calculationRules.find(r => r.feedTypeName === item.feedType);
    const feedPrice = rule?.feedTypeId?.unitPrice || 0;
    const itemCost = item.amount * feedPrice;
    estimatedCost += itemCost;

    return {
      ...item,
      unitPrice: feedPrice,
      totalCost: Math.round(itemCost * 100) / 100
    };
  });

  res.status(200).json({
    success: true,
    data: {
      template: {
        id: template._id,
        name: template.name,
        templateType: template.templateType
      },
      animal: {
        id: animal._id,
        identificationNumber: animal.identificationNumber,
        name: animal.name,
        category: animal.categoryId?.name,
        breed: animal.breedId?.name,
        weight: animal.weight?.currentWeight || 0
      },
      calculation: {
        totalAmount: Math.round(calculation.totalAmount * 100) / 100,
        adjustmentFactor: calculation.adjustmentFactor || 1,
        adjustments: calculation.adjustments || [],
        estimatedCost: Math.round(estimatedCost * 100) / 100
      },
      breakdown: detailedBreakdown,
      conditions
    }
  });
});

// @desc    حساب العلف لمجموعة من الحيوانات
// @route   POST /api/feed-calculation/calculate
// @access  Private
exports.calculateFeedForAnimals = asyncHandler(async (req, res) => {
  const { templateId, animalIds, conditions = {} } = req.body;

  if (!templateId) {
    return res.status(400).json({
      success: false,
      message: 'يرجى تحديد معرف القالب'
    });
  }

  if (!animalIds || !Array.isArray(animalIds) || animalIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'يرجى تحديد قائمة الحيوانات'
    });
  }

  // جلب القالب
  const template = await FeedCalculationTemplate.findOne({
    _id: templateId,
    userId: req.user.id
  }).populate('calculationRules.feedTypeId', 'name unit unitPrice availableQuantity');

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'قالب الحساب غير موجود'
    });
  }

  // جلب الحيوانات
  const animals = await Animal.find({
    _id: { $in: animalIds },
    userId: req.user.id
  }).populate('categoryId', 'name')
    .populate('breedId', 'name');

  if (animals.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'لم يتم العثور على حيوانات'
    });
  }

  // حساب العلف لكل حيوان
  const animalCalculations = [];
  const feedTotals = {};
  let totalCost = 0;

  for (const animal of animals) {
    const calculation = template.calculateFeedForAnimal(animal, conditions);
    
    // حساب التكلفة لهذا الحيوان
    let animalCost = 0;
    const detailedBreakdown = calculation.breakdown.map(item => {
      const rule = template.calculationRules.find(r => r.feedTypeName === item.feedType);
      const feedPrice = rule?.feedTypeId?.unitPrice || 0;
      const itemCost = item.amount * feedPrice;
      animalCost += itemCost;

      // تجميع الكميات حسب نوع العلف
      if (!feedTotals[item.feedType]) {
        feedTotals[item.feedType] = {
          feedTypeId: rule?.feedTypeId?._id,
          feedTypeName: item.feedType,
          totalAmount: 0,
          unitPrice: feedPrice,
          totalCost: 0,
          availableQuantity: rule?.feedTypeId?.availableQuantity || 0,
          unit: rule?.feedTypeId?.unit || 'kg'
        };
      }
      feedTotals[item.feedType].totalAmount += item.amount;
      feedTotals[item.feedType].totalCost += itemCost;

      return {
        ...item,
        unitPrice: feedPrice,
        totalCost: Math.round(itemCost * 100) / 100
      };
    });

    totalCost += animalCost;

    animalCalculations.push({
      animal: {
        id: animal._id,
        identificationNumber: animal.identificationNumber,
        name: animal.name,
        weight: animal.weight?.currentWeight || 0
      },
      calculation: {
        totalAmount: Math.round(calculation.totalAmount * 100) / 100,
        adjustmentFactor: calculation.adjustmentFactor || 1,
        estimatedCost: Math.round(animalCost * 100) / 100
      },
      breakdown: detailedBreakdown
    });
  }

  // تجميع النتائج النهائية
  const feedSummary = Object.values(feedTotals).map(feed => ({
    ...feed,
    totalAmount: Math.round(feed.totalAmount * 100) / 100,
    totalCost: Math.round(feed.totalCost * 100) / 100,
    isAvailable: feed.totalAmount <= feed.availableQuantity,
    shortfall: feed.totalAmount > feed.availableQuantity ? 
      Math.round((feed.totalAmount - feed.availableQuantity) * 100) / 100 : 0
  }));

  res.status(200).json({
    success: true,
    data: {
      template: {
        id: template._id,
        name: template.name
      },
      summary: {
        totalAnimals: animals.length,
        totalCost: Math.round(totalCost * 100) / 100,
        averageCostPerAnimal: animals.length > 0 ? Math.round((totalCost / animals.length) * 100) / 100 : 0
      },
      feedSummary,
      animalCalculations,
      conditions
    }
  });
});

// @desc    الحصول على القوالب حسب الفئة
// @route   GET /api/feed-calculation/by-category/:categoryId
// @access  Private
exports.getTemplatesByCategory = asyncHandler(async (req, res) => {
  const categoryId = req.params.categoryId;

  // التحقق من وجود الفئة
  const category = await AnimalCategory.findOne({
    _id: categoryId,
    userId: req.user.id
  });

  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'فئة الحيوان غير موجودة'
    });
  }

  const templates = await FeedCalculationTemplate.find({
    userId: req.user.id,
    isActive: true,
    'applicableTo.categoryIds': categoryId
  })
    .populate('calculationRules.feedTypeId', 'name unit')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    category: {
      id: category._id,
      name: category.name
    },
    count: templates.length,
    data: templates
  });
});

// @desc    تكرار قالب حساب
// @route   POST /api/feed-calculation/:id/duplicate
// @access  Private
exports.duplicateTemplate = asyncHandler(async (req, res) => {
  const originalTemplate = await FeedCalculationTemplate.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!originalTemplate) {
    return res.status(404).json({
      success: false,
      message: 'قالب الحساب غير موجود'
    });
  }

  // إنشاء نسخة جديدة
  const duplicateData = originalTemplate.toObject();
  delete duplicateData._id;
  delete duplicateData.createdAt;
  delete duplicateData.updatedAt;
  delete duplicateData.usageStats;
  
  duplicateData.name = `${duplicateData.name} - نسخة`;
  duplicateData.isActive = false; // تبدأ غير مفعلة
  duplicateData.usageStats = {
    timesUsed: 0,
    animalsAffected: 0
  };

  const newTemplate = await FeedCalculationTemplate.create(duplicateData);

  res.status(201).json({
    success: true,
    message: 'تم تكرار قالب الحساب بنجاح',
    data: newTemplate
  });
});

// @desc    الحصول على القوالب الافتراضية
// @route   GET /api/feed-calculation/defaults
// @access  Private
exports.getDefaultTemplates = asyncHandler(async (req, res) => {
  // قوالب افتراضية أساسية لكل فئة من الحيوانات
  const defaultTemplates = [
    {
      name: "قالب أساسي للأغنام",
      templateType: "weight_based",
      description: "قالب حساب أساسي للأغنام بناءً على الوزن",
      calculationRules: [{
        method: "percentage_of_weight",
        parameters: {
          percentage: 3, // 3% من وزن الجسم
          multiplier: 1,
          baseAmount: 0
        },
        limits: {
          minAmount: 1,
          maxAmount: 5
        }
      }],
      adjustmentFactors: {
        pregnant: 1.2,
        lactating: 1.5,
        young: 1.3,
        old: 0.9
      }
    },
    {
      name: "قالب أساسي للأبقار",
      templateType: "weight_based",
      description: "قالب حساب أساسي للأبقار بناءً على الوزن",
      calculationRules: [{
        method: "percentage_of_weight",
        parameters: {
          percentage: 2.5, // 2.5% من وزن الجسم
          multiplier: 1,
          baseAmount: 0
        },
        limits: {
          minAmount: 8,
          maxAmount: 25
        }
      }],
      adjustmentFactors: {
        pregnant: 1.15,
        lactating: 1.4,
        young: 1.25,
        old: 0.85
      }
    },
    {
      name: "قالب أساسي للماعز",
      templateType: "weight_based",
      description: "قالب حساب أساسي للماعز بناءً على الوزن",
      calculationRules: [{
        method: "percentage_of_weight",
        parameters: {
          percentage: 3.5, // 3.5% من وزن الجسم
          multiplier: 1,
          baseAmount: 0
        },
        limits: {
          minAmount: 0.8,
          maxAmount: 4
        }
      }],
      adjustmentFactors: {
        pregnant: 1.25,
        lactating: 1.6,
        young: 1.4,
        old: 0.9
      }
    }
  ];

  res.status(200).json({
    success: true,
    count: defaultTemplates.length,
    data: defaultTemplates
  });
});

// @desc    استيراد قالب حساب من ملف
// @route   POST /api/feed-calculation/import
// @access  Private
exports.importTemplate = asyncHandler(async (req, res) => {
  const { templateData } = req.body;

  if (!templateData) {
    return res.status(400).json({
      success: false,
      message: 'يرجى تقديم بيانات القالب'
    });
  }

  try {
    // التحقق من صحة البيانات
    const parsedTemplate = typeof templateData === 'string' ? 
      JSON.parse(templateData) : templateData;

    // إضافة معرف المستخدم وحذف المعرف القديم
    parsedTemplate.userId = req.user.id;
    delete parsedTemplate._id;
    delete parsedTemplate.createdAt;
    delete parsedTemplate.updatedAt;
    
    // إعطاء اسم جديد
    parsedTemplate.name = `${parsedTemplate.name} - مستورد`;
    
    // إنشاء القالب
    const template = await FeedCalculationTemplate.create(parsedTemplate);

    res.status(201).json({
      success: true,
      message: 'تم استيراد قالب الحساب بنجاح',
      data: template
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'فشل في استيراد القالب: ' + error.message
    });
  }
});

// @desc    تصدير قالب حساب
// @route   GET /api/feed-calculation/:id/export
// @access  Private
exports.exportTemplate = asyncHandler(async (req, res) => {
  const template = await FeedCalculationTemplate.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'قالب الحساب غير موجود'
    });
  }

  // إنشاء نسخة للتصدير (بدون معلومات حساسة)
  const exportData = template.toObject();
  delete exportData._id;
  delete exportData.userId;
  delete exportData.createdAt;
  delete exportData.updatedAt;
  delete exportData.usageStats;

  res.status(200).json({
    success: true,
    data: exportData,
    meta: {
      exportedAt: new Date(),
      templateName: template.name,
      version: '1.0'
    }
  });
});