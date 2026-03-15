"use client";
import { useState, useEffect } from "react";

export function useClock() {
  const [currentTime, setCurrentTime] = useState("");
  const [timeLabel, setTimeLabel] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      
      // 1. Format HH:mm (Gunakan '.' atau ':' sebagai pemisah default)
      // Kita pastikan formatnya konsisten 2 digit
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      
      setCurrentTime(`${hh}:${mm}`);

      // 2. Label Waktu (Sinkron dengan sapaan di LaporanWarga)
      const hour = now.getHours();
      let label = "";
      if (hour >= 5 && hour < 11) label = "Pagi";
      else if (hour >= 11 && hour < 15) label = "Siang";
      else if (hour >= 15 && hour < 18) label = "Sore";
      else label = "Malam";
      
      setTimeLabel(label);
    };

    updateTime();
    
    // Check setiap 10 detik sudah cukup untuk jam tanpa detik
    // Tapi jika ingin instan saat menit berubah, 1 detik tetap aman.
    const timer = setInterval(updateTime, 1000); 
    
    return () => clearInterval(timer);
  }, []);

  return { currentTime, timeLabel };
}