"use client";
import { useState, useEffect } from "react";

export function useClock() {
  const [currentTime, setCurrentTime] = useState("");
  const [timeLabel, setTimeLabel] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      
      // 1. Jam Digital (HH:mm:ss)
      const timeString = now.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      setCurrentTime(timeString);

      // 2. Label Waktu (Pagi/Siang/Sore/Malam)
      const hour = now.getHours();
      if (hour >= 5 && hour < 11) setTimeLabel("Pagi");
      else if (hour >= 11 && hour < 15) setTimeLabel("Siang");
      else if (hour >= 15 && hour < 18) setTimeLabel("Sore");
      else setTimeLabel("Malam");
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return { currentTime, timeLabel };
}