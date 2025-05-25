// backend/routes/feedCalculationRoutes.js
const express = require('express');
const {
  getFeedTemplates,
  getFeedTemplate,
  createFeedTemplate,
  updateFeedTemplate,
  deleteFeedTemplate,
  testTemplate,
  calculateFeedForAnimals,
  getTemplatesByCategory,
  duplicateTemplate,
  getDefaultTemplates,
  importTemplate,
  exportTemplate
} = require('../controllers/feedCalculationController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// حماية جميع المسارات
router.use(protect);

// المسارات الأساسية
router.route('/')
  .get(getFeedTemplates)
  .post(createFeedTemplate);

router.route('/defaults')
  .get(getDefaultTemplates);

router.route('/by-category/:categoryId')
  .get(getTemplatesByCategory);

router.route('/calculate')
  .post(calculateFeedForAnimals);

router.route('/:id')
  .get(getFeedTemplate)
  .put(updateFeedTemplate)
  .delete(deleteFeedTemplate);

router.route('/:id/test')
  .post(testTemplate);

router.route('/:id/duplicate')
  .post(duplicateTemplate);

router.route('/:id/export')
  .get(exportTemplate);

router.route('/import')
  .post(importTemplate);

module.exports = router;