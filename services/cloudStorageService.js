// backend/services/cloudStorageService.js
const { Storage } = require('@google-cloud/storage');
const uuid = require('uuid').v4;
require('dotenv').config();

// إنشاء كائن Storage
let storage;
try {
  const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('GOOGLE_CLOUD_PRIVATE_KEY is not set in environment variables');
  }
  
  storage = new Storage({
    credentials: {
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      private_key: privateKey.replace(/\\n/g, '\n'),
    },
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
  });
} catch (error) {
  console.error('Error initializing Google Cloud Storage:', error);
}

// const bucket = storage ? storage.bucket(process.env.GOOGLE_CLOUD_BUCKET_NAME) : null;
const bucket = storage ? storage.bucket('used-app-bucket') : null; // replace with your bucket name
// رفع صورة واحدة
exports.uploadImage = async (file, folder = 'profile-images') => {
  try {
    if (!bucket) {
      throw new Error('Google Cloud Storage is not initialized');
    }

    const fileName = `${folder}/${uuid()}-${file.originalname}`;
    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({
      resumable: false,
    });

    return new Promise((resolve, reject) => {
      blobStream.on('error', (err) => {
        console.error('Blob stream error:', err);
        reject(err);
      });

      blobStream.on('finish', () => {
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
        resolve(publicUrl);
      });

      blobStream.end(file.buffer);
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

// حذف صورة
exports.deleteImage = async (imageUrl) => {
  try {
    if (!bucket || !imageUrl) {
      console.log('No bucket or image URL provided');
      return false;
    }

    // تجاهل الصورة الافتراضية
    if (imageUrl.includes('default.jpg')) {
      console.log('Skipping deletion of default image');
      return true;
    }

    // استخراج اسم الملف من الرابط
    const urlParts = imageUrl.split('/');
    const fileName = urlParts.slice(4).join('/'); // تخطي protocol, domain, bucket
    
    try {
      await bucket.file(fileName).delete();
      console.log(`Successfully deleted image: ${fileName}`);
      return true;
    } catch (error) {
      // تسجيل الخطأ ولكن لا تفشل العملية
      console.error('Error deleting image:', error);
      
      // نتجاهل خطأ 403 ونعتبر العملية ناجحة (الملف قد لا يكون موجوداً)
      if (error.code === 403 || error.code === 404) {
        console.log('Image might not exist or insufficient permissions. Continuing with profile update.');
        return true;
      }
      
      // إرجاع false لأي أخطاء أخرى
      return false;
    }
  } catch (error) {
    console.error('Error in deleteImage function:', error);
    // نعيد true لتجنب فشل عملية التحديث
    return true;
  }
};