// models/Backup.js
const mongoose = require('mongoose');

const BackupSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number, // بالبايت
    required: true
  },
  type: {
    type: String,
    enum: ['manual', 'automatic'],
    default: 'manual'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  dataIncluded: {
    animals: { type: Boolean, default: true },
    vaccinations: { type: Boolean, default: true },
    health: { type: Boolean, default: true },
    breeding: { type: Boolean, default: true },
    inventory: { type: Boolean, default: true },
    financial: { type: Boolean, default: true },
    settings: { type: Boolean, default: true }
  },
  notes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const Backup = mongoose.model('Backup', BackupSchema);

module.exports = Backup;