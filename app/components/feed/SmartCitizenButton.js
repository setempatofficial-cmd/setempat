// app/components/feed/SmartCitizenButton.jsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/context/AuthContext';

// ==================== HELPER HITUNG JARAK ====================
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
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
    radius: 0.5,
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
    radius: 0.5,
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
    radius: 0.5,
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
    radius: 0.5,
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
  tempatLatitude,
  tempatLongitude,
  adminPhone,
  handleOpenAIModal,
  onUpdate,
  userLocation,
}) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isInRadiusState, setIsInRadiusState] = useState(false);
  const [distance, setDistance] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showError, setShowError] = useState(false);

  const config = CATEGORY_CONFIG[kategori] || CATEGORY_CONFIG.default;
  const RADIUS_KM = config.radius;
  const RADIUS_METERS = RADIUS_KM * 1000;

  // Normalisasi lokasi
  const normalizedLocation = useMemo(() => {
    if (!userLocation) return null;

    let lat = null;
    let lng = null;

    if (userLocation.latitude !== undefined && userLocation.longitude !== undefined) {
      lat = userLocation.latitude;
      lng = userLocation.longitude;
    } else if (userLocation.lat !== undefined && userLocation.lng !== undefined) {
      lat = userLocation.lat;
      lng = userLocation.lng;
    } else if (userLocation.lat !== undefined && userLocation.lon !== undefined) {
      lat = userLocation.lat;
      lng = userLocation.lon;
    } else if (userLocation.coords?.latitude !== undefined && userLocation.coords?.longitude !== undefined) {
      lat = userLocation.coords.latitude;
      lng = userLocation.coords.longitude;
    }

    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) return null;

    return {
      latitude: parseFloat(lat),
      longitude: parseFloat(lng)
    };
  }, [userLocation]);

  // Cek radius
  const checkRadius = useCallback(() => {
    const loc = normalizedLocation;

    if (!loc?.latitude || !loc?.longitude) {
      setIsInRadiusState(false);
      setDistance(null);
      return false;
    }

    if (!tempatLatitude || !tempatLongitude) {
      setIsInRadiusState(false);
      setDistance(null);
      return false;
    }

    const dist = calculateDistance(
      loc.latitude,
      loc.longitude,
      tempatLatitude,
      tempatLongitude
    );

    const distInKm = Math.round(dist * 1000) / 1000;
    setDistance(distInKm);

    const isWithinRadius = distInKm <= RADIUS_KM;
    setIsInRadiusState(isWithinRadius);

    return isWithinRadius;
  }, [normalizedLocation, tempatLatitude, tempatLongitude, RADIUS_KM]);

  useEffect(() => {
    checkRadius();
  }, [checkRadius]);

  // Cek cooldown dari external_signals terakhir
  useEffect(() => {
    if (user?.id && tempatId) {
      const fetchLastSignal = async () => {
        try {
          const { data, error } = await supabase
            .from('external_signals')
            .select('created_at')
            .eq('tempat_id', parseInt(tempatId))
            .eq('source', 'citizen_click')
            .eq('source_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) {
            console.error('Error fetching cooldown:', error);
            return;
          }

          if (data?.created_at) {
            const diff = Math.floor((Date.now() - new Date(data.created_at).getTime()) / 60000);
            if (diff < 5) setCooldown(5 - diff);
          }
        } catch (err) {
          console.error('Cooldown check error:', err);
        }
      };
      fetchLastSignal();
    }
  }, [user, tempatId]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 60000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const isWithinRadius = isInRadiusState;
  const hasLocation = !!normalizedLocation;

  const handleClick = async (action) => {
    setErrorMessage('');
    setShowError(false);

    // Cek autentikasi user
    if (!user) {
      setErrorMessage('🔐 Silakan login terlebih dahulu');
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
      window.dispatchEvent(new CustomEvent('open-auth-modal'));
      return;
    }

    // Cek cooldown
    if (cooldown > 0) {
      setErrorMessage(`⏳ Tunggu ${cooldown} menit lagi`);
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
      return;
    }

    if (isSubmitting) return;

    if (!hasLocation) {
      setErrorMessage('📍 Aktifkan GPS untuk update');
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
      return;
    }

    const isValidRadius = checkRadius();
    if (!isValidRadius) {
      const distanceText = distance !== null ? `${(distance * 1000).toFixed(0)} meter` : 'tidak diketahui';
      setErrorMessage(`📍 Anda ${distanceText} dari lokasi. Butuh ${RADIUS_METERS}m radius.`);
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
      return;
    }

    setIsSubmitting(true);
    if (window.navigator.vibrate) window.navigator.vibrate([50, 30, 50]);

    const loc = normalizedLocation;
    const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Warga';

    // 🔥 PERBAIKAN: Format data yang benar
    const signalData = {
      tempat_id: parseInt(tempatId),
      source: 'citizen_click',
      source_id: user.id,
      username: displayName,  // 🔥 Nama user asli (bukan "YouKmu Official")
      content: action.tipe,   // 🔥 HANYA tipe: "Hujan", "Sepi", "Ramai", dll
      original_text: action.displayText || `${action.tipe}: ${action.desc}`, // 🔥 Tanpa prefix
      source_platform: 'mobile_app',
      source_tier: 5,
      verification_level: 'low',
      verified: false,
      confidence: 0.5,
      created_at: new Date().toISOString(),
      fetched_at: new Date().toISOString()
    };

    console.log('📤 Sending signal:', signalData);

    try {
      const { error } = await supabase
        .from('external_signals')
        .insert([signalData]);

      if (error) {
        console.error('❌ Supabase error:', error);
        throw new Error(error.message || 'Gagal mengirim laporan');
      }

      console.log('✅ Citizen signal sent!');

      // 🔥 Trigger onUpdate untuk refresh card
      if (onUpdate) {
        // Kirim data ke parent untuk update UI
        onUpdate({
          type: 'citizen_click',
          tipe: action.tipe,
          desc: action.desc,
          tempatId: tempatId,
          username: displayName
        });
      }

      setShowSuccess(true);
      setCooldown(5);

      setTimeout(() => setShowSuccess(false), 2500);

    } catch (err) {
      console.error('❌ Error submitting signal:', err);
      setErrorMessage(`❌ ${err.message || 'Gagal mengirim laporan. Silakan coba lagi.'}`);
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDistance = () => {
    if (distance === null) return '---';
    const meters = distance * 1000;
    if (meters < 10) return '< 10m';
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${distance.toFixed(2)}km`;
  };

  return (
    <div className="relative group p-5 rounded-[32px] bg-zinc-900/40 dark:bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 blur-[50px] rounded-full pointer-events-none" />

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
          <div className={`px-2.5 py-1 rounded-full text-[7px] font-black uppercase tracking-widest flex items-center gap-1.5 backdrop-blur-md border ${!hasLocation ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' :
            isWithinRadius ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
            <div className={`w-1 h-1 rounded-full animate-pulse ${!hasLocation ? 'bg-gray-400' :
              isWithinRadius ? 'bg-emerald-400' : 'bg-rose-400'
              }`} />
            {!hasLocation ? '🔴 GPS OFF' :
              isWithinRadius ? `✅ ${formatDistance()}` : `❌ ${formatDistance()}`}
          </div>
          {hasLocation && distance !== null && (
            <span className="text-[6px] opacity-30 font-mono">
              {isWithinRadius ? '📍 Dalam radius' : `Butuh ${RADIUS_METERS}m`}
            </span>
          )}
        </div>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {showError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20"
          >
            <p className="text-[9px] font-bold text-rose-400 text-center">{errorMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-4 gap-2 relative z-10">
        <AnimatePresence mode="wait">
          {showSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="col-span-4 py-8 flex flex-col items-center justify-center bg-emerald-500/10 rounded-2xl border border-emerald-500/20"
            >
              <motion.span
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 0.5 }}
                className="text-3xl mb-2"
              >
                ✨
              </motion.span>
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">Laporan Diterima!</p>
              <p className="text-[8px] text-emerald-400/60 mt-1">Terima kasih atas kontribusinya</p>
            </motion.div>
          ) : (
            config.actions.map((action) => (
              <motion.button
                key={action.id}
                whileHover={isWithinRadius && cooldown === 0 && hasLocation ? { y: -3, scale: 1.02 } : {}}
                whileTap={isWithinRadius && cooldown === 0 && hasLocation ? { scale: 0.95 } : {}}
                onClick={() => handleClick(action)}
                disabled={!hasLocation || !isWithinRadius || cooldown > 0 || isSubmitting}
                className={`
                  relative py-4 px-1 rounded-2xl flex flex-col items-center gap-1.5
                  transition-all duration-300 group/btn
                  ${getButtonStyle(action.id)}
                  disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed
                `}
              >
                <span className="text-2xl drop-shadow-lg group-hover/btn:scale-110 transition-transform">
                  {action.icon}
                </span>
                <span className="text-[8px] font-[1000] tracking-tighter uppercase leading-none">
                  {action.label}
                </span>
                <span className="text-[6px] opacity-30 font-mono hidden group-hover/btn:block">
                  {action.desc}
                </span>
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/btn:opacity-100 transition-opacity rounded-2xl" />
              </motion.button>
            ))
          )}
        </AnimatePresence>
      </div>

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
          {isSubmitting && (
            <span className="text-[8px] text-blue-400 animate-pulse">⏳ Mengirim...</span>
          )}
        </div>
        <p className="text-[7px] font-bold opacity-30 italic tracking-wide">
          {!hasLocation ? '🔴 Aktifkan GPS untuk update' :
            !isWithinRadius ? `⚠️ Harus dalam radius ${RADIUS_METERS}m` :
              distance !== null && distance * 1000 < 10 ? '📍 Anda tepat di lokasi!' :
                '✅ Satu klikmu bantu warga'}
        </p>
      </div>
    </div>
  );
}