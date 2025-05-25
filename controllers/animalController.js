//backend -- controllers/animalController.js
const Animal = require('../models/Animal');
const Vaccination = require('../models/Vaccination');
const VaccinationSchedule = require('../models/VaccinationSchedule');
const HealthEvent = require('../models/HealthEvent');
const BreedingEvent = require('../models/BreedingEvent');
const AnimalCategory = require('../models/AnimalCategory');
const AnimalBreed = require('../models/AnimalBreed');
const asyncHandler = require('express-async-handler');
const cloudStorage = require('../services/cloudStorageService');
const multer = require('multer');
const path = require('path');
// @desc    الحصول على جميع الحيوانات
// @route   GET /api/animals
// @access  Private
exports.getAnimals = asyncHandler(async (req, res) => {
   console.log('Backend: Getting animals for user', req.user.id);
  let query = { userId: req.user.id };

  // إضافة فلترة حسب الطلب
  if (req.query.categoryId) {
    query.categoryId = req.query.categoryId;
  }

  if (req.query.breedId) {
    query.breedId = req.query.breedId;
  }

  if (req.query.gender) {
    query.gender = req.query.gender;
  }

  if (req.query.status) {
    query.status = req.query.status;
  }

  if (req.query.isRestricted) {
    query['restriction.isRestricted'] = req.query.isRestricted === 'true';
  }

  // البحث حسب الرقم التعريفي للحيوان
  if (req.query.identificationNumber) {
    query.identificationNumber = { $regex: req.query.identificationNumber, $options: 'i' };
  }

  // البحث حسب النطاق العمري
  if (req.query.minAge || req.query.maxAge) {
    query.birthDate = {};
    
    if (req.query.minAge) {
      const minAgeDate = new Date();
      minAgeDate.setMonth(minAgeDate.getMonth() - parseInt(req.query.minAge));
      query.birthDate.$lte = minAgeDate;
    }
    
    if (req.query.maxAge) {
      const maxAgeDate = new Date();
      maxAgeDate.setMonth(maxAgeDate.getMonth() - parseInt(req.query.maxAge));
      query.birthDate.$gte = maxAgeDate;
    }
  }

 const animals = await Animal.find(query)
    .populate('categoryId', 'name')
    .populate('breedId', 'name')
    .populate('motherId', 'identificationNumber')
    .populate('fatherId', 'identificationNumber')
    .sort({ createdAt: -1 });

  console.log('Backend: Found animals count:', animals.length);
  
  res.status(200).json({
    success: true,
    count: animals.length,
    data: animals
  });
});

// @desc    الحصول على حيوان واحد
// @route   GET /api/animals/:id
// @access  Private
exports.getAnimal = asyncHandler(async (req, res) => {
  const animal = await Animal.findOne({
    _id: req.params.id,
    userId: req.user.id
  })
    .populate('categoryId', 'name')
    .populate('breedId', 'name')
    .populate('motherId', 'identificationNumber')
    .populate('fatherId', 'identificationNumber');

  if (!animal) {
    return res.status(404).json({
      success: false,
      message: 'الحيوان غير موجود'
    });
  }

  res.status(200).json({
    success: true,
    data: animal
  });
});

// @desc    إنشاء حيوان جديد
// @route   POST /api/animals
// @access  Private
// @desc    إنشاء حيوان جديد
// @route   POST /api/animals
// @access  Private
exports.createAnimal = asyncHandler(async (req, res) => {
  try {
    // إضافة معرف المستخدم للطلب
    req.body.userId = req.user.id;

    // ترجمة النوع من العربية إلى الإنجليزية إذا لزم الأمر
    if (req.body.gender === 'ذكر') {
      req.body.gender = 'male';
    } else if (req.body.gender === 'أنثى') {
      req.body.gender = 'female';
    }
    
    // إذا لم يكن هناك اسم، استخدم رقم التعريف كاسم افتراضي
    if (!req.body.name && req.body.identificationNumber) {
      req.body.name = req.body.identificationNumber;
    }
    
    // ترجمة الحالة من العربية إلى الإنجليزية إذا لزم الأمر
    if (req.body.status === 'نشط') {
      req.body.status = 'alive';
    } else if (req.body.status === 'مباع') {
      req.body.status = 'sold';
    } else if (req.body.status === 'نافق') {
      req.body.status = 'dead';
    } else if (req.body.status === 'مذبوح') {
      req.body.status = 'slaughtered';
    }

    // التعامل مع حالة عدم وجود categoryId
    if (!req.body.categoryId && req.body.category) {
      // البحث عن الفئة بالاسم
      const category = await AnimalCategory.findOne({
        name: req.body.category,
        userId: req.user.id
      });
      
      if (category) {
        req.body.categoryId = category._id;
      } else {
        // إنشاء فئة جديدة
        const newCategory = await AnimalCategory.create({
          name: req.body.category,
          userId: req.user.id
        });
        req.body.categoryId = newCategory._id;
      }
    }

    // التعامل مع حالة عدم وجود breedId
    if (!req.body.breedId && req.body.breed && req.body.categoryId) {
      // البحث عن السلالة بالاسم والفئة
      const breed = await AnimalBreed.findOne({
        name: req.body.breed,
        categoryId: req.body.categoryId,
        userId: req.user.id
      });
      
      if (breed) {
        req.body.breedId = breed._id;
      } else {
        // إنشاء سلالة جديدة
        const newBreed = await AnimalBreed.create({
          name: req.body.breed,
          categoryId: req.body.categoryId,
          userId: req.user.id
        });
        req.body.breedId = newBreed._id;
      }
    }

    // حذف المفاتيح الزائدة
    delete req.body.category;
    delete req.body.breed;

    // ضمان وجود المتطلبات الأساسية
    if (!req.body.categoryId) {
      return res.status(400).json({
        success: false,
        message: 'الفئة مطلوبة'
      });
    }
    
    if (!req.body.breedId) {
      return res.status(400).json({
        success: false,
        message: 'السلالة مطلوبة'
      });
    }

    // إنشاء الحيوان
    const animal = await Animal.create(req.body);

    // إذا كان هناك وزن، أضفه إلى سجل الأوزان
    if (req.body.weight && req.body.weight.currentWeight) {
      animal.weight.weightHistory = [{
        weight: req.body.weight.currentWeight,
        date: new Date()
      }];
      await animal.save();
    }

    // إنشاء جدول تطعيمات تلقائي إذا كان الحيوان جديدًا
    if (req.body.birthDate && req.body.acquisitionMethod === 'birth') {
      await createVaccinationScheduleForAnimal(animal);
    }
 res.status(201).json({
      success: true,
      data: animal
    });
  } catch (error) {
    console.error('Error creating animal:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    تحديث حيوان
// @route   PUT /api/animals/:id
// @access  Private
 
exports.updateAnimal = asyncHandler(async (req, res) => {
  try {
    console.log('Updating animal with data:', req.body);
    
    // تخزين القيم القديمة للصنف والسلالة
    let animal = await Animal.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!animal) {
      return res.status(404).json({
        success: false,
        message: 'الحيوان غير موجود'
      });
    }

    const oldCategoryId = animal.categoryId;
    const oldBreedId = animal.breedId;
    
    // التحقق من وجود وزن جديد
    if (req.body.weight && req.body.weight.currentWeight && req.body.weight.currentWeight !== animal.weight?.currentWeight) {
      if (!animal.weight) {
        animal.weight = { weightHistory: [] };
      }
      if (!animal.weight.weightHistory) {
        animal.weight.weightHistory = [];
      }
      
      // إضافة الوزن الجديد إلى سجل الأوزان
      animal.weight.weightHistory.push({
        weight: req.body.weight.currentWeight,
        date: new Date()
      });
    }
    
    // معالجة الصنف والسلالة
    if (req.body.category && !req.body.categoryId) {
      // البحث عن categoryId بناءً على الاسم
      const category = await AnimalCategory.findOne({
        name: req.body.category,
        userId: req.user.id
      });
      
      if (category) {
        req.body.categoryId = category._id;
      } else {
        // إنشاء فئة جديدة
        const newCategory = await AnimalCategory.create({
          name: req.body.category,
          userId: req.user.id
        });
        req.body.categoryId = newCategory._id;
      }
    }
    
    // التعامل مع الحالة حيث يتم إرسال breed بدلاً من breedId
    if (req.body.breed && !req.body.breedId) {
      // البحث عن breedId بناءً على الاسم والفئة
      const breed = await AnimalBreed.findOne({
        name: req.body.breed,
        categoryId: req.body.categoryId || animal.categoryId,
        userId: req.user.id
      });
      
      if (breed) {
        req.body.breedId = breed._id;
      } else if (req.body.categoryId || animal.categoryId) {
        // إنشاء سلالة جديدة
        const newBreed = await AnimalBreed.create({
          name: req.body.breed,
          categoryId: req.body.categoryId || animal.categoryId,
          userId: req.user.id
        });
        req.body.breedId = newBreed._id;
      }
    }

    // تحديث الحيوان
    const updateData = { ...req.body };
    
    // تحديث الحيوان بشكل صريح
    animal = await Animal.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    })
    .populate('categoryId', 'name')
    .populate('breedId', 'name')
    .populate('motherId', 'identificationNumber')
    .populate('fatherId', 'identificationNumber');

    console.log('Updated animal:', animal);

    // بعد التحديث، تحقق مما إذا كانت الفئة القديمة أو السلالة القديمة غير مستخدمة الآن
    if (oldCategoryId && oldCategoryId.toString() !== animal.categoryId.toString()) {
      // تحقق من استخدام الفئة القديمة في حيوانات أخرى
      const otherAnimalsUsingCategory = await Animal.countDocuments({
        categoryId: oldCategoryId,
        userId: req.user.id,
        _id: { $ne: animal._id }
      });
      
      if (otherAnimalsUsingCategory === 0) {
        // لا توجد حيوانات أخرى تستخدم هذه الفئة، يمكن حذفها
        console.log(`Deleting unused category: ${oldCategoryId}`);
        await AnimalCategory.deleteOne({ _id: oldCategoryId, userId: req.user.id });
      }
    }
    
    if (oldBreedId && oldBreedId.toString() !== animal.breedId.toString()) {
      // تحقق من استخدام السلالة القديمة في حيوانات أخرى
      const otherAnimalsUsingBreed = await Animal.countDocuments({
        breedId: oldBreedId,
        userId: req.user.id,
        _id: { $ne: animal._id }
      });
      
      if (otherAnimalsUsingBreed === 0) {
        // لا توجد حيوانات أخرى تستخدم هذه السلالة، يمكن حذفها
        console.log(`Deleting unused breed: ${oldBreedId}`);
        await AnimalBreed.deleteOne({ _id: oldBreedId, userId: req.user.id });
      }
    }

    res.status(200).json({
      success: true,
      data: animal
    });
  } catch (error) {
    console.error('Error updating animal:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'حدث خطأ أثناء تحديث الحيوان'
    });
  }
});


// @desc    حذف حيوان
// @route   DELETE /api/animals/:id
// @access  Private
exports.deleteAnimal = asyncHandler(async (req, res) => {
  const animal = await Animal.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!animal) {
    return res.status(404).json({
      success: false,
      message: 'الحيوان غير موجود'
    });
  }

  // استخدم deleteOne() بدلاً من remove()
  await Promise.all([
    Vaccination.deleteMany({ animalId: animal._id }),
    HealthEvent.deleteMany({ animalId: animal._id }),
    BreedingEvent.deleteMany({ femaleId: animal._id }),
    BreedingEvent.deleteMany({ maleId: animal._id }),
    // تغيير animal.remove() إلى:
    Animal.deleteOne({ _id: animal._id })
  ]);

  res.status(200).json({
    success: true,
    data: {}
  });
});


// @desc    تحميل صورة للحيوان
// @route   PUT /api/animals/:id/photo
// @access  Private
exports.uploadAnimalPhoto = asyncHandler(async (req, res) => {
  try {
 
    
    const animal = await Animal.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!animal) {
      return res.status(404).json({
        success: false,
        message: 'الحيوان غير موجود'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'يرجى تحميل ملف'
      });
    }

    // حفظ الصورة في قاعدة البيانات
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/animal-images/${req.file.filename}`;
    
    // إضافة رابط الصورة إلى مصفوفة صور الحيوان
    if (!animal.images) {
      animal.images = [];
    }
    animal.images.push(fileUrl);
    await animal.save();

    res.status(200).json({
      success: true,
      data: animal
    });
  } catch (error) {
    console.error('Error uploading animal photo:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء رفع الصورة'
    });
  }
});




// إضافة وظيفة جديدة لحذف صورة
// @desc    حذف صورة للحيوان
// @route   DELETE /api/animals/:id/photo/:photoIndex
// @access  Private
exports.deleteAnimalPhoto = asyncHandler(async (req, res) => {
  const animal = await Animal.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!animal) {
    return res.status(404).json({
      success: false,
      message: 'الحيوان غير موجود'
    });
  }

  const photoIndex = parseInt(req.params.photoIndex);
  
  if (!animal.images || photoIndex >= animal.images.length || photoIndex < 0) {
    return res.status(404).json({
      success: false,
      message: 'الصورة غير موجودة'
    });
  }

  try {
    // استخراج URL الصورة المراد حذفها
    const imageUrl = animal.images[photoIndex];
    
    // حذف الصورة من التخزين السحابي
    await cloudStorage.deleteImage(imageUrl);
    
    // حذف الصورة من مصفوفة صور الحيوان
    animal.images.splice(photoIndex, 1);
    await animal.save();

    res.status(200).json({
      success: true,
      data: animal
    });
  } catch (error) {
    console.error('Error deleting animal photo:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء حذف الصورة'
    });
  }
});


// @desc    الحصول على سجل التطعيمات للحيوان
// @route   GET /api/animals/:id/vaccinations
// @access  Private
exports.getAnimalVaccinations = asyncHandler(async (req, res) => {
  const animal = await Animal.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!animal) {
    return res.status(404).json({
      success: false,
      message: 'الحيوان غير موجود'
    });
  }

  const vaccinations = await Vaccination.find({
    animalId: animal._id
  }).sort({ scheduleDate: 1 });

  res.status(200).json({
    success: true,
    count: vaccinations.length,
    data: vaccinations
  });
});

// @desc    الحصول على سجل الأحداث الصحية للحيوان
// @route   GET /api/animals/:id/health
// @access  Private
exports.getAnimalHealthEvents = asyncHandler(async (req, res) => {
  const animal = await Animal.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!animal) {
    return res.status(404).json({
      success: false,
      message: 'الحيوان غير موجود'
    });
  }

  const healthEvents = await HealthEvent.find({
    animalId: animal._id
  }).sort({ date: -1 });

  res.status(200).json({
    success: true,
    count: healthEvents.length,
    data: healthEvents
  });
});

// @desc    الحصول على أحداث التكاثر للحيوان
// @route   GET /api/animals/:id/breeding
// @access  Private
exports.getAnimalBreedingEvents = asyncHandler(async (req, res) => {
  const animal = await Animal.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!animal) {
    return res.status(404).json({
      success: false,
      message: 'الحيوان غير موجود'
    });
  }

  let breedingEvents;
  
  if (animal.gender === 'female') {
    // للإناث، نحصل على جميع أحداث التكاثر كأنثى
    breedingEvents = await BreedingEvent.find({
      femaleId: animal._id
    })
      .populate('maleId', 'identificationNumber')
      .sort({ date: -1 });
  } else {
    // للذكور، نحصل على جميع أحداث التكاثر كذكر
    breedingEvents = await BreedingEvent.find({
      maleId: animal._id
    })
      .populate('femaleId', 'identificationNumber')
      .sort({ date: -1 });
  }

  res.status(200).json({
    success: true,
    count: breedingEvents.length,
    data: breedingEvents
  });
});

// @desc    تحديث حالة الحظر للحيوان
// @route   PUT /api/animals/:id/restriction
// @access  Private
exports.updateAnimalRestriction = asyncHandler(async (req, res) => {
  const animal = await Animal.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!animal) {
    return res.status(404).json({
      success: false,
      message: 'الحيوان غير موجود'
    });
  }

  animal.restriction = req.body;
  await animal.save();

  res.status(200).json({
    success: true,
    data: animal
  });
});

// @desc    الحصول على نسب الحيوان
// @route   GET /api/animals/:id/pedigree
// @access  Private
exports.getAnimalPedigree = asyncHandler(async (req, res) => {
  const animal = await Animal.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!animal) {
    return res.status(404).json({
      success: false,
      message: 'الحيوان غير موجود'
    });
  }

  // بناء شجرة النسب حتى 3 أجيال
  const pedigree = await buildPedigreeTree(animal._id, 3);

  res.status(200).json({
    success: true,
    data: pedigree
  });
});

// @desc    الحصول على الحيوانات المحظورة
// @route   GET /api/animals/restricted
// @access  Private
exports.getRestrictedAnimals = asyncHandler(async (req, res) => {
  const animals = await Animal.find({
    userId: req.user.id,
    'restriction.isRestricted': true
  })
    .populate('categoryId', 'name')
    .populate('breedId', 'name')
    .sort({ 'restriction.restrictionEndDate': 1 });

  res.status(200).json({
    success: true,
    count: animals.length,
    data: animals
  });
});

// Helper function - إنشاء جدول تطعيمات تلقائي للحيوان الجديد
const createVaccinationScheduleForAnimal = async (animal) => {
  try {
    // الحصول على جدول التطعيمات للفئة
    const schedules = await VaccinationSchedule.find({
      categoryId: animal.categoryId,
      userId: animal.userId
    });

    // لكل تطعيم في الجدول، أنشئ جدولة
    const birthDate = new Date(animal.birthDate);
    const today = new Date();

    for (const schedule of schedules) {
      const scheduleDate = new Date(birthDate);
      scheduleDate.setDate(scheduleDate.getDate() + schedule.requiredAge);

      // إذا كان تاريخ التطعيم في الماضي، تخطاه
      if (scheduleDate < today && schedule.repeatInterval === 0) {
        continue;
      }

      // إذا كان التطعيم دوريًا وتاريخه في الماضي، قم بتعديل التاريخ للدورة القادمة
      if (scheduleDate < today && schedule.repeatInterval > 0) {
        const daysDiff = Math.ceil((today - scheduleDate) / (1000 * 60 * 60 * 24));
        const cycles = Math.ceil(daysDiff / schedule.repeatInterval);
        scheduleDate.setDate(scheduleDate.getDate() + (cycles * schedule.repeatInterval));
      }

      // إنشاء التطعيم
      await Vaccination.create({
        animalId: animal._id,
        name: schedule.name,
        description: schedule.description,
        scheduleDate,
        status: 'pending',
        meatWithdrawalPeriod: schedule.meatWithdrawalPeriod,
        milkWithdrawalPeriod: schedule.milkWithdrawalPeriod,
        vaccinationScheduleId: schedule._id,
        userId: animal.userId
      });
    }
  } catch (error) {
    console.error('Error creating vaccination schedule:', error);
  }
};

// Helper function - بناء شجرة النسب
const buildPedigreeTree = async (animalId, depth = 2) => {
  if (depth <= 0 || !animalId) {
    return null;
  }

  const animal = await Animal.findById(animalId)
    .select('identificationNumber gender birthDate motherId fatherId categoryId breedId');

  if (!animal) {
    return null;
  }

  // تجهيز بيانات أساسية
  const nodeData = {
    _id: animal._id,
    identificationNumber: animal.identificationNumber,
    gender: animal.gender,
    birthDate: animal.birthDate,
    categoryId: animal.categoryId,
    breedId: animal.breedId
  };

  // إضافة معلومات الأب والأم بشكل تكراري
  if (depth > 1) {
    const [mother, father] = await Promise.all([
      animal.motherId ? buildPedigreeTree(animal.motherId, depth - 1) : null,
      animal.fatherId ? buildPedigreeTree(animal.fatherId, depth - 1) : null
    ]);

    nodeData.mother = mother;
    nodeData.father = father;
  }

  return nodeData;
};