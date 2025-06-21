const express = require('express');
const User = require('../models/User');
const RishtaProfile = require('../models/RishtaProfile');
const Payment = require('../models/Payment');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const router = express.Router();

// Admin dashboard
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
  try {
    // Get statistics
    const totalUsers = await User.countDocuments();
    const paidUsers = await User.countDocuments({ isPaid: true });
    const profilesSubmitted = await RishtaProfile.countDocuments({ status: 'submitted' });
    const profilesApproved = await RishtaProfile.countDocuments({ status: 'approved' });
    const profilesPublished = await RishtaProfile.countDocuments({ published: true });
    const pendingPayments = await Payment.countDocuments({ status: 'pending' });

    // Get recent activities
    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5);
    const recentProfiles = await RishtaProfile.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);
    const recentPayments = await Payment.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard - Hijab Marriage Bureau',
      stats: {
        totalUsers,
        paidUsers,
        profilesSubmitted,
        profilesApproved,
        profilesPublished,
        pendingPayments
      },
      recentUsers,
      recentProfiles,
      recentPayments
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/');
  }
});

// User management
router.get('/users', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.isPaid !== undefined) filter.isPaid = req.query.isPaid === 'true';
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (req.query.search) {
      filter.$or = [
        { name: new RegExp(req.query.search, 'i') },
        { email: new RegExp(req.query.search, 'i') },
        { phone: new RegExp(req.query.search, 'i') }
      ];
    }

    const users = await User.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.render('admin/users', {
      title: 'User Management - Hijab Marriage Bureau',
      users,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      filters: req.query
    });
  } catch (error) {
    console.error('User management error:', error);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/admin');
  }
});

// View user details
router.get('/users/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/admin/users');
    }

    const profile = await RishtaProfile.findOne({ userId: user._id });
    const payments = await Payment.find({ userId: user._id }).sort({ createdAt: -1 });

    res.render('admin/user-detail', {
      title: `User: ${user.name} - Hijab Marriage Bureau`,
      user,
      profile,
      payments
    });
  } catch (error) {
    console.error('User detail error:', error);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/admin/users');
  }
});

// Update user status
router.post('/users/:id/status', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { isActive, isPaid, role } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (isActive !== undefined) user.isActive = isActive;
    if (isPaid !== undefined) user.isPaid = isPaid;
    if (role) user.role = role;

    await user.save();

    res.json({ success: true, message: 'User updated successfully', user });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ success: false, message: 'An error occurred' });
  }
});

// Profile management
router.get('/profiles', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.published !== undefined) filter.published = req.query.published === 'true';
    if (req.query.gender) filter['personalInfo.gender'] = req.query.gender;
    if (req.query.city) filter['personalInfo.location.city'] = new RegExp(req.query.city, 'i');

    const profiles = await RishtaProfile.find(filter)
      .populate('userId', 'name email phone')
      .populate('approvedBy', 'name')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await RishtaProfile.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.render('admin/profiles', {
      title: 'Profile Management - Hijab Marriage Bureau',
      profiles,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      filters: req.query
    });
  } catch (error) {
    console.error('Profile management error:', error);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/admin');
  }
});

// View profile details
router.get('/profiles/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const profile = await RishtaProfile.findById(req.params.id)
      .populate('userId', 'name email phone')
      .populate('approvedBy', 'name');

    if (!profile) {
      req.flash('error_msg', 'Profile not found');
      return res.redirect('/admin/profiles');
    }

    res.render('admin/profile-detail', {
      title: `Profile: ${profile.personalInfo.name} - Hijab Marriage Bureau`,
      profile
    });
  } catch (error) {
    console.error('Profile detail error:', error);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/admin/profiles');
  }
});

// Approve/reject profile
router.post('/profiles/:id/review', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { action, rejectionReason } = req.body;
    const profile = await RishtaProfile.findById(req.params.id);

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    if (action === 'approve') {
      profile.status = 'approved';
      profile.published = true;
      profile.approvedBy = req.session.user._id;
      profile.approvedAt = new Date();
      profile.rejectionReason = undefined;
    } else if (action === 'reject') {
      profile.status = 'rejected';
      profile.published = false;
      profile.rejectionReason = rejectionReason;
      profile.approvedBy = req.session.user._id;
      profile.approvedAt = new Date();
    }

    await profile.save();

    res.json({ 
      success: true, 
      message: `Profile ${action}d successfully`,
      profile: profile
    });

  } catch (error) {
    console.error('Review profile error:', error);
    res.status(500).json({ success: false, message: 'An error occurred' });
  }
});

// Toggle profile publication
router.post('/profiles/:id/publish', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const profile = await RishtaProfile.findById(req.params.id);

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    if (profile.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Only approved profiles can be published' });
    }

    profile.published = !profile.published;
    await profile.save();

    res.json({ 
      success: true, 
      message: `Profile ${profile.published ? 'published' : 'unpublished'} successfully`,
      published: profile.published
    });

  } catch (error) {
    console.error('Toggle profile publication error:', error);
    res.status(500).json({ success: false, message: 'An error occurred' });
  }
});

// System settings
router.get('/settings', isAuthenticated, isAdmin, (req, res) => {
  res.render('admin/settings', {
    title: 'System Settings - Hijab Marriage Bureau'
  });
});

// Update system settings
router.post('/settings', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { registrationFee, internationalFee, easypaisaNumber, easypaisaAccount } = req.body;

    // TODO: Implement settings storage
    // For now, just show success message
    req.flash('success_msg', 'Settings updated successfully');
    res.redirect('/admin/settings');

  } catch (error) {
    console.error('Update settings error:', error);
    req.flash('error_msg', 'An error occurred while updating settings');
    res.redirect('/admin/settings');
  }
});

// Analytics
router.get('/analytics', isAuthenticated, isAdmin, async (req, res) => {
  try {
    // Get monthly statistics
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const monthlyStats = {
      newUsers: await User.countDocuments({
        createdAt: { $gte: startOfMonth, $lte: endOfMonth }
      }),
      newProfiles: await RishtaProfile.countDocuments({
        createdAt: { $gte: startOfMonth, $lte: endOfMonth }
      }),
      completedPayments: await Payment.countDocuments({
        status: 'completed',
        createdAt: { $gte: startOfMonth, $lte: endOfMonth }
      }),
      totalRevenue: await Payment.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ])
    };

    // Get gender distribution
    const genderStats = await RishtaProfile.aggregate([
      { $match: { published: true } },
      {
        $group: {
          _id: '$personalInfo.gender',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get city distribution
    const cityStats = await RishtaProfile.aggregate([
      { $match: { published: true } },
      {
        $group: {
          _id: '$personalInfo.location.city',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.render('admin/analytics', {
      title: 'Analytics - Hijab Marriage Bureau',
      monthlyStats,
      genderStats,
      cityStats
    });

  } catch (error) {
    console.error('Analytics error:', error);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/admin');
  }
});

module.exports = router; 