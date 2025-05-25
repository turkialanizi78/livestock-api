// backend/controllers/feedingScheduleController.js
const FeedingSchedule = require('../models/FeedingSchedule');
const FeedingRecord = require('../models/FeedingRecord');
const Animal = require('../models/Animal');
const InventoryItem = require('../models/InventoryItem');
const FeedCalculationTemplate = require('../models/FeedCalculationTemplate');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');

// @desc    الحصول على جميع جداول التغذية
// @route   GET /api/feeding-schedules
// @access  Private
exports.getFeedingSchedules = asyncHandler(async (req, res) => {
  let query = { userId: req.user.id };

  // فلترة حسب الحالة
  if (req.query.isActive !== undefined) {
    query.isActive = req.query.isActive === 'true';
  }

  // فلترة حسب نوع الجدولة
  if (req.query.scheduleType) {
    query.scheduleType = req.query.scheduleType;
  }

  const schedules = await FeedingSchedule.find(query)
    .populate('applicationRules.animalCriteria.categoryIds', 'name')
    .populate('applicationRules.animalCriteria.breedIds', 'name')
    .populate('applicationRules.feedType.inventoryItemId', 'name unit availableQuantity')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: schedules.length,
    data: schedules
  });
});

// @desc    الحصول على جدولة تغذية واحدة
// @route   GET /api/feeding-schedules/:id
// @access  Private
exports.getFeedingSchedule = asyncHandler(async (req, res) => {
  const schedule = await FeedingSchedule.findOne({
    _id: req.params.id,
    userId: req.user.id
  })
    .populate('applicationRules.animalCriteria.categoryIds', 'name')
    .populate('applicationRules.animalCriteria.breedIds', 'name')
    .populate('applicationRules.animalCriteria.specificAnimals', 'identificationNumber name')
    .populate('applicationRules.feedType.inventoryItemId', 'name unit availableQuantity unitPrice');

  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: 'جدولة التغذية غير موجودة'
    });
  }

  res.status(200).json({
    success: true,
    data: schedule
  });
});

// @desc    إنشاء جدولة تغذية جديدة
// @route   POST /api/feeding-schedules
// @access  Private
exports.createFeedingSchedule = asyncHandler(async (req, res) => {
  // إضافة معرف المستخدم
  req.body.userId = req.user.id;

  // التحقق من صحة أوقات التغذية
  if (req.body.feedingTimes && req.body.feedingTimes.length > 0) {
    for (const feedingTime of req.body.feedingTimes) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(feedingTime.time)) {
        return res.status(400).json({
          success: false,
          message: `وقت التغذية ${feedingTime.time} غير صحيح. يجب أن يكون بتنسيق HH:MM`
        });
      }
    }
  }

  // التحقق من وجود أنواع العلف في المخزون
  if (req.body.applicationRules && req.body.applicationRules.length > 0) {
    for (const rule of req.body.applicationRules) {
      if (rule.feedType && rule.feedType.inventoryItemId) {
        const feedItem = await InventoryItem.findOne({
          _id: rule.feedType.inventoryItemId,
          userId: req.user.id
        });

        if (!feedItem) {
          return res.status(404).json({
            success: false,
            message: `نوع العلف ${rule.feedType.name} غير موجود في المخزون`
          });
        }

        // تحديث اسم العلف
        rule.feedType.name = feedItem.name;
      }
    }
  }

  const schedule = await FeedingSchedule.create(req.body);

  // إعادة جلب الجدولة مع البيانات المرتبطة
  const populatedSchedule = await FeedingSchedule.findById(schedule._id)
    .populate('applicationRules.animalCriteria.categoryIds', 'name')
    .populate('applicationRules.animalCriteria.breedIds', 'name')
    .populate('applicationRules.feedType.inventoryItemId', 'name unit availableQuantity');

  res.status(201).json({
    success: true,
    data: populatedSchedule
  });
});

// @desc    تحديث جدولة تغذية
// @route   PUT /api/feeding-schedules/:id
// @access  Private
exports.updateFeedingSchedule = asyncHandler(async (req, res) => {
  let schedule = await FeedingSchedule.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: 'جدولة التغذية غير موجودة'
    });
  }

  // التحقق من صحة أوقات التغذية الجديدة
  if (req.body.feedingTimes && req.body.feedingTimes.length > 0) {
    for (const feedingTime of req.body.feedingTimes) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(feedingTime.time)) {
        return res.status(400).json({
          success: false,
          message: `وقت التغذية ${feedingTime.time} غير صحيح. يجب أن يكون بتنسيق HH:MM`
        });
      }
    }
  }

  schedule = await FeedingSchedule.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  })
    .populate('applicationRules.animalCriteria.categoryIds', 'name')
    .populate('applicationRules.animalCriteria.breedIds', 'name')
    .populate('applicationRules.feedType.inventoryItemId', 'name unit availableQuantity');

  res.status(200).json({
    success: true,
    data: schedule
  });
});

// @desc    حذف جدولة تغذية
// @route   DELETE /api/feeding-schedules/:id
// @access  Private
exports.deleteFeedingSchedule = asyncHandler(async (req, res) => {
  const schedule = await FeedingSchedule.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: 'جدولة التغذية غير موجودة'
    });
  }

  // التحقق من وجود سجلات تغذية مرتبطة
  const relatedRecords = await FeedingRecord.countDocuments({
    scheduledFeedingId: schedule._id
  });

  if (relatedRecords > 0 && req.query.force !== 'true') {
    return res.status(400).json({
      success: false,
      message: `هناك ${relatedRecords} سجل تغذية مرتبط بهذه الجدولة. أضف معلمة force=true لحذف الجدولة وإزالة الربط`
    });
  }

  // إزالة الربط من سجلات التغذية
  if (relatedRecords > 0) {
    await FeedingRecord.updateMany(
      { scheduledFeedingId: schedule._id },
      { $unset: { scheduledFeedingId: 1 } }
    );
  }

  await FeedingSchedule.findByIdAndDelete(schedule._id);

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    تفعيل جدولة تغذية
// @route   PUT /api/feeding-schedules/:id/activate
// @access  Private
exports.activateSchedule = asyncHandler(async (req, res) => {
  const schedule = await FeedingSchedule.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: 'جدولة التغذية غير موجودة'
    });
  }

  schedule.isActive = true;
  await schedule.save();

  res.status(200).json({
    success: true,
    message: 'تم تفعيل جدولة التغذية',
    data: schedule
  });
});

// @desc    إلغاء تفعيل جدولة تغذية
// @route   PUT /api/feeding-schedules/:id/deactivate
// @access  Private
exports.deactivateSchedule = asyncHandler(async (req, res) => {
  const schedule = await FeedingSchedule.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: 'جدولة التغذية غير موجودة'
    });
  }

  schedule.isActive = false;
  await schedule.save();

  res.status(200).json({
    success: true,
    message: 'تم إلغاء تفعيل جدولة التغذية',
    data: schedule
  });
});

// @desc    تنفيذ جدولة تغذية
// @route   POST /api/feeding-schedules/:id/execute
// @access  Private
exports.executeSchedule = asyncHandler(async (req, res) => {
  const schedule = await FeedingSchedule.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: 'جدولة التغذية غير موجودة'
    });
  }

  if (!schedule.isActive) {
    return res.status(400).json({
      success: false,
      message: 'جدولة التغذية غير مفعلة'
    });
  }

  const { executionTime, ruleIndex = 0, feedingTimeIndex = 0 } = req.body;

  if (!schedule.applicationRules[ruleIndex]) {
    return res.status(400).json({
      success: false,
      message: 'القاعدة المحددة غير موجودة'
    });
  }

  if (!schedule.feedingTimes[feedingTimeIndex]) {
    return res.status(400).json({
      success: false,
      message: 'وقت التغذية المحدد غير موجود'
    });
  }

  const rule = schedule.applicationRules[ruleIndex];
  const feedingTime = schedule.feedingTimes[feedingTimeIndex];

  // الحصول على الحيوانات المؤهلة
  const eligibleAnimals = await schedule.getEligibleAnimals(ruleIndex);

  if (eligibleAnimals.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'لا توجد حيوانات مؤهلة لهذه القاعدة'
    });
  }

  // حساب كميات العلف لكل حيوان
  let totalAmount = 0;
  const animalFeedings = [];

  for (const animal of eligibleAnimals) {
    let amount = 0;

    switch (rule.calculationMethod) {
      case 'percentage_of_weight':
        amount = (animal.weight?.currentWeight || 0) * (rule.calculationParams.percentage || 3) / 100;
        break;
      case 'fixed_amount':
        amount = rule.calculationParams.fixedAmount || 0;
        break;
      case 'custom_formula':
        // تقييم المعادلة المخصصة
        try {
          const formula = rule.calculationParams.formula || '0';
          amount = eval(formula.replace('weight', animal.weight?.currentWeight || 0));
        } catch (error) {
          amount = rule.calculationParams.fixedAmount || 2;
        }
        break;
    }

    // تطبيق الحدود
    if (rule.calculationParams.minAmount && amount < rule.calculationParams.minAmount) {
      amount = rule.calculationParams.minAmount;
    }
    if (rule.calculationParams.maxAmount && amount > rule.calculationParams.maxAmount) {
      amount = rule.calculationParams.maxAmount;
    }

    animalFeedings.push({
      animalId: animal._id,
      animalIdentification: animal.identificationNumber,
      weight: animal.weight?.currentWeight,
      calculatedAmount: amount
    });

    totalAmount += amount;
  }

  // إنشاء سجل التغذية
  const feedingRecordData = {
    animals: animalFeedings,
    feedType: {
      inventoryItemId: rule.feedType.inventoryItemId,
      name: rule.feedType.name,
      unit: 'kg' // افتراضي
    },
    totalAmount,
    calculationMethod: 'automatic',
    calculationCriteria: {
      [rule.calculationMethod]: rule.calculationParams[rule.calculationMethod === 'percentage_of_weight' ? 'percentage' : 'fixedAmount']
    },
    feedingDate: executionTime ? new Date(executionTime) : new Date(),
    feedingTime: feedingTime.time,
    fedBy: req.user.name || 'النظام التلقائي',
    scheduledFeedingId: schedule._id,
    feedingType: 'regular',
    userId: req.user.id
  };

  // استدعاء controller إنشاء سجل التغذية
  req.body = feedingRecordData;
  const result = await exports.createFeedingRecord(req, {
    status: (statusCode) => ({
      json: (data) => ({ statusCode, ...data })
    })
  });

  if (result.statusCode === 201) {
    // تحديث إحصائيات الجدولة
    schedule.stats.totalExecutions += 1;
    schedule.stats.lastExecuted = new Date();
    schedule.stats.totalAnimalsAffected += eligibleAnimals.length;
    
    if (result.data && result.data.cost) {
      const newAverageCost = ((schedule.stats.averageCost || 0) * (schedule.stats.totalExecutions - 1) + result.data.cost.totalCost) / schedule.stats.totalExecutions;
      schedule.stats.averageCost = newAverageCost;
    }

    await schedule.save();

    res.status(200).json({
      success: true,
      message: 'تم تنفيذ جدولة التغذية بنجاح',
      data: {
        feedingRecord: result.data,
        executionStats: {
          animalsAffected: eligibleAnimals.length,
          totalAmount,
          feedType: rule.feedType.name,
          executionTime: feedingRecordData.feedingDate
        }
      }
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'فشل في تنفيذ جدولة التغذية',
      error: result.message
    });
  }
});

// @desc    معاينة جدولة التغذية قبل التنفيذ
// @route   GET /api/feeding-schedules/:id/preview
// @access  Private
exports.getSchedulePreview = asyncHandler(async (req, res) => {
  const schedule = await FeedingSchedule.findOne({
    _id: req.params.id,
    userId: req.user.id
  }).populate('applicationRules.feedType.inventoryItemId', 'name unit availableQuantity unitPrice');

  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: 'جدولة التغذية غير موجودة'
    });
  }

  const ruleIndex = parseInt(req.query.ruleIndex) || 0;
  const rule = schedule.applicationRules[ruleIndex];

  if (!rule) {
    return res.status(400).json({
      success: false,
      message: 'القاعدة المحددة غير موجودة'
    });
  }

  // الحصول على الحيوانات المؤهلة
  const eligibleAnimals = await schedule.getEligibleAnimals(ruleIndex);

  // حساب كميات العلف والتكاليف
  let totalAmount = 0;
  let totalCost = 0;
  const animalPreviews = [];

  const feedItem = rule.feedType.inventoryItemId;
  const unitPrice = feedItem?.unitPrice || 0;

  for (const animal of eligibleAnimals) {
    let amount = 0;

    switch (rule.calculationMethod) {
      case 'percentage_of_weight':
        amount = (animal.weight?.currentWeight || 0) * (rule.calculationParams.percentage || 3) / 100;
        break;
      case 'fixed_amount':
        amount = rule.calculationParams.fixedAmount || 0;
        break;
      case 'custom_formula':
        try {
          const formula = rule.calculationParams.formula || '0';
          amount = eval(formula.replace('weight', animal.weight?.currentWeight || 0));
        } catch (error) {
          amount = rule.calculationParams.fixedAmount || 2;
        }
        break;
    }

    // تطبيق الحدود
    if (rule.calculationParams.minAmount && amount < rule.calculationParams.minAmount) {
      amount = rule.calculationParams.minAmount;
    }
    if (rule.calculationParams.maxAmount && amount > rule.calculationParams.maxAmount) {
      amount = rule.calculationParams.maxAmount;
    }

    const cost = amount * unitPrice;

    animalPreviews.push({
      animalId: animal._id,
      identificationNumber: animal.identificationNumber,
      name: animal.name,
      weight: animal.weight?.currentWeight || 0,
      calculatedAmount: Math.round(amount * 100) / 100,
      estimatedCost: Math.round(cost * 100) / 100
    });

    totalAmount += amount;
    totalCost += cost;
  }

  // التحقق من توفر الكمية في المخزون
  const availableQuantity = feedItem?.availableQuantity || 0;
  const isAvailable = totalAmount <= availableQuantity;

  res.status(200).json({
    success: true,
    data: {
      schedule: {
        id: schedule._id,
        name: schedule.name,
        feedingTimes: schedule.feedingTimes
      },
      rule: {
        feedType: rule.feedType.name,
        calculationMethod: rule.calculationMethod,
        calculationParams: rule.calculationParams
      },
      preview: {
        eligibleAnimalsCount: eligibleAnimals.length,
        totalAmount: Math.round(totalAmount * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        averageAmountPerAnimal: eligibleAnimals.length > 0 ? Math.round((totalAmount / eligibleAnimals.length) * 100) / 100 : 0,
        isAvailable,
        availableQuantity,
        shortfall: !isAvailable ? Math.round((totalAmount - availableQuantity) * 100) / 100 : 0
      },
      animals: animalPreviews,
      feedInfo: feedItem ? {
        name: feedItem.name,
        unit: feedItem.unit,
        availableQuantity: feedItem.availableQuantity,
        unitPrice: feedItem.unitPrice
      } : null
    }
  });
});

// @desc    الحصول على الحيوانات المؤهلة لقاعدة معينة
// @route   GET /api/feeding-schedules/:id/eligible-animals
// @access  Private
exports.getEligibleAnimals = asyncHandler(async (req, res) => {
  const schedule = await FeedingSchedule.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: 'جدولة التغذية غير موجودة'
    });
  }

  const ruleIndex = parseInt(req.query.ruleIndex) || 0;
  const eligibleAnimals = await schedule.getEligibleAnimals(ruleIndex);

  res.status(200).json({
    success: true,
    count: eligibleAnimals.length,
    data: eligibleAnimals
  });
});

// @desc    تكرار جدولة تغذية
// @route   POST /api/feeding-schedules/:id/duplicate
// @access  Private
exports.duplicateSchedule = asyncHandler(async (req, res) => {
  const originalSchedule = await FeedingSchedule.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!originalSchedule) {
    return res.status(404).json({
      success: false,
      message: 'جدولة التغذية غير موجودة'
    });
  }

  // إنشاء نسخة جديدة
  const duplicateData = originalSchedule.toObject();
  delete duplicateData._id;
  delete duplicateData.createdAt;
  delete duplicateData.updatedAt;
  delete duplicateData.stats;
  
  duplicateData.name = `${duplicateData.name} - نسخة`;
  duplicateData.isActive = false; // تبدأ غير مفعلة
  duplicateData.stats = {
    totalExecutions: 0,
    totalAnimalsAffected: 0,
    averageCost: 0
  };

  const newSchedule = await FeedingSchedule.create(duplicateData);

  res.status(201).json({
    success: true,
    message: 'تم تكرار جدولة التغذية بنجاح',
    data: newSchedule
  });
});

// @desc    الحصول على إحصائيات جدولة معينة
// @route   GET /api/feeding-schedules/:id/stats
// @access  Private
exports.getScheduleStats = asyncHandler(async (req, res) => {
  const schedule = await FeedingSchedule.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!schedule) {
    return res.status(404).json({
      success: false,
      message: 'جدولة التغذية غير موجودة'
    });
  }

  // إحصائيات من سجلات التغذية المرتبطة
  const relatedRecords = await FeedingRecord.find({
    scheduledFeedingId: schedule._id
  });

  const totalRecords = relatedRecords.length;
  const totalCost = relatedRecords.reduce((sum, record) => sum + (record.cost?.totalCost || 0), 0);
  const totalAmount = relatedRecords.reduce((sum, record) => sum + record.totalAmount, 0);

  // إحصائيات أسبوعية
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const recentRecords = relatedRecords.filter(record => 
    new Date(record.feedingDate) >= last7Days
  );

  res.status(200).json({
    success: true,
    data: {
      schedule: {
        id: schedule._id,
        name: schedule.name,
        isActive: schedule.isActive,
        createdAt: schedule.createdAt
      },
      stats: {
        ...schedule.stats,
        fromRecords: {
          totalRecords,
          totalCost,
          totalAmount,
          averageCostPerRecord: totalRecords > 0 ? totalCost / totalRecords : 0,
          averageAmountPerRecord: totalRecords > 0 ? totalAmount / totalRecords : 0
        },
        recent: {
          recordsLast7Days: recentRecords.length,
          costLast7Days: recentRecords.reduce((sum, record) => sum + (record.cost?.totalCost || 0), 0),
          amountLast7Days: recentRecords.reduce((sum, record) => sum + record.totalAmount, 0)
        }
      }
    }
  });
});