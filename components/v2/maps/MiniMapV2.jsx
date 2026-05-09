"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// HINDARI import L dan CSS secara langsung di top level
// Kita akan import dinamis di dalam useEffect

// Dynamic imports untuk semua komponen Leaflet
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false, loading: () => <MapLoading /> }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);
const Circle = dynamic(
  () => import('react-leaflet').then((mod) => mod.Circle),
  { ssr: false }
);

// Komponen loading sederhana
const MapLoading = () => (
  <div className="h-full w-full bg-zinc-800/50 animate-pulse flex items-center justify-center">
    <p className="text-xs text-gray-400">Memuat peta...</p>
  </div>
);

export default function MiniMapV2({ lat, lng, theme, radius = 1, showRadius = true, isInteractive = false }) {
  const [isClient, setIsClient] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  useEffect(() => {
    // Component hanya di-render di client-side
    setIsClient(true);
    
    // Import Leaflet dan CSS secara dinamis
    const loadLeaflet = async () => {
      try {
        // Dynamic import untuk leaflet
        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');
        
        // Fix untuk marker icon Leaflet
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-shadow.png',
        });
        
        setLeafletLoaded(true);
      } catch (error) {
        console.error('Failed to load Leaflet:', error);
      }
    };
    
    loadLeaflet();
  }, []);

  // Selama di server atau leaflet belum load, tampilkan placeholder
  if (!isClient || !leafletLoaded) {
    return <MapLoading />;
  }

  // Validasi koordinat
  if (!lat || !lng) {
    return (
      <div className="relative w-full h-full bg-zinc-900 flex items-center justify-center">
        <p className="text-xs text-gray-500">Koordinat tidak tersedia</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/10">
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        scrollWheelZoom={isInteractive}
        dragging={isInteractive}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          url={theme.isMalam 
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />

        <Marker position={[lat, lng]}>
          <Popup>
            <div className="text-xs font-bold">
              📍 Lokasi Post
              <br />
              <span className="text-[10px] opacity-70">
                {lat.toFixed(4)}°, {lng.toFixed(4)}°
              </span>
            </div>
          </Popup>
        </Marker>

        {showRadius && radius && (
          <Circle
            center={[lat, lng]}
            radius={radius * 1000}
            pathOptions={{
              color: '#06b6d4',
              fillColor: '#06b6d4',
              fillOpacity: 0.15,
              weight: 2,
              dashArray: '5, 5'
            }}
          />
        )}
      </MapContainer>

      {/* Coordinate Tag */}
      <div className="absolute bottom-3 left-3 z-10 px-2 py-1 bg-black/70 backdrop-blur-md rounded-md border border-white/10 pointer-events-none">
        <p className="text-[8px] font-mono text-cyan-400 leading-none uppercase tracking-tighter">
          🎯 {lat.toFixed(4)}°, {lng.toFixed(4)}° | Radius {radius}KM
        </p>
      </div>
    </div>
  );
}