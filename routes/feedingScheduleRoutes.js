// backend/routes/feedingScheduleRoutes.js
const express = require('express');
const {
  getFeedingSchedules,
  getFeedingSchedule,
  createFeedingSchedule,
  updateFeedingSchedule,
  deleteFeedingSchedule,
  activateSchedule,
  deactivateSchedule,
  executeSchedule,
  getSchedulePreview,
  getEligibleAnimals,
  duplicateSchedule,
  getScheduleStats
} = require('../controllers/feedingScheduleController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// حماية جميع المسارات
router.use(protect);

// المسارات الأساسية
router.route('/')
  .get(getFeedingSchedules)
  .post(createFeedingSchedule);

router.route('/:id')
  .get(getFeedingSchedule)
  .put(updateFeedingSchedule)
  .delete(deleteFeedingSchedule);

// مسارات التحكم في الجدولة
router.route('/:id/activate')
  .put(activateSchedule);

router.route('/:id/deactivate')
  .put(deactivateSchedule);

router.route('/:id/execute')
  .post(executeSchedule);

router.route('/:id/preview')
  .get(getSchedulePreview);

router.route('/:id/eligible-animals')
  .get(getEligibleAnimals);

router.route('/:id/duplicate')
  .post(duplicateSchedule);

router.route('/:id/stats')
  .get(getScheduleStats);

module.exports = router;