// backend/controllers/feedingController.js
const FeedingRecord = require('../models/FeedingRecord');
const FeedingSchedule = require('../models/FeedingSchedule');
const InventoryItem = require('../models/InventoryItem');
const InventoryTransaction = require('../models/InventoryTransaction');
const Animal = require('../models/Animal');
const FeedCalculationTemplate = require('../models/FeedCalculationTemplate');
const FinancialRecord = require('../models/FinancialRecord');
const asyncHandler = require('express-async-handler');
const { createNotification } = require('./notificationController');

// @desc    الحصول على جميع سجلات التغذية
// @route   GET /api/feeding
// @access  Private
exports.getFeedingRecords = asyncHandler(async (req, res) => {
  let query = { userId: req.user.id };

  // فلترة حسب التاريخ
  if (req.query.startDate || req.query.endDate) {
    query.feedingDate = {};
    
    if (req.query.startDate) {
      query.feedingDate.$gte = new Date(req.query.startDate);
    }
    
    if (req.query.endDate) {
      query.feedingDate.$lte = new Date(req.query.endDate);
    }
  }

  // فلترة حسب نوع العلف
  if (req.query.feedType) {
    query['feedType.inventoryItemId'] = req.query.feedType;
  }

  // فلترة حسب طريقة الحساب
  if (req.query.calculationMethod) {
    query.calculationMethod = req.query.calculationMethod;
  }

  // فلترة حسب الحيوان
  if (req.query.animalId) {
    query['animals.animalId'] = req.query.animalId;
  }

  // فلترة حسب المسؤول عن التغذية
  if (req.query.fedBy) {
    query.fedBy = { $regex: req.query.fedBy, $options: 'i' };
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const feedingRecords = await FeedingRecord.find(query)
    .populate('feedType.inventoryItemId', 'name unit unitPrice')
    .populate('animals.animalId', 'identificationNumber name')
    .populate('scheduledFeedingId', 'name')
    .sort({ feedingDate: -1, feedingTime: -1 })
    .skip(skip)
    .limit(limit);

  const total = await FeedingRecord.countDocuments(query);

  res.status(200).json({
    success: true,
    count: feedingRecords.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: feedingRecords
  });
});

// @desc    الحصول على سجل تغذية واحد
// @route   GET /api/feeding/:id
// @access  Private
exports.getFeedingRecord = asyncHandler(async (req, res) => {
  const feedingRecord = await FeedingRecord.findOne({
    _id: req.params.id,
    userId: req.user.id
  })
    .populate('feedType.inventoryItemId', 'name unit unitPrice')
    .populate('animals.animalId', 'identificationNumber name weight')
    .populate('scheduledFeedingId', 'name')
    .populate('inventoryTransactionId');

  if (!feedingRecord) {
    return res.status(404).json({
      success: false,
      message: 'سجل التغذية غير موجود'
    });
  }

  res.status(200).json({
    success: true,
    data: feedingRecord
  });
});

// @desc    إنشاء سجل تغذية جديد
// @route   POST /api/feeding
// @access  Private
exports.createFeedingRecord = asyncHandler(async (req, res) => {
  try {
    // إضافة معرف المستخدم
    req.body.userId = req.user.id;

    // التحقق من وجود العلف في المخزون
    const feedItem = await InventoryItem.findOne({
      _id: req.body.feedType.inventoryItemId,
      userId: req.user.id
    });

    if (!feedItem) {
      return res.status(404).json({
        success: false,
        message: 'نوع العلف غير موجود في المخزون'
      });
    }

    // التحقق من توفر الكمية المطلوبة
    if (req.body.totalAmount > feedItem.availableQuantity) {
      return res.status(400).json({
        success: false,
        message: `الكمية المطلوبة (${req.body.totalAmount}) أكبر من الكمية المتوفرة (${feedItem.availableQuantity})`
      });
    }

    // تعبئة معلومات العلف
    req.body.feedType.name = feedItem.name;
    req.body.feedType.unit = feedItem.unit;

    // حساب التكلفة
    req.body.cost = {
      unitCost: feedItem.unitPrice || 0,
      totalCost: (feedItem.unitPrice || 0) * req.body.totalAmount
    };

    // تعبئة أرقام تعريف الحيوانات
    if (req.body.animals && req.body.animals.length > 0) {
      for (let i = 0; i < req.body.animals.length; i++) {
        const animal = await Animal.findById(req.body.animals[i].animalId);
        if (animal) {
          req.body.animals[i].animalIdentification = animal.identificationNumber;
        }
      }
    }

    // إنشاء سجل التغذية
    const feedingRecord = await FeedingRecord.create(req.body);

    // خصم الكمية من المخزون
    const inventoryTransaction = await InventoryTransaction.create({
      inventoryItemId: feedItem._id,
      type: 'use',
      quantity: req.body.totalAmount,
      date: req.body.feedingDate || new Date(),
      unitPrice: feedItem.unitPrice || 0,
      totalPrice: (feedItem.unitPrice || 0) * req.body.totalAmount,
      reason: 'feeding',
      notes: `تغذية - ${feedingRecord.recordId}`,
      userId: req.user.id
    });

    // تحديث كمية المخزون
    feedItem.availableQuantity -= req.body.totalAmount;
    feedItem.isLowStock = feedItem.availableQuantity <= feedItem.lowStockThreshold;
    await feedItem.save();

    // ربط معاملة المخزون بسجل التغذية
    feedingRecord.inventoryTransactionId = inventoryTransaction._id;
    feedingRecord.inventoryDeducted = true;
    await feedingRecord.save();

    // إنشاء سجل مالي
    if (req.body.cost.totalCost > 0) {
      await FinancialRecord.create({
        type: 'expense',
        category: 'feed',
        amount: req.body.cost.totalCost,
        date: req.body.feedingDate || new Date(),
        description: `تكلفة تغذية - ${feedingRecord.recordId}`,
        relatedInventoryId: feedItem._id,
        userId: req.user.id
      });
    }

    // إنشاء تنبيه إذا أصبح المخزون منخفضًا
    if (feedItem.isLowStock) {
      await createNotification({
        userId: req.user.id,
        title: 'مخزون علف منخفض',
        message: `الكمية المتوفرة من ${feedItem.name} منخفضة (${feedItem.availableQuantity} ${feedItem.unit})`,
        type: 'inventory',
        relatedInventoryId: feedItem._id
      });
    }

    // إعادة جلب السجل مع البيانات المحدثة
    const populatedRecord = await FeedingRecord.findById(feedingRecord._id)
      .populate('feedType.inventoryItemId', 'name unit unitPrice')
      .populate('animals.animalId', 'identificationNumber name')
      .populate('inventoryTransactionId');

    res.status(201).json({
      success: true,
      data: populatedRecord
    });

  } catch (error) {
    console.error('Error creating feeding record:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    تحديث سجل تغذية
// @route   PUT /api/feeding/:id
// @access  Private
exports.updateFeedingRecord = asyncHandler(async (req, res) => {
  let feedingRecord = await FeedingRecord.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!feedingRecord) {
    return res.status(404).json({
      success: false,
      message: 'سجل التغذية غير موجود'
    });
  }

  // لا نسمح بتغيير الكمية أو نوع العلف بعد خصم المخزون
  if (feedingRecord.inventoryDeducted) {
    delete req.body.totalAmount;
    delete req.body.feedType;
  }

  feedingRecord = await FeedingRecord.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  })
    .populate('feedType.inventoryItemId', 'name unit unitPrice')
    .populate('animals.animalId', 'identificationNumber name')
    .populate('inventoryTransactionId');

  res.status(200).json({
    success: true,
    data: feedingRecord
  });
});

// @desc    حذف سجل تغذية
// @route   DELETE /api/feeding/:id
// @access  Private
exports.deleteFeedingRecord = asyncHandler(async (req, res) => {
  const feedingRecord = await FeedingRecord.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!feedingRecord) {
    return res.status(404).json({
      success: false,
      message: 'سجل التغذية غير موجود'
    });
  }

  // إعادة الكمية للمخزون إذا تم خصمها
  if (feedingRecord.inventoryDeducted && feedingRecord.inventoryTransactionId) {
    const inventoryItem = await InventoryItem.findById(feedingRecord.feedType.inventoryItemId);
    
    if (inventoryItem) {
      inventoryItem.availableQuantity += feedingRecord.totalAmount;
      inventoryItem.isLowStock = inventoryItem.availableQuantity <= inventoryItem.lowStockThreshold;
      await inventoryItem.save();
    }

    // حذف معاملة المخزون
    await InventoryTransaction.findByIdAndDelete(feedingRecord.inventoryTransactionId);

    // حذف السجل المالي المرتبط
    await FinancialRecord.deleteOne({
      description: `تكلفة تغذية - ${feedingRecord.recordId}`,
      userId: req.user.id
    });
  }

  await FeedingRecord.findByIdAndDelete(feedingRecord._id);

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    حساب كمية العلف تلقائياً
// @route   POST /api/feeding/calculate
// @access  Private
exports.calculateFeedAmount = asyncHandler(async (req, res) => {
  const { animals, feedTypeId, calculationMethod, templateId } = req.body;

  if (!animals || animals.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'يرجى تحديد الحيوانات'
    });
  }

  let totalAmount = 0;
  const breakdown = [];

  // استخدام قالب حساب إذا تم تحديده
  if (templateId) {
    const template = await FeedCalculationTemplate.findOne({
      _id: templateId,
      userId: req.user.id
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'قالب الحساب غير موجود'
      });
    }

    // حساب الكمية لكل حيوان باستخدام القالب
    for (const animalData of animals) {
      const animal = await Animal.findById(animalData.animalId);
      if (animal) {
        const calculation = template.calculateFeedForAnimal(animal, animalData.conditions || {});
        breakdown.push({
          animalId: animal._id,
          animalIdentification: animal.identificationNumber,
          calculatedAmount: calculation.totalAmount,
          method: 'template',
          details: calculation
        });
        totalAmount += calculation.totalAmount;
      }
    }
  } else {
    // حساب مباشر حسب الطريقة المحددة
    for (const animalData of animals) {
      const animal = await Animal.findById(animalData.animalId);
      if (animal) {
        let amount = 0;

        switch (calculationMethod.method) {
          case 'percentage_of_weight':
            amount = (animal.weight?.currentWeight || 0) * (calculationMethod.percentage || 3) / 100;
            break;
          case 'fixed_amount':
            amount = calculationMethod.fixedAmount || 0;
            break;
          case 'per_kg_bodyweight':
            amount = (animal.weight?.currentWeight || 0) * (calculationMethod.amountPerKg || 0.05);
            break;
          default:
            amount = calculationMethod.fixedAmount || 2; // افتراضي
        }

        breakdown.push({
          animalId: animal._id,
          animalIdentification: animal.identificationNumber,
          calculatedAmount: amount,
          method: calculationMethod.method,
          weight: animal.weight?.currentWeight || 0
        });
        totalAmount += amount;
      }
    }
  }

  // جلب معلومات العلف لحساب التكلفة
  let feedInfo = null;
  let estimatedCost = 0;

  if (feedTypeId) {
    feedInfo = await InventoryItem.findOne({
      _id: feedTypeId,
      userId: req.user.id
    });

    if (feedInfo) {
      estimatedCost = totalAmount * (feedInfo.unitPrice || 0);
    }
  }

  res.status(200).json({
    success: true,
    data: {
      totalAmount: Math.round(totalAmount * 100) / 100, // تقريب لرقمين عشريين
      breakdown,
      estimatedCost,
      feedInfo: feedInfo ? {
        name: feedInfo.name,
        unit: feedInfo.unit,
        availableQuantity: feedInfo.availableQuantity,
        unitPrice: feedInfo.unitPrice
      } : null,
      calculationMethod
    }
  });
});

// @desc    الحصول على إحصائيات التغذية
// @route   GET /api/feeding/stats
// @access  Private
exports.getFeedingStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
  const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

  // إحصائيات عامة
  const totalRecords = await FeedingRecord.countDocuments({
    userId,
    feedingDate: { $gte: startDate, $lte: endDate }
  });

  const totalCost = await FeedingRecord.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        feedingDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalCost: { $sum: '$cost.totalCost' },
        totalAmount: { $sum: '$totalAmount' }
      }
    }
  ]);

  // أكثر أنواع العلف استخداماً
  const topFeeds = await FeedingRecord.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        feedingDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$feedType.inventoryItemId',
        feedName: { $first: '$feedType.name' },
        totalAmount: { $sum: '$totalAmount' },
        totalCost: { $sum: '$cost.totalCost' },
        feedingCount: { $sum: 1 }
      }
    },
    { $sort: { totalAmount: -1 } },
    { $limit: 5 }
  ]);

  // إحصائيات يومية
  const dailyStats = await FeedingRecord.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        feedingDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$feedingDate" }
        },
        totalAmount: { $sum: '$totalAmount' },
        totalCost: { $sum: '$cost.totalCost' },
        feedingCount: { $sum: 1 },
        animalsCount: { $sum: { $size: '$animals' } }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      summary: {
        totalRecords,
        totalCost: totalCost[0]?.totalCost || 0,
        totalAmount: totalCost[0]?.totalAmount || 0,
        averageCostPerRecord: totalRecords > 0 ? (totalCost[0]?.totalCost || 0) / totalRecords : 0
      },
      topFeeds,
      dailyStats,
      period: {
        startDate,
        endDate
      }
    }
  });
});

// @desc    الحصول على سجلات التغذية حسب التاريخ
// @route   GET /api/feeding/by-date
// @access  Private
exports.getFeedingByDate = asyncHandler(async (req, res) => {
  const date = req.query.date ? new Date(req.query.date) : new Date();
  const startOfDay = new Date(date.setHours(0, 0, 0, 0));
  const endOfDay = new Date(date.setHours(23, 59, 59, 999));

  const feedingRecords = await FeedingRecord.find({
    userId: req.user.id,
    feedingDate: { $gte: startOfDay, $lte: endOfDay }
  })
    .populate('feedType.inventoryItemId', 'name unit')
    .populate('animals.animalId', 'identificationNumber name')
    .sort({ feedingTime: 1 });

  // تجميع حسب وقت التغذية
  const groupedByTime = feedingRecords.reduce((acc, record) => {
    const time = record.feedingTime;
    if (!acc[time]) {
      acc[time] = [];
    }
    acc[time].push(record);
    return acc;
  }, {});

  res.status(200).json({
    success: true,
    date: date.toISOString().split('T')[0],
    count: feedingRecords.length,
    data: {
      records: feedingRecords,
      groupedByTime
    }
  });
});

// @desc    الحصول على سجلات التغذية لحيوان محدد
// @route   GET /api/feeding/by-animal/:animalId
// @access  Private
exports.getFeedingByAnimal = asyncHandler(async (req, res) => {
  const animalId = req.params.animalId;
  
  // التحقق من وجود الحيوان
  const animal = await Animal.findOne({
    _id: animalId,
    userId: req.user.id
  });

  if (!animal) {
    return res.status(404).json({
      success: false,
      message: 'الحيوان غير موجود'
    });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const feedingRecords = await FeedingRecord.find({
    userId: req.user.id,
    'animals.animalId': animalId
  })
    .populate('feedType.inventoryItemId', 'name unit')
    .sort({ feedingDate: -1, feedingTime: -1 })
    .skip(skip)
    .limit(limit);

  const total = await FeedingRecord.countDocuments({
    userId: req.user.id,
    'animals.animalId': animalId
  });

  res.status(200).json({
    success: true,
    animal: {
      id: animal._id,
      identificationNumber: animal.identificationNumber,
      name: animal.name
    },
    count: feedingRecords.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: feedingRecords
  });
});

// @desc    إنشاء سجلات تغذية متعددة (تغذية جماعية)
// @route   POST /api/feeding/bulk
// @access  Private
exports.bulkCreateFeedingRecords = asyncHandler(async (req, res) => {
  const { records } = req.body;

  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'يرجى تقديم مصفوفة من سجلات التغذية'
    });
  }

  const createdRecords = [];
  const errors = [];

  for (let i = 0; i < records.length; i++) {
    try {
      // تشغيل عملية إنشاء كل سجل باستخدام المنطق نفسه
      req.body = records[i];
      const result = await exports.createFeedingRecord(req, {
        status: () => ({ json: (data) => data })
      });
      
      if (result.success) {
        createdRecords.push(result.data);
      } else {
        errors.push({ index: i, error: result.message });
      }
    } catch (error) {
      errors.push({ index: i, error: error.message });
    }
  }

  res.status(201).json({
    success: true,
    data: {
      created: createdRecords,
      errors,
      summary: {
        total: records.length,
        successful: createdRecords.length,
        failed: errors.length
      }
    }
  });
});