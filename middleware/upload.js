const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'hijab-marriage-bureau',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [
      { width: 800, height: 800, crop: 'limit' },
      { quality: 'auto' }
    ]
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Check file type
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5 // Maximum 5 files
  }
});

// Single file upload
const uploadSingle = upload.single('photo');

// Multiple files upload
const uploadMultiple = upload.array('photos', 5);

// Error handling middleware for multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 5 files allowed.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field.'
      });
    }
  }
  
  if (error.message === 'Only image files are allowed!') {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next(error);
};

// Helper function to delete image from Cloudinary
const deleteImage = async (publicId) => {
  try {
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
  }
};

// Helper function to delete multiple images
const deleteMultipleImages = async (images) => {
  try {
    if (images && images.length > 0) {
      const deletePromises = images.map(image => {
        if (image.publicId) {
          return cloudinary.uploader.destroy(image.publicId);
        }
      });
      await Promise.all(deletePromises);
    }
  } catch (error) {
    console.error('Error deleting multiple images from Cloudinary:', error);
  }
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  handleUploadError,
  deleteImage,
  deleteMultipleImages,
  cloudinary
}; 