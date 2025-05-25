// controllers/defaultWithdrawalPeriodController.js
const DefaultWithdrawalPeriod = require('../models/DefaultWithdrawalPeriod');
const asyncHandler = require('express-async-handler');

// @desc    الحصول على جميع فترات الحظر الافتراضية
// @route   GET /api/withdrawal-periods
// @access  Private
exports.getDefaultWithdrawalPeriods = asyncHandler(async (req, res) => {
  let query = { userId: req.user.id };

  // إضافة فلترة حسب الطلب
  if (req.query.type) {
    query.type = req.query.type;
  }

  if (req.query.categoryId) {
    query.categoryId = req.query.categoryId;
  }

  const periods = await DefaultWithdrawalPeriod.find(query)
    .populate('categoryId', 'name')
    .sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: periods.length,
    data: periods
  });
});

// @desc    الحصول على فترة حظر افتراضية واحدة
// @route   GET /api/withdrawal-periods/:id
// @access  Private
exports.getDefaultWithdrawalPeriod = asyncHandler(async (req, res) => {
  const period = await DefaultWithdrawalPeriod.findOne({
    _id: req.params.id,
    userId: req.user.id
  }).populate('categoryId', 'name');

  if (!period) {
    return res.status(404).json({
      success: false,
      message: 'فترة الحظر الافتراضية غير موجودة'
    });
  }

  res.status(200).json({
    success: true,
    data: period
  });
});

// @desc    إنشاء فترة حظر افتراضية جديدة
// @route   POST /api/withdrawal-periods
// @access  Private
exports.createDefaultWithdrawalPeriod = asyncHandler(async (req, res) => {
  // إضافة معرف المستخدم للطلب
  req.body.userId = req.user.id;

  try {
    const period = await DefaultWithdrawalPeriod.create(req.body);

    res.status(201).json({
      success: true,
      data: period
    });
  } catch (error) {
    // التعامل مع خطأ التكرار
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'فترة الحظر الافتراضية موجودة بالفعل لهذه الفئة'
      });
    }
    throw error;
  }
});

// @desc    تحديث فترة حظر افتراضية
// @route   PUT /api/withdrawal-periods/:id
// @access  Private
exports.updateDefaultWithdrawalPeriod = asyncHandler(async (req, res) => {
  let period = await DefaultWithdrawalPeriod.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!period) {
    return res.status(404).json({
      success: false,
      message: 'فترة الحظر الافتراضية غير موجودة'
    });
  }

  period = await DefaultWithdrawalPeriod.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: period
  });
});

// @desc    حذف فترة حظر افتراضية
// @route   DELETE /api/withdrawal-periods/:id
// @access  Private
exports.deleteDefaultWithdrawalPeriod = asyncHandler(async (req, res) => {
  const period = await DefaultWithdrawalPeriod.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!period) {
    return res.status(404).json({
      success: false,
      message: 'فترة الحظر الافتراضية غير موجودة'
    });
  }

  await period.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    الحصول على فترات الحظر الافتراضية لفئة معينة
// @route   GET /api/categories/:categoryId/withdrawal-periods
// @access  Private
exports.getCategoryDefaultWithdrawalPeriods = asyncHandler(async (req, res) => {
  const periods = await DefaultWithdrawalPeriod.find({
    categoryId: req.params.categoryId,
    userId: req.user.id
  }).sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: periods.length,
    data: periods
  });
});