//backend -- models/Animal.js
const mongoose = require('mongoose');

const AnimalSchema = new mongoose.Schema({
  identificationNumber: {
    type: String,
    required: [true, 'يرجى إدخال رقم التعريف'],
    trim: true
   },
  name: {
    type: String,
    trim: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnimalCategory',
    required: true
  },
  breedId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnimalBreed',
    required: true
  },
  birthDate: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    required: true
  },
  color: {
    type: String,
    trim: true
  },
  weight: {
    birthWeight: { type: Number }, // بالكيلوغرام
    currentWeight: { type: Number }, // بالكيلوغرام
    weightHistory: [{
      weight: { type: Number },
      date: { type: Date, default: Date.now }
    }]
  },
  images: [{
    type: String
  }],
  distinctiveMarks: {
    type: String,
    trim: true
  },
  motherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal'
  },
  fatherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal'
  },
  acquisitionDate: {
    type: Date
  },
  acquisitionMethod: {
    type: String,
    enum: ['birth', 'purchase'],
    default: 'birth'
  },
  status: {
    type: String,
    enum: ['alive', 'sold', 'dead', 'slaughtered'],
    default: 'alive'
  },
  chipId: {
    type: String,
    trim: true
  },
  price: {
    purchasePrice: { type: Number },
    currentEstimatedValue: { type: Number }
  },
  quarantineInfo: {
    type: String,
    trim: true
  },
  notes: {
    type: String
  },
  restriction: {
    isRestricted: { type: Boolean, default: false },
    reason: { type: String, enum: ['vaccination', 'treatment', 'other'] },
    restrictionEndDate: { type: Date },
    notes: { type: String }
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

// إنشاء فهرس مركب للتأكد من فريدية رقم التعريف لكل مستخدم
AnimalSchema.index({ identificationNumber: 1, userId: 1 }, { unique: true });

// دالة مساعدة للتحقق من حالة الحظر
AnimalSchema.methods.checkRestrictionStatus = function() {
  if (!this.restriction.isRestricted) return false;
  
  const now = new Date();
  const endDate = new Date(this.restriction.restrictionEndDate);
  
  if (endDate <= now) {
    // انتهت فترة الحظر
    this.restriction.isRestricted = false;
    return false;
  }
  
  return true;
};

const Animal = mongoose.model('Animal', AnimalSchema);

module.exports = Animal;