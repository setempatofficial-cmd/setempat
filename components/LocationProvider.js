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
  const [activeMode, setActiveMode] = useState('gps');
  
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
      setActiveMode(parsed.mode || 'gps');
      setStatus("granted");
    }
  }, []);

  const setManualLocation = (spot) => {
    if (!spot) {
      setLocation(null);
      setPlaceName(null);
      setActiveMode('off');
      setStatus("idle");
      localStorage.removeItem("user-location");
      return;
    }
    setLocation({ latitude: spot.latitude, longitude: spot.longitude });
    setPlaceName(spot.name);
     setActiveMode('manual'); 
    setStatus("granted");
    localStorage.setItem("user-location", JSON.stringify(spot));
  };

  // 1. Ubah requestLocation agar menerima parameter mode
function requestLocation(mode = 'gps') { 
  setActiveMode(mode); 
  return new Promise((resolve, reject) => {
    if (status === "loading") return;
    setStatus("loading");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLocation({ latitude: lat, longitude: lon });
        setStatus("granted");
        
        // Kirim mode ke fetchPlaceName
        const name = await fetchPlaceName(lat, lon, mode);
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

// 2. Ubah fetchPlaceName untuk memproses Nama berdasarkan Mode
async function fetchPlaceName(lat, lon, mode = 'gps') {
  try {
    // Jika mode 'general', kita gunakan zoom yang lebih kecil (kabupaten)
    const zoomLevel = mode === 'general' ? 10 : 19;
    
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=${zoomLevel}&addressdetails=1`
    );
    const data = await res.json();
    const addr = data?.address;

    const clean = (text) => 
      text ? text.replace(/Kelurahan|Desa|Kecamatan|Subdistrict|District|Kabupaten|Regency/gi, "").trim() : "";

    let finalName = "";

    if (mode === 'general') {
      // MODE AREA UMUM: Ambil Kabupaten (county) atau Kota (city)
      const rawCounty = addr?.county || addr?.city || addr?.state || "";
      finalName = clean(rawCounty) || "Area Umum";
    } else {
      // MODE RADIUS 10KM: Pakai logika lamamu (Desa + Kecamatan)
      const rawVillage = addr?.village || addr?.suburb || addr?.neighborhood || addr?.hamlet || "";
      const rawDistrict = addr?.city_district || addr?.town || addr?.municipality || "";
      
      const village = clean(rawVillage);
      const district = clean(rawDistrict);

      if (village && district && village.toLowerCase() !== district.toLowerCase()) {
        finalName = `${village}, ${district}`;
      } else {
        finalName = village || district || "Lokasi Terdeteksi";
      }
    }

    setPlaceName(finalName);
    localStorage.setItem("user-location", JSON.stringify({
      latitude: lat,
      longitude: lon,
      name: finalName,
      mode: mode // Simpan mode juga agar konsisten saat refresh
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
        activeMode,  
        requestLocation, 
        setManualLocation,
        sapaan // <--- Sekarang sapaan dibagikan ke seluruh aplikasi
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}