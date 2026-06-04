// lib/feedUtils.js

import { processFeedItem } from "./feedEngine";

// ==================== CONSTANTS ====================
export const FEED_CONFIG = {
  // Cache & Timing
  CACHE_DURATION: 2 * 60 * 1000,
  SESSION_CACHE_DURATION: 2 * 60 * 1000,
  TOAST_DURATION: 2000,
  POLLING_INTERVAL_MS: 45000,
  REFRESH_RESET_DELAY: 1000,
  LOCATION_TRANSITION_DELAY: 300,
  BREAK_COOLDOWN_MS: 15 * 60 * 1000,
  
  // Radius & Distance
  DEFAULT_RADIUS: 10,
  RANKING_WEIGHT: 0.3,
  DISTANCE_WEIGHT: 0.7,
  
  // Limits
  DEFAULT_LIMIT: 8,
  MAX_CACHE_ITEMS: 75,
  SESSION_CACHE_MAX_ITEMS: 20,
  LIMIT_VISIBLE: 10,
  
  // Intersection Observer
  INTERSECTION_ROOT_MARGIN: "400px",
  INTERSECTION_THRESHOLD: 0.1,
  
  // Break Cards
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
  if (distance === null || distance === undefined) return 20;
  if (distance <= 0.5) return 100;
  if (distance <= 1) return 90;
  if (distance <= 2) return 80;
  if (distance <= 3) return 70;
  if (distance <= 5) return 50;
  if (distance <= 10) return 30;
  return 10;
};

export const calculateHybridScore = (item, userLocation) => {
  const rankingScore = item.realtimeScore || 50;

  let distance = null;
  if (userLocation && item.latitude && item.longitude) {
    distance = haversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      item.latitude,
      item.longitude
    );
  }

  const distanceScore = getDistanceScore(distance);
  const hybridScore = (rankingScore * FEED_CONFIG.RANKING_WEIGHT) + (distanceScore * FEED_CONFIG.DISTANCE_WEIGHT);

  return { hybridScore, rankingScore, distanceScore, distance };
};

// ==================== FEED ITEM CACHE ====================
if (typeof window !== 'undefined' && !window.__feedItemCache) {
  window.__feedItemCache = new Map();
  window.__feedItemCacheMaxSize = FEED_CONFIG.MAX_CACHE_ITEMS;
}

export const cachedProcessFeedItem = (item, locationReady, location) => {
  if (typeof window === 'undefined') {
    return processFeedItem({ item, locationReady, location, comments: {} });
  }

  const cacheKey = `${item.id}_${locationReady}_${location?.latitude || 0}_${location?.longitude || 0}`;

  if (window.__feedItemCache.has(cacheKey)) {
    return window.__feedItemCache.get(cacheKey);
  }

  const result = processFeedItem({ item, locationReady, location, comments: {} });

  if (window.__feedItemCache.size > window.__feedItemCacheMaxSize) {
    const firstKey = window.__feedItemCache.keys().next().value;
    window.__feedItemCache.delete(firstKey);
  }

  window.__feedItemCache.set(cacheKey, result);
  return result;
};

// ==================== TIME UTILS ====================
export const getRelativeTime = (createdAt) => {
  if (!createdAt) return null;
  const diffMin = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin}m lalu`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}j lalu`;
  return `${Math.floor(diffMin / 1440)}hari lalu`;
};