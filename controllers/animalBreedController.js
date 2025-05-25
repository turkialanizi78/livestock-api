//backend -- controllers/animalBreedController.js
const AnimalBreed = require('../models/AnimalBreed');
const asyncHandler = require('express-async-handler');

// @desc    الحصول على جميع سلالات الحيوانات
// @route   GET /api/breeds
// @access  Private
exports.getBreeds = asyncHandler(async (req, res) => {
  let query = { userId: req.user.id };

  // إضافة فلتر للفئة إذا تم تحديده
  if (req.query.categoryId) {
    query.categoryId = req.query.categoryId;
  }

  const breeds = await AnimalBreed.find(query).populate('categoryId', 'name');

  res.status(200).json({
    success: true,
    count: breeds.length,
    data: breeds
  });
});

// @desc    الحصول على سلالة حيوان واحدة
// @route   GET /api/breeds/:id
// @access  Private
exports.getBreed = asyncHandler(async (req, res) => {
  const breed = await AnimalBreed.findOne({
    _id: req.params.id,
    userId: req.user.id
  }).populate('categoryId', 'name');

  if (!breed) {
    return res.status(404).json({
      success: false,
      message: 'السلالة غير موجودة'
    });
  }

  res.status(200).json({
    success: true,
    data: breed
  });
});

// @desc    إنشاء سلالة حيوان جديدة
// @route   POST /api/breeds
// @access  Private
exports.createBreed = asyncHandler(async (req, res) => {
  // إضافة معرف المستخدم للطلب
  req.body.userId = req.user.id;

  const breed = await AnimalBreed.create(req.body);

  res.status(201).json({
    success: true,
    data: breed
  });
});

// @desc    تحديث سلالة حيوان
// @route   PUT /api/breeds/:id
// @access  Private
exports.updateBreed = asyncHandler(async (req, res) => {
  let breed = await AnimalBreed.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!breed) {
    return res.status(404).json({
      success: false,
      message: 'السلالة غير موجودة'
    });
  }

  breed = await AnimalBreed.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: breed
  });
});

// @desc    حذف سلالة حيوان
// @route   DELETE /api/breeds/:id
// @access  Private
exports.deleteBreed = asyncHandler(async (req, res) => {
  try {
    const breed = await AnimalBreed.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!breed) {
      return res.status(404).json({
        success: false,
        message: 'السلالة غير موجودة أو غير مصرح لك بحذفها'
      });
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error deleting breed:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في حذف السلالة'
    });
  }
});


// @desc    الحصول على سلالات حيوان لفئة محددة
// @route   GET /api/categories/:categoryId/breeds
// @access  Private
exports.getCategoryBreeds = asyncHandler(async (req, res) => {
  const breeds = await AnimalBreed.find({
    categoryId: req.params.categoryId,
    userId: req.user.id
  });

  res.status(200).json({
    success: true,
    count: breeds.length,
    data: breeds
  });
});