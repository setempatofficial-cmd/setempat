"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Users, FileCheck, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function OpportunityModal({ isOpen, onClose, opportunity, userId, onSuccess }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [alreadySeller, setAlreadySeller] = useState(false);
  const [alreadyDriver, setAlreadyDriver] = useState(false);
  const [alreadyRewang, setAlreadyRewang] = useState(false);

  // Deteksi jenis opportunity
  const isBountyLaporan = opportunity?.title?.toLowerCase().includes("dibutuhkan") ||
    opportunity?.title?.toLowerCase().includes("kecelakaan") ||
    opportunity?.category === "bounty_laporan";

  const isBountyKonten = opportunity?.title?.toLowerCase().includes("wartabromo") ||
    opportunity?.title?.toLowerCase().includes("umkm") ||
    opportunity?.title?.toLowerCase().includes("video anda digunakan") ||
    opportunity?.category === "bounty_konten";

  const isProgramBakul = opportunity?.title?.toLowerCase().includes("bakul baru") ||
    opportunity?.title?.toLowerCase().includes("program bakul");

  const isProgramOjek = opportunity?.title?.toLowerCase().includes("ojek") ||
    opportunity?.title?.toLowerCase().includes("driver");

  const isProgramRewang = opportunity?.title?.toLowerCase().includes("rewang");

  useEffect(() => {
    if (!isOpen || !userId || !opportunity) return;

    const checkApplied = async () => {
      const { data } = await supabase
        .from("user_opportunities")
        .select("id, status")
        .eq("user_id", userId)
        .eq("opportunity_id", opportunity.id)
        .maybeSingle();
      setHasApplied(!!data);
    };

    const checkSeller = async () => {
      if (isProgramBakul) {
        const { data } = await supabase
          .from("seller_profiles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        setAlreadySeller(!!data);
      }
    };

    const checkDriver = async () => {
      if (isProgramOjek) {
        const { data } = await supabase
          .from("driver_profiles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        setAlreadyDriver(!!data);
      }
    };

    const checkRewang = async () => {
      if (isProgramRewang) {
        const { data } = await supabase
          .from("rewang_profiles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        setAlreadyRewang(!!data);
      }
    };

    checkApplied();
    checkSeller();
    checkDriver();
    checkRewang();
  }, [isOpen, userId, opportunity, isProgramBakul, isProgramOjek, isProgramRewang]);

  if (!isOpen || !opportunity) return null;

  const isMoney = opportunity.reward_type === "money";

  const handleApply = async () => {
    setSubmitting(true);

    // ========== BOUNTY LAPORAN ==========
    if (isBountyLaporan) {
      router.push(`/rumah-warga/kesempatan/${opportunity.id}`);
      onClose();
      setSubmitting(false);
      return;
    }

    // ========== BOUNTY KONTEN (Royalti) ==========
    if (isBountyKonten) {
      router.push(`/rumah-warga/kesempatan/${opportunity.id}`);
      onClose();
      setSubmitting(false);
      return;
    }

    // ========== PROGRAM BAKUL BARU ==========
    if (isProgramBakul) {
      if (alreadySeller) {
        alert("Anda sudah terdaftar sebagai Bakul!");
        onClose();
        setSubmitting(false);
        return;
      }
      // Redirect ke halaman Peken dengan membuka modal daftar bakul
      router.push('/peken?action=daftar-bakul');
      onClose();
      setSubmitting(false);
      return;
    }

    // ========== OJEK WARGA ==========
    if (isProgramOjek) {
      if (alreadyDriver) {
        alert("Anda sudah terdaftar sebagai Ojek!");
        onClose();
        setSubmitting(false);
        return;
      }
      router.push('/peken?action=daftar-ojek');
      onClose();
      setSubmitting(false);
      return;
    }

    // ========== REWANG ==========
    if (isProgramRewang) {
      if (alreadyRewang) {
        alert("Anda sudah terdaftar sebagai Rewang!");
        onClose();
        setSubmitting(false);
        return;
      }
      router.push('/peken?action=daftar-rewang');
      onClose();
      setSubmitting(false);
      return;
    }

    // ========== OPPORTUNITY BIASA ==========
    const { error } = await supabase
      .from("user_opportunities")
      .insert({
        user_id: userId,
        opportunity_id: opportunity.id,
        status: "pending"
      });

    if (!error) {
      alert("✅ Berhasil mengikuti kesempatan! Tim kami akan menghubungi.");
      if (onSuccess) onSuccess();
      onClose();
    }
    setSubmitting(false);
  };

  // Cek apakah sudah terdaftar di program terkait
  const isAlreadyRegistered = (isProgramBakul && alreadySeller) ||
    (isProgramOjek && alreadyDriver) ||
    (isProgramRewang && alreadyRewang);

  // Tombol action berdasarkan jenis
  const getButtonText = () => {
    if (isBountyLaporan) return "Kirim Laporan →";
    if (isBountyKonten) return "Upload & Jual Konten →";
    if (isProgramBakul) return alreadySeller ? "✅ Sudah Terdaftar" : "Daftar Bakul →";
    if (isProgramOjek) return alreadyDriver ? "✅ Sudah Terdaftar" : "Daftar Ojek →";
    if (isProgramRewang) return alreadyRewang ? "✅ Sudah Terdaftar" : "Daftar Rewang →";
    return "Ikuti Kesempatan Ini →";
  };

  const isDisabled = submitting || (isProgramBakul && alreadySeller) ||
    (isProgramOjek && alreadyDriver) || (isProgramRewang && alreadyRewang);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25 }}
          className="bg-slate-900 rounded-2xl w-full max-w-[360px] overflow-hidden border border-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header dengan warna berbeda per jenis */}
          <div className={`p-4 text-center ${isBountyLaporan ? "bg-gradient-to-r from-emerald-900/30 to-teal-900/30" :
              isBountyKonten ? "bg-gradient-to-r from-purple-900/30 to-pink-900/30" :
                isProgramBakul || isProgramOjek || isProgramRewang ? "bg-gradient-to-r from-blue-900/30 to-cyan-900/30" :
                  "bg-amber-900/30"
            }`}>
            <div className="text-5xl mb-2">{opportunity.icon}</div>
            <h3 className="text-lg font-bold text-slate-200">{opportunity.title}</h3>
            <p className="text-[10px] text-slate-400 mt-1">{opportunity.description}</p>

            {/* Badge jenis */}
            <div className="mt-2 inline-block">
              <span className={`text-[8px] px-2 py-0.5 rounded-full ${isBountyLaporan ? "bg-emerald-500/20 text-emerald-400" :
                  isBountyKonten ? "bg-purple-500/20 text-purple-400" :
                    isProgramBakul || isProgramOjek || isProgramRewang ? "bg-blue-500/20 text-blue-400" :
                      "bg-amber-500/20 text-amber-400"
                }`}>
                {isBountyLaporan ? "📢 Bounty Laporan" :
                  isBountyKonten ? "🎬 Bounty Konten" :
                    isProgramBakul || isProgramOjek || isProgramRewang ? "🎯 Program Pendaftaran" :
                      "🎁 Kesempatan"}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            {/* Reward */}
            <div className={`p-3 rounded-xl text-center ${isBountyLaporan ? "bg-emerald-500/10 border border-emerald-500/30" :
                isBountyKonten ? "bg-purple-500/10 border border-purple-500/30" :
                  isProgramBakul || isProgramOjek || isProgramRewang ? "bg-blue-500/10 border border-blue-500/30" :
                    "bg-amber-500/10 border border-amber-500/30"
              }`}>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider">Reward</p>
              <p className={`text-2xl font-black ${isBountyLaporan ? "text-emerald-400" :
                  isBountyKonten ? "text-purple-400" :
                    isProgramBakul || isProgramOjek || isProgramRewang ? "text-blue-400" :
                      "text-amber-400"
                }`}>
                {opportunity.reward_text}
              </p>
              {isMoney && <p className="text-[8px] text-slate-500 mt-1">💰 Transfer ke rekening/wallet</p>}
              {isBountyLaporan && <p className="text-[8px] text-slate-500 mt-1">🎁 Poin + tayang di feed</p>}
              {isBountyKonten && <p className="text-[8px] text-slate-500 mt-1">🎬 Royalti + masuk marketplace</p>}
              {(isProgramBakul || isProgramOjek || isProgramRewang) && <p className="text-[8px] text-slate-500 mt-1">🎁 Poin + akses fitur</p>}
            </div>

            {/* Detail */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-[10px]">
                  📅 Deadline: {new Date(opportunity.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              {opportunity.quota > 0 && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Users className="w-3.5 h-3.5" />
                  <span className="text-[10px]">👥 Kuota: {opportunity.quota} orang</span>
                </div>
              )}
            </div>

            {/* Info tambahan untuk program */}
            {(isProgramBakul || isProgramOjek || isProgramRewang) && (
              <div className="bg-blue-500/10 rounded-xl p-3">
                <p className="text-[9px] text-blue-400">
                  💡 Klik tombol di bawah untuk mendaftar sebagai {
                    isProgramBakul ? "Bakul" : isProgramOjek ? "Ojek" : "Rewang"
                  } dan dapatkan reward!
                </p>
              </div>
            )}

            {/* Syarat */}
            <div className="bg-slate-800/30 rounded-xl p-3">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Syarat & Ketentuan</p>
              <ul className="text-[9px] text-slate-500 space-y-1 list-disc list-inside">
                {isBountyLaporan ? (
                  <>
                    <li>Kirim laporan sesuai lokasi yang diminta</li>
                    <li>Konten harus asli dan belum pernah diunggah</li>
                    <li>Laporan akan diverifikasi tim Setempat</li>
                    <li>Reward diberikan jika laporan memenuhi kriteria</li>
                  </>
                ) : isBountyKonten ? (
                  <>
                    <li>Upload konten asli milik sendiri</li>
                    <li>Konten belum pernah dipublikasikan sebelumnya</li>
                    <li>Konten akan diverifikasi sebelum masuk marketplace</li>
                    <li>Royalti dibayarkan setelah konten terjual</li>
                  </>
                ) : (isProgramBakul || isProgramOjek || isProgramRewang) ? (
                  <>
                    <li>Lengkapi data diri dengan benar</li>
                    <li>Verifikasi KTP wajib dilakukan</li>
                    <li>Reward diberikan setelah pendaftaran aktif</li>
                  </>
                ) : (
                  <>
                    <li>Konten asli milik sendiri</li>
                    <li>Belum pernah dipublikasikan sebelumnya</li>
                    <li>Hasil terbaik akan dipilih tim Setempat</li>
                    <li>Keputusan bersifat mutlak</li>
                  </>
                )}
              </ul>
            </div>

            {/* Tombol Aksi */}
            {hasApplied && !isAlreadyRegistered ? (
              <div className="text-center p-2 bg-slate-800/30 rounded-xl">
                <p className="text-[10px] text-slate-400">✅ Anda sudah mendaftar</p>
                <p className="text-[8px] text-slate-500 mt-1">Menunggu verifikasi</p>
              </div>
            ) : (
              <button
                onClick={handleApply}
                disabled={isDisabled}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${isDisabled ? "bg-slate-700 text-slate-400 cursor-not-allowed" :
                    isBountyLaporan ? "bg-emerald-600 hover:bg-emerald-500 text-white" :
                      isBountyKonten ? "bg-purple-600 hover:bg-purple-500 text-white" :
                        isProgramBakul || isProgramOjek || isProgramRewang ? "bg-blue-600 hover:bg-blue-500 text-white" :
                          "bg-amber-600 hover:bg-amber-500 text-white"
                  }`}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : getButtonText()}
              </button>
            )}

            {/* Tombol Tutup */}
            <button
              onClick={onClose}
              className="w-full py-2 text-[10px] text-slate-500 hover:text-slate-400 transition-colors"
            >
              Tutup
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}