// hooks/useClock.js
import { useState, useEffect } from 'react';

// Fungsi helper untuk waktu Indonesia
export function getIndonesianTimeLabel(date = new Date()) {
  const hour = date.getHours();
  // Standar waktu Indonesia
  if (hour >= 4 && hour < 10) return 'Pagi';
  if (hour >= 10 && hour < 14) return 'Siang';
  if (hour >= 14 && hour < 18) return 'Sore';
  return 'Malam';
}

export function getTimeInfo(date = new Date()) {
  const hour = date.getHours();
  const timeLabel = getIndonesianTimeLabel(date);
  
  const TIME_THRESHOLDS = {
    Pagi: { icon: '🌅', gradient: 'from-orange-400 to-yellow-300' },
    Siang: { icon: '☀️', gradient: 'from-amber-500 to-orange-400' },
    Sore: { icon: '🌆', gradient: 'from-orange-500 to-rose-400' },
    Malam: { icon: '🌙', gradient: 'from-slate-800 to-slate-900' }
  };
  
  const threshold = TIME_THRESHOLDS[timeLabel] || TIME_THRESHOLDS.Siang;
  
  return {
    label: timeLabel,
    hour,
    icon: threshold.icon,
    gradient: threshold.gradient,
    isMalam: timeLabel === 'Malam',
    isPagi: timeLabel === 'Pagi',
    isSiang: timeLabel === 'Siang',
    isSore: timeLabel === 'Sore',
  };
}

export function useClock(updateInterval = 60000) {
  const [time, setTime] = useState(() => new Date());
  const [timeLabel, setTimeLabel] = useState(() => getIndonesianTimeLabel());
  const [timeInfo, setTimeInfo] = useState(() => getTimeInfo());
  
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(now);
      
      const newLabel = getIndonesianTimeLabel(now);
      setTimeLabel(prev => {
        if (prev !== newLabel) {
          setTimeInfo(getTimeInfo(now));
          return newLabel;
        }
        return prev;
      });
    };
    
    updateClock();
    const interval = setInterval(updateClock, updateInterval);
    
    return () => clearInterval(interval);
  }, [updateInterval]);
  
  return {
    time,
    timeLabel,
    timeInfo,
    hour: time.getHours(),
    minute: time.getMinutes(),
    formattedTime: time.toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  };
}