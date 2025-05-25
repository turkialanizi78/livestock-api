// controllers/reminderController.js
const Reminder = require('../models/Reminder');
const asyncHandler = require('express-async-handler');

// @desc    الحصول على جميع التذكيرات
// @route   GET /api/reminders
// @access  Private
exports.getReminders = asyncHandler(async (req, res) => {
  let query = { userId: req.user.id };

  // إضافة فلترة حسب الطلب
  if (req.query.type) {
    query.type = req.query.type;
  }

  if (req.query.status) {
    query.status = req.query.status;
  }

  if (req.query.relatedAnimalId) {
    query.relatedAnimalId = req.query.relatedAnimalId;
  }

  // فلترة حسب التاريخ
  if (req.query.startDate || req.query.endDate) {
    query.dueDate = {};
    
    if (req.query.startDate) {
      query.dueDate.$gte = new Date(req.query.startDate);
    }
    
    if (req.query.endDate) {
      query.dueDate.$lte = new Date(req.query.endDate);
    }
  }

  const reminders = await Reminder.find(query)
    .populate('relatedAnimalId', 'identificationNumber')
    .populate('relatedVaccinationId', 'name')
    .populate('relatedInventoryId', 'name')
    .sort({ dueDate: 1 });

  res.status(200).json({
    success: true,
    count: reminders.length,
    data: reminders
  });
});

// @desc    الحصول على تذكير واحد
// @route   GET /api/reminders/:id
// @access  Private
exports.getReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOne({
    _id: req.params.id,
    userId: req.user.id
  })
    .populate('relatedAnimalId', 'identificationNumber')
    .populate('relatedVaccinationId', 'name')
    .populate('relatedInventoryId', 'name');

  if (!reminder) {
    return res.status(404).json({
      success: false,
      message: 'التذكير غير موجود'
    });
  }

  res.status(200).json({
    success: true,
    data: reminder
  });
});

// @desc    إنشاء تذكير جديد
// @route   POST /api/reminders
// @access  Private
exports.createReminder = asyncHandler(async (req, res) => {
  // إضافة معرف المستخدم للطلب
  req.body.userId = req.user.id;

  const reminder = await Reminder.create(req.body);

  res.status(201).json({
    success: true,
    data: reminder
  });
});

// @desc    تحديث تذكير
// @route   PUT /api/reminders/:id
// @access  Private
exports.updateReminder = asyncHandler(async (req, res) => {
  let reminder = await Reminder.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!reminder) {
    return res.status(404).json({
      success: false,
      message: 'التذكير غير موجود'
    });
  }

  reminder = await Reminder.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: reminder
  });
});

// @desc    حذف تذكير
// @route   DELETE /api/reminders/:id
// @access  Private
exports.deleteReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!reminder) {
    return res.status(404).json({
      success: false,
      message: 'التذكير غير موجود'
    });
  }

  await reminder.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    تعيين تذكير كمكتمل
// @route   PUT /api/reminders/:id/complete
// @access  Private
exports.completeReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!reminder) {
    return res.status(404).json({
      success: false,
      message: 'التذكير غير موجود'
    });
  }

  reminder.status = 'completed';
  await reminder.save();

  // إذا كان التذكير دوريًا، قم بإنشاء التذكير التالي
  if (reminder.repeat !== 'none') {
    let nextDueDate = new Date(reminder.dueDate);
    
    switch (reminder.repeat) {
      case 'daily':
        nextDueDate.setDate(nextDueDate.getDate() + 1);
        break;
      case 'weekly':
        nextDueDate.setDate(nextDueDate.getDate() + 7);
        break;
      case 'monthly':
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        break;
      case 'yearly':
        nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
        break;
    }
    
    let nextReminderDate = new Date(reminder.reminderDate);
    nextReminderDate.setDate(nextReminderDate.getDate() + (nextDueDate.getTime() - reminder.dueDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // إنشاء التذكير التالي
    await Reminder.create({
      type: reminder.type,
      title: reminder.title,
      description: reminder.description,
      dueDate: nextDueDate,
      reminderDate: nextReminderDate,
      repeat: reminder.repeat,
      status: 'pending',
      relatedAnimalId: reminder.relatedAnimalId,
      relatedVaccinationId: reminder.relatedVaccinationId,
      relatedInventoryId: reminder.relatedInventoryId,
      notes: reminder.notes,
      userId: reminder.userId
    });
  }

  res.status(200).json({
    success: true,
    data: reminder
  });
});

// @desc    الحصول على التذكيرات القادمة
// @route   GET /api/reminders/upcoming
// @access  Private
exports.getUpcomingReminders = asyncHandler(async (req, res) => {
  const now = new Date();
  const endDate = new Date();
  endDate.setDate(now.getDate() + (req.query.days ? parseInt(req.query.days) : 7));

  const reminders = await Reminder.find({
    userId: req.user.id,
    status: 'pending',
    dueDate: {
      $gte: now,
      $lte: endDate
    }
  })
    .populate('relatedAnimalId', 'identificationNumber')
    .populate('relatedVaccinationId', 'name')
    .populate('relatedInventoryId', 'name')
    .sort({ dueDate: 1 });

  res.status(200).json({
    success: true,
    count: reminders.length,
    data: reminders
  });
});

// @desc    الحصول على التذكيرات المتأخرة
// @route   GET /api/reminders/overdue
// @access  Private
exports.getOverdueReminders = asyncHandler(async (req, res) => {
  const now = new Date();

  const reminders = await Reminder.find({
    userId: req.user.id,
    status: 'pending',
    dueDate: { $lt: now }
  })
    .populate('relatedAnimalId', 'identificationNumber')
    .populate('relatedVaccinationId', 'name')
    .populate('relatedInventoryId', 'name')
    .sort({ dueDate: 1 });

  res.status(200).json({
    success: true,
    count: reminders.length,
    data: reminders
  });
});