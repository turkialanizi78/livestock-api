// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'يرجى إدخال الاسم'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'يرجى إدخال البريد الإلكتروني'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'يرجى إدخال بريد إلكتروني صحيح']
  },
  password: {
    type: String,
    required: [true, 'يرجى إدخال كلمة المرور'],
    minlength: [6, 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل'],
    select: false
  },
   googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  accountType: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  phone: {
    type: String,
    trim: true
  },
  profileImage: {
    type: String,
    default: 'default.jpg'
  },
  farmInfo: {
    name: { type: String, trim: true },
    location: { type: String, trim: true },
    size: { type: Number },
    type: { type: String, trim: true },
    establishmentDate: { type: Date }
  },
  settings: {
    language: { type: String, default: 'ar' },
    theme: { type: String, default: 'light' },
    notificationPreferences: {
      enablePushNotifications: { type: Boolean, default: true },
      enableEmailNotifications: { type: Boolean, default: false },
      vaccinationReminders: { type: Boolean, default: true },
      withdrawalEndReminders: { type: Boolean, default: true },
      birthReminders: { type: Boolean, default: true },
      lowInventoryAlerts: { type: Boolean, default: true },
      reminderDaysInAdvance: { type: Number, default: 3 }
    }
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  resetCode: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// تشفير كلمة المرور قبل الحفظ
UserSchema.pre('save', async function(next) {
  // تخطي تشفير كلمة المرور لحسابات Google
  if (!this.isModified('password') || this.accountType !== 'local') {
    next();
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// إنشاء توكن JWT
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// مطابقة كلمة المرور المدخلة مع كلمة المرور المخزنة
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// إنشاء وحفظ توكن إعادة تعيين كلمة المرور
UserSchema.methods.getResetPasswordToken = function() {
  // إنشاء توكن
  const resetToken = crypto.randomBytes(20).toString('hex');

  // إنشاء رمز من 6 أحرف للتحقق
  this.resetCode = crypto.randomBytes(3).toString('hex').toUpperCase();
  
  // تشفير التوكن وتخزينه في قاعدة البيانات
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // تعيين وقت انتهاء الصلاحية (10 دقائق)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};


const User = mongoose.model('User', UserSchema);

module.exports = User;