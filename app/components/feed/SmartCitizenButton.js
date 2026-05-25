'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/context/AuthContext';

// ==================== HELPER HITUNG JARAK ====================
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius bumi dalam km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ==================== KONFIGURASI PER KATEGORI ====================
const CATEGORY_CONFIG = {
  kuliner: {
    icon: '☕',
    label: 'Kuliner',
    radius: 0.5, // Radius spesifik per kategori (km)
    actions: [
      { id: 'sepi', icon: '😌', label: 'SEPI', tipe: 'Sepi', desc: 'Kosong' },
      { id: 'ramai', icon: '👥', label: 'RAMAI', tipe: 'Ramai', desc: 'Nyaris Penuh' },
      { id: 'antri', icon: '🚶‍♂️', label: 'ANTRI', tipe: 'Antri', desc: 'Mengular' },
      { id: 'penuh', icon: '🚫', label: 'PENUH', tipe: 'Penuh', desc: 'No Table' },
    ]
  },
  wisata: {
    icon: '🏞️',
    label: 'Wisata',
    radius: 1, // Radius lebih besar untuk wisata
    actions: [
      { id: 'sepi', icon: '😌', label: 'SEPI', tipe: 'Sepi', desc: 'Leluasa' },
      { id: 'ramai', icon: '👥', label: 'RAMAI', tipe: 'Ramai', desc: 'Cukup Banyak' },
      { id: 'padat', icon: '🚶‍♂️🚶‍♀️', label: 'PADAT', tipe: 'Padat', desc: 'Sangat Ramai' },
      { id: 'tutup', icon: '🔒', label: 'TUTUP', tipe: 'Tutup', desc: 'Gerbang Tutup' },
    ]
  },
  jalan: {
    icon: '🛣️',
    label: 'Lalu Lintas',
    radius: 0.3, // Radius kecil untuk jalan
    actions: [
      { id: 'lancar', icon: '✅', label: 'LANCAR', tipe: 'Lancar', desc: 'Gaspol' },
      { id: 'macet', icon: '🚗', label: 'MACET', tipe: 'Macet', desc: 'Merayap' },
      { id: 'macet_total', icon: '🚫🚗', label: 'STUCK', tipe: 'MacetTotal', desc: 'Macet Total' },
      { id: 'hujan', icon: '🌧️', label: 'HUJAN', tipe: 'Hujan', desc: 'Sedia Payung' },
    ]
  },
  parkir: {
    icon: '🅿️',
    label: 'Parkiran',
    radius: 0.2, // Radius paling kecil untuk parkir
    actions: [
      { id: 'kosong', icon: '🟢', label: 'KOSONG', tipe: 'Kosong', desc: 'Bebas Pilih' },
      { id: 'tersedia', icon: '🟡', label: 'ADA', tipe: 'Tersedia', desc: 'Sisa Sedikit' },
      { id: 'hampir_penuh', icon: '🟠', label: 'TIPIS', tipe: 'HampirPenuh', desc: 'Cari Celah' },
      { id: 'penuh', icon: '🔴', label: 'PENUH', tipe: 'Penuh', desc: 'Cari Lain' },
    ]
  },
  default: {
    icon: '📍',
    label: 'Update',
    radius: 0.5,
    actions: [
      { id: 'sepi', icon: '😌', label: 'SEPI', tipe: 'Sepi', desc: 'Sepi' },
      { id: 'ramai', icon: '👥', label: 'RAMAI', tipe: 'Ramai', desc: 'Ramai' },
      { id: 'macet', icon: '🚗', label: 'MACET', tipe: 'Macet', desc: 'Macet' },
      { id: 'hujan', icon: '🌧️', label: 'HUJAN', tipe: 'Hujan', desc: 'Hujan' },
    ]
  }
};

// ==================== HELPER STYLE ====================
const getButtonStyle = (id) => {
  const base = "border-b-4 backdrop-blur-md ";
  const styles = {
    sepi: base + 'bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]',
    lancar: base + 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]',
    kosong: base + 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]',
    ramai: base + 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]',
    tersedia: base + 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]',
    antri: base + 'bg-orange-500/10 text-orange-400 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.1)]',
    macet: base + 'bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]',
    penuh: base + 'bg-red-600/10 text-red-500 border-red-600/30 shadow-[0_0_15px_rgba(220,38,38,0.1)]',
    macet_total: base + 'bg-red-700/20 text-red-400 border-red-700/50 shadow-[0_0_15px_rgba(185,28,28,0.2)]',
    hujan: base + 'bg-sky-500/10 text-sky-400 border-sky-500/30 shadow-[0_0_15px_rgba(14,165,233,0.1)]',
  };
  return styles[id] || base + 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
};

// ==================== MAIN COMPONENT ====================
export default function SmartCitizenButton({
  tempatId,
  tempatName,
  kategori,
  tempatLatitude,  // PERBAIKAN: Terima koordinat tempat
  tempatLongitude, // PERBAIKAN: Terima koordinat tempat
  adminPhone,
  handleOpenAIModal,
  onUpdate,
  userLocation     // PERBAIKAN: Terima lokasi user dari parent
}) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isInRadiusState, setIsInRadiusState] = useState(false); // State internal untuk radius
  const [distance, setDistance] = useState(null); // Debug jarak

  const config = CATEGORY_CONFIG[kategori] || CATEGORY_CONFIG.default;
  const RADIUS_KM = config.radius; // Radius spesifik kategori

  // PERBAIKAN: Validasi radius REAL-TIME
  const checkRadius = useCallback(() => {
    if (!userLocation?.latitude || !userLocation?.longitude || !tempatLatitude || !tempatLongitude) {
      setIsInRadiusState(false);
      return false;
    }

    const dist = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      tempatLatitude,
      tempatLongitude
    );

    setDistance(dist);
    const isWithinRadius = dist <= RADIUS_KM;
    setIsInRadiusState(isWithinRadius);

    // Debug log
    console.log(`📍 [${config.label}] Jarak ke ${tempatName}: ${dist.toFixed(3)}km | Radius: ${RADIUS_KM}km | ${isWithinRadius ? '✅ DALAM' : '❌ LUAR'} area`);

    return isWithinRadius;
  }, [userLocation, tempatLatitude, tempatLongitude, RADIUS_KM, config.label, tempatName]);

  // PERBAIKAN: Cek radius setiap kali lokasi berubah
  useEffect(() => {
    checkRadius();
  }, [checkRadius]);

  // Cek Cooldown (existing code)
  useEffect(() => {
    if (user?.id && tempatId) {
      const fetchLastReport = async () => {
        const { data } = await supabase
          .from('laporan_warga')
          .select('created_at')
          .eq('tempat_id', tempatId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          const diff = Math.floor((Date.now() - new Date(data.created_at)) / 60000);
          if (diff < 5) setCooldown(5 - diff);
        }
      };
      fetchLastReport();
    }
  }, [user, tempatId]);

  const handleClick = async (action) => {
    if (!user) {
      window.dispatchEvent(new CustomEvent('open-auth-modal'));
      return;
    }

    if (cooldown > 0 || isSubmitting) return;

    // PERBAIKAN: Validasi radius ULANG sebelum submit
    const isValidRadius = checkRadius();
    if (!isValidRadius) {
      console.warn(`⚠️ Penolakan: User di luar radius ${RADIUS_KM}km dari ${tempatName}`);
      // Tampilkan notifikasi ke user
      alert(`📍 Anda berada ${distance ? distance.toFixed(2) : 'jauh'} dari lokasi ini. Harus dalam radius ${RADIUS_KM}km untuk melapor.`);
      return;
    }

    setIsSubmitting(true);
    if (window.navigator.vibrate) window.navigator.vibrate([50, 30, 50]);

    try {
      // PERBAIKAN: Sertakan bukti jarak dalam laporan
      const { error } = await supabase.from('laporan_warga').insert({
        tempat_id: tempatId,
        user_id: user.id,
        username: user.user_metadata?.full_name || user.email?.split('@')[0],
        tipe: action.tipe,
        deskripsi: action.desc,
        report_type: 'citizen_click',
        status: 'approved',
        user_latitude: userLocation?.latitude,  // Simpan bukti
        user_longitude: userLocation?.longitude, // Simpan bukti
        distance_from_tempat: distance, // Simpan jarak saat lapor
        created_at: new Date().toISOString()
      });

      if (error) throw error;

      setShowSuccess(true);
      onUpdate?.(action.tipe);
      setCooldown(5);
      setTimeout(() => setShowSuccess(false), 2500);

    } catch (err) {
      console.error("Error submit laporan:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative group p-5 rounded-[32px] bg-zinc-900/40 dark:bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden">
      {/* Background Glow Decor */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 blur-[50px] rounded-full pointer-events-none" />

      {/* Header Info */}
      <div className="flex items-center justify-between mb-5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-xl shadow-inner">
            {config.icon}
          </div>
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 leading-none mb-1">
              Smart Signal • {config.label}
            </h4>
            <p className="text-[9px] opacity-40 font-bold italic tracking-tight">Real-time kondisi lokasi</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          {/* PERBAIKAN: Gunakan state internal, bukan prop */}
          <div className={`px-2.5 py-1 rounded-full text-[7px] font-black uppercase tracking-widest flex items-center gap-1.5 backdrop-blur-md border ${isInRadiusState ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
            <div className={`w-1 h-1 rounded-full animate-pulse ${isInRadiusState ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            {isInRadiusState ? 'Area' : `Luar ${RADIUS_KM}km`}
          </div>
          {/* PERBAIKAN: Tampilkan jarak (opsional untuk debug) */}
          {distance !== null && (
            <span className="text-[6px] opacity-30 font-mono">
              {distance.toFixed(2)}km
            </span>
          )}
        </div>
      </div>

      {/* Grid Buttons */}
      <div className="grid grid-cols-4 gap-2 relative z-10">
        <AnimatePresence mode="wait">
          {showSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="col-span-4 py-8 flex flex-col items-center justify-center bg-emerald-500/10 rounded-2xl border border-emerald-500/20"
            >
              <motion.span animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity }} className="text-3xl mb-2">✨</motion.span>
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">Laporan Diterima!</p>
            </motion.div>
          ) : (
            config.actions.map((action) => (
              <motion.button
                key={action.id}
                whileHover={isInRadiusState && cooldown === 0 ? { y: -3, scale: 1.02 } : {}}
                whileTap={isInRadiusState && cooldown === 0 ? { scale: 0.95 } : {}}
                onClick={() => handleClick(action)}
                disabled={!isInRadiusState || cooldown > 0 || isSubmitting}
                className={`
                  relative py-4 px-1 rounded-2xl flex flex-col items-center gap-1.5
                  transition-all duration-300 group/btn
                  ${getButtonStyle(action.id)}
                  disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed
                `}
              >
                <span className="text-2xl drop-shadow-lg group-hover/btn:scale-110 transition-transform">{action.icon}</span>
                <span className="text-[8px] font-[1000] tracking-tighter uppercase leading-none">{action.label}</span>
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/btn:opacity-100 transition-opacity rounded-2xl" />
              </motion.button>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Footer Instructions */}
      <div className="mt-4 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {cooldown > 0 ? (
            <div className="flex items-center gap-1.5 text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
              <span className="text-[10px] animate-pulse">⏳</span>
              <span className="text-[8px] font-[1000]">TUNGGU {cooldown} MENIT</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-500/50">
              <div className="w-1 h-1 rounded-full bg-current animate-ping" />
              <span className="text-[8px] font-black uppercase tracking-widest">Sinyal Aktif</span>
            </div>
          )}
        </div>
        <p className="text-[7px] font-bold opacity-30 italic tracking-wide">
          {!isInRadiusState
            ? `Harus dalam radius ${RADIUS_KM}km dari lokasi`
            : 'Satu klikmu bantu warga'}
        </p>
      </div>
    </div>
  );
}