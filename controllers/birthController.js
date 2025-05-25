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
    .populate('femaleId', 'identificationNumber')
    .populate('breedingEventId')
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
  const birth = await Birth.findOne({
    _id: req.params.id,
    userId: req.user.id
  })
    .populate('femaleId', 'identificationNumber')
    .populate('breedingEventId')
    .populate('offspringIds', 'identificationNumber gender');

  if (!birth) {
    return res.status(404).json({
      success: false,
      message: 'الولادة غير موجودة'
    });
  }

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

  await birth.remove();

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