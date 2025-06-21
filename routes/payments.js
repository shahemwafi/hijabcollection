const express = require('express');
const { body, validationResult } = require('express-validator');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { uploadSingle, handleUploadError, deleteImage } = require('../middleware/upload');
const router = express.Router();

// Validation rules for payment submission
const paymentValidation = [
  body('amount')
    .isInt({ min: 1 })
    .withMessage('Amount must be a positive number'),
  
  body('paymentMethod')
    .isIn(['easypaisa', 'jazzcash', 'bank-transfer', 'cash'])
    .withMessage('Please select a valid payment method'),
  
  body('paymentType')
    .isIn(['registration', 'international', 'premium', 'other'])
    .withMessage('Please select a valid payment type'),
  
  body('senderName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Sender name must be between 2 and 50 characters'),
  
  body('senderNumber')
    .trim()
    .matches(/^(\+92|0)?[0-9]{10}$/)
    .withMessage('Please enter a valid Pakistani phone number'),
  
  body('referenceNumber')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Reference number must be between 3 and 20 characters')
];

// Payment page
router.get('/', isAuthenticated, async (req, res) => {
  try {
    // Check if user has already paid
    if (req.session.user.isPaid) {
      req.flash('error_msg', 'You have already completed payment.');
      return res.redirect('/dashboard');
    }

    // Get user's pending payments
    const pendingPayments = await Payment.find({
      userId: req.session.user._id,
      status: 'pending'
    }).sort({ createdAt: -1 });

    res.render('payments/index', {
      title: 'Payment - Hijab Marriage Bureau',
      pendingPayments,
      errors: []
    });
  } catch (error) {
    console.error('Payment page error:', error);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/dashboard');
  }
});

// Submit payment
router.post('/submit', isAuthenticated, uploadSingle, handleUploadError, paymentValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Delete uploaded file if validation fails
      if (req.file) {
        await deleteImage(req.file.filename);
      }

      const pendingPayments = await Payment.find({
        userId: req.session.user._id,
        status: 'pending'
      }).sort({ createdAt: -1 });

      return res.render('payments/index', {
        title: 'Payment - Hijab Marriage Bureau',
        pendingPayments,
        errors: errors.array(),
        formData: req.body
      });
    }

    // Check if user has already paid
    if (req.session.user.isPaid) {
      req.flash('error_msg', 'You have already completed payment.');
      return res.redirect('/dashboard');
    }

    // Generate transaction ID
    const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Create payment record
    const paymentData = {
      userId: req.session.user._id,
      amount: parseInt(req.body.amount),
      paymentMethod: req.body.paymentMethod,
      paymentType: req.body.paymentType,
      senderName: req.body.senderName,
      senderNumber: req.body.senderNumber,
      referenceNumber: req.body.referenceNumber,
      transactionId,
      notes: req.body.notes,
      receiptImage: req.file ? {
        url: req.file.path,
        publicId: req.file.filename
      } : undefined
    };

    const payment = new Payment(paymentData);
    await payment.save();

    req.flash('success_msg', 'Payment submitted successfully! We will verify it within 24 hours.');
    res.redirect('/payments/history');

  } catch (error) {
    console.error('Submit payment error:', error);
    
    // Delete uploaded file if error occurs
    if (req.file) {
      await deleteImage(req.file.filename);
    }

    const pendingPayments = await Payment.find({
      userId: req.session.user._id,
      status: 'pending'
    }).sort({ createdAt: -1 });

    res.render('payments/index', {
      title: 'Payment - Hijab Marriage Bureau',
      pendingPayments,
      errors: [{ msg: 'An error occurred while submitting payment. Please try again.' }],
      formData: req.body
    });
  }
});

// Payment history
router.get('/history', isAuthenticated, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.session.user._id })
      .sort({ createdAt: -1 });

    res.render('payments/history', {
      title: 'Payment History - Hijab Marriage Bureau',
      payments
    });
  } catch (error) {
    console.error('Payment history error:', error);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/dashboard');
  }
});

// Admin: View all payments
router.get('/admin', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.paymentMethod) filter.paymentMethod = req.query.paymentMethod;
    if (req.query.paymentType) filter.paymentType = req.query.paymentType;

    const payments = await Payment.find(filter)
      .populate('userId', 'name email phone')
      .populate('verifiedBy', 'name')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Payment.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.render('payments/admin', {
      title: 'Payment Management - Hijab Marriage Bureau',
      payments,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      filters: req.query
    });
  } catch (error) {
    console.error('Admin payments error:', error);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/admin');
  }
});

// Admin: Verify payment
router.post('/admin/verify/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const { status, verificationNotes } = req.body;

    if (!['completed', 'failed', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    payment.status = status;
    payment.verifiedBy = req.session.user._id;
    payment.verifiedAt = new Date();
    payment.verificationNotes = verificationNotes;

    // If payment is completed, update user's payment status
    if (status === 'completed') {
      const user = await User.findById(payment.userId);
      if (user) {
        user.isPaid = true;
        await user.save();
      }
    }

    await payment.save();

    res.json({ 
      success: true, 
      message: `Payment ${status} successfully`,
      payment: payment
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ success: false, message: 'An error occurred' });
  }
});

// Admin: View payment details
router.get('/admin/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('userId', 'name email phone')
      .populate('verifiedBy', 'name');

    if (!payment) {
      req.flash('error_msg', 'Payment not found');
      return res.redirect('/payments/admin');
    }

    res.render('payments/detail', {
      title: 'Payment Details - Hijab Marriage Bureau',
      payment
    });
  } catch (error) {
    console.error('Payment detail error:', error);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/payments/admin');
  }
});

// Cancel payment (user can only cancel pending payments)
router.post('/cancel/:id', isAuthenticated, async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      userId: req.session.user._id,
      status: 'pending'
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found or cannot be cancelled' });
    }

    payment.status = 'cancelled';
    await payment.save();

    res.json({ success: true, message: 'Payment cancelled successfully' });
  } catch (error) {
    console.error('Cancel payment error:', error);
    res.status(500).json({ success: false, message: 'An error occurred' });
  }
});

// Get payment instructions
router.get('/instructions', isAuthenticated, (req, res) => {
  res.render('payments/instructions', {
    title: 'Payment Instructions - Hijab Marriage Bureau'
  });
});

module.exports = router; 