// routes/defaultWithdrawalPeriodRoutes.js
const express = require('express');
const {
  getDefaultWithdrawalPeriods,
  getDefaultWithdrawalPeriod,
  createDefaultWithdrawalPeriod,
  updateDefaultWithdrawalPeriod,
  deleteDefaultWithdrawalPeriod,
  getCategoryDefaultWithdrawalPeriods
} = require('../controllers/defaultWithdrawalPeriodController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getDefaultWithdrawalPeriods)
  .post(createDefaultWithdrawalPeriod);

router.route('/:id')
  .get(getDefaultWithdrawalPeriod)
  .put(updateDefaultWithdrawalPeriod)
  .delete(deleteDefaultWithdrawalPeriod);

router.route('/category/:categoryId')
  .get(getCategoryDefaultWithdrawalPeriods);

module.exports = router;