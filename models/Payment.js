const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'PKR'
  },
  paymentMethod: {
    type: String,
    required: [true, 'Payment method is required'],
    enum: ['easypaisa', 'jazzcash', 'bank-transfer', 'cash']
  },
  paymentType: {
    type: String,
    required: [true, 'Payment type is required'],
    enum: ['registration', 'international', 'premium', 'other']
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  referenceNumber: {
    type: String,
    trim: true
  },
  senderNumber: {
    type: String,
    trim: true
  },
  senderName: {
    type: String,
    trim: true
  },
  receiptImage: {
    url: String,
    publicId: String
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: {
    type: Date
  },
  verificationNotes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for better query performance
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ transactionId: 1 });

// Virtual for formatted amount
paymentSchema.virtual('formattedAmount').get(function() {
  return `${this.amount.toLocaleString()} ${this.currency}`;
});

// Virtual for payment status color
paymentSchema.virtual('statusColor').get(function() {
  const colors = {
    pending: 'warning',
    completed: 'success',
    failed: 'danger',
    cancelled: 'secondary'
  };
  return colors[this.status] || 'secondary';
});

// Ensure virtuals are serialized
paymentSchema.set('toJSON', { virtuals: true });
paymentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Payment', paymentSchema); 