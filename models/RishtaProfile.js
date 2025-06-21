const mongoose = require('mongoose');

const rishtaProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  personalInfo: {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    age: {
      type: Number,
      required: [true, 'Age is required'],
      min: [18, 'Age must be at least 18'],
      max: [80, 'Age cannot exceed 80']
    },
    gender: {
      type: String,
      required: [true, 'Gender is required'],
      enum: ['male', 'female']
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required']
    },
    height: {
      type: Number,
      min: [120, 'Height must be at least 120 cm'],
      max: [220, 'Height cannot exceed 220 cm']
    },
    maritalStatus: {
      type: String,
      required: [true, 'Marital status is required'],
      enum: ['never-married', 'divorced', 'widowed']
    },
    location: {
      city: {
        type: String,
        required: [true, 'City is required']
      },
      country: {
        type: String,
        required: [true, 'Country is required'],
        default: 'Pakistan'
      }
    },
    nationality: {
      type: String,
      default: 'Pakistani'
    }
  },
  education: {
    level: {
      type: String,
      required: [true, 'Education level is required'],
      enum: ['primary', 'secondary', 'bachelor', 'master', 'phd', 'other']
    },
    field: {
      type: String,
      trim: true
    },
    institution: {
      type: String,
      trim: true
    }
  },
  occupation: {
    profession: {
      type: String,
      required: [true, 'Profession is required'],
      trim: true
    },
    company: {
      type: String,
      trim: true
    },
    income: {
      type: String,
      enum: ['below-50k', '50k-100k', '100k-200k', '200k-500k', 'above-500k', 'prefer-not-to-say']
    }
  },
  familyInfo: {
    familyType: {
      type: String,
      enum: ['joint', 'nuclear', 'extended']
    },
    familyStatus: {
      type: String,
      enum: ['middle-class', 'upper-middle', 'upper-class', 'prefer-not-to-say']
    },
    siblings: {
      type: Number,
      min: 0
    },
    fatherName: {
      type: String,
      trim: true
    },
    motherName: {
      type: String,
      trim: true
    }
  },
  religiousInfo: {
    sect: {
      type: String,
      enum: ['sunni', 'shia', 'other']
    },
    religiousness: {
      type: String,
      enum: ['very-religious', 'moderately-religious', 'somewhat-religious', 'not-very-religious']
    },
    hijab: {
      type: String,
      enum: ['yes', 'no', 'sometimes']
    },
    beard: {
      type: String,
      enum: ['yes', 'no', 'sometimes']
    }
  },
  photos: [{
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  preferences: {
    ageRange: {
      min: {
        type: Number,
        min: 18,
        max: 80
      },
      max: {
        type: Number,
        min: 18,
        max: 80
      }
    },
    location: [{
      type: String,
      trim: true
    }],
    education: [{
      type: String,
      enum: ['primary', 'secondary', 'bachelor', 'master', 'phd', 'any']
    }],
    maritalStatus: [{
      type: String,
      enum: ['never-married', 'divorced', 'widowed', 'any']
    }],
    religiousness: [{
      type: String,
      enum: ['very-religious', 'moderately-religious', 'somewhat-religious', 'not-very-religious', 'any']
    }]
  },
  about: {
    type: String,
    maxlength: [1000, 'About section cannot exceed 1000 characters'],
    trim: true
  },
  expectations: {
    type: String,
    maxlength: [500, 'Expectations cannot exceed 500 characters'],
    trim: true
  },
  contactInfo: {
    guardianName: {
      type: String,
      trim: true
    },
    guardianPhone: {
      type: String,
      trim: true
    },
    guardianRelation: {
      type: String,
      trim: true
    }
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'approved', 'rejected', 'published'],
    default: 'draft'
  },
  published: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  views: {
    type: Number,
    default: 0
  },
  lastViewed: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for better query performance
rishtaProfileSchema.index({ 'personalInfo.gender': 1, published: 1 });
rishtaProfileSchema.index({ 'personalInfo.location.city': 1, published: 1 });
rishtaProfileSchema.index({ 'personalInfo.age': 1, published: 1 });
rishtaProfileSchema.index({ status: 1 });
rishtaProfileSchema.index({ userId: 1 });

// Virtual for age calculation
rishtaProfileSchema.virtual('calculatedAge').get(function() {
  if (this.personalInfo.dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(this.personalInfo.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }
  return this.personalInfo.age;
});

// Ensure virtuals are serialized
rishtaProfileSchema.set('toJSON', { virtuals: true });
rishtaProfileSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('RishtaProfile', rishtaProfileSchema); 