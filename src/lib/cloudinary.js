// src/lib/cloudinary.js - Cloudinary configuration
import { v2 as cloudinary } from 'cloudinary';
import { ENV } from './env.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: ENV.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: ENV.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: ENV.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Export configured cloudinary instance
export default cloudinary;

// Helper function to upload to Cloudinary
export const uploadToCloudinary = async (filePath, folder = 'chat_uploads') => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: 'auto',
      quality: 'auto:good', // Let Cloudinary optimize
      fetch_format: 'auto' // Convert to optimal format
    });
    
    return {
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      resource_type: result.resource_type,
      format: result.format,
      size: result.bytes,
      created_at: result.created_at
    };
  } catch (error) {
    console.error('❌ Cloudinary upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Helper function to delete from Cloudinary
export const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return {
      success: result.result === 'ok',
      result: result.result
    };
  } catch (error) {
    console.error('❌ Cloudinary delete error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
