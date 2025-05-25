// backend/controllers/livestockOperationsController.js
const Animal = require('../models/Animal');
const FeedingRecord = require('../models/FeedingRecord');
const Vaccination = require('../models/Vaccination');
const HealthEvent = require('../models/HealthEvent');
const BreedingEvent = require('../models/BreedingEvent');
const EquipmentUsage = require('../models/EquipmentUsage');
const InventoryItem = require('../models/InventoryItem');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');

// @desc    الحصول على بيانات لوحة التحكم للعمليات
// @route   GET /api/livestock-operations/dashboard
// @access  Private
exports.getDashboardData = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  // إحصائيات اليوم
  const [
    todayFeeding,
    todayVaccinations,
    todayHealthEvents,
    todayEquipmentUsage,
    totalAnimals,
    restrictedAnimals,
    lowStockItems
  ] = await Promise.all([
    FeedingRecord.countDocuments({
      userId,
      feedingDate: { $gte: startOfDay, $lte: endOfDay }
    }),
    Vaccination.countDocuments({
      userId,
      administrationDate: { $gte: startOfDay, $lte: endOfDay }
    }),
    HealthEvent.countDocuments({
      userId,
      date: { $gte: startOfDay, $lte: endOfDay }
    }),
    EquipmentUsage.countDocuments({
      userId,
      usageDate: { $gte: startOfDay, $lte: endOfDay }
    }),
    Animal.countDocuments({ userId, status: 'alive' }),
    Animal.countDocuments({ userId, 'restriction.isRestricted': true }),
    InventoryItem.countDocuments({ userId, isLowStock: true })
  ]);

  // أحدث الأنشطة
  const recentActivities = await Promise.all([
    FeedingRecord.find({ userId })
      .sort({ feedingDate: -1, createdAt: -1 })
      .limit(3)
      .populate('animals.animalId', 'identificationNumber'),
    
    Vaccination.find({ userId, status: 'completed' })
      .sort({ administrationDate: -1 })
      .limit(3)
      .populate('animalId', 'identificationNumber'),
    
    HealthEvent.find({ userId })
      .sort({ date: -1 })
      .limit(3)
      .populate('animalId', 'identificationNumber')
  ]);

  // تجميع الأنشطة وترتيبها حسب التاريخ
  const allActivities = [
    ...recentActivities[0].map(item => ({
      type: 'feeding',
      date: item.feedingDate,
      description: `تغذية ${item.animals.length} حيوان`,
      details: item.feedType.name
    })),
    ...recentActivities[1].map(item => ({
      type: 'vaccination',
      date: item.administrationDate,
      description: `تطعيم ${item.animalId?.identificationNumber || 'حيوان'}`,
      details: item.name
    })),
    ...recentActivities[2].map(item => ({
      type: 'health',
      date: item.date,
      description: `حدث صحي - ${item.animalId?.identificationNumber || 'حيوان'}`,
      details: item.eventType
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  // الأنشطة المجدولة للأسبوع القادم
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  const upcomingVaccinations = await Vaccination.find({
    userId,
    status: 'pending',
    scheduleDate: { $gte: today, $lte: nextWeek }
  })
    .populate('animalId', 'identificationNumber')
    .sort({ scheduleDate: 1 })
    .limit(5);

  res.status(200).json({
    success: true,
    data: {
      todayStats: {
        feeding: todayFeeding,
        vaccinations: todayVaccinations,
        healthEvents: todayHealthEvents,
        equipmentUsage: todayEquipmentUsage
      },
      summary: {
        totalAnimals,
        restrictedAnimals,
        lowStockItems
      },
      recentActivities: allActivities,
      upcoming: {
        vaccinations: upcomingVaccinations.map(v => ({
          id: v._id,
          animalId: v.animalId?._id,
          animalIdentification: v.animalId?.identificationNumber,
          vaccinationName: v.name,
          scheduleDate: v.scheduleDate
        }))
      }
    }
  });
});

// @desc    الحصول على ملخص العمليات
// @route   GET /api/livestock-operations/summary
// @access  Private
exports.getOperationsSummary = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
  const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

  // إحصائيات شاملة للفترة المحددة
  const [
    feedingStats,
    vaccinationStats,
    healthStats,
    equipmentStats
  ] = await Promise.all([
    FeedingRecord.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(userId),
          feedingDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          totalCost: { $sum: '$cost.totalCost' },
          totalAnimals: { $sum: { $size: '$animals' } },
          totalAmount: { $sum: '$totalAmount' }
        }
      }    
    ]),
    Vaccination.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(userId),
          status: 'completed',
          administrationDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          totalCost: { $sum: '$cost.totalCost' },
          totalAnimals: { $sum: { $size: '$animals' } },
          totalAmount: { $sum: '$totalAmount' }
        }
      }    
    ]),
    HealthEvent.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(userId),
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          totalCost: { $sum: '$cost.totalCost' },
          totalAnimals: { $sum: { $size: '$animals' } },
          totalAmount: { $sum: '$totalAmount' }
        }
      }    
    ]),
    EquipmentUsage.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(userId),
          usageDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          totalCost: { $sum: '$cost.totalCost' },
          totalEquipmentUsed: { $sum: { $size: '$equipment' } },
          totalAmount: { $sum: '$totalAmount' }
        }
      }    
    ])
  ]);

  res.status(200).json({
    success: true,
    data: {
      feeding: feedingStats[0],
      vaccinations: vaccinationStats[0],
      healthEvents: healthStats[0],
      equipmentUsage: equipmentStats[0]
    }
  });
});

 