// models/Reminder.js
const mongoose = require('mongoose');

const ReminderSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['vaccination', 'health_check', 'breeding', 'withdrawal_end', 'inventory', 'other'],
    required: true
  },
  title: {
    type: String,
    required: [true, 'يرجى إدخال عنوان التذكير'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  reminderDate: {
    type: Date,
    required: true
  },
  repeat: {
    type: String,
    enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'],
    default: 'none'
  },
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  },
  relatedAnimalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal'
  },
  relatedVaccinationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vaccination'
  },
  relatedInventoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem'
  },
  notificationSent: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const Reminder = mongoose.model('Reminder', ReminderSchema);

module.exports = Reminder;