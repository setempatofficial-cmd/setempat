"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/app/context/AuthContext";
import LaporPanel from "./LaporPanel";
import AIHeader from "./AIHeader";
import AIMessageBubble from "./AIMessageBubble";
import AIQuickActions from "./AIQuickActions";
import AIInput from "./AIInput";
import { getQuickActionsByCategory } from "./aiHelpers";

export default function AIModalTempat({
  isOpen,
  onClose,
  tempat,
  activeReport = null,
  reports = [],
  stats = { total: 0, ramai: 0, sepi: 0, antri: 0 },
  weather = null,
  onOpenAuthModal,
  onUploadSuccess,
  theme = { isMalam: false, card: "bg-white", border: "border-gray-100", text: "text-gray-900" },
}) {
  const { user } = useAuth();
  const BRAND_COLOR = "#E3655B";

  // State Management
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showLaporPanel, setShowLaporPanel] = useState(false);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClient, setIsClient] = useState(false); // ✅ Tambahan untuk client-side guard
  const hasWeather = weather && weather.weather_desc && weather.t;

  const modalContentRef = useRef(null);
  const messagesEndRef = useRef(null);
  const hasInitialized = useRef(false);
  const startY = useRef(0);

  const isMalam = theme?.isMalam;

  // ✅ Set client-side flag
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Helpers
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (messages.length > 0) setTimeout(scrollToBottom, 100);
  }, [messages, scrollToBottom]);

  // ========== LOGIKA SAMBUTAN (GREETING) DENGAN NAMA ==========
  useEffect(() => {
    // ✅ Guard: hanya jalan di client dan ketika tempat tersedia
    if (!isClient || !isOpen || !tempat?.id || hasInitialized.current) return;
    hasInitialized.current = true;

    const hour = new Date().getHours();
    const greeting = hour < 11 ? "Pagi" : hour < 15 ? "Siang" : hour < 18 ? "Sore" : "Malam";
    
    const namaUser = (() => {
  // 1. Prioritas utama: Nama asli dari profil
  if (user?.display_name) {
    return `, ${user.display_name.split(' ')[0]}`;
  }
  
  // 2. Jika tidak ada nama, olah dari email
  if (user?.email) {
    // Ambil sebelum '@', lalu ambil sebelum '.' atau '_'
    const partBeforeAt = user.email.split('@')[0];
    const cleanName = partBeforeAt.split(/[\._]/)[0]; // Memotong jika ada titik atau underscore
    
    // Jadikan huruf kapital di depan (Contoh: redaksi -> Redaksi)
    const capitalized = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    
    return `, ${capitalized}`;
  }
  
  // 3. Jika tamu (tidak login)
  return "";
})();

    const jarakText = tempat?.distance ? ` (${tempat.distance.toFixed(1)} km dari sini)` : "";

    let sambutan = "";

// 1. Kondisi Prioritas Utama: Ada Laporan Aktif
if (activeReport?.tipe) {
    const emojis = { 'Ramai': '👥', 'Sepi': '🍃', 'Antri': '⏳', 'Macet': '🚗', 'Banjir': '🌊' };
    const emoji = emojis[activeReport.tipe] || '📝';
    
    sambutan = `### ${greeting}${namaUser}! 👋
Saya menemukan laporan **${activeReport.tipe}** di wilayah **${tempat.name}** ${jarakText}.

---

> ${emoji} **Pantauan Lokasi:**  
> "${activeReport.deskripsi || "Kondisi saat ini memerlukan perhatian lebih."}"

💬 Ada yang ingin kamu tanyakan atau butuh pantauan visual?`;

} 
// 2. Kondisi Kedua: Tidak ada laporan, tapi ada data Cuaca
else if (weather && weather.weather_desc) {
    sambutan = `### ${greeting}${namaUser}! 👋
### Info Cuaca Terkini ☀️
Di sekitaran **${tempat.name}** saat ini terpantau **${weather.weather_desc}** dengan suhu **${weather.t}°C**.

---

Ada yang bisa kami bantu pantau di setempat ini?`;

} 
// 3. Kondisi Terakhir: Jika semua data kosong (Fallback)
else {
    sambutan = `### ${greeting}${namaUser}! 👋
**Pantauan Wilayah** 🌤️
Saat ini belum ada laporan di **${tempat.name}**. Kondisi terpantau normal.

---

Ada yang bisa saya bantu?`;
}

    setMessages([{
      id: Date.now(),
      type: "ai",
      text: sambutan,
      showLaporButton: true,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);

  }, [isClient, isOpen, tempat?.id, tempat?.name, tempat?.distance, weather?.weather_desc, weather?.t, activeReport?.tipe, activeReport?.deskripsi, user?.display_name, user?.email]);

  // ========== STRATEGI AI (LOCAL & SERVER) ==========
  const handleSend = useCallback(async (textOverride = null) => {
    const msg = textOverride || input;
    if (!msg.trim() || isTyping) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      type: "user",
      text: msg,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    let aiText = "";

    try {
      // 1. Jalur Utama: Chrome AI (Gratis & Cepat)
      if (typeof window !== "undefined" && window.ai) {
        try {
          const session = await window.ai.createTextSession();
          aiText = await session.prompt(msg);
        } catch (e) { console.warn("Chrome AI refused, falling back..."); }
      }

      // 2. Jalur Fallback: Server API
      if (!aiText) {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: msg,
            context: { reports: reports.slice(0, 3), stats },
            tempat: tempat ? { id: tempat.id, name: tempat.name } : null // ✅ Guard null
          }),
        });
        const data = await res.json();
        aiText = data?.text;
      }

      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        type: "ai",
        text: aiText || "Maaf, Setempat AI sedang istirahat sebentar. Coba tanya lagi ya!",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, reports, stats, tempat?.id, tempat?.name]); // ✅ Optional chaining di dependency

  // ========== GESTURE HANDLERS ==========
  const onTouchStart = (e) => {
    if (modalContentRef.current && modalContentRef.current.scrollTop <= 0) { // ✅ Guard null
      setIsDragging(true);
      startY.current = e.touches[0].clientY;
    }
  };

  const onTouchMove = (e) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0) setTranslateY(Math.min(diff * 0.6, 300));
  };

  const onTouchEnd = () => {
    if (translateY > 100) onClose();
    else setTranslateY(0);
    setIsDragging(false);
  };

  // ✅ Early return jika tidak open atau belum client
  if (!isOpen) return null;
  
  // ✅ Loading state saat server render atau tempat belum tersedia
  if (!isClient || !tempat) {
    return null; // Atau return loading skeleton
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center sm:items-center p-0 sm:p-4">
      {/* Overlay */}
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
      />
      
      {/* Modal Content */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: translateY }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={`relative w-[95%] max-w-[420px] mx-auto h-[92vh] sm:h-[85vh] ${theme.card} rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border-t ${theme.border}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 flex-shrink-0">
          <div className="w-10 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
        </div>

        <AIHeader locationName={tempat.name} isMalam={isMalam} onClose={onClose} theme={theme} />

        {/* Chat Area */}
        <div ref={modalContentRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-4 no-scrollbar">
          {messages.map((msg) => (
            <AIMessageBubble 
              key={msg.id} 
              message={msg} 
              isUser={msg.type === "user"} 
              isMalam={isMalam} 
              onLaporClick={() => setShowLaporPanel(true)} 
            />
          ))}
          {isTyping && (
            <div className="flex gap-2 items-center text-zinc-400 p-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Action Bar (Sticky Bottom) */}
        <div className="border-t border-zinc-50 dark:border-zinc-800/50 bg-inherit pb-safe">
          <div className="pt-2">
            <AIQuickActions 
              actions={getQuickActionsByCategory(tempat?.category, stats.total > 0)} 
              onActionClick={handleSend} 
              onLaporClick={() => setShowLaporPanel(true)}
              isMalam={isMalam}
            />
          </div>
          <AIInput 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onSend={() => handleSend()} 
            onLaporClick={() => setShowLaporPanel(true)}
            isTyping={isTyping}
          />
        </div>

        {/* Lapor Slide-up Panel */}
        <AnimatePresence>
          {showLaporPanel && (
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="absolute inset-0 z-[50] bg-white dark:bg-zinc-950 flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-bold text-zinc-800 dark:text-zinc-100">Kirim Laporan</h3>
                <button onClick={() => setShowLaporPanel(false)} className="text-zinc-400 text-sm font-bold">TUTUP</button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <LaporPanel 
                  tempat={tempat} 
                  user={user} 
                  onSuccess={(newLap) => {
                    setShowLaporPanel(false);
                    onUploadSuccess?.(newLap);
                    setMessages(prev => [...prev, { id: Date.now(), type: 'ai', text: 'Terima kasih laporannya! 🙌' }]);
                  }} 
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}