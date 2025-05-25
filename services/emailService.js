// backend -- services/emailService.js
const nodemailer = require("nodemailer");
const fs = require('fs').promises;
const path = require('path');

const sendEmail = async (options) => {
  try {
    // إنشاء ناقل بريد قابل لإعادة الاستخدام
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USERNAME || "camycamat@gmail.com",
        pass: process.env.EMAIL_PASSWORD,
      },
    });
    
    // قراءة قالب HTML
    const templatePath = path.join(__dirname, '..', 'templates', `${options.template}.html`);
    let html = await fs.readFile(templatePath, 'utf-8');

    // استبدال متغيرات القالب
    if (options.templateVars) {
      Object.keys(options.templateVars).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, options.templateVars[key]);
      });
    }

    // تعريف خيارات البريد الإلكتروني
    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME || "نظام إدارة المواشي"} <${process.env.EMAIL_USERNAME || "camycamat@gmail.com"}>`,
      to: options.email,
      subject: options.subject,
      html: html,
    };

    // إرسال البريد الإلكتروني
    const info = await transporter.sendMail(mailOptions);
    console.log("تم إرسال البريد الإلكتروني:", info.messageId);
    return info;
  } catch (error) {
    console.error("خطأ في إرسال البريد الإلكتروني:", error);
    throw error;
  }
};

module.exports = sendEmail;