'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/context/AuthContext';
// Import hasil pisahan dari file config 
import { CATEGORY_CONFIG, getButtonStyle } from '@/config/citizenSignals';

export default function SmartCitizenButton({
  tempatId,
  tempatName,
  kategori,
  isInRadius,
  adminPhone,
  handleOpenAIModal,
  onUpdate
}) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  const dapatkanGrupKategori = (kat) => {
  if (!kat) return 'default';
  
  const k = kat.toLowerCase();
  
  // Mapping kelompok kuliner
  if (k.includes('cafe') || k.includes('restoran') || k.includes('kuliner') || k.includes('warung')) {
    return 'kuliner';
  }
  
  // Mapping kelompok wisata & ruang publik
  if (k.includes('wisata') || k.includes('terjun') || k.includes('taman') || k.includes('alun') || k.includes('stadion')) {
    return 'wisata';
  }
  
  // Mapping kelompok pelayanan masyarakat
  if (k.includes('desa') || k.includes('puskesmas') || k.includes('sakit') || k.includes('bank') || k.includes('layanan')) {
    return 'layanan';
  }
  
  // Mapping kelompok jalan & transportasi
  if (k.includes('stasiun') || k.includes('pantura') || k.includes('jalan')) {
    return 'transportasi';
  }
  
  return 'default';
};

// Ambil config yang sudah dikelompokkan dengan aman!
const grupTerpilih = dapatkanGrupKategori(kategori);
const config = CATEGORY_CONFIG[grupTerpilih] || CATEGORY_CONFIG.default;

  // Cek Cooldown
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

    setIsSubmitting(true);
    if (window.navigator.vibrate) window.navigator.vibrate([50, 30, 50]);

    try {
      const { error } = await supabase.from('laporan_warga').insert({
        tempat_id: tempatId,
        user_id: user.id,
        username: user.user_metadata?.full_name || user.email?.split('@')[0],
        tipe: action.tipe,
        deskripsi: action.desc,
        report_type: 'citizen_click',
        status: 'approved',
        created_at: new Date().toISOString()
      });

      if (error) throw error;

      setShowSuccess(true);
      onUpdate?.(action.tipe);
      setCooldown(5);
      setTimeout(() => setShowSuccess(false), 2500);

    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative group p-5 rounded-[32px] bg-zinc-900/40 dark:bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden">
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
          <div className={`px-2.5 py-1 rounded-full text-[7px] font-black uppercase tracking-widest flex items-center gap-1.5 backdrop-blur-md border ${isInRadius ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
            <div className={`w-1 h-1 rounded-full animate-pulse ${isInRadius ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            {isInRadius ? 'Area' : 'Luar Area'}
          </div>
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
                whileHover={isInRadius && cooldown === 0 ? { y: -3, scale: 1.02 } : {}}
                whileTap={isInRadius && cooldown === 0 ? { scale: 0.95 } : {}}
                onClick={() => handleClick(action)}
                disabled={!isInRadius || cooldown > 0 || isSubmitting}
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
          {!isInRadius ? 'Dekati lokasi untuk lapor' : 'Satu klikmu bantu warga'}
        </p>
      </div>
    </div>
  );
}