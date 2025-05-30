// controllers/birthController.js
const Birth = require('../models/Birth');
const Animal = require('../models/Animal');
const BreedingEvent = require('../models/BreedingEvent');
const asyncHandler = require('express-async-handler');

// @desc    الحصول على جميع الولادات
// @route   GET /api/births
// @access  Private
exports.getBirths = asyncHandler(async (req, res) => {
  let query = { userId: req.user.id };

  // إضافة فلترة حسب الطلب
  if (req.query.femaleId) {
    query.femaleId = req.query.femaleId;
  }

  if (req.query.breedingEventId) {
    query.breedingEventId = req.query.breedingEventId;
  }

  if (req.query.offspringRegistered) {
    query.offspringRegistered = req.query.offspringRegistered === 'true';
  }

  // فلترة حسب التاريخ
  if (req.query.startDate || req.query.endDate) {
    query.birthDate = {};
    
    if (req.query.startDate) {
      query.birthDate.$gte = new Date(req.query.startDate);
    }
    
    if (req.query.endDate) {
      query.birthDate.$lte = new Date(req.query.endDate);
    }
  }

  const births = await Birth.find(query)
    .populate('femaleId', 'identificationNumber name tagNumber')
    .populate({
      path: 'breedingEventId',
      populate: [
        {
          path: 'maleId',
          select: 'identificationNumber name tagNumber'
        },
        {
          path: 'femaleId',
          select: 'identificationNumber name tagNumber'
        }
      ]
    })
    .sort({ birthDate: -1 });

  res.status(200).json({
    success: true,
    count: births.length,
    data: births
  });
});

// @desc    الحصول على ولادة واحدة
// @route   GET /api/births/:id
// @access  Private
exports.getBirth = asyncHandler(async (req, res) => {
  console.log('Getting birth with ID:', req.params.id);
  
  const birth = await Birth.findOne({
    _id: req.params.id,
    userId: req.user.id
  })
    .populate('femaleId', 'identificationNumber name tagNumber')
    .populate({
      path: 'breedingEventId',
      populate: [
        {
          path: 'maleId',
          select: 'identificationNumber name tagNumber'
        },
        {
          path: 'femaleId',
          select: 'identificationNumber name tagNumber'
        }
      ]
    })
    .populate('offspringIds', 'identificationNumber gender name tagNumber');

  if (!birth) {
    return res.status(404).json({
      success: false,
      message: 'الولادة غير موجودة'
    });
  }

  console.log('Birth data with populated fields:', JSON.stringify(birth, null, 2));
  console.log('BreedingEventId maleId:', birth.breedingEventId?.maleId);

  res.status(200).json({
    success: true,
    data: birth
  });
});

// @desc    تحديث ولادة
// @route   PUT /api/births/:id
// @access  Private
exports.updateBirth = asyncHandler(async (req, res) => {
  let birth = await Birth.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!birth) {
    return res.status(404).json({
      success: false,
      message: 'الولادة غير موجودة'
    });
  }

  // التحقق من صحة التاريخ إذا تم تحديثه
  if (req.body.birthDate) {
    const birthDate = new Date(req.body.birthDate);
    if (isNaN(birthDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'تاريخ الولادة غير صالح'
      });
    }
    req.body.birthDate = birthDate;
  }
  
  birth = await Birth.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: birth
  });
});

// @desc    حذف ولادة
// @route   DELETE /api/births/:id
// @access  Private
exports.deleteBirth = asyncHandler(async (req, res) => {
  const birth = await Birth.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!birth) {
    return res.status(404).json({
      success: false,
      message: 'الولادة غير موجودة'
    });
  }

  // التحقق مما إذا كان هناك مواليد مسجلة
  if (birth.offspringRegistered && birth.offspringIds.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'لا يمكن حذف الولادة لأنها مرتبطة بمواليد مسجلة. يرجى حذف المواليد أولاً.'
    });
  }

  // تحديث حدث التكاثر المرتبط
  if (birth.breedingEventId) {
    await BreedingEvent.findByIdAndUpdate(birth.breedingEventId, {
      birthRecorded: false,
      birthId: null
    });
  }

  await Birth.deleteOne({ _id: req.params.id });

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    تسجيل المواليد
// @route   POST /api/births/:id/register-offspring
// @access  Private
exports.registerOffspring = asyncHandler(async (req, res) => {
  const birth = await Birth.findOne({
    _id: req.params.id,
    userId: req.user.id
  }).populate('femaleId', 'categoryId breedId');

  if (!birth) {
    return res.status(404).json({
      success: false,
      message: 'الولادة غير موجودة'
    });
  }

  if (birth.offspringRegistered) {
    return res.status(400).json({
      success: false,
      message: 'تم تسجيل المواليد بالفعل'
    });
  }

  // التحقق من عدد المواليد
  if (!req.body.offspring || !Array.isArray(req.body.offspring) || req.body.offspring.length !== birth.livingOffspringCount) {
    return res.status(400).json({
      success: false,
      message: `عدد المواليد المسجلة (${req.body.offspring ? req.body.offspring.length : 0}) لا يتطابق مع عدد المواليد الحية المسجلة (${birth.livingOffspringCount})`
    });
  }

  // الحصول على معلومات الذكر (الأب) إذا كان متاحًا
  let father = null;
  if (birth.breedingEventId) {
    const breedingEvent = await BreedingEvent.findById(birth.breedingEventId);
    if (breedingEvent && breedingEvent.maleId) {
      father = await Animal.findById(breedingEvent.maleId);
    }
  }

  // تسجيل المواليد
  const offspringIds = [];
  for (const offspringData of req.body.offspring) {
    const animal = await Animal.create({
      identificationNumber: offspringData.identificationNumber,
      categoryId: birth.femaleId.categoryId,
      breedId: birth.femaleId.breedId,
      birthDate: birth.birthDate,
      gender: offspringData.gender,
      color: offspringData.color,
      weight: {
        birthWeight: offspringData.birthWeight,
        currentWeight: offspringData.birthWeight
      },
      motherId: birth.femaleId._id,
      fatherId: father ? father._id : null,
      acquisitionMethod: 'birth',
      acquisitionDate: birth.birthDate,
      status: 'alive',
      userId: req.user.id
    });

    // إضافة وزن المولود لسجل الأوزان
    if (offspringData.birthWeight) {
      animal.weight.weightHistory = [{
        weight: offspringData.birthWeight,
        date: birth.birthDate
      }];
      await animal.save();
    }

    offspringIds.push(animal._id);
  }

  // تحديث سجل الولادة
  birth.offspringRegistered = true;
  birth.offspringIds = offspringIds;
  await birth.save();

  res.status(200).json({
    success: true,
    data: birth
  });
});

// @desc    إنشاء ولادة جديدة
// @route   POST /api/births
// @access  Private
exports.createBirth = asyncHandler(async (req, res) => {
  // التحقق من وجود حدث التكاثر
  const breedingEvent = await BreedingEvent.findOne({
    _id: req.body.breedingEventId,
    userId: req.user.id
  });

  if (!breedingEvent) {
    return res.status(404).json({
      success: false,
      message: 'حدث التكاثر غير موجود'
    });
  }

  // التحقق من أن الحدث لم يتم تسجيل ولادة له بالفعل
  if (breedingEvent.birthRecorded) {
    return res.status(400).json({
      success: false,
      message: 'تم تسجيل ولادة لهذا الحدث بالفعل'
    });
  }

  // التحقق من صحة التاريخ
  if (req.body.birthDate) {
    const birthDate = new Date(req.body.birthDate);
    if (isNaN(birthDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'تاريخ الولادة غير صالح'
      });
    }
    req.body.birthDate = birthDate;
  }
  
  // إنشاء سجل الولادة
  const birth = await Birth.create({
    ...req.body,
    femaleId: breedingEvent.femaleId,
    userId: req.user.id
  });

  // تحديث حدث التكاثر
  breedingEvent.birthRecorded = true;
  breedingEvent.birthId = birth._id;
  await breedingEvent.save();

  res.status(201).json({
    success: true,
    data: birth
  });
});

// @desc    الحصول على إحصائيات الولادات
// @route   GET /api/births/statistics
// @access  Private
exports.getBirthStatistics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  let matchStage = { userId: req.user.id };
  
  if (startDate || endDate) {
    matchStage.birthDate = {};
    if (startDate) matchStage.birthDate.$gte = new Date(startDate);
    if (endDate) matchStage.birthDate.$lte = new Date(endDate);
  }

  const statistics = await Birth.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalBirths: { $sum: 1 },
        totalLivingOffspring: { $sum: '$livingOffspringCount' },
        totalDeadOffspring: { $sum: '$deadOffspringCount' },
        averageLivingPerBirth: { $avg: '$livingOffspringCount' },
        averageDeadPerBirth: { $avg: '$deadOffspringCount' },
        birthsWithComplications: {
          $sum: { $cond: [{ $ne: ['$complications', null] }, 1, 0] }
        },
        offspringRegisteredCount: {
          $sum: { $cond: ['$offspringRegistered', 1, 0] }
        }
      }
    }
  ]);

  // إحصائيات حسب الشهر
  const monthlyStatistics = await Birth.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          year: { $year: '$birthDate' },
          month: { $month: '$birthDate' }
        },
        count: { $sum: 1 },
        livingOffspring: { $sum: '$livingOffspringCount' },
        deadOffspring: { $sum: '$deadOffspringCount' }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: 12 }
  ]);

  res.status(200).json({
    success: true,
    data: {
      overall: statistics[0] || {
        totalBirths: 0,
        totalLivingOffspring: 0,
        totalDeadOffspring: 0,
        averageLivingPerBirth: 0,
        averageDeadPerBirth: 0,
        birthsWithComplications: 0,
        offspringRegisteredCount: 0
      },
      monthly: monthlyStatistics
    }
  });
});

// @desc    الحصول على الولادات المتوقعة
// @route   GET /api/births/expected
// @access  Private
exports.getExpectedBirths = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);

  // البحث عن أحداث التكاثر المؤكدة والتي لم يتم تسجيل ولادة لها
  const expectedBirths = await BreedingEvent.find({
    userId: req.user.id,
    eventType: 'pregnancy',
    birthRecorded: false,
    expectedBirthDate: {
      $gte: today,
      $lte: futureDate
    }
  })
  .populate('femaleId', 'identificationNumber')
  .populate('maleId', 'identificationNumber')
  .sort({ expectedBirthDate: 1 });

  // إضافة عدد الأيام المتبقية لكل ولادة متوقعة
  const birthsWithDaysRemaining = expectedBirths.map(event => {
    const daysRemaining = Math.ceil((event.expectedBirthDate - today) / (1000 * 60 * 60 * 24));
    return {
      ...event.toObject(),
      daysRemaining
    };
  });

  res.status(200).json({
    success: true,
    count: birthsWithDaysRemaining.length,
    data: birthsWithDaysRemaining
  });
});