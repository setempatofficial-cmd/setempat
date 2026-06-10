import { processFeedItem } from "./feedEngine";

// ==================== CONSTANTS ====================
export const FEED_CONFIG = {
  CACHE_DURATION: 2 * 60 * 1000,
  SESSION_CACHE_DURATION: 2 * 60 * 1000,
  TOAST_DURATION: 2000,
  POLLING_INTERVAL_MS: 45000,
  REFRESH_RESET_DELAY: 1000,
  LOCATION_TRANSITION_DELAY: 300,
  BREAK_COOLDOWN_MS: 15 * 60 * 1000,

  DEFAULT_RADIUS: 10,
  // 🔥 Bobot 80% Jarak, 20% Ranking
  RANKING_WEIGHT: 0.2,
  DISTANCE_WEIGHT: 0.8,
  DISTANCE_DECAY_FACTOR: 3,

  DEFAULT_LIMIT: 8,
  MAX_CACHE_ITEMS: 75,
  SESSION_CACHE_MAX_ITEMS: 20,
  LIMIT_VISIBLE: 10,

  INTERSECTION_ROOT_MARGIN: "400px",
  INTERSECTION_THRESHOLD: 0.1,

  MIN_CARDS_BEFORE_BREAK: 2,
  MAX_CARDS_BEFORE_BREAK: 5,
};

// ==================== NETWORK UTILS ====================
export const getDynamicLimit = () => {
  if (typeof navigator === 'undefined') return FEED_CONFIG.DEFAULT_LIMIT;
  const connection = navigator.connection;
  if (!connection) return FEED_CONFIG.DEFAULT_LIMIT;

  switch (connection.effectiveType) {
    case '4g': return 8;
    case '3g': return 6;
    case '2g':
    case 'slow-2g': return 3;
    default: return 8;
  }
};

// ==================== DISTANCE UTILS ====================
export const haversineDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const getDistanceScore = (distance) => {
  if (distance === null || distance === undefined) return 0;
  return Math.max(0, 100 - (distance * 10));
};

export const getNormalizedDistanceScore = (distance, maxRadius = 40) => {
  if (distance === null || distance === undefined) return 0;
  const normalizedDistance = Math.min(1, distance / maxRadius);
  return 1 - normalizedDistance;
};

// ==================== SCORE CALCULATION ====================
export const calculateFreshnessScore = (item) => {
  if (!item?.updated_at && !item?.created_at) return 0.5;
  const updateTime = new Date(item.updated_at || item.created_at).getTime();
  const hoursSinceUpdate = (Date.now() - updateTime) / (1000 * 3600);

  if (hoursSinceUpdate < 1) return 1.0;
  if (hoursSinceUpdate < 3) return 0.85;
  if (hoursSinceUpdate < 6) return 0.65;
  if (hoursSinceUpdate < 12) return 0.45;
  if (hoursSinceUpdate < 24) return 0.25;
  return 0.1;
};

// 🔥 PERBAIKAN: Ranking score skala 0-100 (TURUNKAN BOBOT)
export const getNormalizedRankingScore = (item) => {
  let score = 0;

  // 1. VIRAL FACTOR (0-30) - TURUNKAN
  if (item.isViral) score += 30;
  else if (item.isRamai) score += 15;

  // 2. UPDATE TERBARU (0-20) - TURUNKAN
  const updateTime = new Date(item.updated_at || item.created_at).getTime();
  const hoursSinceUpdate = (Date.now() - updateTime) / (1000 * 3600);
  if (hoursSinceUpdate < 1) score += 20;
  else if (hoursSinceUpdate < 6) score += 10;
  else if (hoursSinceUpdate < 24) score += 5;

  // 3. ENGAGEMENT (0-10) - TURUNKAN
  const engagementScore = Math.min(10, (item.vibe_count || 0) / 10);
  score += engagementScore;

  return Math.min(100, Math.max(0, score));
};

// 🔥 Hybrid Score: 80% Jarak, 20% Ranking
export const calculateHybridScore = (item, userLocation) => {
  let rankingScore = getNormalizedRankingScore(item);
  let distance = null;
  let distanceScore = 0;

  if (userLocation && item.latitude && item.longitude) {
    distance = haversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      item.latitude,
      item.longitude
    );
    distanceScore = getDistanceScore(distance);
  } else if (item.distance !== undefined) {
    distance = item.distance;
    distanceScore = getDistanceScore(distance);
  }

  // 🔥 BOBOT BARU: 80% Jarak, 20% Ranking
  const hybridScore = (distanceScore * 0.8) + (rankingScore * 0.2);

  return {
    hybridScore: Math.min(100, Math.max(0, hybridScore)),
    rankingScore,
    distanceScore,
    distance,
    rankingWeight: 0.2,
    distanceWeight: 0.8
  };
};

export const getDistanceZone = (distance) => {
  if (distance === null || distance === undefined) return 'unknown';
  if (distance < 1) return 'super_near';
  if (distance < 3) return 'near';
  if (distance < 8) return 'medium';
  if (distance < 15) return 'far';
  return 'very_far';
};

// ==================== MAIN SORTING FUNCTIONS ====================
export const sortFeedByDistancePriority = (items, userLocation, maxResults = null) => {
  if (!items || items.length === 0) return [];

  const itemsWithScore = items.map(item => ({
    ...item,
    ...calculateHybridScore(item, userLocation)
  }));

  const sorted = itemsWithScore.sort((a, b) => b.hybridScore - a.hybridScore);
  return maxResults ? sorted.slice(0, maxResults) : sorted;
};

export const sortFeedByDistanceSimple = (items, userLocation) => {
  if (!items || items.length === 0) return [];
  return items
    .map(item => ({ ...item, ...calculateHybridScore(item, userLocation) }))
    .sort((a, b) => b.hybridScore - a.hybridScore);
};

// ==================== CACHE & TIME UTILS ====================
if (typeof window !== 'undefined' && !window.__feedItemCache) {
  window.__feedItemCache = new Map();
  window.__feedItemCacheMaxSize = FEED_CONFIG.MAX_CACHE_ITEMS;
}

export const cachedProcessFeedItem = (item, locationReady, location) => {
  if (typeof window === 'undefined') {
    const result = processFeedItem({ item, locationReady, location, comments: {} });
    result._freshnessScore = calculateFreshnessScore(item);
    return result;
  }

  const cacheKey = `${item.id}_${locationReady}_${location?.latitude || 0}_${location?.longitude || 0}`;
  if (window.__feedItemCache.has(cacheKey)) {
    return window.__feedItemCache.get(cacheKey);
  }

  const result = processFeedItem({ item, locationReady, location, comments: {} });
  result._freshnessScore = calculateFreshnessScore(item);

  if (window.__feedItemCache.size > window.__feedItemCacheMaxSize) {
    const firstKey = window.__feedItemCache.keys().next().value;
    window.__feedItemCache.delete(firstKey);
  }

  window.__feedItemCache.set(cacheKey, result);
  return result;
};

export const getRelativeTime = (createdAt) => {
  if (!createdAt) return null;
  const diffMin = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin}m lalu`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}j lalu`;
  return `${Math.floor(diffMin / 1440)}hari lalu`;
};

export default {
  FEED_CONFIG,
  getDynamicLimit,
  haversineDistance,
  getDistanceScore,
  getNormalizedDistanceScore,
  calculateFreshnessScore,
  getNormalizedRankingScore,
  calculateHybridScore,
  getDistanceZone,
  sortFeedByDistancePriority,
  sortFeedByDistanceSimple,
  cachedProcessFeedItem,
  getRelativeTime
};