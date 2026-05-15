// lib/cloudinary.js

// Optimasi Video
export function optimizeVideoUrl(url) {
  if (!url || !url.includes('cloudinary')) return url;
  
  return url.replace(
    '/upload/',
    '/upload/q_auto:good,w_720,c_limit,vc_auto/'
  );
}

//  Optimasi Gambar
export function optimizeImageUrl(url, options = {}) {
  if (!url || !url.includes('cloudinary')) return url;
  
  const width = options.width || 720;
  const quality = options.quality || 'auto:good';
  
  return url.replace(
    '/upload/',
    `/upload/q_${quality},w_${width},c_limit,f_auto/`
  );
}