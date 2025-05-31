// backend/controllers/feedingController.js
const FeedingRecord = require('../models/FeedingRecord');
const FeedingSchedule = require('../models/FeedingSchedule');
const InventoryItem = require('../models/InventoryItem');
const InventoryTransaction = require('../models/InventoryTransaction');
const Animal = require('../models/Animal');
const FeedCalculationTemplate = require('../models/FeedCalculationTemplate');
const FinancialRecord = require('../models/FinancialRecord');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
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

    // سجلات تصحيح للبحث عن العلف
    console.log('\n=== DEBUG: البحث عن العلف ===');
    console.log('feedType المُرسل:', req.body.feedType);
    console.log('inventoryItemId:', req.body.feedType.inventoryItemId);
    console.log('userId:', req.user.id);
    
    // التحقق من صحة معرف MongoDB
    if (!mongoose.Types.ObjectId.isValid(req.body.feedType.inventoryItemId)) {
      console.log('معرف العنصر غير صالح:', req.body.feedType.inventoryItemId);
      return res.status(400).json({
        success: false,
        message: 'معرف العلف غير صالح'
      });
    }
    
    // إنشاء الاستعلام
    const query = {
      _id: req.body.feedType.inventoryItemId,
      userId: req.user.id,
      itemType: 'feed' // التأكد من أن العنصر هو علف
    };
    console.log('الاستعلام المُستخدم:', query);

    // التحقق من وجود العلف في المخزون
    const feedItem = await InventoryItem.findOne(query);
    
    console.log('نتيجة البحث:', feedItem ? 'تم العثور على العلف' : 'لم يتم العثور على العلف');
    if (feedItem) {
      console.log('تفاصيل العلف:', {
        _id: feedItem._id,
        name: feedItem.name,
        userId: feedItem.userId,
        itemType: feedItem.itemType,
        category: feedItem.category
      });
    }

    if (!feedItem) {
      // محاولة البحث بدون userId لمعرفة إن كان العنصر موجود لكن لمستخدم آخر
      const feedItemAnyUser = await InventoryItem.findOne({
        _id: req.body.feedType.inventoryItemId
      });
      
      if (feedItemAnyUser) {
        console.log('العنصر موجود لكن لمستخدم آخر:', {
          itemUserId: feedItemAnyUser.userId,
          currentUserId: req.user.id,
          itemType: feedItemAnyUser.itemType,
          name: feedItemAnyUser.name
        });
      } else {
        console.log('العنصر غير موجود بالمرة في قاعدة البيانات');
        
        // محاولة البحث بـ itemType فقط لمعرفة الأعلاف المتاحة
        const availableFeeds = await InventoryItem.find({
          userId: req.user.id,
          itemType: 'feed'
        }).select('_id name');
        
        console.log('الأعلاف المتاحة للمستخدم:', availableFeeds);
      }
      
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

    // توليد recordId يدوياً لضمان وجوده
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '');
    const recordId = `FEED-${dateStr}-${timeStr}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    // إنشاء سجل التغذية مع recordId
    const feedingRecord = new FeedingRecord({
      ...req.body,
      recordId: recordId
    });
    await feedingRecord.save();

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
        userId: new mongoose.Types.ObjectId(userId),
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
        userId: new mongoose.Types.ObjectId(userId),
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
        userId: new mongoose.Types.ObjectId(userId),
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

// @desc    Create feeding schedule
// @route   POST /api/feeding/schedules
// @access  Private
exports.createFeedingSchedule = asyncHandler(async (req, res) => {
  try {
    const scheduleData = {
      ...req.body,
      userId: req.user.id
    };

    const feedingSchedule = await FeedingSchedule.create(scheduleData);

    res.status(201).json({
      success: true,
      message: 'تم إنشاء جدول التغذية بنجاح',
      data: feedingSchedule
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get all feeding schedules
// @route   GET /api/feeding/schedules
// @access  Private
exports.getFeedingSchedules = asyncHandler(async (req, res) => {
  try {
    const { isActive, page = 1, limit = 10 } = req.query;

    const query = { userId: req.user.id };
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const schedules = await FeedingSchedule
      .find(query)
      .populate('applicationRules.feedType.inventoryItemId', 'name unit')
      .populate('applicationRules.animalCriteria.categoryIds', 'name')
      .populate('applicationRules.animalCriteria.breedIds', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await FeedingSchedule.countDocuments(query);

    res.json({
      success: true,
      data: schedules,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get feeding schedule by ID
// @route   GET /api/feeding/schedules/:id
// @access  Private
exports.getFeedingScheduleById = asyncHandler(async (req, res) => {
  try {
    const schedule = await FeedingSchedule
      .findOne({ _id: req.params.id, userId: req.user.id })
      .populate('applicationRules.feedType.inventoryItemId')
      .populate('applicationRules.animalCriteria.categoryIds')
      .populate('applicationRules.animalCriteria.breedIds')
      .populate('applicationRules.animalCriteria.specificAnimals');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'جدول التغذية غير موجود'
      });
    }

    // Get eligible animals for each rule
    const rulesWithAnimals = await Promise.all(
      schedule.applicationRules.map(async (rule, index) => {
        const eligibleAnimals = await schedule.getEligibleAnimals(index);
        return {
          ...rule.toObject(),
          eligibleAnimals: eligibleAnimals.length
        };
      })
    );

    res.json({
      success: true,
      data: {
        ...schedule.toObject(),
        applicationRules: rulesWithAnimals
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Update feeding schedule
// @route   PUT /api/feeding/schedules/:id
// @access  Private
exports.updateFeedingSchedule = asyncHandler(async (req, res) => {
  try {
    const schedule = await FeedingSchedule.findOne({ 
      _id: req.params.id, 
      userId: req.user.id 
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'جدول التغذية غير موجود'
      });
    }

    Object.assign(schedule, req.body);
    await schedule.save();

    res.json({
      success: true,
      message: 'تم تحديث جدول التغذية بنجاح',
      data: schedule
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Delete feeding schedule
// @route   DELETE /api/feeding/schedules/:id
// @access  Private
exports.deleteFeedingSchedule = asyncHandler(async (req, res) => {
  try {
    const schedule = await FeedingSchedule.findOne({ 
      _id: req.params.id, 
      userId: req.user.id 
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'جدول التغذية غير موجود'
      });
    }

    await schedule.remove();

    res.json({
      success: true,
      message: 'تم حذف جدول التغذية بنجاح'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Execute feeding schedule
// @route   POST /api/feeding/schedules/execute
// @access  Private
exports.executeFeedingSchedule = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { scheduleId, feedingTime } = req.body;

    const schedule = await FeedingSchedule.findOne({ 
      _id: scheduleId, 
      userId: req.user.id 
    }).session(session);

    if (!schedule) {
      throw new Error('جدول التغذية غير موجود');
    }

    if (!schedule.isValidAt()) {
      throw new Error('جدول التغذية غير نشط حالياً');
    }

    const feedingRecords = [];

    // Process each rule
    for (const [index, rule] of schedule.applicationRules.entries()) {
      if (!rule.isActive) continue;

      const eligibleAnimals = await schedule.getEligibleAnimals(index);
      if (eligibleAnimals.length === 0) continue;

      // Check inventory availability
      const inventoryItem = await InventoryItem.findById(rule.feedType.inventoryItemId).session(session);
      if (!inventoryItem) continue;

      // Calculate total amount needed
      let totalAmount = 0;
      const animalsData = eligibleAnimals.map(animal => {
        let amount = 0;
        
        if (rule.calculationMethod === 'percentage_of_weight' && rule.calculationParams.percentage) {
          amount = (animal.weight?.currentWeight || 0) * rule.calculationParams.percentage / 100;
        } else if (rule.calculationMethod === 'fixed_amount' && rule.calculationParams.fixedAmount) {
          amount = rule.calculationParams.fixedAmount;
        }

        // Apply min/max limits
        if (rule.calculationParams.minAmount && amount < rule.calculationParams.minAmount) {
          amount = rule.calculationParams.minAmount;
        }
        if (rule.calculationParams.maxAmount && amount > rule.calculationParams.maxAmount) {
          amount = rule.calculationParams.maxAmount;
        }

        totalAmount += amount;

        return {
          animalId: animal._id,
          animalIdentification: animal.identificationNumber,
          weight: animal.weight?.currentWeight,
          calculatedAmount: amount
        };
      });

      if (inventoryItem.availableQuantity < totalAmount) {
        throw new Error(`الكمية المتاحة من ${inventoryItem.name} غير كافية`);
      }

      // Create feeding record
      const feedingRecord = new FeedingRecord({
        animals: animalsData,
        feedType: {
          inventoryItemId: inventoryItem._id,
          name: inventoryItem.name,
          unit: inventoryItem.unit
        },
        totalAmount,
        calculationMethod: 'automatic',
        calculationCriteria: {
          percentageOfWeight: rule.calculationParams.percentage,
          fixedAmountPerAnimal: rule.calculationParams.fixedAmount
        },
        feedingDate: new Date(),
        feedingTime: feedingTime || new Date().toTimeString().slice(0, 5),
        scheduledFeedingId: schedule._id,
        cost: {
          unitCost: inventoryItem.unitPrice || 0,
          totalCost: (inventoryItem.unitPrice || 0) * totalAmount
        },
        feedingType: 'regular',
        userId: req.user.id,
        inventoryDeducted: true
      });

      await feedingRecord.save({ session });

      // Create inventory transaction
      const inventoryTransaction = new InventoryTransaction({
        inventoryItemId: inventoryItem._id,
        type: 'use',
        quantity: totalAmount,
        unitPrice: inventoryItem.unitPrice,
        totalPrice: inventoryItem.unitPrice * totalAmount,
        reason: 'feeding',
        notes: `تنفيذ جدول التغذية: ${schedule.name}`,
        userId: req.user.id
      });

      await inventoryTransaction.save({ session });

      // Update feeding record with transaction ID
      feedingRecord.inventoryTransactionId = inventoryTransaction._id;
      await feedingRecord.save({ session });

      // Update inventory
      inventoryItem.availableQuantity -= totalAmount;
      await inventoryItem.save({ session });

      feedingRecords.push(feedingRecord);
    }

    // Update schedule statistics
    schedule.stats.totalExecutions += 1;
    schedule.stats.lastExecuted = new Date();
    await schedule.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'تم تنفيذ جدول التغذية بنجاح',
      data: {
        schedule: schedule.name,
        recordsCreated: feedingRecords.length,
        records: feedingRecords
      }
    });

  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
  }
});

// @desc    Get active schedules for today
// @route   GET /api/feeding/schedules/active-today
// @access  Private
exports.getActiveSchedulesForToday = asyncHandler(async (req, res) => {
  try {
    const today = new Date();
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today.getDay()];

    const schedules = await FeedingSchedule.find({
      userId: req.user.id,
      isActive: true,
      validFrom: { $lte: today },
      $or: [
        { validTo: null },
        { validTo: { $gte: today } }
      ]
    }).populate('applicationRules.feedType.inventoryItemId', 'name unit');

    // Filter schedules based on schedule type and applicable days
    const activeSchedules = schedules.filter(schedule => {
      if (schedule.scheduleType === 'daily') return true;
      if (schedule.scheduleType === 'weekly') {
        return schedule.applicationRules.some(rule => 
          rule.applicableDays.includes(dayOfWeek)
        );
      }
      return true;
    });

    // Add next feeding time for each schedule
    const schedulesWithTimes = activeSchedules.map(schedule => {
      const feedingTimes = schedule.feedingTimes
        .filter(ft => ft.isActive)
        .map(ft => ft.time)
        .sort();

      const currentTime = today.toTimeString().slice(0, 5);
      const nextTime = feedingTimes.find(time => time > currentTime) || feedingTimes[0];

      return {
        ...schedule.toObject(),
        nextFeedingTime: nextTime
      };
    });

    res.json({
      success: true,
      data: schedulesWithTimes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Calculate daily/monthly feeding costs
// @route   GET /api/feeding/costs
// @access  Private
exports.calculateFeedingCosts = asyncHandler(async (req, res) => {
  try {
    const { period = 'month', date = new Date() } = req.query;
    
    const startDate = new Date(date);
    let endDate = new Date(date);

    if (period === 'day') {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'month') {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'year') {
      startDate.setMonth(0, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate.getFullYear(), 11, 31);
      endDate.setHours(23, 59, 59, 999);
    }

    const pipeline = [
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.user.id),
          feedingDate: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: {
            feedType: '$feedType.name',
            unit: '$feedType.unit'
          },
          totalAmount: { $sum: '$totalAmount' },
          totalCost: { $sum: '$cost.totalCost' },
          feedingCount: { $sum: 1 },
          animalsCount: { $sum: { $size: '$animals' } }
        }
      },
      {
        $project: {
          feedType: '$_id.feedType',
          unit: '$_id.unit',
          totalAmount: 1,
          totalCost: 1,
          feedingCount: 1,
          animalsCount: 1,
          averageCostPerUnit: { 
            $cond: [
              { $eq: ['$totalAmount', 0] },
              0,
              { $divide: ['$totalCost', '$totalAmount'] }
            ]
          },
          _id: 0
        }
      },
      { $sort: { totalCost: -1 } }
    ];

    const costs = await FeedingRecord.aggregate(pipeline);

    const totalCost = costs.reduce((sum, item) => sum + item.totalCost, 0);
    const totalFeedings = costs.reduce((sum, item) => sum + item.feedingCount, 0);

    // Calculate daily average if period is month or year
    let dailyAverage = 0;
    if (period === 'month') {
      const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
      dailyAverage = totalCost / daysInMonth;
    } else if (period === 'year') {
      dailyAverage = totalCost / 365;
    }

    res.json({
      success: true,
      data: {
        period,
        startDate,
        endDate,
        costs,
        summary: {
          totalCost,
          totalFeedings,
          dailyAverage,
          feedTypesCount: costs.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get feeding history by animal
// @route   GET /api/feeding/history/animal/:animalId
// @access  Private
exports.getFeedingHistoryByAnimal = asyncHandler(async (req, res) => {
  try {
    const { animalId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const feedingRecords = await FeedingRecord
      .find({
        'animals.animalId': animalId,
        userId: req.user.id
      })
      .populate('feedType.inventoryItemId', 'name unit')
      .sort({ feedingDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await FeedingRecord.countDocuments({
      'animals.animalId': animalId,
      userId: req.user.id
    });

    // Calculate consumption summary
    const consumptionSummary = await FeedingRecord.aggregate([
      {
        $match: {
          'animals.animalId': new mongoose.Types.ObjectId(animalId),
          userId: new mongoose.Types.ObjectId(req.user.id)
        }
      },
      {
        $group: {
          _id: '$feedType.name',
          totalAmount: { $sum: '$totalAmount' },
          totalCost: { $sum: '$cost.totalCost' },
          feedingCount: { $sum: 1 },
          unit: { $first: '$feedType.unit' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        history: feedingRecords,
        summary: consumptionSummary,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Batch create feeding records for multiple animals
// @route   POST /api/feeding/batch
// @access  Private
exports.batchCreateFeedingRecords = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { feedingRecords } = req.body;

    if (!Array.isArray(feedingRecords) || feedingRecords.length === 0) {
      throw new Error('يجب توفير مصفوفة من سجلات التغذية');
    }

    const createdRecords = [];

    for (const recordData of feedingRecords) {
      // Validate and process each record similar to createFeedingRecord
      const {
        animals,
        feedType,
        totalAmount,
        calculationMethod,
        calculationCriteria,
        feedingDate,
        feedingTime,
        fedBy,
        notes,
        cost,
        feedingType,
        location
      } = recordData;

      // Validate animals
      const animalIds = animals.map(a => a.animalId);
      const existingAnimals = await Animal.find({ 
        _id: { $in: animalIds },
        userId: req.user.id 
      }).session(session);

      if (existingAnimals.length !== animalIds.length) {
        throw new Error(`بعض الحيوانات في السجل ${feedingRecords.indexOf(recordData) + 1} غير موجودة`);
      }

      // Validate inventory item
      const inventoryItem = await InventoryItem.findOne({
        _id: feedType.inventoryItemId,
        userId: req.user.id,
        itemType: 'feed'
      }).session(session);

      if (!inventoryItem) {
        throw new Error(`نوع العلف في السجل ${feedingRecords.indexOf(recordData) + 1} غير موجود`);
      }

      // Check available quantity
      if (inventoryItem.availableQuantity < totalAmount) {
        throw new Error(`الكمية المتاحة من ${inventoryItem.name} غير كافية للسجل ${feedingRecords.indexOf(recordData) + 1}`);
      }

      // Create feeding record
      const feedingRecord = new FeedingRecord({
        animals,
        feedType: {
          inventoryItemId: feedType.inventoryItemId,
          name: inventoryItem.name,
          unit: inventoryItem.unit
        },
        totalAmount,
        calculationMethod,
        calculationCriteria,
        feedingDate,
        feedingTime,
        fedBy,
        notes,
        cost: {
          unitCost: cost?.unitCost || inventoryItem.unitPrice || 0,
          totalCost: (cost?.unitCost || inventoryItem.unitPrice || 0) * totalAmount
        },
        feedingType,
        location,
        userId: req.user.id,
        inventoryDeducted: true
      });

      await feedingRecord.save({ session });

      // Create inventory transaction
      const inventoryTransaction = new InventoryTransaction({
        inventoryItemId: inventoryItem._id,
        type: 'use',
        quantity: totalAmount,
        unitPrice: inventoryItem.unitPrice,
        totalPrice: inventoryItem.unitPrice * totalAmount,
        reason: 'feeding',
        notes: `تغذية ${animals.length} حيوان - دفعة`,
        userId: req.user.id
      });

      await inventoryTransaction.save({ session });

      // Update feeding record with transaction ID
      feedingRecord.inventoryTransactionId = inventoryTransaction._id;
      await feedingRecord.save({ session });

      // Update inventory
      inventoryItem.availableQuantity -= totalAmount;
      await inventoryItem.save({ session });

      createdRecords.push(feedingRecord);
    }

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: `تم إنشاء ${createdRecords.length} سجل تغذية بنجاح`,
      data: createdRecords
    });

  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
  }
});