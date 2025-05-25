// backend/utils/initDefaultData.js
const mongoose = require('mongoose');
const User = require('../models/User'); // نموذج المستخدم
const AnimalCategory = require('../models/AnimalCategory'); // نموذج فئة الحيوان
const AnimalBreed = require('../models/AnimalBreed'); // نموذج سلالة الحيوان
const VaccinationSchedule = require('../models/VaccinationSchedule'); // نموذج جدول التطعيم
const WithdrawalPeriod = require('../models/DefaultWithdrawalPeriod'); // نموذج فترة الحظر

// البيانات الافتراضية للفئات
const DEFAULT_CATEGORIES = [
  { name: 'أغنام', pregnancyPeriod: 150, maturityAge: 12 },
  { name: 'أبقار', pregnancyPeriod: 280, maturityAge: 24 },
  { name: 'ماعز', pregnancyPeriod: 150, maturityAge: 10 },
  { name: 'خيول', pregnancyPeriod: 340, maturityAge: 36 },
  { name: 'إبل', pregnancyPeriod: 390, maturityAge: 48 },
  { name: 'دجاج', pregnancyPeriod: 21, maturityAge: 6 }
];

// البيانات الافتراضية للسلالات حسب الفئة
const DEFAULT_BREEDS_BY_CATEGORY = {
  'أغنام': [
    { name: 'عواسي', description: 'سلالة عواسي من الأغنام' },
    { name: 'نعيمي', description: 'سلالة نعيمي من الأغنام' },
    { name: 'حري', description: 'سلالة حري من الأغنام' },
    { name: 'برقي', description: 'سلالة برقي من الأغنام' }
  ],
  'أبقار': [
    { name: 'هولشتاين', description: 'سلالة هولشتاين من الأبقار' },
    { name: 'سيمنتال', description: 'سلالة سيمنتال من الأبقار' },
    { name: 'جيرسي', description: 'سلالة جيرسي من الأبقار' },
    { name: 'براهمان', description: 'سلالة براهمان من الأبقار' }
  ],
  'ماعز': [
    { name: 'شامي', description: 'سلالة شامي من الماعز' },
    { name: 'بلدي', description: 'سلالة بلدي من الماعز' },
    { name: 'عارضي', description: 'سلالة عارضي من الماعز' },
    { name: 'حجازي', description: 'سلالة حجازي من الماعز' }
  ],
  'خيول': [
    { name: 'عربي', description: 'سلالة عربي من الخيول' },
    { name: 'انجليزي', description: 'سلالة انجليزي من الخيول' },
    { name: 'سرج', description: 'سلالة سرج من الخيول' },
    { name: 'عراقي', description: 'سلالة عراقي من الخيول' }
  ],
  'إبل': [
    { name: 'مجاهيم', description: 'سلالة مجاهيم من الإبل' },
    { name: 'وضح', description: 'سلالة وضح من الإبل' },
    { name: 'صفر', description: 'سلالة صفر من الإبل' },
    { name: 'شعل', description: 'سلالة شعل من الإبل' }
  ],
  'دجاج': [
    { name: 'لاحم', description: 'سلالة لاحم من الدجاج' },
    { name: 'بياض', description: 'سلالة بياض من الدجاج' },
    { name: 'بلدي', description: 'سلالة بلدي من الدجاج' },
    { name: 'فرنسي', description: 'سلالة فرنسي من الدجاج' }
  ]
};

// البيانات الافتراضية لجداول التطعيم حسب الفئة
const DEFAULT_VACCINATION_SCHEDULES = {
   'أغنام': [
    {
      name: 'تطعيم الجمرة الخبيثة',
      description: 'للوقاية من الجمرة الخبيثة (أنثراكس)',
      requiredAge: 90, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 21, // بالأيام
      milkWithdrawalPeriod: 3, // بالأيام
    },
    {
      name: 'تطعيم التسمم المعوي',
      description: 'للوقاية من الكلوستريديا والتسمم المعوي',
      requiredAge: 60, // بالأيام
      repeatInterval: 180, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 14, // بالأيام
      milkWithdrawalPeriod: 2, // بالأيام
    },
    {
      name: 'تطعيم الحمى القلاعية',
      description: 'للوقاية من مرض الحمى القلاعية',
      requiredAge: 120, // بالأيام
      repeatInterval: 180, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 7, // بالأيام
      milkWithdrawalPeriod: 1, // بالأيام
    },
    {
      name: 'تطعيم طاعون المجترات',
      description: 'للوقاية من طاعون المجترات الصغيرة',
      requiredAge: 100, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 28, // بالأيام
      milkWithdrawalPeriod: 4, // بالأيام
    },
    {
      name: 'تطعيم جدري الأغنام',
      description: 'للوقاية من مرض جدري الأغنام',
      requiredAge: 150, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 21, // بالأيام
      milkWithdrawalPeriod: 3, // بالأيام
    },
    {
      name: 'تطعيم التهاب الجلد العقدي',
      description: 'للوقاية من مرض التهاب الجلد العقدي',
      requiredAge: 120, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: false,
      meatWithdrawalPeriod: 21, // بالأيام
      milkWithdrawalPeriod: 3, // بالأيام
    },
    {
      name: 'تطعيم البروسيلا',
      description: 'للوقاية من مرض البروسيلا (الإجهاض المعدي)',
      requiredAge: 180, // بالأيام
      repeatInterval: 730, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 30, // بالأيام
      milkWithdrawalPeriod: 5, // بالأيام
    },
    {
      name: 'تطعيم التهاب الضرع',
      description: 'للوقاية من التهابات الضرع المختلفة',
      requiredAge: 210, // بالأيام
      repeatInterval: 180, // بالأيام
      isRequired: false,
      meatWithdrawalPeriod: 14, // بالأيام
      milkWithdrawalPeriod: 3, // بالأيام
    },
    {
      name: 'تطعيم داء الكلب',
      description: 'للوقاية من داء الكلب',
      requiredAge: 150, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: false,
      meatWithdrawalPeriod: 21, // بالأيام
      milkWithdrawalPeriod: 4, // بالأيام
    },
    {
      name: 'تطعيم الريفت فالي',
      description: 'للوقاية من حمى الوادي المتصدع',
      requiredAge: 120, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: false,
      meatWithdrawalPeriod: 28, // بالأيام
      milkWithdrawalPeriod: 5, // بالأيام
    },
    {
      name: 'تطعيم الإنتروتوكسيميا',
      description: 'للوقاية من تسمم الدم المعوي',
      requiredAge: 90, // بالأيام
      repeatInterval: 180, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 14, // بالأيام
      milkWithdrawalPeriod: 3, // بالأيام
    }
  ],
  'ماعز': [
    {
      name: 'تطعيم الجمرة الخبيثة',
      description: 'للوقاية من الجمرة الخبيثة (أنثراكس)',
      requiredAge: 90, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 21, // بالأيام
      milkWithdrawalPeriod: 3, // بالأيام
    },
    {
      name: 'تطعيم التسمم المعوي',
      description: 'للوقاية من الكلوستريديا والتسمم المعوي',
      requiredAge: 60, // بالأيام
      repeatInterval: 180, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 14, // بالأيام
      milkWithdrawalPeriod: 2, // بالأيام
    },
    {
      name: 'تطعيم الحمى القلاعية',
      description: 'للوقاية من مرض الحمى القلاعية',
      requiredAge: 120, // بالأيام
      repeatInterval: 180, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 7, // بالأيام
      milkWithdrawalPeriod: 1, // بالأيام
    },
    {
      name: 'تطعيم طاعون المجترات',
      description: 'للوقاية من طاعون المجترات الصغيرة',
      requiredAge: 100, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 28, // بالأيام
      milkWithdrawalPeriod: 4, // بالأيام
    },
    {
      name: 'تطعيم البروسيلا',
      description: 'للوقاية من مرض البروسيلا (الإجهاض المعدي)',
      requiredAge: 180, // بالأيام
      repeatInterval: 730, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 30, // بالأيام
      milkWithdrawalPeriod: 5, // بالأيام
    },
    {
      name: 'تطعيم جدري الماعز',
      description: 'للوقاية من جدري الماعز',
      requiredAge: 130, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 21, // بالأيام
      milkWithdrawalPeriod: 3, // بالأيام
    },
    {
      name: 'تطعيم التهاب الضرع',
      description: 'للوقاية من التهابات الضرع المختلفة',
      requiredAge: 210, // بالأيام
      repeatInterval: 180, // بالأيام
      isRequired: false,
      meatWithdrawalPeriod: 14, // بالأيام
      milkWithdrawalPeriod: 3, // بالأيام
    },
    {
      name: 'تطعيم CCPP',
      description: 'للوقاية من الالتهاب الرئوي البلوري المعدي في الماعز',
      requiredAge: 120, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 21, // بالأيام
      milkWithdrawalPeriod: 4, // بالأيام
    },
    {
      name: 'تطعيم الريفت فالي',
      description: 'للوقاية من حمى الوادي المتصدع',
      requiredAge: 120, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: false,
      meatWithdrawalPeriod: 28, // بالأيام
      milkWithdrawalPeriod: 5, // بالأيام
    },
    {
      name: 'تطعيم CAE',
      description: 'للوقاية من التهاب المفاصل والدماغ في الماعز',
      requiredAge: 150, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: false,
      meatWithdrawalPeriod: 21, // بالأيام
      milkWithdrawalPeriod: 4, // بالأيام
    },
    {
      name: 'تطعيم الإنتروتوكسيميا',
      description: 'للوقاية من تسمم الدم المعوي',
      requiredAge: 90, // بالأيام
      repeatInterval: 180, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 14, // بالأيام
      milkWithdrawalPeriod: 3, // بالأيام
    }
  ],
  'خيول': [
    {
      name: 'تطعيم الأنفلونزا',
      description: 'للوقاية من أنفلونزا الخيول',
      requiredAge: 120, // بالأيام
      repeatInterval: 180, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 21, // بالأيام
      milkWithdrawalPeriod: 0, // بالأيام
    },
    {
      name: 'تطعيم الكزاز',
      description: 'للوقاية من الكزاز (التيتانوس)',
      requiredAge: 90, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 21, // بالأيام
      milkWithdrawalPeriod: 0, // بالأيام
    },
    {
      name: 'تطعيم التهاب الدماغ الخيلي الفنزويلي',
      description: 'للوقاية من التهاب الدماغ الفنزويلي',
      requiredAge: 150, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: false,
      meatWithdrawalPeriod: 28, // بالأيام
      milkWithdrawalPeriod: 0, // بالأيام
    },
    {
      name: 'تطعيم التهاب الدماغ الخيلي الشرقي والغربي',
      description: 'للوقاية من التهاب الدماغ الشرقي والغربي',
      requiredAge: 150, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: false,
      meatWithdrawalPeriod: 28, // بالأيام
      milkWithdrawalPeriod: 0, // بالأيام
    },
    {
      name: 'تطعيم حمى النيل الغربي',
      description: 'للوقاية من فيروس حمى النيل الغربي',
      requiredAge: 180, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: false,
      meatWithdrawalPeriod: 21, // بالأيام
      milkWithdrawalPeriod: 0, // بالأيام
    },
    {
      name: 'تطعيم الهربس الفيروسي',
      description: 'للوقاية من فيروس الهربس الخيلي',
      requiredAge: 120, // بالأيام
      repeatInterval: 180, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 14, // بالأيام
      milkWithdrawalPeriod: 0, // بالأيام
    },
    {
      name: 'تطعيم داء الكلب',
      description: 'للوقاية من داء الكلب',
      requiredAge: 150, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: false,
      meatWithdrawalPeriod: 21, // بالأيام
      milkWithdrawalPeriod: 0, // بالأيام
    },
    {
      name: 'تطعيم الرينوبنيمونيا',
      description: 'للوقاية من التهاب الأنف والرئة',
      requiredAge: 150, // بالأيام
      repeatInterval: 180, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 14, // بالأيام
      milkWithdrawalPeriod: 0, // بالأيام
    },
    {
      name: 'تطعيم مرض الطاعون الأفريقي للخيول',
      description: 'للوقاية من الطاعون الأفريقي للخيول',
      requiredAge: 180, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: false,
      meatWithdrawalPeriod: 28, // بالأيام
      milkWithdrawalPeriod: 0, // بالأيام
    },
    {
      name: 'تطعيم استرانجلز',
      description: 'للوقاية من مرض الخناق (استرانجلز)',
      requiredAge: 150, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: false,
      meatWithdrawalPeriod: 21, // بالأيام
      milkWithdrawalPeriod: 0, // بالأيام
    }
  ],
  'أبقار': [
    {
      name: 'تطعيم الجمرة الخبيثة',
      description: 'للوقاية من الجمرة الخبيثة (أنثراكس)',
      requiredAge: 90, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 28, // بالأيام
      milkWithdrawalPeriod: 4, // بالأيام
    },
    {
      name: 'تطعيم الحمى القلاعية',
      description: 'للوقاية من مرض الحمى القلاعية',
      requiredAge: 120, // بالأيام
      repeatInterval: 180, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 14, // بالأيام
      milkWithdrawalPeriod: 3, // بالأيام
    },
    {
      name: 'تطعيم البروسيلا',
      description: 'للوقاية من مرض البروسيلا (الإجهاض المعدي)',
      requiredAge: 180, // بالأيام
      repeatInterval: 730, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 30, // بالأيام
      milkWithdrawalPeriod: 7, // بالأيام
    },
    {
      name: 'تطعيم السل البقري',
      description: 'للوقاية من السل البقري',
      requiredAge: 100, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 28, // بالأيام
      milkWithdrawalPeriod: 5, // بالأيام
    },
    {
      name: 'تطعيم الجنين الميت',
      description: 'للوقاية من مرض الجنين الميت',
      requiredAge: 180, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 21, // بالأيام
      milkWithdrawalPeriod: 4, // بالأيام
    },
    {
      name: 'تطعيم التهاب الضرع',
      description: 'للوقاية من التهاب الضرع البقري',
      requiredAge: 210, // بالأيام
      repeatInterval: 180, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 14, // بالأيام
      milkWithdrawalPeriod: 4, // بالأيام
    },
    {
      name: 'تطعيم حمى ثلاثة أيام',
      description: 'للوقاية من حمى ثلاثة أيام البقرية',
      requiredAge: 120, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: false,
      meatWithdrawalPeriod: 21, // بالأيام
      milkWithdrawalPeriod: 3, // بالأيام
    },
    {
      name: 'تطعيم IBR',
      description: 'للوقاية من التهاب الأنف والقصبات المعدي',
      requiredAge: 150, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 21, // بالأيام
      milkWithdrawalPeriod: 4, // بالأيام
    },
    {
      name: 'تطعيم BVD',
      description: 'للوقاية من الإسهال الفيروسي البقري',
      requiredAge: 150, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 28, // بالأيام
      milkWithdrawalPeriod: 5, // بالأيام
    },
    {
      name: 'تطعيم التسمم المعوي',
      description: 'للوقاية من الكلوستريديا والتسمم المعوي',
      requiredAge: 60, // بالأيام
      repeatInterval: 180, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 14, // بالأيام
      milkWithdrawalPeriod: 3, // بالأيام
    },
    {
      name: 'تطعيم جمرة الساق السوداء',
      description: 'للوقاية من جمرة الساق السوداء في الأبقار',
      requiredAge: 90, // بالأيام
      repeatInterval: 180, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 21, // بالأيام
      milkWithdrawalPeriod: 4, // بالأيام
    },
    {
      name: 'تطعيم الحمى المالطية',
      description: 'للوقاية من داء البروسيلات (الحمى المالطية)',
      requiredAge: 180, // بالأيام
      repeatInterval: 730, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 30, // بالأيام
      milkWithdrawalPeriod: 7, // بالأيام
    },
    {
      name: 'تطعيم الريفت فالي',
      description: 'للوقاية من حمى الوادي المتصدع',
      requiredAge: 120, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: false,
      meatWithdrawalPeriod: 28, // بالأيام
      milkWithdrawalPeriod: 5, // بالأيام
    },
    {
      name: 'تطعيم مرض الجلد العقدي',
      description: 'للوقاية من مرض الجلد العقدي',
      requiredAge: 120, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 28, // بالأيام
      milkWithdrawalPeriod: 5, // بالأيام
    }
  ],
  'إبل': [
    {
      name: 'تطعيم الجمرة الخبيثة',
      description: 'للوقاية من الجمرة الخبيثة (أنثراكس)',
      requiredAge: 120, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 30, // بالأيام
      milkWithdrawalPeriod: 5, // بالأيام
    },
    {
      name: 'تطعيم جدري الإبل',
      description: 'للوقاية من جدري الإبل',
      requiredAge: 90, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 21, // بالأيام
      milkWithdrawalPeriod: 3, // بالأيام
    },
    {
      name: 'تطعيم داء المقوسات',
      description: 'للوقاية من داء المقوسات في الإبل',
      requiredAge: 150, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: false,
      meatWithdrawalPeriod: 28, // بالأيام
      milkWithdrawalPeriod: 5, // بالأيام
    },
    {
      name: 'تطعيم فيروس كورونا الإبل (MERS-CoV)',
      description: 'للوقاية من فيروس كورونا الشرق الأوسط',
      requiredAge: 180, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 30, // بالأيام
      milkWithdrawalPeriod: 7, // بالأيام
    },
    {
      name: 'تطعيم التهاب المفاصل',
      description: 'للوقاية من التهاب المفاصل في الإبل',
      requiredAge: 150, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: false,
      meatWithdrawalPeriod: 21, // بالأيام
      milkWithdrawalPeriod: 4, // بالأيام
    },
    {
      name: 'تطعيم الريفت فالي',
      description: 'للوقاية من حمى الوادي المتصدع',
      requiredAge: 120, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: false,
      meatWithdrawalPeriod: 28, // بالأيام
      milkWithdrawalPeriod: 5, // بالأيام
    },
    {
      name: 'تطعيم التسمم المعوي',
      description: 'للوقاية من الكلوستريديا والتسمم المعوي',
      requiredAge: 90, // بالأيام
      repeatInterval: 180, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 21, // بالأيام
      milkWithdrawalPeriod: 4, // بالأيام
    },
    {
      name: 'تطعيم الحمى القلاعية',
      description: 'للوقاية من مرض الحمى القلاعية',
      requiredAge: 120, // بالأيام
      repeatInterval: 180, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 14, // بالأيام
      milkWithdrawalPeriod: 5, // بالأيام
    },
    {
      name: 'تطعيم داء البروسيلات',
      description: 'للوقاية من مرض البروسيلات',
      requiredAge: 180, // بالأيام
      repeatInterval: 730, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 30, // بالأيام
      milkWithdrawalPeriod: 7, // بالأيام
    },
    {
      name: 'تطعيم الالتهاب الرئوي',
      description: 'للوقاية من الالتهاب الرئوي في الإبل',
      requiredAge: 120, // بالأيام
      repeatInterval: 365, // بالأيام
      isRequired: true,
      meatWithdrawalPeriod: 21, // بالأيام
      milkWithdrawalPeriod: 4, // بالأيام
    }
  ],
 'دجاج': [
  // التطعيمات السابقة
  {
    name: 'تطعيم نيوكاسل',
    description: 'للوقاية من مرض نيوكاسل',
    requiredAge: 7, // بالأيام
    repeatInterval: 90, // بالأيام
    isRequired: true,
    meatWithdrawalPeriod: 14, // بالأيام
    milkWithdrawalPeriod: 0, // بالأيام
  },
  {
    name: 'تطعيم الجمبورو',
    description: 'للوقاية من مرض الجمبورو (التهاب الجراب المعدي)',
    requiredAge: 14, // بالأيام
    repeatInterval: 0, // بالأيام
    isRequired: true,
    meatWithdrawalPeriod: 7, // بالأيام
    milkWithdrawalPeriod: 0, // بالأيام
  },
  // التطعيمات الجديدة
  {
    name: 'تطعيم التهاب الشعب الهوائية المعدي',
    description: 'للوقاية من التهاب الشعب الهوائية المعدي',
    requiredAge: 10, // بالأيام
    repeatInterval: 120, // بالأيام
    isRequired: true,
    meatWithdrawalPeriod: 10, // بالأيام
    milkWithdrawalPeriod: 0, // بالأيام
  },
  {
    name: 'تطعيم التهاب المخ النخاعي الطيري',
    description: 'للوقاية من التهاب المخ النخاعي الطيري',
    requiredAge: 21, // بالأيام
    repeatInterval: 180, // بالأيام
    isRequired: false,
    meatWithdrawalPeriod: 14, // بالأيام
    milkWithdrawalPeriod: 0, // بالأيام
  },
  {
    name: 'تطعيم الكوكسيديا',
    description: 'للوقاية من داء الكوكسيديا',
    requiredAge: 5, // بالأيام
    repeatInterval: 0, // بالأيام
    isRequired: true,
    meatWithdrawalPeriod: 10, // بالأيام
    milkWithdrawalPeriod: 0, // بالأيام
  },
  {
    name: 'تطعيم الميكوبلازما',
    description: 'للوقاية من عدوى الميكوبلازما',
    requiredAge: 14, // بالأيام
    repeatInterval: 180, // بالأيام
    isRequired: true,
    meatWithdrawalPeriod: 14, // بالأيام
    milkWithdrawalPeriod: 0, // بالأيام
  },
  {
    name: 'تطعيم الكوليرا',
    description: 'للوقاية من الكوليرا في الدواجن',
    requiredAge: 28, // بالأيام
    repeatInterval: 180, // بالأيام
    isRequired: false,
    meatWithdrawalPeriod: 14, // بالأيام
    milkWithdrawalPeriod: 0, // بالأيام
  },
  {
    name: 'تطعيم إنفلونزا الطيور',
    description: 'للوقاية من فيروس إنفلونزا الطيور',
    requiredAge: 14, // بالأيام
    repeatInterval: 180, // بالأيام
    isRequired: true,
    meatWithdrawalPeriod: 21, // بالأيام
    milkWithdrawalPeriod: 0, // بالأيام
  },
  {
    name: 'تطعيم الجدري',
    description: 'للوقاية من جدري الدواجن',
    requiredAge: 30, // بالأيام
    repeatInterval: 365, // بالأيام
    isRequired: false,
    meatWithdrawalPeriod: 14, // بالأيام
    milkWithdrawalPeriod: 0, // بالأيام
  },
  {
    name: 'تطعيم مرض مارك',
    description: 'للوقاية من مرض مارك (شلل الدجاج)',
    requiredAge: 1, // بالأيام
    repeatInterval: 0, // بالأيام
    isRequired: true,
    meatWithdrawalPeriod: 21, // بالأيام
    milkWithdrawalPeriod: 0, // بالأيام
  }
]
};

// البيانات الافتراضية لفترات الحظر
const COMMON_MEDICATIONS = [
  { 
    name: 'مضاد حيوي واسع المجال',  
    type: 'medication',
    activeMaterial: 'أوكسي تتراسيكلين', 
    meatWithdrawalPeriod: 28, 
    milkWithdrawalPeriod: 5 
  },
  { 
    name: 'مضاد حيوي بنسلين', 
    type: 'medication',
    activeMaterial: 'بنزيل بنسلين', 
    meatWithdrawalPeriod: 30, 
    milkWithdrawalPeriod: 4 
  },
  { 
    name: 'طارد ديدان', 
    type: 'medication',
    activeMaterial: 'ايفرمكتين', 
    meatWithdrawalPeriod: 35, 
    milkWithdrawalPeriod: 7 
  },
  { 
    name: 'مضاد للطفيليات الخارجية', 
    type: 'medication',
    activeMaterial: 'سايبرمثرين', 
    meatWithdrawalPeriod: 21, 
    milkWithdrawalPeriod: 3 
  },
  { 
    name: 'مضاد التهابات', 
    type: 'medication',
    activeMaterial: 'فلونكسين', 
    meatWithdrawalPeriod: 14, 
    milkWithdrawalPeriod: 2 
  },
  
  // الأدوية الإضافية
  { 
    name: 'إنروفلوكساسين', 
    type: 'medication',
    activeMaterial: 'إنروفلوكساسين', 
    meatWithdrawalPeriod: 28, 
    milkWithdrawalPeriod: 5 
  },
  { 
    name: 'سيفتيوفور', 
    type: 'medication',
    activeMaterial: 'سيفتيوفور هيدروكلوريد', 
    meatWithdrawalPeriod: 21, 
    milkWithdrawalPeriod: 3 
  },
  { 
    name: 'تيلميكوسين', 
    type: 'medication',
    activeMaterial: 'تيلميكوسين فوسفات', 
    meatWithdrawalPeriod: 35, 
    milkWithdrawalPeriod: 7
  },
  { 
    name: 'سلفاديميدين', 
    type: 'medication',
    activeMaterial: 'سلفاديميدين صوديوم', 
    meatWithdrawalPeriod: 30, 
    milkWithdrawalPeriod: 4 
  },
  { 
    name: 'ألبندازول', 
    type: 'medication',
    activeMaterial: 'ألبندازول', 
    meatWithdrawalPeriod: 21, 
    milkWithdrawalPeriod: 5 
  },
  { 
    name: 'فيبندازول', 
    type: 'medication',
    activeMaterial: 'فيبندازول', 
    meatWithdrawalPeriod: 14, 
    milkWithdrawalPeriod: 4 
  },
  { 
    name: 'ديكسامیثازون', 
    type: 'medication',
    activeMaterial: 'ديكسامیثازون صوديوم فوسفات', 
    meatWithdrawalPeriod: 7, 
    milkWithdrawalPeriod: 3 
  },
  { 
    name: 'جنتاميسين', 
    type: 'medication',
    activeMaterial: 'جنتاميسين سلفات', 
    meatWithdrawalPeriod: 35, 
    milkWithdrawalPeriod: 7 
  },
  { 
    name: 'أمبيسيلين', 
    type: 'medication',
    activeMaterial: 'أمبيسيلين تراي هيدرات', 
    meatWithdrawalPeriod: 30, 
    milkWithdrawalPeriod: 3 
  },
  { 
    name: 'ليفاميزول', 
    type: 'medication',
    activeMaterial: 'ليفاميزول هيدروكلوريد', 
    meatWithdrawalPeriod: 10, 
    milkWithdrawalPeriod: 2 
  },
  { 
    name: 'برازيكوانتيل', 
    type: 'medication',
    activeMaterial: 'برازيكوانتيل', 
    meatWithdrawalPeriod: 21, 
    milkWithdrawalPeriod: 5 
  },
  { 
    name: 'كلوزانتيل', 
    type: 'medication',
    activeMaterial: 'كلوزانتيل', 
    meatWithdrawalPeriod: 28, 
    milkWithdrawalPeriod: 14 
  },
  { 
    name: 'أوكسفندازول', 
    type: 'medication',
    activeMaterial: 'أوكسفندازول', 
    meatWithdrawalPeriod: 14, 
    milkWithdrawalPeriod: 7 
  },
  { 
    name: 'ديكلورفوس', 
    type: 'medication',
    activeMaterial: 'ديكلورفوس', 
    meatWithdrawalPeriod: 10, 
    milkWithdrawalPeriod: 4 
  },
  { 
    name: 'كبريتات النحاس', 
    type: 'medication',
    activeMaterial: 'كبريتات النحاس', 
    meatWithdrawalPeriod: 21, 
    milkWithdrawalPeriod: 3 
  },
  { 
    name: 'دوراميسين', 
    type: 'medication',
    activeMaterial: 'دوراميسين', 
    meatWithdrawalPeriod: 42, 
    milkWithdrawalPeriod: 7 
  },
  { 
    name: 'أموكسيسيلين', 
    type: 'medication',
    activeMaterial: 'أموكسيسيلين تراي هيدرات', 
    meatWithdrawalPeriod: 25, 
    milkWithdrawalPeriod: 3 
  },
  { 
    name: 'فلوروفينيكول', 
    type: 'medication',
    activeMaterial: 'فلوروفينيكول', 
    meatWithdrawalPeriod: 30, 
    milkWithdrawalPeriod: 4 
  },
  { 
    name: 'ترايكلابندازول', 
    type: 'medication',
    activeMaterial: 'ترايكلابندازول', 
    meatWithdrawalPeriod: 28, 
    milkWithdrawalPeriod: 7 
  },
  
  // الأدوية المستخدمة في منطقة الخليج العربي
  { 
    name: 'بيستيزول', 
    type: 'medication',
    activeMaterial: 'مزيج ألبندازول وترايكلابندازول', 
    meatWithdrawalPeriod: 35, 
    milkWithdrawalPeriod: 7 
  },
  { 
    name: 'ديكتول', 
    type: 'medication',
    activeMaterial: 'ديكلازوريل', 
    meatWithdrawalPeriod: 28, 
    milkWithdrawalPeriod: 5 
  },
  { 
    name: 'فاكومك', 
    type: 'medication',
    activeMaterial: 'مزيج أدوية مضادة للطفيليات', 
    meatWithdrawalPeriod: 21, 
    milkWithdrawalPeriod: 4 
  },
  { 
    name: 'دروسال', 
    type: 'medication',
    activeMaterial: 'كلوسانتيل وأوكسفندازول', 
    meatWithdrawalPeriod: 30, 
    milkWithdrawalPeriod: 6 
  },
  { 
    name: 'زيكتران', 
    type: 'medication',
    activeMaterial: 'ترايكلابندازول', 
    meatWithdrawalPeriod: 42, 
    milkWithdrawalPeriod: 14 
  },
  { 
    name: 'توتريل', 
    type: 'medication',
    activeMaterial: 'تولترازوريل', 
    meatWithdrawalPeriod: 63, 
    milkWithdrawalPeriod: 7 
  },
  { 
    name: 'باناكور', 
    type: 'medication',
    activeMaterial: 'فيبندازول', 
    meatWithdrawalPeriod: 14, 
    milkWithdrawalPeriod: 5 
  },
  { 
    name: 'تيرامايسين', 
    type: 'medication',
    activeMaterial: 'أوكسي تتراسيكلين', 
    meatWithdrawalPeriod: 28, 
    milkWithdrawalPeriod: 4 
  },
  { 
    name: 'فوسبا-ت', 
    type: 'medication',
    activeMaterial: 'كبريتات الكالسيوم', 
    meatWithdrawalPeriod: 14, 
    milkWithdrawalPeriod: 2 
  },
  { 
    name: 'نوروفلوكس', 
    type: 'medication',
    activeMaterial: 'إنروفلوكساسين', 
    meatWithdrawalPeriod: 21, 
    milkWithdrawalPeriod: 4 
  },
  { 
    name: 'إيكلان', 
    type: 'medication',
    activeMaterial: 'تولترازوريل وكلوبيدول', 
    meatWithdrawalPeriod: 42, 
    milkWithdrawalPeriod: 7 
  },
  { 
    name: 'ليفاكيل', 
    type: 'medication',
    activeMaterial: 'ليفاميزول', 
    meatWithdrawalPeriod: 14, 
    milkWithdrawalPeriod: 3 
  },
  { 
    name: 'سبكتينوميسين', 
    type: 'medication',
    activeMaterial: 'سبكتينوميسين', 
    meatWithdrawalPeriod: 21, 
    milkWithdrawalPeriod: 4 
  },
  { 
    name: 'سيبرال', 
    type: 'medication',
    activeMaterial: 'سيبروفلوكساسين', 
    meatWithdrawalPeriod: 28, 
    milkWithdrawalPeriod: 5 
  },
  { 
    name: 'تراميزول', 
    type: 'medication',
    activeMaterial: 'ترايميثوبريم وسلفاميثوكسازول', 
    meatWithdrawalPeriod: 30, 
    milkWithdrawalPeriod: 5 
  },
  { 
    name: 'إيفيميك', 
    type: 'medication',
    activeMaterial: 'إيفرمكتين', 
    meatWithdrawalPeriod: 35, 
    milkWithdrawalPeriod: 7 
  },
  { 
    name: 'أوكسيفاك-20', 
    type: 'medication',
    activeMaterial: 'أوكسي تتراسيكلين', 
    meatWithdrawalPeriod: 28, 
    milkWithdrawalPeriod: 4 
  },
  { 
    name: 'فامبروز', 
    type: 'medication',
    activeMaterial: 'برازيكوانتيل وأيفرمكتين', 
    meatWithdrawalPeriod: 35, 
    milkWithdrawalPeriod: 7 
  },
  { 
    name: 'إندوميكتين', 
    type: 'medication',
    activeMaterial: 'أيفرمكتين', 
    meatWithdrawalPeriod: 42, 
    milkWithdrawalPeriod: 7 
  },
  { 
    name: 'أمفلون', 
    type: 'medication',
    activeMaterial: 'أمبسلين وفلوكساسين', 
    meatWithdrawalPeriod: 28, 
    milkWithdrawalPeriod: 5 
  }
];

/**
 * وظيفة إضافة البيانات الافتراضية للفئات
 */
const addDefaultCategories = async (userId) => {
  console.log('إضافة الفئات الافتراضية...');
  const categoryPromises = DEFAULT_CATEGORIES.map(async (category) => {
    const exists = await AnimalCategory.findOne({ 
      name: category.name,
      userId: userId
    });

    if (!exists) {
      return AnimalCategory.create({
        ...category,
        userId: userId
      });
    }
    return exists;
  });

  return Promise.all(categoryPromises);
};

/**
 * وظيفة إضافة البيانات الافتراضية للسلالات
 */
const addDefaultBreeds = async (userId, categories) => {
  console.log('إضافة السلالات الافتراضية...');
  const breedPromises = [];

  for (const category of categories) {
    const categoryBreeds = DEFAULT_BREEDS_BY_CATEGORY[category.name] || [];
    
    for (const breed of categoryBreeds) {
      const exists = await AnimalBreed.findOne({
        name: breed.name,
        categoryId: category._id,
        userId: userId
      });

      if (!exists) {
        breedPromises.push(
          AnimalBreed.create({
            ...breed,
            categoryId: category._id,
            userId: userId
          })
        );
      }
    }
  }

  return Promise.all(breedPromises);
};

/**
 * وظيفة إضافة البيانات الافتراضية لجداول التطعيم
 */
const addDefaultVaccinationSchedules = async (userId, categories) => {
  console.log('إضافة جداول التطعيم الافتراضية...');
  const schedulePromises = [];

  for (const category of categories) {
    const schedules = DEFAULT_VACCINATION_SCHEDULES[category.name] || [];
    
    for (const schedule of schedules) {
      const exists = await VaccinationSchedule.findOne({
        name: schedule.name,
        categoryId: category._id,
        userId: userId
      });

      if (!exists) {
        schedulePromises.push(
          VaccinationSchedule.create({
            ...schedule,
            categoryId: category._id,
            userId: userId
          })
        );
      }
    }
  }

  return Promise.all(schedulePromises);
};

/**
 * وظيفة إضافة البيانات الافتراضية لفترات الحظر
 */
const addDefaultWithdrawalPeriods = async (userId) => {
  console.log('إضافة فترات الحظر الافتراضية...');
  const periodPromises = COMMON_MEDICATIONS.map(async (medication) => {
    const exists = await WithdrawalPeriod.findOne({
      name: medication.name,
      userId: userId
    });

    if (!exists) {
      return WithdrawalPeriod.create({
        ...medication,
        userId: userId
      });
    }
    return exists;
  });

  return Promise.all(periodPromises);
};

/**
 * الوظيفة الرئيسية لإضافة جميع البيانات الافتراضية
 */
const initializeDefaultData = async () => {
  try {
    // الحصول على جميع المستخدمين
    const users = await User.find({});
    
    if (users.length === 0) {
      console.log('لا يوجد مستخدمين في النظام.');
      return;
    }

    // إضافة البيانات الافتراضية لكل مستخدم
    for (const user of users) {
      console.log(`إضافة البيانات الافتراضية للمستخدم: ${user.email}`);
      
      // إضافة الفئات الافتراضية
      const categories = await addDefaultCategories(user._id);
      
      // إضافة السلالات الافتراضية
      await addDefaultBreeds(user._id, categories);
      
      // إضافة جداول التطعيم الافتراضية
      await addDefaultVaccinationSchedules(user._id, categories);
      
      // إضافة فترات الحظر الافتراضية
      await addDefaultWithdrawalPeriods(user._id);
      
      console.log(`تمت إضافة البيانات الافتراضية للمستخدم: ${user.email}`);
    }

    console.log('تمت إضافة جميع البيانات الافتراضية بنجاح!');
  } catch (error) {
    console.error('حدث خطأ أثناء إضافة البيانات الافتراضية:', error);
  }
};

module.exports = initializeDefaultData;
module.exports.addDefaultCategories = addDefaultCategories;
module.exports.addDefaultBreeds = addDefaultBreeds;
module.exports.addDefaultVaccinationSchedules = addDefaultVaccinationSchedules;
module.exports.addDefaultWithdrawalPeriods = addDefaultWithdrawalPeriods;