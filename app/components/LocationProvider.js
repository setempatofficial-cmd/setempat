"use client";

import { createContext, useContext, useState, useEffect } from "react";

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
  const [placeName, setPlaceName] = useState(null); // Format: "Desa, Kecamatan"

  // Load dari localStorage saat pertama kali aplikasi dibuka
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
    if (status === "loading") return;
    setStatus("loading");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLocation({ latitude: lat, longitude: lon });
        setStatus("granted");
        fetchPlaceName(lat, lon);
      },
      () => {
        setStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function fetchPlaceName(lat, lon) {
    try {
      // Zoom 17 sangat krusial untuk akurasi tingkat desa/sub-district
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=17&addressdetails=1`
      );
      const data = await res.json();
      const addr = data?.address;

      // 1. Ekstraksi Desa/Kelurahan (Akurasi Tinggi)
      // village: untuk desa, suburb: untuk kelurahan kota, hamlet: untuk dusun kecil
      const rawVillage = addr?.village || addr?.suburb || addr?.neighborhood || addr?.hamlet || "";
      
      // 2. Ekstraksi Kecamatan
      const rawDistrict = addr?.city_district || addr?.town || addr?.municipality || "";

      // 3. Pembersihan String (Membersihkan label administratif agar UI tidak penuh)
      const clean = (text) => 
        text ? text.replace(/Kelurahan|Desa|Kecamatan|Subdistrict|District/gi, "").trim() : "";

      const village = clean(rawVillage);
      const district = clean(rawDistrict);

      // 4. Logika Penggabungan Pintar
      let finalName = "";
      if (village && district && village.toLowerCase() !== district.toLowerCase()) {
        finalName = `${village}, ${district}`;
      } else {
        // Fallback jika salah satu kosong atau namanya sama
        finalName = village || district || "Lokasi Terdeteksi";
      }

      setPlaceName(finalName);
      
      localStorage.setItem("user-location", JSON.stringify({
        latitude: lat,
        longitude: lon,
        name: finalName
      }));
    } catch (err) {
      console.error("Geocoding error:", err);
      // Fallback aman jika API error
      setPlaceName("Pasuruan, Jawa Timur");
    }
  }

  return (
    <LocationContext.Provider value={{ location, status, placeName, requestLocation, setManualLocation }}>
      {children}
    </LocationContext.Provider>
  );
}