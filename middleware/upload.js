// middleware/upload.js
const multer = require('multer');
const path = require('path');

// تخزين الملفات في مجلد uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/animal-images/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

// فلتر للتأكد من أن الملف هو صورة
const fileFilter = (req, file, cb) => {
  // سجل لتتبع الملف المرفوع
  console.log('File received:', file);
  
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('نوع الملف غير مدعوم! يرجى استخدام صورة فقط.'), false);
  }
};

// إعداد multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 ميجابايت
  }
});

module.exports = upload;