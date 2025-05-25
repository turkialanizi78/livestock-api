// models/SavedReport.js
const mongoose = require('mongoose');

const SavedReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'يرجى إدخال اسم التقرير'],
    trim: true
  },
  type: {
    type: String,
    enum: [
      'animalDistribution', 
      'healthVaccination', 
      'breeding', 
      'financial', 
      'restrictedAnimals', 
      'withdrawalPredictions',
      'custom'
    ],
    required: true
  },
  parameters: {
    type: mongoose.Schema.Types.Mixed
  },
  dateRange: {
    startDate: { type: Date },
    endDate: { type: Date }
  },
  filterCriteria: {
    type: mongoose.Schema.Types.Mixed
  },
  isScheduled: {
    type: Boolean,
    default: false
  },
  scheduleFrequency: {
    type: String,
    enum: ['none', 'daily', 'weekly', 'monthly'],
    default: 'none'
  },
  lastGenerated: {
    type: Date
  },
  generatedFileUrl: {
    type: String
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const SavedReport = mongoose.model('SavedReport', SavedReportSchema);

module.exports = SavedReport;