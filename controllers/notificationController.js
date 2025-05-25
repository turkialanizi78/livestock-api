// controllers/notificationController.js
const Notification = require('../models/Notification');
const asyncHandler = require('express-async-handler');

// @desc    الحصول على جميع الإشعارات
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = asyncHandler(async (req, res) => {
  let query = { userId: req.user.id };

  // إضافة فلترة حسب الطلب
  if (req.query.type) {
    query.type = req.query.type;
  }

  if (req.query.isRead !== undefined) {
    query.isRead = req.query.isRead === 'true';
  }

  // فلترة حسب التاريخ
  if (req.query.startDate || req.query.endDate) {
    query.createdAt = {};
    
    if (req.query.startDate) {
      query.createdAt.$gte = new Date(req.query.startDate);
    }
    
    if (req.query.endDate) {
      query.createdAt.$lte = new Date(req.query.endDate);
    }
  }

  // عدد الإشعارات المعروضة
  const limit = parseInt(req.query.limit) || 50;

  const notifications = await Notification.find(query)
    .populate('relatedAnimalId', 'identificationNumber')
    .populate('relatedVaccinationId', 'name')
    .populate('relatedInventoryId', 'name')
    .sort({ createdAt: -1 })
    .limit(limit);

  // الحصول على عدد الإشعارات غير المقروءة
  const unreadCount = await Notification.countDocuments({
    userId: req.user.id,
    isRead: false
  });

  res.status(200).json({
    success: true,
    count: notifications.length,
    unreadCount,
    data: notifications
  });
});

// @desc    الحصول على إشعار واحد
// @route   GET /api/notifications/:id
// @access  Private
exports.getNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    userId: req.user.id
  })
    .populate('relatedAnimalId', 'identificationNumber')
    .populate('relatedVaccinationId', 'name')
    .populate('relatedInventoryId', 'name');

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'الإشعار غير موجود'
    });
  }

  res.status(200).json({
    success: true,
    data: notification
  });
});

// @desc    تعيين إشعار كمقروء
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'الإشعار غير موجود'
    });
  }

  notification.isRead = true;
  await notification.save();

  res.status(200).json({
    success: true,
    data: notification
  });
});

// @desc    تعيين جميع الإشعارات كمقروءة
// @route   PUT /api/notifications/read-all
// @access  Private
exports.markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { userId: req.user.id, isRead: false },
    { isRead: true }
  );

  res.status(200).json({
    success: true,
    message: 'تم تعيين جميع الإشعارات كمقروءة'
  });
});

// @desc    حذف إشعار
// @route   DELETE /api/notifications/:id
// @access  Private
exports.deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'الإشعار غير موجود'
    });
  }

  await notification.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    حذف جميع الإشعارات المقروءة
// @route   DELETE /api/notifications/read
// @access  Private
exports.deleteReadNotifications = asyncHandler(async (req, res) => {
  await Notification.deleteMany({
    userId: req.user.id,
    isRead: true
  });

  res.status(200).json({
    success: true,
    message: 'تم حذف جميع الإشعارات المقروءة'
  });
});

// @desc    إنشاء إشعار جديد
// @route   POST /api/notifications
// @access  Private
exports.createNotification = asyncHandler(async (notificationData) => {
  // يستخدم داخليًا فقط، ليس كمسار API
  const notification = await Notification.create(notificationData);
  return notification;
});

// @desc    الحصول على عدد الإشعارات غير المقروءة
// @route   GET /api/notifications/unread-count
// @access  Private
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({
    userId: req.user.id,
    isRead: false
  });

  res.status(200).json({
    success: true,
    count
  });
});