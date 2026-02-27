"use client";

import { createContext, useContext, useState } from "react";

const LocationContext = createContext(null);

export function useLocation() {
  return useContext(LocationContext);
}

export default function LocationProvider({ children }) {
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState("idle"); 
  const [placeName, setPlaceName] = useState(null);

  // idle | loading | granted | denied

  function requestLocation() {
    // 🛑 cegah spam klik
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
        timeout: 10000,
      }
    );
  }

  async function fetchPlaceName(lat, lon) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
        {
          headers: {
            "User-Agent": "Setempat.id",
          },
        }
      );

      const data = await res.json();

      const village =
        data?.address?.village ||
        data?.address?.suburb ||
        data?.address?.town ||
        data?.address?.city ||
        "";

      const city =
        data?.address?.city ||
        data?.address?.county ||
        data?.address?.state ||
        "";

      const finalName =
        village || city
          ? `${village}${village && city ? ", " : ""}${city}`
          : "Lokasi Anda";

      setPlaceName(finalName);
    } catch (err) {
      console.log("Gagal ambil nama lokasi", err);
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
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}