const FinancialRecord = require('../models/FinancialRecord');
const mongoose = require('mongoose');

// Get all financial records for a user
const getAllFinancialRecords = async (req, res) => {
  try {
    const { type, category, startDate, endDate, animalId, page = 1, limit = 10 } = req.query;
    const userId = req.user._id;

    // Build query
    const query = { userId };

    if (type) {
      query.type = type;
    }

    if (category) {
      query.category = category;
    }

    if (animalId) {
      query.animalId = animalId;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const [records, total] = await Promise.all([
      FinancialRecord.find(query)
        .populate('animalId', 'name identifier')
        .populate('relatedInventoryId', 'name')
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      FinancialRecord.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching financial records:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching financial records',
      error: error.message
    });
  }
};

// Get financial summary
const getFinancialSummary = async (req, res) => {
  try {
    const { startDate, endDate, animalId } = req.query;
    const userId = req.user._id;

    // Build match query
    const matchQuery = { userId };

    if (animalId) {
      matchQuery.animalId = mongoose.Types.ObjectId(animalId);
    }

    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) {
        matchQuery.date.$gte = new Date(startDate);
      }
      if (endDate) {
        matchQuery.date.$lte = new Date(endDate);
      }
    }

    // Aggregate financial data
    const summaryPipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      }
    ];

    const categoryPipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: {
            type: '$type',
            category: '$category'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { total: -1 }
      }
    ];

    const monthlyPipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            type: '$type'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': -1, '_id.month': -1 }
      }
    ];

    const [summary, categoryBreakdown, monthlyTrend] = await Promise.all([
      FinancialRecord.aggregate(summaryPipeline),
      FinancialRecord.aggregate(categoryPipeline),
      FinancialRecord.aggregate(monthlyPipeline)
    ]);

    // Calculate totals
    let totalIncome = 0;
    let totalExpense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    summary.forEach(item => {
      if (item._id === 'income') {
        totalIncome = item.total;
        incomeCount = item.count;
      } else if (item._id === 'expense') {
        totalExpense = item.total;
        expenseCount = item.count;
      }
    });

    const netBalance = totalIncome - totalExpense;

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalIncome,
          totalExpense,
          netBalance,
          incomeCount,
          expenseCount,
          totalTransactions: incomeCount + expenseCount
        },
        categoryBreakdown,
        monthlyTrend
      }
    });
  } catch (error) {
    console.error('Error fetching financial summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching financial summary',
      error: error.message
    });
  }
};

// Get single financial record
const getFinancialRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const record = await FinancialRecord.findOne({ _id: id, userId })
      .populate('animalId', 'name identifier type')
      .populate('relatedInventoryId', 'name quantity unit')
      .lean();

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Financial record not found'
      });
    }

    res.status(200).json({
      success: true,
      data: record
    });
  } catch (error) {
    console.error('Error fetching financial record:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching financial record',
      error: error.message
    });
  }
};

// Create new financial record
const createFinancialRecord = async (req, res) => {
  try {
    const userId = req.user._id;
    const recordData = {
      ...req.body,
      userId
    };

    // Validate required fields
    if (!recordData.type || !recordData.category || !recordData.amount) {
      return res.status(400).json({
        success: false,
        message: 'Type, category, and amount are required'
      });
    }

    // Create the record
    const newRecord = new FinancialRecord(recordData);
    await newRecord.save();

    // Populate and return the created record
    const populatedRecord = await FinancialRecord.findById(newRecord._id)
      .populate('animalId', 'name identifier')
      .populate('relatedInventoryId', 'name')
      .lean();

    res.status(201).json({
      success: true,
      message: 'Financial record created successfully',
      data: populatedRecord
    });
  } catch (error) {
    console.error('Error creating financial record:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating financial record',
      error: error.message
    });
  }
};

// Update financial record
const updateFinancialRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData._id;
    delete updateData.userId;
    delete updateData.createdAt;

    // Find and update the record
    const updatedRecord = await FinancialRecord.findOneAndUpdate(
      { _id: id, userId },
      updateData,
      { new: true, runValidators: true }
    )
      .populate('animalId', 'name identifier')
      .populate('relatedInventoryId', 'name')
      .lean();

    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        message: 'Financial record not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Financial record updated successfully',
      data: updatedRecord
    });
  } catch (error) {
    console.error('Error updating financial record:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating financial record',
      error: error.message
    });
  }
};

// Delete financial record
const deleteFinancialRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const deletedRecord = await FinancialRecord.findOneAndDelete({ _id: id, userId });

    if (!deletedRecord) {
      return res.status(404).json({
        success: false,
        message: 'Financial record not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Financial record deleted successfully',
      data: deletedRecord
    });
  } catch (error) {
    console.error('Error deleting financial record:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting financial record',
      error: error.message
    });
  }
};

// Export all functions
module.exports = {
  getAllFinancialRecords,
  getFinancialSummary,
  getFinancialRecord,
  createFinancialRecord,
  updateFinancialRecord,
  deleteFinancialRecord
};