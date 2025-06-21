const express = require('express');
const RishtaProfile = require('../models/RishtaProfile');
const router = express.Router();

// Home page
router.get('/', async (req, res) => {
  try {
    // Get featured profiles for display
    const featuredProfiles = await RishtaProfile.find({
      published: true,
      status: 'approved'
    })
    .populate('userId', 'name')
    .limit(6)
    .sort({ createdAt: -1 });

    res.render('main/index', {
      title: 'Hijab Marriage Bureau - Find Your Perfect Match',
      featuredProfiles
    });
  } catch (error) {
    console.error('Home page error:', error);
    res.render('main/index', {
      title: 'Hijab Marriage Bureau - Find Your Perfect Match',
      featuredProfiles: []
    });
  }
});

// About page
router.get('/about', (req, res) => {
  res.render('main/about', {
    title: 'About Us - Hijab Marriage Bureau'
  });
});

// Services page
router.get('/services', (req, res) => {
  res.render('main/services', {
    title: 'Our Services - Hijab Marriage Bureau'
  });
});

// Contact page
router.get('/contact', (req, res) => {
  res.render('main/contact', {
    title: 'Contact Us - Hijab Marriage Bureau'
  });
});

// Contact form submission
router.post('/contact', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Basic validation
    if (!name || !email || !message) {
      req.flash('error_msg', 'Please fill in all required fields');
      return res.redirect('/contact');
    }

    // TODO: Implement contact form processing
    // For now, just show success message
    req.flash('success_msg', 'Thank you for your message! We will get back to you soon.');
    res.redirect('/contact');

  } catch (error) {
    console.error('Contact form error:', error);
    req.flash('error_msg', 'An error occurred. Please try again.');
    res.redirect('/contact');
  }
});

// Browse profiles (public view)
router.get('/browse', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {
      published: true,
      status: 'approved'
    };

    // Add gender filter if specified
    if (req.query.gender) {
      filter['personalInfo.gender'] = req.query.gender;
    }

    // Add location filter if specified
    if (req.query.city) {
      filter['personalInfo.location.city'] = new RegExp(req.query.city, 'i');
    }

    // Add age range filter if specified
    if (req.query.minAge || req.query.maxAge) {
      filter['personalInfo.age'] = {};
      if (req.query.minAge) filter['personalInfo.age'].$gte = parseInt(req.query.minAge);
      if (req.query.maxAge) filter['personalInfo.age'].$lte = parseInt(req.query.maxAge);
    }

    const profiles = await RishtaProfile.find(filter)
      .populate('userId', 'name')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await RishtaProfile.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.render('main/browse', {
      title: 'Browse Profiles - Hijab Marriage Bureau',
      profiles,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      filters: req.query
    });

  } catch (error) {
    console.error('Browse profiles error:', error);
    res.render('main/browse', {
      title: 'Browse Profiles - Hijab Marriage Bureau',
      profiles: [],
      currentPage: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
      filters: {}
    });
  }
});

// View individual profile (public)
router.get('/profile/:id', async (req, res) => {
  try {
    const profile = await RishtaProfile.findOne({
      _id: req.params.id,
      published: true,
      status: 'approved'
    }).populate('userId', 'name');

    if (!profile) {
      req.flash('error_msg', 'Profile not found');
      return res.redirect('/browse');
    }

    // Increment view count
    profile.views += 1;
    profile.lastViewed = new Date();
    await profile.save();

    res.render('main/profile-detail', {
      title: `${profile.personalInfo.name} - Profile - Hijab Marriage Bureau`,
      profile
    });

  } catch (error) {
    console.error('Profile detail error:', error);
    req.flash('error_msg', 'Profile not found');
    res.redirect('/browse');
  }
});

// Dashboard (redirect to appropriate page based on user status)
router.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }

  if (!req.session.user.isPaid) {
    return res.redirect('/payments');
  }

  if (!req.session.user.profileCompleted) {
    return res.redirect('/profiles/create');
  }

  res.redirect('/profiles/dashboard');
});

// Privacy Policy
router.get('/privacy', (req, res) => {
  res.render('main/privacy', {
    title: 'Privacy Policy - Hijab Marriage Bureau'
  });
});

// Terms of Service
router.get('/terms', (req, res) => {
  res.render('main/terms', {
    title: 'Terms of Service - Hijab Marriage Bureau'
  });
});

module.exports = router; 