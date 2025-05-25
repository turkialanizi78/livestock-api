// routes/vaccinationRoutes.js
const express = require('express');
const {
  getVaccinations,
  getVaccination,
  createVaccination,
  updateVaccination,
  deleteVaccination,
  completeVaccination,
  getUpcomingVaccinations
} = require('../controllers/vaccinationController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getVaccinations)
  .post(createVaccination);

router.route('/:id')
  .get(getVaccination)
  .put(updateVaccination)
  .delete(deleteVaccination);

router.route('/:id/complete')
  .put(completeVaccination);

router.route('/upcoming')
  .get(getUpcomingVaccinations);

module.exports = router;