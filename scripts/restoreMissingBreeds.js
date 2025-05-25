// backend/scripts/restoreMissingBreeds.js
const mongoose = require('mongoose');
const AnimalCategory = require('../models/AnimalCategory');
const AnimalBreed = require('../models/AnimalBreed');

// الاتصال بقاعدة البيانات
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI , {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('تم الاتصال بقاعدة البيانات بنجاح');
  } catch (error) {
    console.error('خطأ في الاتصال بقاعدة البيانات:', error);
    process.exit(1);
  }
};

// السلالات المفقودة للخيول
const MISSING_HORSE_BREEDS = [
  { 
    name: 'عربي', 
    description: 'سلالة عربي من الخيول - الخيل العربي الأصيل' 
  }
];

// دالة استعادة السلالات المفقودة
const restoreMissingBreeds = async () => {
  try {
    console.log('بدء عملية استعادة السلالات المفقودة...');
    
    // البحث عن جميع فئات الخيول لجميع المستخدمين
    const horseCategories = await AnimalCategory.find({ name: 'خيول' });
    
    if (horseCategories.length === 0) {
      console.log('لم يتم العثور على أي فئة خيول في قاعدة البيانات');
      return;
    }
    
    console.log(`تم العثور على ${horseCategories.length} فئة خيول`);
    
    let addedBreeds = 0;
    let existingBreeds = 0;
    
    // إضافة السلالات المفقودة لكل فئة خيول
    for (const category of horseCategories) {
      console.log(`معالجة فئة الخيول للمستخدم: ${category.userId}`);
      
      for (const breedData of MISSING_HORSE_BREEDS) {
        // التحقق من وجود السلالة
        const existingBreed = await AnimalBreed.findOne({
          name: breedData.name,
          categoryId: category._id,
          userId: category.userId
        });
        
        if (!existingBreed) {
          // إضافة السلالة المفقودة
          const newBreed = await AnimalBreed.create({
            name: breedData.name,
            description: breedData.description,
            categoryId: category._id,
            userId: category.userId
          });
          
          console.log(`✅ تمت إضافة السلالة "${breedData.name}" للمستخدم ${category.userId}`);
          addedBreeds++;
        } else {
          console.log(`⚠️ السلالة "${breedData.name}" موجودة بالفعل للمستخدم ${category.userId}`);
          existingBreeds++;
        }
      }
    }
    
    console.log('\n=== ملخص العملية ===');
    console.log(`السلالات المضافة: ${addedBreeds}`);
    console.log(`السلالات الموجودة مسبقاً: ${existingBreeds}`);
    console.log('تمت عملية الاستعادة بنجاح ✅');
    
  } catch (error) {
    console.error('حدث خطأ أثناء استعادة السلالات:', error);
  }
};

// دالة التحقق من السلالات الحالية
const checkCurrentBreeds = async () => {
  try {
    console.log('التحقق من السلالات الحالية...\n');
    
    const horseCategories = await AnimalCategory.find({ name: 'خيول' });
    
    for (const category of horseCategories) {
      console.log(`فئة الخيول للمستخدم: ${category.userId}`);
      
      const breeds = await AnimalBreed.find({ 
        categoryId: category._id 
      }).select('name description');
      
      console.log(`السلالات الموجودة (${breeds.length}):`);
      breeds.forEach(breed => {
        console.log(`  - ${breed.name}: ${breed.description}`);
      });
      console.log('---');
    }
  } catch (error) {
    console.error('خطأ في التحقق من السلالات:', error);
  }
};

// الدالة الرئيسية
const main = async () => {
  await connectDB();
  
  console.log('🔍 التحقق من السلالات الحالية...');
  await checkCurrentBreeds();
  
  console.log('\n🔄 بدء عملية الاستعادة...');
  await restoreMissingBreeds();
  
  console.log('\n🔍 التحقق من النتائج النهائية...');
  await checkCurrentBreeds();
  
  await mongoose.disconnect();
  console.log('\nتم قطع الاتصال بقاعدة البيانات');
};

// تشغيل السكريبت
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { restoreMissingBreeds, checkCurrentBreeds };