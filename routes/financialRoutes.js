const express = require('express');
const router = express.Router();
const {
  getAllFinancialRecords,
  getFinancialSummary,
  getFinancialRecord,
  createFinancialRecord,
  updateFinancialRecord,
  deleteFinancialRecord
} = require('../controllers/financialController');
const auth = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Get financial summary (place before /:id to avoid conflicts)
router.get('/summary', getFinancialSummary);

// Get all financial records
router.get('/', getAllFinancialRecords);

// Get single financial record
router.get('/:id', getFinancialRecord);

// Create new financial record
router.post('/', createFinancialRecord);

// Update financial record
router.put('/:id', updateFinancialRecord);

// Delete financial record
router.delete('/:id', deleteFinancialRecord);

module.exports = router;