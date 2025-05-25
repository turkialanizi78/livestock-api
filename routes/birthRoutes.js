// routes/birthRoutes.js
const express = require('express');
const {
  getBirths,
  getBirth,
  updateBirth,
  deleteBirth,
  registerOffspring
} = require('../controllers/birthController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getBirths);

router.route('/:id')
  .get(getBirth)
  .put(updateBirth)
  .delete(deleteBirth);

router.route('/:id/register-offspring')
  .post(registerOffspring);

module.exports = router;