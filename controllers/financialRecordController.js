// controllers/financialRecordController.js
const FinancialRecord = require('../models/FinancialRecord');
const Animal = require('../models/Animal');
const asyncHandler = require('express-async-handler');

// @desc    الحصول على جميع السجلات المالية
// @route   GET /api/financial
// @access  Private
exports.getFinancialRecords = asyncHandler(async (req, res) => {
  let query = { userId: req.user.id };

  // إضافة فلترة حسب الطلب
  if (req.query.type) {
    query.type = req.query.type;
  }

  if (req.query.category) {
    query.category = req.query.category;
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

  const financialRecords = await FinancialRecord.find(query)
    .populate('animalId', 'identificationNumber')
    .populate('relatedTransactionId')
    .populate('relatedInventoryId')
    .sort({ date: -1 });

  res.status(200).json({
    success: true,
    count: financialRecords.length,
    data: financialRecords
  });
});

// @desc    الحصول على سجل مالي واحد
// @route   GET /api/financial/:id
// @access  Private
exports.getFinancialRecord = asyncHandler(async (req, res) => {
  const financialRecord = await FinancialRecord.findOne({
    _id: req.params.id,
    userId: req.user.id
  })
    .populate('animalId', 'identificationNumber')
    .populate('relatedTransactionId')
    .populate('relatedInventoryId');

  if (!financialRecord) {
    return res.status(404).json({
      success: false,
      message: 'السجل المالي غير موجود'
    });
  }

  res.status(200).json({
    success: true,
    data: financialRecord
  });
});

// @desc    إنشاء سجل مالي جديد
// @route   POST /api/financial
// @access  Private
exports.createFinancialRecord = asyncHandler(async (req, res) => {
  // التحقق من وجود الحيوان إذا تم تحديده
  if (req.body.animalId) {
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
  }

  // إضافة معرف المستخدم للطلب
  req.body.userId = req.user.id;

  const financialRecord = await FinancialRecord.create(req.body);

  res.status(201).json({
    success: true,
    data: financialRecord
  });
});

// @desc    تحديث سجل مالي
// @route   PUT /api/financial/:id
// @access  Private
exports.updateFinancialRecord = asyncHandler(async (req, res) => {
  // التحقق من وجود الحيوان إذا تم تحديده
  if (req.body.animalId) {
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
  }

  let financialRecord = await FinancialRecord.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!financialRecord) {
    return res.status(404).json({
      success: false,
      message: 'السجل المالي غير موجود'
    });
  }

  // التحقق مما إذا كان السجل مرتبط بمعاملة
  if (financialRecord.relatedTransactionId) {
    return res.status(400).json({
      success: false,
      message: 'لا يمكن تعديل سجل مالي مرتبط بمعاملة، قم بتعديل المعاملة نفسها'
    });
  }

  financialRecord = await FinancialRecord.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: financialRecord
  });
});

// @desc    حذف سجل مالي
// @route   DELETE /api/financial/:id
// @access  Private
exports.deleteFinancialRecord = asyncHandler(async (req, res) => {
  const financialRecord = await FinancialRecord.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!financialRecord) {
    return res.status(404).json({
      success: false,
      message: 'السجل المالي غير موجود'
    });
  }

  // التحقق مما إذا كان السجل مرتبط بمعاملة
  if (financialRecord.relatedTransactionId) {
    return res.status(400).json({
      success: false,
      message: 'لا يمكن حذف سجل مالي مرتبط بمعاملة، قم بحذف المعاملة نفسها'
    });
  }

  await financialRecord.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    الحصول على ملخص مالي
// @route   GET /api/financial/summary
// @access  Private
exports.getFinancialSummary = asyncHandler(async (req, res) => {
  // فلترة حسب التاريخ
  let dateFilter = {};
  
  if (req.query.startDate || req.query.endDate) {
    if (req.query.startDate) {
      dateFilter.$gte = new Date(req.query.startDate);
    }
    
    if (req.query.endDate) {
      dateFilter.$lte = new Date(req.query.endDate);
    }
  }

  // المبالغ الإجمالية
  const totalIncome = await FinancialRecord.aggregate([
    {
      $match: {
        userId: req.user._id,
        type: 'income',
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  const totalExpense = await FinancialRecord.aggregate([
    {
      $match: {
        userId: req.user._id,
        type: 'expense',
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  // تحليل حسب الفئة
  const incomeByCategory = await FinancialRecord.aggregate([
    {
      $match: {
        userId: req.user._id,
        type: 'income',
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
      }
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' }
      }
    },
    {
      $sort: { total: -1 }
    }
  ]);

  const expenseByCategory = await FinancialRecord.aggregate([
    {
      $match: {
        userId: req.user._id,
        type: 'expense',
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
      }
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' }
      }
    },
    {
      $sort: { total: -1 }
    }
  ]);

  // التحليل الشهري
  const monthlyAnalysis = await FinancialRecord.aggregate([
    {
      $match: {
        userId: req.user._id,
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' },
          type: '$type'
        },
        total: { $sum: '$amount' }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    }
  ]);

  // تنظيم التحليل الشهري
  const months = {};
  monthlyAnalysis.forEach(item => {
    const key = `${item._id.year}-${item._id.month}`;
    if (!months[key]) {
      months[key] = {
        year: item._id.year,
        month: item._id.month,
        income: 0,
        expense: 0
      };
    }
    
    if (item._id.type === 'income') {
      months[key].income = item.total;
    } else {
      months[key].expense = item.total;
    }
  });

  const summary = {
    totalIncome: totalIncome.length > 0 ? totalIncome[0].total : 0,
    totalExpense: totalExpense.length > 0 ? totalExpense[0].total : 0,
    profit: (totalIncome.length > 0 ? totalIncome[0].total : 0) - (totalExpense.length > 0 ? totalExpense[0].total : 0),
    incomeByCategory,
    expenseByCategory,
    monthlyAnalysis: Object.values(months).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    })
  };

  res.status(200).json({
    success: true,
    data: summary
  });
});