"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "@/app/context/AuthContext";
import LaporPanel from "./LaporPanel";
import AIHeader from "./AIHeader";
import AIMessageBubble from "./AIMessageBubble";
import AIQuickActions from "./AIQuickActions";
import AIInput from "./AIInput";
import { isLaporIntent, getQuickActionsByCategory } from "./aiHelpers";

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

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showLaporPanel, setShowLaporPanel] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [translateY, setTranslateY] = useState(0);

  const modalContentRef = useRef(null);
  const messagesEndRef = useRef(null);
  const hasInitialized = useRef(false);
  const messageCounter = useRef(0);

  const isMalam = theme?.isMalam;
  const jarak = tempat?.distance ? `${tempat.distance.toFixed(1)} km` : null;

  const getUniqueId = useCallback(() => {
    messageCounter.current += 1;
    return `${Date.now()}-${messageCounter.current}`;
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (messages.length > 0) setTimeout(scrollToBottom, 100);
  }, [messages]);

  useEffect(() => {
    if (isOpen && activeReport) {
      hasInitialized.current = false;
    }
  }, [activeReport, isOpen]);

  // ========== OPENING MESSAGE ==========
  useEffect(() => {
    if (!isOpen || !tempat?.id) return;
    if (hasInitialized.current) return;

    hasInitialized.current = true;

    const hour = new Date().getHours();
    const greeting = hour < 11 ? "Pagi" : hour < 15 ? "Siang" : hour < 18 ? "Sore" : "Malam";
    const jarakText = jarak ? ` (${jarak} dari lokasi Anda)` : "";

    let sambutan = "";
    
    if (activeReport && activeReport.tipe) {
      const tipeEmoji = {
        'Ramai': '👥',
        'Sepi': '🍃',
        'Antri': '⏳'
      };
      const emoji = tipeEmoji[activeReport.tipe] || '📝';
      const kondisi = activeReport.tipe || "kondisi";
      const deskripsi = activeReport.deskripsi?.substring(0, 100) || "";
      
      sambutan = `${greeting}, Sobat! 👋 Saya lihat Anda penasaran dengan kondisi **${kondisi}** di **${tempat.name}**${jarakText}\n\n${emoji} *"${deskripsi}"*\n\n`;
      
      if (activeReport.tipe === "Ramai") {
        sambutan += `📌 **Tips:** Kalau mau hindari keramaian, coba datang di pagi atau sore hari ya!\n\n`;
      } else if (activeReport.tipe === "Antri") {
        sambutan += `⏳ **Tips:** Siapkan waktu ekstra atau cari alternatif tempat lain!\n\n`;
      } else if (activeReport.tipe === "Sepi") {
        sambutan += `🍃 **Tips:** Waktu yang tepat untuk santai atau foto-foto!\n\n`;
      }
      
      sambutan += `💬 Ada yang mau ditanyakan lebih lanjut seputar kondisi ini?`;
    } else {
      let cuacaText = "";
      if (weather && weather.weather_desc) {
        cuacaText = `\n\n☀️ **Cuaca:** ${weather.weather_desc}, ${weather.t}°C`;
      } else {
        cuacaText = `\n\n🌤️ Cuaca: ${hour < 15 ? "Siang panas, jangan lupa topi dan minum!" : "Sore teduh, enak santai."}`;
      }
      
      sambutan = `${greeting}, Sobat! 👋 Selamat datang di **${tempat.name}**${jarakText}${cuacaText}\n\n💬 Tanya kondisi terkini atau langsung lapor ya!`;
    }

    setMessages([
      {
        id: getUniqueId(),
        type: "ai",
        text: sambutan,
        showLaporButton: true,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  }, [isOpen, tempat?.id, tempat?.name, jarak, weather, activeReport, getUniqueId]);

  useEffect(() => {
    if (!isOpen) {
      setTranslateY(0);
      setShowLaporPanel(false);
      hasInitialized.current = false;
      setMessages([]);
    }
  }, [isOpen]);

  // 🔥 TOUCH HANDLERS YANG LEBIH RESPONSIF (tanpa scroll detection)
  const handleTouchStart = useCallback((e) => {
    // Cek apakah scroll di puncak
    const scrollTop = modalContentRef.current?.scrollTop || 0;
    if (scrollTop <= 0) {
      setIsDragging(true);
      setStartY(e.touches[0].clientY);
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 0) {
      e.preventDefault();
      e.stopPropagation();
      // Pakai rubber-band effect (semakin jauh semakin kecil pergerakannya)
      const eased = diff > 100 ? 100 + (diff - 100) * 0.3 : diff;
      setTranslateY(Math.min(eased, 250));
    }
  }, [isDragging, startY]);

  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      // Jika swipe lebih dari 80px ATAU translateY > 80
      if (translateY > 80) {
        onClose();
      } else {
        setTranslateY(0);
      }
      setIsDragging(false);
    }
  }, [isDragging, translateY, onClose]);

  const triggerLapor = () => {
    if (!user) {
      onClose();
      setTimeout(() => onOpenAuthModal?.(), 300);
      return;
    }
    setShowLaporPanel(true);
  };

  const quickActions = useMemo(() => {
    const hasLaporan = stats.total > 0;
    return getQuickActionsByCategory(tempat?.category, hasLaporan);
  }, [tempat?.category, stats.total]);

  const handleLaporSuccess = useCallback(
    (newLaporan) => {
      setShowLaporPanel(false);
      setMessages((prev) => [
        ...prev,
        {
          id: getUniqueId(),
          type: "ai",
          text: `✅ Laporan berhasil! Terima kasih sudah berbagi. 🎉\n\nAda lagi yang mau ditanyakan?`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      onUploadSuccess?.(newLaporan);
    },
    [getUniqueId, onUploadSuccess]
  );

  const handleSend = useCallback(async (textOverride = null) => {
    const msg = textOverride || input;
    if (!msg.trim() || isTyping) return;

    // 1. Tampilkan pesan user di UI
    const userMessage = {
      id: getUniqueId(),
      type: "user",
      text: msg,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      let aiResponseText = "";

      // 2. STRATEGI 1: Coba pakai Chrome AI (Local & Gratis)
      if (typeof window !== "undefined" && window.ai) {
        try {
          const session = await window.ai.createTextSession();
          aiResponseText = await session.prompt(msg);
          console.log("Response from Chrome AI");
        } catch (e) {
          console.warn("Chrome AI failed or refused, falling back to server...", e);
        }
      }

      // 3. STRATEGI 2: Fallback ke Server AI jika Chrome AI tidak tersedia/gagal
      if (!aiResponseText) {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: msg,
            context: { laporanTerbaru: reports.slice(0, 5) },
            tempat: {
              id: tempat.id,
              name: tempat.name,
              category: tempat.category,
              kode_wilayah: tempat.kode_wilayah,
            },
          }),
        });
        
        const data = await res.json();
        aiResponseText = data?.text || "Maaf, saya sedang bingung. Coba tanya hal lain ya!";
      }

      // 4. Tampilkan jawaban AI (baik dari Local maupun Server)
      setMessages((prev) => [
        ...prev,
        {
          id: getUniqueId(),
          type: "ai",
          text: aiResponseText,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);

    } catch (error) {
      console.error("AI Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: getUniqueId(),
          type: "ai",
          text: "Maaf, koneksi saya terganggu. Coba lagi nanti ya!",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, getUniqueId, reports, tempat]);


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center sm:items-center">
      {/* Overlay dengan opacity yang ikut berubah saat swipe */}
      <div 
        className="absolute inset-0 bg-black/60 transition-opacity duration-200"
        style={{ opacity: 0.6 - (translateY / 500) }}
        onClick={onClose} 
      />
      
      {/* Modal Container dengan swipe gesture */}
      <div
        className="relative w-full max-w-md h-full sm:h-[90vh] flex flex-col"
        style={{ 
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1)",
          touchAction: isDragging ? "none" : "auto"
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          ref={modalContentRef}
          className={`w-full h-full ${theme.card} rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col overflow-y-auto`}
        >
          <div className="flex justify-center pt-2 pb-1 flex-shrink-0 sticky top-0 bg-inherit z-10">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </div>

          <AIHeader locationName={tempat?.name || "Lokasi"} isMalam={isMalam} onClose={onClose} theme={theme} />

          <div className="flex-1 px-4 py-4 space-y-4">
            {messages.map((msg) => (
              <AIMessageBubble
                key={msg.id}
                message={msg}
                isUser={msg.type === "user"}
                isMalam={isMalam}
                onLaporClick={triggerLapor}
                showLaporButton={msg.showLaporButton}
              />
            ))}
            {isTyping && (
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                  <span className="text-sm">🤖</span>
                </div>
                <div className="px-4 py-2.5 rounded-2xl bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white rounded-tl-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-current animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-current animate-bounce delay-75" />
                    <span className="w-2 h-2 rounded-full bg-current animate-bounce delay-150" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <AnimatePresence>
  {showLaporPanel && (
    <div className="fixed inset-0 z-[2100] bg-white dark:bg-zinc-900 flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden">
      {/* Header LaporPanel dengan drag indicator */}
      <div className="flex justify-center pt-2 pb-1">
        <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
      </div>
      
      {/* Tombol Close di header */}
      <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100 dark:border-zinc-800">
        <h3 className="font-semibold text-gray-900 dark:text-white">Laporkan Kondisi</h3>
        <button 
          onClick={() => setShowLaporPanel(false)}
          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"
        >
          ✕
        </button>
      </div>
      
      {/* Konten LaporPanel - scrollable */}
      <div className="flex-1 overflow-y-auto">
        <LaporPanel
          mode="media"
          tempat={tempat}
          user={user}
          onClose={() => setShowLaporPanel(false)}
          onSuccess={handleLaporSuccess}
          onOpenAuthModal={onOpenAuthModal}
          theme={theme}
        />
      </div>
    </div>
  )}
</AnimatePresence>

{!showLaporPanel && (
  <div className="flex-shrink-0 border-t border-gray-100 dark:border-zinc-800/50 bg-inherit pb-safe z-[50]">
    {/* 1. Quick Actions */}
    <div className="pt-3">
      <AIQuickActions
        actions={quickActions}
        onActionClick={(text) => handleSend(text)} 
        onLaporClick={triggerLapor}
        isMalam={isMalam}
      />
    </div>

    {/* 2. Input Utama */}
    <div className="px-1">
      <AIInput
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onSend={() => handleSend()}
        onLaporClick={triggerLapor} 
        isTyping={isTyping}
        placeholder="Tanya kondisi atau lapor..."
      />
    </div>
    <p className="text-[8px] text-center text-slate-400 mt-2">✨ Tanya jam buka, cuaca, atau lapor kondisi</p>
  </div>
)}
        </div>
      </div>
    </div>
  );
}