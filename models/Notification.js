// models/Notification.js
const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'يرجى إدخال عنوان الإشعار'],
    trim: true
  },
  message: {
    type: String,
    required: [true, 'يرجى إدخال محتوى الإشعار'],
    trim: true
  },
  type: {
    type: String,
    enum: ['vaccination', 'health', 'breeding', 'inventory', 'withdrawal', 'system'],
    default: 'system'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  relatedAnimalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal'
  },
  relatedVaccinationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vaccination'
  },
  relatedHealthEventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HealthEvent'
  },
  relatedBreedingEventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BreedingEvent'
  },
  relatedInventoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem'
  },
  link: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const Notification = mongoose.model('Notification', NotificationSchema);

module.exports = Notification;