"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
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

const generateFallbackResponse = (laporanWarga, tempatName) => {
  const latest = laporanWarga?.[0];
  if (latest) {
    const kondisi = latest.tipe === 'Sepi' ? 'sepi' : latest.tipe === 'Ramai' ? 'ramai' : 'ada antrian';
    const estimasi = latest.estimated_people ? ` sekitar ${latest.estimated_people} orang` : '';
    return `Dari laporan warga, kondisi di ${tempatName || 'sini'} sedang ${kondisi}${estimasi}. ${latest.deskripsi || ''}`;
  }
  return `Belum ada laporan untuk ${tempatName || 'tempat ini'}. Kamu bisa jadi yang pertama cerita! 📸`;
};

// ── MAIN AIMODAL (REVISI FINAL) ──────────────────────────────────────────────
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
  
  // Data fresh dari Supabase
  const [freshReports, setFreshReports] = useState([]);
  const [freshStats, setFreshStats] = useState(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  
  const modalRef = useRef(null);
  const messagesEndRef = useRef(null);
  const hasInitialized = useRef(false);
  const messageCounter = useRef(0);
  
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
  
  // Fetch data langsung dari Supabase setiap modal terbuka atau tempat berubah
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
      
      // Hitung statistik hari ini
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
      // Fallback ke context jika gagal
      const contextData = getAIContext(tempatId);
      setFreshReports(contextData?.recentReports || []);
      setFreshStats(contextData?.todayStats || null);
    }
  }, [getAIContext]);
  
  // Panggil fetch setiap modal terbuka
  useEffect(() => {
    if (isOpen && activeItem?.id) {
      fetchFreshLaporan(activeItem.id);
    }
  }, [isOpen, activeItem?.id, fetchFreshLaporan]);
  
  // 🔥 Generate opening message (dengan atau tanpa initialQuery)
  useEffect(() => {
    if (!isOpen || !activeItem?.id) return;
    if (hasInitialized.current) return;
    
    hasInitialized.current = true;
    
    // Gunakan data fresh (lebih update) atau fallback ke context
    const reports = freshReports.length > 0 ? freshReports : getAIContext(activeItem.id)?.recentReports || [];
    const stats = freshStats || getAIContext(activeItem.id)?.todayStats || { total: 0, ramai: 0, sepi: 0, antri: 0 };
    const hasLaporan = stats.total > 0;
    const suasana = hasLaporan 
      ? `ada ${stats.total} laporan hari ini.`
      : "belum ada laporan hari ini.";
    
    // 🔥 Jika ada initialQuery dan bukan "quick_lapor", buat jawaban langsung di pesan pembuka
    if (initialQuery && initialQuery !== "quick_lapor") {
      let jawabanAwal = `🤖 Jika kamu tanya: "${initialQuery}"\n\n`;
      
      const qLower = initialQuery.toLowerCase();
      if (qLower.includes("alternatif") || qLower.includes("jalur")) {
        jawabanAwal += `Dari pantauan, kondisi di **${activeItem.name}** sedang ${suasana}. Saran saya cek jalur alternatif via Google Maps atau Waze. Ada yang updatekah?`;
      } 
      else if (qLower.includes("ramai") || qLower.includes("macet")) {
        const latestReport = reports[0];
        const detail = latestReport?.deskripsi ? `\n🗣️ Warga melaporkan: "${latestReport.deskripsi.substring(0, 100)}"` : "";
        jawabanAwal += `Saat ini ${activeItem.name} sedang ramai.${detail}\n\nAda yang ingin dibagikan kondisi terbarunya?`;
      }
      else if (qLower.includes("antri") || qLower.includes("antrian")) {
        jawabanAwal += `Berdasarkan laporan, antrean di ${activeItem.name} ${suasana}. Mau saya bantu cek waktu terbaik?`;
      }
      else {
        jawabanAwal += `Berdasarkan data terkini, ${suasana} ${reports.length > 0 ? `Contoh cerita: "${reports[0].deskripsi?.substring(0, 80)}"` : "Belum ada laporan detail."}`;
        jawabanAwal += `\n\nMau berbagi cerita? 😊`;
      }
      
      setMessages([{
        id: getUniqueId(),
        type: "ai",
        isOpening: true,
        text: jawabanAwal,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
      return;
    }
    
    // Jika tidak ada initialQuery, gunakan opening message normal
    let message = `${getGreeting()}, Lur! ${getRandomEmoji()}\n\n`;
    message += `Ngomong-ngomong soal **${activeItem.name}** nih, `;
    if (jarak) message += `sekitar ${jarak} dari sini. `;
    message += `${getCurrentTimeTag()} ini ${suasana} `;
    
    if (reports.length > 0) {
      const latest = reports[0];
      const cerita = latest.deskripsi || latest.content;
      if (cerita) message += `\n\n🗣️ **Cerita warga**: "${cerita.substring(0, 100)}..."`;
    } else {
      message += `\n\n📢 Belum ada cerita dari warga nih. Jadi yang pertama cerita yuk!`;
    }
    message += `\n\nAda yang mau ditanyain? 😊`;
    
    setMessages([{
      id: getUniqueId(),
      type: "ai",
      isOpening: true,
      text: message,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);
    
  }, [isOpen, activeItem?.id, freshReports, freshStats, getAIContext, jarak, getUniqueId, initialQuery]);
  
  // Modal open/close dan reset state
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      if (initialQuery === "quick_lapor") {
        setShowLaporPanel(true);
        // Jika langsung lapor, beri pesan sapa singkat
        if (!hasInitialized.current) {
          hasInitialized.current = true;
          setMessages([{
            id: getUniqueId(),
            type: "ai",
            text: "Siap! Yuk ceritakan kondisi di sini 📸",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }]);
        }
      }
    } else {
      document.body.style.overflow = "";
      setTranslateY(0);
      setShowLaporPanel(false);
      hasInitialized.current = false;
      setMessages([]); // reset chat history saat tutup
      setFreshReports([]);
      setFreshStats(null);
    }
  }, [isOpen, initialQuery, getUniqueId]);
  
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
  
  const handleTanya = () => {
    // Gunakan data fresh terbaru
    const latest = freshReports[0] || getAIContext(activeItem?.id)?.recentReports?.[0];
    const kondisi = latest?.tipe === 'Ramai' ? 'ramai' : latest?.tipe === 'Antri' ? 'ada antrian' : 'sepi';
    const estimasi = latest?.estimated_people ? ` sekitar ${latest.estimated_people} orang` : '';
    
    setMessages(prev => [...prev, {
      id: getUniqueId(),
      type: "user",
      text: "🍃 Pengen tahu kondisi sekitar sini",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }]);
    
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: getUniqueId(),
        type: "ai",
        text: `Dari laporan warga, kondisi di ${activeItem?.name || 'sini'} sedang ${kondisi}${estimasi}. Mau tahu lebih detail?`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }]);
      setIsTyping(false);
    }, 600);
  };
  
  const handleLapor = () => {
    setMessages(prev => [...prev, {
      id: getUniqueId(),
      type: "user",
      text: "📸 Mau cerita kondisi terkini",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }]);
    setTimeout(triggerLapor, 400);
  };
  
  const handleLaporSuccess = (newLaporan) => {
    setShowLaporPanel(false);
    setMessages(prev => [...prev, {
      id: getUniqueId(),
      type: "ai",
      text: `✅ Mantap! Cerita kamu sudah masuk. Makasih ya! 🎉`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);
    // Refresh data lokal agar langsung terlihat
    if (newLaporan?.tempat_id === activeItem?.id) {
      setFreshReports(prev => [newLaporan, ...prev.filter(r => r.id !== newLaporan.id)].slice(0, 20));
      // Update stats sederhana
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
      // Gunakan data fresh untuk konteks
      const contextReports = freshReports.slice(0, 5);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          context: { laporanTerbaru: contextReports },
          tempat: activeItem ? { id: activeItem.id, name: activeItem.name } : null,
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: getUniqueId(),
        type: "ai",
        text: data?.text || generateFallbackResponse(contextReports, activeItem?.name),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }]);
    } catch (error) {
      console.error("API Error:", error);
      setMessages(prev => [...prev, {
        id: getUniqueId(),
        type: "ai",
        text: generateFallbackResponse(freshReports, activeItem?.name),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [input, user, activeItem, freshReports, getUniqueId]);
  
  const quickActions = [
    { label: "🍃 Kondisi", query: "Kondisi di sini gimana?" },
    { label: "👥 Antrian?", query: "Ada antrian nggak?" },
    { label: "🚶 Ramai?", query: "Sekitar sini ramai nggak?" },
    { label: "🌧️ Cuaca", query: "Cuaca di sana gimana?" },
    { label: "📢 Cerita", query: "Ada cerita dari warga?" },
  ];
  
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
                {msg.isOpening && !initialQuery && (
                  <div className="mt-3 flex flex-col gap-2">
                    <button onClick={handleTanya} className="w-full py-2.5 bg-white border-2 border-gray-200 rounded-xl text-[11px] font-black uppercase tracking-wider text-gray-700">
                      💬 Pengen Tahu Kondisi
                    </button>
                    <button onClick={handleLapor} className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wider">
                      📸 Ceritakan Kondisi
                    </button>
                  </div>
                )}
                {msg.showLaporButton && !showLaporPanel && (
                  <button onClick={triggerLapor} className="mt-2 w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wider">
                    📸 Ceritakan Sekarang
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
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 focus-within:ring-2 focus-within:ring-emerald-500/30">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Tanya kondisi atau cerita..."
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
            <p className="text-[8px] text-center text-slate-400 mt-2">✨ Ketik "mau lapor" untuk berbagi cerita</p>
          </div>
        )}
      </div>
    </div>
  );
}