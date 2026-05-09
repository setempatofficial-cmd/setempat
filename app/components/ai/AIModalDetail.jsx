"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, Sparkles, Bot } from "lucide-react";

export default function AIModalDetail({ isOpen, onClose, item, initialQuery }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const autoSentRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // 1. Fungsi Kirim Pesan (Gunakan useCallback agar stabil di useEffect)
  const handleSend = useCallback(async (forcedQuery = null) => {
    const userMessage = forcedQuery || input.trim();
    if (!userMessage || isLoading) return;
    
    if (!forcedQuery) setInput("");
    
    // Add user message
    setMessages(prev => [...prev, {
      id: Date.now(),
      role: "user",
      content: userMessage,
    }]);
    
    setIsLoading(true);
    
    try {
      // SINKRONISASI API: Gunakan endpoint /api/chat sesuai revisi sampeyan
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          tempat: {
            id: item.id,
            name: item.name,
            kode_wilayah: item.kode_wilayah || null,
          },
          modalType: "tempat", 
        }),
      });
      
      const data = await response.json();
      const reply = data.text || data.reply || "Aduh, koneksi AI-nya lagi macet, Cak. Coba lagi ya!";
      
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: "assistant",
        content: reply,
      }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: "assistant",
        content: "Maaf, terjadi kesalahan teknis. Silakan coba lagi nanti. 🙏",
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, item]);

  // 2. Initialize Greeting
  useEffect(() => {
    if (!isOpen || !item || hasInitialized) return;
    
    setHasInitialized(true);
    
    const greeting = `Halo! 👋 Saya AI Setempat.\n\nAda yang ingin kamu ketahui tentang **${item.name}**?\n\nSaya bisa bantu cek kondisi terkini, info menu, hingga driver terdekat. Tanyakan saja! 💬`;
    
    setMessages([{
      id: "greet",
      role: "assistant",
      content: greeting,
    }]);
  }, [isOpen, item, hasInitialized]);

  // 3. Auto-send Logic (The "Magic" part)
  useEffect(() => {
    // Pastikan modal buka, ada query, greeting sudah tampil, dan belum pernah dikirim otomatis
    if (initialQuery && isOpen && hasInitialized && !autoSentRef.current) {
      autoSentRef.current = true;
      
      // Delay sedikit agar user sempat baca greeting/melihat animasi modal
      const timer = setTimeout(() => {
        handleSend(initialQuery);
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [initialQuery, isOpen, hasInitialized, handleSend]);

  // 4. Reset on Close
  useEffect(() => {
    if (!isOpen) {
      setHasInitialized(false);
      autoSentRef.current = false;
      setMessages([]);
      setInput("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="relative w-full max-w-[420px] h-[85vh] sm:h-[600px] bg-zinc-950 border-t sm:border border-white/10 sm:rounded-[24px] overflow-hidden flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header High-End */}
          <div className="flex items-center justify-between p-4 border-b border-white/5 bg-zinc-900/50 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#E3655B]/10 flex items-center justify-center border border-[#E3655B]/20 shadow-[0_0_15px_rgba(227,101,91,0.2)]">
                <Bot size={20} className="text-[#E3655B]" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white flex items-center gap-2">
                  AI SETEMPAT <Sparkles size={12} className="text-amber-400" />
                </h2>
                <p className="text-[10px] text-white/40 font-bold truncate max-w-[150px] uppercase tracking-widest">{item?.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
              <X size={20} className="text-white/40" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-zinc-950 to-black scrollbar-hide">
            {messages.map((msg) => (
              <motion.div
                initial={{ opacity: 0, x: msg.role === "user" ? 10 : -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[85%] p-3.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#E3655B] text-white rounded-[20px] rounded-tr-none shadow-lg shadow-[#E3655B]/10"
                    : "bg-white/5 border border-white/10 text-white/90 rounded-[20px] rounded-tl-none"
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </motion.div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 p-3.5 rounded-[20px] rounded-tl-none">
                  <div className="flex gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#E3655B] rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-[#E3655B] rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 bg-[#E3655B] rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-zinc-900/80 border-t border-white/5 backdrop-blur-md">
            <div className="flex gap-2 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Tanya info ojek, cuaca, atau menu..."
                className="flex-1 px-5 py-3 bg-black/40 border border-white/10 rounded-2xl text-white text-sm outline-none focus:border-[#E3655B]/50 transition-all placeholder:text-white/20"
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                className="p-3 rounded-2xl bg-[#E3655B] text-white disabled:opacity-30 disabled:grayscale transition-all shadow-lg shadow-[#E3655B]/20"
              >
                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
            <p className="text-[9px] text-center text-white/20 mt-3 font-bold tracking-[0.2em] uppercase">Intelligence for {item?.name}</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}