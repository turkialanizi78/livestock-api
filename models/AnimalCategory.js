const mongoose = require('mongoose');

const AnimalCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'يرجى إدخال اسم الفئة'],
    trim: true
    // إزالة unique: true
  },
  description: {
    type: String,
    trim: true
  },
  image: {
    type: String
  },
  pregnancyPeriod: {
    type: Number, // بالأيام
    default: 0
  },
  maturityAge: {
    type: Number, // بالشهور
    default: 0
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

// إضافة فهرس مركب للتأكد من فريدية كل فئة لكل مستخدم
AnimalCategorySchema.index({ name: 1, userId: 1 }, { unique: true });

const AnimalCategory = mongoose.model('AnimalCategory', AnimalCategorySchema);

module.exports = AnimalCategory;