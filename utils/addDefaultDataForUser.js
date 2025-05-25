// backend/utils/addDefaultDataForUser.js
const { 
  addDefaultCategories, 
  addDefaultBreeds, 
  addDefaultVaccinationSchedules, 
  addDefaultWithdrawalPeriods 
} = require('./initDefaultData');

/**
 * وظيفة إضافة البيانات الافتراضية لمستخدم محدد
 */
const addDefaultDataForUser = async (userId) => {
  try {
    console.log(`إضافة البيانات الافتراضية للمستخدم الجديد: ${userId}`);
    
    // إضافة الفئات الافتراضية
    const categories = await addDefaultCategories(userId);
    
    // إضافة السلالات الافتراضية
    await addDefaultBreeds(userId, categories);
    
    // إضافة جداول التطعيم الافتراضية
    await addDefaultVaccinationSchedules(userId, categories);
    
    // إضافة فترات الحظر الافتراضية
    await addDefaultWithdrawalPeriods(userId);
    
    console.log(`تمت إضافة البيانات الافتراضية للمستخدم الجديد: ${userId}`);
    return true;
  } catch (error) {
    console.error('حدث خطأ أثناء إضافة البيانات الافتراضية للمستخدم الجديد:', error);
    return false;
  }
};

module.exports = addDefaultDataForUser;