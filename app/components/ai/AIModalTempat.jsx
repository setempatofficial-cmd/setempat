"use client";

import { Camera, X, Send, Loader2 } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/app/context/AuthContext";
import LaporPanel from "./LaporPanel";
import AIHeader from "./AIHeader";
import AIMessageBubble from "./AIMessageBubble";
import AIQuickActions from "./AIQuickActions";
import AIInput from "./AIInput";
import { getQuickActionsByCategory, getDynamicGreeting } from "./aiHelpers";

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
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const modalContentRef = useRef(null);
  const messagesEndRef = useRef(null);
  const hasInitialized = useRef(false);
  const startY = useRef(0);
  const lastTempatIdRef = useRef(null); // 

  const isMalam = theme?.isMalam;

  useEffect(() => { setIsClient(true); }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        scrollToBottom();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages, scrollToBottom, isTyping]);

  // 🔥 PERBAIKAN: Reset ketika tempat berubah
  useEffect(() => {
    if (tempat?.id && lastTempatIdRef.current !== tempat.id) {
      // Tempat berubah, reset initialized flag
      hasInitialized.current = false;
      lastTempatIdRef.current = tempat.id;
      // Kosongkan messages saat tempat berganti
      setMessages([]);
    }
  }, [tempat?.id]);

  // ========== INITIAL GREETING LOGIC (DIPERBAIKI) ==========
  useEffect(() => {
    if (!isClient || !isOpen || !tempat?.id) return;
    
    // 🔥 JIKA SUDAH INITIALIZED, JANGAN BUAT ULANG
    if (hasInitialized.current) return;
    
    // 🔥 TANDAI SUDAH INITIALIZED
    hasInitialized.current = true;

    // Ambil nama panggil (First name atau email part)
    const firstName = user?.display_name 
      ? user.display_name.split(' ')[0] 
      : user?.email 
        ? user.email.split('@')[0].split(/[._]/)[0].charAt(0).toUpperCase() + user.email.split('@')[0].split(/[._]/)[0].slice(1)
        : "";

    // Panggil helper yang sudah kita buat tadi
    const sambutan = getDynamicGreeting(
      tempat.name, 
      firstName, 
      weather, 
      activeReport
    );

    setMessages([{
      id: Date.now(),
      type: "ai",
      text: sambutan,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);

  }, [isClient, isOpen, tempat?.id, tempat?.name, weather, activeReport, user]);

  // ========== RESET KETIKA MODAL DITUTUP ==========
  useEffect(() => {
    if (!isOpen) {
      // Jangan reset hasInitialized di sini, biarkan untuk tempat yang sama
      // Tapi kosongkan messages
      setMessages([]);
    }
  }, [isOpen]);

  // ========== CHAT STRATEGY ==========
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

    try {
      let aiText = "";
      if (typeof window !== "undefined" && window.ai) {
        try {
          const session = await window.ai.createTextSession();
          aiText = await session.prompt(msg);
        } catch (e) { console.warn("Chrome AI skip"); }
      }

      if (!aiText) {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: msg,
            tempat: { id: tempat.id, name: tempat.name, category: tempat.category },
            context: { reports: reports.slice(0, 3), stats, weather }
          }),
        });
        const data = await res.json();
        aiText = data?.text || data?.reply;
      }

      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        type: "ai",
        text: aiText || "Maaf Cak, Setempat AI lagi 'ngopi' sebentar. Tanya lagi ya!",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, reports, stats, tempat, weather]);

  // ========== GESTURES & RENDER ==========
  const onTouchStart = (e) => {
    if (modalContentRef.current?.scrollTop <= 0) {
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

  if (!isOpen || !isClient || !tempat) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center sm:items-center p-0 sm:p-4 overflow-hidden">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: translateY }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={`relative w-full max-w-[440px] h-[90vh] sm:h-[650px] ${theme.card} rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden border-t ${theme.border}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex justify-center py-3 flex-shrink-0 cursor-grab active:cursor-grabbing">
          <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
        </div>

        <AIHeader locationName={tempat.name} isMalam={isMalam} onClose={onClose} theme={theme} />

        <div ref={modalContentRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-6 scrollbar-hide">
          {messages.map((msg) => (
            <AIMessageBubble 
              key={msg.id} 
              message={msg} 
              isUser={msg.type === "user"} 
              isMalam={isMalam} 
              onLaporClick={() => setShowLaporPanel(true)}
              onActionClick={handleSend} 
            />
          ))}
          {isTyping && (
            <div className="flex justify-start">
               <div className="bg-zinc-100 dark:bg-zinc-900/50 p-4 rounded-2xl rounded-bl-none">
                 <span className="flex gap-1.5">
                    <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" />
                 </span>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        <div className={`${isMalam ? 'bg-zinc-950' : 'bg-white'} border-t ${theme.border} pb-safe shadow-[0_-10px_20px_rgba(0,0,0,0.05)]`}>
          <AIQuickActions 
            actions={getQuickActionsByCategory(tempat?.category, stats.total > 0)} 
            onActionClick={handleSend} 
            onLaporClick={() => setShowLaporPanel(true)}
            isMalam={isMalam}
            isTyping={isTyping}
          />
          <AIInput 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onSend={() => handleSend()} 
            onLaporClick={() => setShowLaporPanel(true)}
            isTyping={isTyping}
            isMalam={isMalam}
          />
        </div>

        <AnimatePresence>
          {showLaporPanel && (
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="absolute inset-0 z-[100] bg-zinc-50 dark:bg-zinc-950 flex flex-col"
            >
              <div className="flex items-center justify-between p-5 border-b bg-white dark:bg-zinc-900 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#E3655B]/10 flex items-center justify-center">
                    <Camera size={16} className="text-[#E3655B]" />
                  </div>
                  <h3 className="font-black text-xs tracking-widest uppercase text-zinc-800 dark:text-zinc-100">Kirim Laporan</h3>
                </div>
                <button onClick={() => setShowLaporPanel(false)} className="text-[10px] font-black tracking-widest text-[#E3655B]">TUTUP</button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <LaporPanel 
                  tempat={tempat} 
                  user={user} 
                  onSuccess={(newLap) => {
                    setShowLaporPanel(false);
                    onUploadSuccess?.(newLap);
                    setMessages(prev => [...prev, { 
                      id: Date.now(), 
                      type: 'ai', 
                      text: `### Laporan Terkirim! 🙌\n\nTerima kasih kontribusinya. Laporan kamu sudah muncul di timeline warga.` 
                    }]);
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