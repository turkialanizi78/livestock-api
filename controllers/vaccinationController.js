// controllers/vaccinationController.js
const Vaccination = require('../models/Vaccination');
const Animal = require('../models/Animal');
const VaccinationSchedule = require('../models/VaccinationSchedule');
const asyncHandler = require('express-async-handler');
const { createNotification } = require('./notificationController');

// @desc    الحصول على جميع التطعيمات
// @route   GET /api/vaccinations
// @access  Private
exports.getVaccinations = asyncHandler(async (req, res) => {
  let query = { userId: req.user.id };

  // إضافة فلترة حسب الطلب
  if (req.query.status) {
    query.status = req.query.status;
  }

  if (req.query.animalId) {
    query.animalId = req.query.animalId;
  }

  // فلترة حسب التاريخ
  if (req.query.startDate || req.query.endDate) {
    query.scheduleDate = {};
    
    if (req.query.startDate) {
      query.scheduleDate.$gte = new Date(req.query.startDate);
    }
    
    if (req.query.endDate) {
      query.scheduleDate.$lte = new Date(req.query.endDate);
    }
  }

  const vaccinations = await Vaccination.find(query)
    .populate('animalId', 'identificationNumber')
    .sort({ scheduleDate: 1 });

  res.status(200).json({
    success: true,
    count: vaccinations.length,
    data: vaccinations
  });
});

// @desc    الحصول على تطعيم واحد
// @route   GET /api/vaccinations/:id
// @access  Private
exports.getVaccination = asyncHandler(async (req, res) => {
  const vaccination = await Vaccination.findOne({
    _id: req.params.id,
    userId: req.user.id
  }).populate('animalId', 'identificationNumber categoryId');

  if (!vaccination) {
    return res.status(404).json({
      success: false,
      message: 'التطعيم غير موجود'
    });
  }

  res.status(200).json({
    success: true,
    data: vaccination
  });
});

// @desc    إنشاء تطعيم جديد
// @route   POST /api/vaccinations
// @access  Private
exports.createVaccination = asyncHandler(async (req, res) => {
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

  const vaccination = await Vaccination.create(req.body);

  // التحقق مما إذا كان التطعيم مكتملًا وله فترة حظر
  if (vaccination.status === 'completed' && vaccination.administrationDate) {
    const maxWithdrawalPeriod = Math.max(
      vaccination.meatWithdrawalPeriod || 0,
      vaccination.milkWithdrawalPeriod || 0
    );

    if (maxWithdrawalPeriod > 0) {
      // حساب تاريخ انتهاء فترة الحظر
      const adminDate = new Date(vaccination.administrationDate);
      const restrictionEndDate = new Date(adminDate);
      restrictionEndDate.setDate(restrictionEndDate.getDate() + maxWithdrawalPeriod);

      // تحديث حالة حظر الحيوان
      animal.restriction = {
        isRestricted: true,
        reason: 'vaccination',
        restrictionEndDate,
        notes: `تم تقييد الحيوان بسبب التطعيم: ${vaccination.name}`
      };

      await animal.save();

      // تحديث تاريخ انتهاء الحظر في التطعيم
      vaccination.withdrawalEndDate = restrictionEndDate;
      await vaccination.save();

      // إنشاء إشعار بفرض الحظر
      try {
        await createNotification({
          userId: req.user.id,
          title: 'تم فرض حظر على حيوان',
          message: `تم فرض حظر على الحيوان ${animal.identificationNumber} بسبب التطعيم. تاريخ انتهاء الحظر: ${restrictionEndDate.toLocaleDateString('ar-SA')}`,
          type: 'withdrawal',
          relatedAnimalId: animal._id,
          relatedVaccinationId: vaccination._id
        });
      } catch (error) {
        console.error('خطأ في إنشاء الإشعار:', error);
        // لا نريد رفض العملية بالكامل إذا فشل إنشاء الإشعار
      }
    }
  }

  res.status(201).json({
    success: true,
    data: vaccination
  });
});


// @desc    تحديث تطعيم
// @route   PUT /api/vaccinations/:id
// @access  Private
exports.updateVaccination = asyncHandler(async (req, res) => {
  let vaccination = await Vaccination.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!vaccination) {
    return res.status(404).json({
      success: false,
      message: 'التطعيم غير موجود'
    });
  }

  // إذا تم تنفيذ التطعيم، تحديث حالة الحظر للحيوان
  if (req.body.administrationDate && !vaccination.administrationDate) {
    const animal = await Animal.findById(vaccination.animalId);
    
    if (animal) {
      const maxWithdrawalPeriod = Math.max(
        req.body.meatWithdrawalPeriod || vaccination.meatWithdrawalPeriod || 0,
        req.body.milkWithdrawalPeriod || vaccination.milkWithdrawalPeriod || 0
      );

      if (maxWithdrawalPeriod > 0) {
        const adminDate = new Date(req.body.administrationDate);
        const restrictionEndDate = new Date(adminDate);
        restrictionEndDate.setDate(restrictionEndDate.getDate() + maxWithdrawalPeriod);

        animal.restriction = {
          isRestricted: true,
          reason: 'vaccination',
          restrictionEndDate,
          notes: `تم تقييد الحيوان بسبب التطعيم: ${vaccination.name}`
        };

        await animal.save();

        // إنشاء إشعار بفرض الحظر
        await createNotification({
          userId: req.user.id,
          title: 'تم فرض حظر على حيوان',
          message: `تم فرض حظر على الحيوان ${animal.identificationNumber} بسبب التطعيم. تاريخ انتهاء الحظر: ${restrictionEndDate.toLocaleDateString('ar-SA')}`,
          type: 'withdrawal',
          relatedAnimalId: animal._id,
          relatedVaccinationId: vaccination._id
        });
      }
    }
  }

  vaccination = await Vaccination.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: vaccination
  });
});

// @desc    حذف تطعيم
// @route   DELETE /api/vaccinations/:id
// @access  Private
exports.deleteVaccination = asyncHandler(async (req, res) => {
  const vaccination = await Vaccination.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!vaccination) {
    return res.status(404).json({
      success: false,
      message: 'التطعيم غير موجود'
    });
  }

  await vaccination.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    تعيين تطعيم كمكتمل
// @route   PUT /api/vaccinations/:id/complete
// @access  Private
exports.completeVaccination = asyncHandler(async (req, res) => {
  const vaccination = await Vaccination.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!vaccination) {
    return res.status(404).json({
      success: false,
      message: 'التطعيم غير موجود'
    });
  }

  if (vaccination.status === 'completed') {
    return res.status(400).json({
      success: false,
      message: 'التطعيم مكتمل بالفعل'
    });
  }

  // تحديث التطعيم وتسجيل تاريخ التنفيذ
  vaccination.status = 'completed';
  vaccination.administrationDate = req.body.administrationDate || new Date();
  vaccination.administrator = req.body.administrator;
  vaccination.dose = req.body.dose;
  vaccination.batchNumber = req.body.batchNumber;
  vaccination.notes = req.body.notes;

  // تحديث فترات الحظر إذا تم توفيرها
  if (req.body.meatWithdrawalPeriod) {
    vaccination.meatWithdrawalPeriod = req.body.meatWithdrawalPeriod;
  }

  if (req.body.milkWithdrawalPeriod) {
    vaccination.milkWithdrawalPeriod = req.body.milkWithdrawalPeriod;
  }

  // حساب تاريخ انتهاء فترة الحظر
  const adminDate = new Date(vaccination.administrationDate);
  const maxWithdrawalPeriod = Math.max(vaccination.meatWithdrawalPeriod, vaccination.milkWithdrawalPeriod);
  
  if (maxWithdrawalPeriod > 0) {
    vaccination.withdrawalEndDate = new Date(adminDate.setDate(adminDate.getDate() + maxWithdrawalPeriod));
    
    // تحديث حالة حظر الحيوان
    const animal = await Animal.findById(vaccination.animalId);
    
    if (animal) {
      animal.restriction = {
        isRestricted: true,
        reason: 'vaccination',
        restrictionEndDate: vaccination.withdrawalEndDate,
        notes: `تم تقييد الحيوان بسبب التطعيم: ${vaccination.name}`
      };
      
      await animal.save();
      
      // إنشاء إشعار بفرض الحظر
      await createNotification({
        userId: req.user.id,
        title: 'تم فرض حظر على حيوان',
        message: `تم فرض حظر على الحيوان ${animal.identificationNumber} بسبب التطعيم. تاريخ انتهاء الحظر: ${vaccination.withdrawalEndDate.toLocaleDateString('ar-SA')}`,
        type: 'withdrawal',
        relatedAnimalId: animal._id,
        relatedVaccinationId: vaccination._id
      });
    }
  }

  // حفظ التغييرات
  await vaccination.save();

  // إذا كان التطعيم دوريًا، جدول التطعيم التالي
  if (vaccination.vaccinationScheduleId) {
    const schedule = await VaccinationSchedule.findById(vaccination.vaccinationScheduleId);
    
    if (schedule && schedule.repeatInterval > 0) {
      const nextDate = new Date(vaccination.administrationDate);
      nextDate.setDate(nextDate.getDate() + schedule.repeatInterval);
      
      await Vaccination.create({
        animalId: vaccination.animalId,
        name: vaccination.name,
        description: vaccination.description,
        scheduleDate: nextDate,
        status: 'pending',
        meatWithdrawalPeriod: vaccination.meatWithdrawalPeriod,
        milkWithdrawalPeriod: vaccination.milkWithdrawalPeriod,
        vaccinationScheduleId: vaccination.vaccinationScheduleId,
        userId: req.user.id
      });
    }
  }

  res.status(200).json({
    success: true,
    data: vaccination
  });
});

// @desc    الحصول على التطعيمات القادمة
// @route   GET /api/vaccinations/upcoming
// @access  Private
exports.getUpcomingVaccinations = asyncHandler(async (req, res) => {
  const now = new Date();
  const endDate = new Date();
  endDate.setDate(now.getDate() + (req.query.days ? parseInt(req.query.days) : 30));

  const vaccinations = await Vaccination.find({
    userId: req.user.id,
    status: 'pending',
    scheduleDate: {
      $gte: now,
      $lte: endDate
    }
  })
    .populate('animalId', 'identificationNumber')
    .sort({ scheduleDate: 1 });

  res.status(200).json({
    success: true,
    count: vaccinations.length,
    data: vaccinations
  });
});