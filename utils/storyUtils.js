// utils/storyUtils.js
import DOMPurify from 'dompurify';

export const sanitizeText = (text) => {
  if (!text) return '';
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
};

export const getSafeAvatarUrl = (report) => {
  try {
    if (report?.user_avatar && report.user_avatar.startsWith('https://')) {
      return report.user_avatar;
    }
    const name = report?.user_name || "Warga";
    const sanitizedName = sanitizeText(name).substring(0, 50);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(sanitizedName)}&background=0D8ABC&color=fff&length=2`;
  } catch (error) {
    return 'https://ui-avatars.com/api/?name=Warga&background=0D8ABC&color=fff';
  }
};