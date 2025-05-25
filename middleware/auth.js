// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

// مسؤول عن التحقق من المصادقة
exports.protect = asyncHandler(async (req, res, next) => {
  let token;
  
  // سجل لمعرفة الرؤوس الواردة
  // console.log('Headers received:', req.headers);
  
  if (
    req.headers.authorization && 
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // استخراج التوكن
      token = req.headers.authorization.split(' ')[1];
      
      // سجل للتأكد من وجود التوكن
      // console.log('Token extracted:', token ? 'Token exists' : 'No token');
      
      // التحقق من التوكن
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // إضافة المستخدم إلى الطلب
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        throw new Error('المستخدم غير موجود');
      }
      
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(401).json({
        success: false,
        message: 'غير مصرح بالوصول، يرجى تسجيل الدخول'
      });
    }
  } else {
    res.status(401).json({
      success: false,
      message: 'غير مصرح بالوصول، لا يوجد توكن مصادقة'
    });
  }
});