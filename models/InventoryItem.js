// models/InventoryItem.js
const mongoose = require('mongoose');

const InventoryItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'يرجى إدخال اسم العنصر'],
    trim: true
  },
  itemType: {
    type: String,
    enum: ['feed', 'medicine', 'vaccine', 'equipment', 'other'],
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  unit: {
    type: String,
    enum: ['kg', 'l', 'ml', 'piece', 'package', 'dose'],
    required: true
  },
  availableQuantity: {
    type: Number,
    required: true,
    default: 0
  },
  lowStockThreshold: {
    type: Number,
    default: 0
  },
  isLowStock: {
    type: Boolean,
    default: false
  },
  unitPrice: {
    type: Number,
    default: 0
  },
  purchaseDate: {
    type: Date
  },
  expiryDate: {
    type: Date
  },
  supplier: {
    type: String,
    trim: true
  },
  storageLocation: {
    type: String,
    trim: true
  },
  meatWithdrawalInfo: {
    type: Number, // بالأيام
    default: 0
  },
  milkWithdrawalInfo: {
    type: Number, // بالأيام
    default: 0
  },
  notes: {
    type: String
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// التحقق من حالة المخزون المنخفض عند تغيير الكمية
InventoryItemSchema.pre('save', function(next) {
  if (this.isModified('availableQuantity') || this.isModified('lowStockThreshold')) {
    this.isLowStock = this.availableQuantity <= this.lowStockThreshold;
  }
  next();
});

const InventoryItem = mongoose.model('InventoryItem', InventoryItemSchema);

module.exports = InventoryItem;