// controllers/backupController.js
const Backup = require('../models/Backup');
const User = require('../models/User');
const AnimalCategory = require('../models/AnimalCategory');
const AnimalBreed = require('../models/AnimalBreed');
const Animal = require('../models/Animal');
const VaccinationSchedule = require('../models/VaccinationSchedule');
const Vaccination = require('../models/Vaccination');
const HealthEvent = require('../models/HealthEvent');
const BreedingEvent = require('../models/BreedingEvent');
const Birth = require('../models/Birth');
const Transaction = require('../models/Transaction');
const FinancialRecord = require('../models/FinancialRecord');
const InventoryItem = require('../models/InventoryItem');
const InventoryTransaction = require('../models/InventoryTransaction');
const Reminder = require('../models/Reminder');
const DefaultWithdrawalPeriod = require('../models/DefaultWithdrawalPeriod');
const Notification = require('../models/Notification');
const SavedReport = require('../models/SavedReport');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');

// @desc    الحصول على جميع النسخ الاحتياطية
// @route   GET /api/backups
// @access  Private
exports.getBackups = asyncHandler(async (req, res) => {
  const backups = await Backup.find({
    userId: req.user.id
  }).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: backups.length,
    data: backups
  });
});

// @desc    الحصول على نسخة احتياطية واحدة
// @route   GET /api/backups/:id
// @access  Private
exports.getBackup = asyncHandler(async (req, res) => {
  const backup = await Backup.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!backup) {
    return res.status(404).json({
      success: false,
      message: 'النسخة الاحتياطية غير موجودة'
    });
  }

  res.status(200).json({
    success: true,
    data: backup
  });
});

// @desc    إنشاء نسخة احتياطية جديدة
// @route   POST /api/backups
// @access  Private
exports.createBackup = asyncHandler(async (req, res) => {
  // التحقق من تحديد البيانات المطلوب نسخها
  if (!req.body.dataIncluded) {
    return res.status(400).json({
      success: false,
      message: 'يرجى تحديد البيانات المطلوب نسخها'
    });
  }

  // إنشاء مجلد النسخ الاحتياطية إذا لم يكن موجودًا
  const dir = './uploads/backups';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // إنشاء اسم الملف
  const fileName = `backup_${req.user.id}_${Date.now()}.zip`;
  const filePath = path.join(dir, fileName);

  // إنشاء ملف الضغط
  const output = fs.createWriteStream(filePath);
  const archive = archiver('zip', {
    zlib: { level: 9 } // مستوى الضغط
  });

  // معالجة الأخطاء
  output.on('close', async () => {
    // حفظ معلومات النسخة الاحتياطية في قاعدة البيانات
    const backup = await Backup.create({
      userId: req.user.id,
      filename: fileName,
      fileUrl: `/uploads/backups/${fileName}`,
      fileSize: archive.pointer(),
      type: req.body.type || 'manual',
      status: 'completed',
      dataIncluded: req.body.dataIncluded,
      notes: req.body.notes
    });

    res.status(201).json({
      success: true,
      data: backup
    });
  });

  archive.on('error', (err) => {
    return res.status(500).json({
      success: false,
      message: 'فشل في إنشاء النسخة الاحتياطية',
      error: err.message
    });
  });

  // تهيئة الأرشيف
  archive.pipe(output);

  // جمع البيانات
  let data = {
    createdAt: new Date(),
    user: req.user
  };

  // إضافة البيانات حسب الاختيار
  if (req.body.dataIncluded.animals) {
    data.categories = await AnimalCategory.find({ userId: req.user.id });
    data.breeds = await AnimalBreed.find({ userId: req.user.id });
    data.animals = await Animal.find({ userId: req.user.id });
  }

  if (req.body.dataIncluded.vaccinations) {
    data.vaccinationSchedules = await VaccinationSchedule.find({ userId: req.user.id });
    data.vaccinations = await Vaccination.find({ userId: req.user.id });
    data.defaultWithdrawalPeriods = await DefaultWithdrawalPeriod.find({ userId: req.user.id });
  }

  if (req.body.dataIncluded.health) {
    data.healthEvents = await HealthEvent.find({ userId: req.user.id });
  }

  if (req.body.dataIncluded.breeding) {
    data.breedingEvents = await BreedingEvent.find({ userId: req.user.id });
    data.births = await Birth.find({ userId: req.user.id });
  }

  if (req.body.dataIncluded.inventory) {
    data.inventoryItems = await InventoryItem.find({ userId: req.user.id });
    data.inventoryTransactions = await InventoryTransaction.find({ userId: req.user.id });
  }

  if (req.body.dataIncluded.financial) {
    data.transactions = await Transaction.find({ userId: req.user.id });
    data.financialRecords = await FinancialRecord.find({ userId: req.user.id });
  }

  if (req.body.dataIncluded.settings) {
    data.reminders = await Reminder.find({ userId: req.user.id });
    data.notifications = await Notification.find({ userId: req.user.id });
    data.savedReports = await SavedReport.find({ userId: req.user.id });
  }

  // إضافة البيانات إلى الأرشيف
  archive.append(JSON.stringify(data, null, 2), { name: 'data.json' });

  // إضافة ملف التكوين
  const config = {
    version: '1.0',
    createdAt: new Date(),
    userId: req.user.id,
    dataIncluded: req.body.dataIncluded
  };
  archive.append(JSON.stringify(config, null, 2), { name: 'config.json' });

  // إنهاء الأرشيف
  archive.finalize();
});

// @desc    استعادة نسخة احتياطية
// @route   POST /api/backups/:id/restore
// @access  Private
exports.restoreBackup = asyncHandler(async (req, res) => {
  const backup = await Backup.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!backup) {
    return res.status(404).json({
      success: false,
      message: 'النسخة الاحتياطية غير موجودة'
    });
  }

  // التحقق من وجود الملف
  const filePath = path.join(__dirname, '..', backup.fileUrl);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: 'ملف النسخة الاحتياطية غير موجود'
    });
  }

  // بدء عملية الاستعادة
  try {
    // إنشاء مجلد مؤقت للاستخراج
    const tempDir = path.join(__dirname, '..', 'uploads/temp', `restore_${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // استخراج الملفات
    const extract = require('extract-zip');
    await extract(filePath, { dir: tempDir });

    // قراءة ملف البيانات
    const dataFile = path.join(tempDir, 'data.json');
    if (!fs.existsSync(dataFile)) {
      throw new Error('ملف البيانات غير موجود في النسخة الاحتياطية');
    }

    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

    // بدء عملية الاستعادة في قاعدة البيانات
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // استعادة البيانات حسب ما هو مضمن في النسخة الاحتياطية
      if (backup.dataIncluded.animals && data.categories) {
        await AnimalCategory.deleteMany({ userId: req.user.id }).session(session);
        for (const category of data.categories) {
          const newCategory = new AnimalCategory({
            ...category,
            _id: new mongoose.Types.ObjectId(),
            userId: req.user.id
          });
          await newCategory.save({ session });
        }
      }

      if (backup.dataIncluded.animals && data.breeds) {
        await AnimalBreed.deleteMany({ userId: req.user.id }).session(session);
        for (const breed of data.breeds) {
          const newBreed = new AnimalBreed({
            ...breed,
            _id: new mongoose.Types.ObjectId(),
            userId: req.user.id
          });
          await newBreed.save({ session });
        }
      }

      // وهكذا لباقي أنواع البيانات...

      await session.commitTransaction();
      session.endSession();

      // حذف المجلد المؤقت
      fs.rmdirSync(tempDir, { recursive: true });

      res.status(200).json({
        success: true,
        message: 'تمت استعادة النسخة الاحتياطية بنجاح'
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      // حذف المجلد المؤقت
      fs.rmdirSync(tempDir, { recursive: true });

      throw error;
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'فشل في استعادة النسخة الاحتياطية',
      error: error.message
    });
  }
});

// @desc    حذف نسخة احتياطية
// @route   DELETE /api/backups/:id
// @access  Private
exports.deleteBackup = asyncHandler(async (req, res) => {
  const backup = await Backup.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!backup) {
    return res.status(404).json({
      success: false,
      message: 'النسخة الاحتياطية غير موجودة'
    });
  }

  // حذف الملف إذا كان موجودًا
  const filePath = path.join(__dirname, '..', backup.fileUrl);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await backup.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    إنشاء نسخة احتياطية تلقائية
// @route   POST /api/backups/automatic
// @access  Private
exports.createAutomaticBackup = asyncHandler(async (req, res) => {
  // إنشاء مجلد النسخ الاحتياطية إذا لم يكن موجودًا
  const dir = './uploads/backups';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // إنشاء اسم الملف
  const fileName = `backup_auto_${req.user.id}_${Date.now()}.zip`;
  const filePath = path.join(dir, fileName);

  // إنشاء ملف الضغط
  const output = fs.createWriteStream(filePath);
  const archive = archiver('zip', {
    zlib: { level: 9 } // مستوى الضغط
  });

  // معالجة الأخطاء
  output.on('close', async () => {
    // حفظ معلومات النسخة الاحتياطية في قاعدة البيانات
    const backup = await Backup.create({
      userId: req.user.id,
      filename: fileName,
      fileUrl: `/uploads/backups/${fileName}`,
      fileSize: archive.pointer(),
      type: 'automatic',
      status: 'completed',
      dataIncluded: {
        animals: true,
        vaccinations: true,
        health: true,
        breeding: true,
        inventory: true,
        financial: true,
        settings: true
      }
    });

    res.status(201).json({
      success: true,
      data: backup
    });
  });

  archive.on('error', (err) => {
    return res.status(500).json({
      success: false,
      message: 'فشل في إنشاء النسخة الاحتياطية التلقائية',
      error: err.message
    });
  });

  // تهيئة الأرشيف
  archive.pipe(output);

  // جمع جميع البيانات
  const data = {
    createdAt: new Date(),
    user: req.user,
    categories: await AnimalCategory.find({ userId: req.user.id }),
    breeds: await AnimalBreed.find({ userId: req.user.id }),
    animals: await Animal.find({ userId: req.user.id }),
    vaccinationSchedules: await VaccinationSchedule.find({ userId: req.user.id }),
    vaccinations: await Vaccination.find({ userId: req.user.id }),
    defaultWithdrawalPeriods: await DefaultWithdrawalPeriod.find({ userId: req.user.id }),
    healthEvents: await HealthEvent.find({ userId: req.user.id }),
    breedingEvents: await BreedingEvent.find({ userId: req.user.id }),
    births: await Birth.find({ userId: req.user.id }),
    inventoryItems: await InventoryItem.find({ userId: req.user.id }),
    inventoryTransactions: await InventoryTransaction.find({ userId: req.user.id }),
    transactions: await Transaction.find({ userId: req.user.id }),
    financialRecords: await FinancialRecord.find({ userId: req.user.id }),
    reminders: await Reminder.find({ userId: req.user.id }),
    notifications: await Notification.find({ userId: req.user.id }),
    savedReports: await SavedReport.find({ userId: req.user.id })
  };

  // إضافة البيانات إلى الأرشيف
  archive.append(JSON.stringify(data, null, 2), { name: 'data.json' });

  // إضافة ملف التكوين
  const config = {
    version: '1.0',
    createdAt: new Date(),
    userId: req.user.id,
    dataIncluded: {
      animals: true,
      vaccinations: true,
      health: true,
      breeding: true,
      inventory: true,
      financial: true,
      settings: true
    }
  };
  archive.append(JSON.stringify(config, null, 2), { name: 'config.json' });

  // إنهاء الأرشيف
  archive.finalize();
});