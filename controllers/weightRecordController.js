// controllers/weightRecordController.js
const WeightRecord = require('../models/WeightRecord');
const Animal = require('../models/Animal');
const asyncHandler = require('express-async-handler');

// @desc    الحصول على جميع سجلات الوزن
// @route   GET /api/weight-records
// @access  Private
exports.getWeightRecords = asyncHandler(async (req, res) => {
  let query = { userId: req.user.id };

  // فلترة حسب الحيوان
  if (req.query.animalId) {
    query.animalId = req.query.animalId;
  }

  // فلترة حسب التاريخ
  if (req.query.startDate || req.query.endDate) {
    query.recordDate = {};
    
    if (req.query.startDate) {
      query.recordDate.$gte = new Date(req.query.startDate);
    }
    
    if (req.query.endDate) {
      query.recordDate.$lte = new Date(req.query.endDate);
    }
  }

  const weightRecords = await WeightRecord.find(query)
    .populate('animalId', 'identificationNumber name')
    .sort({ recordDate: -1 });

  res.status(200).json({
    success: true,
    count: weightRecords.length,
    data: weightRecords
  });
});

// @desc    الحصول على سجل وزن واحد
// @route   GET /api/weight-records/:id
// @access  Private
exports.getWeightRecord = asyncHandler(async (req, res) => {
  const weightRecord = await WeightRecord.findOne({
    _id: req.params.id,
    userId: req.user.id
  }).populate('animalId', 'identificationNumber name categoryId');

  if (!weightRecord) {
    return res.status(404).json({
      success: false,
      message: 'سجل الوزن غير موجود'
    });
  }

  res.status(200).json({
    success: true,
    data: weightRecord
  });
});

// @desc    إنشاء سجل وزن جديد
// @route   POST /api/weight-records
// @access  Private
exports.createWeightRecord = asyncHandler(async (req, res) => {
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

  // الحصول على آخر وزن مسجل
  const previousRecord = await WeightRecord.getLatestWeight(req.body.animalId);

  // إضافة معرف المستخدم
  req.body.userId = req.user.id;

  // حساب معدل النمو والتغيير إذا كان هناك سجل سابق
  if (previousRecord) {
    const weightDiff = req.body.weight - previousRecord.weight;
    const daysDiff = Math.ceil((new Date(req.body.recordDate || Date.now()) - previousRecord.recordDate) / (1000 * 60 * 60 * 24));
    
    req.body.weightChange = weightDiff;
    req.body.changePercentage = (weightDiff / previousRecord.weight) * 100;
    req.body.growthRate = daysDiff > 0 ? weightDiff / daysDiff : 0;
  }

  const weightRecord = await WeightRecord.create(req.body);

  // تحديث وزن الحيوان الحالي
  animal.currentWeight = req.body.weight;
  animal.lastWeightDate = req.body.recordDate || new Date();
  await animal.save();

  // إعادة تحميل السجل مع البيانات المرتبطة
  const populatedRecord = await WeightRecord.findById(weightRecord._id)
    .populate('animalId', 'identificationNumber name');

  res.status(201).json({
    success: true,
    data: populatedRecord
  });
});

// @desc    تحديث سجل وزن
// @route   PUT /api/weight-records/:id
// @access  Private
exports.updateWeightRecord = asyncHandler(async (req, res) => {
  let weightRecord = await WeightRecord.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!weightRecord) {
    return res.status(404).json({
      success: false,
      message: 'سجل الوزن غير موجود'
    });
  }

  // إذا تم تغيير الوزن، أعد حساب المعدلات
  if (req.body.weight && req.body.weight !== weightRecord.weight) {
    const previousRecord = await WeightRecord.findOne({
      animalId: weightRecord.animalId,
      recordDate: { $lt: weightRecord.recordDate },
      _id: { $ne: weightRecord._id }
    }).sort({ recordDate: -1 });

    if (previousRecord) {
      const weightDiff = req.body.weight - previousRecord.weight;
      const daysDiff = Math.ceil((weightRecord.recordDate - previousRecord.recordDate) / (1000 * 60 * 60 * 24));
      
      req.body.weightChange = weightDiff;
      req.body.changePercentage = (weightDiff / previousRecord.weight) * 100;
      req.body.growthRate = daysDiff > 0 ? weightDiff / daysDiff : 0;
    }
  }

  weightRecord = await WeightRecord.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  }).populate('animalId', 'identificationNumber name');

  // تحديث وزن الحيوان إذا كان هذا آخر سجل
  const latestRecord = await WeightRecord.getLatestWeight(weightRecord.animalId);
  if (latestRecord && latestRecord._id.toString() === weightRecord._id.toString()) {
    await Animal.findByIdAndUpdate(weightRecord.animalId, {
      currentWeight: weightRecord.weight,
      lastWeightDate: weightRecord.recordDate
    });
  }

  res.status(200).json({
    success: true,
    data: weightRecord
  });
});

// @desc    حذف سجل وزن
// @route   DELETE /api/weight-records/:id
// @access  Private
exports.deleteWeightRecord = asyncHandler(async (req, res) => {
  const weightRecord = await WeightRecord.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!weightRecord) {
    return res.status(404).json({
      success: false,
      message: 'سجل الوزن غير موجود'
    });
  }

  await weightRecord.deleteOne();

  // تحديث وزن الحيوان بآخر سجل متبقي
  const latestRecord = await WeightRecord.getLatestWeight(weightRecord.animalId);
  if (latestRecord) {
    await Animal.findByIdAndUpdate(weightRecord.animalId, {
      currentWeight: latestRecord.weight,
      lastWeightDate: latestRecord.recordDate
    });
  }

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    الحصول على إحصائيات الوزن لحيوان
// @route   GET /api/weight-records/stats/:animalId
// @access  Private
exports.getWeightStats = asyncHandler(async (req, res) => {
  const { animalId } = req.params;
  const { period = 30 } = req.query;

  // التحقق من ملكية الحيوان
  const animal = await Animal.findOne({
    _id: animalId,
    userId: req.user.id
  });

  if (!animal) {
    return res.status(404).json({
      success: false,
      message: 'الحيوان غير موجود'
    });
  }

  // الحصول على جميع السجلات للفترة المحددة
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(period));

  const records = await WeightRecord.find({
    animalId,
    recordDate: { $gte: startDate, $lte: endDate }
  }).sort({ recordDate: 1 });

  if (records.length === 0) {
    return res.status(200).json({
      success: true,
      data: {
        currentWeight: animal.currentWeight || 0,
        records: [],
        stats: {
          averageGrowthRate: 0,
          totalGain: 0,
          highestWeight: 0,
          lowestWeight: 0,
          recordCount: 0
        }
      }
    });
  }

  // حساب الإحصائيات
  const weights = records.map(r => r.weight);
  const highestWeight = Math.max(...weights);
  const lowestWeight = Math.min(...weights);
  const totalGain = records[records.length - 1].weight - records[0].weight;
  const averageGrowthRate = await WeightRecord.getAverageGrowthRate(animalId, parseInt(period));

  res.status(200).json({
    success: true,
    data: {
      currentWeight: animal.currentWeight || records[records.length - 1].weight,
      records,
      stats: {
        averageGrowthRate,
        totalGain,
        highestWeight,
        lowestWeight,
        recordCount: records.length,
        period: parseInt(period)
      }
    }
  });
});

// @desc    الحصول على مقارنة الأوزان بين الحيوانات
// @route   GET /api/weight-records/compare
// @access  Private
exports.compareWeights = asyncHandler(async (req, res) => {
  const { animalIds, period = 30 } = req.query;

  if (!animalIds || !Array.isArray(animalIds)) {
    return res.status(400).json({
      success: false,
      message: 'يجب تحديد قائمة الحيوانات للمقارنة'
    });
  }

  // التحقق من ملكية جميع الحيوانات
  const animals = await Animal.find({
    _id: { $in: animalIds },
    userId: req.user.id
  });

  if (animals.length !== animalIds.length) {
    return res.status(404).json({
      success: false,
      message: 'بعض الحيوانات غير موجودة'
    });
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(period));

  const comparisons = [];

  for (const animal of animals) {
    const records = await WeightRecord.find({
      animalId: animal._id,
      recordDate: { $gte: startDate, $lte: endDate }
    }).sort({ recordDate: 1 });

    const stats = {
      animalId: animal._id,
      animalName: animal.name || animal.identificationNumber,
      currentWeight: animal.currentWeight || 0,
      records: records.map(r => ({
        date: r.recordDate,
        weight: r.weight
      })),
      growthRate: 0,
      totalGain: 0
    };

    if (records.length > 1) {
      stats.totalGain = records[records.length - 1].weight - records[0].weight;
      stats.growthRate = await WeightRecord.getAverageGrowthRate(animal._id, parseInt(period));
    }

    comparisons.push(stats);
  }

  res.status(200).json({
    success: true,
    data: comparisons
  });
});