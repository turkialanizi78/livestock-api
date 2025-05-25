// backend/controllers/equipmentUsageController.js
const EquipmentUsage = require('../models/EquipmentUsage');
const InventoryItem = require('../models/InventoryItem');
const InventoryTransaction = require('../models/InventoryTransaction');
const Animal = require('../models/Animal');
const HealthEvent = require('../models/HealthEvent');
const Vaccination = require('../models/Vaccination');
const FeedingRecord = require('../models/FeedingRecord');
const FinancialRecord = require('../models/FinancialRecord');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const { createNotification } = require('./notificationController');

// @desc    الحصول على جميع سجلات استخدام المعدات
// @route   GET /api/equipment-usage
// @access  Private
exports.getEquipmentUsages = asyncHandler(async (req, res) => {
  let query = { userId: req.user.id };

  // فلترة حسب نوع العملية
  if (req.query.operationType) {
    query.operationType = req.query.operationType;
  }

  // فلترة حسب التاريخ
  if (req.query.startDate || req.query.endDate) {
    query.usageDate = {};
    
    if (req.query.startDate) {
      query.usageDate.$gte = new Date(req.query.startDate);
    }
    
    if (req.query.endDate) {
      query.usageDate.$lte = new Date(req.query.endDate);
    }
  }

  // فلترة حسب المعدة
  if (req.query.equipmentId) {
    query['equipmentUsed.inventoryItemId'] = req.query.equipmentId;
  }

  // فلترة حسب الحيوان
  if (req.query.animalId) {
    query['relatedAnimals.animalId'] = req.query.animalId;
  }

  // فلترة حسب المستخدم
  if (req.query.usedBy) {
    query.usedBy = { $regex: req.query.usedBy, $options: 'i' };
  }

  // فلترة حسب نتيجة العملية
  if (req.query.outcomeStatus) {
    query['outcome.status'] = req.query.outcomeStatus;
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const usageRecords = await EquipmentUsage.find(query)
    .populate('equipmentUsed.inventoryItemId', 'name unit itemType')
    .populate('relatedAnimals.animalId', 'identificationNumber name')
    .populate('relatedEvents.healthEventId', 'eventType date')
    .populate('relatedEvents.vaccinationId', 'name administrationDate')
    .populate('relatedEvents.feedingRecordId', 'recordId feedingDate')
    .sort({ usageDate: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await EquipmentUsage.countDocuments(query);

  res.status(200).json({
    success: true,
    count: usageRecords.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: usageRecords
  });
});

// @desc    الحصول على سجل استخدام معدة واحد
// @route   GET /api/equipment-usage/:id
// @access  Private
exports.getEquipmentUsage = asyncHandler(async (req, res) => {
  const usageRecord = await EquipmentUsage.findOne({
    _id: req.params.id,
    userId: req.user.id
  })
    .populate('equipmentUsed.inventoryItemId', 'name unit itemType unitPrice')
    .populate('relatedAnimals.animalId', 'identificationNumber name weight')
    .populate('relatedEvents.healthEventId')
    .populate('relatedEvents.vaccinationId')
    .populate('relatedEvents.feedingRecordId')
    .populate('inventoryTransactionIds');

  if (!usageRecord) {
    return res.status(404).json({
      success: false,
      message: 'سجل استخدام المعدة غير موجود'
    });
  }

  res.status(200).json({
    success: true,
    data: usageRecord
  });
});

// @desc    إنشاء سجل استخدام معدة جديد
// @route   POST /api/equipment-usage
// @access  Private
exports.createEquipmentUsage = asyncHandler(async (req, res) => {
  try {
    // إضافة معرف المستخدم
    req.body.userId = req.user.id;

    // التحقق من وجود المعدات في المخزون
    if (req.body.equipmentUsed && req.body.equipmentUsed.length > 0) {
      for (let equipment of req.body.equipmentUsed) {
        const inventoryItem = await InventoryItem.findOne({
          _id: equipment.inventoryItemId,
          userId: req.user.id
        });

        if (!inventoryItem) {
          return res.status(404).json({
            success: false,
            message: `المعدة ${equipment.itemName} غير موجودة في المخزون`
          });
        }

        // التحقق من توفر الكمية المطلوبة
        if (equipment.quantityUsed > inventoryItem.availableQuantity) {
          return res.status(400).json({
            success: false,
            message: `الكمية المطلوبة من ${equipment.itemName} (${equipment.quantityUsed}) أكبر من الكمية المتوفرة (${inventoryItem.availableQuantity})`
          });
        }

        // تعبئة معلومات المعدة
        equipment.itemName = inventoryItem.name;
        equipment.unit = inventoryItem.unit;
      }
    }

    // تعبئة أرقام تعريف الحيوانات
    if (req.body.relatedAnimals && req.body.relatedAnimals.length > 0) {
      for (let animalData of req.body.relatedAnimals) {
        const animal = await Animal.findById(animalData.animalId);
        if (animal) {
          animalData.animalIdentification = animal.identificationNumber;
        }
      }
    }

    // إنشاء سجل استخدام المعدة
    const usageRecord = await EquipmentUsage.create(req.body);

    // خصم المعدات من المخزون وإنشاء معاملات المخزون
    const inventoryTransactionIds = [];

    if (req.body.equipmentUsed && req.body.equipmentUsed.length > 0) {
      for (let equipment of req.body.equipmentUsed) {
        const inventoryItem = await InventoryItem.findById(equipment.inventoryItemId);
        
        if (inventoryItem) {
          // خصم الكمية فقط إذا كانت المعدة غير قابلة للإرجاع أو تالفة
          if (!equipment.returnedToInventory || equipment.conditionAfter === 'damaged' || equipment.conditionAfter === 'discarded') {
            const quantityToDeduct = equipment.quantityUsed - (equipment.returnedQuantity || 0);
            
            if (quantityToDeduct > 0) {
              // إنشاء معاملة مخزون
              const transaction = await InventoryTransaction.create({
                inventoryItemId: inventoryItem._id,
                type: 'use',
                quantity: quantityToDeduct,
                date: req.body.usageDate || new Date(),
                unitPrice: inventoryItem.unitPrice || 0,
                totalPrice: quantityToDeduct * (inventoryItem.unitPrice || 0),
                reason: `استخدام معدة - ${req.body.operationType}`,
                notes: `${req.body.title} - ${usageRecord._id}`,
                userId: req.user.id
              });

              inventoryTransactionIds.push(transaction._id);

              // تحديث كمية المخزون
              inventoryItem.availableQuantity -= quantityToDeduct;
              inventoryItem.isLowStock = inventoryItem.availableQuantity <= inventoryItem.lowStockThreshold;
              await inventoryItem.save();

              // إنشاء تنبيه إذا أصبح المخزون منخفضًا
              if (inventoryItem.isLowStock) {
                await createNotification({
                  userId: req.user.id,
                  title: 'مخزون معدة منخفض',
                  message: `الكمية المتوفرة من ${inventoryItem.name} منخفضة (${inventoryItem.availableQuantity} ${inventoryItem.unit})`,
                  type: 'inventory',
                  relatedInventoryId: inventoryItem._id
                });
              }
            }
          }
        }
      }
    }

    // ربط معاملات المخزون بسجل الاستخدام
    if (inventoryTransactionIds.length > 0) {
      usageRecord.inventoryTransactionIds = inventoryTransactionIds;
      usageRecord.inventoryDeducted = true;
      await usageRecord.save();
    }

    // حساب وإنشاء السجل المالي
    if (usageRecord.cost.totalCost > 0) {
      await FinancialRecord.create({
        type: 'expense',
        category: 'other',
        amount: usageRecord.cost.totalCost,
        date: req.body.usageDate || new Date(),
        description: `تكلفة استخدام معدات - ${req.body.title}`,
        userId: req.user.id
      });
    }

    // إعادة جلب السجل مع البيانات المحدثة
    const populatedRecord = await EquipmentUsage.findById(usageRecord._id)
      .populate('equipmentUsed.inventoryItemId', 'name unit itemType')
      .populate('relatedAnimals.animalId', 'identificationNumber name')
      .populate('inventoryTransactionIds');

    res.status(201).json({
      success: true,
      data: populatedRecord
    });

  } catch (error) {
    console.error('Error creating equipment usage record:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    تحديث سجل استخدام معدة
// @route   PUT /api/equipment-usage/:id
// @access  Private
exports.updateEquipmentUsage = asyncHandler(async (req, res) => {
  let usageRecord = await EquipmentUsage.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!usageRecord) {
    return res.status(404).json({
      success: false,
      message: 'سجل استخدام المعدة غير موجود'
    });
  }

  // لا نسمح بتغيير المعدات المستخدمة أو الكميات بعد خصم المخزون
  if (usageRecord.inventoryDeducted) {
    delete req.body.equipmentUsed;
  }

  usageRecord = await EquipmentUsage.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  })
    .populate('equipmentUsed.inventoryItemId', 'name unit itemType')
    .populate('relatedAnimals.animalId', 'identificationNumber name')
    .populate('inventoryTransactionIds');

  res.status(200).json({
    success: true,
    data: usageRecord
  });
});

// @desc    حذف سجل استخدام معدة
// @route   DELETE /api/equipment-usage/:id
// @access  Private
exports.deleteEquipmentUsage = asyncHandler(async (req, res) => {
  const usageRecord = await EquipmentUsage.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!usageRecord) {
    return res.status(404).json({
      success: false,
      message: 'سجل استخدام المعدة غير موجود'
    });
  }

  // إعادة المعدات للمخزون إذا تم خصمها
  if (usageRecord.inventoryDeducted && usageRecord.inventoryTransactionIds && usageRecord.inventoryTransactionIds.length > 0) {
    for (const transactionId of usageRecord.inventoryTransactionIds) {
      const transaction = await InventoryTransaction.findById(transactionId);
      
      if (transaction) {
        const inventoryItem = await InventoryItem.findById(transaction.inventoryItemId);
        
        if (inventoryItem) {
          // إعادة الكمية للمخزون
          inventoryItem.availableQuantity += transaction.quantity;
          inventoryItem.isLowStock = inventoryItem.availableQuantity <= inventoryItem.lowStockThreshold;
          await inventoryItem.save();
        }

        // حذف معاملة المخزون
        await InventoryTransaction.findByIdAndDelete(transactionId);
      }
    }
  }

  // حذف السجل المالي المرتبط
  await FinancialRecord.deleteOne({
    description: `تكلفة استخدام معدات - ${usageRecord.title}`,
    userId: req.user.id
  });

  await EquipmentUsage.findByIdAndDelete(usageRecord._id);

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    الحصول على استخدام المعدات حسب نوع المعدة
// @route   GET /api/equipment-usage/by-equipment/:equipmentId
// @access  Private
exports.getUsageByEquipment = asyncHandler(async (req, res) => {
  const equipmentId = req.params.equipmentId;

  // التحقق من وجود المعدة
  const equipment = await InventoryItem.findOne({
    _id: equipmentId,
    userId: req.user.id
  });

  if (!equipment) {
    return res.status(404).json({
      success: false,
      message: 'المعدة غير موجودة'
    });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const usageRecords = await EquipmentUsage.find({
    userId: req.user.id,
    'equipmentUsed.inventoryItemId': equipmentId
  })
    .populate('relatedAnimals.animalId', 'identificationNumber name')
    .sort({ usageDate: -1 })
    .skip(skip)
    .limit(limit);

  const total = await EquipmentUsage.countDocuments({
    userId: req.user.id,
    'equipmentUsed.inventoryItemId': equipmentId
  });

  // حساب إحصائيات الاستخدام
  const totalUsage = await EquipmentUsage.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(req.user.id),
        'equipmentUsed.inventoryItemId': mongoose.Types.ObjectId(equipmentId)
      }
    },
    {
      $unwind: '$equipmentUsed'
    },
    {
      $match: {
        'equipmentUsed.inventoryItemId': mongoose.Types.ObjectId(equipmentId)
      }
    },
    {
      $group: {
        _id: null,
        totalQuantityUsed: { $sum: '$equipmentUsed.quantityUsed' },
        totalOperations: { $sum: 1 },
        totalCost: { $sum: '$cost.totalCost' }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    equipment: {
      id: equipment._id,
      name: equipment.name,
      unit: equipment.unit,
      availableQuantity: equipment.availableQuantity
    },
    count: usageRecords.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    stats: totalUsage[0] || {
      totalQuantityUsed: 0,
      totalOperations: 0,
      totalCost: 0
    },
    data: usageRecords
  });
});

// @desc    الحصول على استخدام المعدات لحيوان محدد
// @route   GET /api/equipment-usage/by-animal/:animalId
// @access  Private
exports.getUsageByAnimal = asyncHandler(async (req, res) => {
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

  const usageRecords = await EquipmentUsage.find({
    userId: req.user.id,
    'relatedAnimals.animalId': animalId
  })
    .populate('equipmentUsed.inventoryItemId', 'name unit')
    .sort({ usageDate: -1 })
    .skip(skip)
    .limit(limit);

  const total = await EquipmentUsage.countDocuments({
    userId: req.user.id,
    'relatedAnimals.animalId': animalId
  });

  res.status(200).json({
    success: true,
    animal: {
      id: animal._id,
      identificationNumber: animal.identificationNumber,
      name: animal.name
    },
    count: usageRecords.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: usageRecords
  });
});

// @desc    الحصول على استخدام المعدات حسب نوع العملية
// @route   GET /api/equipment-usage/by-operation/:operationType
// @access  Private
exports.getUsageByOperation = asyncHandler(async (req, res) => {
  const operationType = req.params.operationType;

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const usageRecords = await EquipmentUsage.find({
    userId: req.user.id,
    operationType: operationType
  })
    .populate('equipmentUsed.inventoryItemId', 'name unit')
    .populate('relatedAnimals.animalId', 'identificationNumber name')
    .sort({ usageDate: -1 })
    .skip(skip)
    .limit(limit);

  const total = await EquipmentUsage.countDocuments({
    userId: req.user.id,
    operationType: operationType
  });

  // إحصائيات نوع العملية
  const operationStats = await EquipmentUsage.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(req.user.id),
        operationType: operationType
      }
    },
    {
      $group: {
        _id: null,
        totalOperations: { $sum: 1 },
        totalCost: { $sum: '$cost.totalCost' },
        totalAnimals: { $sum: { $size: '$relatedAnimals' } },
        avgDuration: { $avg: '$duration' }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    operationType,
    count: usageRecords.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    stats: operationStats[0] || {
      totalOperations: 0,
      totalCost: 0,
      totalAnimals: 0,
      avgDuration: 0
    },
    data: usageRecords
  });
});

// @desc    الحصول على إحصائيات استخدام المعدات
// @route   GET /api/equipment-usage/stats
// @access  Private
exports.getUsageStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
  const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

  // إحصائيات عامة
  const generalStats = await EquipmentUsage.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        usageDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalOperations: { $sum: 1 },
        totalCost: { $sum: '$cost.totalCost' },
        totalAnimalsAffected: { $sum: { $size: '$relatedAnimals' } },
        avgDuration: { $avg: '$duration' }
      }
    }
  ]);

  // إحصائيات حسب نوع العملية
  const operationStats = await EquipmentUsage.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        usageDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$operationType',
        count: { $sum: 1 },
        totalCost: { $sum: '$cost.totalCost' },
        avgDuration: { $avg: '$duration' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  // أكثر المعدات استخداماً
  const topEquipment = await EquipmentUsage.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        usageDate: { $gte: startDate, $lte: endDate }
      }
    },
    { $unwind: '$equipmentUsed' },
    {
      $group: {
        _id: '$equipmentUsed.inventoryItemId',
        equipmentName: { $first: '$equipmentUsed.itemName' },
        totalUsage: { $sum: '$equipmentUsed.quantityUsed' },
        operationsCount: { $sum: 1 }
      }
    },
    { $sort: { totalUsage: -1 } },
    { $limit: 10 }
  ]);

  // إحصائيات يومية
  const dailyStats = await EquipmentUsage.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        usageDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$usageDate" }
        },
        operationsCount: { $sum: 1 },
        totalCost: { $sum: '$cost.totalCost' },
        animalsAffected: { $sum: { $size: '$relatedAnimals' } }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      summary: generalStats[0] || {
        totalOperations: 0,
        totalCost: 0,
        totalAnimalsAffected: 0,
        avgDuration: 0
      },
      byOperationType: operationStats,
      topEquipment,
      dailyStats,
      period: {
        startDate,
        endDate
      }
    }
  });
});

// @desc    إرجاع معدات للمخزون
// @route   POST /api/equipment-usage/:id/return-equipment
// @access  Private
exports.returnEquipmentToInventory = asyncHandler(async (req, res) => {
  const usageRecord = await EquipmentUsage.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!usageRecord) {
    return res.status(404).json({
      success: false,
      message: 'سجل استخدام المعدة غير موجود'
    });
  }

  const { equipmentIndex, returnedQuantity, condition, notes } = req.body;

  if (equipmentIndex === undefined || !usageRecord.equipmentUsed[equipmentIndex]) {
    return res.status(400).json({
      success: false,
      message: 'معرف المعدة غير صحيح'
    });
  }

  const equipment = usageRecord.equipmentUsed[equipmentIndex];

  if (returnedQuantity <= 0 || returnedQuantity > equipment.quantityUsed) {
    return res.status(400).json({
      success: false,
      message: 'كمية الإرجاع غير صحيحة'
    });
  }

  // تحديث المعدة في سجل الاستخدام
  equipment.returnedToInventory = true;
  equipment.returnedQuantity = returnedQuantity;
  equipment.conditionAfter = condition || 'good';
  equipment.notes = notes || '';

  // إضافة الكمية المرجعة للمخزون
  const inventoryItem = await InventoryItem.findById(equipment.inventoryItemId);
  
  if (inventoryItem) {
    inventoryItem.availableQuantity += returnedQuantity;
    inventoryItem.isLowStock = inventoryItem.availableQuantity <= inventoryItem.lowStockThreshold;
    await inventoryItem.save();

    // إنشاء معاملة مخزون للإرجاع
    await InventoryTransaction.create({
      inventoryItemId: inventoryItem._id,
      type: 'add',
      quantity: returnedQuantity,
      date: new Date(),
      reason: 'إرجاع معدة',
      notes: `إرجاع من العملية ${usageRecord.title} - ${usageRecord._id}`,
      userId: req.user.id
    });
  }

  await usageRecord.save();

  res.status(200).json({
    success: true,
    message: 'تم إرجاع المعدة للمخزون بنجاح',
    data: usageRecord
  });
});

// @desc    الحصول على تقرير حالة المعدات
// @route   GET /api/equipment-usage/condition-report
// @access  Private
exports.getEquipmentConditionReport = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // تحليل حالة المعدات بعد الاستخدام
  const conditionStats = await EquipmentUsage.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId)
      }
    },
    { $unwind: '$equipmentUsed' },
    {
      $group: {
        _id: {
          equipmentId: '$equipmentUsed.inventoryItemId',
          condition: '$equipmentUsed.conditionAfter'
        },
        equipmentName: { $first: '$equipmentUsed.itemName' },
        count: { $sum: 1 },
        totalQuantity: { $sum: '$equipmentUsed.quantityUsed' }
      }
    },
    {
      $group: {
        _id: '$_id.equipmentId',
        equipmentName: { $first: '$equipmentName' },
        conditions: {
          $push: {
            condition: '$_id.condition',
            count: '$count',
            quantity: '$totalQuantity'
          }
        },
        totalUsages: { $sum: '$count' }
      }
    }
  ]);

  // المعدات التي تحتاج صيانة أو استبدال
  const maintenanceNeeded = await EquipmentUsage.find({
    userId: userId,
    $or: [
      { 'postUsageActions.needsRepair': true },
      { 'postUsageActions.needsReplacement': true },
      { 'postUsageActions.needsCalibration': true }
    ]
  })
    .populate('equipmentUsed.inventoryItemId', 'name unit')
    .sort({ usageDate: -1 })
    .limit(20);

  res.status(200).json({
    success: true,
    data: {
      conditionAnalysis: conditionStats,
      maintenanceNeeded: maintenanceNeeded,
      summary: {
        totalEquipmentTypes: conditionStats.length,
        needingMaintenance: maintenanceNeeded.length
      }
    }
  });
});

// @desc    رفع صور لسجل استخدام المعدة
// @route   POST /api/equipment-usage/:id/images
// @access  Private
exports.uploadUsageImages = asyncHandler(async (req, res) => {
  const usageRecord = await EquipmentUsage.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!usageRecord) {
    return res.status(404).json({
      success: false,
      message: 'سجل استخدام المعدة غير موجود'
    });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'يرجى رفع صورة واحدة على الأقل'
    });
  }

  const { imageType = 'during' } = req.body; // before, during, after

  // حفظ مسارات الصور
  const imageUrls = req.files.map(file => 
    `${req.protocol}://${req.get('host')}/uploads/equipment-usage/${file.filename}`
  );

  // إضافة الصور للسجل
  if (!usageRecord.images) {
    usageRecord.images = { before: [], during: [], after: [] };
  }

  if (!usageRecord.images[imageType]) {
    usageRecord.images[imageType] = [];
  }

  usageRecord.images[imageType].push(...imageUrls);
  await usageRecord.save();

  res.status(200).json({
    success: true,
    message: 'تم رفع الصور بنجاح',
    data: {
      uploadedImages: imageUrls,
      imageType,
      totalImages: usageRecord.images[imageType].length
    }
  });
});