// reportController.js - دالة createPDFReport كاملة مع دعم جميع أنواع التقارير

// استيراد المكتبات اللازمة
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
require('moment/locale/ar-sa');
moment.locale('ar-sa');

// تحديد مسارات الخطوط العربية
const ARABIC_FONTS = {
  regular: path.join(__dirname, '../fonts/Cairo-Regular.ttf'),
  bold: path.join(__dirname, '../fonts/Cairo-Bold.ttf'),
  medium: path.join(__dirname, '../fonts/Cairo-Medium.ttf'),
  light: path.join(__dirname, '../fonts/Cairo-Light.ttf')
};

/**
 * دالة إنشاء تقرير PDF تدعم جميع أنواع التقارير واللغة العربية
 * @param {string} reportType - نوع التقرير
 * @param {object} reportData - بيانات التقرير
 * @param {object} options - خيارات إضافية
 * @returns {Promise<Buffer>} - وعد يحتوي على بيانات PDF
 */
function createPDFReport(reportType, reportData, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      // التحقق من البيانات
      if (!reportType || !reportData) {
        throw new Error('نوع التقرير أو البيانات غير محددة');
      }

      // التحقق من خيارات دعم اللغة العربية
      const useArabic = options?.arabic !== false; // افتراضيًا تمكين دعم العربية
      const useRTL = options?.rtl !== false;       // افتراضيًا تمكين RTL

      // تكوين خيارات المستند
      const docOptions = {
        autoFirstPage: false,
        bufferPages: true,
        size: 'A4',
        margin: 50,
        rtl: useRTL, // تفعيل الكتابة من اليمين لليسار
        info: {
          Title: `تقرير ${getReportTitle(reportType)}`,
          Author: 'تطبيق إدارة المواشي',
          CreationDate: new Date()
        }
      };

      // إنشاء مستند PDF جديد
      const doc = new PDFDocument(docOptions);

      // تسجيل الخطوط العربية إذا كانت متوفرة
      if (useArabic) {
        try {
          // التحقق من وجود ملفات الخطوط
          if (fs.existsSync(ARABIC_FONTS.regular)) {
            doc.registerFont('Arabic', ARABIC_FONTS.regular);
            console.log("تم تسجيل الخط العربي الأساسي");
          }
          
          if (fs.existsSync(ARABIC_FONTS.bold)) {
            doc.registerFont('ArabicBold', ARABIC_FONTS.bold);
            console.log("تم تسجيل الخط العربي العريض");
          }
          
          if (fs.existsSync(ARABIC_FONTS.medium)) {
            doc.registerFont('ArabicMedium', ARABIC_FONTS.medium);
            console.log("تم تسجيل الخط العربي المتوسط");
          }
          
          if (fs.existsSync(ARABIC_FONTS.light)) {
            doc.registerFont('ArabicLight', ARABIC_FONTS.light);
            console.log("تم تسجيل الخط العربي الخفيف");
          }
          
          // تطبيق الخط العربي كخط افتراضي
          doc.font('Arabic');
        } catch (error) {
          console.error('فشل في تحميل الخطوط العربية:', error);
          // استخدام الخط الافتراضي إذا فشل تحميل الخطوط العربية
          doc.font('Helvetica');
        }
      } else {
        // استخدام الخط الافتراضي
        doc.font('Helvetica');
      }

      // إضافة صفحة جديدة
      doc.addPage();

      // إضافة الرأس
      addReportHeader(doc, reportType, useArabic, useRTL);

      // إضافة محتوى التقرير حسب النوع
      switch (reportType) {
        case 'animalDistribution':
          addAnimalDistributionToPDF(doc, reportData, useArabic, useRTL);
          break;
        case 'healthVaccination':
          addHealthVaccinationToPDF(doc, reportData, useArabic, useRTL);
          break;
        case 'breeding':
          addBreedingToPDF(doc, reportData, useArabic, useRTL);
          break;
        case 'restrictedAnimals':
          addRestrictedAnimalsToPDF(doc, reportData, useArabic, useRTL);
          break;
        case 'financial':
          addFinancialToPDF(doc, reportData, useArabic, useRTL);
          break;
        default:
          doc.fontSize(16)
             .font(useArabic ? 'ArabicBold' : 'Helvetica-Bold')
             .text('نوع التقرير غير مدعوم', { align: useRTL ? 'right' : 'left' });
      }

      // إضافة تذييل للمستند
      addReportFooter(doc, useArabic, useRTL);

      // إضافة ترقيم الصفحات
      addPageNumbers(doc, useArabic);

      // تجميع البيانات
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      
      // عند الانتهاء، إعادة البيانات المجمعة
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });
      
      // في حالة الخطأ
      doc.on('error', (error) => {
        reject(error);
      });
      
      // إغلاق المستند
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * إضافة رأس التقرير
 * @param {PDFDocument} doc - مستند PDF
 * @param {string} reportType - نوع التقرير
 * @param {boolean} useArabic - استخدام اللغة العربية
 * @param {boolean} useRTL - استخدام اتجاه من اليمين لليسار
 */
function addReportHeader(doc, reportType, useArabic = true, useRTL = true) {
  // إضافة شعار أو صورة إذا كانت متوفرة
  // doc.image('path/to/logo.png', (useRTL ? doc.page.width - 150 : 50), 45, { width: 100 });
  
  // عنوان التقرير
  doc.fontSize(24)
     .font(useArabic ? 'ArabicBold' : 'Helvetica-Bold')
     .text(`تقرير ${getReportTitle(reportType)}`, {
       align: 'center'
     });
  
  doc.moveDown();
  
  // تاريخ التقرير
  const now = moment();
  const reportDate = now.format('LL');
  const reportTime = now.format('LT');
  
  doc.fontSize(12)
     .font(useArabic ? 'Arabic' : 'Helvetica')
     .text(`تاريخ التقرير: ${reportDate} - ${reportTime}`, {
       align: 'center'
     });
  
  // خط فاصل أفقي
  doc.moveTo(50, doc.y + 20)
     .lineTo(doc.page.width - 50, doc.y + 20)
     .stroke();
  
  doc.moveDown(2);
}

/**
 * إضافة تذييل التقرير
 * @param {PDFDocument} doc - مستند PDF
 * @param {boolean} useArabic - استخدام اللغة العربية
 * @param {boolean} useRTL - استخدام اتجاه من اليمين لليسار
 */
function addReportFooter(doc, useArabic = true, useRTL = true) {
  const footerPosition = doc.page.height - 50;
  
  // خط فاصل أفقي
  doc.moveTo(50, footerPosition - 20)
     .lineTo(doc.page.width - 50, footerPosition - 20)
     .stroke();
  
  // نص التذييل
  doc.fontSize(10)
     .font(useArabic ? 'Arabic' : 'Helvetica')
     .text('جميع الحقوق محفوظة © تطبيق إدارة المواشي', 0, footerPosition, {
       align: 'center',
       width: doc.page.width
     });
}

/**
 * إضافة أرقام الصفحات
 * @param {PDFDocument} doc - مستند PDF
 * @param {boolean} useArabic - استخدام اللغة العربية
 */
function addPageNumbers(doc, useArabic = true) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    
    doc.fontSize(10)
       .font(useArabic ? 'Arabic' : 'Helvetica')
       .text(
         `الصفحة ${i + 1} من ${pages.count}`,
         0,
         doc.page.height - 70,
         { align: 'center', width: doc.page.width }
       );
  }
}

/**
 * الحصول على عنوان التقرير حسب النوع
 * @param {string} reportType - نوع التقرير
 * @returns {string} - عنوان التقرير
 */
function getReportTitle(reportType) {
  const titles = {
    animalDistribution: 'توزيع الحيوانات',
    healthVaccination: 'التطعيمات والصحة',
    breeding: 'التكاثر',
    restrictedAnimals: 'الحيوانات المحظورة',
    financial: 'مالي'
  };
  
  return titles[reportType] || 'تقرير';
}

/**
 * إنشاء دالة لرسم جدول عام في PDF
 * @param {PDFDocument} doc - مستند PDF
 * @param {Array} headers - رؤوس الجدول
 * @param {Array} rows - صفوف البيانات
 * @param {number} startY - موقع بداية الجدول
 * @param {boolean} useArabic - استخدام اللغة العربية
 * @param {boolean} useRTL - استخدام اتجاه من اليمين لليسار
 * @returns {number} - موقع نهاية الجدول
 */
function drawTable(doc, headers, rows, startY, useArabic = true, useRTL = true) {
  const cellPadding = 8;
  const colWidth = (doc.page.width - 100) / headers.length;
  let y = startY;

  // رسم رؤوس الجدول
  doc.font(useArabic ? 'ArabicBold' : 'Helvetica-Bold')
     .fontSize(11);

  // رسم خلفية الرأس
  doc.fillColor('#f2f2f2')
     .rect(50, y, doc.page.width - 100, 30)
     .fill();
  
  doc.fillColor('#000000');

  if (useRTL) {
    // رسم الرؤوس من اليمين لليسار
    headers.forEach((header, i) => {
      const x = doc.page.width - 50 - (i + 1) * colWidth;
      doc.text(header, x + cellPadding, y + cellPadding, { width: colWidth - 2 * cellPadding });
    });
  } else {
    // رسم الرؤوس من اليسار لليمين
    headers.forEach((header, i) => {
      const x = 50 + i * colWidth;
      doc.text(header, x + cellPadding, y + cellPadding, { width: colWidth - 2 * cellPadding });
    });
  }

  // خط أفقي بعد الرؤوس
  y += 30;
  doc.moveTo(50, y)
     .lineTo(doc.page.width - 50, y)
     .stroke();

  // رسم صفوف البيانات
  doc.font(useArabic ? 'Arabic' : 'Helvetica')
     .fontSize(10);

  rows.forEach((row, rowIndex) => {
    const rowHeight = 25;
    let maxY = y + cellPadding;

    // التحقق من الحاجة لصفحة جديدة
    if (y + rowHeight > doc.page.height - 70) {
      doc.addPage();
      y = 50;
      
      // رسم رؤوس الجدول مرة أخرى في الصفحة الجديدة
      doc.font(useArabic ? 'ArabicBold' : 'Helvetica-Bold')
         .fontSize(11);
         
      doc.fillColor('#f2f2f2')
         .rect(50, y, doc.page.width - 100, 30)
         .fill();
      
      doc.fillColor('#000000');
      
      if (useRTL) {
        headers.forEach((header, i) => {
          const x = doc.page.width - 50 - (i + 1) * colWidth;
          doc.text(header, x + cellPadding, y + cellPadding, { width: colWidth - 2 * cellPadding });
        });
      } else {
        headers.forEach((header, i) => {
          const x = 50 + i * colWidth;
          doc.text(header, x + cellPadding, y + cellPadding, { width: colWidth - 2 * cellPadding });
        });
      }
      
      y += 30;
      doc.moveTo(50, y)
         .lineTo(doc.page.width - 50, y)
         .stroke();
      
      doc.font(useArabic ? 'Arabic' : 'Helvetica')
         .fontSize(10);
    }

    // تظليل الصفوف البديلة
    if (rowIndex % 2 === 1) {
      doc.fillColor('#f9f9f9')
         .rect(50, y, doc.page.width - 100, rowHeight)
         .fill();
      
      doc.fillColor('#000000');
    }

    // رسم بيانات الصف
    if (useRTL) {
      row.forEach((cell, i) => {
        const x = doc.page.width - 50 - (i + 1) * colWidth;
        doc.text(cell.toString(), x + cellPadding, y + cellPadding, { width: colWidth - 2 * cellPadding });
        
        const textHeight = doc.heightOfString(cell.toString(), { width: colWidth - 2 * cellPadding });
        if (y + cellPadding + textHeight > maxY) {
          maxY = y + cellPadding + textHeight;
        }
      });
    } else {
      row.forEach((cell, i) => {
        const x = 50 + i * colWidth;
        doc.text(cell.toString(), x + cellPadding, y + cellPadding, { width: colWidth - 2 * cellPadding });
        
        const textHeight = doc.heightOfString(cell.toString(), { width: colWidth - 2 * cellPadding });
        if (y + cellPadding + textHeight > maxY) {
          maxY = y + cellPadding + textHeight;
        }
      });
    }

    // تحديث موقع الصف التالي
    y = Math.max(maxY + cellPadding, y + rowHeight);
    
    // رسم خط أفقي بعد كل صف
    doc.moveTo(50, y)
       .lineTo(doc.page.width - 50, y)
       .stroke();
  });

  // رسم خطوط عمودية
  let x = 50;
  for (let i = 0; i <= headers.length; i++) {
    doc.moveTo(x, startY)
       .lineTo(x, y)
       .stroke();
    
    x += colWidth;
  }

  return y + 10;
}

/**
 * إضافة عنوان قسم
 * @param {PDFDocument} doc - مستند PDF
 * @param {string} title - عنوان القسم
 * @param {boolean} useArabic - استخدام اللغة العربية
 * @param {boolean} useRTL - استخدام اتجاه من اليمين لليسار
 */
function addSectionTitle(doc, title, useArabic = true, useRTL = true) {
  doc.fontSize(16)
     .font(useArabic ? 'ArabicBold' : 'Helvetica-Bold')
     .text(title, {
       align: useRTL ? 'right' : 'left'
     });
  
  doc.moveDown(0.5);
}

/**
 * دالة لإضافة محتوى تقرير توزيع الحيوانات إلى PDF
 * @param {PDFDocument} doc - مستند PDF
 * @param {object} data - بيانات التقرير
 * @param {boolean} useArabic - استخدام اللغة العربية
 * @param {boolean} useRTL - استخدام اتجاه من اليمين لليسار
 */
function addAnimalDistributionToPDF(doc, data, useArabic = true, useRTL = true) {
  // ملخص الإحصائيات
  addSectionTitle(doc, 'ملخص الإحصائيات', useArabic, useRTL);
  
  doc.font(useArabic ? 'Arabic' : 'Helvetica')
     .fontSize(12);
  
  const summaryData = [
    { key: 'إجمالي الحيوانات:', value: data.totalAnimals || 0 },
    { key: 'الحيوانات الحية:', value: data.aliveAnimals || 0 },
    { key: 'الحيوانات المباعة:', value: data.soldAnimals || 0 },
    { key: 'الحيوانات النافقة:', value: data.deadAnimals || 0 },
    { key: 'الحيوانات المذبوحة:', value: data.slaughteredAnimals || 0 },
    { key: 'الحيوانات المحظورة:', value: data.restrictedAnimals || 0 }
  ];
  
  summaryData.forEach(item => {
    if (useRTL) {
      doc.text(`${item.key} ${item.value}`, { align: 'right' });
    } else {
      doc.text(`${item.key} ${item.value}`, { align: 'left' });
    }
  });
  
  doc.moveDown();
  
  // توزيع حسب الفئة
  if (data.byCategory && data.byCategory.length > 0) {
    addSectionTitle(doc, 'توزيع الحيوانات حسب الفئة', useArabic, useRTL);
    
    const headers = ['الفئة', 'العدد'];
    const rows = data.byCategory.map(category => [category.category, category.count]);
    
    const endY = drawTable(doc, headers, rows, doc.y, useArabic, useRTL);
    doc.y = endY;
    doc.moveDown();
  }
  
  // توزيع حسب السلالة
  if (data.byBreed && data.byBreed.length > 0) {
    addSectionTitle(doc, 'توزيع الحيوانات حسب السلالة', useArabic, useRTL);
    
    const headers = ['السلالة', 'العدد'];
    const rows = data.byBreed.map(breed => [breed.breed, breed.count]);
    
    const endY = drawTable(doc, headers, rows, doc.y, useArabic, useRTL);
    doc.y = endY;
    doc.moveDown();
  }
  
  // توزيع حسب الجنس
  if (data.byGender && data.byGender.length > 0) {
    addSectionTitle(doc, 'توزيع الحيوانات حسب الجنس', useArabic, useRTL);
    
    const headers = ['الجنس', 'العدد'];
    const rows = data.byGender.map(gender => [
      (gender._id === 'male' ? 'ذكر' : 'أنثى'),
      gender.count
    ]);
    
    const endY = drawTable(doc, headers, rows, doc.y, useArabic, useRTL);
    doc.y = endY;
    doc.moveDown();
  }
  
  // توزيع حسب العمر
  if (data.byAge && data.byAge.length > 0) {
    addSectionTitle(doc, 'توزيع الحيوانات حسب العمر', useArabic, useRTL);
    
    const headers = ['الفئة العمرية', 'العدد'];
    const rows = data.byAge.map(age => [age._id, age.count]);
    
    const endY = drawTable(doc, headers, rows, doc.y, useArabic, useRTL);
    doc.y = endY;
    doc.moveDown();
  }
  
  // توزيع حسب الحالة
  if (data.byStatus && data.byStatus.length > 0) {
    addSectionTitle(doc, 'توزيع الحيوانات حسب الحالة', useArabic, useRTL);
    
    const headers = ['الحالة', 'العدد'];
    const rows = data.byStatus.map(status => {
      let statusName;
      switch (status._id) {
        case 'alive': statusName = 'حي'; break;
        case 'sold': statusName = 'مباع'; break;
        case 'dead': statusName = 'نافق'; break;
        case 'slaughtered': statusName = 'مذبوح'; break;
        default: statusName = status._id;
      }
      return [statusName, status.count];
    });
    
    const endY = drawTable(doc, headers, rows, doc.y, useArabic, useRTL);
    doc.y = endY;
  }
}

/**
 * دالة لإضافة محتوى تقرير التطعيمات والصحة إلى PDF
 * @param {PDFDocument} doc - مستند PDF
 * @param {object} data - بيانات التقرير
 * @param {boolean} useArabic - استخدام اللغة العربية
 * @param {boolean} useRTL - استخدام اتجاه من اليمين لليسار
 */
function addHealthVaccinationToPDF(doc, data, useArabic = true, useRTL = true) {
  // ملخص إحصائيات التطعيمات
  addSectionTitle(doc, 'إحصائيات التطعيمات', useArabic, useRTL);
  
  doc.font(useArabic ? 'Arabic' : 'Helvetica')
     .fontSize(12);
  
  const vacStats = data.vaccinationStats || { total: 0, completed: 0, pending: 0, delayed: 0 };
  const summaryData = [
    { key: 'إجمالي التطعيمات:', value: vacStats.total },
    { key: 'التطعيمات المكتملة:', value: vacStats.completed },
    { key: 'التطعيمات المعلقة:', value: vacStats.pending },
    { key: 'التطعيمات المتأخرة:', value: vacStats.delayed }
  ];
  
  summaryData.forEach(item => {
    if (useRTL) {
      doc.text(`${item.key} ${item.value}`, { align: 'right' });
    } else {
      doc.text(`${item.key} ${item.value}`, { align: 'left' });
    }
  });
  
  doc.moveDown();
  
  // التطعيمات حسب النوع
  if (data.vaccinationsByName && data.vaccinationsByName.length > 0) {
    addSectionTitle(doc, 'التطعيمات حسب النوع', useArabic, useRTL);
    
    const headers = ['اسم التطعيم', 'الإجمالي', 'مكتمل', 'معلق', 'متأخر'];
    const rows = data.vaccinationsByName.map(vac => [
      vac._id,
      vac.total,
      vac.completed,
      vac.pending,
      vac.delayed
    ]);
    
    const endY = drawTable(doc, headers, rows, doc.y, useArabic, useRTL);
    doc.y = endY;
    doc.moveDown();
  }
  
  // إحصائيات الأحداث الصحية
  addSectionTitle(doc, 'إحصائيات الأحداث الصحية', useArabic, useRTL);
  
  doc.font(useArabic ? 'Arabic' : 'Helvetica')
     .fontSize(12);
  
  doc.text(`إجمالي الأحداث الصحية: ${data.healthEventStats?.total || 0}`, { align: useRTL ? 'right' : 'left' });
  doc.moveDown();
  
  // الأحداث الصحية حسب النوع
  if (data.healthEventStats?.byType && data.healthEventStats.byType.length > 0) {
    addSectionTitle(doc, 'الأحداث الصحية حسب النوع', useArabic, useRTL);
    
    const headers = ['النوع', 'العدد'];
    const rows = data.healthEventStats.byType.map(event => {
      let typeName;
      switch (event._id) {
        case 'disease': typeName = 'مرض'; break;
        case 'injury': typeName = 'إصابة'; break;
        case 'treatment': typeName = 'علاج'; break;
        case 'examination': typeName = 'فحص'; break;
        default: typeName = event._id;
      }
      return [typeName, event.count];
    });
    
    const endY = drawTable(doc, headers, rows, doc.y, useArabic, useRTL);
    doc.y = endY;
    doc.moveDown();
  }
  
  // الأحداث الصحية حسب الشدة
  if (data.healthEventStats?.bySeverity && data.healthEventStats.bySeverity.length > 0) {
    addSectionTitle(doc, 'الأحداث الصحية حسب الشدة', useArabic, useRTL);
    
    const headers = ['شدة الحالة', 'العدد'];
    const rows = data.healthEventStats.bySeverity.map(severity => {
      let severityName;
      switch (severity._id) {
        case 'low': severityName = 'منخفضة'; break;
        case 'medium': severityName = 'متوسطة'; break;
        case 'high': severityName = 'عالية'; break;
        default: severityName = severity._id;
      }
      return [severityName, severity.count];
    });
    
    const endY = drawTable(doc, headers, rows, doc.y, useArabic, useRTL);
    doc.y = endY;
  }
}

/**
 * دالة لإضافة محتوى تقرير التكاثر إلى PDF
 * @param {PDFDocument} doc - مستند PDF
 * @param {object} data - بيانات التقرير
 * @param {boolean} useArabic - استخدام اللغة العربية
 * @param {boolean} useRTL - استخدام اتجاه من اليمين لليسار
 */
function addBreedingToPDF(doc, data, useArabic = true, useRTL = true) {
  // إحصائيات أحداث التكاثر
  addSectionTitle(doc, 'إحصائيات أحداث التكاثر', useArabic, useRTL);
  
  doc.font(useArabic ? 'Arabic' : 'Helvetica')
     .fontSize(12);
  
  doc.text(`إجمالي أحداث التكاثر: ${data.breedingEventStats?.total || 0}`, { align: useRTL ? 'right' : 'left' });
  doc.moveDown();
  
  // أحداث التكاثر حسب النوع
  if (data.breedingEventStats?.byType && data.breedingEventStats.byType.length > 0) {
    addSectionTitle(doc, 'أحداث التكاثر حسب النوع', useArabic, useRTL);
    
    const headers = ['النوع', 'العدد'];
    const rows = data.breedingEventStats.byType.map(event => {
      let typeName;
      switch (event._id) {
        case 'mating': typeName = 'تلقيح'; break;
        case 'pregnancy': typeName = 'حمل'; break;
        case 'birth': typeName = 'ولادة'; break;
        case 'abortion': typeName = 'إجهاض'; break;
        default: typeName = event._id;
      }
      return [typeName, event.count];
    });
    
    const endY = drawTable(doc, headers, rows, doc.y, useArabic, useRTL);
    doc.y = endY;
    doc.moveDown();
  }
  
  // إحصائيات الولادات
  addSectionTitle(doc, 'إحصائيات الولادات', useArabic, useRTL);
  
  const totalLivingOffspring = data.birthStats?.totalLivingOffspring?.length > 0 
    ? data.birthStats.totalLivingOffspring[0].count : 0;
  
  const totalDeadOffspring = data.birthStats?.totalDeadOffspring?.length > 0 
    ? data.birthStats.totalDeadOffspring[0].count : 0;
  
  const birthSummary = [
    { key: 'إجمالي الولادات:', value: data.birthStats?.total || 0 },
    { key: 'إجمالي المواليد الحية:', value: totalLivingOffspring },
    { key: 'إجمالي المواليد النافقة:', value: totalDeadOffspring }
  ];
  
  doc.font(useArabic ? 'Arabic' : 'Helvetica')
     .fontSize(12);
  
  birthSummary.forEach(item => {
    doc.text(`${item.key} ${item.value}`, { align: useRTL ? 'right' : 'left' });
  });
  
  doc.moveDown();
  
  // التكاثر حسب الفئة
  if (data.breedingStatsByCategory && data.breedingStatsByCategory.length > 0) {
    addSectionTitle(doc, 'إحصائيات التكاثر حسب الفئة', useArabic, useRTL);
    
    const headers = ['الفئة', 'عدد الولادات', 'المواليد الحية', 'المواليد النافقة'];
    const rows = data.breedingStatsByCategory.map(category => [
      category._id,
      category.count,
      category.livingOffspringCount || 0,
      category.deadOffspringCount || 0
    ]);
    
    const endY = drawTable(doc, headers, rows, doc.y, useArabic, useRTL);
    doc.y = endY;
    doc.moveDown();
  }
  
  // أعلى الإناث إنتاجًا
  if (data.topFemales && data.topFemales.length > 0) {
    addSectionTitle(doc, 'أعلى الإناث إنتاجًا', useArabic, useRTL);
    
    const headers = ['رقم التعريف', 'عدد الولادات', 'المواليد الحية', 'المواليد النافقة'];
    const rows = data.topFemales.map(female => [
      female.identificationNumber,
      female.birthCount,
      female.totalLivingOffspring,
      female.totalDeadOffspring
    ]);
    
    const endY = drawTable(doc, headers, rows, doc.y, useArabic, useRTL);
    doc.y = endY;
  }
}

/**
 * دالة لإضافة محتوى تقرير الحيوانات المحظورة إلى PDF
 * @param {PDFDocument} doc - مستند PDF
 * @param {object} data - بيانات التقرير
 * @param {boolean} useArabic - استخدام اللغة العربية
 * @param {boolean} useRTL - استخدام اتجاه من اليمين لليسار
 */
function addRestrictedAnimalsToPDF(doc, data, useArabic = true, useRTL = true) {
  // ملخص
  addSectionTitle(doc, 'ملخص', useArabic, useRTL);
  
  doc.font(useArabic ? 'Arabic' : 'Helvetica')
     .fontSize(12);
  
  doc.text(`إجمالي الحيوانات المحظورة: ${data.restrictedStats?.total || 0}`, { align: useRTL ? 'right' : 'left' });
  doc.moveDown();
  
  // الحيوانات المحظورة حسب السبب
  if (data.restrictedStats?.byReason && data.restrictedStats.byReason.length > 0) {
    addSectionTitle(doc, 'الحيوانات المحظورة حسب السبب', useArabic, useRTL);
    
    const headers = ['السبب', 'العدد'];
    const rows = data.restrictedStats.byReason.map(reason => {
      let reasonName;
      switch (reason._id) {
        case 'vaccination': reasonName = 'تطعيم'; break;
        case 'treatment': reasonName = 'علاج'; break;
        case 'other': reasonName = 'أخرى'; break;
        default: reasonName = reason._id;
      }
      return [reasonName, reason.count];
    });
    
    const endY = drawTable(doc, headers, rows, doc.y, useArabic, useRTL);
    doc.y = endY;
    doc.moveDown();
  }
  
  // الحيوانات المحظورة حسب الفئة
  if (data.restrictedStats?.byCategory && data.restrictedStats.byCategory.length > 0) {
    addSectionTitle(doc, 'الحيوانات المحظورة حسب الفئة', useArabic, useRTL);
    
    const headers = ['الفئة', 'العدد'];
    const rows = data.restrictedStats.byCategory.map(category => [
      category.category,
      category.count
    ]);
    
    const endY = drawTable(doc, headers, rows, doc.y, useArabic, useRTL);
    doc.y = endY;
    doc.moveDown();
  }
  
  // قائمة الحيوانات المحظورة
  if (data.restrictedAnimals && data.restrictedAnimals.length > 0) {
    addSectionTitle(doc, 'قائمة الحيوانات المحظورة', useArabic, useRTL);
    
    const headers = ['رقم التعريف', 'الفئة', 'السلالة', 'سبب الحظر', 'تاريخ انتهاء الحظر', 'الأيام المتبقية'];
    const rows = data.restrictedAnimals.map(animal => {
      let reasonName;
      switch (animal.restrictionReason) {
        case 'vaccination': reasonName = 'تطعيم'; break;
        case 'treatment': reasonName = 'علاج'; break;
        case 'other': reasonName = 'أخرى'; break;
        default: reasonName = animal.restrictionReason;
      }
      
      return [
        animal.identificationNumber,
        animal.category,
        animal.breed,
        reasonName,
        moment(animal.restrictionEndDate).format('DD/MM/YYYY'),
        animal.daysRemaining
      ];
    });
    
    const endY = drawTable(doc, headers, rows, doc.y, useArabic, useRTL);
    doc.y = endY;
    doc.moveDown();
  }
  
  // الحيوانات التي تنتهي فترة حظرها قريبًا
  if (data.endingSoonAnimals && data.endingSoonAnimals.length > 0) {
    addSectionTitle(doc, 'الحيوانات التي تنتهي فترة حظرها قريبًا', useArabic, useRTL);
    
    const headers = ['رقم التعريف', 'الفئة', 'السلالة', 'تاريخ انتهاء الحظر', 'الأيام المتبقية'];
    const rows = data.endingSoonAnimals.map(animal => [
      animal.identificationNumber,
      animal.category,
      animal.breed,
      moment(animal.restrictionEndDate).format('DD/MM/YYYY'),
      animal.daysRemaining
    ]);
    
    const endY = drawTable(doc, headers, rows, doc.y, useArabic, useRTL);
    doc.y = endY;
  }
}

/**
 * دالة لإضافة محتوى التقرير المالي إلى PDF
 * @param {PDFDocument} doc - مستند PDF
 * @param {object} data - بيانات التقرير
 * @param {boolean} useArabic - استخدام اللغة العربية
 * @param {boolean} useRTL - استخدام اتجاه من اليمين لليسار
 */
function addFinancialToPDF(doc, data, useArabic = true, useRTL = true) {
  // ملخص المالي
  addSectionTitle(doc, 'الملخص المالي', useArabic, useRTL);
  
  doc.font(useArabic ? 'Arabic' : 'Helvetica')
     .fontSize(12);
  
  const summaryData = [
    { key: 'إجمالي الإيرادات:', value: data.totalIncome.toFixed(2) },
    { key: 'إجمالي النفقات:', value: data.totalExpense.toFixed(2) },
    { key: 'صافي الربح:', value: data.profit.toFixed(2) }
  ];
  
  summaryData.forEach(item => {
    if (useRTL) {
      doc.text(`${item.key} ${item.value}`, { align: 'right' });
    } else {
      doc.text(`${item.key} ${item.value}`, { align: 'left' });
    }
  });
  
  doc.moveDown();
  
  // الإيرادات حسب الفئة
  if (data.incomeByCategory && data.incomeByCategory.length > 0) {
    addSectionTitle(doc, 'الإيرادات حسب الفئة', useArabic, useRTL);
    
    const headers = ['الفئة', 'المبلغ'];
    const rows = data.incomeByCategory.map(category => {
      let categoryName;
      switch (category._id) {
        case 'sale': categoryName = 'بيع'; break;
        case 'milk': categoryName = 'حليب'; break;
        case 'wool': categoryName = 'صوف'; break;
        case 'other': categoryName = 'أخرى'; break;
        default: categoryName = category._id;
      }
      return [categoryName, category.total.toFixed(2)];
    });
    
    const endY = drawTable(doc, headers, rows, doc.y, useArabic, useRTL);
    doc.y = endY;
    doc.moveDown();
  }
  
  // النفقات حسب الفئة
  if (data.expenseByCategory && data.expenseByCategory.length > 0) {
    addSectionTitle(doc, 'النفقات حسب الفئة', useArabic, useRTL);
    
    const headers = ['الفئة', 'المبلغ'];
    const rows = data.expenseByCategory.map(category => {
      let categoryName;
      switch (category._id) {
        case 'feed': categoryName = 'علف'; break;
        case 'medication': categoryName = 'أدوية'; break;
        case 'vaccination': categoryName = 'تطعيمات'; break;
        case 'purchase': categoryName = 'شراء'; break;
        case 'other': categoryName = 'أخرى'; break;
        default: categoryName = category._id;
      }
      return [categoryName, category.total.toFixed(2)];
    });
    
    const endY = drawTable(doc, headers, rows, doc.y, useArabic, useRTL);
    doc.y = endY;
    doc.moveDown();
  }
  
  // التحليل الشهري
  if (data.monthlyAnalysis && data.monthlyAnalysis.length > 0) {
    addSectionTitle(doc, 'التحليل الشهري', useArabic, useRTL);
    
    const headers = ['الشهر', 'الإيرادات', 'النفقات', 'الربح'];
    const rows = data.monthlyAnalysis.map(month => {
      const monthName = moment(`${month.year}-${month.month}-01`).format('MMMM YYYY');
      const profit = month.income - month.expense;
      
      return [
        monthName,
        month.income.toFixed(2),
        month.expense.toFixed(2),
        profit.toFixed(2)
      ];
    });
    
    const endY = drawTable(doc, headers, rows, doc.y, useArabic, useRTL);
    doc.y = endY;
    doc.moveDown();
  }
  
  // الإيرادات حسب الحيوان
  if (data.incomeByAnimal && data.incomeByAnimal.length > 0) {
    addSectionTitle(doc, 'الإيرادات حسب الحيوان', useArabic, useRTL);
    
    const headers = ['رقم التعريف', 'المبلغ'];
    const rows = data.incomeByAnimal.map(animal => [
      animal.identificationNumber,
      animal.total.toFixed(2)
    ]);
    
    const endY = drawTable(doc, headers, rows, doc.y, useArabic, useRTL);
    doc.y = endY;
    doc.moveDown();
  }
  
  // النفقات حسب الحيوان
  if (data.expenseByAnimal && data.expenseByAnimal.length > 0) {
    addSectionTitle(doc, 'النفقات حسب الحيوان', useArabic, useRTL);
    
    const headers = ['رقم التعريف', 'المبلغ'];
    const rows = data.expenseByAnimal.map(animal => [
      animal.identificationNumber,
      animal.total.toFixed(2)
    ]);
    
    const endY = drawTable(doc, headers, rows, doc.y, useArabic, useRTL);
    doc.y = endY;
  }
}

// تصدير الدوال
module.exports = {
  createPDFReport
};