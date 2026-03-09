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
  const [placeName, setPlaceName] = useState(null);

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

  // UBAH: Sekarang menggunakan Promise agar modal bisa 'await'
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
          
          // Tunggu sampai nama tempat didapat baru resolve
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
      
      return finalName; // Kembalikan nilai untuk resolve
    } catch (err) {
      console.error("Geocoding error:", err);
      setPlaceName("Pasuruan, Jawa Timur");
      return "Pasuruan, Jawa Timur";
    }
  }

  return (
    <LocationContext.Provider value={{ location, status, placeName, requestLocation, setManualLocation }}>
      {children}
    </LocationContext.Provider>
  );
}