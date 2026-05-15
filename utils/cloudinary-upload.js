// cloudinary-upload.js
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export async function uploadAndOptimizeVideo(videoBuffer, options = {}) {
  const uploadOptions = {
    resource_type: 'video',
    upload_preset: 'video_optimization_preset', // preset yang sudah dibuat
    
    // Eager transformations untuk multiple formats
    eager: [
      {
        format: 'mp4',
        quality: 'auto:good',
        bit_rate: '800k',
        width: 720,
        crop: 'limit'
      },
      {
        format: 'webm',
        quality: 'auto:good', 
        bit_rate: '600k',
        width: 720,
        crop: 'limit'
      },
      // Thumbnail generation
      {
        format: 'jpg',
        width: 320,
        height: 180,
        crop: 'fill',
        gravity: 'auto'
      }
    ],
    eager_async: true,
    eager_notification_url: `${process.env.APP_URL}/api/webhooks/video-optimized`,
    
    // Additional optimizations
    transformation: [
      {
        quality: 'auto',
        format: 'auto',
        codec: 'auto',
        bit_rate: 'auto'
      }
    ]
  };
  
  try {
    const result = await cloudinary.uploader.upload(
      `data:video/mp4;base64,${videoBuffer.toString('base64')}`,
      uploadOptions
    );
    
    return {
      success: true,
      optimizedUrl: result.secure_url,
      publicId: result.public_id,
      formats: result.eager,
      originalSize: result.bytes,
      optimizedSize: result.eager?.[0]?.bytes || result.bytes
    };
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: error.message };
  }
}