"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CldUploadWidget } from "next-cloudinary";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";

// ── Konstanta ─────────────────────────────────────────────────────────────────
const CONDITIONS = [
  { emoji: "🍃", label: "Sepi", val: "Tenang", active: "bg-emerald-500 border-emerald-500 text-white" },
  { emoji: "🏃", label: "Ramai", val: "Ramai", active: "bg-yellow-400 border-yellow-400 text-white" },
  { emoji: "⏳", label: "Antri", val: "Antri", active: "bg-rose-500 border-rose-500 text-white" },
];

const getCurrentTimeTag = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "Pagi";
  if (h >= 11 && h < 15) return "Siang";
  if (h >= 15 && h < 18) return "Sore";
  return "Malam";
};

// ── Deteksi intent lapor ──────────────────────────────────────────────────────
const isLaporIntent = (text) => {
  const lower = text.toLowerCase();
  const keywords = [
    "lapor", "kirim laporan", "kirim foto", "upload", "foto",
    "report", "laporin", "ngirim", "posting", "post kondisi",
    "kasih tau", "beritahu", "share kondisi", "share foto",
    "mau lapor", "pengen lapor", "ingin lapor", "bisa lapor",
    "kondisi terkini", "update kondisi", "kasih update",
  ];
  return keywords.some(k => lower.includes(k));
};

// ── Panel Laporan (MODIFIED FOR DUAL MODE) ────────────────────────────────────
function LaporPanel({ tempat, onClose, onSuccess, mode = "media" }) {
  // Jika mode text, langsung ke form. Jika media, ke upload (kecuali harus pilih tempat dulu)
  const initialStep = !tempat?.id ? "pick_tempat" : (mode === "text" ? "form" : "upload");

  const [step, setStep] = useState(initialStep);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [condition, setCondition] = useState(null);
  const [caption, setCaption] = useState("");

  const [pickedTempat, setPickedTempat] = useState(tempat || null);
  const [tempatList, setTempatList] = useState([]);
  const [tempatQuery, setTempatQuery] = useState("");
  const [isLoadingTempat, setIsLoadingTempat] = useState(false);

  useEffect(() => {
    if (tempat?.id) return;
    setIsLoadingTempat(true);
    supabase
      .from("feed_view")
      .select("id, name, category, alamat")
      .limit(30)
      .then(({ data }) => {
        setTempatList(data || []);
        setIsLoadingTempat(false);
      })
      .catch(() => {
        setTempatList([]);
        setIsLoadingTempat(false);
      });
  }, [tempat?.id]);

  const filteredTempat = tempatList.filter(t =>
    !tempatQuery ||
    t.name?.toLowerCase().includes(tempatQuery.toLowerCase()) ||
    t.category?.toLowerCase().includes(tempatQuery.toLowerCase()) ||
    t.alamat?.toLowerCase().includes(tempatQuery.toLowerCase())
  );

  const activeTempat = pickedTempat || tempat;

  const handleUploadDone = (res) => {
    if (res?.event === "success") {
      setMediaType(res.info?.resource_type);
      setMediaUrl(res.info.secure_url);
      setStep("form");
    }
  };

  const handleSubmit = async () => {
    if (!condition) return;
    setStep("sending");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Login diperlukan");
      const u = session.user;
      const meta = u.user_metadata || {};
      const desc = caption.trim() || `Kondisi ${condition.toLowerCase()} di ${activeTempat?.name || "sini"}.`;

      const { data, error } = await supabase.from("laporan_warga").insert([{
        tempat_id: activeTempat?.id ? parseInt(activeTempat.id) : null,
        user_id: u.id,
        user_name: meta.full_name || meta.name || u.email?.split("@")[0] || "Warga",
        user_avatar: meta.avatar_url || meta.picture || null,
        photo_url: mediaUrl ? (mediaType === "video" ? mediaUrl.replace(/\.[^/.]+$/, ".jpg") : mediaUrl) : null,
        video_url: mediaType === "video" ? mediaUrl : null,
        media_type: mediaType || "text",
        time_tag: getCurrentTimeTag(),
        tipe: condition,
        deskripsi: desc,
        content: caption.trim(),
        status: "approved",
      }]).select();

      if (error) throw error;
      setStep("done");
      setTimeout(() => onSuccess(data[0]), 1200);
    } catch (err) {
      alert("Gagal kirim: " + err.message);
      setStep("form");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className="mx-4 mb-4 rounded-2xl border border-slate-100 bg-slate-50 overflow-hidden flex flex-col shadow-xl"
    >
      <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 flex-shrink-0" />

      <div className="flex flex-col" style={{ maxHeight: "65vh" }}>

        {/* ── STEP: PICK TEMPAT ── */}
        {step === "pick_tempat" && (
          <div className="flex flex-col p-4 gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold text-slate-700">📍 Laporan dari mana, Lur?</p>
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-200 text-slate-400 text-sm">✕</button>
            </div>
            <input
              type="text"
              value={tempatQuery}
              onChange={e => setTempatQuery(e.target.value)}
              placeholder="Cari nama tempat atau area..."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-cyan-400/30 bg-white"
              autoFocus
            />
            <div className="overflow-y-auto flex flex-col gap-1" style={{ maxHeight: "45vh" }}>
              {isLoadingTempat ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-[12px] text-slate-500">Memuat daftar tempat...</p>
                </div>
              ) : filteredTempat.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <span className="text-2xl">📍</span>
                  <p className="text-[12px] text-slate-400 text-center">
                    {tempatQuery ? "Tidak ditemukan tempat" : "Belum ada tempat tersedia"}
                  </p>
                </div>
              ) : (
                filteredTempat.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setPickedTempat(t);
                      setStep(mode === "text" ? "form" : "upload");
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 text-left transition-colors active:scale-[0.98]"
                  >
                    <span className="text-lg flex-shrink-0">📍</span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-slate-800 truncate">{t.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{t.category}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── HEADER ── */}
        {step !== "pick_tempat" && (
          <div className="flex-shrink-0 px-4 pt-3 pb-2 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2 min-w-0">
              {!tempat?.id && activeTempat && (
                <button onClick={() => setStep("pick_tempat")} className="text-[10px] font-black text-cyan-500 uppercase tracking-wide hover:underline flex-shrink-0">← Ganti</button>
              )}
              <p className="text-[13px] font-bold text-slate-700 truncate">
                {activeTempat?.name || "Laporan Cepat"} · {getCurrentTimeTag()}
              </p>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-200 text-slate-400 text-sm flex-shrink-0">✕</button>
          </div>
        )}

        {/* ── STEP: UPLOAD ── */}
        {step === "upload" && (
          <div className="p-4">
            <CldUploadWidget
              uploadPreset="setempat_preset"
              onSuccess={handleUploadDone}
              options={{ maxFiles: 1, resourceType: "image", sources: ["local", "camera"] }}
            >
              {({ open }) => (
                <button onClick={() => open()} className="w-full py-8 rounded-xl border-2 border-dashed border-slate-200 bg-white flex flex-col items-center gap-2 active:scale-95 transition-all">
                  <span className="text-3xl">📸</span>
                  <span className="text-[12px] font-black text-slate-500 uppercase">Ambil Foto Kondisi</span>
                </button>
              )}
            </CldUploadWidget>
            <button onClick={() => setStep("form")} className="w-full mt-3 text-[10px] font-bold text-slate-400 hover:text-cyan-500 transition-colors uppercase tracking-widest">
              Lapor Tanpa Foto →
            </button>
          </div>
        )}

        {/* ── STEP: FORM ── */}
        {step === "form" && (
          <>
            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-2 space-y-3 min-h-0">
              {mediaUrl && (
                <div className="relative w-full h-28 rounded-xl overflow-hidden bg-slate-200">
                  <img src={mediaUrl} className="w-full h-full object-cover" alt="preview" />
                  <button onClick={() => { setMediaUrl(null); setStep("upload"); }} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center">✕</button>
                </div>
              )}
              <textarea
                placeholder={mode === "text" ? "Laporkan kondisi cepat..." : "Ceritakan kondisinya, Lur..."}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400/30 resize-none"
                rows={mode === "text" ? 3 : 2} value={caption} onChange={(e) => setCaption(e.target.value)}
                autoFocus={mode === "text"}
              />
              <div className="grid grid-cols-3 gap-2">
                {CONDITIONS.map((c) => (
                  <button key={c.val} onClick={() => setCondition(c.val)}
                    className={`py-2.5 rounded-xl text-[10px] font-black border-2 transition-all flex flex-col items-center gap-0.5
                      ${condition === c.val ? c.active + " scale-[1.03] shadow-md" : "bg-white text-slate-400 border-slate-200"}`}
                  >
                    <span className="text-base">{c.emoji}</span>
                    <span className="uppercase tracking-wide">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-shrink-0 px-4 pt-2 pb-4 bg-white border-t border-slate-100">
              <button onClick={handleSubmit} disabled={!condition}
                className={`w-full py-4 rounded-xl font-black uppercase text-[12px] tracking-widest transition-all
                  ${condition ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg" : "bg-slate-200 text-slate-400"}`}
              >
                {condition ? `Kirim Laporan — ${condition}` : "Pilih Kondisi"}
              </button>
            </div>
          </>
        )}

        {/* ── STEP: SENDING ── */}
        {step === "sending" && (
          <div className="p-8 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Mengirim...</p>
          </div>
        )}

        {/* ── STEP: DONE ── */}
        {step === "done" && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="p-8 flex flex-col items-center gap-2">
            <span className="text-4xl">✅</span>
            <p className="text-[13px] font-black text-emerald-600 uppercase tracking-wider">Berhasil!</p>
            <p className="text-[11px] text-slate-400 text-center">Terima kasih atas laporannya.</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ── Bubble tombol lapor ───────────────────────────────────────────────────────
function LaporButton({ onClick }) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={onClick}
      className="mt-2 w-full py-2.5 bg-gradient-to-r from-[#E3655B] to-[#c24b45] text-white rounded-xl text-[11px] font-black uppercase tracking-wider active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2"
    >
      <span>📸</span> Kirim Laporan Live
    </motion.button>
  );
}

// ── AIModal Utama ─────────────────────────────────────────────────────────────
export default function AIModal({ isOpen, onClose, tempat, context, onOpenAuthModal, onUploadSuccess, initialQuery }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [showLaporPanel, setShowLaporPanel] = useState(false);
  const [laporMode, setLaporMode] = useState("media"); // "media" atau "text"
  const [laporanTerkirim, setLaporanTerkirim] = useState(false);

  const modalRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, showLaporPanel, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      // DETEKSI MODE PEMANGGILAN
      if (initialQuery === "quick_lapor") {
        setLaporMode("text");
        setShowLaporPanel(true);
      } else {
        setLaporMode("media");
      }
    } else {
      document.body.style.overflow = "";
      setTranslateY(0);
      setShowLaporPanel(false);
      setLaporanTerkirim(false);
    }
  }, [isOpen, initialQuery]);

  useEffect(() => {
    if (!isOpen || initialQuery === "quick_lapor") return;

    setMessages([{
      id: 1, type: "ai", isOpening: true,
      text: tempat
        ? `Halo! Nama Saya AKAMSI AI Setempat yang ngerti kondisi real-time di *${tempat.name}*.\n\nMau ngapain dulu nih, Lur?`
        : `Halo! Saya AKAMSI AI Setempat. Mau tanya kondisi sekitar atau mau lapor sesuatu, Lur?`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);
  }, [isOpen, tempat?.id, initialQuery]);

  const handleTouchStart = useCallback((e) => {
    if (modalRef.current?.scrollTop <= 0) { setIsDragging(true); setStartY(e.touches[0].clientY); }
  }, []);
  const handleTouchMove = useCallback((e) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 0) { e.preventDefault(); setTranslateY(Math.min(diff, 150)); }
  }, [isDragging, startY]);
  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      if (translateY > 80) onClose(); else setTranslateY(0);
      setIsDragging(false);
    }
  }, [isDragging, translateY, onClose]);

  const triggerLapor = useCallback((mode = "media") => {
    if (!user) {
      onClose();
      setTimeout(() => onOpenAuthModal?.(), 300);
      return;
    }
    setLaporMode(mode);
    setShowLaporPanel(true);
  }, [user, onClose, onOpenAuthModal]);

  const handleTanya = () => {
    setShowLaporPanel(false);
    setMessages(p => [...p, { id: Date.now(), type: "user", text: "🔍 Saya mau tanya kondisi real-time", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    setIsTyping(true);
    setTimeout(() => {
      setMessages(p => [...p, { id: Date.now(), type: "ai", text: tempat?.name ? `Silakan tanya apa yang ingin kamu ketahui tentang *${tempat.name}*` : `Tanya apa aja soal kondisi sekitar, Lur!`, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
      setIsTyping(false);
    }, 900);
  };

  const handleLapor = () => {
    setMessages(p => [...p, { id: Date.now(), type: "user", text: "📸 Saya mau kirim laporan kondisi terkini", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    setTimeout(() => triggerLapor("media"), 400);
  };

  const handleLaporSuccess = (newLaporan) => {
    setShowLaporPanel(false);
    setLaporanTerkirim(true);
    setMessages(p => [...p, {
      id: Date.now(), type: "ai", showLaporLagi: true,
      text: `✅ *Laporan berhasil terkirim!*\n\nTerima kasih sudah membantu pantau kondisi sekitar. 🎉`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);
    onUploadSuccess?.(newLaporan);
  };

  const handleSend = useCallback(async (customMessage) => {
    const msg = (customMessage || input).trim();
    if (!msg) return;

    setMessages(p => [...p, { id: Date.now(), type: "user", text: msg, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    setInput("");
    setIsTyping(true);

    if (isLaporIntent(msg)) {
      setTimeout(() => {
        setIsTyping(false);
        setMessages(p => [...p, { id: Date.now(), type: "ai", showLaporButton: true, text: `Siap! Kamu bisa langsung kirim foto kondisi sekarang 👇`, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
        if (user) triggerLapor("media");
      }, 700);
      return;
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, context, tempat: tempat ? { id: tempat.id, name: tempat.name } : null }),
      });
      const data = await res.json();
      if (data?.text) {
        setMessages(p => [...p, { id: Date.now(), type: "ai", text: data.text, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
      }
    } catch {
      setMessages(p => [...p, { id: Date.now(), type: "ai", text: "Maaf, AI lagi gangguan. Coba lagi ya!", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
    } finally {
      setIsTyping(false);
    }
  }, [input, user, triggerLapor, context, tempat]);

  useEffect(() => {
    if (isOpen && initialQuery?.trim() && initialQuery !== "quick_lapor") {
      setTimeout(() => handleSend(initialQuery.trim()), 500);
    }
  }, [isOpen, initialQuery, handleSend]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        ref={modalRef}
        className="relative w-full max-w-md h-full sm:h-[90vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col"
        style={{ transform: `translateY(${translateY}px)`, transition: isDragging ? "none" : "transform 0.3s ease-out" }}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
      >
        <div className="flex justify-center pt-2 pb-1 flex-shrink-0"><div className="w-12 h-1.5 bg-gray-200 rounded-full" /></div>

        <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E3655B] to-[#c24b45] flex items-center justify-center shadow-sm"><span className="text-xl">🤖</span></div>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900">AI Setempat</h2>
                <p className="text-[11px] text-gray-500">{tempat?.name || "Kondisi Sekitar"}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex items-start gap-2 ${msg.type === "user" ? "flex-row-reverse" : ""}`}>
              {msg.type === "ai" && <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E3655B] to-[#c24b45] flex items-center justify-center flex-shrink-0 shadow-sm"><span className="text-sm">🤖</span></div>}
              <div className={`max-w-[85%] px-4 py-2.5 shadow-sm rounded-2xl ${msg.type === "user" ? "bg-gradient-to-br from-[#E3655B] to-[#c24b45] text-white rounded-tr-sm" : "bg-gray-100 text-gray-900 rounded-tl-sm"}`}>
                <p className="text-[13px] whitespace-pre-line leading-relaxed">{msg.text}</p>
                {msg.isOpening && (
                  <div className="mt-3 flex flex-col gap-2">
                    <button onClick={handleTanya} className="w-full py-2.5 bg-white border-2 border-gray-200 rounded-xl text-[11px] font-black text-gray-700 uppercase tracking-wider">🔍 Tanya Kondisi</button>
                    <button onClick={handleLapor} className="w-full py-2.5 bg-gradient-to-r from-[#E3655B] to-[#c24b45] text-white rounded-xl text-[11px] font-black uppercase tracking-wider shadow-sm">📸 Kirim Laporan Live</button>
                  </div>
                )}
                {msg.showLaporButton && !showLaporPanel && <LaporButton onClick={() => triggerLapor("media")} />}
                <p className={`text-[10px] mt-1 ${msg.type === "user" ? "text-white/60" : "text-gray-400"}`}>{msg.time}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <AnimatePresence>
          {showLaporPanel && (
            <LaporPanel
              mode={laporMode}
              tempat={tempat}
              onClose={() => setShowLaporPanel(false)}
              onSuccess={handleLaporSuccess}
            />
          )}
        </AnimatePresence>

        {!showLaporPanel && (
          <div className="flex-shrink-0 border-t border-gray-100 px-3 py-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 focus-within:ring-2 focus-within:ring-[#E3655B]/30">
                <input
                  type="text" value={input} onChange={(e) => setInput(e.target.value)}
                  placeholder={tempat?.name ? `Tanya tentang ${tempat.name}...` : "Tanya kondisi atau lapor..."}
                  className="w-full bg-transparent text-[13px] text-gray-900 focus:outline-none"
                  onKeyPress={(e) => e.key === "Enter" && handleSend()}
                />
              </div>
              <button onClick={() => handleSend()} disabled={!input.trim() || isTyping} className={`w-10 h-10 rounded-full flex items-center justify-center ${input.trim() && !isTyping ? "bg-gradient-to-br from-[#E3655B] to-[#c24b45] text-white" : "bg-gray-200 text-gray-400"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}