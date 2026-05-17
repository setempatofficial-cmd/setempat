'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/context/AuthContext';
import { CATEGORY_CONFIG, getButtonStyle } from '@/config/citizenSignals';
import dynamic from 'next/dynamic';

// ============ DYNAMIC IMPORTS (LAZY LOADING) ============
const LaporPanel = dynamic(() => import('@/app/components/ai/LaporPanel'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-black/50 z-[999999] flex items-center justify-center text-white text-xs">Memuat...</div>
});
const LaporJalanPanel = dynamic(() => import('./LaporJalanPanel'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-black/50 z-[999999] flex items-center justify-center text-white text-xs">Memuat...</div>
});

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
  const [showPilihanModal, setShowPilihanModal] = useState(false);
  const [openLaporPanel, setOpenLaporPanel] = useState(false);
  const [laporMode, setLaporMode] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dapatkanGrupKategori = (kat) => {
    if (!kat) return 'default';
    const k = kat.toLowerCase();
    if (k.includes('cafe') || k.includes('restoran') || k.includes('kuliner') || k.includes('warung')) return 'kuliner';
    if (k.includes('wisata') || k.includes('terjun') || k.includes('taman') || k.includes('alun') || k.includes('stadion')) return 'wisata';
    if (k.includes('desa') || k.includes('puskesmas') || k.includes('sakit') || k.includes('bank') || k.includes('layanan')) return 'layanan';
    if (k.includes('stasiun') || k.includes('pantura') || k.includes('jalan')) return 'transportasi';
    return 'default';
  };

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

  const handleQuickSignalClick = async (action, e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      window.dispatchEvent(new CustomEvent('open-auth-modal'));
      return;
    }

    if (cooldown > 0 || isSubmitting) return;

    setIsSubmitting(true);
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

  const handleTombolPlus = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      window.dispatchEvent(new CustomEvent('open-auth-modal'));
      return;
    }

    setShowPilihanModal(true);
  };

  const handlePilihTempat = () => {
    setLaporMode('tempat');
    setOpenLaporPanel(true);
    setShowPilihanModal(false);
  };

  const handlePilihJalan = () => {
    setLaporMode('jalan');
    setOpenLaporPanel(true);
    setShowPilihanModal(false);
  };

  // Modal Pilihan (render ke portal)
  const PilihanModal = () => {
    if (!showPilihanModal || !mounted) return null;

    return createPortal(
      <div
        className="fixed inset-0 z-[999999] flex items-end justify-center bg-black/70 backdrop-blur-sm"
        onClick={() => setShowPilihanModal(false)}
      >
        <div
          className="w-full max-w-md bg-zinc-950 rounded-t-3xl border-t border-white/10 overflow-hidden pb-8 animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-5">
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />

            <h3 className="text-lg font-black text-white mb-2 text-center">Pilih Jenis Laporan</h3>
            <p className="text-[11px] text-white/40 text-center mb-6">
              Mau lapor kejadian di tempat ini atau fasilitas umum/jalan?
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handlePilihTempat}
                className="w-full p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-4 active:scale-95 transition-all text-left hover:bg-emerald-500/20"
              >
                <span className="text-3xl">📍</span>
                <div>
                  <p className="font-black text-white text-sm">Lapor di Tempat</p>
                  <p className="text-[10px] text-white/50">Warung, Pasar, Wisata, Kantor, dll</p>
                </div>
              </button>

              <button
                type="button"
                onClick={handlePilihJalan}
                className="w-full p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center gap-4 active:scale-95 transition-all text-left hover:bg-sky-500/20"
              >
                <span className="text-3xl">🛣️</span>
                <div>
                  <p className="font-black text-white text-sm">Lapor di Jalan / Umum</p>
                  <p className="text-[10px] text-white/50">Kemacetan, Kecelakaan, Jalan Rusak, dll</p>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowPilihanModal(false)}
              className="w-full mt-5 py-3.5 rounded-xl bg-white/5 text-white/60 text-xs font-bold hover:bg-white/10 transition-all"
            >
              Batal
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <>
      <div className="relative p-5 rounded-[32px] bg-zinc-900/40 dark:bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl">
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

          {/* TOMBOL + */}
          <button
            type="button"
            onClick={handleTombolPlus}
            className="relative z-50 w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-xl font-bold shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition-all"
          >
            +
          </button>
        </div>

        {/* Grid Buttons (Quick Signal) */}
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
                <button
                  key={action.id}
                  type="button"
                  onClick={(e) => handleQuickSignalClick(action, e)}
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
                </button>
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

      {/* MODAL PORTAL */}
      <PilihanModal />

      {/* LAPOR PANEL (TEMPAT) */}
      {openLaporPanel && laporMode === 'tempat' && (
        <LaporPanel
          tempat={tempatId ? { id: tempatId, name: tempatName, category: kategori } : null}
          onClose={() => {
            setOpenLaporPanel(false);
            setLaporMode(null);
          }}
          onSuccess={() => {
            setOpenLaporPanel(false);
            setLaporMode(null);
            onUpdate?.();
          }}
          theme={{ isMalam: true }}
        />
      )}

      {/* LAPOR PANEL (JALAN/UMUM) */}
      {openLaporPanel && laporMode === 'jalan' && (
        <LaporJalanPanel
          onClose={() => {
            setOpenLaporPanel(false);
            setLaporMode(null);
          }}
          onSuccess={() => {
            setOpenLaporPanel(false);
            setLaporMode(null);
            onUpdate?.();
          }}
          theme={{ isMalam: true }}
        />
      )}

      <style jsx global>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        
        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </>
  );
}