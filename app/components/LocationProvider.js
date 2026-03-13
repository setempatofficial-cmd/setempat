"use client";

import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { getGreeting } from "@/lib/greeting";

const LocationContext = createContext(null);

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
}

export default function LocationProvider({ children }) {
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState("idle");
  const [placeName, setPlaceName] = useState(null);
  
  // --- SYNC TEMA TERPUSAT ---
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update waktu setiap menit untuk memastikan greeting akurat
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // "Sapaan" ini akan jadi referensi tunggal untuk Header, Feed, dan Modal
  const sapaan = useMemo(() => {
    return getGreeting(currentTime).text; 
  }, [currentTime]);
  // --------------------------

  useEffect(() => {
    const saved = localStorage.getItem("user-location");
    if (saved) {
      const parsed = JSON.parse(saved);
      setLocation({ latitude: parsed.latitude, longitude: parsed.longitude });
      setPlaceName(parsed.name);
      setStatus("granted");
    }
  }, []);

  const setManualLocation = (spot) => {
    if (!spot) {
      setLocation(null);
      setPlaceName(null);
      setStatus("idle");
      localStorage.removeItem("user-location");
      return;
    }
    setLocation({ latitude: spot.latitude, longitude: spot.longitude });
    setPlaceName(spot.name);
    setStatus("granted");
    localStorage.setItem("user-location", JSON.stringify(spot));
  };

  function requestLocation() {
    return new Promise((resolve, reject) => {
      if (status === "loading") return;
      setStatus("loading");

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setLocation({ latitude: lat, longitude: lon });
          setStatus("granted");
          
          const name = await fetchPlaceName(lat, lon);
          resolve({ lat, lon, name });
        },
        (err) => {
          setStatus("denied");
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  async function fetchPlaceName(lat, lon) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=17&addressdetails=1`
      );
      const data = await res.json();
      const addr = data?.address;

      const rawVillage = addr?.village || addr?.suburb || addr?.neighborhood || addr?.hamlet || "";
      const rawDistrict = addr?.city_district || addr?.town || addr?.municipality || "";

      const clean = (text) => 
        text ? text.replace(/Kelurahan|Desa|Kecamatan|Subdistrict|District/gi, "").trim() : "";

      const village = clean(rawVillage);
      const district = clean(rawDistrict);

      let finalName = "";
      if (village && district && village.toLowerCase() !== district.toLowerCase()) {
        finalName = `${village}, ${district}`;
      } else {
        finalName = village || district || "Lokasi Terdeteksi";
      }

      setPlaceName(finalName);
      localStorage.setItem("user-location", JSON.stringify({
        latitude: lat,
        longitude: lon,
        name: finalName
      }));
      
      return finalName;
    } catch (err) {
      console.error("Geocoding error:", err);
      setPlaceName("Pasuruan, Jawa Timur");
      return "Pasuruan, Jawa Timur";
    }
  }

  return (
    <LocationContext.Provider 
      value={{ 
        location, 
        status, 
        placeName, 
        requestLocation, 
        setManualLocation,
        sapaan // <--- Sekarang sapaan dibagikan ke seluruh aplikasi
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}