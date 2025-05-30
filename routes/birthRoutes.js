// routes/birthRoutes.js
const express = require('express');
const {
  getBirths,
  getBirth,
  createBirth,
  updateBirth,
  deleteBirth,
  registerOffspring,
  getBirthStatistics,
  getExpectedBirths
} = require('../controllers/birthController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getBirths)
  .post(createBirth);

router.route('/statistics')
  .get(getBirthStatistics);

router.route('/expected')
  .get(getExpectedBirths);

router.route('/:id')
  .get(getBirth)
  .put(updateBirth)
  .delete(deleteBirth);

router.route('/:id/register-offspring')
  .post(registerOffspring);

module.exports = router;