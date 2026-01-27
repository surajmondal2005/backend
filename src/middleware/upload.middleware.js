// src/middleware/upload.middleware.js - COMPLETE FIXED VERSION
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, "../../uploads");

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`✅ Created uploads directory: ${uploadsDir}`);
}

// Disk storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Create safe filename
    const originalName = path.parse(file.originalname).name;
    const extension = path.extname(file.originalname);
    const safeName = originalName.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `${Date.now()}_${safeName}${extension}`;
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  // Allowed MIME types
  const allowedMimeTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'video/mp4', 'video/quicktime',
    'audio/mpeg', 'audio/mp3'
  ];
  
  // Allowed file extensions
  const allowedExtensions = /jpeg|jpg|png|gif|webp|pdf|doc|docx|txt|mp4|mov|mp3/;
  
  // Check both MIME type and extension
  const extname = path.extname(file.originalname).toLowerCase().replace('.', '');
  const isValidMimeType = allowedMimeTypes.includes(file.mimetype);
  const isValidExtension = allowedExtensions.test(extname);
  
  if (isValidMimeType && isValidExtension) {
    cb(null, true);
  } else {
    cb(new Error(`File type not supported. Allowed: ${allowedExtensions.source}`), false);
  }
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: 15 * 1024 * 1024, // 15MB limit
    files: 1 // Only one file at a time
  },
});

// Image compression function
const compressImage = async (inputPath, outputPath, mimeType) => {
  try {
    let sharpInstance = sharp(inputPath);
    
    // Get original image info
    const metadata = await sharpInstance.metadata();
    
    // Configure compression based on image type
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      sharpInstance = sharpInstance
        .jpeg({ 
          quality: 80, // Compress to 80% quality
          progressive: true,
          mozjpeg: true // Better compression
        });
    } else if (mimeType === 'image/png') {
      sharpInstance = sharpInstance
        .png({ 
          quality: 80,
          compressionLevel: 8,
          progressive: true
        });
    } else if (mimeType === 'image/webp') {
      sharpInstance = sharpInstance
        .webp({ 
          quality: 80,
          effort: 4 // Compression effort (0-6)
        });
    } else if (mimeType === 'image/gif') {
      // For GIFs, we'll keep them as is or convert to webp for better compression
      sharpInstance = sharpInstance
        .webp({ 
          quality: 80,
          effort: 4
        });
      // Update the output extension to webp
      outputPath = outputPath.replace(/\.[^/.]+$/, '.webp');
    }
    
    // Resize if image is too large (max 1920x1080)
    if (metadata.width > 1920 || metadata.height > 1080) {
      sharpInstance = sharpInstance.resize(1920, 1080, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    
    await sharpInstance.toFile(outputPath);
    
    // Get compressed file size
    const compressedStats = fs.statSync(outputPath);
    const originalStats = fs.statSync(inputPath);
    const compressionRatio = ((originalStats.size - compressedStats.size) / originalStats.size * 100).toFixed(2);
    
    console.log(`🗜️ Image compressed: ${originalStats.size} bytes → ${compressedStats.size} bytes (${compressionRatio}% reduction)`);
    
    return {
      success: true,
      outputPath,
      originalSize: originalStats.size,
      compressedSize: compressedStats.size,
      compressionRatio: parseFloat(compressionRatio)
    };
  } catch (error) {
    console.error('❌ Error compressing image:', error);
    throw error;
  }
};

// Middleware to compress images after upload
const compressImageMiddleware = async (req, res, next) => {
  try {
    if (!req.file) {
      return next();
    }
    
    // Check if the uploaded file is an image
    const imageMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    if (imageMimeTypes.includes(req.file.mimetype)) {
      const originalPath = req.file.path;
      const compressedPath = originalPath.replace(/(\.[^/.]+)$/, '_compressed$1');
      
      // Compress the image
      const compressionResult = await compressImage(originalPath, compressedPath, req.file.mimetype);
      
      if (compressionResult.success) {
        // Replace original file with compressed one
        fs.unlinkSync(originalPath); // Remove original
        fs.renameSync(compressedPath, originalPath); // Rename compressed to original
        
        // Update file info
        req.file.size = compressionResult.compressedSize;
        req.file.path = originalPath;
        
        // Store compression info for potential use
        req.file.compression = {
          originalSize: compressionResult.originalSize,
          compressedSize: compressionResult.compressedSize,
          compressionRatio: compressionResult.compressionRatio
        };
      }
    }
    
    next();
  } catch (error) {
    console.error('❌ Error in compressImageMiddleware:', error);
    return res.status(500).json({ 
      error: 'Image compression failed',
      message: error.message 
    });
  }
};

// Export different upload options
export const uploadSingle = upload.single("file"); // For field name "file"
export const uploadSingleImage = upload.single("image"); // For field name "image"
export const uploadSingleAttachment = upload.single("attachment"); // For field name "attachment"

// Combined middleware for upload + compression
export const uploadAndCompressImage = [
  upload.single("image"),
  compressImageMiddleware
];

export const uploadAndCompressFile = [
  upload.single("file"),
  compressImageMiddleware
];

export const uploadAndCompressAttachment = [
  upload.single("attachment"),
  compressImageMiddleware
];

// Debug middleware to see what's being uploaded
export const debugUpload = (req, res, next) => {
  console.log('📁 Upload debug - Content-Type:', req.headers['content-type']);
  console.log('📁 Upload debug - Body keys:', Object.keys(req.body));
  console.log('📁 Upload debug - File field expected: "file"');
  next();
};

// Main export for backward compatibility
export { upload };