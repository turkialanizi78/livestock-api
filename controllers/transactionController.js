// controllers/transactionController.js
const Transaction = require('../models/Transaction');
const Animal = require('../models/Animal');
const FinancialRecord = require('../models/FinancialRecord');
const asyncHandler = require('express-async-handler');

// @desc    الحصول على جميع المعاملات
// @route   GET /api/transactions
// @access  Private
exports.getTransactions = asyncHandler(async (req, res) => {
  let query = { userId: req.user.id };

  // إضافة فلترة حسب الطلب
  if (req.query.type) {
    query.type = req.query.type;
  }

  if (req.query.animalId) {
    query.animalId = req.query.animalId;
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

  const transactions = await Transaction.find(query)
    .populate('animalId', 'identificationNumber')
    .sort({ date: -1 });

  res.status(200).json({
    success: true,
    count: transactions.length,
    data: transactions
  });
});

// @desc    الحصول على معاملة واحدة
// @route   GET /api/transactions/:id
// @access  Private
exports.getTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findOne({
    _id: req.params.id,
    userId: req.user.id
  }).populate('animalId', 'identificationNumber categoryId breedId');

  if (!transaction) {
    return res.status(404).json({
      success: false,
      message: 'المعاملة غير موجودة'
    });
  }

  res.status(200).json({
    success: true,
    data: transaction
  });
});

// @desc    إنشاء معاملة جديدة
// @route   POST /api/transactions
// @access  Private
exports.createTransaction = asyncHandler(async (req, res) => {
  // التحقق من وجود الحيوان
  const animal = await Animal.findOne({
    _id: req.body.animalId,
    userId: req.user.id
  });

  if (!animal) {
    return res.status(404).json({
      success: false,
      message: 'الحيوان غير موجود'
    });
  }

  // التحقق من حالة الحظر إذا كان نوع المعاملة بيع أو ذبح
  if ((req.body.type === 'sale' || req.body.type === 'slaughter') && animal.restriction.isRestricted) {
    const now = new Date();
    const restrictionEndDate = new Date(animal.restriction.restrictionEndDate);
    
    if (now < restrictionEndDate) {
      if (!req.body.restrictionChecked) {
        return res.status(400).json({
          success: false,
          message: `الحيوان محظور حاليًا حتى ${restrictionEndDate.toLocaleDateString('ar-SA')}. تأكيد المتابعة مطلوب.`,
          restriction: animal.restriction
        });
      }
    }
  }

  // إضافة معرف المستخدم للطلب
  req.body.userId = req.user.id;

  const transaction = await Transaction.create(req.body);

  // تحديث حالة الحيوان
  if (req.body.type === 'sale') {
    animal.status = 'sold';
    await animal.save();
  } else if (req.body.type === 'slaughter') {
    animal.status = 'slaughtered';
    await animal.save();
  }

  // إنشاء سجل مالي
  let financialRecord;
  if (req.body.type === 'purchase') {
    financialRecord = await FinancialRecord.create({
      animalId: animal._id,
      type: 'expense',
      category: 'purchase',
      amount: req.body.price,
      date: req.body.date,
      description: `شراء الحيوان ${animal.identificationNumber}`,
      relatedTransactionId: transaction._id,
      supplier: req.body.seller?.name,
      paymentMethod: req.body.paymentMethod,
      userId: req.user.id
    });
  } else if (req.body.type === 'sale') {
    financialRecord = await FinancialRecord.create({
      animalId: animal._id,
      type: 'income',
      category: 'sale',
      amount: req.body.price,
      date: req.body.date,
      description: `بيع الحيوان ${animal.identificationNumber}`,
      relatedTransactionId: transaction._id,
      customer: req.body.buyer?.name,
      paymentMethod: req.body.paymentMethod,
      userId: req.user.id
    });
  }

  res.status(201).json({
    success: true,
    data: transaction,
    financialRecord
  });
});

// @desc    تحديث معاملة
// @route   PUT /api/transactions/:id
// @access  Private
exports.updateTransaction = asyncHandler(async (req, res) => {
  let transaction = await Transaction.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!transaction) {
    return res.status(404).json({
      success: false,
      message: 'المعاملة غير موجودة'
    });
  }

  // تحديث المعاملة
  transaction = await Transaction.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  // تحديث السجل المالي المرتبط
  const financialRecord = await FinancialRecord.findOne({
    relatedTransactionId: transaction._id
  });

  if (financialRecord) {
    // تحديث البيانات المالية
    financialRecord.amount = req.body.price || financialRecord.amount;
    financialRecord.date = req.body.date || financialRecord.date;
    
    if (transaction.type === 'purchase') {
      financialRecord.supplier = req.body.seller?.name || financialRecord.supplier;
    } else if (transaction.type === 'sale') {
      financialRecord.customer = req.body.buyer?.name || financialRecord.customer;
    }
    
    financialRecord.paymentMethod = req.body.paymentMethod || financialRecord.paymentMethod;
    
    await financialRecord.save();
  }

  res.status(200).json({
    success: true,
    data: transaction,
    financialRecord
  });
});

// @desc    حذف معاملة
// @route   DELETE /api/transactions/:id
// @access  Private
exports.deleteTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!transaction) {
    return res.status(404).json({
      success: false,
      message: 'المعاملة غير موجودة'
    });
  }

  // إلغاء حالة الحيوان إذا كانت هذه آخر معاملة للحيوان
  const animal = await Animal.findById(transaction.animalId);
  if (animal) {
    if (transaction.type === 'sale' && animal.status === 'sold') {
      animal.status = 'alive';
      await animal.save();
    } else if (transaction.type === 'slaughter' && animal.status === 'slaughtered') {
      animal.status = 'alive';
      await animal.save();
    }
  }

  // حذف السجل المالي المرتبط
  await FinancialRecord.deleteOne({
    relatedTransactionId: transaction._id
  });

  await transaction.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    الحصول على معاملات الحيوان
// @route   GET /api/animals/:animalId/transactions
// @access  Private
exports.getAnimalTransactions = asyncHandler(async (req, res) => {
  const animal = await Animal.findOne({
    _id: req.params.animalId,
    userId: req.user.id
  });

  if (!animal) {
    return res.status(404).json({
      success: false,
      message: 'الحيوان غير موجود'
    });
  }

  const transactions = await Transaction.find({
    animalId: animal._id
  }).sort({ date: -1 });

  res.status(200).json({
    success: true,
    count: transactions.length,
    data: transactions
  });
});