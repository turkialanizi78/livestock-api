// controllers/healthEventController.js
const HealthEvent = require('../models/HealthEvent');
const Animal = require('../models/Animal');
const asyncHandler = require('express-async-handler');
const { createNotification } = require('./notificationController');

// @desc    الحصول على جميع الأحداث الصحية
// @route   GET /api/health
// @access  Private
exports.getHealthEvents = asyncHandler(async (req, res) => {
  let query = { userId: req.user.id };

  // إضافة فلترة حسب الطلب
  if (req.query.eventType) {
    query.eventType = req.query.eventType;
  }

  if (req.query.animalId) {
    query.animalId = req.query.animalId;
  }

  if (req.query.severity) {
    query.severity = req.query.severity;
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

  const healthEvents = await HealthEvent.find(query)
    .populate('animalId', 'identificationNumber')
    .sort({ date: -1 });

  res.status(200).json({
    success: true,
    count: healthEvents.length,
    data: healthEvents
  });
});

// @desc    الحصول على حدث صحي واحد
// @route   GET /api/health/:id
// @access  Private
exports.getHealthEvent = asyncHandler(async (req, res) => {
  const healthEvent = await HealthEvent.findOne({
    _id: req.params.id,
    userId: req.user.id
  }).populate('animalId', 'identificationNumber categoryId');

  if (!healthEvent) {
    return res.status(404).json({
      success: false,
      message: 'الحدث الصحي غير موجود'
    });
  }

  res.status(200).json({
    success: true,
    data: healthEvent
  });
});

// @desc    إنشاء حدث صحي جديد
// @route   POST /api/health
// @access  Private
exports.createHealthEvent = asyncHandler(async (req, res) => {
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

  // إضافة معرف المستخدم للطلب
  req.body.userId = req.user.id;

  const healthEvent = await HealthEvent.create(req.body);

  // إذا كان هناك فترة حظر، قم بتحديث حالة الحيوان
  if (healthEvent.productWithdrawalPeriod > 0 && healthEvent.withdrawalEndDate) {
    animal.restriction = {
      isRestricted: true,
      reason: 'treatment',
      restrictionEndDate: healthEvent.withdrawalEndDate,
      notes: `تم تقييد الحيوان بسبب العلاج: ${healthEvent.treatmentGiven || healthEvent.description}`
    };

    await animal.save();

    // إنشاء إشعار بفرض الحظر
    await createNotification({
      userId: req.user.id,
      title: 'تم فرض حظر على حيوان',
      message: `تم فرض حظر على الحيوان ${animal.identificationNumber} بسبب العلاج. تاريخ انتهاء الحظر: ${healthEvent.withdrawalEndDate.toLocaleDateString('ar-SA')}`,
      type: 'withdrawal',
      relatedAnimalId: animal._id,
      relatedHealthEventId: healthEvent._id
    });
  }

  res.status(201).json({
    success: true,
    data: healthEvent
  });
});

// @desc    تحديث حدث صحي
// @route   PUT /api/health/:id
// @access  Private
exports.updateHealthEvent = asyncHandler(async (req, res) => {
  let healthEvent = await HealthEvent.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!healthEvent) {
    return res.status(404).json({
      success: false,
      message: 'الحدث الصحي غير موجود'
    });
  }

  // تحقق من تغيير فترة الحظر
  let updateAnimalRestriction = false;
  let oldWithdrawalEndDate = healthEvent.withdrawalEndDate;
  
  if (req.body.productWithdrawalPeriod && req.body.productWithdrawalPeriod !== healthEvent.productWithdrawalPeriod) {
    const eventDate = new Date(req.body.date || healthEvent.date);
    req.body.withdrawalEndDate = new Date(eventDate.setDate(eventDate.getDate() + parseInt(req.body.productWithdrawalPeriod)));
    updateAnimalRestriction = true;
  }

  healthEvent = await HealthEvent.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  // تحديث حالة الحظر للحيوان إذا لزم الأمر
  if (updateAnimalRestriction) {
    const animal = await Animal.findById(healthEvent.animalId);
    
    if (animal) {
      // تحقق مما إذا كانت فترة الحظر الحالية مرتبطة بهذا الحدث
      if (animal.restriction.isRestricted && 
          animal.restriction.reason === 'treatment' && 
          animal.restriction.restrictionEndDate.getTime() === oldWithdrawalEndDate.getTime()) {
        
        if (healthEvent.productWithdrawalPeriod > 0) {
          // تحديث فترة الحظر
          animal.restriction = {
            isRestricted: true,
            reason: 'treatment',
            restrictionEndDate: healthEvent.withdrawalEndDate,
            notes: `تم تحديث فترة الحظر بسبب تغيير العلاج: ${healthEvent.treatmentGiven || healthEvent.description}`
          };
        } else {
          // إزالة الحظر
          animal.restriction = {
            isRestricted: false,
            reason: null,
            restrictionEndDate: null,
            notes: null
          };
        }
        
        await animal.save();
        
        // إنشاء إشعار بتحديث الحظر
        await createNotification({
          userId: req.user.id,
          title: 'تم تحديث حالة الحظر',
          message: `تم تحديث حالة الحظر للحيوان ${animal.identificationNumber}. ${healthEvent.productWithdrawalPeriod > 0 ? `تاريخ انتهاء الحظر الجديد: ${healthEvent.withdrawalEndDate.toLocaleDateString('ar-SA')}` : 'تم إلغاء الحظر.'}`,
          type: 'withdrawal',
          relatedAnimalId: animal._id,
          relatedHealthEventId: healthEvent._id
        });
      }
    }
  }

  res.status(200).json({
    success: true,
    data: healthEvent
  });
});

// @desc    حذف حدث صحي
// @route   DELETE /api/health/:id
// @access  Private
exports.deleteHealthEvent = asyncHandler(async (req, res) => {
  const healthEvent = await HealthEvent.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!healthEvent) {
    return res.status(404).json({
      success: false,
      message: 'الحدث الصحي غير موجود'
    });
  }

  // تحقق مما إذا كان الحظر الحالي على الحيوان مرتبط بهذا الحدث
  if (healthEvent.productWithdrawalPeriod > 0 && healthEvent.withdrawalEndDate) {
    const animal = await Animal.findById(healthEvent.animalId);
    
    if (animal && animal.restriction.isRestricted && 
        animal.restriction.reason === 'treatment' && 
        animal.restriction.restrictionEndDate.getTime() === healthEvent.withdrawalEndDate.getTime()) {
      
      // إزالة الحظر
      animal.restriction = {
        isRestricted: false,
        reason: null,
        restrictionEndDate: null,
        notes: null
      };
      
      await animal.save();
      
      // إنشاء إشعار بإزالة الحظر
      await createNotification({
        userId: req.user.id,
        title: 'تم إلغاء الحظر',
        message: `تم إلغاء الحظر عن الحيوان ${animal.identificationNumber} بسبب حذف الحدث الصحي.`,
        type: 'withdrawal',
        relatedAnimalId: animal._id
      });
    }
  }

  await healthEvent.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});