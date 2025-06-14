// models/Birth.js
const mongoose = require('mongoose');

const BirthSchema = new mongoose.Schema({
  breedingEventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BreedingEvent',
    required: true
  },
  femaleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal',
    required: true
  },
  birthDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  livingOffspringCount: {
    type: Number,
    required: true,
    default: 0
  },
  deadOffspringCount: {
    type: Number,
    default: 0
  },
  birthType: {
    type: String,
    enum: ['natural', 'assisted', 'cesarean'],
    default: 'natural'
  },
  assistanceRequired: {
    type: Boolean,
    default: false
  },
  veterinarianName: {
    type: String,
    trim: true
  },
  complications: {
    type: String,
    trim: true
  },
  offspringDetails: [{
    gender: {
      type: String,
      enum: ['male', 'female']
    },
    weight: Number,
    tagNumber: String,
    outcome: {
      type: String,
      enum: ['alive', 'stillborn'],
      default: 'alive'
    },
    healthStatus: {
      type: String,
      enum: ['healthy', 'weak', 'sick'],
      default: 'healthy'
    },
    markings: String
  }],
  offspringRegistered: {
    type: Boolean,
    default: false
  },
  offspringIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal'
  }],
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

const Birth = mongoose.model('Birth', BirthSchema);

module.exports = Birth;