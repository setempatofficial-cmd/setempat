// utils/defaultAvatar.js
export const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23E3655B'/%3E%3Ccircle cx='50' cy='38' r='16' fill='white' opacity='0.9'/%3E%3Cellipse cx='50' cy='80' rx='24' ry='18' fill='white' opacity='0.9'/%3E%3C/svg%3E";

export const getAvatarUrl = (avatar) => {
  if (!avatar) return DEFAULT_AVATAR;
  if (typeof avatar === 'string' && avatar.trim() !== "") return avatar;
  if (avatar.avatar_url && avatar.avatar_url.trim() !== "") return avatar.avatar_url;
  return DEFAULT_AVATAR;
};