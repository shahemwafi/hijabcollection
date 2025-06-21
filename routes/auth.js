const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { isNotAuthenticated } = require('../middleware/auth');
const router = express.Router();

// Validation rules
const registerValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/\d/)
    .withMessage('Password must contain at least one number'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
  
  body('phone')
    .trim()
    .matches(/^(\+92|0)?[0-9]{10}$/)
    .withMessage('Please enter a valid Pakistani phone number')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Register page
router.get('/register', isNotAuthenticated, (req, res) => {
  res.render('auth/register', {
    title: 'Register - Hijab Marriage Bureau',
    errors: []
  });
});

// Register POST
router.post('/register', isNotAuthenticated, registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('auth/register', {
        title: 'Register - Hijab Marriage Bureau',
        errors: errors.array(),
        formData: req.body
      });
    }

    const { name, email, password, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('auth/register', {
        title: 'Register - Hijab Marriage Bureau',
        errors: [{ msg: 'Email already registered. Please use a different email or try logging in.' }],
        formData: req.body
      });
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      phone
    });

    await user.save();

    req.flash('success_msg', 'Registration successful! Please log in to continue.');
    res.redirect('/auth/login');

  } catch (error) {
    console.error('Registration error:', error);
    res.render('auth/register', {
      title: 'Register - Hijab Marriage Bureau',
      errors: [{ msg: 'An error occurred during registration. Please try again.' }],
      formData: req.body
    });
  }
});

// Login page
router.get('/login', isNotAuthenticated, (req, res) => {
  res.render('auth/login', {
    title: 'Login - Hijab Marriage Bureau',
    errors: []
  });
});

// Login POST
router.post('/login', isNotAuthenticated, loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('auth/login', {
        title: 'Login - Hijab Marriage Bureau',
        errors: errors.array(),
        formData: req.body
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.render('auth/login', {
        title: 'Login - Hijab Marriage Bureau',
        errors: [{ msg: 'Invalid email or password' }],
        formData: req.body
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.render('auth/login', {
        title: 'Login - Hijab Marriage Bureau',
        errors: [{ msg: 'Your account has been deactivated. Please contact support.' }],
        formData: req.body
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.render('auth/login', {
        title: 'Login - Hijab Marriage Bureau',
        errors: [{ msg: 'Invalid email or password' }],
        formData: req.body
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Set session
    req.session.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isPaid: user.isPaid,
      profileCompleted: user.profileCompleted
    };

    req.flash('success_msg', `Welcome back, ${user.name}!`);
    
    // Redirect based on user status
    if (!user.isPaid) {
      res.redirect('/payments');
    } else if (!user.profileCompleted) {
      res.redirect('/profiles/create');
    } else {
      res.redirect('/dashboard');
    }

  } catch (error) {
    console.error('Login error:', error);
    res.render('auth/login', {
      title: 'Login - Hijab Marriage Bureau',
      errors: [{ msg: 'An error occurred during login. Please try again.' }],
      formData: req.body
    });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

// Forgot password page
router.get('/forgot-password', isNotAuthenticated, (req, res) => {
  res.render('auth/forgot-password', {
    title: 'Forgot Password - Hijab Marriage Bureau',
    errors: []
  });
});

// Forgot password POST
router.post('/forgot-password', isNotAuthenticated, [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email address')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('auth/forgot-password', {
        title: 'Forgot Password - Hijab Marriage Bureau',
        errors: errors.array(),
        formData: req.body
      });
    }

    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if email exists or not for security
      req.flash('success_msg', 'If an account with that email exists, you will receive password reset instructions.');
      return res.redirect('/auth/login');
    }

    // TODO: Implement password reset functionality
    // For now, just show a message
    req.flash('success_msg', 'Password reset functionality will be implemented soon. Please contact support for assistance.');
    res.redirect('/auth/login');

  } catch (error) {
    console.error('Forgot password error:', error);
    res.render('auth/forgot-password', {
      title: 'Forgot Password - Hijab Marriage Bureau',
      errors: [{ msg: 'An error occurred. Please try again.' }],
      formData: req.body
    });
  }
});

module.exports = router; 