//bakend  --  controllers/reportController.js
const SavedReport = require('../models/SavedReport');
const Animal = require('../models/Animal');
const BreedingEvent = require('../models/BreedingEvent');
const Birth = require('../models/Birth');
const HealthEvent = require('../models/HealthEvent');
const Vaccination = require('../models/Vaccination');
const Transaction = require('../models/Transaction');
const FinancialRecord = require('../models/FinancialRecord');
const InventoryItem = require('../models/InventoryItem');
const PDFDocument = require('pdfkit');
const Excel = require('exceljs');
const fs = require('fs');
const path = require('path');
const { createPDFReport } = require('../utils/pdfGenerator');
const asyncHandler = require('express-async-handler');

 

// @desc    الحصول على جميع التقارير المحفوظة
// @route   GET /api/reports/saved
// @access  Private
exports.getSavedReports = asyncHandler(async (req, res) => {
  const savedReports = await SavedReport.find({
    userId: req.user.id
  }).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: savedReports.length,
    data: savedReports
  });
});

// @desc    الحصول على تقرير محفوظ واحد
// @route   GET /api/reports/saved/:id
// @access  Private
exports.getSavedReport = asyncHandler(async (req, res) => {
  const savedReport = await SavedReport.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!savedReport) {
    return res.status(404).json({
      success: false,
      message: 'التقرير غير موجود'
    });
  }

  res.status(200).json({
    success: true,
    data: savedReport
  });
});

// @desc    حفظ تقرير جديد
// @route   POST /api/reports/saved
// @access  Private
exports.saveReport = asyncHandler(async (req, res) => {
  // إضافة معرف المستخدم للطلب
  req.body.userId = req.user.id;

  const savedReport = await SavedReport.create(req.body);

  res.status(201).json({
    success: true,
    data: savedReport
  });
});


 


// @desc    تحديث تقرير محفوظ
// @route   PUT /api/reports/saved/:id
// @access  Private
exports.updateSavedReport = asyncHandler(async (req, res) => {
  let savedReport = await SavedReport.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!savedReport) {
    return res.status(404).json({
      success: false,
      message: 'التقرير غير موجود'
    });
  }

  savedReport = await SavedReport.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: savedReport
  });
});

// @desc    حذف تقرير محفوظ
// @route   DELETE /api/reports/saved/:id
// @access  Private
exports.deleteSavedReport = asyncHandler(async (req, res) => {
  const savedReport = await SavedReport.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!savedReport) {
    return res.status(404).json({
      success: false,
      message: 'التقرير غير موجود'
    });
  }

  await savedReport.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    الحصول على تقرير توزيع الحيوانات
// @route   GET /api/reports/animals-distribution
// @access  Private
exports.getAnimalsDistributionReport = asyncHandler(async (req, res) => {
  // التوزيع حسب الفئة
  const byCategory = await Animal.aggregate([
    {
      $match: {
        userId: req.user._id,
        status: 'alive'
      }
    },
    {
      $lookup: {
        from: 'animalcategories',
        localField: 'categoryId',
        foreignField: '_id',
        as: 'category'
      }
    },
    {
      $unwind: '$category'
    },
    {
      $group: {
        _id: '$categoryId',
        category: { $first: '$category.name' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  // التوزيع حسب السلالة
  const byBreed = await Animal.aggregate([
    {
      $match: {
        userId: req.user._id,
        status: 'alive'
      }
    },
    {
      $lookup: {
        from: 'animalbreeds',
        localField: 'breedId',
        foreignField: '_id',
        as: 'breed'
      }
    },
    {
      $unwind: '$breed'
    },
    {
      $group: {
        _id: '$breedId',
        breed: { $first: '$breed.name' },
        category: { $first: '$breed.categoryId' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  // التوزيع حسب الجنس
  const byGender = await Animal.aggregate([
    {
      $match: {
        userId: req.user._id,
        status: 'alive'
      }
    },
    {
      $group: {
        _id: '$gender',
        count: { $sum: 1 }
      }
    }
  ]);

  // التوزيع حسب العمر
  const byAge = await Animal.aggregate([
    {
      $match: {
        userId: req.user._id,
        status: 'alive',
        birthDate: { $exists: true, $ne: null }
      }
    },
    {
      $project: {
        ageInMonths: {
          $divide: [
            { $subtract: [new Date(), '$birthDate'] },
            1000 * 60 * 60 * 24 * 30 // تقريب الشهر ب 30 يوم
          ]
        }
      }
    },
    {
      $group: {
        _id: {
          $cond: [
            { $lt: ['$ageInMonths', 3] },
            'أقل من 3 شهور',
            {
              $cond: [
                { $lt: ['$ageInMonths', 6] },
                '3-6 شهور',
                {
                  $cond: [
                    { $lt: ['$ageInMonths', 12] },
                    '6-12 شهر',
                    {
                      $cond: [
                        { $lt: ['$ageInMonths', 24] },
                        '1-2 سنة',
                        'أكثر من سنتين'
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: {
        _id: 1
      }
    }
  ]);

  // التوزيع حسب الحالة
  const byStatus = await Animal.aggregate([
    {
      $match: {
        userId: req.user._id
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // الحيوانات المحظورة
  const restrictedAnimals = await Animal.countDocuments({
    userId: req.user._id,
    'restriction.isRestricted': true
  });

  const report = {
    totalAnimals: await Animal.countDocuments({ userId: req.user._id }),
    aliveAnimals: await Animal.countDocuments({ userId: req.user._id, status: 'alive' }),
    soldAnimals: await Animal.countDocuments({ userId: req.user._id, status: 'sold' }),
    deadAnimals: await Animal.countDocuments({ userId: req.user._id, status: 'dead' }),
    slaughteredAnimals: await Animal.countDocuments({ userId: req.user._id, status: 'slaughtered' }),
    restrictedAnimals,
    byCategory,
    byBreed,
    byGender,
    byAge,
    byStatus,
    generatedAt: new Date()
  };

  res.status(200).json({
    success: true,
    data: report
  });
});

// @desc    الحصول على تقرير التطعيمات والصحة
// @route   GET /api/reports/health-vaccination
// @access  Private
exports.getHealthVaccinationReport = asyncHandler(async (req, res) => {
  let dateFilter = {};
  
  if (req.query.startDate || req.query.endDate) {
    if (req.query.startDate) {
      dateFilter.$gte = new Date(req.query.startDate);
    }
    
    if (req.query.endDate) {
      dateFilter.$lte = new Date(req.query.endDate);
    }
  }

  // إحصائيات التطعيمات
  const vaccinationStats = {
    total: await Vaccination.countDocuments({
      userId: req.user._id,
      ...(Object.keys(dateFilter).length > 0 ? { scheduleDate: dateFilter } : {})
    }),
    pending: await Vaccination.countDocuments({
      userId: req.user._id,
      status: 'pending',
      ...(Object.keys(dateFilter).length > 0 ? { scheduleDate: dateFilter } : {})
    }),
    completed: await Vaccination.countDocuments({
      userId: req.user._id,
      status: 'completed',
      ...(Object.keys(dateFilter).length > 0 ? { administrationDate: dateFilter } : {})
    }),
    delayed: await Vaccination.countDocuments({
      userId: req.user._id,
      status: 'delayed',
      ...(Object.keys(dateFilter).length > 0 ? { scheduleDate: dateFilter } : {})
    })
  };

  // التطعيمات حسب النوع
  const vaccinationsByName = await Vaccination.aggregate([
    {
      $match: {
        userId: req.user._id,
        ...(Object.keys(dateFilter).length > 0 ? { 
          $or: [
            { scheduleDate: dateFilter },
            { administrationDate: dateFilter }
          ]
        } : {})
      }
    },
    {
      $group: {
        _id: '$name',
        total: { $sum: 1 },
        completed: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
          }
        },
        pending: {
          $sum: {
            $cond: [{ $eq: ['$status', 'pending'] }, 1, 0]
          }
        },
        delayed: {
          $sum: {
            $cond: [{ $eq: ['$status', 'delayed'] }, 1, 0]
          }
        }
      }
    },
    {
      $sort: { total: -1 }
    }
  ]);

  // إحصائيات الأحداث الصحية
  const healthEventStats = {
    total: await HealthEvent.countDocuments({
      userId: req.user._id,
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
    }),
    byType: await HealthEvent.aggregate([
      {
        $match: {
          userId: req.user._id,
          ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
        }
      },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]),
    bySeverity: await HealthEvent.aggregate([
      {
        $match: {
          userId: req.user._id,
          ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
        }
      },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ])
  };

  // الأحداث الصحية حسب الشهر
  const healthEventsByMonth = await HealthEvent.aggregate([
    {
      $match: {
        userId: req.user._id,
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' }
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: {
        '_id.year': 1,
        '_id.month': 1
      }
    }
  ]);

  // التطعيمات حسب الشهر
  const vaccinationsByMonth = await Vaccination.aggregate([
    {
      $match: {
        userId: req.user._id,
        status: 'completed',
        ...(Object.keys(dateFilter).length > 0 ? { administrationDate: dateFilter } : {})
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$administrationDate' },
          month: { $month: '$administrationDate' }
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: {
        '_id.year': 1,
        '_id.month': 1
      }
    }
  ]);

  const report = {
    vaccinationStats,
    vaccinationsByName,
    healthEventStats,
    healthEventsByMonth,
    vaccinationsByMonth,
    generatedAt: new Date()
  };

  res.status(200).json({
    success: true,
    data: report
  });
});

// @desc    الحصول على تقرير التكاثر
// @route   GET /api/reports/breeding
// @access  Private
exports.getBreedingReport = asyncHandler(async (req, res) => {
  let dateFilter = {};
  
  if (req.query.startDate || req.query.endDate) {
    if (req.query.startDate) {
      dateFilter.$gte = new Date(req.query.startDate);
    }
    
    if (req.query.endDate) {
      dateFilter.$lte = new Date(req.query.endDate);
    }
  }

  // إحصائيات أحداث التكاثر
  const breedingEventStats = {
    total: await BreedingEvent.countDocuments({
      userId: req.user._id,
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
    }),
    byType: await BreedingEvent.aggregate([
      {
        $match: {
          userId: req.user._id,
          ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
        }
      },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ])
  };

  // إحصائيات الولادات
  const birthStats = {
    total: await Birth.countDocuments({
      userId: req.user._id,
      ...(Object.keys(dateFilter).length > 0 ? { birthDate: dateFilter } : {})
    }),
    totalLivingOffspring: await Birth.aggregate([
      {
        $match: {
          userId: req.user._id,
          ...(Object.keys(dateFilter).length > 0 ? { birthDate: dateFilter } : {})
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: '$livingOffspringCount' }
        }
      }
    ]),
    totalDeadOffspring: await Birth.aggregate([
      {
        $match: {
          userId: req.user._id,
          ...(Object.keys(dateFilter).length > 0 ? { birthDate: dateFilter } : {})
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: '$deadOffspringCount' }
        }
      }
    ]),
    byMonth: await Birth.aggregate([
      {
        $match: {
          userId: req.user._id,
          ...(Object.keys(dateFilter).length > 0 ? { birthDate: dateFilter } : {})
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$birthDate' },
            month: { $month: '$birthDate' }
          },
          count: { $sum: 1 },
          livingOffspringCount: { $sum: '$livingOffspringCount' },
          deadOffspringCount: { $sum: '$deadOffspringCount' }
        }
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1
        }
      }
    ])
  };

  // حصائيات حسب الفئة
  const breedingStatsByCategory = await BreedingEvent.aggregate([
    {
      $match: {
        userId: req.user._id,
        eventType: 'birth',
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
      }
    },
    {
      $lookup: {
        from: 'animals',
        localField: 'femaleId',
        foreignField: '_id',
        as: 'female'
      }
    },
    {
      $unwind: '$female'
    },
    {
      $lookup: {
        from: 'animalcategories',
        localField: 'female.categoryId',
        foreignField: '_id',
        as: 'category'
      }
    },
    {
      $unwind: '$category'
    },
    {
      $lookup: {
        from: 'births',
        localField: 'birthId',
        foreignField: '_id',
        as: 'birth'
      }
    },
    {
      $unwind: {
        path: '$birth',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $group: {
        _id: '$category.name',
        count: { $sum: 1 },
        livingOffspringCount: { $sum: '$birth.livingOffspringCount' },
        deadOffspringCount: { $sum: '$birth.deadOffspringCount' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  // أعلى الإناث إنتاجًا
  const topFemales = await Birth.aggregate([
    {
      $match: {
        userId: req.user._id,
        ...(Object.keys(dateFilter).length > 0 ? { birthDate: dateFilter } : {})
      }
    },
    {
      $group: {
        _id: '$femaleId',
        birthCount: { $sum: 1 },
        totalLivingOffspring: { $sum: '$livingOffspringCount' },
        totalDeadOffspring: { $sum: '$deadOffspringCount' }
      }
    },
    {
      $lookup: {
        from: 'animals',
        localField: '_id',
        foreignField: '_id',
        as: 'female'
      }
    },
    {
      $unwind: '$female'
    },
    {
      $project: {
        femaleId: '$_id',
        identificationNumber: '$female.identificationNumber',
        categoryId: '$female.categoryId',
        breedId: '$female.breedId',
        birthCount: 1,
        totalLivingOffspring: 1,
        totalDeadOffspring: 1
      }
    },
    {
      $sort: { totalLivingOffspring: -1 }
    },
    {
      $limit: 10
    }
  ]);

  const report = {
    breedingEventStats,
    birthStats,
    breedingStatsByCategory,
    topFemales,
    generatedAt: new Date()
  };

  res.status(200).json({
    success: true,
    data: report
  });
});

// @desc    الحصول على تقرير الحيوانات المحظورة
// @route   GET /api/reports/restricted-animals
// @access  Private
exports.getRestrictedAnimalsReport = asyncHandler(async (req, res) => {
  // الحيوانات المحظورة حاليًا
  const restrictedAnimals = await Animal.find({
    userId: req.user._id,
    'restriction.isRestricted': true
  })
    .populate('categoryId', 'name')
    .populate('breedId', 'name')
    .sort({ 'restriction.restrictionEndDate': 1 });

  // إحصائيات الحيوانات المحظورة
  const restrictedStats = {
    total: restrictedAnimals.length,
    byReason: await Animal.aggregate([
      {
        $match: {
          userId: req.user._id,
          'restriction.isRestricted': true
        }
      },
      {
        $group: {
          _id: '$restriction.reason',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]),
    byCategory: await Animal.aggregate([
      {
        $match: {
          userId: req.user._id,
          'restriction.isRestricted': true
        }
      },
      {
        $lookup: {
          from: 'animalcategories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category'
        }
      },
      {
        $unwind: '$category'
      },
      {
        $group: {
          _id: '$categoryId',
          category: { $first: '$category.name' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ])
  };

  // الحيوانات التي ستنتهي فترة حظرها في الأيام القادمة
  const today = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);

  const endingSoonAnimals = await Animal.find({
    userId: req.user._id,
    'restriction.isRestricted': true,
    'restriction.restrictionEndDate': {
      $gt: today,
      $lte: nextWeek
    }
  })
    .populate('categoryId', 'name')
    .populate('breedId', 'name')
    .sort({ 'restriction.restrictionEndDate': 1 });

  const report = {
    restrictedStats,
    restrictedAnimals: restrictedAnimals.map(animal => ({
      _id: animal._id,
      identificationNumber: animal.identificationNumber,
      category: animal.categoryId.name,
      breed: animal.breedId.name,
      gender: animal.gender,
      restrictionReason: animal.restriction.reason,
      restrictionEndDate: animal.restriction.restrictionEndDate,
      restrictionNotes: animal.restriction.notes,
      daysRemaining: Math.ceil((new Date(animal.restriction.restrictionEndDate) - today) / (1000 * 60 * 60 * 24))
    })),
    endingSoonAnimals: endingSoonAnimals.map(animal => ({
      _id: animal._id,
      identificationNumber: animal.identificationNumber,
      category: animal.categoryId.name,
      breed: animal.breedId.name,
      gender: animal.gender,
      restrictionReason: animal.restriction.reason,
      restrictionEndDate: animal.restriction.restrictionEndDate,
      restrictionNotes: animal.restriction.notes,
      daysRemaining: Math.ceil((new Date(animal.restriction.restrictionEndDate) - today) / (1000 * 60 * 60 * 24))
    })),
    generatedAt: new Date()
  };

  res.status(200).json({
    success: true,
    data: report
  });
});

// @desc    الحصول على تقرير مالي
// @route   GET /api/reports/financial
// @access  Private
exports.getFinancialReport = asyncHandler(async (req, res) => {
  let dateFilter = {};
  
  if (req.query.startDate || req.query.endDate) {
    if (req.query.startDate) {
      dateFilter.$gte = new Date(req.query.startDate);
    }
    
    if (req.query.endDate) {
      dateFilter.$lte = new Date(req.query.endDate);
    }
  }

  // المبالغ الإجمالية
  const totalIncome = await FinancialRecord.aggregate([
    {
      $match: {
        userId: req.user._id,
        type: 'income',
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  const totalExpense = await FinancialRecord.aggregate([
    {
      $match: {
        userId: req.user._id,
        type: 'expense',
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  // تحليل حسب الفئة
  const incomeByCategory = await FinancialRecord.aggregate([
    {
      $match: {
        userId: req.user._id,
        type: 'income',
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
      }
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' }
      }
    },
    {
      $sort: { total: -1 }
    }
  ]);

  const expenseByCategory = await FinancialRecord.aggregate([
    {
      $match: {
        userId: req.user._id,
        type: 'expense',
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
      }
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' }
      }
    },
    {
      $sort: { total: -1 }
    }
  ]);

  // التحليل الشهري
  const monthlyAnalysis = await FinancialRecord.aggregate([
    {
      $match: {
        userId: req.user._id,
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' },
          type: '$type'
        },
        total: { $sum: '$amount' }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    }
  ]);

  // تنظيم التحليل الشهري
  const months = {};
  monthlyAnalysis.forEach(item => {
    const key = `${item._id.year}-${item._id.month}`;
    if (!months[key]) {
      months[key] = {
        year: item._id.year,
        month: item._id.month,
        income: 0,
        expense: 0
      };
    }
    
    if (item._id.type === 'income') {
      months[key].income = item.total;
    } else {
      months[key].expense = item.total;
    }
  });

  // الإيرادات حسب الحيوان
  const incomeByAnimal = await FinancialRecord.aggregate([
    {
      $match: {
        userId: req.user._id,
        type: 'income',
        animalId: { $exists: true, $ne: null },
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
      }
    },
    {
      $lookup: {
        from: 'animals',
        localField: 'animalId',
        foreignField: '_id',
        as: 'animal'
      }
    },
    {
      $unwind: '$animal'
    },
    {
      $group: {
        _id: '$animalId',
        identificationNumber: { $first: '$animal.identificationNumber' },
        total: { $sum: '$amount' }
      }
    },
    {
      $sort: { total: -1 }
    },
    {
      $limit: 10
    }
  ]);

  // النفقات حسب الحيوان
  const expenseByAnimal = await FinancialRecord.aggregate([
    {
      $match: {
        userId: req.user._id,
        type: 'expense',
        animalId: { $exists: true, $ne: null },
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
      }
    },
    {
      $lookup: {
        from: 'animals',
        localField: 'animalId',
        foreignField: '_id',
        as: 'animal'
      }
    },
    {
      $unwind: '$animal'
    },
    {
      $group: {
        _id: '$animalId',
        identificationNumber: { $first: '$animal.identificationNumber' },
        total: { $sum: '$amount' }
      }
    },
    {
      $sort: { total: -1 }
    },
    {
      $limit: 10
    }
  ]);

   const report = {
    totalIncome: totalIncome.length > 0 ? totalIncome[0].total : 0,
    totalExpense: totalExpense.length > 0 ? totalExpense[0].total : 0,
    profit: (totalIncome.length > 0 ? totalIncome[0].total : 0) - (totalExpense.length > 0 ? totalExpense[0].total : 0),
    incomeByCategory,
    expenseByCategory,
    monthlyAnalysis: Object.values(months).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    }),
    incomeByAnimal,
    expenseByAnimal,
    generatedAt: new Date()
  };

  res.status(200).json({
    success: true,
    data: report
  });
});

 
// دالة إنشاء تقرير PDF
// function createPDFReport(reportType, reportData, options = {}) {
//   // التحقق من خيارات دعم اللغة العربية
//   const useArabic = options?.arabic !== false; // افتراضيًا تمكين دعم العربية
//   const useRTL = options?.rtl !== false;       // افتراضيًا تمكين RTL
  
//   // إنشاء مستند PDF
//   const doc = new PDFDocument({
//     autoFirstPage: false,
//     bufferPages: true,
//     size: 'A4',
//     margin: 50,
//     rtl: useRTL, // تفعيل الكتابة من اليمين لليسار
//     info: {
//       Title: `تقرير ${getReportTitle(reportType)}`,
//       Author: 'تطبيق إدارة المواشي'
//     }
//   });
  
//   // تسجيل الخطوط العربية إذا كانت متوفرة
//   if (useArabic) {
//     try {
//       doc.registerFont('Arabic', ARABIC_FONTS.regular);
//       doc.registerFont('ArabicBold', ARABIC_FONTS.bold);
//       doc.registerFont('ArabicMedium', ARABIC_FONTS.medium);
//       doc.registerFont('ArabicLight', ARABIC_FONTS.light);
      
//       // تطبيق الخط العربي كخط افتراضي
//       doc.font('Arabic');
//     } catch (error) {
//       console.error('فشل في تحميل الخطوط العربية:', error);
//       // استخدام الخط الافتراضي إذا فشل تحميل الخطوط العربية
//       doc.font('Helvetica');
//     }
//   } else {
//     // استخدام الخط الافتراضي
//     doc.font('Helvetica');
//   }
  
//   // إضافة صفحة
//   doc.addPage();
  
//   // إضافة العنوان
//   doc.fontSize(24)
//      .font(useArabic ? 'ArabicBold' : 'Helvetica-Bold')
//      .text(`تقرير ${getReportTitle(reportType)}`, { align: useRTL ? 'right' : 'left' });
//   doc.moveDown();
  
//   // إضافة التاريخ
//   const reportDate = new Date().toLocaleDateString('ar-SA');
//   doc.fontSize(12)
//      .font(useArabic ? 'Arabic' : 'Helvetica')
//      .text(`تاريخ التقرير: ${reportDate}`, { align: useRTL ? 'right' : 'left' });
//   doc.moveDown(2);
  
//   // الأنواع المختلفة من التقارير
//   switch (reportType) {
//     case 'animalDistribution':
//       addAnimalDistributionToPDF(doc, reportData, useArabic, useRTL);
//       break;
//     case 'healthVaccination':
//       addHealthVaccinationToPDF(doc, reportData, useArabic, useRTL);
//       break;
//     case 'breeding':
//       addBreedingToPDF(doc, reportData, useArabic, useRTL);
//       break;
//     case 'restrictedAnimals':
//       addRestrictedAnimalsToPDF(doc, reportData, useArabic, useRTL);
//       break;
//     case 'financial':
//       addFinancialToPDF(doc, reportData, useArabic, useRTL);
//       break;
//     default:
//       doc.fontSize(16)
//          .font(useArabic ? 'ArabicBold' : 'Helvetica-Bold')
//          .text('نوع التقرير غير مدعوم', { align: useRTL ? 'right' : 'left' });
//   }
  
//   // إضافة ترقيم الصفحات
//   const pages = doc.bufferedPageRange();
//   for (let i = 0; i < pages.count; i++) {
//     doc.switchToPage(i);
//     doc.fontSize(10)
//        .text(
//          `الصفحة ${i + 1} من ${pages.count}`,
//          50,
//          doc.page.height - 50,
//          { align: 'center' }
//        );
//   }
  
//   // إعادة المستند كبيانات ثنائية
//   return new Promise((resolve, reject) => {
//     const chunks = [];
//     doc.on('data', chunk => chunks.push(chunk));
//     doc.on('end', () => resolve(Buffer.concat(chunks)));
//     doc.on('error', reject);
//     doc.end();
//   });
// }

// @desc    تصدير تقرير كملف PDF
// @route   POST /api/reports/export/pdf
// @access  Private

exports.exportToPDF = asyncHandler(async (req, res) => {
  const { reportType, reportData, reportName, options } = req.body;

  // التحقق من البيانات
  if (!reportType || !reportData) {
    return res.status(400).json({
      success: false,
      message: 'يرجى توفير نوع التقرير وبياناته'
    });
  }

  try {
    console.log(`[PDF] بدء تصدير تقرير ${reportType}، نوع: ${typeof reportData}، حجم: ${JSON.stringify(reportData).length} بايت`);
    
    // تعيين خيارات افتراضية لدعم اللغة العربية إذا لم تكن محددة
    const exportOptions = {
      arabic: true,
      rtl: true,
      ...options
    };
    
    // إنشاء ملف PDF على الخادم مع تمرير خيارات دعم اللغة العربية
    const pdfBuffer = await createPDFReport(reportType, reportData, exportOptions);
    
    // إنشاء اسم ملف فريد
    const fileName = `report_${reportType}_${Date.now()}.pdf`;
    
    // إرسال الملف كبيانات Base64 للتنزيل المباشر من قبل المستخدم
    res.status(200).json({
      success: true,
      data: {
        fileName: fileName,
        fileContent: pdfBuffer.toString('base64'),
        mimeType: 'application/pdf'
      }
    });
    
    console.log(`[PDF] تم تصدير تقرير ${reportType} بنجاح، حجم الملف: ${pdfBuffer.length} بايت`);
  } catch (error) {
    console.error('خطأ في إنشاء ملف PDF:', error);
    return res.status(500).json({
      success: false,
      message: `حدث خطأ أثناء إنشاء ملف PDF: ${error.message}`
    });
  }
});


// @desc    تصدير تقرير كملف Excel
// @route   POST /api/reports/export/excel
// @access  Private


// دالة إنشاء تقرير Excel
const createExcelReport = async (reportType, reportData) => {
  const workbook = new Excel.Workbook();
  
  // إضافة معلومات المؤلف والعنوان
  workbook.creator = 'تطبيق إدارة المواشي';
  workbook.lastModifiedBy = 'تطبيق إدارة المواشي';
  workbook.created = new Date();
  workbook.modified = new Date();
  
  // الأنواع المختلفة من التقارير
  switch (reportType) {
    case 'animalDistribution':
      addAnimalDistributionToExcel(workbook, reportData);
      break;
    case 'healthVaccination':
      addHealthVaccinationToExcel(workbook, reportData);
      break;
    case 'breeding':
      addBreedingToExcel(workbook, reportData);
      break;
    case 'restrictedAnimals':
      addRestrictedAnimalsToExcel(workbook, reportData);
      break;
    case 'financial':
      addFinancialToExcel(workbook, reportData);
      break;
    default:
      // إنشاء ورقة عمل افتراضية
      const sheet = workbook.addWorksheet('تقرير');
      sheet.getCell('A1').value = 'نوع التقرير غير مدعوم';
  }
  
  // إنشاء ملف مؤقت وحفظ المحتوى
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

exports.exportToExcel = asyncHandler(async (req, res) => {
  const { reportType, reportData } = req.body;
  
  // التحقق من البيانات
  if (!reportType || !reportData) {
    return res.status(400).json({
      success: false,
      message: 'يرجى توفير نوع التقرير وبياناته'
    });
  }
  
  try {
    // إنشاء ملف Excel على الخادم
    const excelBuffer = await createExcelReport(reportType, reportData);
    
    // إرسال الملف كبيانات Base64 للتنزيل المباشر من قبل المستخدم
    res.status(200).json({
      success: true,
      data: {
        fileName: `report_${reportType}_${Date.now()}.xlsx`,
        fileContent: excelBuffer.toString('base64'),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    });
  } catch (error) {
    console.error('خطأ في إنشاء ملف Excel:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إنشاء ملف Excel'
    });
  }
});


// Helper functions

function getReportTitle(reportType) {
  const titles = {
    animalDistribution: 'توزيع الحيوانات',
    healthVaccination: 'التطعيمات والصحة',
    breeding: 'التكاثر',
    restrictedAnimals: 'الحيوانات المحظورة',
    financial: 'مالي',
    custom: 'مخصص'
  };
  
  return titles[reportType] || reportType;
}

function addAnimalDistributionToPDF(doc, data, useArabic = true, useRTL = true) {
  // عنوان القسم
  doc.font(useArabic ? 'ArabicBold' : 'Helvetica-Bold')
     .fontSize(16)
     .text('إحصائيات الحيوانات', { align: useRTL ? 'right' : 'left' });
  doc.moveDown();
  
  // إحصائيات عامة
  doc.font(useArabic ? 'ArabicBold' : 'Helvetica-Bold')
     .fontSize(12)
     .text('إحصائيات عامة:', { align: useRTL ? 'right' : 'left' });
     
  doc.font(useArabic ? 'Arabic' : 'Helvetica')
     .fontSize(10)
     .text(`إجمالي الحيوانات: ${data.totalAnimals}`, { align: useRTL ? 'right' : 'left' });
  doc.text(`الحيوانات الحية: ${data.aliveAnimals}`, { align: useRTL ? 'right' : 'left' });
  doc.text(`الحيوانات المباعة: ${data.soldAnimals}`, { align: useRTL ? 'right' : 'left' });
  doc.text(`الحيوانات النافقة: ${data.deadAnimals}`, { align: useRTL ? 'right' : 'left' });
  doc.text(`الحيوانات المذبوحة: ${data.slaughteredAnimals}`, { align: useRTL ? 'right' : 'left' });
  doc.text(`الحيوانات المحظورة: ${data.restrictedAnimals}`, { align: useRTL ? 'right' : 'left' });
  doc.moveDown();
  
  // توزيع حسب الفئة
  if (data.byCategory && data.byCategory.length > 0) {
    doc.font(useArabic ? 'ArabicBold' : 'Helvetica-Bold')
       .fontSize(12)
       .text('توزيع حسب الفئة:', { align: useRTL ? 'right' : 'left' });
       
    // إنشاء جدول بسيط
    const tableTop = doc.y + 10;
    const colWidth = 150;
    
    // رأس الجدول
    doc.font(useArabic ? 'ArabicBold' : 'Helvetica-Bold')
       .fontSize(10);
       
    if (useRTL) {
      doc.text('العدد', doc.page.width - 50 - colWidth, tableTop, { width: colWidth });
      doc.text('الفئة', doc.page.width - 50 - colWidth * 2, tableTop, { width: colWidth });
    } else {
      doc.text('الفئة', 50, tableTop, { width: colWidth });
      doc.text('العدد', 50 + colWidth, tableTop, { width: colWidth });
    }
    
    // محتوى الجدول
    doc.font(useArabic ? 'Arabic' : 'Helvetica')
       .fontSize(10);
       
    let rowY = tableTop + 20;
    
    data.byCategory.forEach(category => {
      if (useRTL) {
        doc.text(`${category.count}`, doc.page.width - 50 - colWidth, rowY, { width: colWidth });
        doc.text(`${category.category}`, doc.page.width - 50 - colWidth * 2, rowY, { width: colWidth });
      } else {
        doc.text(`${category.category}`, 50, rowY, { width: colWidth });
        doc.text(`${category.count}`, 50 + colWidth, rowY, { width: colWidth });
      }
      rowY += 20;
    });
    
    doc.moveDown(2);
  }
  
  // توزيع حسب السلالة
  if (data.byBreed && data.byBreed.length > 0) {
    doc.font(useArabic ? 'ArabicBold' : 'Helvetica-Bold')
       .fontSize(12)
       .text('توزيع حسب السلالة:', { align: useRTL ? 'right' : 'left' });
       
    // إنشاء جدول بسيط
    const tableTop = doc.y + 10;
    const colWidth = 150;
    
    // رأس الجدول
    doc.font(useArabic ? 'ArabicBold' : 'Helvetica-Bold')
       .fontSize(10);
       
    if (useRTL) {
      doc.text('العدد', doc.page.width - 50 - colWidth, tableTop, { width: colWidth });
      doc.text('السلالة', doc.page.width - 50 - colWidth * 2, tableTop, { width: colWidth });
    } else {
      doc.text('السلالة', 50, tableTop, { width: colWidth });
      doc.text('العدد', 50 + colWidth, tableTop, { width: colWidth });
    }
    
    // محتوى الجدول
    doc.font(useArabic ? 'Arabic' : 'Helvetica')
       .fontSize(10);
       
    let rowY = tableTop + 20;
    
    data.byBreed.forEach(breed => {
      if (useRTL) {
        doc.text(`${breed.count}`, doc.page.width - 50 - colWidth, rowY, { width: colWidth });
        doc.text(`${breed.breed}`, doc.page.width - 50 - colWidth * 2, rowY, { width: colWidth });
      } else {
        doc.text(`${breed.breed}`, 50, rowY, { width: colWidth });
        doc.text(`${breed.count}`, 50 + colWidth, rowY, { width: colWidth });
      }
      rowY += 20;
    });
  }
}


function addHealthVaccinationToPDF(doc, data) {
  // عنوان القسم
  doc.font('Helvetica-Bold').fontSize(16).text('تقرير التطعيمات والصحة', { align: 'right' });
  doc.moveDown();
  
  // إحصائيات التطعيمات
  doc.font('Helvetica-Bold').fontSize(12).text('إحصائيات التطعيمات:', { align: 'right' });
  doc.font('Helvetica').fontSize(10).text(`إجمالي التطعيمات: ${data.vaccinationStats.total}`, { align: 'right' });
  doc.text(`التطعيمات المعلقة: ${data.vaccinationStats.pending}`, { align: 'right' });
  doc.text(`التطعيمات المكتملة: ${data.vaccinationStats.completed}`, { align: 'right' });
  doc.text(`التطعيمات المتأخرة: ${data.vaccinationStats.delayed}`, { align: 'right' });
  doc.moveDown();
  
  // التطعيمات حسب النوع
  if (data.vaccinationsByName && data.vaccinationsByName.length > 0) {
    doc.font('Helvetica-Bold').fontSize(12).text('التطعيمات حسب النوع:', { align: 'right' });
    data.vaccinationsByName.forEach(vac => {
      doc.font('Helvetica').fontSize(10).text(`${vac._id}: إجمالي ${vac.total} (مكتمل: ${vac.completed}, معلق: ${vac.pending}, متأخر: ${vac.delayed})`, { align: 'right' });
    });
    doc.moveDown();
  }
  
  // إحصائيات الأحداث الصحية
  doc.font('Helvetica-Bold').fontSize(12).text('إحصائيات الأحداث الصحية:', { align: 'right' });
  doc.font('Helvetica').fontSize(10).text(`إجمالي الأحداث الصحية: ${data.healthEventStats.total}`, { align: 'right' });
  
  // الأحداث الصحية حسب النوع
  if (data.healthEventStats.byType && data.healthEventStats.byType.length > 0) {
    doc.font('Helvetica-Bold').fontSize(12).text('الأحداث الصحية حسب النوع:', { align: 'right' });
    data.healthEventStats.byType.forEach(type => {
      const typeName = {
        disease: 'مرض',
        injury: 'إصابة',
        treatment: 'علاج',
        examination: 'فحص'
      }[type._id] || type._id;
      
      doc.font('Helvetica').fontSize(10).text(`${typeName}: ${type.count}`, { align: 'right' });
    });
    doc.moveDown();
  }
  
  // الأحداث الصحية حسب الشدة
  if (data.healthEventStats.bySeverity && data.healthEventStats.bySeverity.length > 0) {
    doc.font('Helvetica-Bold').fontSize(12).text('الأحداث الصحية حسب الشدة:', { align: 'right' });
    data.healthEventStats.bySeverity.forEach(severity => {
      const severityName = {
        low: 'منخفضة',
        medium: 'متوسطة',
        high: 'عالية'
      }[severity._id] || severity._id;
      
      doc.font('Helvetica').fontSize(10).text(`${severityName}: ${severity.count}`, { align: 'right' });
    });
  }
}

function addBreedingToPDF(doc, data) {
  // عنوان القسم
  doc.font('Helvetica-Bold').fontSize(16).text('تقرير التكاثر', { align: 'right' });
  doc.moveDown();
  
  // إحصائيات أحداث التكاثر
  doc.font('Helvetica-Bold').fontSize(12).text('إحصائيات أحداث التكاثر:', { align: 'right' });
  doc.font('Helvetica').fontSize(10).text(`إجمالي أحداث التكاثر: ${data.breedingEventStats.total}`, { align: 'right' });
  
  // أحداث التكاثر حسب النوع
  if (data.breedingEventStats.byType && data.breedingEventStats.byType.length > 0) {
    doc.font('Helvetica-Bold').fontSize(12).text('أحداث التكاثر حسب النوع:', { align: 'right' });
    data.breedingEventStats.byType.forEach(type => {
      const typeName = {
        mating: 'تلقيح',
        pregnancy: 'حمل',
        birth: 'ولادة',
        abortion: 'إجهاض'
      }[type._id] || type._id;
      
      doc.font('Helvetica').fontSize(10).text(`${typeName}: ${type.count}`, { align: 'right' });
    });
    doc.moveDown();
  }
  
  // إحصائيات الولادات
  doc.font('Helvetica-Bold').fontSize(12).text('إحصائيات الولادات:', { align: 'right' });
  doc.font('Helvetica').fontSize(10).text(`إجمالي الولادات: ${data.birthStats.total}`, { align: 'right' });
  
  const totalLivingOffspring = data.birthStats.totalLivingOffspring.length > 0 ? data.birthStats.totalLivingOffspring[0].count : 0;
  const totalDeadOffspring = data.birthStats.totalDeadOffspring.length > 0 ? data.birthStats.totalDeadOffspring[0].count : 0;
  
  doc.font('Helvetica').fontSize(10).text(`إجمالي المواليد الحية: ${totalLivingOffspring}`, { align: 'right' });
  doc.font('Helvetica').fontSize(10).text(`إجمالي المواليد النافقة: ${totalDeadOffspring}`, { align: 'right' });
  doc.moveDown();
  
  // إحصائيات حسب الفئة
  if (data.breedingStatsByCategory && data.breedingStatsByCategory.length > 0) {
    doc.font('Helvetica-Bold').fontSize(12).text('إحصائيات التكاثر حسب الفئة:', { align: 'right' });
    data.breedingStatsByCategory.forEach(category => {
      doc.font('Helvetica').fontSize(10).text(`${category._id}: الولادات ${category.count}, المواليد الحية ${category.livingOffspringCount || 0}, المواليد النافقة ${category.deadOffspringCount || 0}`, { align: 'right' });
    });
    doc.moveDown();
  }
  
  // أعلى الإناث إنتاجًا
  if (data.topFemales && data.topFemales.length > 0) {
    doc.font('Helvetica-Bold').fontSize(12).text('أعلى الإناث إنتاجًا:', { align: 'right' });
    data.topFemales.forEach((female, index) => {
      doc.font('Helvetica').fontSize(10).text(`${index + 1}. ${female.identificationNumber}: عدد الولادات ${female.birthCount}, إجمالي المواليد الحية ${female.totalLivingOffspring}`, { align: 'right' });
    });
  }
}

function addRestrictedAnimalsToPDF(doc, data) {
  // عنوان القسم
  doc.font('Helvetica-Bold').fontSize(16).text('تقرير الحيوانات المحظورة', { align: 'right' });
  doc.moveDown();
  
  // إحصائيات الحيوانات المحظورة
  doc.font('Helvetica-Bold').fontSize(12).text('إحصائيات الحيوانات المحظورة:', { align: 'right' });
  doc.font('Helvetica').fontSize(10).text(`إجمالي الحيوانات المحظورة: ${data.restrictedStats.total}`, { align: 'right' });
  
  // الحيوانات المحظورة حسب السبب
  if (data.restrictedStats.byReason && data.restrictedStats.byReason.length > 0) {
    doc.font('Helvetica-Bold').fontSize(12).text('الحيوانات المحظورة حسب السبب:', { align: 'right' });
    data.restrictedStats.byReason.forEach(reason => {
      const reasonName = {
        vaccination: 'تطعيم',
        treatment: 'علاج',
        other: 'أخرى'
      }[reason._id] || reason._id;
      
      doc.font('Helvetica').fontSize(10).text(`${reasonName}: ${reason.count}`, { align: 'right' });
    });
    doc.moveDown();
  }
  
  // الحيوانات المحظورة حسب الفئة
  if (data.restrictedStats.byCategory && data.restrictedStats.byCategory.length > 0) {
    doc.font('Helvetica-Bold').fontSize(12).text('الحيوانات المحظورة حسب الفئة:', { align: 'right' });
    data.restrictedStats.byCategory.forEach(category => {
      doc.font('Helvetica').fontSize(10).text(`${category.category}: ${category.count}`, { align: 'right' });
    });
    doc.moveDown();
  }
  
  // قائمة الحيوانات المحظورة
  if (data.restrictedAnimals && data.restrictedAnimals.length > 0) {
    doc.font('Helvetica-Bold').fontSize(12).text('قائمة الحيوانات المحظورة:', { align: 'right' });
    
    // إنشاء جدول
    const tableTop = doc.y + 10;
    const tableHeaders = ['رقم التعريف', 'الفئة', 'السلالة', 'سبب الحظر', 'تاريخ انتهاء الحظر', 'الأيام المتبقية'];
    const tableWidths = [80, 70, 70, 80, 95, 50];
    
    // رسم رأس الجدول
    doc.font('Helvetica-Bold').fontSize(8);
    doc.text(tableHeaders[5], doc.page.width - 50 - tableWidths[5], tableTop, { width: tableWidths[5], align: 'center' });
    doc.text(tableHeaders[4], doc.page.width - 50 - tableWidths[5] - tableWidths[4], tableTop, { width: tableWidths[4], align: 'center' });
    doc.text(tableHeaders[3], doc.page.width - 50 - tableWidths[5] - tableWidths[4] - tableWidths[3], tableTop, { width: tableWidths[3], align: 'center' });
    doc.text(tableHeaders[2], doc.page.width - 50 - tableWidths[5] - tableWidths[4] - tableWidths[3] - tableWidths[2], tableTop, { width: tableWidths[2], align: 'center' });
    doc.text(tableHeaders[1], doc.page.width - 50 - tableWidths[5] - tableWidths[4] - tableWidths[3] - tableWidths[2] - tableWidths[1], tableTop, { width: tableWidths[1], align: 'center' });
    doc.text(tableHeaders[0], doc.page.width - 50 - tableWidths[5] - tableWidths[4] - tableWidths[3] - tableWidths[2] - tableWidths[1] - tableWidths[0], tableTop, { width: tableWidths[0], align: 'center' });
    
    doc.moveTo(doc.page.width - 50 - tableWidths.reduce((a, b) => a + b, 0), tableTop - 5)
      .lineTo(doc.page.width - 50, tableTop - 5)
      .stroke();
    
    doc.moveTo(doc.page.width - 50 - tableWidths.reduce((a, b) => a + b, 0), tableTop + 15)
      .lineTo(doc.page.width - 50, tableTop + 15)
      .stroke();
    
    // إضافة بيانات الجدول
    doc.font('Helvetica').fontSize(8);
    let rowY = tableTop + 25;
    
    data.restrictedAnimals.forEach((animal, i) => {
      // التحقق من مساحة الصفحة
      if (rowY > doc.page.height - 50) {
        doc.addPage();
        rowY = 50;
      }
      
      const reasonName = {
        vaccination: 'تطعيم',
        treatment: 'علاج',
        other: 'أخرى'
      }[animal.restrictionReason] || animal.restrictionReason;
      
      doc.text(animal.daysRemaining.toString(), doc.page.width - 50 - tableWidths[5], rowY, { width: tableWidths[5], align: 'center' });
      doc.text(new Date(animal.restrictionEndDate).toLocaleDateString('ar-SA'), doc.page.width - 50 - tableWidths[5] - tableWidths[4], rowY, { width: tableWidths[4], align: 'center' });
      doc.text(reasonName, doc.page.width - 50 - tableWidths[5] - tableWidths[4] - tableWidths[3], rowY, { width: tableWidths[3], align: 'center' });
      doc.text(animal.breed, doc.page.width - 50 - tableWidths[5] - tableWidths[4] - tableWidths[3] - tableWidths[2], rowY, { width: tableWidths[2], align: 'center' });
      doc.text(animal.category, doc.page.width - 50 - tableWidths[5] - tableWidths[4] - tableWidths[3] - tableWidths[2] - tableWidths[1], rowY, { width: tableWidths[1], align: 'center' });
      doc.text(animal.identificationNumber, doc.page.width - 50 - tableWidths[5] - tableWidths[4] - tableWidths[3] - tableWidths[2] - tableWidths[1] - tableWidths[0], rowY, { width: tableWidths[0], align: 'center' });
      
      rowY += 20;
    });
  }
}

function addFinancialToPDF(doc, data) {
  // عنوان القسم
  doc.font('Helvetica-Bold').fontSize(16).text('التقرير المالي', { align: 'right' });
  doc.moveDown();
  
  // إحصائيات مالية عامة
  doc.font('Helvetica-Bold').fontSize(12).text('إحصائيات مالية عامة:', { align: 'right' });
  doc.font('Helvetica').fontSize(10).text(`إجمالي الإيرادات: ${data.totalIncome.toFixed(2)}`, { align: 'right' });
  doc.text(`إجمالي النفقات: ${data.totalExpense.toFixed(2)}`, { align: 'right' });
  doc.text(`صافي الربح: ${data.profit.toFixed(2)}`, { align: 'right' });
  doc.moveDown();
  
  // الإيرادات حسب الفئة
  if (data.incomeByCategory && data.incomeByCategory.length > 0) {
    doc.font('Helvetica-Bold').fontSize(12).text('الإيرادات حسب الفئة:', { align: 'right' });
    data.incomeByCategory.forEach(category => {
      const categoryName = {
        sale: 'بيع',
        milk: 'حليب',
        wool: 'صوف',
        other: 'أخرى'
      }[category._id] || category._id;
      
      doc.font('Helvetica').fontSize(10).text(`${categoryName}: ${category.total.toFixed(2)}`, { align: 'right' });
    });
    doc.moveDown();
  }
  
  // النفقات حسب الفئة
  if (data.expenseByCategory && data.expenseByCategory.length > 0) {
    doc.font('Helvetica-Bold').fontSize(12).text('النفقات حسب الفئة:', { align: 'right' });
    data.expenseByCategory.forEach(category => {
      const categoryName = {
        feed: 'علف',
        medication: 'أدوية',
        vaccination: 'تطعيمات',
        purchase: 'شراء',
        other: 'أخرى'
      }[category._id] || category._id;
      
      doc.font('Helvetica').fontSize(10).text(`${categoryName}: ${category.total.toFixed(2)}`, { align: 'right' });
    });
    doc.moveDown();
  }
  
  // التحليل الشهري
  if (data.monthlyAnalysis && data.monthlyAnalysis.length > 0) {
    doc.font('Helvetica-Bold').fontSize(12).text('التحليل الشهري:', { align: 'right' });
    
    const months = ['يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    
    data.monthlyAnalysis.forEach(month => {
      const monthName = months[month.month - 1];
      const profit = month.income - month.expense;
      
      doc.font('Helvetica').fontSize(10).text(`${monthName} ${month.year} - الإيرادات: ${month.income.toFixed(2)}, النفقات: ${month.expense.toFixed(2)}, الربح: ${profit.toFixed(2)}`, { align: 'right' });
    });
  }
}

 function addAnimalDistributionToExcel(workbook, data) {
  const sheet = workbook.addWorksheet('توزيع الحيوانات');
  
  // تنسيق العناوين
  const headerStyle = {
    font: { bold: true, size: 14 },
    alignment: { horizontal: 'right' }
  };
  
  const subHeaderStyle = {
    font: { bold: true, size: 12 },
    alignment: { horizontal: 'right' }
  };
  
  const cellStyle = {
    alignment: { horizontal: 'right' }
  };
  
  // إضافة عنوان التقرير
  sheet.mergeCells('A1:E1');
  const titleRow = sheet.getRow(1);
  titleRow.getCell(1).value = 'تقرير توزيع الحيوانات';
  titleRow.getCell(1).font = { bold: true, size: 16 };
  titleRow.getCell(1).alignment = { horizontal: 'center' };
  
  // إضافة تاريخ التقرير
  sheet.mergeCells('A2:E2');
  const dateRow = sheet.getRow(2);
  dateRow.getCell(1).value = `تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`;
  dateRow.getCell(1).alignment = { horizontal: 'center' };
  
  // إضافة إحصائيات عامة
  sheet.getRow(4).getCell(1).value = 'إحصائيات عامة:';
  sheet.getRow(4).getCell(1).font = subHeaderStyle.font;
  sheet.getRow(4).getCell(1).alignment = subHeaderStyle.alignment;
  
  sheet.getRow(5).getCell(1).value = 'إجمالي الحيوانات:';
  sheet.getRow(5).getCell(2).value = data.totalAnimals;
  
  sheet.getRow(6).getCell(1).value = 'الحيوانات الحية:';
  sheet.getRow(6).getCell(2).value = data.aliveAnimals;
  
  sheet.getRow(7).getCell(1).value = 'الحيوانات المباعة:';
  sheet.getRow(7).getCell(2).value = data.soldAnimals;
  
  sheet.getRow(8).getCell(1).value = 'الحيوانات النافقة:';
  sheet.getRow(8).getCell(2).value = data.deadAnimals;
  
  sheet.getRow(9).getCell(1).value = 'الحيوانات المذبوحة:';
  sheet.getRow(9).getCell(2).value = data.slaughteredAnimals;
  
  sheet.getRow(10).getCell(1).value = 'الحيوانات المحظورة:';
  sheet.getRow(10).getCell(2).value = data.restrictedAnimals;
  
  // إضافة توزيع حسب الفئة
  if (data.byCategory && data.byCategory.length > 0) {
    let row = 12;
    
    sheet.getRow(row).getCell(1).value = 'توزيع حسب الفئة:';
    sheet.getRow(row).getCell(1).font = subHeaderStyle.font;
    sheet.getRow(row).getCell(1).alignment = subHeaderStyle.alignment;
    row++;
    
    // إضافة رأس الجدول
    sheet.getRow(row).getCell(1).value = 'الفئة';
    sheet.getRow(row).getCell(2).value = 'العدد';
    sheet.getRow(row).getCell(1).font = { bold: true };
    sheet.getRow(row).getCell(2).font = { bold: true };
    row++;
    
    // إضافة البيانات
    data.byCategory.forEach(category => {
      sheet.getRow(row).getCell(1).value = category.category;
      sheet.getRow(row).getCell(2).value = category.count;
      row++;
    });
    
    // إضافة توزيع حسب السلالة
    row += 2;
    sheet.getRow(row).getCell(1).value = 'توزيع حسب السلالة:';
    sheet.getRow(row).getCell(1).font = subHeaderStyle.font;
    sheet.getRow(row).getCell(1).alignment = subHeaderStyle.alignment;
    row++;
    
    // إضافة رأس الجدول
    sheet.getRow(row).getCell(1).value = 'السلالة';
    sheet.getRow(row).getCell(2).value = 'العدد';
    sheet.getRow(row).getCell(1).font = { bold: true };
    sheet.getRow(row).getCell(2).font = { bold: true };
    row++;
    
    // إضافة البيانات
    if (data.byBreed && data.byBreed.length > 0) {
      data.byBreed.forEach(breed => {
        sheet.getRow(row).getCell(1).value = breed.breed;
        sheet.getRow(row).getCell(2).value = breed.count;
        row++;
      });
    }
    
    // إضافة توزيع حسب الجنس
    row += 2;
    sheet.getRow(row).getCell(1).value = 'توزيع حسب الجنس:';
    sheet.getRow(row).getCell(1).font = subHeaderStyle.font;
    sheet.getRow(row).getCell(1).alignment = subHeaderStyle.alignment;
    row++;
    
    // إضافة رأس الجدول
    sheet.getRow(row).getCell(1).value = 'الجنس';
    sheet.getRow(row).getCell(2).value = 'العدد';
    sheet.getRow(row).getCell(1).font = { bold: true };
    sheet.getRow(row).getCell(2).font = { bold: true };
    row++;
    
    // إضافة البيانات
    if (data.byGender && data.byGender.length > 0) {
      data.byGender.forEach(gender => {
        const genderName = gender._id === 'male' ? 'ذكر' : 'أنثى';
        sheet.getRow(row).getCell(1).value = genderName;
        sheet.getRow(row).getCell(2).value = gender.count;
        row++;
      });
    }
    
    // إضافة توزيع حسب العمر
    row += 2;
    sheet.getRow(row).getCell(1).value = 'توزيع حسب العمر:';
    sheet.getRow(row).getCell(1).font = subHeaderStyle.font;
    sheet.getRow(row).getCell(1).alignment = subHeaderStyle.alignment;
    row++;
    
    // إضافة رأس الجدول
    sheet.getRow(row).getCell(1).value = 'العمر';
    sheet.getRow(row).getCell(2).value = 'العدد';
    sheet.getRow(row).getCell(1).font = { bold: true };
    sheet.getRow(row).getCell(2).font = { bold: true };
    row++;
    
    // إضافة البيانات
    if (data.byAge && data.byAge.length > 0) {
      data.byAge.forEach(age => {
        sheet.getRow(row).getCell(1).value = age._id;
        sheet.getRow(row).getCell(2).value = age.count;
        row++;
      });
    }
  }
  
  // ضبط عرض الأعمدة
  sheet.columns.forEach(column => {
    column.width = 20;
  });
}

function addHealthVaccinationToExcel(workbook, data) {
  const sheet = workbook.addWorksheet('التطعيمات والصحة');
  
  // تنسيق العناوين
  const headerStyle = {
    font: { bold: true, size: 14 },
    alignment: { horizontal: 'right' }
  };
  
  const subHeaderStyle = {
    font: { bold: true, size: 12 },
    alignment: { horizontal: 'right' }
  };
  
  // إضافة عنوان التقرير
  sheet.mergeCells('A1:E1');
  const titleRow = sheet.getRow(1);
  titleRow.getCell(1).value = 'تقرير التطعيمات والصحة';
  titleRow.getCell(1).font = { bold: true, size: 16 };
  titleRow.getCell(1).alignment = { horizontal: 'center' };
  
  // إضافة تاريخ التقرير
  sheet.mergeCells('A2:E2');
  const dateRow = sheet.getRow(2);
  dateRow.getCell(1).value = `تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`;
  dateRow.getCell(1).alignment = { horizontal: 'center' };
  
  // إضافة إحصائيات التطعيمات
  let row = 4;
  
  sheet.getRow(row).getCell(1).value = 'إحصائيات التطعيمات:';
  sheet.getRow(row).getCell(1).font = subHeaderStyle.font;
  sheet.getRow(row).getCell(1).alignment = subHeaderStyle.alignment;
  row++;
  
  // تحقق من وجود البيانات قبل محاولة الوصول إليها
  const vacStats = data.vaccinationStats || {};
  
  sheet.getRow(row).getCell(1).value = 'إجمالي التطعيمات:';
  sheet.getRow(row).getCell(2).value = vacStats.total || 0; // إضافة القيمة الافتراضية 0
  row++;
  
  sheet.getRow(row).getCell(1).value = 'التطعيمات المعلقة:';
  sheet.getRow(row).getCell(2).value = vacStats.pending || 0;
  row++;
  
  sheet.getRow(row).getCell(1).value = 'التطعيمات المكتملة:';
  sheet.getRow(row).getCell(2).value = vacStats.completed || 0;
  row++;
  
  sheet.getRow(row).getCell(1).value = 'التطعيمات المتأخرة:';
  sheet.getRow(row).getCell(2).value = vacStats.delayed || 0;
  row++;
  
  // إضافة التطعيمات حسب النوع
  row += 2;
  sheet.getRow(row).getCell(1).value = 'التطعيمات حسب النوع:';
  sheet.getRow(row).getCell(1).font = subHeaderStyle.font;
  sheet.getRow(row).getCell(1).alignment = subHeaderStyle.alignment;
  row++;
  
  // إضافة رأس الجدول
  sheet.getRow(row).getCell(1).value = 'نوع التطعيم';
  sheet.getRow(row).getCell(2).value = 'الإجمالي';
  sheet.getRow(row).getCell(3).value = 'مكتمل';
  sheet.getRow(row).getCell(4).value = 'معلق';
  sheet.getRow(row).getCell(5).value = 'متأخر';
  
  sheet.getRow(row).getCell(1).font = { bold: true };
  sheet.getRow(row).getCell(2).font = { bold: true };
  sheet.getRow(row).getCell(3).font = { bold: true };
  sheet.getRow(row).getCell(4).font = { bold: true };
  sheet.getRow(row).getCell(5).font = { bold: true };
  row++;
  
  // إضافة البيانات
  if (data.vaccinationsByName && data.vaccinationsByName.length > 0) {
    data.vaccinationsByName.forEach(vac => {
      sheet.getRow(row).getCell(1).value = vac._id;
      sheet.getRow(row).getCell(2).value = vac.total;
      sheet.getRow(row).getCell(3).value = vac.completed;
      sheet.getRow(row).getCell(4).value = vac.pending;
      sheet.getRow(row).getCell(5).value = vac.delayed;
      row++;
    });
  }
  
  // إضافة إحصائيات الأحداث الصحية
  row += 2;
  sheet.getRow(row).getCell(1).value = 'إحصائيات الأحداث الصحية:';
  sheet.getRow(row).getCell(1).font = subHeaderStyle.font;
  sheet.getRow(row).getCell(1).alignment = subHeaderStyle.alignment;
  row++;
  
  // تحقق من وجود البيانات قبل محاولة الوصول إليها
  const healthStats = data.healthEventStats || {};
  
  sheet.getRow(row).getCell(1).value = 'إجمالي الأحداث الصحية:';
  sheet.getRow(row).getCell(2).value = healthStats.total || 0;
  row++;
  
  // إضافة الأحداث الصحية حسب النوع
  row += 1;
  sheet.getRow(row).getCell(1).value = 'الأحداث الصحية حسب النوع:';
  sheet.getRow(row).getCell(1).font = { bold: true };
  row++;
  
  // إضافة رأس الجدول
  sheet.getRow(row).getCell(1).value = 'النوع';
  sheet.getRow(row).getCell(2).value = 'العدد';
  sheet.getRow(row).getCell(1).font = { bold: true };
  sheet.getRow(row).getCell(2).font = { bold: true };
  row++;
  
  // إضافة البيانات
  if (healthStats.byType && healthStats.byType.length > 0) {
    healthStats.byType.forEach(type => {
      const typeName = {
        disease: 'مرض',
        injury: 'إصابة',
        treatment: 'علاج',
        examination: 'فحص'
      }[type._id] || type._id;
      
      sheet.getRow(row).getCell(1).value = typeName;
      sheet.getRow(row).getCell(2).value = type.count;
      row++;
    });
  }
  
  // ضبط عرض الأعمدة
  sheet.columns.forEach(column => {
    column.width = 20;
  });
}

function addBreedingToExcel(workbook, data) {
  const sheet = workbook.addWorksheet('التكاثر');
  
  // تنسيق العناوين
  const headerStyle = {
    font: { bold: true, size: 14 },
    alignment: { horizontal: 'right' }
  };
  
  const subHeaderStyle = {
    font: { bold: true, size: 12 },
    alignment: { horizontal: 'right' }
  };
  
  // إضافة عنوان التقرير
  sheet.mergeCells('A1:E1');
  const titleRow = sheet.getRow(1);
  titleRow.getCell(1).value = 'تقرير التكاثر';
  titleRow.getCell(1).font = { bold: true, size: 16 };
  titleRow.getCell(1).alignment = { horizontal: 'center' };
  
  // إضافة تاريخ التقرير
  sheet.mergeCells('A2:E2');
  const dateRow = sheet.getRow(2);
  dateRow.getCell(1).value = `تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`;
  dateRow.getCell(1).alignment = { horizontal: 'center' };
  
  // إضافة إحصائيات أحداث التكاثر
  let row = 4;
  
  sheet.getRow(row).getCell(1).value = 'إحصائيات أحداث التكاثر:';
  sheet.getRow(row).getCell(1).font = subHeaderStyle.font;
  sheet.getRow(row).getCell(1).alignment = subHeaderStyle.alignment;
  row++;
  
  sheet.getRow(row).getCell(1).value = 'إجمالي أحداث التكاثر:';
  sheet.getRow(row).getCell(2).value = data.breedingEventStats.total;
  row++;
  
  // إضافة أحداث التكاثر حسب النوع
  row += 1;
  sheet.getRow(row).getCell(1).value = 'أحداث التكاثر حسب النوع:';
  sheet.getRow(row).getCell(1).font = { bold: true };
  row++;
  
  // إضافة رأس الجدول
  sheet.getRow(row).getCell(1).value = 'النوع';
  sheet.getRow(row).getCell(2).value = 'العدد';
  sheet.getRow(row).getCell(1).font = { bold: true };
  sheet.getRow(row).getCell(2).font = { bold: true };
  row++;
  
  // إضافة البيانات
  if (data.breedingEventStats.byType && data.breedingEventStats.byType.length > 0) {
    data.breedingEventStats.byType.forEach(type => {
      const typeName = {
        mating: 'تلقيح',
        pregnancy: 'حمل',
        birth: 'ولادة',
        abortion: 'إجهاض'
      }[type._id] || type._id;
      
      sheet.getRow(row).getCell(1).value = typeName;
      sheet.getRow(row).getCell(2).value = type.count;
      row++;
    });
  }
  
  // إضافة إحصائيات الولادات
  row += 2;
  sheet.getRow(row).getCell(1).value = 'إحصائيات الولادات:';
  sheet.getRow(row).getCell(1).font = subHeaderStyle.font;
  sheet.getRow(row).getCell(1).alignment = subHeaderStyle.alignment;
  row++;
  
  sheet.getRow(row).getCell(1).value = 'إجمالي الولادات:';
  sheet.getRow(row).getCell(2).value = data.birthStats.total;
  row++;
  
  const totalLivingOffspring = data.birthStats.totalLivingOffspring.length > 0 ? data.birthStats.totalLivingOffspring[0].count : 0;
  const totalDeadOffspring = data.birthStats.totalDeadOffspring.length > 0 ? data.birthStats.totalDeadOffspring[0].count : 0;
  
  sheet.getRow(row).getCell(1).value = 'إجمالي المواليد الحية:';
  sheet.getRow(row).getCell(2).value = totalLivingOffspring;
  row++;
  
  sheet.getRow(row).getCell(1).value = 'إجمالي المواليد النافقة:';
  sheet.getRow(row).getCell(2).value = totalDeadOffspring;
  row++;
  
  // إضافة إحصائيات حسب الفئة
  if (data.breedingStatsByCategory && data.breedingStatsByCategory.length > 0) {
    row += 2;
    sheet.getRow(row).getCell(1).value = 'إحصائيات التكاثر حسب الفئة:';
    sheet.getRow(row).getCell(1).font = subHeaderStyle.font;
    sheet.getRow(row).getCell(1).alignment = subHeaderStyle.alignment;
    row++;
    
    // إضافة رأس الجدول
    sheet.getRow(row).getCell(1).value = 'الفئة';
    sheet.getRow(row).getCell(2).value = 'عدد الولادات';
    sheet.getRow(row).getCell(3).value = 'المواليد الحية';
    sheet.getRow(row).getCell(4).value = 'المواليد النافقة';
    
    sheet.getRow(row).getCell(1).font = { bold: true };
    sheet.getRow(row).getCell(2).font = { bold: true };
    sheet.getRow(row).getCell(3).font = { bold: true };
    sheet.getRow(row).getCell(4).font = { bold: true };
    row++;
    
    // إضافة البيانات
    data.breedingStatsByCategory.forEach(category => {
      sheet.getRow(row).getCell(1).value = category._id;
      sheet.getRow(row).getCell(2).value = category.count;
      sheet.getRow(row).getCell(3).value = category.livingOffspringCount || 0;
      sheet.getRow(row).getCell(4).value = category.deadOffspringCount || 0;
      row++;
    });
  }
  
  // إضافة أعلى الإناث إنتاجًا
  if (data.topFemales && data.topFemales.length > 0) {
    row += 2;
    sheet.getRow(row).getCell(1).value = 'أعلى الإناث إنتاجًا:';
    sheet.getRow(row).getCell(1).font = subHeaderStyle.font;
    sheet.getRow(row).getCell(1).alignment = subHeaderStyle.alignment;
    row++;
    
    // إضافة رأس الجدول
    sheet.getRow(row).getCell(1).value = 'رقم التعريف';
    sheet.getRow(row).getCell(2).value = 'عدد الولادات';
    sheet.getRow(row).getCell(3).value = 'المواليد الحية';
    sheet.getRow(row).getCell(4).value = 'المواليد النافقة';
    
    sheet.getRow(row).getCell(1).font = { bold: true };
    sheet.getRow(row).getCell(2).font = { bold: true };
    sheet.getRow(row).getCell(3).font = { bold: true };
    sheet.getRow(row).getCell(4).font = { bold: true };
    row++;
    
    // إضافة البيانات
    data.topFemales.forEach(female => {
      sheet.getRow(row).getCell(1).value = female.identificationNumber;
      sheet.getRow(row).getCell(2).value = female.birthCount;
      sheet.getRow(row).getCell(3).value = female.totalLivingOffspring;
      sheet.getRow(row).getCell(4).value = female.totalDeadOffspring;
      row++;
    });
  }
  
  // ضبط عرض الأعمدة
  sheet.columns.forEach(column => {
    column.width = 20;
  });
}

function addRestrictedAnimalsToExcel(workbook, data) {
  const sheet = workbook.addWorksheet('الحيوانات المحظورة');
  
  // تنسيق العناوين
  const headerStyle = {
    font: { bold: true, size: 14 },
    alignment: { horizontal: 'right' }
  };
  
  const subHeaderStyle = {
    font: { bold: true, size: 12 },
    alignment: { horizontal: 'right' }
  };
  
  // إضافة عنوان التقرير
  sheet.mergeCells('A1:F1');
  const titleRow = sheet.getRow(1);
  titleRow.getCell(1).value = 'تقرير الحيوانات المحظورة';
  titleRow.getCell(1).font = { bold: true, size: 16 };
  titleRow.getCell(1).alignment = { horizontal: 'center' };
  
  // إضافة تاريخ التقرير
  sheet.mergeCells('A2:F2');
  const dateRow = sheet.getRow(2);
  dateRow.getCell(1).value = `تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`;
  dateRow.getCell(1).alignment = { horizontal: 'center' };
  
  // إضافة إحصائيات الحيوانات المحظورة
  let row = 4;
  
  sheet.getRow(row).getCell(1).value = 'إحصائيات الحيوانات المحظورة:';
  sheet.getRow(row).getCell(1).font = subHeaderStyle.font;
  sheet.getRow(row).getCell(1).alignment = subHeaderStyle.alignment;
  row++;
  
  sheet.getRow(row).getCell(1).value = 'إجمالي الحيوانات المحظورة:';
  sheet.getRow(row).getCell(2).value = data.restrictedStats.total;
  row++;
  
  // إضافة الحيوانات المحظورة حسب السبب
  row += 1;
  sheet.getRow(row).getCell(1).value = 'الحيوانات المحظورة حسب السبب:';
  sheet.getRow(row).getCell(1).font = { bold: true };
  row++;
  
  // إضافة رأس الجدول
  sheet.getRow(row).getCell(1).value = 'السبب';
  sheet.getRow(row).getCell(2).value = 'العدد';
  sheet.getRow(row).getCell(1).font = { bold: true };
  sheet.getRow(row).getCell(2).font = { bold: true };
  row++;
  
  // إضافة البيانات
  if (data.restrictedStats.byReason && data.restrictedStats.byReason.length > 0) {
    data.restrictedStats.byReason.forEach(reason => {
      const reasonName = {
        vaccination: 'تطعيم',
        treatment: 'علاج',
        other: 'أخرى'
      }[reason._id] || reason._id;
      
      sheet.getRow(row).getCell(1).value = reasonName;
      sheet.getRow(row).getCell(2).value = reason.count;
      row++;
    });
  }
  
  // إضافة الحيوانات المحظورة حسب الفئة
  if (data.restrictedStats.byCategory && data.restrictedStats.byCategory.length > 0) {
    row += 2;
    sheet.getRow(row).getCell(1).value = 'الحيوانات المحظورة حسب الفئة:';
    sheet.getRow(row).getCell(1).font = { bold: true };
    row++;
    
    // إضافة رأس الجدول
    sheet.getRow(row).getCell(1).value = 'الفئة';
    sheet.getRow(row).getCell(2).value = 'العدد';
    sheet.getRow(row).getCell(1).font = { bold: true };
    sheet.getRow(row).getCell(2).font = { bold: true };
    row++;
    
    // إضافة البيانات
    data.restrictedStats.byCategory.forEach(category => {
      sheet.getRow(row).getCell(1).value = category.category;
      sheet.getRow(row).getCell(2).value = category.count;
      row++;
    });
  }
  
  // إضافة قائمة الحيوانات المحظورة
  if (data.restrictedAnimals && data.restrictedAnimals.length > 0) {
    row += 2;
    sheet.getRow(row).getCell(1).value = 'قائمة الحيوانات المحظورة:';
    sheet.getRow(row).getCell(1).font = subHeaderStyle.font;
    sheet.getRow(row).getCell(1).alignment = subHeaderStyle.alignment;
    row++;
    
    // إضافة رأس الجدول
    sheet.getRow(row).getCell(1).value = 'رقم التعريف';
    sheet.getRow(row).getCell(2).value = 'الفئة';
    sheet.getRow(row).getCell(3).value = 'السلالة';
    sheet.getRow(row).getCell(4).value = 'سبب الحظر';
    sheet.getRow(row).getCell(5).value = 'تاريخ انتهاء الحظر';
    sheet.getRow(row).getCell(6).value = 'الأيام المتبقية';
    
    sheet.getRow(row).getCell(1).font = { bold: true };
    sheet.getRow(row).getCell(2).font = { bold: true };
    sheet.getRow(row).getCell(3).font = { bold: true };
    sheet.getRow(row).getCell(4).font = { bold: true };
    sheet.getRow(row).getCell(5).font = { bold: true };
    sheet.getRow(row).getCell(6).font = { bold: true };
    row++;
    
    // إضافة البيانات
    data.restrictedAnimals.forEach(animal => {
      const reasonName = {
        vaccination: 'تطعيم',
        treatment: 'علاج',
        other: 'أخرى'
      }[animal.restrictionReason] || animal.restrictionReason;
      
      sheet.getRow(row).getCell(1).value = animal.identificationNumber;
      sheet.getRow(row).getCell(2).value = animal.category;
      sheet.getRow(row).getCell(3).value = animal.breed;
      sheet.getRow(row).getCell(4).value = reasonName;
      sheet.getRow(row).getCell(5).value = new Date(animal.restrictionEndDate).toLocaleDateString('ar-SA');
      sheet.getRow(row).getCell(6).value = animal.daysRemaining;
      row++;
    });
  }
  
 // ضبط عرض الأعمدة
  sheet.columns.forEach(column => {
    column.width = 20;
  });
}

function addFinancialToExcel(workbook, data) {
  const sheet = workbook.addWorksheet('التقرير المالي');
  
  // تنسيق العناوين
  const headerStyle = {
    font: { bold: true, size: 14 },
    alignment: { horizontal: 'right' }
  };
  
  const subHeaderStyle = {
    font: { bold: true, size: 12 },
    alignment: { horizontal: 'right' }
  };
  
  // إضافة عنوان التقرير
  sheet.mergeCells('A1:E1');
  const titleRow = sheet.getRow(1);
  titleRow.getCell(1).value = 'التقرير المالي';
  titleRow.getCell(1).font = { bold: true, size: 16 };
  titleRow.getCell(1).alignment = { horizontal: 'center' };
  
  // إضافة تاريخ التقرير
  sheet.mergeCells('A2:E2');
  const dateRow = sheet.getRow(2);
  dateRow.getCell(1).value = `تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`;
  dateRow.getCell(1).alignment = { horizontal: 'center' };
  
  // إضافة إحصائيات مالية عامة
  let row = 4;
  
  sheet.getRow(row).getCell(1).value = 'إحصائيات مالية عامة:';
  sheet.getRow(row).getCell(1).font = subHeaderStyle.font;
  sheet.getRow(row).getCell(1).alignment = subHeaderStyle.alignment;
  row++;
  
  sheet.getRow(row).getCell(1).value = 'إجمالي الإيرادات:';
  sheet.getRow(row).getCell(2).value = data.totalIncome.toFixed(2);
  row++;
  
  sheet.getRow(row).getCell(1).value = 'إجمالي النفقات:';
  sheet.getRow(row).getCell(2).value = data.totalExpense.toFixed(2);
  row++;
  
  sheet.getRow(row).getCell(1).value = 'صافي الربح:';
  sheet.getRow(row).getCell(2).value = data.profit.toFixed(2);
  row++;
  
  // إضافة الإيرادات حسب الفئة
  if (data.incomeByCategory && data.incomeByCategory.length > 0) {
    row += 2;
    sheet.getRow(row).getCell(1).value = 'الإيرادات حسب الفئة:';
    sheet.getRow(row).getCell(1).font = subHeaderStyle.font;
    sheet.getRow(row).getCell(1).alignment = subHeaderStyle.alignment;
    row++;
    
    // إضافة رأس الجدول
    sheet.getRow(row).getCell(1).value = 'الفئة';
    sheet.getRow(row).getCell(2).value = 'المبلغ';
    sheet.getRow(row).getCell(1).font = { bold: true };
    sheet.getRow(row).getCell(2).font = { bold: true };
    row++;
    
    // إضافة البيانات
    data.incomeByCategory.forEach(category => {
      const categoryName = {
        sale: 'بيع',
        milk: 'حليب',
        wool: 'صوف',
        other: 'أخرى'
      }[category._id] || category._id;
      
      sheet.getRow(row).getCell(1).value = categoryName;
      sheet.getRow(row).getCell(2).value = category.total.toFixed(2);
      row++;
    });
  }
  
  // إضافة النفقات حسب الفئة
  if (data.expenseByCategory && data.expenseByCategory.length > 0) {
    row += 2;
    sheet.getRow(row).getCell(1).value = 'النفقات حسب الفئة:';
    sheet.getRow(row).getCell(1).font = subHeaderStyle.font;
    sheet.getRow(row).getCell(1).alignment = subHeaderStyle.alignment;
    row++;
    
    // إضافة رأس الجدول
    sheet.getRow(row).getCell(1).value = 'الفئة';
    sheet.getRow(row).getCell(2).value = 'المبلغ';
    sheet.getRow(row).getCell(1).font = { bold: true };
    sheet.getRow(row).getCell(2).font = { bold: true };
    row++;
    
    // إضافة البيانات
    data.expenseByCategory.forEach(category => {
      const categoryName = {
        feed: 'علف',
        medication: 'أدوية',
        vaccination: 'تطعيمات',
        purchase: 'شراء',
        other: 'أخرى'
      }[category._id] || category._id;
      
      sheet.getRow(row).getCell(1).value = categoryName;
      sheet.getRow(row).getCell(2).value = category.total.toFixed(2);
      row++;
    });
  }
  
  // إضافة التحليل الشهري
  if (data.monthlyAnalysis && data.monthlyAnalysis.length > 0) {
    row += 2;
    sheet.getRow(row).getCell(1).value = 'التحليل الشهري:';
    sheet.getRow(row).getCell(1).font = subHeaderStyle.font;
    sheet.getRow(row).getCell(1).alignment = subHeaderStyle.alignment;
    row++;
    
    // إضافة رأس الجدول
    sheet.getRow(row).getCell(1).value = 'السنة';
    sheet.getRow(row).getCell(2).value = 'الشهر';
    sheet.getRow(row).getCell(3).value = 'الإيرادات';
    sheet.getRow(row).getCell(4).value = 'النفقات';
    sheet.getRow(row).getCell(5).value = 'الربح';
    
    sheet.getRow(row).getCell(1).font = { bold: true };
    sheet.getRow(row).getCell(2).font = { bold: true };
    sheet.getRow(row).getCell(3).font = { bold: true };
    sheet.getRow(row).getCell(4).font = { bold: true };
    sheet.getRow(row).getCell(5).font = { bold: true };
    row++;
    
    // إضافة البيانات
    const months = ['يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    
    data.monthlyAnalysis.forEach(month => {
      const monthName = months[month.month - 1];
      const profit = month.income - month.expense;
      
      sheet.getRow(row).getCell(1).value = month.year;
      sheet.getRow(row).getCell(2).value = monthName;
      sheet.getRow(row).getCell(3).value = month.income.toFixed(2);
      sheet.getRow(row).getCell(4).value = month.expense.toFixed(2);
      sheet.getRow(row).getCell(5).value = profit.toFixed(2);
      row++;
    });
  }
  
  // إضافة الإيرادات حسب الحيوان
  if (data.incomeByAnimal && data.incomeByAnimal.length > 0) {
    row += 2;
    sheet.getRow(row).getCell(1).value = 'الإيرادات حسب الحيوان (أعلى 10):';
    sheet.getRow(row).getCell(1).font = subHeaderStyle.font;
    sheet.getRow(row).getCell(1).alignment = subHeaderStyle.alignment;
    row++;
    
    // إضافة رأس الجدول
    sheet.getRow(row).getCell(1).value = 'رقم التعريف';
    sheet.getRow(row).getCell(2).value = 'المبلغ';
    sheet.getRow(row).getCell(1).font = { bold: true };
    sheet.getRow(row).getCell(2).font = { bold: true };
    row++;
    
    // إضافة البيانات
    data.incomeByAnimal.forEach(animal => {
      sheet.getRow(row).getCell(1).value = animal.identificationNumber;
      sheet.getRow(row).getCell(2).value = animal.total.toFixed(2);
      row++;
    });
  }
  
  // إضافة النفقات حسب الحيوان
  if (data.expenseByAnimal && data.expenseByAnimal.length > 0) {
    row += 2;
    sheet.getRow(row).getCell(1).value = 'النفقات حسب الحيوان (أعلى 10):';
    sheet.getRow(row).getCell(1).font = subHeaderStyle.font;
    sheet.getRow(row).getCell(1).alignment = subHeaderStyle.alignment;
    row++;
    
    // إضافة رأس الجدول
    sheet.getRow(row).getCell(1).value = 'رقم التعريف';
    sheet.getRow(row).getCell(2).value = 'المبلغ';
    sheet.getRow(row).getCell(1).font = { bold: true };
    sheet.getRow(row).getCell(2).font = { bold: true };
    row++;
    
    // إضافة البيانات
    data.expenseByAnimal.forEach(animal => {
      sheet.getRow(row).getCell(1).value = animal.identificationNumber;
      sheet.getRow(row).getCell(2).value = animal.total.toFixed(2);
      row++;
    });
  }
  
  // ضبط عرض الأعمدة
  sheet.columns.forEach(column => {
    column.width = 20;
  });
}


 