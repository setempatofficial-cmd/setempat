// app/components/ai/AIKentonganModal.jsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import AIHeader from "./AIHeader";
import AIMessageBubble from "./AIMessageBubble";
import AIInput from "./AIInput";

export default function AIKentonganModal({
  isOpen,
  onClose,
  kentongan,
  theme = { isMalam: false, card: "bg-white", border: "border-gray-100", text: "text-gray-900" },
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  
  const modalRef = useRef(null);
  const messagesEndRef = useRef(null);
  const hasInitialized = useRef(false);
  const messageCounter = useRef(0);
  
  const isMalam = theme?.isMalam;
  
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
  
  // Opening message untuk kentongan
  useEffect(() => {
    if (!isOpen || !kentongan) return;
    if (hasInitialized.current) return;
    
    hasInitialized.current = true;
    
    const urgentBadge = kentongan.is_urgent ? "⚠️ URGENT ⚠️\n\n" : "";
    const targetInfo = kentongan.is_global 
      ? "📢 Target: Semua Wilayah" 
      : `📍 Target: Desa ${kentongan.target_desa || '-'}, Kec. ${kentongan.target_kecamatan || '-'}`;
    
    const welcomeMessage = `📢 **Pengumuman Resmi**

${urgentBadge}**${kentongan.title}**

${kentongan.content}

---

${targetInfo}
🕐 Dikirim: ${new Date(kentongan.created_at).toLocaleString()}
👑 Oleh: Petinggi Setempat

---

💬 **Ada yang ingin kamu tanyakan tentang pengumuman ini?**`;
    
    setMessages([{
      id: getUniqueId(),
      type: "ai",
      text: welcomeMessage,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);
    
  }, [isOpen, kentongan, getUniqueId]);
  
  // Modal open/close
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setTranslateY(0);
      hasInitialized.current = false;
      setMessages([]);
    }
  }, [isOpen]);
  
  // Touch handlers
  const handleTouchStart = (e) => {
    if (modalRef.current?.scrollTop <= 0) { 
      setIsDragging(true); 
      setStartY(e.touches[0].clientY); 
    }
  };
  
  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 0) { 
      e.preventDefault(); 
      setTranslateY(Math.min(diff, 150)); 
    }
  };
  
  const handleTouchEnd = () => {
    if (isDragging) { 
      if (translateY > 80) onClose(); 
      else setTranslateY(0); 
      setIsDragging(false); 
    }
  };
  
  const handleSend = useCallback(async (customMessage) => {
    const msg = (customMessage || input).trim();
    if (!msg) return;
    
    setMessages(prev => [...prev, {
      id: getUniqueId(),
      type: "user",
      text: msg,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }]);
    setInput("");
    setIsTyping(true);
    
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          context: { type: "kentongan", kentongan: kentongan },
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: getUniqueId(),
        type: "ai",
        text: data?.text || `Maaf, saya belum bisa menjawab pertanyaan itu.`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }]);
    } catch (error) {
      console.error("API Error:", error);
      setMessages(prev => [...prev, {
        id: getUniqueId(),
        type: "ai",
        text: `Maaf, sedang ada gangguan. Coba lagi nanti ya! 🙏`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [input, kentongan, getUniqueId]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        ref={modalRef}
        className={`relative w-full max-w-md h-full sm:h-[90vh] ${theme?.card || 'bg-white'} rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col`}
        style={{ transform: `translateY(${translateY}px)`, transition: isDragging ? "none" : "transform 0.3s ease-out" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>
        
        <AIHeader locationName="Pengumuman Resmi" isMalam={isMalam} onClose={onClose} theme={theme} />
        
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg) => (
            <AIMessageBubble
              key={msg.id}
              message={msg}
              isUser={msg.type === "user"}
              isMalam={isMalam}
              onLaporClick={null}
              showLaporButton={false}
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
        
        <div className="flex-shrink-0 border-t border-gray-100 dark:border-white/10 px-3 py-3">
          <AIInput
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onSend={() => handleSend()}
            isTyping={isTyping}
            placeholder="Tanya tentang pengumuman ini..."
          />
          <p className="text-[8px] text-center text-slate-400 mt-2">✨ Tanya detail pengumuman, dampak, atau instruksi lebih lanjut</p>
        </div>
      </div>
    </div>
  );
}