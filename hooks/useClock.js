// hooks/useClock.js 
import { useState, useEffect, useRef } from 'react';

export function useClock() {
  const [currentHour, setCurrentHour] = useState(() => {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0');
  });
  
  const [currentMinute, setCurrentMinute] = useState(() => {
    const now = new Date();
    return now.getMinutes().toString().padStart(2, '0');
  });
  
  const [timeLabel, setTimeLabel] = useState(() => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Pagi';
    if (hour < 15) return 'Siang';
    if (hour < 18) return 'Sore';
    return 'Malam';
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const newHour = now.getHours().toString().padStart(2, '0');
      const newMinute = now.getMinutes().toString().padStart(2, '0');
      const newLabel = (() => {
        const hour = now.getHours();
        if (hour < 11) return 'Pagi';
        if (hour < 15) return 'Siang';
        if (hour < 18) return 'Sore';
        return 'Malam';
      })();
      
      setCurrentHour(newHour);
      setCurrentMinute(newMinute);
      setTimeLabel(newLabel);
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  return { 
    currentHour, 
    currentMinute, 
    timeLabel,
    currentTime: `${currentHour}:${currentMinute}` // Untuk kompatibilitas
  };
}