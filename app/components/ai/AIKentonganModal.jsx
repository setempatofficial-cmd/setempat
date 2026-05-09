"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Sparkles, Bot, X, MapPin, Calendar, Info } from "lucide-react";

export default function AIKentonganModal({
  isOpen,
  onClose,
  kentongan,
  initialQuery,
  theme = { isMalam: true, card: "bg-zinc-950", border: "border-white/10" }
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef(null);
  const hasInitialized = useRef(false);
  const autoSentRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // 1. Core Send Function
  const handleSend = useCallback(async (forcedQuery = null) => {
    const msg = (forcedQuery || input).trim();
    if (!msg || isLoading) return;

    if (!forcedQuery) setInput("");
    
    setMessages(prev => [...prev, { id: Date.now(), role: "user", content: msg }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          kentonganId: kentongan?.id,
          modalType: 'kentongan',
        }),
      });
      const data = await res.json();
      
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: "assistant",
        content: data?.text || "Maaf, Cak. AI-nya lagi istirahat sebentar. Coba lagi ya!"
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: "assistant",
        content: "Waduh, koneksi ke pusat informasi lagi terputus. 🙏"
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, kentongan]);

  // 2. Initialize Greeting (Layout Visual Keren)
  useEffect(() => {
    if (!isOpen || !kentongan || hasInitialized.current) return;
    hasInitialized.current = true;

    // Pesan pertama berupa objek khusus agar bisa di-render dengan layout foto
    setMessages([{
      id: "init",
      role: "assistant",
      type: "news_card", // Tipe khusus untuk render layout berita
      data: {
        title: kentongan.title,
        content: kentongan.content,
        image: kentongan.image_url,
        isUrgent: kentongan.is_urgent,
        location: kentongan.target_desa || "Wilayah Setempat",
        time: new Date(kentongan.created_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })
      }
    }]);
  }, [isOpen, kentongan]);

  // 3. Auto-Send Logic
  useEffect(() => {
    if (initialQuery && isOpen && hasInitialized.current && !autoSentRef.current) {
      autoSentRef.current = true;
      const timer = setTimeout(() => handleSend(initialQuery), 800);
      return () => clearTimeout(timer);
    }
  }, [initialQuery, isOpen, handleSend]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2000] flex items-end justify-center sm:items-center bg-black/80 backdrop-blur-md p-0 sm:p-4" onClick={onClose}>
        <motion.div 
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          className={`relative w-full max-w-[420px] h-[90vh] sm:h-[650px] ${theme.card} border-t sm:border ${theme.border} sm:rounded-[32px] flex flex-col overflow-hidden shadow-2xl`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header High-End */}
          <div className="p-4 border-b border-white/5 bg-zinc-900/50 flex items-center justify-between backdrop-blur-md">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                  <Bot className="text-red-500" size={22} />
                </div>
                <div>
                  <h2 className="text-white font-black text-[12px] tracking-[0.15em] flex items-center gap-2">
                    AI KENTONGAN <Sparkles size={12} className="text-amber-400" />
                  </h2>
                  <p className="text-[10px] text-white/40 font-bold uppercase truncate max-w-[180px]">
                    {kentongan?.title}
                  </p>
                </div>
             </div>
             <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
               <X size={18} className="text-white/40" />
             </button>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide bg-gradient-to-b from-zinc-950 to-black">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.type === "news_card" ? (
                  /* RENDER LAYOUT BERITA DENGAN FOTO */
                  <div className="w-full space-y-4">
                    <div className="bg-white/5 border border-white/10 rounded-[24px] overflow-hidden">
                      {msg.data.image && (
                        <div className="relative h-48 w-full">
                          <img src={msg.data.image} alt="news" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
                          {msg.data.isUrgent && (
                            <div className="absolute top-3 left-3 bg-red-600 text-[10px] font-black px-2 py-1 rounded-md text-white">URGENT</div>
                          )}
                        </div>
                      )}
                      <div className="p-4 space-y-3">
                        <h3 className="text-white font-bold text-lg leading-tight">{msg.data.title}</h3>
                        <div className="flex flex-wrap gap-3 text-[11px] text-white/40 font-medium">
                          <span className="flex items-center gap-1"><MapPin size={12} /> {msg.data.location}</span>
                          <span className="flex items-center gap-1"><Calendar size={12} /> {msg.data.time}</span>
                        </div>
                        <p className="text-white/70 text-sm leading-relaxed border-t border-white/5 pt-3">
                          {msg.data.content}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-amber-400 bg-amber-400/5 p-3 rounded-xl border border-amber-400/10">
                      <Info size={16} className="shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-tight font-medium">Saya sudah menganalisa laporan ini. Silakan tanya jika butuh info dampak, bantuan, atau kronologi lengkap.</p>
                    </div>
                  </div>
                ) : (
                  /* RENDER BUBBLE CHAT BIASA */
                  <div className={`max-w-[85%] p-4 rounded-[22px] text-sm leading-relaxed shadow-lg ${
                    msg.role === "user" 
                    ? "bg-red-600 text-white rounded-tr-none shadow-red-600/10" 
                    : "bg-white/5 text-white/90 border border-white/10 rounded-tl-none"
                  }`}>
                    {msg.content}
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 p-3.5 rounded-[20px] rounded-tl-none">
                  <div className="flex gap-1.5">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-zinc-900/80 border-t border-white/5 backdrop-blur-md">
            <div className="flex gap-2">
              <input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Tanya detail laporan..."
                className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-white text-sm outline-none focus:border-red-500/50 transition-all placeholder:text-white/20"
              />
              <button 
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                className="p-3.5 bg-red-600 rounded-2xl text-white shadow-lg shadow-red-600/20 disabled:opacity-30 transition-all"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
            <p className="text-[9px] text-center text-white/20 mt-3 font-black tracking-[0.2em] uppercase">Setempat Intelligence System</p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}