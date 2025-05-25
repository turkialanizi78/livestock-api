// routes/notificationRoutes.js
const express = require('express');
const {
  getNotifications,
  getNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteReadNotifications,
  getUnreadCount
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getNotifications);

router.route('/:id')
  .get(getNotification)
  .delete(deleteNotification);

router.route('/:id/read')
  .put(markAsRead);

router.route('/read-all')
  .put(markAllAsRead);

router.route('/read')
  .delete(deleteReadNotifications);

router.route('/unread-count')
  .get(getUnreadCount);

module.exports = router;