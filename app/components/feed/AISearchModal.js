"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";

export default function AISearchModal({ isOpen, onClose, query, villageLocation, locationReady }) {
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

  // Efek Sapaan Berdasarkan Status Lokasi (Umum vs Khusus)
  useEffect(() => {
    if (isOpen) {
      let initialMsg = "";
      
      if (locationReady && villageLocation) {
        // MODE KHUSUS (Local Expert)
        initialMsg = `Halo! Saya Warga AI Setempat di ${villageLocation}. Saya tahu kondisi terkini di sini. Mau cari update atau butuh bantuan apa?`;
      } else {
        // MODE UMUM (Global Guide)
        initialMsg = "Halo! Saya Warga AI Setempat. Karena lokasi belum aktif, saya akan membantu navigasi umum. Ingin mencari sesuatu secara global?";
      }

      setMessages([{ role: "ai", content: initialMsg }]);

      // Jika user sudah mengetik di search bar sebelum klik tombol AI
      if (query && query.trim().length >= 2) {
        setTimeout(() => {
          setMessages(prev => [...prev, { 
            role: "ai", 
            content: `Saya lihat kamu tadi sedang mencari "${query}". Mau saya bantu carikan rekomendasi terbaiknya?` 
          }]);
        }, 600);
      }
    }
  }, [isOpen, locationReady, villageLocation]);

  const handleSend = () => {
    if (!input.trim()) return;
    
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    const currentInput = input;
    setInput("");
    setIsTyping(true);

    // Simulasi Logic Jawaban (Ganti dengan API Call Gemini nantinya)
    setTimeout(() => {
      let aiResponse = "";
      if (locationReady) {
        aiResponse = `Sebagai pakar lokal di ${villageLocation}, saya merekomendasikan beberapa titik untuk "${currentInput}" yang paling sesuai dengan cuaca dan keramaian saat ini.`;
      } else {
        aiResponse = `Mencari "${currentInput}" secara umum... Untuk hasil yang lebih presisi di sekitarmu, jangan lupa aktifkan izin lokasi ya!`;
      }

      setMessages((prev) => [...prev, { role: "ai", content: aiResponse }]);
      setIsTyping(false);
    }, 1500);
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
            {/* Header: Visual Indicator Umum vs Khusus */}
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
              <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Chat Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 scroll-smooth">
              {messages.map((msg, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={idx} 
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[13px] font-bold leading-relaxed ${
                    msg.role === "user" 
                    ? "bg-[#E3655B] text-white rounded-tr-none shadow-md" 
                    : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none"
                  }`}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-none">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
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
                />
                <button 
                  onClick={handleSend}
                  className="absolute right-1.5 p-2.5 bg-[#E3655B] text-white rounded-xl shadow-lg active:scale-90 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}