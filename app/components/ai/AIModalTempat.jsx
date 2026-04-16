"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";
import { useDataContext } from "@/contexts/DataContext";
import LaporPanel from "./LaporPanel";
import AIHeader from "./AIHeader";
import AIMessageBubble from "./AIMessageBubble";
import AIQuickActions from "./AIQuickActions";
import AIInput from "./AIInput";
import { 
  isLaporIntent, 
  generateRingkasanDariData, 
  getQuickActionsByCategory 
} from "./aiHelpers";

export default function AIModalTempat({
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
  
  const getAIContextRef = useRef(getAIContext);
 
  const activeItem = item || tempat;
  const activeLocationName = locationName || tempat?.name || "Sekitar";
  const jarak = distance || (activeItem?.distance ? `${activeItem.distance.toFixed(1)} km` : null);
  const isMalam = theme?.isMalam;
  
  useEffect(() => {
    getAIContextRef.current = getAIContext;
  }, [getAIContext]);
  
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
      
      if (error) {
        console.warn('Supabase error:', error.message);
        const contextData = getAIContextRef.current(tempatId);
        setFreshReports(contextData?.recentReports || []);
        setFreshStats(contextData?.todayStats || null);
        return;
      }
      
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
      console.warn('Gagal fetch laporan terbaru:', err.message);
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
  
  // Opening message
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
            kode_wilayah: activeItem.kode_wilayah || null
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
        <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>
        
        <AIHeader locationName={activeLocationName} isMalam={isMalam} onClose={onClose} theme={theme} />
        
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg) => (
            <AIMessageBubble
              key={msg.id}
              message={msg}
              isUser={msg.type === "user"}
              isMalam={isMalam}
              onLaporClick={triggerLapor}
              showLaporButton={msg.showLaporButton}
            />
          ))}
          {isTyping && (
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                <span className="text-sm">🤖</span>
              </div>
              <div className="px-4 py-2.5 rounded-2xl bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white rounded-tl-sm">
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
              user={user}
              onClose={() => setShowLaporPanel(false)}
              onSuccess={handleLaporSuccess}
              onOpenAuthModal={onOpenAuthModal} 
              theme={theme}
            />
          )}
        </AnimatePresence>
        
        {!showLaporPanel && (
          <div className="flex-shrink-0 border-t border-gray-100 dark:border-white/10 px-3 py-3">
            <AIQuickActions 
              actions={quickActions}
              onActionClick={handleSend}
              onLaporClick={triggerLapor}
              isMalam={isMalam}
            />
            
            <AIInput
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onSend={() => handleSend()}
              isTyping={isTyping}
              placeholder="Tanya kondisi, jam buka, atau langsung cerita..."
            />
            
            <p className="text-[8px] text-center text-slate-400 mt-2">
              ✨ Tanya jam buka, cuaca, kondisi, atau langsung lapor
            </p>
          </div>
        )}
      </div>
    </div>
  );
}