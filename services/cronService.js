const cron = require('node-cron');
const Vaccination = require('../models/Vaccination');
const HealthEvent = require('../models/HealthEvent');
const Animal = require('../models/Animal');
const Reminder = require('../models/Reminder');
const Notification = require('../models/Notification');
const InventoryItem = require('../models/InventoryItem');
const BreedingEvent = require('../models/BreedingEvent');
const sendEmail = require('./emailService');
const { createNotification } = require('../controllers/notificationController');

// تحديث حالات الحظر للحيوانات
const updateAnimalRestrictions = async () => {
  console.log('جاري تحديث حالات الحظر للحيوانات...');
  
  try {
    // الحصول على جميع الحيوانات المقيدة
    const animals = await Animal.find({ 'restriction.isRestricted': true });
    
    const now = new Date();
    
    for (const animal of animals) {
      const restrictionEndDate = new Date(animal.restriction.restrictionEndDate);
      
      // إذا انتهت فترة الحظر، قم بإزالة القيود
      if (restrictionEndDate <= now) {
        animal.restriction.isRestricted = false;
        await animal.save();
        
        // إنشاء إشعار بانتهاء فترة الحظر
        await createNotification({
          userId: animal.userId,
          title: 'انتهاء فترة الحظر',
          message: `انتهت فترة الحظر للحيوان: ${animal.identificationNumber}`,
          type: 'withdrawal',
          relatedAnimalId: animal._id
        });
      }
    }
    
    console.log('تم تحديث حالات الحظر بنجاح');
  } catch (error) {
    console.error('خطأ في تحديث حالات الحظر:', error);
  }
};

// إنشاء تذكيرات للتطعيمات القادمة
const createVaccinationReminders = async () => {
  console.log('جاري إنشاء تذكيرات للتطعيمات القادمة...');
  
  try {
    const now = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(now.getDate() + 3);
    
    // البحث عن تطعيمات تستحق في خلال 3 أيام
    const upcomingVaccinations = await Vaccination.find({
      status: 'pending',
      scheduleDate: {
        $gte: now,
        $lte: threeDaysLater
      }
    }).populate('animalId');
    
    for (const vaccination of upcomingVaccinations) {
      // التحقق من عدم وجود تذكير مسبق
      const existingReminder = await Reminder.findOne({
        type: 'vaccination',
        relatedVaccinationId: vaccination._id,
        status: 'pending'
      });
      
      if (!existingReminder) {
        // إنشاء تذكير جديد
        await Reminder.create({
          type: 'vaccination',
          title: `تطعيم: ${vaccination.name}`,
          description: `موعد تطعيم للحيوان: ${vaccination.animalId.identificationNumber}`,
          dueDate: vaccination.scheduleDate,
          reminderDate: new Date(), // اليوم
          status: 'pending',
          relatedAnimalId: vaccination.animalId._id,
          relatedVaccinationId: vaccination._id,
          userId: vaccination.userId
        });
        
        // إنشاء إشعار
        await createNotification({
          userId: vaccination.userId,
          title: 'تذكير بتطعيم قادم',
          message: `موعد تطعيم ${vaccination.name} للحيوان ${vaccination.animalId.identificationNumber} في ${vaccination.scheduleDate.toLocaleDateString('ar-SA')}`,
          type: 'vaccination',
          relatedAnimalId: vaccination.animalId._id,
          relatedVaccinationId: vaccination._id
        });
      }
    }
    
    console.log('تم إنشاء تذكيرات التطعيمات بنجاح');
  } catch (error) {
    console.error('خطأ في إنشاء تذكيرات التطعيمات:', error);
  }
};

// التحقق من المخزون المنخفض
const checkLowInventory = async () => {
  console.log('جاري التحقق من المخزون المنخفض...');
  
  try {
    // جلب جميع عناصر المخزون التي لم يتم وضع علامة منخفض عليها بعد
    const inventoryItems = await InventoryItem.find({
      isLowStock: false
    });
    
    for (const item of inventoryItems) {
      // التحقق مما إذا كانت الكمية المتوفرة أقل من أو تساوي حد المخزون المنخفض
      if (item.availableQuantity <= item.lowStockThreshold) {
        // تحديث حالة المخزون المنخفض
        item.isLowStock = true;
        await item.save();
        
        // إنشاء إشعار
        await createNotification({
          userId: item.userId,
          title: 'تنبيه مخزون منخفض',
          message: `المخزون منخفض: ${item.name}. الكمية المتوفرة: ${item.availableQuantity} ${item.unit}`,
          type: 'inventory',
          relatedInventoryId: item._id
        });
      }
    }
    
    console.log('تم التحقق من المخزون المنخفض بنجاح');
  } catch (error) {
    console.error('خطأ في التحقق من المخزون المنخفض:', error);
  }
};


// التحقق من الولادات المتوقعة
const checkExpectedBirths = async () => {
  console.log('جاري التحقق من الولادات المتوقعة...');
  
  try {
    const now = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(now.getDate() + 7);
    
    // البحث عن أحداث الحمل المتوقع الولادة في خلال 7 أيام
    const upcomingBirths = await BreedingEvent.find({
      eventType: 'pregnancy',
      birthRecorded: false,
      expectedBirthDate: {
        $gte: now,
        $lte: sevenDaysLater
      }
    }).populate('femaleId');
    
    for (const event of upcomingBirths) {
      // التحقق من عدم وجود تذكير مسبق
      const existingReminder = await Reminder.findOne({
        type: 'breeding',
        relatedBreedingEventId: event._id,
        status: 'pending'
      });
      
      if (!existingReminder) {
        // إنشاء تذكير جديد
        await Reminder.create({
          type: 'breeding',
          title: 'ولادة متوقعة',
          description: `ولادة متوقعة للحيوان: ${event.femaleId.identificationNumber}`,
          dueDate: event.expectedBirthDate,
          reminderDate: new Date(), // اليوم
          status: 'pending',
          relatedAnimalId: event.femaleId._id,
          relatedBreedingEventId: event._id,
          userId: event.userId
        });
        
        // إنشاء إشعار
        await createNotification({
          userId: event.userId,
          title: 'ولادة متوقعة قريبًا',
          message: `ولادة متوقعة للحيوان ${event.femaleId.identificationNumber} في ${event.expectedBirthDate.toLocaleDateString('ar-SA')}`,
          type: 'breeding',
          relatedAnimalId: event.femaleId._id,
          relatedBreedingEventId: event._id
        });
      }
    }
    
    console.log('تم التحقق من الولادات المتوقعة بنجاح');
  } catch (error) {
    console.error('خطأ في التحقق من الولادات المتوقعة:', error);
  }
};

// جدولة المهام
// تحديث حالات الحظر - يوميًا في الساعة 00:01
cron.schedule('1 0 * * *', updateAnimalRestrictions);

// إنشاء تذكيرات التطعيمات - يوميًا في الساعة 08:00
cron.schedule('0 8 * * *', createVaccinationReminders);

// التحقق من المخزون المنخفض - يوميًا في الساعة 09:00
cron.schedule('0 9 * * *', checkLowInventory);

// التحقق من الولادات المتوقعة - يوميًا في الساعة 10:00
cron.schedule('0 10 * * *', checkExpectedBirths);

// تنفيذ المهام عند بدء تشغيل الخادم (بعد تأخير لضمان جاهزية الاتصال بقاعدة البيانات)
setTimeout(() => {
  updateAnimalRestrictions();
  createVaccinationReminders();
  checkLowInventory();
  checkExpectedBirths();
}, 5000);

module.exports = {
  updateAnimalRestrictions,
  createVaccinationReminders,
  checkLowInventory,
  checkExpectedBirths
};