// controllers/breedingEventController.js
const BreedingEvent = require('../models/BreedingEvent');
const Animal = require('../models/Animal');
const Birth = require('../models/Birth');
const AnimalCategory = require('../models/AnimalCategory');
const asyncHandler = require('express-async-handler');
const { createNotification } = require('./notificationController');

// @desc    الحصول على جميع أحداث التكاثر
// @route   GET /api/breeding
// @access  Private
exports.getBreedingEvents = asyncHandler(async (req, res) => {
  let query = { userId: req.user.id };

  // إضافة فلترة حسب الطلب
  if (req.query.eventType) {
    query.eventType = req.query.eventType;
  }

  if (req.query.femaleId) {
    query.femaleId = req.query.femaleId;
  }

  if (req.query.maleId) {
    query.maleId = req.query.maleId;
  }

  if (req.query.birthRecorded) {
    query.birthRecorded = req.query.birthRecorded === 'true';
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

  const breedingEvents = await BreedingEvent.find(query)
    .populate('femaleId', 'identificationNumber')
    .populate('maleId', 'identificationNumber')
    .sort({ date: -1 });

  res.status(200).json({
    success: true,
    count: breedingEvents.length,
    data: breedingEvents
  });
});

// @desc    الحصول على حدث تكاثر واحد
// @route   GET /api/breeding/:id
// @access  Private
exports.getBreedingEvent = asyncHandler(async (req, res) => {
  const breedingEvent = await BreedingEvent.findOne({
    _id: req.params.id,
    userId: req.user.id
  })
    .populate('femaleId', 'identificationNumber categoryId')
    .populate('maleId', 'identificationNumber')
    .populate('birthId');

  if (!breedingEvent) {
    return res.status(404).json({
      success: false,
      message: 'حدث التكاثر غير موجود'
    });
  }

  res.status(200).json({
    success: true,
    data: breedingEvent
  });
});

// @desc    إنشاء حدث تكاثر جديد
// @route   POST /api/breeding
// @access  Private
exports.createBreedingEvent = asyncHandler(async (req, res) => {
  // التحقق من وجود الأنثى
  const female = await Animal.findOne({
    _id: req.body.femaleId,
    userId: req.user.id,
    gender: { $in: ['female', 'أنثى'] }
  });

  if (!female) {
    return res.status(404).json({
      success: false,
      message: 'الحيوان الأنثى غير موجود'
    });
  }

  // التحقق من وجود الذكر إذا تم تحديده
  if (req.body.maleId) {
    const male = await Animal.findOne({
      _id: req.body.maleId,
      userId: req.user.id,
      gender: { $in: ['male', 'ذكر'] }
    });

    if (!male) {
      return res.status(404).json({
        success: false,
        message: 'الحيوان الذكر غير موجود'
      });
    }
  }

  // إضافة معرف المستخدم للطلب
  req.body.userId = req.user.id;

  // حساب تاريخ الولادة المتوقع إذا كان حدث حمل
  if (req.body.eventType === 'pregnancy' && !req.body.expectedBirthDate) {
    const category = await AnimalCategory.findById(female.categoryId);
    if (category && category.pregnancyPeriod) {
      const eventDate = new Date(req.body.date || new Date());
      req.body.expectedBirthDate = new Date(eventDate.setDate(eventDate.getDate() + category.pregnancyPeriod));
    }
  }

  const breedingEvent = await BreedingEvent.create(req.body);

  // إنشاء إشعار للتذكير بتاريخ الولادة المتوقع
  if (breedingEvent.eventType === 'pregnancy' && breedingEvent.expectedBirthDate) {
    await createNotification({
      userId: req.user.id,
      title: 'ولادة متوقعة',
      message: `ولادة متوقعة للحيوان ${female.identificationNumber} في ${breedingEvent.expectedBirthDate.toLocaleDateString('ar-SA')}`,
      type: 'breeding',
      relatedAnimalId: female._id,
      relatedBreedingEventId: breedingEvent._id
    });
  }

  res.status(201).json({
    success: true,
    data: breedingEvent
  });
});

// @desc    تحديث حدث تكاثر
// @route   PUT /api/breeding/:id
// @access  Private
exports.updateBreedingEvent = asyncHandler(async (req, res) => {
  let breedingEvent = await BreedingEvent.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!breedingEvent) {
    return res.status(404).json({
      success: false,
      message: 'حدث التكاثر غير موجود'
    });
  }

  // تحقق من تغيير نوع الحدث إلى ولادة
  if (req.body.eventType === 'birth' && breedingEvent.eventType !== 'birth') {
    req.body.birthRecorded = false;
  }

  // إذا تم تحديث تاريخ الحدث وكان حدث حمل، أعد حساب تاريخ الولادة المتوقع
  if (req.body.date && breedingEvent.eventType === 'pregnancy' && !req.body.expectedBirthDate) {
    const female = await Animal.findById(breedingEvent.femaleId);
    if (female) {
      const category = await AnimalCategory.findById(female.categoryId);
      if (category && category.pregnancyPeriod) {
        const eventDate = new Date(req.body.date);
        req.body.expectedBirthDate = new Date(eventDate.setDate(eventDate.getDate() + category.pregnancyPeriod));
      }
    }
  }

  breedingEvent = await BreedingEvent.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: breedingEvent
  });
});

// @desc    حذف حدث تكاثر
// @route   DELETE /api/breeding/:id
// @access  Private
exports.deleteBreedingEvent = asyncHandler(async (req, res) => {
  const breedingEvent = await BreedingEvent.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!breedingEvent) {
    return res.status(404).json({
      success: false,
      message: 'حدث التكاثر غير موجود'
    });
  }

  // إذا كان هناك ولادة مرتبطة، تحقق قبل الحذف
  if (breedingEvent.birthId) {
    return res.status(400).json({
      success: false,
      message: 'لا يمكن حذف حدث تكاثر مرتبط بولادة. يرجى حذف الولادة أولاً.'
    });
  }

  await breedingEvent.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    الحصول على الولادات المتوقعة
// @route   GET /api/breeding/expected-births
// @access  Private
exports.getExpectedBirths = asyncHandler(async (req, res) => {
  const now = new Date();
  const endDate = new Date();
  endDate.setDate(now.getDate() + (req.query.days ? parseInt(req.query.days) : 30));

  const expectedBirths = await BreedingEvent.find({
    userId: req.user.id,
    eventType: 'pregnancy',
    birthRecorded: false,
    expectedBirthDate: {
      $gte: now,
      $lte: endDate
    }
  })
    .populate('femaleId', 'identificationNumber')
    .populate('maleId', 'identificationNumber')
    .sort({ expectedBirthDate: 1 });

  res.status(200).json({
    success: true,
    count: expectedBirths.length,
    data: expectedBirths
  });
});

// @desc    تسجيل ولادة
// @route   POST /api/breeding/:id/record-birth
// @access  Private
exports.recordBirth = asyncHandler(async (req, res) => {
  const breedingEvent = await BreedingEvent.findOne({
    _id: req.params.id,
    userId: req.user.id,
    eventType: 'pregnancy',
    birthRecorded: false
  });

  if (!breedingEvent) {
    return res.status(404).json({
      success: false,
      message: 'حدث الحمل غير موجود أو تم تسجيل الولادة بالفعل'
    });
  }

  // إنشاء سجل ولادة جديد
  const birth = await Birth.create({
    breedingEventId: breedingEvent._id,
    femaleId: breedingEvent.femaleId,
    birthDate: req.body.birthDate || new Date(),
    livingOffspringCount: req.body.livingOffspringCount || 0,
    deadOffspringCount: req.body.deadOffspringCount || 0,
    complications: req.body.complications,
    notes: req.body.notes,
    userId: req.user.id
  });

  // تحديث حدث التكاثر
  breedingEvent.birthRecorded = true;
  breedingEvent.birthId = birth._id;
  await breedingEvent.save();

  // إنشاء إشعار بالولادة
  const female = await Animal.findById(breedingEvent.femaleId);
  if (female) {
    await createNotification({
      userId: req.user.id,
      title: 'ولادة مسجلة',
      message: `تم تسجيل ولادة للحيوان ${female.identificationNumber} بعدد ${birth.livingOffspringCount} مولود حي و ${birth.deadOffspringCount} مولود ميت`,
      type: 'breeding',
      relatedAnimalId: female._id,
      relatedBreedingEventId: breedingEvent._id
    });
  }

  res.status(201).json({
    success: true,
    data: birth
  });
});