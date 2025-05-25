// backend/routes/feedingReportsRoutes.js
const express = require('express');
const {
  getDailyFeedingReport,
  getWeeklyFeedingReport,
  getMonthlyFeedingReport,
  getFeedConsumptionReport,
  getFeedCostAnalysis,
  getAnimalFeedingHistory,
  getFeedEfficiencyReport,
  getInventoryConsumptionReport,
  getSchedulePerformanceReport,
  exportFeedingReport
} = require('../controllers/feedingReportsController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// حماية جميع المسارات
router.use(protect);

// تقارير التغذية
router.route('/daily')
  .get(getDailyFeedingReport);

router.route('/weekly')
  .get(getWeeklyFeedingReport);

router.route('/monthly')
  .get(getMonthlyFeedingReport);

router.route('/consumption')
  .get(getFeedConsumptionReport);

router.route('/cost-analysis')
  .get(getFeedCostAnalysis);

router.route('/animal-history/:animalId')
  .get(getAnimalFeedingHistory);

router.route('/efficiency')
  .get(getFeedEfficiencyReport);

router.route('/inventory-consumption')
  .get(getInventoryConsumptionReport);

router.route('/schedule-performance')
  .get(getSchedulePerformanceReport);

router.route('/export')
  .post(exportFeedingReport);

module.exports = router;