// hooks/useClock.ts - OPTIMASI dengan jam & menit terpisah
import { useState, useEffect, useRef, useCallback } from 'react';

export function useClock() {
  const [time, setTime] = useState(() => new Date());
  const rafRef = useRef<number>();

  useEffect(() => {
    let lastUpdate = performance.now();
    
    const update = (now: number) => {
      if (now - lastUpdate >= 1000) {
        setTime(new Date());
        lastUpdate = now;
      }
      rafRef.current = requestAnimationFrame(update);
    };
    
    rafRef.current = requestAnimationFrame(update);
    
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const timeLabel = useCallback(() => {
    const hours = time.getHours();
    if (hours >= 5 && hours < 11) return 'Pagi';
    if (hours >= 11 && hours < 15) return 'Siang';
    if (hours >= 15 && hours < 18) return 'Sore';
    return 'Malam';
  }, [time]);

  // Format jam dan menit terpisah
  const hours = time.getHours().toString().padStart(2, '0');
  const minutes = time.getMinutes().toString().padStart(2, '0');

  return {
    currentTime: time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    currentHour: hours,
    currentMinute: minutes,
    timeLabel: timeLabel()
  };
}