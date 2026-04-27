// utils/mediaUtils.js

/**
 * Deteksi apakah URL adalah video
 * @param {string} url - URL media
 * @returns {boolean}
 */
export const isVideoUrl = (url) => {
  if (!url) return false;
  
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m3u8'];
  const isVideoExt = videoExtensions.some(ext => url.toLowerCase().includes(ext));
  const isSupabaseVideo = url.includes('/video/') || url.includes('video/mp4');
  
  return isVideoExt || isSupabaseVideo;
};

/**
 * Deteksi apakah URL adalah gambar
 * @param {string} url - URL media
 * @returns {boolean}
 */
export const isImageUrl = (url) => {
  if (!url) return false;
  
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  return imageExtensions.some(ext => url.toLowerCase().includes(ext));
};

/**
 * Mendapatkan tipe media dari URL
 * @param {string} url - URL media
 * @returns {'video' | 'image' | 'unknown'}
 */
export const getMediaType = (url) => {
  if (!url) return 'unknown';
  if (isVideoUrl(url)) return 'video';
  if (isImageUrl(url)) return 'image';
  return 'unknown';
};