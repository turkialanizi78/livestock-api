// controllers/authController.js
const User = require('../models/User');
const socialAuthService = require('../services/socialAuthService');
const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const sendEmail = require('../services/emailService');
const addDefaultDataForUser = require('../utils/initDefaultData');
const cloudStorageService = require('../services/cloudStorageService');


// @desc    تسجيل مستخدم جديد
// @route   POST /api/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, farmInfo, settings } = req.body;

  // التحقق من عدم وجود مستخدم بنفس البريد الإلكتروني
  const userExists = await User.findOne({ email });

  if (userExists) {
    return res.status(400).json({
      success: false,
      message: 'البريد الإلكتروني مسجل مسبقًا'
    });
  }

  let profileImage = 'default.jpg';
  
  // إذا كان هناك ملف صورة، قم برفعه
  if (req.file) {
    try {
      profileImage = await cloudStorageService.uploadImage(req.file);
    } catch (error) {
      console.error('خطأ في رفع صورة الملف الشخصي:', error);
      // استمر في التسجيل مع الصورة الافتراضية
    }
  }

  // إنشاء المستخدم مع جميع البيانات
  const user = await User.create({
    name,
    email,
    password,
    phone,
    profileImage,
    farmInfo: farmInfo ? JSON.parse(farmInfo) : {},
    settings: settings ? JSON.parse(settings) : { language: 'ar' }
  });

  if (user) {
    sendTokenResponse(user, 201, res);
    await addDefaultDataForUser(user._id);
  } else {
    return res.status(400).json({
      success: false,
      message: 'بيانات المستخدم غير صالحة'
    });
  }
});


// @desc    تسجيل دخول مستخدم عبر Google
// @route   POST /api/auth/google-login
// @access  Public

// إضافة وظيفة تسجيل الدخول عبر Google
exports.googleLogin = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  
  if (!idToken) {
    return res.status(400).json({
      success: false,
      message: 'توكن Google مطلوب'
    });
  }
  
  try {
    // التحقق من توكن Google
    const googleUser = await socialAuthService.verifyGoogleToken(idToken);
    
    // إنشاء أو تحديث المستخدم
    const user = await socialAuthService.findOrCreateGoogleUser(googleUser);
    
    // إرسال استجابة مع توكن المصادقة
    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('خطأ في تسجيل الدخول عبر Google:', error);
    return res.status(401).json({
      success: false,
      message: 'فشل تسجيل الدخول عبر Google'
    });
  }
});


// @desc    تسجيل دخول المستخدم
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // التحقق من وجود البريد وكلمة المرور
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور'
    });
  }

  // البحث عن المستخدم
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'بيانات الاعتماد غير صالحة'
    });
  }

  // مطابقة كلمة المرور
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'بيانات الاعتماد غير صالحة'
    });
  }

  sendTokenResponse(user, 200, res);
});

// @desc    تسجيل خروج المستخدم / مسح الكوكيز
// @route   GET /api/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    الحصول على المستخدم الحالي
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    تحديث تفاصيل المستخدم
// @route   PUT /api/auth/updatedetails
// @access  Private
exports.updateDetails = asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body;
  
  // التأكد من عدم تكرار البريد الإلكتروني
  if (email) {
    const existingUser = await User.findOne({ email, _id: { $ne: req.user.id } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني مستخدم بالفعل من قبل مستخدم آخر'
      });
    }
  }
  
  // بناء كائن التحديث
  const fieldsToUpdate = {};
  if (name) fieldsToUpdate.name = name;
  if (email) fieldsToUpdate.email = email;
  if (phone) fieldsToUpdate.phone = phone;

  // تحديث بيانات المستخدم
  const user = await User.findByIdAndUpdate(
    req.user.id, 
    fieldsToUpdate, 
    {
      new: true,
      runValidators: true
    }
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'لم يتم العثور على المستخدم'
    });
  }

  res.status(200).json({
    success: true,
    data: user
  });
});


// @desc    تحديث كلمة المرور
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('+password');

  // تحقق من كلمة المرور الحالية
  if (!(await user.matchPassword(req.body.currentPassword))) {
    return res.status(401).json({
      success: false,
      message: 'كلمة المرور الحالية غير صحيحة'
    });
  }

  user.password = req.body.newPassword;
  await user.save();

  sendTokenResponse(user, 200, res);
});

// @desc    نسيان كلمة المرور
// @route   POST /api/auth/forgotpassword
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  // التحقق من وجود البريد الإلكتروني
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'يرجى إدخال البريد الإلكتروني'
    });
  }

  // البحث عن المستخدم
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'لا يوجد مستخدم بهذا البريد الإلكتروني'
    });
  }

  // الحصول على توكن إعادة تعيين كلمة المرور (سينشئ resetCode أيضًا)
  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  try {
    // استخدام القالب الجديد لإرسال بريد استعادة كلمة المرور
    await sendEmail({
      email: user.email,
      subject: 'رمز إعادة تعيين كلمة المرور - نظام إدارة المواشي',
      template: 'forgot-password-code',
      templateVars: {
        name: user.name || 'المستخدم الكريم',
        resetCode: user.resetCode, // استخدام حقل resetCode الجديد
        year: new Date().getFullYear()
      }
    });

    res.status(200).json({
      success: true,
      message: 'تم إرسال رمز إعادة تعيين كلمة المرور بنجاح'
    });
  } catch (err) {
    console.error('خطأ في إرسال البريد الإلكتروني:', err);
    
    // إعادة تعيين حقول التوكن
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.resetCode = undefined; // إعادة تعيين resetCode أيضًا
    await user.save({ validateBeforeSave: false });

    return res.status(500).json({
      success: false,
      message: 'تعذر إرسال البريد الإلكتروني. يرجى المحاولة مرة أخرى لاحقاً'
    });
  }
});




// @desc    إعادة تعيين كلمة المرور
// @route   PUT /api/auth/resetpassword/:resettoken
// @access  Public
exports.resetPassword = asyncHandler(async (req, res) => {
  // التحقق من وجود كلمة المرور وتأكيدها
  const { password, confirmPassword } = req.body;
  
  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'يرجى إدخال كلمة المرور الجديدة'
    });
  }
  
  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'كلمة المرور وتأكيدها غير متطابقين'
    });
  }
  
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل'
    });
  }

  // الحصول على التوكن المشفر
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.resettoken)
    .digest('hex');

  // البحث عن المستخدم بالتوكن غير منتهي الصلاحية
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'رابط إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية'
    });
  }

  // تعيين كلمة المرور الجديدة وإعادة تعيين حقول التوكن
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  user.resetCode = undefined;
  await user.save();

  // إرسال رسالة إلكترونية للإشعار بتغيير كلمة المرور
  try {
    // استخدام رابط الواجهة الأمامية
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const loginUrl = `${frontendUrl}/login`;
    
    await sendEmail({
      email: user.email,
      subject: 'تم تغيير كلمة المرور بنجاح - نظام إدارة المواشي',
      template: 'reset-password-success',
      templateVars: {
        name: user.name || 'المستخدم الكريم',
        loginUrl: loginUrl,
        year: new Date().getFullYear()
      }
    });
  } catch (err) {
    console.error('خطأ في إرسال بريد تأكيد تغيير كلمة المرور:', err);
  }

  sendTokenResponse(user, 200, res);
});


// @desc    التحقق من رمز إعادة التعيين
// @route   POST /api/auth/checkresetcode
// @access  Public

exports.checkResetCode = asyncHandler(async (req, res) => {
  const { email, resetCode } = req.body;
  
  // التحقق من وجود البيانات المطلوبة
  if (!email || !resetCode) {
    return res.status(400).json({
      success: false,
      message: 'البريد الإلكتروني والرمز مطلوبان'
    });
  }

  // البحث عن المستخدم
  const user = await User.findOne({ 
    email,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'انتهت صلاحية رمز إعادة التعيين أو البريد الإلكتروني غير صحيح'
    });
  }

  // استخدام حقل resetCode مباشرة للمقارنة
  console.log('Comparing codes:', { providedCode: resetCode, expectedCode: user.resetCode });
  
  if (resetCode !== user.resetCode) {
    return res.status(400).json({
      success: false,
      message: 'رمز إعادة التعيين غير صحيح'
    });
  }

  // الرمز صحيح، إرسال رد إيجابي
  res.status(200).json({
    success: true,
    message: 'رمز إعادة التعيين صحيح'
  });
});



// @desc    التحقق من رمز إعادة تعيين كلمة المرور
// @route   POST /api/auth/verifyresetcode
// @access  Public
exports.verifyResetCode = asyncHandler(async (req, res) => {
  const { email, resetCode, newPassword } = req.body;
  
  // التحقق من وجود البيانات المطلوبة
  if (!email || !resetCode || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'جميع الحقول مطلوبة'
    });
  }
  
  // التحقق من طول كلمة المرور
  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل'
    });
  }

  // البحث عن المستخدم
  const user = await User.findOne({ 
    email,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'انتهت صلاحية رمز إعادة التعيين أو البريد الإلكتروني غير صحيح'
    });
  }

  // التحقق من الرمز باستخدام حقل resetCode
  if (resetCode !== user.resetCode) {
    return res.status(400).json({
      success: false,
      message: 'رمز إعادة التعيين غير صحيح'
    });
  }

  // تعيين كلمة المرور الجديدة وإعادة تعيين حقول التوكن
  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  user.resetCode = undefined; // إعادة تعيين resetCode أيضًا
  
  await user.save();

  // إرسال رسالة إلكترونية للإشعار بتغيير كلمة المرور
  try {
    await sendEmail({
      email: user.email,
      subject: 'تم تغيير كلمة المرور بنجاح - نظام إدارة المواشي',
      template: 'reset-password-success',
      templateVars: {
        name: user.name || 'المستخدم الكريم',
        year: new Date().getFullYear()
      }
    });
  } catch (err) {
    console.error('خطأ في إرسال بريد تأكيد تغيير كلمة المرور:', err);
    // نستمر بالعملية حتى لو فشل إرسال البريد الإلكتروني
  }

  sendTokenResponse(user, 200, res);
});


// @desc    تحديث معلومات المزرعة
// @route   PUT /api/auth/updatefarm
// @access  Private
exports.updateFarmInfo = asyncHandler(async (req, res) => {
  const { name, location, size, type, establishmentDate } = req.body;
  
  // التحقق من البيانات المدخلة
  if (size && isNaN(parseFloat(size))) {
    return res.status(400).json({
      success: false,
      message: 'يجب أن تكون المساحة رقماً'
    });
  }
  
  // التحقق من وجود المستخدم
  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'المستخدم غير موجود'
    });
  }

  // تحديث معلومات المزرعة
  user.farmInfo = {
    ...user.farmInfo, // الاحتفاظ بالقيم الحالية
    ...(name && { name }), // تحديث فقط في حالة وجود قيمة
    ...(location && { location }),
    ...(size && { size: parseFloat(size) }),
    ...(type && { type }),
    ...(establishmentDate && { establishmentDate }),
  };

  await user.save();

  res.status(200).json({
    success: true,
    data: user.farmInfo
  });
});



// @desc    تحديث الإعدادات
// @route   PUT /api/auth/updatesettings
// @access  Private
exports.updateSettings = asyncHandler(async (req, res) => {
  const { language, theme, notificationPreferences } = req.body;

  console.log('طلب تحديث الإعدادات:', req.body);

  // التحقق من البيانات المدخلة
  if (language && !['ar', 'en'].includes(language)) {
    return res.status(400).json({
      success: false,
      message: 'اللغة غير مدعومة'
    });
  }

  if (theme && !['light', 'dark'].includes(theme)) {
    return res.status(400).json({
      success: false,
      message: 'السمة غير مدعومة'
    });
  }

  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'المستخدم غير موجود'
    });
  }

  // إنشاء كائن للإعدادات المحدثة
  let updatedSettings = { ...user.settings.toObject() };

  // تحديث اللغة إذا تم توفيرها
  if (language) {
    updatedSettings.language = language;
  }

  // تحديث السمة إذا تم توفيرها
  if (theme) {
    updatedSettings.theme = theme;
  }

  // تحديث إعدادات الإشعارات إذا تم توفيرها
  if (notificationPreferences) {
    updatedSettings.notificationPreferences = {
      ...updatedSettings.notificationPreferences,
      ...notificationPreferences
    };
  }

  console.log('الإعدادات بعد التحديث:', updatedSettings);

  // تحديث كائن الإعدادات بالكامل
  user.settings = updatedSettings;

  await user.save();

  // إرجاع الإعدادات المحدثة
  res.status(200).json({
    success: true,
    data: user.settings
  });
});





// إضافة دالة تحديث صورة الملف الشخصي
// @desc    تحديث صورة الملف الشخصي
// @route   PUT /api/auth/updateprofileimage
// @access  Private
exports.updateProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'يرجى تحميل صورة'
    });
  }

  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'المستخدم غير موجود'
    });
  }

  try {
    // رفع الصورة الجديدة إلى Google Cloud Storage
    const imageUrl = await cloudStorageService.uploadImage(req.file);
    
    // تجاهل عملية حذف الصورة القديمة لتفادي مشكلة الصلاحيات
    // وتحديث رابط الصورة في بيانات المستخدم مباشرة
    
    user.profileImage = imageUrl;
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        profileImage: user.profileImage
      }
    });
  } catch (error) {
    console.error('خطأ في تحديث صورة الملف الشخصي:', error);
    res.status(500).json({
      success: false,
      message: 'فشل في تحديث صورة الملف الشخصي'
    });
  }
});




// Helper function to get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  // إنشاء التوكن
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  // إنشاء كائن المستخدم بدون كلمة المرور
  const userData = {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    profileImage: user.profileImage,
    farmInfo: user.farmInfo,
    settings: user.settings,
    createdAt: user.createdAt
  };

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      user: userData
    });
};

