//backend -- controllers/animalCategoryController.js
const AnimalCategory = require('../models/AnimalCategory');
const asyncHandler = require('express-async-handler');

// @desc    الحصول على جميع فئات الحيوانات
// @route   GET /api/categories
// @access  Private
exports.getCategories = asyncHandler(async (req, res) => {
  const categories = await AnimalCategory.find({ userId: req.user.id });

  res.status(200).json({
    success: true,
    count: categories.length,
    data: categories
  });
});

// @desc    الحصول على فئة حيوان واحدة
// @route   GET /api/categories/:id
// @access  Private
exports.getCategory = asyncHandler(async (req, res) => {
  const category = await AnimalCategory.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'الفئة غير موجودة'
    });
  }

  res.status(200).json({
    success: true,
    data: category
  });
});

// @desc    إنشاء فئة حيوان جديدة
// @route   POST /api/categories
// @access  Private
exports.createCategory = asyncHandler(async (req, res) => {
  // إضافة معرف المستخدم للطلب
  req.body.userId = req.user.id;

  const category = await AnimalCategory.create(req.body);

  res.status(201).json({
    success: true,
    data: category
  });
});

// @desc    تحديث فئة حيوان
// @route   PUT /api/categories/:id
// @access  Private
exports.updateCategory = asyncHandler(async (req, res) => {
  let category = await AnimalCategory.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'الفئة غير موجودة'
    });
  }

  category = await AnimalCategory.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: category
  });
});

// @desc    حذف فئة حيوان
// @route   DELETE /api/categories/:id
// @access  Private
exports.deleteCategory = asyncHandler(async (req, res) => {
  const category = await AnimalCategory.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'الفئة غير موجودة'
    });
  }

  await category.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});