// hooks/useClock.js
import { useState, useEffect } from "react";

export function useClock() {
  const [currentTime, setCurrentTime] = useState("");
  const [timeLabel, setTimeLabel] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      setCurrentTime(`${hh}:${mm}`);

      const hour = now.getHours();
      if (hour >= 5 && hour < 11) setTimeLabel("Pagi");
      else if (hour >= 11 && hour < 15) setTimeLabel("Siang");
      else if (hour >= 15 && hour < 18) setTimeLabel("Sore");
      else setTimeLabel("Malam");
    };

    updateTime();
    const timer = setInterval(updateTime, 60000); // Update setiap 1 menit saja
    return () => clearInterval(timer);
  }, []);

  return { currentTime, timeLabel };
}