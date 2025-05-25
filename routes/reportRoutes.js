//bakend  --  routes/reportRoutes.js
const express = require('express');
const {
  getSavedReports,
  getSavedReport,
  saveReport,
  updateSavedReport,
  deleteSavedReport,
  getAnimalsDistributionReport,
  getHealthVaccinationReport,
  getBreedingReport,
  getRestrictedAnimalsReport,
  getFinancialReport,
  exportToPDF,
  exportToExcel
} = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/saved')
  .get(getSavedReports)
  .post(saveReport);

router.route('/saved/:id')
  .get(getSavedReport)
  .put(updateSavedReport)
  .delete(deleteSavedReport);

router.route('/animals-distribution')
  .get(getAnimalsDistributionReport);

router.route('/health-vaccination')
  .get(getHealthVaccinationReport);

router.route('/breeding')
  .get(getBreedingReport);

router.route('/restricted-animals')
  .get(getRestrictedAnimalsReport);

router.route('/financial')
  .get(getFinancialReport);

router.route('/export/pdf')
  .post(exportToPDF);

router.route('/export/excel')
  .post(exportToExcel);

module.exports = router;