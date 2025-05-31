// routes/weightRecordRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getWeightRecords,
  getWeightRecord,
  createWeightRecord,
  updateWeightRecord,
  deleteWeightRecord,
  getWeightStats,
  compareWeights
} = require('../controllers/weightRecordController');

// حماية جميع المسارات
router.use(protect);

// مسارات خاصة
router.get('/stats/:animalId', getWeightStats);
router.get('/compare', compareWeights);

// المسارات الأساسية
router.route('/')
  .get(getWeightRecords)
  .post(createWeightRecord);

router.route('/:id')
  .get(getWeightRecord)
  .put(updateWeightRecord)
  .delete(deleteWeightRecord);

module.exports = router;