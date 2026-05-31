"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Coins, Heart, Eye, Star, Flame, Trophy, Gift,
  History, ChevronDown, Target
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function PointsModal({ isOpen, onClose, userId, userPoints, kontribusi }) {
  const [recentHistory, setRecentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRules, setShowRules] = useState(false);

  // Ambil riwayat poin dari database
  useEffect(() => {
    if (!isOpen || !userId) return;

    const fetchHistory = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("user_point_logs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (data) setRecentHistory(data);
      setLoading(false);
    };

    fetchHistory();
  }, [isOpen, userId]);

  if (!isOpen) return null;

  // Daftar voucher
  const vouchers = [
    { id: 1, name: "Voucher Kopi", icon: "☕", points: 100, merchant: "Kedai Setempat" },
    { id: 2, name: "Voucher Makan", icon: "🍜", points: 250, merchant: "Warung Tetangga" },
    { id: 3, name: "Voucher Wisata", icon: "🎟", points: 500, merchant: "Wisata Pasuruan" },
  ];

  // Cari target voucher berikutnya
  const nextVoucher = vouchers.find(v => v.points > userPoints) || vouchers[0];
  const progressToNext = Math.min(100, (userPoints / nextVoucher.points) * 100);

  // Format activity type ke teks yang lebih ramah
  const getActivityText = (type) => {
    const map = {
      // Poin dari laporan
      'laporan_valid': '📝 Laporan tervalidasi',
      'laporan_baru': '📝 Laporan baru',
      'laporan_featured': '⭐ Laporan jadi info utama',
      'laporan_viral': '🔥 Laporan dilihat 50+ kali',
      'laporan_populer': '❤️ Laporan dapat 10+ like',

      // Poin dari kontribusi nyata
      'verifikasi_ktp': '🔑 Verifikasi KTP',
      'first_product': '🛍 Produk pertama dijual',
      'first_order_complete': '📦 Pesanan pertama selesai',
      'first_trip_complete': '🛵 Perjalanan pertama selesai',
      'first_help_complete': '🤝 Bantuan pertama selesai',
      'first_rating_5': '⭐ Rating 5 pertama',

      // Poin dari konten
      'upload_video': '📹 Upload Video',
      'upload_foto': '📸 Upload Foto',

      // Admin
      'admin_bonus': '👑 Bonus dari Admin',
    };
    return map[type] || type;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-slate-900 rounded-t-3xl w-full max-w-[400px] max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-5 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-slate-200">Poin & Kontribusi</h3>
              </div>
              <button onClick={onClose} className="p-1 rounded-full bg-slate-800/50">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Gelar Akamsi */}
            <div className="mt-2">
              <div className="inline-block px-3 py-1 rounded-full bg-slate-800/50">
                <span className={`text-[10px] font-bold ${kontribusi?.gelar?.color || "text-amber-400"}`}>
                  {kontribusi?.gelar?.title || "🌱 Akamsi Pemula"}
                </span>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* TOTAL POIN */}
            <div className="text-center">
              <p className="text-5xl font-black text-emerald-400">{userPoints}</p>
              <p className="text-[10px] text-slate-500 mt-1">Total Poin</p>
            </div>

            {/* TARGET VOUCHER BERIKUTNYA */}
            <div className="bg-slate-800/30 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Target Berikutnya</span>
                </div>
                <span className="text-[10px] text-emerald-400">{userPoints} / {nextVoucher.points}</span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressToNext}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{nextVoucher.icon}</span>
                  <span className="text-xs text-slate-300">{nextVoucher.name}</span>
                </div>
                <span className="text-[9px] text-slate-500">{nextVoucher.points - userPoints} poin lagi</span>
              </div>
            </div>

            {/* KONTRIBUSI ANDA */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Kontribusi Anda</h4>
              </div>
              <div className="space-y-3">
                {/* ❤️ Diapresiasi Warga */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Heart className="w-3.5 h-3.5 text-rose-400" />
                    <span className="text-xs text-slate-400">❤️ Diapresiasi Warga</span>
                  </div>
                  <span className="text-sm font-bold text-slate-200">{kontribusi?.totalLikes || 0} like</span>
                </div>

                {/* 👁 Dilihat Warga */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-xs text-slate-400">👁 Dilihat Warga</span>
                  </div>
                  <span className="text-sm font-bold text-slate-200">{kontribusi?.totalViews || 0} views</span>
                </div>

                {/* ⭐ Sorotan Setempat */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs text-slate-400">⭐ Sorotan Setempat</span>
                  </div>
                  <span className="text-sm font-bold text-slate-200">{kontribusi?.featuredCount || 0} laporan</span>
                </div>

                {/* 🔥 Laporan Ramai */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-xs text-slate-400">🔥 Laporan Ramai</span>
                  </div>
                  <span className="text-sm font-bold text-slate-200">{kontribusi?.laporanRamai || 0} laporan</span>
                </div>

                {/* 🏆 Laporan Berdampak */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-700/50">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-300">🏆 Laporan Berdampak</span>
                  </div>
                  <span className="text-sm font-bold text-emerald-400">{kontribusi?.laporanBerdampak || 0} laporan</span>
                </div>
              </div>
            </div>

            {/* RIWAYAT TERBARU */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-slate-500" />
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Riwayat Terbaru</h4>
              </div>
              <div className="space-y-2">
                {loading ? (
                  <div className="text-center py-4">
                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : recentHistory.length > 0 ? (
                  recentHistory.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-800/30">
                      <div>
                        <p className="text-xs font-medium text-slate-300">
                          {getActivityText(item.activity_type)}
                        </p>
                        <p className="text-[9px] text-slate-500">
                          {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <span className={`text-xs font-bold ${item.points_change > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {item.points_change > 0 ? `+${item.points_change}` : item.points_change}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 bg-slate-800/30 rounded-xl">
                    <p className="text-[10px] text-slate-500">Belum ada riwayat poin</p>
                    <p className="text-[9px] text-slate-600 mt-1">Mulai buat laporan untuk dapat poin!</p>
                  </div>
                )}
              </div>
              <button className="w-full mt-2 text-center text-[9px] text-slate-500 hover:text-emerald-400 transition-colors">
                Lihat Semua Riwayat →
              </button>
            </div>

            {/* TUKAR POIN */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Gift className="w-4 h-4 text-emerald-400" />
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tukar Poin</h4>
              </div>
              <div className="space-y-2">
                {vouchers.map((voucher) => (
                  <button
                    key={voucher.id}
                    disabled={userPoints < voucher.points}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all
                      ${userPoints >= voucher.points
                        ? "bg-slate-800/30 border-slate-700 hover:border-emerald-500/50 hover:bg-emerald-500/10 cursor-pointer"
                        : "bg-slate-800/20 border-slate-800/50 opacity-50 cursor-not-allowed"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <span className="text-lg">{voucher.icon}</span>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-slate-200">{voucher.name}</p>
                        <p className="text-[8px] text-slate-500">{voucher.merchant}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-emerald-400">{voucher.points} poin</p>
                      {userPoints >= voucher.points && (
                        <p className="text-[7px] text-slate-500">Tersedia</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ATURAN POIN (Collapsible) */}
            <div className="border-t border-slate-800/50 pt-3">
              <button
                onClick={() => setShowRules(!showRules)}
                className="w-full flex items-center justify-between py-2"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center">
                    <span className="text-[8px] text-slate-400">i</span>
                  </div>
                  <span className="text-[9px] text-slate-500">Cara Mendapat Poin</span>
                </div>
                <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${showRules ? "rotate-180" : ""}`} />
              </button>

              {showRules && (
                <div className="mt-3 space-y-2 pl-7">
                  <div className="flex justify-between text-[9px]">
                    <span className="text-slate-400">📝 Laporan teks</span>
                    <span className="text-emerald-400">+1</span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span className="text-slate-400">📸 Laporan + foto</span>
                    <span className="text-emerald-400">+2</span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span className="text-slate-400">📹 Laporan + video</span>
                    <span className="text-emerald-400">+4</span>
                  </div>
                  <div className="flex justify-between text-[9px] pt-1 border-t border-slate-800/30">
                    <span className="text-slate-400">❤️ Dapat 10 apresiasi</span>
                    <span className="text-emerald-400">+5</span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span className="text-slate-400">👁 Dapat 50 views</span>
                    <span className="text-emerald-400">+5</span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span className="text-slate-400">⭐ Sorotan Setempat</span>
                    <span className="text-emerald-400">+25</span>
                  </div>
                  <div className="flex justify-between text-[9px] pt-1 border-t border-slate-800/30">
                    <span className="text-slate-400">🪪 Verifikasi KTP</span>
                    <span className="text-emerald-400">+25</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}