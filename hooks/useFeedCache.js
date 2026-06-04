// hooks/useFeedCache.js

import { useMemo } from "react";
import { FEED_CONFIG } from "@/lib/feedUtils";

export const useFeedCache = (isSlowConnection) => {
  return useMemo(() => ({
    get: (key) => {
      try {
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        const parsed = JSON.parse(cached);
        if (!parsed || !parsed.ids) return null;
        const cacheDuration = isSlowConnection ? FEED_CONFIG.CACHE_DURATION * 2 : FEED_CONFIG.CACHE_DURATION;
        if (Date.now() - parsed.timestamp > cacheDuration) return null;
        const itemsMapRestored = new Map(parsed.items);
        return { itemsMap: itemsMapRestored, orderedIds: parsed.ids };
      } catch { 
        return null; 
      }
    },
    set: (key, itemsMap, orderedIds) => {
      try {
        if (!orderedIds || orderedIds.length === 0) return;
        const itemsToCache = isSlowConnection
          ? Array.from(itemsMap.entries()).slice(0, 30)
          : Array.from(itemsMap.entries());
        localStorage.setItem(key, JSON.stringify({
          items: itemsToCache,
          ids: orderedIds.slice(0, isSlowConnection ? 30 : undefined),
          timestamp: Date.now()
        }));
      } catch (e) { 
        console.warn('Cache save failed:', e); 
      }
    },
    invalidate: () => {
      const keys = Object.keys(localStorage);
      keys.forEach(key => { 
        if (key.startsWith('feed_v2_')) localStorage.removeItem(key); 
      });
    }
  }), [isSlowConnection]);
};