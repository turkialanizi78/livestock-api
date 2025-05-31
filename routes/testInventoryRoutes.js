// ملف اختبار API للتحقق من المخزون
const express = require('express');
const router = express.Router();
const InventoryItem = require('../models/InventoryItem');
const mongoose = require('mongoose');

// مسار اختباري للتحقق من العلف
router.get('/test-feed/:feedId', async (req, res) => {
  try {
    const feedId = req.params.feedId;
    const userId = req.query.userId;
    
    console.log('🔍 البحث عن العلف:', feedId);
    console.log('👤 معرف المستخدم:', userId);
    
    // التحقق من صحة معرف العلف
    if (!mongoose.Types.ObjectId.isValid(feedId)) {
      return res.status(400).json({
        success: false,
        message: 'معرف العلف غير صالح',
        feedId: feedId
      });
    }
    
    // البحث عن العلف بدون قيد المستخدم أولاً
    const feedWithoutUser = await InventoryItem.findById(feedId);
    
    if (!feedWithoutUser) {
      return res.status(404).json({
        success: false,
        message: 'العلف غير موجود في قاعدة البيانات بالمطلق',
        feedId: feedId
      });
    }
    
    // التحقق من نوع العنصر
    if (feedWithoutUser.itemType !== 'feed') {
      return res.status(400).json({
        success: false,
        message: 'العنصر موجود ولكنه ليس من نوع علف',
        itemType: feedWithoutUser.itemType,
        expectedType: 'feed',
        item: {
          id: feedWithoutUser._id,
          name: feedWithoutUser.name,
          itemType: feedWithoutUser.itemType,
          userId: feedWithoutUser.userId
        }
      });
    }
    
    // البحث عن العلف مع قيد المستخدم
    const feedWithUser = await InventoryItem.findOne({
      _id: feedId,
      userId: userId
    });
    
    if (!feedWithUser) {
      return res.status(403).json({
        success: false,
        message: 'العلف موجود ولكنه غير مرتبط بالمستخدم الحالي',
        feedUserId: feedWithoutUser.userId.toString(),
        currentUserId: userId,
        feed: {
          id: feedWithoutUser._id,
          name: feedWithoutUser.name,
          itemType: feedWithoutUser.itemType,
          availableQuantity: feedWithoutUser.availableQuantity,
          unit: feedWithoutUser.unit
        }
      });
    }
    
    // العلف موجود ومرتبط بالمستخدم
    return res.json({
      success: true,
      message: 'العلف موجود ومتاح للاستخدام',
      feed: {
        id: feedWithUser._id,
        name: feedWithUser.name,
        itemType: feedWithUser.itemType,
        availableQuantity: feedWithUser.availableQuantity,
        unit: feedWithUser.unit,
        unitPrice: feedWithUser.unitPrice,
        userId: feedWithUser.userId
      }
    });
    
  } catch (error) {
    console.error('خطأ في اختبار العلف:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// مسار للحصول على جميع الأعلاف المتاحة للمستخدم
router.get('/available-feeds/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    console.log('📋 البحث عن جميع الأعلاف للمستخدم:', userId);
    
    const feeds = await InventoryItem.find({
      userId: userId,
      itemType: 'feed'
    }).select('_id name availableQuantity unit unitPrice');
    
    res.json({
      success: true,
      count: feeds.length,
      feeds: feeds
    });
    
  } catch (error) {
    console.error('خطأ في جلب الأعلاف:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

module.exports = router;