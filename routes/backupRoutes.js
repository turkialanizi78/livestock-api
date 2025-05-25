// routes/backupRoutes.js
const express = require('express');
const {
  getBackups,
  getBackup,
  createBackup,
  deleteBackup,
  restoreBackup,
  createAutomaticBackup
} = require('../controllers/backupController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getBackups)
  .post(createBackup);

router.route('/:id')
  .get(getBackup)
  .delete(deleteBackup);

router.route('/:id/restore')
  .post(restoreBackup);

router.route('/automatic')
  .post(createAutomaticBackup);

module.exports = router;