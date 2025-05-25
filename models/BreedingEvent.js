// models/BreedingEvent.js
const mongoose = require('mongoose');

const BreedingEventSchema = new mongoose.Schema({
  eventType: {
    type: String,
    enum: ['mating', 'pregnancy', 'birth', 'abortion'],
    required: true
  },
  femaleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal',
    required: true
  },
  maleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal'
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  expectedBirthDate: {
    type: Date
  },
  birthRecorded: {
    type: Boolean,
    default: false
  },
  birthId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Birth'
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

// حساب تاريخ الولادة المتوقع عند إضافة حدث حمل
BreedingEventSchema.pre('save', async function(next) {
  if (this.eventType === 'pregnancy' && !this.expectedBirthDate) {
    try {
      // جلب معلومات الفئة للحصول على فترة الحمل
      const Animal = mongoose.model('Animal');
      const AnimalCategory = mongoose.model('AnimalCategory');
      
      const animal = await Animal.findById(this.femaleId);
      if (animal) {
        const category = await AnimalCategory.findById(animal.categoryId);
        if (category && category.pregnancyPeriod > 0) {
          const eventDate = new Date(this.date);
          this.expectedBirthDate = new Date(eventDate.setDate(eventDate.getDate() + category.pregnancyPeriod));
        }
      }
    } catch (err) {
      // في حالة فشل جلب المعلومات، نستمر بدون تحديد تاريخ متوقع
      console.error('Error calculating expected birth date:', err);
    }
  }
  next();
});

const BreedingEvent = mongoose.model('BreedingEvent', BreedingEventSchema);

module.exports = BreedingEvent;