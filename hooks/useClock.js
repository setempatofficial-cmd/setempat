// hooks/useClock.js 

import { useState, useEffect, useRef } from 'react';

export function useClock() {
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });
  
  const [timeLabel, setTimeLabel] = useState(() => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Pagi';
    if (hour < 15) return 'Siang';
    if (hour < 18) return 'Sore';
    return 'Malam';
  });

  useEffect(() => {
    // Update hanya setiap menit, bukan setiap detik
    const interval = setInterval(() => {
      const now = new Date();
      const newTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const newLabel = (() => {
        const hour = now.getHours();
        if (hour < 11) return 'Pagi';
        if (hour < 15) return 'Siang';
        if (hour < 18) return 'Sore';
        return 'Malam';
      })();
      
      setCurrentTime(newTime);
      setTimeLabel(newLabel);
    }, 60000); // Update setiap 60 detik, bukan 1 detik
    
    return () => clearInterval(interval);
  }, []);

  return { currentTime, timeLabel };
}