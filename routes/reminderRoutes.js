// routes/reminderRoutes.js
const express = require('express');
const {
  getReminders,
  getReminder,
  createReminder,
  updateReminder,
  deleteReminder,
  completeReminder,
  getUpcomingReminders,
  getOverdueReminders
} = require('../controllers/reminderController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getReminders)
  .post(createReminder);

router.route('/:id')
  .get(getReminder)
  .put(updateReminder)
  .delete(deleteReminder);

router.route('/:id/complete')
  .put(completeReminder);

router.route('/upcoming')
  .get(getUpcomingReminders);

router.route('/overdue')
  .get(getOverdueReminders);

module.exports = router;