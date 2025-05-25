// models/index.js
const User = require('./User');
const AnimalCategory = require('./AnimalCategory');
const AnimalBreed = require('./AnimalBreed');
const Animal = require('./Animal');
const VaccinationSchedule = require('./VaccinationSchedule');
const Vaccination = require('./Vaccination');
const HealthEvent = require('./HealthEvent');
const BreedingEvent = require('./BreedingEvent');
const Birth = require('./Birth');
const Transaction = require('./Transaction');
const FinancialRecord = require('./FinancialRecord');
const InventoryItem = require('./InventoryItem');
const InventoryTransaction = require('./InventoryTransaction');
const Reminder = require('./Reminder');
const DefaultWithdrawalPeriod = require('./DefaultWithdrawalPeriod');
const Notification = require('./Notification');
const SavedReport = require('./SavedReport');
const Backup = require('./Backup');
// النماذج الجديدة للتغذية والمعدات
const FeedingRecord = require('./FeedingRecord');
const FeedingSchedule = require('./FeedingSchedule');
const EquipmentUsage = require('./EquipmentUsage');
const FeedCalculationTemplate = require('./FeedCalculationTemplate');

module.exports = {
  User,
  AnimalCategory,
  AnimalBreed,
  Animal,
  VaccinationSchedule,
  Vaccination,
  HealthEvent,
  BreedingEvent,
  Birth,
  Transaction,
  FinancialRecord,
  InventoryItem,
  InventoryTransaction,
  Reminder,
  DefaultWithdrawalPeriod,
  Notification,
  SavedReport,
  Backup,
  // النماذج الجديدة
  FeedingRecord,
  FeedingSchedule,
  EquipmentUsage,
  FeedCalculationTemplate
};