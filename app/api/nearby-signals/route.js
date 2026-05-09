"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function NearbyMicroSignals({ tempatId, theme, radius = 1 }) {
  const [signals, setSignals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tempatId) return;

    async function fetchSignals() {
      setLoading(true);
      try {
        const res = await fetch(`/api/nearby-signals?tempatId=${tempatId}&radius=${radius}`);
        const data = await res.json();
        
        // Transform API response ke format yang sesuai
        setSignals([
          { 
            id: 1, 
            label: "Lalu Lintas", 
            status: data.traffic?.status || "Tidak Ada Data",
            icon: getTrafficIcon(data.traffic?.status),
            color: getTrafficColor(data.traffic?.status),
            detail: data.traffic?.detail
          },
          { 
            id: 2, 
            label: "Cuaca", 
            status: data.weather?.condition || "Tidak Ada Data",
            icon: getWeatherIcon(data.weather?.condition),
            color: getWeatherColor(data.weather?.condition),
            temp: data.weather?.temperature
          },
          { 
            id: 3, 
            label: "Keramaian", 
            status: data.crowd?.level || "Normal",
            icon: getCrowdIcon(data.crowd?.level),
            color: getCrowdColor(data.crowd?.level),
            count: data.crowd?.current_count
          },
        ]);
      } catch (err) {
        console.error("Failed to fetch nearby signals:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchSignals();

    // Realtime subscription untuk update sinyal
    const channel = supabase
      .channel(`signals_${tempatId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'user_signals', filter: `tempat_id=eq.${tempatId}` },
        () => fetchSignals() // refresh data
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tempatId, radius]);

  // Loading state
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {[1,2,3].map(i => (
          <div key={i} className={`p-3 rounded-2xl animate-pulse ${theme.isMalam ? 'bg-white/5' : 'bg-black/5'}`}>
            <div className="h-6 w-6 mx-auto mb-1 rounded-full bg-gray-500/20" />
            <div className="h-2 w-10 mx-auto mb-1 bg-gray-500/20 rounded" />
            <div className="h-3 w-12 mx-auto bg-gray-500/20 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 rounded-2xl text-center text-xs ${theme.isMalam ? 'bg-red-500/10' : 'bg-red-100'}`}>
        <span>⚠️ Gagal memuat sinyal sekitar</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {signals?.map((sig, idx) => (
        <motion.div
          key={sig.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          whileHover={{ scale: 1.02 }}
          className={`p-3 rounded-2xl flex flex-col items-center justify-center text-center border transition-all cursor-help ${
            theme.isMalam ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-black/5 border-black/5 hover:bg-black/10'
          }`}
          title={sig.detail || `Status: ${sig.status}`}
        >
          <span className="text-lg mb-1">{sig.icon}</span>
          <p className={`text-[8px] font-black uppercase tracking-tighter opacity-40 mb-0.5 ${theme.text}`}>
            {sig.label}
          </p>
          <p className={`text-[10px] font-bold ${sig.color} leading-none`}>
            {sig.status}
            {sig.temp && <span className="text-[8px] ml-0.5">°C</span>}
            {sig.count && <span className="text-[8px] ml-0.5"> org</span>}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

// Helper functions untuk icon & warna berdasarkan data real
function getTrafficIcon(status) {
  const icons = { Lancar: "🏎️", Padat: "🐢", Macet: "🚗💨", MacetTotal: "🚫" };
  return icons[status] || "🏎️";
}

function getTrafficColor(status) {
  const colors = { Lancar: "text-emerald-400", Padat: "text-amber-400", Macet: "text-red-400", MacetTotal: "text-red-600" };
  return colors[status] || "text-emerald-400";
}

function getWeatherIcon(condition) {
  const icons = { Cerah: "☀️", Mendung: "☁️", Hujan: "🌧️", Badai: "⛈️" };
  return icons[condition] || "☁️";
}

function getWeatherColor(condition) {
  const colors = { Cerah: "text-yellow-400", Mendung: "text-sky-400", Hujan: "text-blue-400", Badai: "text-indigo-400" };
  return colors[condition] || "text-sky-400";
}

function getCrowdIcon(level) {
  const icons = { Sepi: "👤", Normal: "👥", Ramai: "👥👥", SangatRamai: "👥👥👥" };
  return icons[level] || "👥";
}

function getCrowdColor(level) {
  const colors = { Sepi: "text-gray-400", Normal: "text-amber-400", Ramai: "text-orange-400", SangatRamai: "text-red-400" };
  return colors[level] || "text-amber-400";
}