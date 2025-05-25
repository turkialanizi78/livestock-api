// routes/vaccinationScheduleRoutes.js
const express = require('express');
const {
  getVaccinationSchedules,
  getVaccinationSchedule,
  createVaccinationSchedule,
  updateVaccinationSchedule,
  deleteVaccinationSchedule,
  getCategoryVaccinationSchedules
} = require('../controllers/vaccinationScheduleController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getVaccinationSchedules)
  .post(createVaccinationSchedule);

router.route('/:id')
  .get(getVaccinationSchedule)
  .put(updateVaccinationSchedule)
  .delete(deleteVaccinationSchedule);

// جداول تطعيم فئة معينة
router.get('/category/:categoryId', getCategoryVaccinationSchedules);

module.exports = router;