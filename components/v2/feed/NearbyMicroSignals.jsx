"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useWeather } from "@/hooks/useWeather";

export default function NearbyMicroSignals({ tempatId, theme, radius = 1 }) {
  const [signals, setSignals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tempatCoords, setTempatCoords] = useState(null);
  
  // Ambil koordinat tempat
  useEffect(() => {
    async function getTempatCoords() {
      const { data } = await supabase
        .from('tempat')
        .select('latitude, longitude, name')
        .eq('id', tempatId)
        .single();
      
      if (data) setTempatCoords(data);
    }
    getTempatCoords();
  }, [tempatId]);
  
  // Gunakan useWeather hook
  const { weather: weatherData } = useWeather(tempatCoords?.name || '');
  
  // Fungsi untuk mendapatkan data cuaca
  const getWeatherData = () => {
    if (weatherData) {
      return {
        condition: weatherData.short,
        temp: weatherData.temp,
        desc: weatherData.desc,
        icon: getWeatherIcon(weatherData.short),
        color: getWeatherColor(weatherData.short),
        source: 'weather_hook'
      };
    }
    
    // Fallback berdasarkan jam
    const hour = new Date().getHours();
    let condition = 'Normal';
    let icon = '🌡️';
    let temp = 24;
    
    if (hour >= 5 && hour < 11) {
      condition = 'Cerah';
      icon = '☀️';
      temp = 26;
    } else if (hour >= 11 && hour < 15) {
      condition = 'Panas';
      icon = '☀️🔥';
      temp = 32;
    } else if (hour >= 15 && hour < 18) {
      condition = 'Teduh';
      icon = '🌤️';
      temp = 28;
    } else {
      condition = 'Sejuk';
      icon = '🌙';
      temp = 24;
    }
    
    return {
      condition: condition,
      temp: temp,
      icon: icon,
      color: getWeatherColor(condition),
      source: 'time_fallback'
    };
  };

  // Main fetch function
  useEffect(() => {
    if (!tempatId) return;

    async function fetchLaporanWarga() {
      try {
        setLoading(true);
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: laporanList, error: laporanError } = await supabase
          .from('laporan_warga')
          .select('tipe, status, created_at, user_id, deskripsi, estimasi_menit, estimated_people')
          .eq('tempat_id', tempatId)
          .eq('status', 'approved')
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: false });

        if (laporanError) throw laporanError;

        const allReports = laporanList || [];

        // ============================================
        // PISAHKAN DATA UNTUK LALU LINTAS DAN KERAMAIAN
        // ============================================
        
        // Laporan untuk lalu lintas (kondisi jalan)
        const trafficReports = allReports.filter(r => {
          // Dari tipe column
          if (r.tipe === 'sepi' || r.tipe === 'ramai' || r.tipe === 'antri') return true;
          
          // Dari deskripsi (keyword lalu lintas)
          if (r.deskripsi) {
            const text = r.deskripsi.toLowerCase();
            if (text.includes('macet') || text.includes('lancar') || 
                text.includes('padat') || text.includes('ngantre') ||
                text.includes('mengular')) return true;
          }
          return false;
        });

        // Laporan untuk keramaian (jumlah orang)
        const crowdReports = allReports.filter(r => {
          // Prioritas: estimated_people (paling akurat)
          if (r.estimated_people !== null) return true;
          
          // Dari tipe column
          if (r.tipe === 'ramai' || r.tipe === 'sepi' || r.tipe === 'antri') return true;
          
          // Dari estimasi waktu antri
          if (r.estimasi_menit !== null && r.estimasi_menit > 0) return true;
          
          // Dari deskripsi (keyword keramaian)
          if (r.deskripsi) {
            const text = r.deskripsi.toLowerCase();
            if (text.includes('ramai') || text.includes('rame') || 
                text.includes('sepi') || text.includes('antri') ||
                text.includes('orang') || text.includes('pengunjung')) return true;
          }
          return false;
        });

        // Proses status
        const trafficStatus = getTrafficStatus(trafficReports);
        const crowdStatus = getCrowdStatus(crowdReports);
        const weatherDataResult = getWeatherData();

        // Statistik untuk detail
        const trafficCount = trafficReports.length;
        const crowdCount = crowdReports.length;

        // Hitung rata-rata estimated_people untuk keramaian
        const reportsWithPeople = crowdReports.filter(r => r.estimated_people !== null);
        const avgPeople = reportsWithPeople.length > 0 
          ? Math.round(reportsWithPeople.reduce((sum, r) => sum + r.estimated_people, 0) / reportsWithPeople.length)
          : null;

        // Hitung rata-rata estimasi menit untuk antrian
        const reportsWithWaitTime = crowdReports.filter(r => r.estimasi_menit !== null);
        const avgWaitTime = reportsWithWaitTime.length > 0
          ? Math.round(reportsWithWaitTime.reduce((sum, r) => sum + r.estimasi_menit, 0) / reportsWithWaitTime.length)
          : null;

        setSignals([
          {
            id: 1,
            label: "Lalu Lintas",
            status: trafficStatus.status,
            icon: trafficStatus.icon,
            color: trafficStatus.color,
            detail: trafficCount > 0 
              ? `${trafficCount} laporan kondisi jalan` 
              : "Belum ada laporan lalu lintas",
            source: trafficCount > 0 ? "laporan_warga" : "no_data"
          },
          {
            id: 2,
            label: "Cuaca",
            status: weatherDataResult.condition,
            icon: weatherDataResult.icon,
            color: weatherDataResult.color,
            temp: weatherDataResult.temp,
            source: weatherDataResult.source
          },
          {
            id: 3,
            label: "Keramaian",
            status: crowdStatus.status,
            icon: crowdStatus.icon,
            color: crowdStatus.color,
            detail: avgPeople 
              ? `Rata-rata ${avgPeople} orang` 
              : (avgWaitTime 
                ? `Antri ±${avgWaitTime} menit` 
                : (crowdCount > 0 ? `${crowdCount} laporan keramaian` : "Belum ada laporan keramaian")),
            source: crowdCount > 0 ? "laporan_warga" : "no_data"
          },
        ]);
      } catch (err) {
        console.error("Error fetching laporan_warga:", err);
        setError(err.message);
        setSignals(getFallbackSignals());
      } finally {
        setLoading(false);
      }
    }

    fetchLaporanWarga();

    // Real-time subscription
    const subscription = supabase
      .channel(`laporan_${tempatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'laporan_warga',
          filter: `tempat_id=eq.${tempatId}`
        },
        () => fetchLaporanWarga()
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }, [tempatId, weatherData]);

  // ============================================
  // FUNGSI GET TRAFFIC STATUS (LALU LINTAS)
  // ============================================
  function getTrafficStatus(reports) {
    if (reports.length === 0) {
      return { status: "Tidak Ada Laporan", icon: "❓", color: "text-gray-400" };
    }
    
    const statusCount = { Sepi: 0, Ramai: 0, Antri: 0 };
    
    reports.forEach(r => {
      let condition = null;
      
      // Prioritas 1: Dari tipe column
      if (r.tipe === 'sepi') condition = 'Sepi';
      else if (r.tipe === 'ramai') condition = 'Ramai';
      else if (r.tipe === 'antri') condition = 'Antri';
      
      // Prioritas 2: Dari estimated_people (jika ada)
      if (!condition && r.estimated_people !== null) {
        if (r.estimated_people > 100) condition = 'Antri';
        else if (r.estimated_people > 50) condition = 'Ramai';
        else if (r.estimated_people < 20) condition = 'Sepi';
      }
      
      // Prioritas 3: Dari analisis deskripsi
      if (!condition && r.deskripsi) {
        const text = r.deskripsi.toLowerCase();
        if (text.includes('antri') || text.includes('ngantre') || text.includes('mengular')) condition = 'Antri';
        else if (text.includes('ramai') || text.includes('rame') || text.includes('padat')) condition = 'Ramai';
        else if (text.includes('sepi') || text.includes('lengang') || text.includes('sejuk')) condition = 'Sepi';
      }
      
      if (condition && statusCount[condition] !== undefined) {
        statusCount[condition]++;
      }
    });
    
    const totalCount = Object.values(statusCount).reduce((a, b) => a + b, 0);
    if (totalCount === 0) {
      return { status: "Normal", icon: "👍", color: "text-gray-400" };
    }
    
    // Tentukan status dominan
    const dominantStatus = Object.keys(statusCount).reduce((a, b) => 
      statusCount[a] > statusCount[b] ? a : b
    );
    
    const icons = { Sepi: "😴", Ramai: "👥", Antri: "🚶‍♂️🚶‍♀️" };
    const colors = { Sepi: "text-emerald-400", Ramai: "text-amber-400", Antri: "text-red-400" };
    
    return {
      status: dominantStatus,
      icon: icons[dominantStatus] || "📝",
      color: colors[dominantStatus] || "text-gray-400"
    };
  }

  // ============================================
  // FUNGSI GET CROWD STATUS (KERAMAIAN)
  // ============================================
  function getCrowdStatus(reports) {
    if (reports.length === 0) {
      return { status: "Tidak Ada Laporan", icon: "❓", color: "text-gray-400" };
    }
    
    // PRIORITAS UTAMA: Gunakan estimated_people (jumlah orang sebenarnya)
    const reportsWithPeople = reports.filter(r => r.estimated_people !== null);
    
    if (reportsWithPeople.length > 0) {
      const avgPeople = reportsWithPeople.reduce((sum, r) => sum + r.estimated_people, 0) / reportsWithPeople.length;
      
      if (avgPeople > 100) return { status: "Sangat Ramai", icon: "👥👥👥", color: "text-red-400" };
      if (avgPeople > 50) return { status: "Ramai", icon: "👥👥", color: "text-orange-400" };
      if (avgPeople > 20) return { status: "Normal", icon: "👥", color: "text-amber-400" };
      if (avgPeople > 0) return { status: "Sepi", icon: "👤", color: "text-gray-400" };
    }
    
    // PRIORITAS KEDUA: Gunakan estimasi waktu antri
    const reportsWithWaitTime = reports.filter(r => r.estimasi_menit !== null);
    if (reportsWithWaitTime.length > 0) {
      const avgWait = reportsWithWaitTime.reduce((sum, r) => sum + r.estimasi_menit, 0) / reportsWithWaitTime.length;
      if (avgWait > 30) return { status: "Antri Panjang", icon: "🚶‍♂️🚶‍♀️", color: "text-red-400" };
      if (avgWait > 15) return { status: "Antri", icon: "🚶‍♂️", color: "text-orange-400" };
      if (avgWait > 5) return { status: "Mulai Antri", icon: "⏱️", color: "text-amber-400" };
    }
    
    // FALLBACK TERAKHIR: Gunakan tipe
    const statusCount = { sepi: 0, ramai: 0, antri: 0, normal: 0 };
    
    reports.forEach(r => {
      const tipe = r.tipe?.toLowerCase() || '';
      if (statusCount[tipe] !== undefined) statusCount[tipe]++;
      else if (tipe === 'normal') statusCount.normal++;
    });
    
    let dominantStatus = 'Normal';
    let maxCount = 0;
    
    Object.entries(statusCount).forEach(([status, count]) => {
      if (count > maxCount) {
        maxCount = count;
        dominantStatus = status.charAt(0).toUpperCase() + status.slice(1);
      }
    });
    
    const icons = { Sepi: "👤", Normal: "👥", Ramai: "👥👥", Antri: "🚶‍♂️🚶‍♀️" };
    const colors = { Sepi: "text-gray-400", Normal: "text-amber-400", Ramai: "text-orange-400", Antri: "text-red-400" };
    
    return {
      status: dominantStatus,
      icon: icons[dominantStatus] || "👥",
      color: colors[dominantStatus] || "text-amber-400"
    };
  }

  // ============================================
  // FUNGSI WEATHER
  // ============================================
  function getWeatherIcon(condition) {
    const icons = { 
      Cerah: "☀️", 
      Panas: "☀️🔥", 
      Teduh: "🌤️", 
      Sejuk: "🌙", 
      Mendung: "☁️", 
      Hujan: "🌧️", 
      Badai: "⛈️" 
    };
    return icons[condition] || "🌡️";
  }

  function getWeatherColor(condition) {
    const colors = { 
      Cerah: "text-yellow-400", 
      Panas: "text-orange-500",
      Teduh: "text-sky-400",
      Sejuk: "text-cyan-400",
      Mendung: "text-sky-400", 
      Hujan: "text-blue-400", 
      Badai: "text-indigo-400" 
    };
    return colors[condition] || "text-gray-400";
  }

  // ============================================
  // FALLBACK SIGNALS
  // ============================================
  function getFallbackSignals() {
    return [
      { id: 1, label: "Lalu Lintas", status: "Tidak Ada Data", icon: "❓", color: "text-gray-400", source: "fallback" },
      { id: 2, label: "Cuaca", status: "Memuat...", icon: "🌡️", color: "text-gray-400", source: "fallback" },
      { id: 3, label: "Keramaian", status: "Tidak Ada Data", icon: "❓", color: "text-gray-400", source: "fallback" },
    ];
  }

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className={`p-3 rounded-2xl animate-pulse ${theme.isMalam ? 'bg-white/5' : 'bg-black/5'}`}>
            <div className="h-6 w-6 mx-auto mb-1 rounded-full bg-gray-500/20" />
            <div className="h-2 w-10 mx-auto mb-1 bg-gray-500/20 rounded" />
            <div className="h-3 w-12 mx-auto bg-gray-500/20 rounded" />
          </div>
        ))}
      </div>
    );
  }

  // ============================================
  // ERROR STATE
  // ============================================
  if (error && !signals) {
    return (
      <div className={`p-4 rounded-2xl text-center text-xs ${theme.isMalam ? 'bg-red-500/10' : 'bg-red-100'}`}>
        <span>⚠️ Gagal memuat sinyal sekitar</span>
      </div>
    );
  }

  // ============================================
  // RENDER SIGNALS
  // ============================================
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
          title={`${sig.source === 'laporan_warga' ? '📝 Dari laporan warga' : sig.source === 'weather_hook' ? '🌤️ Data cuaca real-time' : sig.source === 'time_fallback' ? '⏰ Estimasi berdasarkan waktu' : '❓ Tidak ada data'}\n${sig.detail || ''}`}
        >
          <span className="text-lg mb-1">{sig.icon}</span>
          <p className={`text-[8px] font-black uppercase tracking-tighter opacity-40 mb-0.5 ${theme.text}`}>
            {sig.label}
          </p>
          <p className={`text-[10px] font-bold ${sig.color} leading-none`}>
            {sig.status}
            {sig.temp && <span className="text-[8px] ml-0.5">°C</span>}
          </p>
          <div className="mt-1">
            {sig.source === 'laporan_warga' && (
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" title="Data dari laporan warga" />
            )}
            {(sig.source === 'weather_hook' || sig.source === 'time_fallback') && (
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title={sig.source === 'weather_hook' ? 'Data cuaca real-time' : 'Estimasi berdasarkan waktu'} />
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}