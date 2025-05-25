// routes/healthEventRoutes.js
const express = require('express');
const {
  getHealthEvents,
  getHealthEvent,
  createHealthEvent,
  updateHealthEvent,
  deleteHealthEvent
} = require('../controllers/healthEventController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getHealthEvents)
  .post(createHealthEvent);

router.route('/:id')
  .get(getHealthEvent)
  .put(updateHealthEvent)
  .delete(deleteHealthEvent);

module.exports = router;