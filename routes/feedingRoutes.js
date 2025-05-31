// backend/routes/feedingRoutes.js
const express = require('express');
const {
  getFeedingRecords,
  getFeedingRecord,
  createFeedingRecord,
  updateFeedingRecord,
  deleteFeedingRecord,
  calculateFeedAmount,
  getFeedingStats,
  getFeedingByDate,
  getFeedingByAnimal,
  bulkCreateFeedingRecords,
  calculateFeedingCosts,
  getFeedingHistoryByAnimal,
  batchCreateFeedingRecords
} = require('../controllers/feedingController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// حماية جميع المسارات
router.use(protect);

// المسارات الأساسية
router.route('/')
  .get(getFeedingRecords)
  .post(createFeedingRecord);

router.route('/bulk')
  .post(bulkCreateFeedingRecords);

router.route('/batch')
  .post(batchCreateFeedingRecords);

router.route('/calculate')
  .post(calculateFeedAmount);

router.route('/stats')
  .get(getFeedingStats);

router.route('/costs')
  .get(calculateFeedingCosts);

router.route('/by-date')
  .get(getFeedingByDate);

router.route('/by-animal/:animalId')
  .get(getFeedingByAnimal);

router.route('/history/animal/:animalId')
  .get(getFeedingHistoryByAnimal);

router.route('/:id')
  .get(getFeedingRecord)
  .put(updateFeedingRecord)
  .delete(deleteFeedingRecord);

module.exports = router;