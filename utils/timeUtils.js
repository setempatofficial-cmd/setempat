// utils/timeUtils.js
'use client'

import { useState, useEffect, useRef, useMemo } from 'react';

// ========== TIME CONSTANTS ==========
export const TIME_THRESHOLDS = {
  Pagi: { start: 4, end: 10, label: 'pagi', icon: '🌅', gradient: 'from-orange-400 to-yellow-300' },
  Siang: { start: 10, end: 15, label: 'siang', icon: '☀️', gradient: 'from-amber-500 to-orange-400' },
  Sore: { start: 15, end: 18, label: 'sore', icon: '🌆', gradient: 'from-orange-500 to-rose-400' },
  Malam: { start: 18, end: 4, label: 'malam', icon: '🌙', gradient: 'from-slate-800 to-slate-900' }
};

// ========== CORE FUNCTIONS ==========
export function getIndonesianTimeLabel(date = new Date()) {
  const hour = typeof date === 'number' ? new Date(date).getHours() : date.getHours();
  if (hour >= 4 && hour < 10) return 'Pagi';
  if (hour >= 10 && hour < 15) return 'Siang';
  if (hour >= 15 && hour < 18) return 'Sore';
  return 'Malam';
}

export function getIndonesianTimeLabelLower(date = new Date()) {
  return getIndonesianTimeLabel(date).toLowerCase();
}

export function getTimeInfo(date = new Date()) {
  const dateObj = typeof date === 'number' ? new Date(date) : date;
  const hour = dateObj.getHours();
  const timeLabel = getIndonesianTimeLabel(dateObj);
  const threshold = TIME_THRESHOLDS[timeLabel];

  return {
    label: timeLabel,
    labelLower: timeLabel.toLowerCase(),
    hour,
    icon: threshold.icon,
    gradient: threshold.gradient,
    isMalam: timeLabel === 'Malam',
    isPagi: timeLabel === 'Pagi',
    isSiang: timeLabel === 'Siang',
    isSore: timeLabel === 'Sore',
  };
}

// ========== HOOKS ==========
export function useClock(updateInterval = 60000) {
  const [time, setTime] = useState(null);
  const [timeLabel, setTimeLabel] = useState(null);
  const [timeInfo, setTimeInfo] = useState(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    const updateClock = () => {
      // 🔥 FIX: Gunakan waktu lokal langsung, tanpa konversi
      const now = new Date();
      setTime(now);
      const newLabel = getIndonesianTimeLabel(now);
      setTimeLabel(newLabel);
      setTimeInfo(getTimeInfo(now));
    };

    updateClock();
    const interval = setInterval(updateClock, updateInterval);
    return () => clearInterval(interval);
  }, [updateInterval]);

  const formattedTime = useMemo(() => {
    if (!time) return '--:--';
    return time.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }, [time]);

  return {
    time: time || new Date(),
    timeLabel: timeLabel || 'Siang',
    timeInfo: timeInfo || getTimeInfo(new Date()),
    hour: time?.getHours() || 12,
    minute: time?.getMinutes() || 0,
    formattedTime,
    isClient,
  };
}

// ========== OPTIMIZED HOOKS ==========
export function useOptimizedClock() {
  const [timeInfo, setTimeInfo] = useState(() => getTimeInfo());
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimeInfo(getTimeInfo());
    }, 60000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return timeInfo;
}

export function useFormattedTimeAgo(dateString, options = { debounceMs: 0 }) {
  const [formatted, setFormatted] = useState(() => formatTimeAgoCached(dateString));
  const dateRef = useRef(dateString);

  useEffect(() => {
    if (dateRef.current === dateString) return;
    dateRef.current = dateString;
    const update = () => setFormatted(formatTimeAgoCached(dateString));
    if (options.debounceMs > 0) {
      const timer = setTimeout(update, options.debounceMs);
      return () => clearTimeout(timer);
    }
    update();
  }, [dateString, options.debounceMs]);

  return formatted;
}

// ========== FORMAT TIME AGO ==========
export function formatTimeAgo(dateString) {
  if (!dateString) return 'baru saja';
  const now = new Date();
  const past = new Date(dateString);
  const diffInSeconds = Math.floor((now - past) / 1000);
  if (isNaN(diffInSeconds) || diffInSeconds < 0) return 'baru saja';
  if (diffInSeconds < 60) return `${diffInSeconds} detik lalu`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} menit lalu`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} jam lalu`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} hari lalu`;
  if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return `${weeks} minggu lalu`;
  }
  if (diffInDays < 365) {
    const months = Math.floor(diffInDays / 30);
    return `${months} bulan lalu`;
  }
  const years = Math.floor(diffInDays / 365);
  return `${years} tahun lalu`;
}

export function formatTimeAgoWithClock(dateString) {
  if (!dateString) return 'baru saja';
  const date = new Date(dateString);
  const timeAgo = formatTimeAgo(dateString);
  const clock = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });
  return `${timeAgo} • ${clock}`;
}

// ========== CACHE SYSTEM ==========
const timeAgoCache = new Map();
const CACHE_DURATION = 60000;

export function formatTimeAgoCached(dateString) {
  if (!dateString) return 'baru saja';
  const cacheKey = typeof dateString === 'string' ? dateString : String(dateString);
  const cached = timeAgoCache.get(cacheKey);
  const now = Date.now();
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.value;
  }
  const result = formatTimeAgo(dateString);
  if (timeAgoCache.size > 300) {
    const firstKey = timeAgoCache.keys().next().value;
    timeAgoCache.delete(firstKey);
  }
  timeAgoCache.set(cacheKey, { value: result, timestamp: now });
  return result;
}