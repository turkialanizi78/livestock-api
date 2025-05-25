// routes/inventoryTransactionRoutes.js
const express = require('express');
const {
  updateInventoryTransaction,
  deleteInventoryTransaction
} = require('../controllers/inventoryController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/:id')
  .put(updateInventoryTransaction)
  .delete(deleteInventoryTransaction);

module.exports = router;