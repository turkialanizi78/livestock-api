// controllers/inventoryController.js
const InventoryItem = require('../models/InventoryItem');
const InventoryTransaction = require('../models/InventoryTransaction');
const FinancialRecord = require('../models/FinancialRecord');
const asyncHandler = require('express-async-handler');
const { createNotification } = require('./notificationController');

// @desc    الحصول على جميع عناصر المخزون
// @route   GET /api/inventory
// @access  Private
exports.getInventoryItems = asyncHandler(async (req, res) => {
  let query = { userId: req.user.id };

  // إضافة فلترة حسب الطلب
  // دعم كل من 'itemType' و 'category' للتوافق مع الفرونت إند
  if (req.query.itemType) {
    query.itemType = req.query.itemType;
  } else if (req.query.category) {
    query.itemType = req.query.category;
  }

  if (req.query.isLowStock) {
    query.isLowStock = req.query.isLowStock === 'true';
  }

  // البحث حسب الاسم
  if (req.query.name) {
    query.name = { $regex: req.query.name, $options: 'i' };
  }

  const inventoryItems = await InventoryItem.find(query)
    .sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: inventoryItems.length,
    data: inventoryItems
  });
});

// @desc    الحصول على عنصر مخزون واحد
// @route   GET /api/inventory/:id
// @access  Private
exports.getInventoryItem = asyncHandler(async (req, res) => {
  const inventoryItem = await InventoryItem.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!inventoryItem) {
    return res.status(404).json({
      success: false,
      message: 'عنصر المخزون غير موجود'
    });
  }

  res.status(200).json({
    success: true,
    data: inventoryItem
  });
});

// @desc    إنشاء عنصر مخزون جديد
// @route   POST /api/inventory
// @access  Private
exports.createInventoryItem = asyncHandler(async (req, res) => {
  // إضافة معرف المستخدم للطلب
  req.body.userId = req.user.id;

  // التحقق من حالة المخزون المنخفض
  if (req.body.availableQuantity <= req.body.lowStockThreshold) {
    req.body.isLowStock = true;
  } else {
    req.body.isLowStock = false;
  }

  const inventoryItem = await InventoryItem.create(req.body);

  // إذا تم إضافة كمية بدئية، أضف معاملة مخزون
  if (req.body.availableQuantity > 0) {
    await InventoryTransaction.create({
      inventoryItemId: inventoryItem._id,
      type: 'add',
      quantity: req.body.availableQuantity,
      date: req.body.purchaseDate || new Date(),
      unitPrice: req.body.unitPrice || 0,
      totalPrice: req.body.availableQuantity * (req.body.unitPrice || 0),
      reason: 'initial',
      expiryDate: req.body.expiryDate,
      notes: 'كمية بدئية',
      userId: req.user.id
    });

    // إنشاء سجل مالي إذا كان هناك سعر
    if (req.body.unitPrice && req.body.unitPrice > 0) {
      await FinancialRecord.create({
        type: 'expense',
        category: req.body.itemType === 'feed' ? 'feed' : (req.body.itemType === 'medicine' || req.body.itemType === 'vaccine' ? 'medication' : 'other'),
        amount: req.body.availableQuantity * req.body.unitPrice,
        date: req.body.purchaseDate || new Date(),
        description: `شراء ${inventoryItem.name}`,
        relatedInventoryId: inventoryItem._id,
        supplier: req.body.supplier,
        userId: req.user.id
      });
    }
  }

  res.status(201).json({
    success: true,
    data: inventoryItem
  });
});

// @desc    تحديث عنصر مخزون
// @route   PUT /api/inventory/:id
// @access  Private
exports.updateInventoryItem = asyncHandler(async (req, res) => {
  let inventoryItem = await InventoryItem.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!inventoryItem) {
    return res.status(404).json({
      success: false,
      message: 'عنصر المخزون غير موجود'
    });
  }

  // لا نسمح بتحديث الكمية المتوفرة مباشرة، يجب استخدام معاملات المخزون
  if (req.body.availableQuantity !== undefined && req.body.availableQuantity !== inventoryItem.availableQuantity) {
    delete req.body.availableQuantity;
  }

  // تحديث حالة المخزون المنخفض إذا تم تغيير الحد الأدنى
  if (req.body.lowStockThreshold !== undefined) {
    req.body.isLowStock = (inventoryItem.availableQuantity <= req.body.lowStockThreshold);
  }

  inventoryItem = await InventoryItem.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: inventoryItem
  });
});

 
// @desc    حذف عنصر مخزون
// @route   DELETE /api/inventory/:id
// @access  Private
exports.deleteInventoryItem = asyncHandler(async (req, res) => {
  const inventoryItem = await InventoryItem.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!inventoryItem) {
    return res.status(404).json({
      success: false,
      message: 'عنصر المخزون غير موجود'
    });
  }

  // التحقق من وجود معاملات مخزون مرتبطة
  const transactions = await InventoryTransaction.find({
    inventoryItemId: inventoryItem._id
  });

  // إذا كان للعنصر معاملات وتم طلب حذفها أيضاً
  if (transactions.length > 0 && req.query.deleteTransactions === 'true') {
    // حذف جميع المعاملات المرتبطة
    await InventoryTransaction.deleteMany({
      inventoryItemId: inventoryItem._id
    });
    
    // حذف السجلات المالية المرتبطة بهذه المعاملات
    await FinancialRecord.deleteMany({
      relatedInventoryId: inventoryItem._id
    });
    
    console.log(`Deleted ${transactions.length} related transactions for inventory item ${inventoryItem._id}`);
  } 
  // إذا كان للعنصر معاملات ولم يتم طلب حذفها
  else if (transactions.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'لا يمكن حذف عنصر مخزون له معاملات مرتبطة. أضف معلمة deleteTransactions=true لحذف المعاملات المرتبطة'
    });
  }

  // حذف العنصر نفسه - استخدم findByIdAndDelete بدلاً من remove لأن remove مهملة
  await InventoryItem.findByIdAndDelete(inventoryItem._id);

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    إضافة كمية للمخزون
// @route   POST /api/inventory/:id/add
// @access  Private
exports.addToInventory = asyncHandler(async (req, res) => {
  const inventoryItem = await InventoryItem.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!inventoryItem) {
    return res.status(404).json({
      success: false,
      message: 'عنصر المخزون غير موجود'
    });
  }

  // التحقق من البيانات المطلوبة
  if (!req.body.quantity || req.body.quantity <= 0) {
    return res.status(400).json({
      success: false,
      message: 'يرجى تحديد كمية صالحة'
    });
  }

  // إنشاء معاملة مخزون
  const transaction = await InventoryTransaction.create({
    inventoryItemId: inventoryItem._id,
    type: 'add',
    quantity: req.body.quantity,
    date: req.body.date || new Date(),
    unitPrice: req.body.unitPrice || 0,
    totalPrice: req.body.quantity * (req.body.unitPrice || 0),
    reason: req.body.reason || 'purchase',
    batchNumber: req.body.batchNumber,
    expiryDate: req.body.expiryDate,
    notes: req.body.notes,
    userId: req.user.id
  });

  // تحديث الكمية المتوفرة
  inventoryItem.availableQuantity += req.body.quantity;
  
  // تحديث بيانات أخرى إذا كانت متوفرة
  if (req.body.unitPrice) {
    inventoryItem.unitPrice = req.body.unitPrice;
  }
  
  if (req.body.expiryDate) {
    inventoryItem.expiryDate = req.body.expiryDate;
  }
  
  if (req.body.supplier) {
    inventoryItem.supplier = req.body.supplier;
  }
  
  // التحقق من حالة المخزون المنخفض
  inventoryItem.isLowStock = (inventoryItem.availableQuantity <= inventoryItem.lowStockThreshold);
  
  await inventoryItem.save();

  // إنشاء سجل مالي إذا كان هناك سعر
  let financialRecord;
  if (req.body.unitPrice && req.body.unitPrice > 0) {
    financialRecord = await FinancialRecord.create({
      type: 'expense',
      category: inventoryItem.itemType === 'feed' ? 'feed' : (inventoryItem.itemType === 'medicine' || inventoryItem.itemType === 'vaccine' ? 'medication' : 'other'),
      amount: req.body.quantity * req.body.unitPrice,
      date: req.body.date || new Date(),
      description: `شراء ${inventoryItem.name}`,
      relatedInventoryId: inventoryItem._id,
      supplier: req.body.supplier,
      userId: req.user.id
    });
  }

  res.status(200).json({
    success: true,
    data: {
      inventoryItem,
      transaction,
      financialRecord
    }
  });
});

// @desc    استخدام كمية من المخزون
// @route   POST /api/inventory/:id/use
// @access  Private
exports.useFromInventory = asyncHandler(async (req, res) => {
  const inventoryItem = await InventoryItem.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!inventoryItem) {
    return res.status(404).json({
      success: false,
      message: 'عنصر المخزون غير موجود'
    });
  }

  // التحقق من البيانات المطلوبة
  if (!req.body.quantity || req.body.quantity <= 0) {
    return res.status(400).json({
      success: false,
      message: 'يرجى تحديد كمية صالحة'
    });
  }

  // التحقق من توفر الكمية المطلوبة
  if (req.body.quantity > inventoryItem.availableQuantity) {
    return res.status(400).json({
      success: false,
      message: 'الكمية المطلوبة غير متوفرة في المخزون'
    });
  }

  // إنشاء معاملة مخزون
  const transaction = await InventoryTransaction.create({
    inventoryItemId: inventoryItem._id,
    type: 'use',
    quantity: req.body.quantity,
    date: req.body.date || new Date(),
    unitPrice: inventoryItem.unitPrice || 0,
    totalPrice: req.body.quantity * (inventoryItem.unitPrice || 0),
    reason: req.body.reason || 'consumption',
    relatedAnimalId: req.body.animalId,
    notes: req.body.notes,
    userId: req.user.id
  });

  // تحديث الكمية المتوفرة
  inventoryItem.availableQuantity -= req.body.quantity;
  
  // التحقق من حالة المخزون المنخفض
  inventoryItem.isLowStock = (inventoryItem.availableQuantity <= inventoryItem.lowStockThreshold);
  
  // إنشاء إشعار إذا أصبح المخزون منخفضًا
  if (inventoryItem.isLowStock && inventoryItem.availableQuantity > 0) {
    await createNotification({
      userId: req.user.id,
      title: 'مخزون منخفض',
      message: `الكمية المتوفرة من ${inventoryItem.name} منخفضة (${inventoryItem.availableQuantity} ${inventoryItem.unit})`,
      type: 'inventory',
      relatedInventoryId: inventoryItem._id
    });
  } else if (inventoryItem.availableQuantity === 0) {
    await createNotification({
      userId: req.user.id,
      title: 'نفاد المخزون',
      message: `لقد نفذت الكمية المتوفرة من ${inventoryItem.name}`,
      type: 'inventory',
      relatedInventoryId: inventoryItem._id
    });
  }
  
  await inventoryItem.save();

  res.status(200).json({
    success: true,
    data: {
      inventoryItem,
      transaction
    }
  });
});

// @desc    الحصول على معاملات المخزون لعنصر معين
// @route   GET /api/inventory/:id/transactions
// @access  Private
exports.getItemTransactions = asyncHandler(async (req, res) => {
  const inventoryItem = await InventoryItem.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!inventoryItem) {
    return res.status(404).json({
      success: false,
      message: 'عنصر المخزون غير موجود'
    });
  }

  // فلترة حسب النوع
  let query = { 
    inventoryItemId: inventoryItem._id,
    userId: req.user.id 
  };

  if (req.query.type) {
    query.type = req.query.type;
  }

  // فلترة حسب التاريخ
  if (req.query.startDate || req.query.endDate) {
    query.date = {};
    
    if (req.query.startDate) {
      query.date.$gte = new Date(req.query.startDate);
    }
    
    if (req.query.endDate) {
      query.date.$lte = new Date(req.query.endDate);
    }
  }

  const transactions = await InventoryTransaction.find(query)
    .populate('relatedAnimalId', 'identificationNumber')
    .sort({ date: -1 });

  res.status(200).json({
    success: true,
    count: transactions.length,
    data: transactions
  });
});

// @desc    الحصول على عناصر المخزون منخفضة الكمية
// @route   GET /api/inventory/low-stock
// @access  Private
exports.getLowStockItems = asyncHandler(async (req, res) => {
  const lowStockItems = await InventoryItem.find({
    userId: req.user.id,
    isLowStock: true
  }).sort({ availableQuantity: 1 });

  res.status(200).json({
    success: true,
    count: lowStockItems.length,
    data: lowStockItems
  });
});

// @desc    الحصول على عناصر المخزون قريبة انتهاء الصلاحية
// @route   GET /api/inventory/expiring
// @access  Private
exports.getExpiringItems = asyncHandler(async (req, res) => {
  const daysToExpiry = req.query.days ? parseInt(req.query.days) : 30;
  const today = new Date();
  const expiryDate = new Date();
  expiryDate.setDate(today.getDate() + daysToExpiry);

  const expiringItems = await InventoryItem.find({
    userId: req.user.id,
    expiryDate: {
      $exists: true,
      $ne: null,
      $gt: today,
      $lte: expiryDate
    }
  }).sort({ expiryDate: 1 });

  res.status(200).json({
    success: true,
    count: expiringItems.length,
    data: expiringItems
  });
});

// @desc    تعديل معاملة مخزون
// @route   PUT /api/inventory-transactions/:id
// @access  Private
exports.updateInventoryTransaction = asyncHandler(async (req, res) => {
  let transaction = await InventoryTransaction.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!transaction) {
    return res.status(404).json({
      success: false,
      message: 'معاملة المخزون غير موجودة'
    });
  }

  // لا نسمح بتغيير النوع أو الكمية بعد الإنشاء
  if (req.body.type !== undefined || req.body.quantity !== undefined) {
    return res.status(400).json({
      success: false,
      message: 'لا يمكن تغيير نوع المعاملة أو الكمية بعد الإنشاء'
    });
  }

  transaction = await InventoryTransaction.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  // تحديث السجل المالي المرتبط إذا كان موجودًا
  if (transaction.type === 'add' && transaction.totalPrice > 0) {
    const financialRecord = await FinancialRecord.findOne({
      relatedInventoryId: transaction.inventoryItemId,
      date: transaction.date
    });

    if (financialRecord) {
      financialRecord.amount = transaction.totalPrice;
      financialRecord.date = transaction.date;
      await financialRecord.save();
    }
  }

  res.status(200).json({
    success: true,
    data: transaction
  });
});

// @desc    حذف معاملة مخزون
// @route   DELETE /api/inventory-transactions/:id
// @access  Private
exports.deleteInventoryTransaction = asyncHandler(async (req, res) => {
  const transaction = await InventoryTransaction.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!transaction) {
    return res.status(404).json({
      success: false,
      message: 'معاملة المخزون غير موجودة'
    });
  }

  // تحديث الكمية المتاحة في عنصر المخزون
  const inventoryItem = await InventoryItem.findById(transaction.inventoryItemId);
  
  if (inventoryItem) {
    if (transaction.type === 'add') {
      // التحقق من إمكانية الحذف
      if (inventoryItem.availableQuantity < transaction.quantity) {
        return res.status(400).json({
          success: false,
          message: 'لا يمكن حذف المعاملة لأن الكمية المتاحة حاليًا أقل من الكمية المضافة'
        });
      }
      
      // تقليل الكمية المتاحة
      inventoryItem.availableQuantity -= transaction.quantity;
    } else if (transaction.type === 'use') {
      // زيادة الكمية المتاحة
      inventoryItem.availableQuantity += transaction.quantity;
    }
    
    // تحديث حالة المخزون المنخفض
    inventoryItem.isLowStock = (inventoryItem.availableQuantity <= inventoryItem.lowStockThreshold);
    await inventoryItem.save();
  }

  // حذف السجل المالي المرتبط إذا كان موجودًا
  if (transaction.type === 'add' && transaction.totalPrice > 0) {
    await FinancialRecord.deleteOne({
      relatedInventoryId: transaction.inventoryItemId,
      date: transaction.date,
      amount: transaction.totalPrice
    });
  }

  await transaction.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});