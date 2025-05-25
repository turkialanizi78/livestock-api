// routes/financialRecordRoutes.js
const express = require('express');
const {
  getFinancialRecords,
  getFinancialRecord,
  createFinancialRecord,
  updateFinancialRecord,
  deleteFinancialRecord,
  getFinancialSummary
} = require('../controllers/financialRecordController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getFinancialRecords)
  .post(createFinancialRecord);

router.route('/:id')
  .get(getFinancialRecord)
  .put(updateFinancialRecord)
  .delete(deleteFinancialRecord);

router.route('/summary')
  .get(getFinancialSummary);

module.exports = router;