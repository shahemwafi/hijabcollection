const express = require('express');
const { body, validationResult } = require('express-validator');
const RishtaProfile = require('../models/RishtaProfile');
const { isAuthenticated, hasPaid, isOwnerOrAdmin } = require('../middleware/auth');
const { uploadMultiple, handleUploadError, deleteMultipleImages } = require('../middleware/upload');
const router = express.Router();

// Validation rules for profile creation/update
const profileValidation = [
  body('personalInfo.name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  
  body('personalInfo.age')
    .isInt({ min: 18, max: 80 })
    .withMessage('Age must be between 18 and 80'),
  
  body('personalInfo.gender')
    .isIn(['male', 'female'])
    .withMessage('Please select a valid gender'),
  
  body('personalInfo.dateOfBirth')
    .isISO8601()
    .withMessage('Please enter a valid date of birth'),
  
  body('personalInfo.maritalStatus')
    .isIn(['never-married', 'divorced', 'widowed'])
    .withMessage('Please select a valid marital status'),
  
  body('personalInfo.location.city')
    .trim()
    .notEmpty()
    .withMessage('City is required'),
  
  body('education.level')
    .isIn(['primary', 'secondary', 'bachelor', 'master', 'phd', 'other'])
    .withMessage('Please select a valid education level'),
  
  body('occupation.profession')
    .trim()
    .notEmpty()
    .withMessage('Profession is required')
];

// Create profile page
router.get('/create', isAuthenticated, hasPaid, async (req, res) => {
  try {
    // Check if user already has a profile
    const existingProfile = await RishtaProfile.findOne({ userId: req.session.user._id });
    if (existingProfile) {
      req.flash('error_msg', 'You already have a profile. You can edit it instead.');
      return res.redirect('/profiles/edit');
    }

    res.render('profiles/create', {
      title: 'Create Profile - Hijab Marriage Bureau',
      errors: [],
      formData: {}
    });
  } catch (error) {
    console.error('Create profile page error:', error);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/dashboard');
  }
});

// Create profile POST
router.post('/create', isAuthenticated, hasPaid, uploadMultiple, handleUploadError, profileValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Delete uploaded files if validation fails
      if (req.files && req.files.length > 0) {
        await deleteMultipleImages(req.files.map(file => ({ publicId: file.filename })));
      }

      return res.render('profiles/create', {
        title: 'Create Profile - Hijab Marriage Bureau',
        errors: errors.array(),
        formData: req.body
      });
    }

    // Check if user already has a profile
    const existingProfile = await RishtaProfile.findOne({ userId: req.session.user._id });
    if (existingProfile) {
      req.flash('error_msg', 'You already have a profile. You can edit it instead.');
      return res.redirect('/profiles/edit');
    }

    // Process uploaded photos
    const photos = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file, index) => {
        photos.push({
          url: file.path,
          publicId: file.filename,
          isPrimary: index === 0 // First photo is primary
        });
      });
    }

    // Create profile data
    const profileData = {
      userId: req.session.user._id,
      personalInfo: {
        name: req.body.personalInfo.name,
        age: parseInt(req.body.personalInfo.age),
        gender: req.body.personalInfo.gender,
        dateOfBirth: new Date(req.body.personalInfo.dateOfBirth),
        height: req.body.personalInfo.height ? parseInt(req.body.personalInfo.height) : undefined,
        maritalStatus: req.body.personalInfo.maritalStatus,
        location: {
          city: req.body.personalInfo.location.city,
          country: req.body.personalInfo.location.country || 'Pakistan'
        },
        nationality: req.body.personalInfo.nationality || 'Pakistani'
      },
      education: {
        level: req.body.education.level,
        field: req.body.education.field,
        institution: req.body.education.institution
      },
      occupation: {
        profession: req.body.occupation.profession,
        company: req.body.occupation.company,
        income: req.body.occupation.income
      },
      familyInfo: {
        familyType: req.body.familyInfo.familyType,
        familyStatus: req.body.familyInfo.familyStatus,
        siblings: req.body.familyInfo.siblings ? parseInt(req.body.familyInfo.siblings) : undefined,
        fatherName: req.body.familyInfo.fatherName,
        motherName: req.body.familyInfo.motherName
      },
      religiousInfo: {
        sect: req.body.religiousInfo.sect,
        religiousness: req.body.religiousInfo.religiousness,
        hijab: req.body.religiousInfo.hijab,
        beard: req.body.religiousInfo.beard
      },
      photos,
      preferences: {
        ageRange: {
          min: req.body.preferences.ageRangeMin ? parseInt(req.body.preferences.ageRangeMin) : undefined,
          max: req.body.preferences.ageRangeMax ? parseInt(req.body.preferences.ageRangeMax) : undefined
        },
        location: req.body.preferences.location ? req.body.preferences.location.split(',').map(loc => loc.trim()) : [],
        education: req.body.preferences.education ? req.body.preferences.education.split(',') : [],
        maritalStatus: req.body.preferences.maritalStatus ? req.body.preferences.maritalStatus.split(',') : [],
        religiousness: req.body.preferences.religiousness ? req.body.preferences.religiousness.split(',') : []
      },
      about: req.body.about,
      expectations: req.body.expectations,
      contactInfo: {
        guardianName: req.body.contactInfo.guardianName,
        guardianPhone: req.body.contactInfo.guardianPhone,
        guardianRelation: req.body.contactInfo.guardianRelation
      },
      status: 'submitted'
    };

    const profile = new RishtaProfile(profileData);
    await profile.save();

    // Update user profile completion status
    const User = require('../models/User');
    await User.findByIdAndUpdate(req.session.user._id, { profileCompleted: true });

    // Update session
    req.session.user.profileCompleted = true;

    req.flash('success_msg', 'Profile created successfully! It will be reviewed by our team before publishing.');
    res.redirect('/profiles/dashboard');

  } catch (error) {
    console.error('Create profile error:', error);
    
    // Delete uploaded files if error occurs
    if (req.files && req.files.length > 0) {
      await deleteMultipleImages(req.files.map(file => ({ publicId: file.filename })));
    }

    res.render('profiles/create', {
      title: 'Create Profile - Hijab Marriage Bureau',
      errors: [{ msg: 'An error occurred while creating your profile. Please try again.' }],
      formData: req.body
    });
  }
});

// Edit profile page
router.get('/edit', isAuthenticated, hasPaid, async (req, res) => {
  try {
    const profile = await RishtaProfile.findOne({ userId: req.session.user._id });
    
    if (!profile) {
      req.flash('error_msg', 'No profile found. Please create a profile first.');
      return res.redirect('/profiles/create');
    }

    res.render('profiles/edit', {
      title: 'Edit Profile - Hijab Marriage Bureau',
      profile,
      errors: []
    });
  } catch (error) {
    console.error('Edit profile page error:', error);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/dashboard');
  }
});

// Edit profile POST
router.post('/edit', isAuthenticated, hasPaid, uploadMultiple, handleUploadError, profileValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Delete uploaded files if validation fails
      if (req.files && req.files.length > 0) {
        await deleteMultipleImages(req.files.map(file => ({ publicId: file.filename })));
      }

      const profile = await RishtaProfile.findOne({ userId: req.session.user._id });
      return res.render('profiles/edit', {
        title: 'Edit Profile - Hijab Marriage Bureau',
        profile,
        errors: errors.array()
      });
    }

    const profile = await RishtaProfile.findOne({ userId: req.session.user._id });
    if (!profile) {
      req.flash('error_msg', 'No profile found. Please create a profile first.');
      return res.redirect('/profiles/create');
    }

    // Process new uploaded photos
    const newPhotos = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file, index) => {
        newPhotos.push({
          url: file.path,
          publicId: file.filename,
          isPrimary: profile.photos.length === 0 && index === 0 // Primary if no existing photos
        });
      });
    }

    // Update profile data
    profile.personalInfo = {
      name: req.body.personalInfo.name,
      age: parseInt(req.body.personalInfo.age),
      gender: req.body.personalInfo.gender,
      dateOfBirth: new Date(req.body.personalInfo.dateOfBirth),
      height: req.body.personalInfo.height ? parseInt(req.body.personalInfo.height) : undefined,
      maritalStatus: req.body.personalInfo.maritalStatus,
      location: {
        city: req.body.personalInfo.location.city,
        country: req.body.personalInfo.location.country || 'Pakistan'
      },
      nationality: req.body.personalInfo.nationality || 'Pakistani'
    };

    profile.education = {
      level: req.body.education.level,
      field: req.body.education.field,
      institution: req.body.education.institution
    };

    profile.occupation = {
      profession: req.body.occupation.profession,
      company: req.body.occupation.company,
      income: req.body.occupation.income
    };

    profile.familyInfo = {
      familyType: req.body.familyInfo.familyType,
      familyStatus: req.body.familyInfo.familyStatus,
      siblings: req.body.familyInfo.siblings ? parseInt(req.body.familyInfo.siblings) : undefined,
      fatherName: req.body.familyInfo.fatherName,
      motherName: req.body.familyInfo.motherName
    };

    profile.religiousInfo = {
      sect: req.body.religiousInfo.sect,
      religiousness: req.body.religiousInfo.religiousness,
      hijab: req.body.religiousInfo.hijab,
      beard: req.body.religiousInfo.beard
    };

    // Add new photos to existing ones
    if (newPhotos.length > 0) {
      profile.photos = [...profile.photos, ...newPhotos];
    }

    profile.preferences = {
      ageRange: {
        min: req.body.preferences.ageRangeMin ? parseInt(req.body.preferences.ageRangeMin) : undefined,
        max: req.body.preferences.ageRangeMax ? parseInt(req.body.preferences.ageRangeMax) : undefined
      },
      location: req.body.preferences.location ? req.body.preferences.location.split(',').map(loc => loc.trim()) : [],
      education: req.body.preferences.education ? req.body.preferences.education.split(',') : [],
      maritalStatus: req.body.preferences.maritalStatus ? req.body.preferences.maritalStatus.split(',') : [],
      religiousness: req.body.preferences.religiousness ? req.body.preferences.religiousness.split(',') : []
    };

    profile.about = req.body.about;
    profile.expectations = req.body.expectations;
    profile.contactInfo = {
      guardianName: req.body.contactInfo.guardianName,
      guardianPhone: req.body.contactInfo.guardianPhone,
      guardianRelation: req.body.contactInfo.guardianRelation
    };

    // Reset status to submitted for review
    profile.status = 'submitted';
    profile.published = false;

    await profile.save();

    req.flash('success_msg', 'Profile updated successfully! It will be reviewed by our team before publishing.');
    res.redirect('/profiles/dashboard');

  } catch (error) {
    console.error('Edit profile error:', error);
    
    // Delete uploaded files if error occurs
    if (req.files && req.files.length > 0) {
      await deleteMultipleImages(req.files.map(file => ({ publicId: file.filename })));
    }

    const profile = await RishtaProfile.findOne({ userId: req.session.user._id });
    res.render('profiles/edit', {
      title: 'Edit Profile - Hijab Marriage Bureau',
      profile,
      errors: [{ msg: 'An error occurred while updating your profile. Please try again.' }]
    });
  }
});

// Profile dashboard
router.get('/dashboard', isAuthenticated, hasPaid, async (req, res) => {
  try {
    const profile = await RishtaProfile.findOne({ userId: req.session.user._id });
    
    if (!profile) {
      req.flash('error_msg', 'No profile found. Please create a profile first.');
      return res.redirect('/profiles/create');
    }

    res.render('profiles/dashboard', {
      title: 'Profile Dashboard - Hijab Marriage Bureau',
      profile
    });
  } catch (error) {
    console.error('Profile dashboard error:', error);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/dashboard');
  }
});

// View own profile
router.get('/view', isAuthenticated, hasPaid, async (req, res) => {
  try {
    const profile = await RishtaProfile.findOne({ userId: req.session.user._id });
    
    if (!profile) {
      req.flash('error_msg', 'No profile found. Please create a profile first.');
      return res.redirect('/profiles/create');
    }

    res.render('profiles/view', {
      title: 'My Profile - Hijab Marriage Bureau',
      profile
    });
  } catch (error) {
    console.error('View profile error:', error);
    req.flash('error_msg', 'An error occurred');
    res.redirect('/dashboard');
  }
});

// Delete photo
router.delete('/photo/:photoId', isAuthenticated, hasPaid, async (req, res) => {
  try {
    const profile = await RishtaProfile.findOne({ userId: req.session.user._id });
    
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    const photo = profile.photos.id(req.params.photoId);
    if (!photo) {
      return res.status(404).json({ success: false, message: 'Photo not found' });
    }

    // Delete from Cloudinary
    await deleteMultipleImages([{ publicId: photo.publicId }]);

    // Remove from profile
    profile.photos.pull(req.params.photoId);
    await profile.save();

    res.json({ success: true, message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ success: false, message: 'An error occurred' });
  }
});

// Set primary photo
router.put('/photo/:photoId/primary', isAuthenticated, hasPaid, async (req, res) => {
  try {
    const profile = await RishtaProfile.findOne({ userId: req.session.user._id });
    
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Reset all photos to non-primary
    profile.photos.forEach(photo => {
      photo.isPrimary = false;
    });

    // Set selected photo as primary
    const photo = profile.photos.id(req.params.photoId);
    if (photo) {
      photo.isPrimary = true;
    }

    await profile.save();

    res.json({ success: true, message: 'Primary photo updated successfully' });
  } catch (error) {
    console.error('Set primary photo error:', error);
    res.status(500).json({ success: false, message: 'An error occurred' });
  }
});

module.exports = router; 