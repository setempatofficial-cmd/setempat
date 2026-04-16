"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";
import { useDataContext } from "@/contexts/DataContext";
import LaporPanel from "./LaporPanel";

// ── Helper Functions ─────────────────────────────────────────────────────────
const getCurrentTimeTag = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "pagi";
  if (h >= 11 && h < 15) return "siang";
  if (h >= 15 && h < 18) return "sore";
  return "malam";
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "Selamat pagi";
  if (h >= 11 && h < 15) return "Selamat siang";
  if (h >= 15 && h < 18) return "Selamat sore";
  return "Selamat malam";
};

const getRandomEmoji = () => {
  const emojis = ["😊", "👋", "🤗", "🏘️", "🌳", "🚶", "☕", "🍜", "📢", "👥"];
  return emojis[Math.floor(Math.random() * emojis.length)];
};

const isLaporIntent = (text) => {
  const lower = text.toLowerCase();
  const keywords = ["lapor", "kirim", "upload", "foto", "report", "posting", "mau cerita", "ceritain"];
  return keywords.some(k => lower.includes(k));
};

// 🔥 FUNGSI RINGKASAN DARI DATA CARD (TANPA AJAKAN KETIK IYA)
const generateRingkasanDariData = (reports, stats, tempatName, jarak) => {
  const hasLaporan = reports.length > 0;
  const waktuTag = getCurrentTimeTag();
  const greeting = getGreeting();
  const emoji = getRandomEmoji();
  
  if (!hasLaporan) {
    return `${greeting}, Lur! ${emoji}\n\nBelum ada laporan terbaru di **${tempatName}**${jarak ? ` (${jarak} dari sini)` : ''}.\n\n**📸 Yuk jadi yang pertama lapor!**`;
  }
  
  const latest = reports[0];
  const kondisi = latest.tipe === 'Sepi' ? 'sepi' : latest.tipe === 'Ramai' ? 'ramai' : latest.tipe === 'Antri' ? 'ada antrian' : 'normal';
  const estimasi = latest.estimated_people ? ` sekitar ${latest.estimated_people} orang` : '';
  const cerita = latest.deskripsi || latest.content;
  const userName = latest.user_name?.split(' ')[0] || 'Warga';
  
  let ringkasan = `${greeting}, Lur! ${emoji}\n\n`;
  ringkasan += `📍 **${tempatName}**${jarak ? ` (${jarak} dari sini)` : ''}\n`;
  ringkasan += `🕐 ${waktuTag} ini kondisi **${kondisi}**${estimasi}.\n\n`;
  
  if (cerita) {
    ringkasan += `🗣️ **Cerita terbaru dari @${userName}**:\n"${cerita.substring(0, 100)}${cerita.length > 100 ? '...' : ''}"\n\n`;
  }
  
  if (stats.total > 1) {
    ringkasan += `📊 **Hari ini**: ${stats.total} laporan (${stats.ramai} ramai, ${stats.sepi} sepi, ${stats.antri} antri)\n\n`;
  }
  
  ringkasan += `**📢 Ada yang mau kamu ceritakan tentang ${tempatName}?**`;
  
  return ringkasan;
};

// 🔥 QUICK ACTIONS DINAMIS
const getQuickActionsByCategory = (category, hasLaporan) => {
  const categoryLower = category?.toLowerCase() || '';
  
  const baseActions = [
    { label: "🍃 Kondisi", query: "Kondisi di sini gimana?" },
    { label: "🌧️ Cuaca", query: "Cuaca di sana gimana?" },
    { label: "🕐 Jam Buka", query: "Jam buka di sini jam berapa?" },
  ];
  
  let categoryActions = [];
  
  if (categoryLower.includes('kuliner') || categoryLower.includes('cafe')) {
    categoryActions = [
      { label: "🍽️ Rekomendasi", query: "Menu rekomendasi di sini apa?" },
      { label: "⏰ Jam Ramai", query: "Jam berapa biasanya ramai?" },
    ];
  } 
  else if (categoryLower.includes('wisata') || categoryLower.includes('taman')) {
    categoryActions = [
      { label: "🎟️ Tiket", query: "Berapa harga tiket masuk?" },
      { label: "⏰ Jam Buka", query: "Jam buka sampai jam berapa?" },
    ];
  }
  else if (categoryLower.includes('jalan') || categoryLower.includes('simpang')) {
    categoryActions = [
      { label: "🚗 Lalin", query: "Lalu lintas di sini gimana?" },
      { label: "🚦 Macet", query: "Sekitar sini macet?" },
    ];
  }
  else {
    categoryActions = [
      { label: "👥 Ramai?", query: "Sekitar sini ramai?" },
      { label: "⏳ Antrian?", query: "Ada antrian?" },
    ];
  }
  
  if (hasLaporan) {
    categoryActions.unshift({ label: "📢 Cerita Terbaru", query: "Apa cerita warga terbaru?" });
  }
  
  return [...baseActions, ...categoryActions].slice(0, 6);
};

// ── MAIN AIMODAL ──────────────────────────────────────────────────────────────
export default function AIModal({
  isOpen,
  onClose,
  tempat,
  onOpenAuthModal,
  onUploadSuccess,
  initialQuery,
  item,
  theme = { isMalam: false, card: "bg-white", border: "border-gray-100", text: "text-gray-900" },
  locationName = "",
  distance = null
}) {
  const { user } = useAuth();
  const { getAIContext } = useDataContext();
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showLaporPanel, setShowLaporPanel] = useState(false);
  
  const [freshReports, setFreshReports] = useState([]);
  const [freshStats, setFreshStats] = useState(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  
  const modalRef = useRef(null);
  const messagesEndRef = useRef(null);
  const hasInitialized = useRef(false);
  const messageCounter = useRef(0);
  
  // 🔥 Stabilkan getAIContext dengan ref
  const getAIContextRef = useRef(getAIContext);
  useEffect(() => {
    getAIContextRef.current = getAIContext;
  }, [getAIContext]);
  
  const activeItem = item || tempat;
  const activeLocationName = locationName || tempat?.name || "Sekitar";
  const jarak = distance || (activeItem?.distance ? `${activeItem.distance.toFixed(1)} km` : null);
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
  
  const fetchFreshLaporan = useCallback(async (tempatId) => {
    if (!tempatId) return;
    try {
      const { data, error } = await supabase
        .from('laporan_warga')
        .select('*')
        .eq('tempat_id', tempatId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setFreshReports(data || []);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayData = (data || []).filter(l => new Date(l.created_at) >= today);
      setFreshStats({
        total: todayData.length,
        ramai: todayData.filter(l => l.tipe === 'Ramai').length,
        sepi: todayData.filter(l => l.tipe === 'Sepi').length,
        antri: todayData.filter(l => l.tipe === 'Antri').length,
      });
    } catch (err) {
      console.error('Gagal fetch laporan terbaru:', err);
      const contextData = getAIContextRef.current(tempatId);
      setFreshReports(contextData?.recentReports || []);
      setFreshStats(contextData?.todayStats || null);
    }
  }, []);
  
  useEffect(() => {
    if (isOpen && activeItem?.id) {
      fetchFreshLaporan(activeItem.id);
    }
  }, [isOpen, activeItem?.id, fetchFreshLaporan]);
  
  const quickActions = useMemo(() => {
    const hasLaporan = (freshStats?.total || 0) > 0;
    return getQuickActionsByCategory(activeItem?.category, hasLaporan);
  }, [activeItem?.category, freshStats?.total]);
  
  // 🔥 OPENING MESSAGE - LANGSUNG DENGAN TOMBOL LAPOR
  useEffect(() => {
    if (!isOpen || !activeItem?.id) return;
    if (hasInitialized.current) return;
    
    hasInitialized.current = true;
    
    const reports = freshReports.length > 0 ? freshReports : getAIContextRef.current(activeItem.id)?.recentReports || [];
    const stats = freshStats || getAIContextRef.current(activeItem.id)?.todayStats || { total: 0, ramai: 0, sepi: 0, antri: 0 };
    
    let ringkasan = generateRingkasanDariData(reports, stats, activeItem.name, jarak);
    
    setMessages([{
      id: getUniqueId(),
      type: "ai",
      isOpening: true,
      text: ringkasan,
      showLaporButton: true,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);
    
  }, [isOpen, activeItem?.id, freshReports, freshStats, jarak, getUniqueId]);
  
  // Modal open/close
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setTranslateY(0);
      setShowLaporPanel(false);
      hasInitialized.current = false;
      setMessages([]);
      setFreshReports([]);
      setFreshStats(null);
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
  
  const triggerLapor = () => {
    if (!user) { 
      onClose(); 
      setTimeout(() => onOpenAuthModal?.(), 300); 
      return; 
    }
    setShowLaporPanel(true);
  };
  
  const handleLaporSuccess = (newLaporan) => {
    setShowLaporPanel(false);
    
    setMessages(prev => [...prev, {
      id: getUniqueId(),
      type: "ai",
      text: `✅ Mantap! Cerita kamu sudah masuk. Makasih ya! 🎉\n\n📢 Ada yang mau ditanyakan lagi?`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);
    
    if (newLaporan?.tempat_id === activeItem?.id) {
      setFreshReports(prev => [newLaporan, ...prev.filter(r => r.id !== newLaporan.id)].slice(0, 20));
      setFreshStats(prev => ({
        ...prev,
        total: (prev?.total || 0) + 1,
        [newLaporan.tipe === 'Ramai' ? 'ramai' : newLaporan.tipe === 'Sepi' ? 'sepi' : 'antri']: (prev?.[newLaporan.tipe === 'Ramai' ? 'ramai' : newLaporan.tipe === 'Sepi' ? 'sepi' : 'antri'] || 0) + 1
      }));
    }
    
    onUploadSuccess?.(newLaporan);
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
    
    if (isLaporIntent(msg)) {
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, {
          id: getUniqueId(),
          type: "ai",
          showLaporButton: true,
          text: `Siap! Langsung aja ceritain kondisi di sana. 👇`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }]);
        if (user) triggerLapor();
      }, 500);
      return;
    }
    
    try {
      const contextReports = freshReports.slice(0, 5);
      
      // 🔥 PERBAIKAN: Kirim data lengkap termasuk kode_wilayah
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          context: { laporanTerbaru: contextReports },
          tempat: activeItem ? { 
            id: activeItem.id, 
            name: activeItem.name, 
            category: activeItem.category,
            kode_wilayah: activeItem.kode_wilayah || null  // ✅ TAMBAHKAN INI
          } : null,
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: getUniqueId(),
        type: "ai",
        text: data?.text || `Maaf, saya belum bisa menjawab pertanyaan itu. Coba tanya tentang kondisi atau cuaca ya! 😊`,
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
  }, [input, user, activeItem, freshReports, getUniqueId]);
  
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
        <div className="flex justify-center pt-2 pb-1 flex-shrink-0"><div className="w-12 h-1.5 bg-gray-200 rounded-full" /></div>
        
        <div className={`flex-shrink-0 px-4 py-3 border-b ${theme?.border || 'border-gray-100'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                <span className="text-xl">🤖</span>
              </div>
              <div>
                <h2 className={`text-[15px] font-bold ${theme?.text || 'text-gray-900'}`}>AKAMSI AI</h2>
                <p className={`text-[11px] ${isMalam ? 'text-gray-400' : 'text-gray-500'}`}>{activeLocationName}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">✕</button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex items-start gap-2 ${msg.type === "user" ? "flex-row-reverse" : ""}`}>
              {msg.type === "ai" && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <span className="text-sm">🤖</span>
                </div>
              )}
              <div className={`max-w-[85%] px-4 py-2.5 shadow-sm rounded-2xl ${
                msg.type === "user"
                  ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-tr-sm"
                  : isMalam ? "bg-white/10 text-white rounded-tl-sm" : "bg-gray-100 text-gray-900 rounded-tl-sm"
              }`}>
                <p className="text-[13px] whitespace-pre-line leading-relaxed">{msg.text}</p>
                {msg.showLaporButton && !showLaporPanel && (
                  <button 
                    onClick={triggerLapor} 
                    className="mt-3 w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wider shadow-sm hover:shadow-md transition-all"
                  >
                    📸 Laporkan Sekarang
                  </button>
                )}
                <p className={`text-[10px] mt-1 ${msg.type === "user" ? "text-white/60" : "text-gray-400"}`}>{msg.time}</p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                <span className="text-sm">🤖</span>
              </div>
              <div className="px-4 py-2.5 rounded-2xl bg-gray-100 text-gray-900 rounded-tl-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <AnimatePresence>
          {showLaporPanel && (
            <LaporPanel
              mode="media"
              tempat={tempat}
              onClose={() => setShowLaporPanel(false)}
              onSuccess={handleLaporSuccess}
              theme={theme}
            />
          )}
        </AnimatePresence>
        
        {!showLaporPanel && (
          <div className="flex-shrink-0 border-t border-gray-100 px-3 py-3">
            <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar pb-1">
              {quickActions.map((tag, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(tag.query)}
                  className={`px-3 py-2 rounded-full border border-gray-200 text-[10px] font-medium ${
                    isMalam ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                  } whitespace-nowrap transition-all`}
                >
                  {tag.label}
                </button>
              ))}
              <button
                onClick={triggerLapor}
                className="px-3 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[10px] font-bold whitespace-nowrap shadow-sm"
              >
                📸 Lapor
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 focus-within:ring-2 focus-within:ring-emerald-500/30">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Tanya kondisi, jam buka, atau langsung cerita..."
                  className="w-full bg-transparent text-[13px] text-gray-900 focus:outline-none"
                  onKeyPress={(e) => e.key === "Enter" && handleSend()}
                />
              </div>
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  input.trim() && !isTyping 
                    ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white" 
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                </svg>
              </button>
            </div>
            <p className="text-[8px] text-center text-slate-400 mt-2">✨ Tanya jam buka, cuaca, kondisi, atau langsung lapor</p>
          </div>
        )}
      </div>
    </div>
  );
}