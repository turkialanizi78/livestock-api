// مؤقت للتشخيص - backend/debug-routes.js
console.log('=== تشخيص المشكلة ===');

try {
  console.log('1. تحقق من middleware/upload...');
  const upload = require('./middleware/upload');
  console.log('   upload type:', typeof upload);
  console.log('   upload.single type:', typeof upload.single);
  if (upload.single) {
    console.log('   upload.single("file") type:', typeof upload.single('file'));
  }
} catch (error) {
  console.log('❌ خطأ في upload:', error.message);
}

try {
  console.log('\n2. تحقق من animalController...');
  const controller = require('./controllers/animalController');
  console.log('   Controller exports:', Object.keys(controller));
  console.log('   uploadAnimalPhoto type:', typeof controller.uploadAnimalPhoto);
  console.log('   updateAnimalRestriction type:', typeof controller.updateAnimalRestriction);
} catch (error) {
  console.log('❌ خطأ في controller:', error.message);
}

try {
  console.log('\n3. تحقق من middleware/auth...');
  const { protect } = require('./middleware/auth');
  console.log('   protect type:', typeof protect);
} catch (error) {
  console.log('❌ خطأ في auth:', error.message);
}

console.log('\n=== انتهى التشخيص ===');