// routes/breedingEventRoutes.js
const express = require('express');
const {
  getBreedingEvents,
  getBreedingEvent,
  createBreedingEvent,
  updateBreedingEvent,
  deleteBreedingEvent,
  getExpectedBirths,
  recordBirth
} = require('../controllers/breedingEventController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getBreedingEvents)
  .post(createBreedingEvent);

router.route('/:id')
  .get(getBreedingEvent)
  .put(updateBreedingEvent)
  .delete(deleteBreedingEvent);

router.route('/expected-births')
  .get(getExpectedBirths);

router.route('/:id/record-birth')
  .post(recordBirth);

module.exports = router;