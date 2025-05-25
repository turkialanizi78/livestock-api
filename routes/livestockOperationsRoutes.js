// backend/routes/livestockOperationsRoutes.js
const express = require('express');
const {
  getDashboardData,
  getOperationsSummary,
  getTodayOperations,
  getUpcomingTasks,
  recordMultipleOperations,
  getOperationsByDate,
  getQuickActions,
  getOperationsCalendar
} = require('../controllers/livestockOperationsController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// حماية جميع المسارات
router.use(protect);

// لوحة التحكم والعمليات الشاملة
router.route('/dashboard')
  .get(getDashboardData);

router.route('/summary')
  .get(getOperationsSummary);

router.route('/today')
  .get(getTodayOperations);

router.route('/upcoming')
  .get(getUpcomingTasks);

router.route('/quick-actions')
  .get(getQuickActions);

router.route('/calendar')
  .get(getOperationsCalendar);

router.route('/by-date')
  .get(getOperationsByDate);

router.route('/multiple')
  .post(recordMultipleOperations);

module.exports = router;