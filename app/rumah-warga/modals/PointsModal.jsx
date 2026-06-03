"use client";

import { useState, useEffect, useEffectEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Gift, Target, Award, Coffee, Utensils, Ticket, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// 1. Pindahkan data statis ke luar komponen agar hemat beban memori / load ringan
const VOUCHERS = [
  { id: 1, name: "Voucher Kopi", icon: Coffee, points: 100, merchant: "Kedai Setempat", code: "KOPI100" },
  { id: 2, name: "Voucher Makan", icon: Utensils, points: 250, merchant: "Warung Tetangga", code: "MAKAN250" },
  { id: 3, name: "Voucher Wisata", icon: Ticket, points: 500, merchant: "Wisata Pasuruan", code: "WISATA500" },
];

export default function PointsModal({ isOpen, onClose, userId, userPoints = 0, onPointsUpdated }) {
  const [localPoints, setLocalPoints] = useState(userPoints);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState(false);

  // Sinkronisasi poin jika prop dari parent berubah
  useEffect(() => {
    setLocalPoints(userPoints);
  }, [userPoints]);

  // Mengambil data poin terbaru dari Supabase saat modal dibuka
  useEffect(() => {
    if (!isOpen || !userId) return;

    const fetchCurrentPoints = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("points")
          .eq("id", userId)
          .single();

        if (error) throw error;
        if (data) setLocalPoints(data.points || 0);
      } catch (err) {
        console.error("Error fetching points:", err);
      }
    };

    fetchCurrentPoints();
  }, [isOpen, userId]);

  // Logika kalkulasi target voucher berikutnya (Aman dari bug nilai minus)
  const nextVoucher = VOUCHERS.find((v) => v.points > localPoints);
  const isMaxed = !nextVoucher;
  const targetVoucher = nextVoucher || VOUCHERS[VOUCHERS.length - 1];
  const progressToNext = isMaxed ? 100 : Math.min(100, (localPoints / targetVoucher.points) * 100);
  const pointsNeeded = isMaxed ? 0 : targetVoucher.points - localPoints;

  const handleRedeem = async () => {
    if (!selectedVoucher || localPoints < selectedVoucher.points || redeeming) return;

    setRedeeming(true);

    try {

      // 🔥 HITUNG TANGGAL EXPIRED (7 HARI DARI SEKARANG)
      const expiredAt = new Date();
      expiredAt.setDate(expiredAt.getDate() + 7); // 7 hari

      // 1. Buat transaksi dengan status "pending"
      const { data: transaction, error: insertError } = await supabase
        .from("voucher_transactions")
        .insert({
          user_id: userId,
          voucher_id: selectedVoucher.id,
          voucher_code: selectedVoucher.code,
          points_spent: selectedVoucher.points,
          status: "pending",  // ← Masih pending
          redeemed_at: new Date().toISOString(),
          expired_at: expiredAt.toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 🔥 JANGAN KURANGI POIN!
      // Poin akan berkurang hanya saat merchant klaim

      setRedeemSuccess(true);

      setTimeout(() => {
        setRedeemSuccess(false);
        setShowConfirmModal(false);
        setSelectedVoucher(null);
        setRedeeming(false);
        onClose();

        window.dispatchEvent(
          new CustomEvent("show-voucher-qr", {
            detail: {
              voucher: selectedVoucher,
              transactionId: transaction.id,
              message: `🎟️ ${selectedVoucher.name} siap diklaim!\nTunjukkan QR ke ${selectedVoucher.merchant}`,
            },
          })
        );
      }, 2000);

    } catch (err) {
      alert("Gagal menukarkan voucher: " + err.message);
      setRedeeming(false);
    }
  };

  return (
    <>
      {/* MAIN MODAL */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end justify-center sm:items-center p-0 sm:p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="bg-slate-900 border border-slate-800/80 rounded-t-3xl sm:rounded-2xl w-full max-w-[380px] max-h-[85vh] overflow-y-auto shadow-2xl pb-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* HEADER */}
              <div className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/60 px-5 py-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <Award className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">Poin & Hadiah</h3>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-full bg-slate-800/60 hover:bg-slate-800 text-slate-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* HERO POIN CARD */}
                <div className="bg-gradient-to-b from-slate-800/40 to-slate-800/10 rounded-2xl p-5 border border-slate-800/80 text-center">
                  <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Total Poin Kamu</p>
                  <h2 className="text-4xl font-black text-emerald-400 my-1.5 tracking-tight">{localPoints}</h2>
                  <p className="text-xs text-slate-500">Kumpulkan terus untuk ditukar dengan voucher</p>
                </div>

                {/* PROGRESS NEXT REWARD */}
                <div className="bg-slate-800/20 rounded-2xl p-4 border border-slate-800/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-slate-200">
                        {isMaxed ? "Semua Target Tercapai 🎉" : "Target Voucher Berikutnya"}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      {localPoints} / {targetVoucher.points} Poin
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2 border border-slate-700/30">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressToNext}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                    />
                  </div>

                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <targetVoucher.icon className="w-3.5 h-3.5 text-slate-400" />
                    {isMaxed ? (
                      <span>Kamu bisa menukarkan voucher apa saja!</span>
                    ) : (
                      <span><strong>{pointsNeeded}</strong> poin lagi untuk <strong>{targetVoucher.name}</strong></span>
                    )}
                  </p>
                </div>

                {/* TUKAR HADIAH */}
                <div>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <Gift className="w-4 h-4 text-slate-400" />
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Pilihan Voucher</h4>
                  </div>

                  <div className="space-y-2.5">
                    {VOUCHERS.map((voucher) => {
                      const isAvailable = localPoints >= voucher.points;
                      return (
                        <div
                          key={voucher.id}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${isAvailable
                            ? "bg-slate-800/20 border-slate-800 hover:border-slate-700"
                            : "bg-slate-900/40 border-slate-800/40 opacity-50"
                            }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isAvailable ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-500"}`}>
                              <voucher.icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-200 truncate">{voucher.name}</p>
                              <p className="text-[11px] text-slate-500 truncate">{voucher.merchant}</p>
                              {/* TAMBAHKAN INI */}
                              <p className="text-[9px] text-amber-400/70 mt-0.5">
                                ⏰ Berlaku 7 hari setelah tukar
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-xs font-bold text-slate-300 mb-1.5">{voucher.points} Poin</p>
                            <button
                              onClick={() => {
                                if (isAvailable) {
                                  setSelectedVoucher(voucher);
                                  setShowConfirmModal(true);
                                }
                              }}
                              disabled={!isAvailable}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${isAvailable
                                ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-95 cursor-pointer"
                                : "bg-slate-800 text-slate-500 cursor-not-allowed"
                                }`}
                            >
                              Tukar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONFIRM REDEEM MODAL */}
      <AnimatePresence>
        {showConfirmModal && selectedVoucher && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !redeeming && setShowConfirmModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 rounded-2xl max-w-[320px] w-full p-6 border border-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              {redeemSuccess ? (
                <div className="text-center">
                  <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-white mb-2">Berhasil!</h3>
                  <p className="text-slate-400 text-sm mb-4">
                    Voucher {selectedVoucher.name} telah masuk ke akunmu.
                  </p>
                  <p className="text-xs text-slate-500 mb-4">
                    Tunjukkan QR Code KTP ke merchant untuk klaim voucher.
                  </p>
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                      <selectedVoucher.icon className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Tukar Voucher</h3>
                    <p className="text-slate-400 text-sm mt-1">Kamu akan menukarkan poin untuk:</p>
                  </div>

                  <div className="bg-slate-800/50 rounded-xl p-4 mb-4">
                    <p className="text-center font-bold text-white">{selectedVoucher.name}</p>
                    <p className="text-center text-xs text-slate-400">{selectedVoucher.merchant}</p>
                    <div className="flex justify-between mt-3 pt-3 border-t border-slate-700">
                      <span className="text-slate-400">Biaya</span>
                      <span className="text-emerald-400 font-bold">{selectedVoucher.points} Poin</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      disabled={redeeming}
                      onClick={() => setShowConfirmModal(false)}
                      className="flex-1 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl transition-colors disabled:opacity-50"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleRedeem}
                      disabled={redeeming}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center disabled:opacity-50"
                    >
                      {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ya, Tukar"}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}