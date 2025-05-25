//backend -- models/AnimalBreed.js
const mongoose = require('mongoose');

const AnimalBreedSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'يرجى إدخال اسم السلالة'],
    trim: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnimalCategory',
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  image: {
    type: String
  },
  characteristics: {
    type: String
  },
  adultWeight: {
    male: { type: Number }, // بالكيلوغرام
    female: { type: Number } // بالكيلوغرام
  },
  expectedProduction: {
    milk: { type: Number }, // لتر/يوم
    wool: { type: Number }, // كجم/سنة
    meat: { type: Number } // كجم
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

// إنشاء فهرس مركب للتأكد من فريدية كل سلالة لكل فئة ومستخدم
AnimalBreedSchema.index({ name: 1, categoryId: 1, userId: 1 }, { unique: true });

const AnimalBreed = mongoose.model('AnimalBreed', AnimalBreedSchema);

module.exports = AnimalBreed;