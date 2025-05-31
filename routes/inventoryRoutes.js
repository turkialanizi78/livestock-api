// routes/inventoryRoutes.js
const express = require('express');
const {
  getInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  addToInventory,
  useFromInventory,
  getItemTransactions,
  getLowStockItems,
  getExpiringItems
} = require('../controllers/inventoryController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// يجب وضع المسارات الثابتة قبل المسارات الديناميكية
router.route('/low-stock')
  .get(getLowStockItems);

router.route('/expiring')
  .get(getExpiringItems);

router.route('/')
  .get(getInventoryItems)
  .post(createInventoryItem);

router.route('/:id')
  .get(getInventoryItem)
  .put(updateInventoryItem)
  .delete(deleteInventoryItem);

router.route('/:id/add')
  .post(addToInventory);

router.route('/:id/use')
  .post(useFromInventory);

router.route('/:id/transactions')
  .get(getItemTransactions);


 

module.exports = router;