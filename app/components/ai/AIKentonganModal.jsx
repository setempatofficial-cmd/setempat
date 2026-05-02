// app/components/ai/AIKentonganModal.jsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AIHeader from "./AIHeader";
import AIMessageBubble from "./AIMessageBubble";
import AISuggestionBubble from "./AISuggestionBubble";
import AIInput from "./AIInput";

export default function AIKentonganModal({
  isOpen,
  onClose,
  kentongan,
  theme = { isMalam: false, card: "bg-white", border: "border-gray-100", text: "text-gray-900" },
}) {
  // ========== STATES ==========
  const [messages, setMessages] = useState([]);
  const [currentSuggestions, setCurrentSuggestions] = useState(null);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  
  // ========== REFS ==========
  const modalRef = useRef(null);
  const messagesEndRef = useRef(null);
  const hasInitialized = useRef(false);
  const hasUserInteracted = useRef(false);
  const messageCounter = useRef(0);
  const kentonganIdRef = useRef(kentongan?.id);
  
  // ========== HELPER FUNCTIONS ==========
  const isMalam = theme?.isMalam;
  
  const getCurrentTime = useCallback(() => {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, []);
  
  const getUniqueId = useCallback(() => {
    messageCounter.current += 1;
    return `${Date.now()}-${messageCounter.current}`;
  }, []);
  
  // ========== SCROLL LOGIC ==========
  const scrollToBottom = useCallback(() => {
    if (!hasUserInteracted.current) return;
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
  }, []);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);
  
  // ========== GENERATE SUGGESTIONS ==========
  const generateDynamicSuggestions = useCallback((kentonganData) => {
    if (!kentonganData) return null;
    
    const { title, content, is_urgent, image_url } = kentonganData;
    const isNewsMode = !!image_url;
    
    let suggestions = [];
    const hasKorban = content?.match(/korban|meninggal|luka|terdampar/i);
    const hasKerugian = content?.match(/kerugian|rugi|milyar|juta/i);
    
    if (isNewsMode) {
      if (hasKorban) suggestions.push("Berapa jumlah korban jiwa?");
      if (hasKerugian) suggestions.push("Berapa estimasi kerugian materil?");
      suggestions.push("Kronologi kejadian ini?");
      suggestions.push("Bagaimana respons pihak terkait?");
    } else {
      if (title?.includes('darurat') || is_urgent) {
        suggestions.push("Apa yang harus dilakukan?");
        suggestions.push("Di mana lokasi aman terdekat?");
      } else {
        suggestions.push("Apa dampak ini bagi warga?");
        suggestions.push("Siapa yang bisa dihubungi untuk info lebih lanjut?");
      }
    }
    
    // Fallback jika tidak ada suggestion
    if (suggestions.length === 0) {
      suggestions = ["Ceritakan lebih detail tentang ini", "Apa yang perlu saya ketahui?"];
    }
    
    return {
      title: "💡 Yang mungkin ingin Anda tanyakan:",
      items: suggestions.slice(0, 3).map((s, i) => ({
        id: i,
        text: s,
        emoji: ["🔍", "📍", "💬"][i] || "✨"
      }))
    };
  }, []);
  
  // ========== TOUCH HANDLERS ==========
  const handleTouchStart = useCallback((e) => {
    if (modalRef.current?.scrollTop <= 0) {
      setIsDragging(true);
      setStartY(e.touches[0].clientY);
    }
  }, []);
  
  const handleTouchMove = useCallback((e) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 0) {
      e.preventDefault();
      setTranslateY(Math.min(diff, 200));
    }
  }, [isDragging, startY]);
  
  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      if (translateY > 50) {
        onClose();
      } else {
        setTranslateY(0);
      }
      setIsDragging(false);
    }
  }, [isDragging, translateY, onClose]);
  
  // ========== INITIALIZE MODAL ==========
  useEffect(() => {
    if (!isOpen || !kentongan) return;
    if (hasInitialized.current) return;
    
    hasInitialized.current = true;
    hasUserInteracted.current = false;
    
    // Update ref untuk kentongan ID
    kentonganIdRef.current = kentongan?.id;
    
    const { title, content, image_url, is_urgent, created_at, is_global, target_desa, target_kecamatan } = kentongan;
    
    const isNewsMode = !!image_url;
    const categoryLabel = is_urgent ? "🚨 BREAKING NEWS" : (isNewsMode ? "📰 KABAR SETEMPAT" : "📢 PENGUMUMAN RESMI");
    const thumbnail = isNewsMode ? `![thumbnail](${image_url})\n\n` : "";
    const locationInfo = is_global ? "SetempatID" : `${target_desa || 'Desa Setempat'}, ${target_kecamatan || 'Kecamatan'}`;
    
    const finalMessage = `${categoryLabel}\n${thumbnail}### ${title}\n\n**${locationInfo}** — ${content}\n\n---\n📅 ${new Date(created_at).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}\n${isNewsMode ? "✍️ Tim Setempat" : "👑 Petinggi Setempat"}`;
    
    setMessages([{ 
      id: getUniqueId(), 
      type: "ai", 
      text: finalMessage, 
      time: getCurrentTime() 
    }]);
    
    setCurrentSuggestions(generateDynamicSuggestions(kentongan));
  }, [isOpen, kentongan, getUniqueId, getCurrentTime, generateDynamicSuggestions]);
  
  // ========== HANDLE SEND ==========
  const handleSend = useCallback(async (customMessage) => {
    const msg = (customMessage || input).trim();
    if (!msg) return;
    
    hasUserInteracted.current = true;
    setCurrentSuggestions(null);
    
    setMessages(prev => [...prev, {
      id: getUniqueId(),
      type: "user",
      text: msg,
      time: getCurrentTime()
    }]);
    
    setInput("");
    setIsTyping(true);
    
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          kentonganId: kentonganIdRef.current,
          modalType: 'kentongan',
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: getUniqueId(),
        type: "ai",
        text: data?.text || `Maaf, saya belum bisa menjawab pertanyaan itu.`,
        time: getCurrentTime()
      }]);
    } catch (error) {
      console.error("API Error:", error);
      setMessages(prev => [...prev, {
        id: getUniqueId(),
        type: "ai",
        text: `Maaf, sedang ada gangguan. Coba lagi nanti ya! 🙏`,
        time: getCurrentTime()
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [input, getUniqueId, getCurrentTime]);
  
  // Reset ref when modal closes
  useEffect(() => {
    if (!isOpen) {
      hasInitialized.current = false;
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        ref={modalRef}
        className={`relative w-[95%] max-w-[420px] mx-auto h-[92vh] sm:h-[85vh] ${theme.card} rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border-t ${theme.border}`}
        style={{ 
          transform: `translateY(${translateY}px)`, 
          transition: isDragging ? "none" : "transform 0.4s cubic-bezier(0.2, 0.9, 0.4, 1.1)",
          touchAction: isDragging ? "none" : "auto"
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>
        
        <AIHeader locationName="Kabar Setempat" isMalam={isMalam} onClose={onClose} theme={theme} />
        
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
          
          <AnimatePresence>
            {currentSuggestions && !isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="pt-2"
              >
                <AISuggestionBubble
                  suggestions={currentSuggestions}
                  onSuggestionClick={(text) => handleSend(text)}
                />
              </motion.div>
            )}
          </AnimatePresence>
          
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="flex-shrink-0 border-t border-gray-100 dark:border-white/10 px-3 py-3">
          <AIInput
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (currentSuggestions) setCurrentSuggestions(null);
            }}
            onSend={() => handleSend()}
            isTyping={isTyping}
            placeholder="Tanya detail informasi..."
          />
          <p className="text-[8px] text-center text-slate-400 mt-2">
            ✨ Tanya detail kronologi, dampak, atau instruksi lebih lanjut
          </p>
        </div>
      </div>
    </div>
  );
}

// Typing Indicator Component
function TypingIndicator() {
  return (
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
  );
}