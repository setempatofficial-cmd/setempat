"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare, Heart, Share2, MapPin, Search, Bell, ShieldCheck } from "lucide-react";
import SmartBottomNav from "@/app/components/layout/SmartBottomNav";
import Uploader from "@/components/Uploader";

export default function CitizenHub({ userId, userRole }) {
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFormLaporan, setShowFormLaporan] = useState(false);

  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionUserId, setSessionUserId] = useState(null);

  // Ambil userId dari session jika props userId tidak ada
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setSessionUserId(session.user.id);
      }
    };
    getSession();
  }, []);

  // Gunakan userId dari props atau dari session
  const activeUserId = userId || sessionUserId;

  // Ambil data user saat ini
  useEffect(() => {
    const getCurrentUser = async () => {
      if (!activeUserId) return;
      
      const { data, error } = await supabase
        .from("users")
        .select("username, full_name, avatar_url")
        .eq("id", activeUserId)
        .single();
      
      if (!error && data) {
        setCurrentUser(data);
      } else {
        // Fallback jika tidak ada di tabel users
        setCurrentUser({
          username: `user_${activeUserId?.slice(0, 8) || "unknown"}`,
          full_name: "Warga",
          avatar_url: null
        });
      }
    };
    
    getCurrentUser();
  }, [activeUserId]);

  useEffect(() => {
    const getReports = async () => {
      const { data, error } = await supabase
        .from("laporan_warga")
        .select(`
          *,
          tempat:tempat_id (name)
        `)
        .order("created_at", { ascending: false });
      if (!error) setReports(data);
      setLoading(false);
    };
    getReports();
  }, []);

  const filteredReports = reports.filter(r =>
    r.deskripsi?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.user_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleModalScroll = (e) => {
    const { scrollTop, clientHeight } = e.target;
    const newIndex = Math.round(scrollTop / clientHeight);
    if (newIndex !== currentIndex) setCurrentIndex(newIndex);
  };

  // FUNGSI KIRIM KOMENTAR - MENTION TERSEMBUNYI
  const handleSendComment = async (report) => {
    if (!commentText.trim() || isSubmitting) return;
    if (!activeUserId) {
      alert("Anda harus login terlebih dahulu!");
      return;
    }

    // Ambil handle pemilik postingan (untuk hidden mention)
    const ownerHandle = `@${report.user_name?.replace(/\s+/g, '').toLowerCase() || "warga"}`;
    
    // Buat komentar dengan mention tersembunyi di AWAL (tidak terlihat oleh user)
    // Tapi user hanya melihat teks asli mereka
    const hiddenMention = `${ownerHandle} `;
    const finalComment = hiddenMention + commentText.trim();

    setIsSubmitting(true);
    
    try {
      // Siapkan data komentar sesuai struktur tabel
      const commentData = {
        tempat_id: report.tempat_id,
        user_id: activeUserId,
        user_name: currentUser?.full_name || "Warga",
        username: currentUser?.username || `user_${activeUserId?.slice(0, 8) || "unknown"}`,
        user_avatar: currentUser?.avatar_url || null,
        content: finalComment, // Ini yang tersimpan di database (dengan mention)
        parent_id: null,
        likes: 0,
        created_at: new Date().toISOString()
      };

      // Insert ke tabel komentar
      const { error } = await supabase
        .from("komentar")
        .insert([commentData]);

      if (error) throw error;
      
      // Reset input
      setCommentText("");
      alert("Komentar berhasil dikirim!");
      
    } catch (error) {
      console.error("Error detail:", error);
      alert(`Gagal mengirim komentar: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex justify-center items-start md:items-center font-sans">
      <div className="w-full max-w-[450px] min-h-screen md:h-[92vh] md:rounded-[40px] bg-zinc-900 shadow-2xl overflow-hidden relative border-x border-white/5 flex flex-col">

        {/* HEADER */}
        <header className="p-5 pt-7 bg-zinc-900/80 backdrop-blur-xl sticky top-0 z-40 space-y-4">
          <div className="flex justify-between items-center px-1">
            <div>
              <h1 className="text-xl font-black tracking-tighter text-[#E3655B] leading-none">CERITA RONDA</h1>
              <p className="text-[10px] text-white/40 font-bold tracking-[0.2em] uppercase mt-1">Warga Setempat</p>
            </div>
            <button
              onClick={() => router.push("/woro")}
              className="p-2 text-white/70 hover:text-white transition-colors"
            >
              <Bell size={20} />
            </button>
          </div>

          <div className="relative group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[#E3655B] transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kejadian di sekitar..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#E3655B]/50 transition-all"
            />
          </div>
        </header>

        {/* EXPLORE FEED */}
        <main className="flex-1 overflow-y-auto no-scrollbar p-4 bg-zinc-950">
          <div className="grid grid-cols-2 gap-3 pb-32">
            {filteredReports.map((report, index) => (
              <motion.div
                key={report.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCurrentIndex(index)}
                className="relative aspect-[3/4] bg-zinc-900 rounded-2xl overflow-hidden cursor-pointer border border-white/5 shadow-lg group"
              >
                <img src={report.photo_url || report.video_url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                  <img src={report.user_avatar || "/default-avatar.png"} className="w-4 h-4 rounded-full border border-white/20" />
                  <span className="text-[10px] text-white font-medium truncate w-20">{report.user_name}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </main>

        <SmartBottomNav
          onOpenUpload={() => setShowUploadModal(true)}
          onOpenLaporanForm={() => setShowFormLaporan(true)}
          onOpenNotification={() => router.push("/woro")}
          onOpenProfile={() => router.push("/rewang")}
        />

        <div className="uploader-container-frame">
          <Uploader isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} userId={activeUserId} userRole={userRole} />
        </div>

        {/* DETAIL MODAL (TIKTOK STYLE) */}
        <AnimatePresence>
          {currentIndex !== null && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute inset-0 z-[100] bg-black"
            >
              <button
                onClick={() => setCurrentIndex(null)}
                className="absolute top-8 right-6 z-[110] w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10"
              >
                <X size={20} />
              </button>

              <div onScroll={handleModalScroll} className="h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar">
                {filteredReports.map((report) => (
                  <div key={report.id} className="h-full w-full snap-start relative flex flex-col">
                    <div className="flex-1 flex items-center justify-center bg-zinc-950">
                      <img src={report.photo_url || report.video_url} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90" />
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-7 pb-24 flex justify-between items-end gap-5">
                      <div className="flex-1">
                        {/* USER INFO */}
                        <div className="flex items-center gap-3 mb-4">
                          <div className="relative shrink-0">
                            <img
                              src={report.user_avatar || "/default-avatar.png"}
                              alt="avatar"
                              className="w-10 h-10 rounded-full object-cover border-2 border-white/30 shadow-lg"
                            />
                            <div className="absolute -bottom-0.5 -right-0.5 bg-[#0095f6] rounded-full p-0.5 border border-black shadow-sm">
                              <ShieldCheck size={10} className="text-white" />
                            </div>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-white/50">Warga Setempat</span>
                            <span className="text-sm font-bold text-white drop-shadow-md leading-tight">
                              @{report.user_name?.replace(/\s+/g, '').toLowerCase() || "warga"}
                            </span>
                          </div>
                        </div>

                        {/* LOCATION */}
                        <h3 className="text-white font-black text-xl mb-2 flex items-center gap-2 tracking-tight uppercase">
                          <MapPin size={18} className="text-[#E3655B]" />
                          {report.tempat?.name || "Lokasi tidak diketahui"}
                        </h3>

                        <p className="text-sm text-white/80 leading-relaxed line-clamp-3 mb-6 font-medium">
                          {report.deskripsi}
                        </p>

                        {/* INPUT KOMENTAR - TANPA MENTION YANG TERLIHAT */}
                        <div className="flex gap-2">
                          <input
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder={`Komentari postingan ${report.user_name}...`}
                            className="flex-1 h-12 bg-white/10 border border-white/5 rounded-2xl px-5 text-sm text-white outline-none focus:border-[#E3655B]/50 transition-all"
                            disabled={isSubmitting}
                          />
                          <button
                            onClick={() => handleSendComment(report)}
                            disabled={isSubmitting || !commentText.trim()}
                            className={`px-4 h-12 rounded-2xl font-medium transition-all ${
                              isSubmitting || !commentText.trim()
                                ? 'bg-white/10 text-white/40 cursor-not-allowed'
                                : 'bg-[#E3655B] text-white hover:bg-[#d5544a]'
                            }`}
                          >
                            {isSubmitting ? '...' : 'Kirim'}
                          </button>
                        </div>
                        <p className="text-[10px] text-white/30 mt-2">
                          💡 Komentar akan otomatis terkirim ke @{report.user_name?.replace(/\s+/g, '').toLowerCase() || "warga"}
                        </p>
                      </div>

                      {/* SIDE ACTIONS */}
                      <div className="flex flex-col gap-6 items-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <button className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white">
                            <Heart size={24} />
                          </button>
                          <span className="text-[10px] font-bold text-white/60">Like</span>
                        </div>
                        <div className="flex flex-col items-center gap-1.5">
                          <button className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white">
                            <MessageSquare size={24} />
                          </button>
                          <span className="text-[10px] font-bold text-white/60">Chat</span>
                        </div>
                        <button className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E3655B] to-[#ff7d72] flex items-center justify-center text-white shadow-lg shadow-[#E3655B]/20">
                          <Share2 size={22} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        .uploader-container-frame button {
          position: absolute !important;
          bottom: 100px !important;
          right: 20px !important;
          width: 60px !important;
          height: 60px !important;
          border-radius: 22px !important;
          background: linear-gradient(to bottom right, #E3655B, #ff7d72) !important;
          box-shadow: 0 10px 25px -5px rgba(227, 101, 91, 0.5) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          z-index: 60 !important;
          border: 2px solid rgba(255, 255, 255, 0.2) !important;
          transition: all 0.3s ease !important;
        }

        .uploader-container-frame button:active { scale: 0.9 !important; opacity: 0.9 !important; }
        .uploader-container-frame button svg { width: 32px !important; height: 32px !important; color: white !important; stroke-width: 3px !important; }

        ${currentIndex !== null ? '.uploader-container-frame { display: none; }' : ''}
      `}</style>
    </div>
  );
}