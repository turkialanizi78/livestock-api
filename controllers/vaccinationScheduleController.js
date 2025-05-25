// controllers/vaccinationScheduleController.js
const VaccinationSchedule = require('../models/VaccinationSchedule');
const asyncHandler = require('express-async-handler');

// @desc    الحصول على جميع جداول التطعيم
// @route   GET /api/vaccination-schedules
// @access  Private
exports.getVaccinationSchedules = asyncHandler(async (req, res) => {
  let query = { userId: req.user.id };

  // إضافة فلترة حسب الطلب
  if (req.query.categoryId) {
    query.categoryId = req.query.categoryId;
  }

  const vaccinationSchedules = await VaccinationSchedule.find(query)
    .populate('categoryId', 'name')
    .sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: vaccinationSchedules.length,
    data: vaccinationSchedules
  });
});

// @desc    الحصول على جدول تطعيم واحد
// @route   GET /api/vaccination-schedules/:id
// @access  Private
exports.getVaccinationSchedule = asyncHandler(async (req, res) => {
  const vaccinationSchedule = await VaccinationSchedule.findOne({
    _id: req.params.id,
    userId: req.user.id
  }).populate('categoryId', 'name');

  if (!vaccinationSchedule) {
    return res.status(404).json({
      success: false,
      message: 'جدول التطعيم غير موجود'
    });
  }

  res.status(200).json({
    success: true,
    data: vaccinationSchedule
  });
});

// @desc    إنشاء جدول تطعيم جديد
// @route   POST /api/vaccination-schedules
// @access  Private
exports.createVaccinationSchedule = asyncHandler(async (req, res) => {
  // إضافة معرف المستخدم للطلب
  req.body.userId = req.user.id;

  const vaccinationSchedule = await VaccinationSchedule.create(req.body);

  res.status(201).json({
    success: true,
    data: vaccinationSchedule
  });
});

// @desc    تحديث جدول تطعيم
// @route   PUT /api/vaccination-schedules/:id
// @access  Private
exports.updateVaccinationSchedule = asyncHandler(async (req, res) => {
  let vaccinationSchedule = await VaccinationSchedule.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!vaccinationSchedule) {
    return res.status(404).json({
      success: false,
      message: 'جدول التطعيم غير موجود'
    });
  }

  vaccinationSchedule = await VaccinationSchedule.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: vaccinationSchedule
  });
});

// @desc    حذف جدول تطعيم
// @route   DELETE /api/vaccination-schedules/:id
// @access  Private
exports.deleteVaccinationSchedule = asyncHandler(async (req, res) => {
  const vaccinationSchedule = await VaccinationSchedule.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!vaccinationSchedule) {
    return res.status(404).json({
      success: false,
      message: 'جدول التطعيم غير موجود'
    });
  }

  await vaccinationSchedule.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    الحصول على جداول تطعيم فئة معينة
// @route   GET /api/categories/:categoryId/vaccination-schedules
// @access  Private
exports.getCategoryVaccinationSchedules = asyncHandler(async (req, res) => {
  const vaccinationSchedules = await VaccinationSchedule.find({
    categoryId: req.params.categoryId,
    userId: req.user.id
  }).sort({ requiredAge: 1 });

  res.status(200).json({
    success: true,
    count: vaccinationSchedules.length,
    data: vaccinationSchedules
  });
});