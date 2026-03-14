"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";

export default function AISearchModal({ 
  isOpen, 
  onClose, 
  query, 
  villageLocation, 
  locationReady,
  tempat,      // ✅ TAMBAHKAN: data tempat
  context      // ✅ TAMBAHKAN: konteks (status/antrean/visual)
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll ke pesan terbaru
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Efek Sapaan Berdasarkan Status Lokasi
  useEffect(() => {
    if (isOpen) {
      let initialMsg = "";
      
      if (locationReady && villageLocation) {
        initialMsg = `Halo! Saya Warga AI Setempat di ${villageLocation}. Saya tahu kondisi terkini di sini. Mau cari update atau butuh bantuan apa?`;
      } else {
        initialMsg = "Halo! Saya Warga AI Setempat. Karena lokasi belum aktif, saya akan membantu navigasi umum. Ingin mencari sesuatu secara global?";
      }

      setMessages([{ 
        id: Date.now(),
        role: "ai", 
        content: initialMsg,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);

      // Jika user sudah mengetik di search bar sebelum klik tombol AI
      if (query && query.trim().length >= 2) {
        const timer = setTimeout(() => {
          setMessages(prev => [...prev, { 
            id: Date.now() + 1,
            role: "ai", 
            content: `Saya lihat kamu tadi sedang mencari "${query}". Mau saya bantu carikan rekomendasi terbaiknya?`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
        }, 600);

        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, locationReady, villageLocation, query]);

  // Fungsi Fallback (Alternatif Jawaban)
  const getRealTimeResponse = useCallback((question, tempat) => {
    const now = new Date();
    const hour = now.getHours();
    
    // Data dummy untuk fallback
    if (question.toLowerCase().includes("rame") || question.toLowerCase().includes("antrian")) {
      if (hour >= 18 && hour <= 21) {
        return `📍 **Update Real-time**\n\nKondisi saat ini: Ramai (jam sibuk)\nEstimasi antrian: 15-20 menit\n\n💡 *Saran: Datang setelah jam 8 malam biasanya lebih sepi*`;
      } else {
        return `📍 **Update Real-time**\n\nKondisi saat ini: Normal\nEstimasi antrian: 5-10 menit\n\n💡 *Saat ini cukup nyaman untuk dikunjungi*`;
      }
    }
    
    if (question.toLowerCase().includes("parkir")) {
      return `🅿️ **Info Parkir**\n\nMobil: Tersedia\nMotor: Tersedia\n\n💡 *Parkir masih aman*`;
    }
    
    return `Maaf, saya sedang offline. Coba tanya: \n• Lagi rame?\n• Info parkir\n• Jam buka`;
  }, []);

  // FUNGSI UTAMA: Kirim pesan
  const handleSend = async (customMessage) => {
    const messageToSend = customMessage || input;
    if (!messageToSend.trim()) return;

    // User message
    const userMessage = {
      id: Date.now(),
      role: "user",
      content: messageToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      // Kirim ke API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageToSend,
          tempat: tempat || { name: villageLocation || "Lokasi" },
          context: context || "general",
        }),
      });

      const data = await response.json();
      
      // AI Response
      const aiResponse = {
        id: Date.now() + 1,
        role: "ai",
        content: data.text || "Maaf, saya tidak bisa menjawab saat ini.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      
      setMessages((prev) => [...prev, aiResponse]);
    } catch (err) {
      console.error("Chat Error:", err);
      
      // FALLBACK: Pakai fungsi lokal
      const fallbackResponse = {
        id: Date.now() + 1,
        role: "ai",
        content: `📱 **Mode Offline**\n\n${getRealTimeResponse(messageToSend, tempat)}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackResponse]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative w-full max-w-md bg-white dark:bg-[#0f172a] rounded-t-[32px] sm:rounded-[32px] h-[90vh] sm:h-[650px] flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="p-5 border-b dark:border-slate-800 flex items-center justify-between bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-[#0f172a]">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg transition-colors duration-500 ${
                  locationReady ? "bg-green-500 rotate-3" : "bg-[#E3655B] -rotate-3"
                }`}>
                  <span className="text-white font-black text-[10px]">
                    {locationReady ? "LOCAL" : "PRO"}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-none mb-1">
                    {locationReady ? `Tanya AI ${villageLocation}` : "Tanya AI Setempat"}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${locationReady ? "bg-green-500 animate-pulse" : "bg-slate-400"}`} />
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">
                      {locationReady ? "Mode On|Real Time" : "Mode Off"}
                    </p>
                  </div>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Chat Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 scroll-smooth">
              {messages.map((msg) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={msg.id} 
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[13px] font-bold leading-relaxed ${
                    msg.role === "user" 
                    ? "bg-[#E3655B] text-white rounded-tr-none shadow-md" 
                    : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none"
                  }`}>
                    <p className="whitespace-pre-line">{msg.content}</p>
                    <p className="text-[8px] opacity-50 mt-1 text-right">
                      {msg.time}
                    </p>
                  </div>
                </motion.div>
              ))}
              
              {/* Typing Indicator */}
              {isTyping && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-none">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-5 bg-white dark:bg-[#0f172a] border-t dark:border-slate-800">
              <div className="relative flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={locationReady ? "Tanya seputar wilayah ini..." : "Cari info secara luas..."}
                  className="w-full bg-slate-100 dark:bg-slate-800/50 border-none rounded-2xl py-4 pl-5 pr-12 text-sm font-bold focus:ring-2 focus:ring-[#E3655B]/30 transition-all dark:text-white"
                  disabled={isTyping}
                />
                <button 
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isTyping}
                  className={`absolute right-1.5 p-2.5 rounded-xl shadow-lg transition-all ${
                    input.trim() && !isTyping
                      ? "bg-[#E3655B] text-white active:scale-90 hover:bg-[#c24b45]" 
                      : "bg-slate-300 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </button>
              </div>
              
              {/* Mode Indicator */}
              {locationReady && (
                <p className="text-[10px] text-green-600 text-center mt-2 font-medium">
                  ⚡ Terhubung dengan data real-time {villageLocation}
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}