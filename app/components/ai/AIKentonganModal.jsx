// app/components/ai/AIKentonganModal.jsx (AUTO-SCROLL SETELAH INTERAKSI SAJA)

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
  const hasUserInteracted = useRef(false); // 🔥 FLAG untuk cek apakah user sudah interaksi
  
  const isMalam = theme?.isMalam;
  
  const getUniqueId = useCallback(() => {
    messageCounter.current += 1;
    return `${Date.now()}-${messageCounter.current}`;
  }, []);
  
  // 🔥 FUNGSI AUTO-SCROLL KE PESAN TERBARU (hanya jika user sudah interaksi)
  const scrollToBottom = useCallback(() => {
    // Hanya scroll jika user sudah pernah interaksi (mengirim pesan)
    if (!hasUserInteracted.current) return;
    
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ 
          behavior: "smooth", 
          block: "end" 
        });
      }
    }, 100);
  }, []);

  // Auto-scroll setiap kali ada perubahan messages atau isTyping (tapi cek flag)
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);
  
  // Opening message yang adaptif (Berita vs Pengumuman)
  useEffect(() => {
    if (!isOpen || !kentongan) return;
    if (hasInitialized.current) return;
    
    hasInitialized.current = true;
    hasUserInteracted.current = false; // 🔥 RESET flag saat modal baru dibuka

    const { title, content, image_url, is_urgent, created_at, is_global, target_desa, target_kecamatan } = kentongan;

    // 1. Identifikasi Mode: Jika ada gambar = Mode Berita, jika tidak = Mode Informasi
    const isNewsMode = !!image_url;
    
    // 2. Tentukan Label & Header
    const categoryLabel = is_urgent ? "🚨 BREAKING NEWS" : (isNewsMode ? "📰 KABAR SETEMPAT" : "📢 PENGUMUMAN RESMI");
    const thumbnail = isNewsMode ? `![thumbnail](${image_url})\n\n` : "";
    
    const locationInfo = is_global 
      ? "SetempatID" 
      : `${target_desa || '-'}, ${target_kecamatan || '-'}`;

    // 3. Rakit Pesan berdasarkan Mode
    let finalMessage = "";

    if (isNewsMode) {
      // FORMAT BERITA (Ada Foto)
      finalMessage = `${categoryLabel}
${thumbnail}
### ${title}

**${locationInfo}** — ${content}

---
✍️ **Laporan:** Tim Setempat
📅 **Rilis:** ${new Date(created_at).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}

---
💡 **Eksplorasi Berita:**
Tanya AI untuk detail kronologi atau dampak kejadian ini.`;
    } else {
      // FORMAT INFORMASI/SISTEM (Tanpa Foto - Lebih Clean)
      finalMessage = `${categoryLabel}

**${title}**

${content}

---
📍 **Lokasi:** ${locationInfo}
🕐 **Waktu Update:** ${new Date(created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
👑 **Oleh:** Petinggi Setempat

---
💬 Ada yang kurang jelas dari pengumuman ini? Silakan tanya di bawah.`;
    }

    setMessages([{
      id: getUniqueId(),
      type: "ai",
      text: finalMessage,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);
    
  }, [isOpen, kentongan, getUniqueId]);
  
  // 🔥 TOUCH HANDLERS
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
  
  // handleSend
  const handleSend = useCallback(async (customMessage) => {
    const msg = (customMessage || input).trim();
    if (!msg) return;
    
    // 🔥 SET FLAG bahwa user sudah mulai berinteraksi
    hasUserInteracted.current = true;
    
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
          kentonganId: kentongan?.id,
          modalType: 'kentongan',
          tempat: {
            id: kentongan?.tempat_id,
            name: kentongan?.tempat_name || kentongan?.source_name || "Desa",
            kode_wilayah: kentongan?.kode_wilayah
          }
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
            placeholder="Tanya tentang Informasi ini..."
          />
          <p className="text-[8px] text-center text-slate-400 mt-2">✨ Tanya detail pengumuman, dampak, atau instruksi lebih lanjut</p>
        </div>
      </div>
    </div>
  );
}