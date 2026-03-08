"use client";

import { createContext, useContext, useState } from "react";

const LocationContext = createContext(null);

export function useLocation() {
  return useContext(LocationContext);
}

export default function LocationProvider({ children }) {
  // Set default awal ke null atau titik tengah Pasuruan agar tidak kosong
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState("idle");
  const [placeName, setPlaceName] = useState(null);

  const setManualLocation = (spot) => {
    // CEK: Jika spot adalah null (User klik Nonaktifkan)
    if (!spot) {
      setLocation(null);
      setPlaceName(null);
      setStatus("idle"); // Kembalikan status ke awal
      localStorage.removeItem("user-location"); // Hapus cache
      return;
    }

   // Jika spot ada isinya, baru jalankan logika ini
   setLocation({
     latitude: spot.latitude,
     longitude: spot.longitude,
   });
   setPlaceName(spot.name);
   setStatus("granted");
   localStorage.setItem("user-location", JSON.stringify(spot));
 };

  // 2. FUNGSI GPS (HP Friendly - Kode Anda sebelumnya)
  function requestLocation() {
    if (status === "loading") return;

    if (!navigator.geolocation) {
      setStatus("denied");
      return;
    }

    setStatus("loading");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        setLocation({
          latitude: lat,
          longitude: lon,
        });

        setStatus("granted");
        fetchPlaceName(lat, lon);
      },
      () => {
        setStatus("denied");
      },
      {
        enableHighAccuracy: true,
        timeout: 7000,
      }
    );
  }

  async function fetchPlaceName(lat, lon) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
      );

      const data = await res.json();
      const village = data?.address?.village || data?.address?.suburb || data?.address?.town || data?.address?.city || "";
      const city = data?.address?.city || data?.address?.county || data?.address?.state || "";

      const finalName = village || city 
        ? `${village}${village && city ? ", " : ""}${city}` 
        : "Lokasi Anda";

      setPlaceName(finalName);
    } catch (err) {
      setPlaceName("Lokasi Anda");
    }
  }

  return (
    <LocationContext.Provider
      value={{
        location,
        status,
        placeName,
        requestLocation,
        setManualLocation, // Tambahkan ini agar bisa dipanggil oleh Modal
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}