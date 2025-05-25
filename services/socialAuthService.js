// services/socialAuthService.js
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// التحقق من توكن Google والحصول على بيانات المستخدم
exports.verifyGoogleToken = async (token) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    return ticket.getPayload();
  } catch (error) {
    console.error('خطأ في التحقق من توكن Google:', error);
    throw new Error('التحقق من توكن Google فشل');
  }
};

// إنشاء أو تحديث مستخدم عبر Google
exports.findOrCreateGoogleUser = async (googleUserData) => {
  try {
    const { sub, email, name, picture } = googleUserData;
    
    // البحث عن مستخدم موجود
    let user = await User.findOne({ 
      $or: [
        { googleId: sub },
        { email: email }
      ]
    });
    
    if (!user) {
      // إنشاء مستخدم جديد
      user = new User({
        name: name,
        email: email,
        googleId: sub,
        accountType: 'google',
        profileImage: picture || 'default.jpg',
        isVerified: true,
        password: crypto.randomBytes(20).toString('hex') // كلمة مرور عشوائية لن تستخدم
      });
    } else if (!user.googleId) {
      // ربط حساب موجود بـ Google
      user.googleId = sub;
      user.accountType = 'google';
      user.isVerified = true;
      if (picture && !user.profileImage) {
        user.profileImage = picture;
      }
    }
    
    await user.save();
    return user;
  } catch (error) {
    console.error('خطأ في إنشاء/تحديث مستخدم Google:', error);
    throw error;
  }
};