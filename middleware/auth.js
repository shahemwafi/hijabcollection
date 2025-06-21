const User = require('../models/User');

// Check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  
  req.flash('error_msg', 'Please log in to access this page');
  res.redirect('/auth/login');
};

// Check if user is NOT authenticated (for login/register pages)
const isNotAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    return next();
  }
  
  res.redirect('/dashboard');
};

// Check if user has paid
const hasPaid = async (req, res, next) => {
  try {
    if (!req.session.user) {
      req.flash('error_msg', 'Please log in to access this page');
      return res.redirect('/auth/login');
    }

    const user = await User.findById(req.session.user._id);
    if (!user) {
      req.session.destroy();
      req.flash('error_msg', 'User not found');
      return res.redirect('/auth/login');
    }

    if (!user.isPaid) {
      req.flash('error_msg', 'Please complete payment to access this feature');
      return res.redirect('/payments');
    }

    next();
  } catch (error) {
    console.error('HasPaid middleware error:', error);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/auth/login');
  }
};

// Check if user has completed profile
const hasProfile = async (req, res, next) => {
  try {
    if (!req.session.user) {
      req.flash('error_msg', 'Please log in to access this page');
      return res.redirect('/auth/login');
    }

    const user = await User.findById(req.session.user._id);
    if (!user) {
      req.session.destroy();
      req.flash('error_msg', 'User not found');
      return res.redirect('/auth/login');
    }

    if (!user.profileCompleted) {
      req.flash('error_msg', 'Please complete your profile first');
      return res.redirect('/profiles/create');
    }

    next();
  } catch (error) {
    console.error('HasProfile middleware error:', error);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/auth/login');
  }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  
  req.flash('error_msg', 'Access denied. Admin privileges required.');
  res.redirect('/');
};

// Check if user owns the resource or is admin
const isOwnerOrAdmin = async (req, res, next) => {
  try {
    if (!req.session.user) {
      req.flash('error_msg', 'Please log in to access this page');
      return res.redirect('/auth/login');
    }

    const resourceId = req.params.id || req.params.profileId;
    if (!resourceId) {
      req.flash('error_msg', 'Resource ID not found');
      return res.redirect('/dashboard');
    }

    // If user is admin, allow access
    if (req.session.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    const RishtaProfile = require('../models/RishtaProfile');
    const profile = await RishtaProfile.findById(resourceId);
    
    if (!profile) {
      req.flash('error_msg', 'Profile not found');
      return res.redirect('/dashboard');
    }

    if (profile.userId.toString() !== req.session.user._id.toString()) {
      req.flash('error_msg', 'Access denied. You can only access your own profile.');
      return res.redirect('/dashboard');
    }

    next();
  } catch (error) {
    console.error('IsOwnerOrAdmin middleware error:', error);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/dashboard');
  }
};

module.exports = {
  isAuthenticated,
  isNotAuthenticated,
  hasPaid,
  hasProfile,
  isAdmin,
  isOwnerOrAdmin
}; 