// middleware/errorHandler.js
const ErrorResponse = require('../utils/errorResponse');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  
  // سجل الخطأ للتصحيح
  console.error(`Error ${err.name}: ${err.message}`);
  
  // خطأ Mongoose في المعرف غير الصالح
  if (err.name === 'CastError') {
    const message = 'مورد غير موجود';
    error = new ErrorResponse(message, 404);
  }
  
  // خطأ Mongoose في تكرار القيمة الفريدة
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `القيمة المستخدمة في الحقل ${field} موجودة بالفعل`;
    error = new ErrorResponse(message, 400);
  }
  
  // خطأ Mongoose في التحقق
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new ErrorResponse(message, 400);
  }
  
  // خطأ JWT
  if (err.name === 'JsonWebTokenError') {
    const message = 'غير مصرح لك بالوصول';
    error = new ErrorResponse(message, 401);
  }
  
  // انتهاء صلاحية JWT
  if (err.name === 'TokenExpiredError') {
    const message = 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى';
    error = new ErrorResponse(message, 401);
  }
  
  // خطأ في حجم الملف كبير جدًا
  if (err.name === 'PayloadTooLargeError') {
    const message = 'حجم الملف كبير جدًا';
    error = new ErrorResponse(message, 413);
  }
  
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'خطأ في الخادم',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
};

module.exports = errorHandler;