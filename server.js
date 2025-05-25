// backend -- server.js
const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const fs = require('fs');
const path = require('path');

// تحميل متغيرات البيئة
dotenv.config();
 
// اتصال بقاعدة البيانات
connectDB();

// إنشاء تطبيق Express
const app = express();

// زيادة مهلة الطلبات
app.timeout = 120000; // 120 ثانية

app.use((req, res, next) => {
  if (req.method === 'DELETE') {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    
    req.on('end', () => {
      try {
        req.body = data ? JSON.parse(data) : {};
        next();
      } catch (error) {
        // إذا كان هناك خطأ في تحليل JSON، استمر بدون تحليله
        req.body = {};
        next();
      }
    });
  } else {
    next();
  }
});

// Middleware
app.use(express.json({ limit: '50mb' })); // زيادة حد حجم طلبات JSON
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors({
  origin: '*', // السماح لجميع المصادر
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
  maxAge: 86400 // تخزين مؤقت لطلبات preflight لمدة يوم
}));

app.use(helmet());

// تضمين Morgan لتسجيل الطلبات في بيئة التطوير
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// مسار للتحقق من حالة الخادم
app.get('/api/server-health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'الخادم يعمل بشكل طبيعي',
    serverTime: new Date().toISOString()
  });
});

// مسار اختبار
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'الاتصال ناجح' });
});

// إعداد مجلد statc للملفات المرفوعة
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const uploadDir = path.join(__dirname, 'uploads/animal-images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('Created uploads directory at:', uploadDir);
}
// تعريف المسارات
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/categories', require('./routes/animalCategoryRoutes'));
app.use('/api/breeds', require('./routes/animalBreedRoutes'));
app.use('/api/animals', require('./routes/animalRoutes'));
app.use('/api/vaccination-schedules', require('./routes/vaccinationScheduleRoutes'));
app.use('/api/vaccinations', require('./routes/vaccinationRoutes'));
app.use('/api/health', require('./routes/healthEventRoutes'));
app.use('/api/breeding', require('./routes/breedingEventRoutes'));
app.use('/api/births', require('./routes/birthRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/financial', require('./routes/financialRecordRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/inventory-transactions', require('./routes/inventoryTransactionRoutes'));
app.use('/api/reminders', require('./routes/reminderRoutes'));
app.use('/api/withdrawal-periods', require('./routes/defaultWithdrawalPeriodRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/backups', require('./routes/backupRoutes'));
app.use('/api/feeding', require('./routes/feedingRoutes'));
app.use('/api/feeding-schedules', require('./routes/feedingScheduleRoutes'));
app.use('/api/equipment-usage', require('./routes/equipmentUsageRoutes'));
app.use('/api/feed-calculation', require('./routes/feedCalculationRoutes'));
// app.use('/api/feeding-reports', require('./routes/feedingReportsRoutes'));
const initializeDefaultData = require('./utils/initDefaultData');

// مسار الصفحة الرئيسية
app.get('/', (req, res) => {
  res.json({ message: 'مرحبًا بك في واجهة برمجة تطبيق إدارة المواشي' });
});

// معالج الأخطاء
app.use(errorHandler);

// استدعاء خدمات الجدولة
require('./services/cronService');

// تحديد المنفذ والاستماع للطلبات
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  // طباعة عنوان IP للتحقق منه
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  console.log('Available network interfaces:');
  Object.keys(networkInterfaces).forEach(interfaceName => {
    const interfaces = networkInterfaces[interfaceName];
    interfaces.forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`Interface: ${interfaceName}, IP: ${iface.address}`);
      }
    });
  });
   // إضافة البيانات الافتراضية عند تشغيل الخادم
    initializeDefaultData();
});

// معالجة أخطاء رفض الوعود غير المعالجة
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // إغلاق الخادم وإنهاء العملية
  server.close(() => process.exit(1));
});

// معالجة الاستثناءات غير المعالجة
process.on('uncaughtException', (err) => {
  console.error(`Uncaught Exception: ${err.message}`);
  console.error(err.stack);
  
  // إغلاق الخادم والعملية بشكل آمن
  server.close(() => {
    console.log('Server closed due to uncaught exception');
    process.exit(1);
  });
});