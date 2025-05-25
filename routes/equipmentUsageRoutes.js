// backend/routes/equipmentUsageRoutes.js
const express = require('express');
const {
  getEquipmentUsages,
  getEquipmentUsage,
  createEquipmentUsage,
  updateEquipmentUsage,
  deleteEquipmentUsage,
  getUsageByEquipment,
  getUsageByAnimal,
  getUsageByOperation,
  getUsageStats,
  returnEquipmentToInventory,
  getEquipmentConditionReport,
  uploadUsageImages
} = require('../controllers/equipmentUsageController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// حماية جميع المسارات
router.use(protect);

// المسارات الأساسية
router.route('/')
  .get(getEquipmentUsages)
  .post(createEquipmentUsage);

router.route('/stats')
  .get(getUsageStats);

router.route('/condition-report')
  .get(getEquipmentConditionReport);

router.route('/by-equipment/:equipmentId')
  .get(getUsageByEquipment);

router.route('/by-animal/:animalId')
  .get(getUsageByAnimal);

router.route('/by-operation/:operationType')
  .get(getUsageByOperation);

router.route('/:id')
  .get(getEquipmentUsage)
  .put(updateEquipmentUsage)
  .delete(deleteEquipmentUsage);

router.route('/:id/return-equipment')
  .post(returnEquipmentToInventory);

router.route('/:id/images')
  .post(upload.array('images', 10), uploadUsageImages);

module.exports = router;