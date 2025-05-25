// backend/routes/authRoutes.js
const express = require('express');
const { 
  register, 
  login, 
  logout, 
  getMe, 
  updateDetails, 
  updatePassword, 
  forgotPassword, 
  resetPassword,
  updateFarmInfo,
  updateSettings,
  updateProfileImage,
  verifyResetCode,
  checkResetCode
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const multer = require('multer');

// إعداد multer لتخزين الملفات مؤقتاً في الذاكرة
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 ميجابايت كحد أقصى
  },
  fileFilter: (req, file, cb) => {
    // السماح فقط بملفات الصور
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('يسمح فقط بملفات الصور'), false);
    }
  }
});

const router = express.Router();

// مسارات عامة
router.post('/register', upload.single('profileImage'), register);
router.post('/login', login);
router.get('/logout', logout);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);
router.post('/verify-reset-code', verifyResetCode);
router.post('/check-reset-code', checkResetCode);

// مسارات محمية
router.get('/me', protect, getMe);
router.put('/updatedetails', protect, updateDetails);
router.put('/updatepassword', protect, updatePassword);
router.put('/updatefarm', protect, updateFarmInfo);
router.put('/updatesettings', protect, updateSettings);
router.put('/updateprofileimage', protect, upload.single('profileImage'), updateProfileImage);

module.exports = router;