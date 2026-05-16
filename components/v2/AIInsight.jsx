"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAIInsight } from "@/hooks/useAIInsight";
import { RefreshCw, Volume2, VolumeX, AlertTriangle, Brain, Sparkles } from "lucide-react";

export default function AIInsight({ activeTempat, theme }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [displayedStory, setDisplayedStory] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [hasEmergency, setHasEmergency] = useState(false);
  const typingTimeoutRef = useRef(null);
  const speechRef = useRef(null);

  const { greeting, story, insightStats, isLoading, modelUsed, refresh } =
    useAIInsight(activeTempat);

  const isMalam = theme?.isMalam || false;

  // ============================================
  // 👇 TARUH FUNGSI INI DI SINI 👇
  // ============================================
  const cleanTextForSpeech = (text) => {
    if (!text) return '';

    return text
      // Hapus markdown bold/italic
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      // Hapus emoji dan icon
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticon
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Simbol & piktograf
      .replace(/[\u{2600}-\u{27BF}]/gu, '')   // Simbol (⭐, ☀️, dll)
      // Hapus username mention
      .replace(/@\w+/g, 'kata warga')
      // Hapus karakter khusus
      .replace(/[#*_~`>|]/g, '')
      // New line jadi spasi
      .replace(/\n/g, '. ')
      // Hapus multiple spaces
      .replace(/\s+/g, ' ')
      .trim();
  };
  // ============================================

  // Deteksi darurat dari story
  useEffect(() => {
    const emergencyIndicators = ['kecelakaan', 'darurat', 'peringatan', 'wargaa', 'kejadian serius', '🚨'];
    const hasEmergencyNow = emergencyIndicators.some(kw =>
      story?.toLowerCase().includes(kw.toLowerCase())
    );
    setHasEmergency(hasEmergencyNow);
  }, [story]);

  // Deteksi kondisi darurat dari isi narasi
  useEffect(() => {
    if (!story) return;
    const emergencyIndicators = ['kecelakaan', 'darurat', 'peringatan', 'wargaa', 'kejadian serius', '🚨', 'bahaya', 'kebakaran'];
    const hasEmergencyNow = emergencyIndicators.some(kw =>
      story.toLowerCase().includes(kw.toLowerCase())
    );
    setHasEmergency(hasEmergencyNow);
  }, [story]);

  // Efek Mesin Tik (Typing Effect)
  useEffect(() => {
    if (!story || isLoading) {
      setDisplayedStory("");
      return;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    setIsTyping(true);
    let index = 0;
    setDisplayedStory("");

    const typeNextChar = () => {
      if (index < story.length) {
        setDisplayedStory(story.slice(0, index + 1));
        index++;
        typingTimeoutRef.current = setTimeout(typeNextChar, 12);
      } else {
        setIsTyping(false);
      }
    };

    typeNextChar();

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [story, isLoading]);

  // Informasi Badge Model AI
  const modelBadge = useMemo(() => {
    switch (modelUsed) {
      case 'local':
        return { text: '⚡ Instant', color: 'bg-zinc-500/10 dark:bg-zinc-500/20 text-zinc-600 dark:text-zinc-400 border-zinc-500/20' };
      case 'groq-8b':
        return { text: '🧠 AI Smart', color: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
      case 'groq-70b':
        return { text: '✨ AI Pro', color: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/20' };
      default:
        return { text: '⚡ Instant', color: 'bg-zinc-500/10 dark:bg-zinc-500/20 text-zinc-600 dark:text-zinc-400 border-zinc-500/20' };
    }
  }, [modelUsed]);

  // Sistem Sintesis Suara (Text-to-Speech)
  // ============================================
  // FUNGSI HANDLESPEAK (pakai cleanTextForSpeech)
  // ============================================
  const handleSpeak = () => {
    if (!displayedStory || isSpeaking) return;

    // Hentikan yang sedang berjalan
    if (speechRef.current) {
      window.speechSynthesis.cancel();
    }

    // 🔥 BERSIHKAN TEKS SEBELUM DIBACAKAN
    const cleanGreeting = cleanTextForSpeech(greeting);
    const cleanStory = cleanTextForSpeech(displayedStory);

    const speechText = `${cleanGreeting}. ${cleanStory}`;

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = 'id-ID';
    utterance.rate = 0.85;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Cari suara Indonesia
    const voices = window.speechSynthesis.getVoices();
    const indonesianVoice = voices.find(v => v.lang === 'id-ID' && v.name.includes('Google'));
    if (indonesianVoice) utterance.voice = indonesianVoice;

    utterance.onstart = () => {
      setIsSpeaking(true);
      speechRef.current = utterance;
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      speechRef.current = null;
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      speechRef.current = null;
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleStopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    speechRef.current = null;
  };

  const handleRefresh = () => {
    setIsTyping(true);
    setDisplayedStory("");
    if (isSpeaking) handleStopSpeaking();
    refresh();
  };

  if (!activeTempat) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`mb-5 mx-2 rounded-[32px] overflow-hidden border backdrop-blur-xl shadow-xl transition-all duration-500 relative ${hasEmergency
        ? isMalam
          ? 'bg-red-950/20 border-red-500/30 shadow-red-500/5'
          : 'bg-red-50/60 border-red-200 shadow-red-500/5'
        : isMalam
          ? 'bg-zinc-900/40 border-white/5 shadow-black/20'
          : 'bg-white/80 border-black/5 shadow-zinc-200/50'
        }`}
    >
      {/* Dynamic Ambient Glow Behind Card */}
      <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl opacity-20 pointer-events-none rounded-full transition-colors duration-500 ${hasEmergency ? 'bg-red-500' : 'bg-emerald-400'
        }`} />

      {/* Konten Utama */}
      <div className="relative p-5">
        <div className="flex items-start gap-4">

          {/* Avatar AI Melingkar */}
          <div className="relative flex-shrink-0">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-md transition-all duration-300 relative overflow-hidden ${hasEmergency
              ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white animate-bounce'
              : 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white'
              }`}>
              {hasEmergency ? (
                <AlertTriangle size={20} className="animate-[pulse_1s_infinite]" />
              ) : isSpeaking ? (
                <Sparkles size={20} className="animate-spin" style={{ animationDuration: '3s' }} />
              ) : (
                <Brain size={20} />
              )}
            </div>

            {/* Indikator Status Aktif */}
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${isMalam ? 'border-zinc-900' : 'border-white'
              } ${hasEmergency ? 'bg-red-500' : 'bg-emerald-400'} ${!isLoading ? 'animate-pulse' : ''}`} />
          </div>

          {/* Kolom Informasi Status Header */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className={`text-[10px] font-black uppercase tracking-widest ${hasEmergency ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                {hasEmergency ? '🚨 Peringatan Setempat' : 'Warga AI Insight'}
              </h4>

              <span className={`text-[8px] font-bold px-2 py-0.5 rounded-md border ${modelBadge.color}`}>
                {modelBadge.text}
              </span>

              {isTyping && !isLoading && (
                <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-md bg-sky-500/10 text-sky-500 dark:text-sky-400 animate-pulse tracking-wide">
                  MEMBACA SITUASI...
                </span>
              )}
            </div>

            {/* Kalimat Sapaan */}
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div key="loading-greet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5">
                  <div className="h-4 w-40 bg-zinc-200 dark:bg-white/10 rounded-lg animate-pulse" />
                </motion.div>
              ) : (
                <motion.p
                  key="greeting-text"
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-xs font-bold mt-1 tracking-tight ${hasEmergency ? 'text-red-700 dark:text-red-300' : 'opacity-80'
                    }`}
                >
                  {greeting}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Tombol Aksi Kanan Atas */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/5">
            <button
              onClick={handleRefresh}
              disabled={isLoading || isTyping}
              className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all disabled:opacity-40"
              title="Refresh pantauan berita"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
            </button>

            {!isLoading && displayedStory && (
              <button
                onClick={isSpeaking ? handleStopSpeaking : handleSpeak}
                className={`p-1.5 rounded-lg active:scale-95 transition-all ${isSpeaking
                  ? 'bg-emerald-500 text-white'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
              >
                {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lapisan Teks Narasi Berita */}
      <AnimatePresence mode="wait">
        {!isLoading && displayedStory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="px-5 pb-4"
          >
            {/* Kotak Konten Utama */}
            <div className="relative">
              {/* Animasi Gelombang Audio saat Berbicara */}
              {isSpeaking && (
                <div className="flex items-center gap-0.5 mb-2 h-3 opacity-70">
                  <span className="w-0.5 h-full bg-emerald-500 rounded-full animate-[bounce_0.5s_infinite]" style={{ animationDelay: '0ms' }} />
                  <span className="w-0.5 h-3/4 bg-emerald-500 rounded-full animate-[bounce_0.5s_infinite]" style={{ animationDelay: '150ms' }} />
                  <span className="w-0.5 h-1/2 bg-emerald-500 rounded-full animate-[bounce_0.5s_infinite]" style={{ animationDelay: '300ms' }} />
                  <span className="w-0.5 h-full bg-emerald-500 rounded-full animate-[bounce_0.5s_infinite]" style={{ animationDelay: '75ms' }} />
                </div>
              )}

              <div
                className={`text-xs leading-relaxed font-medium tracking-wide ${isExpanded ? '' : 'line-clamp-3'
                  } ${hasEmergency ? 'text-zinc-900 dark:text-zinc-100' : 'opacity-70 dark:opacity-90'}`}
                style={{ whiteSpace: 'pre-line' }}
              >
                {displayedStory}
                {isTyping && (
                  <span className="inline-block w-1 h-3.5 bg-emerald-500 animate-[pulse_0.6s_infinite] ml-1 align-middle rounded-full" />
                )}
              </div>
            </div>

            {/* Tombol Ekspansi Selengkapnya */}
            {displayedStory.split('\n').length > 3 && !isTyping && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`text-[9px] font-black uppercase tracking-wider mt-3 flex items-center gap-0.5 hover:opacity-80 transition-all ${hasEmergency ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
              >
                {isExpanded ? 'Ringkas Informasi ↑' : 'Baca Selengkapnya ↓'}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State Skeleton */}
      {isLoading && (
        <div className="px-5 pb-5 pt-1">
          <div className="space-y-2.5">
            <div className="h-2.5 bg-zinc-200 dark:bg-white/5 rounded-full w-full" />
            <div className="h-2.5 bg-zinc-200 dark:bg-white/5 rounded-full w-11/12" />
            <div className="h-2.5 bg-zinc-200 dark:bg-white/5 rounded-full w-8/12" />
            <div className="flex gap-1.5 mt-3 pt-1">
              <div className="w-1.5 h-1.5 bg-emerald-500/40 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.6s' }} />
              <div className="w-1.5 h-1.5 bg-emerald-500/40 rounded-full animate-bounce" style={{ animationDelay: '150ms', animationDuration: '0.6s' }} />
              <div className="w-1.5 h-1.5 bg-emerald-500/40 rounded-full animate-bounce" style={{ animationDelay: '300ms', animationDuration: '0.6s' }} />
            </div>
          </div>
        </div>
      )}

      {/* Bar Statistik Laporan Interaktif */}
      {!isLoading && insightStats && insightStats.total_laporan > 0 && (
        <div className={`px-5 py-2.5 border-t flex items-center justify-between gap-4 ${isMalam ? 'border-white/5 bg-black/10' : 'border-black/5 bg-zinc-50/50'
          }`}>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-extrabold uppercase tracking-wider opacity-40 flex items-center gap-1">
              📊 {insightStats.total_laporan} Kontribusi Warga
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${hasEmergency ? 'bg-red-500 animate-ping' :
                insightStats?.avg_confidence > 0.7 ? 'bg-emerald-500' :
                  insightStats?.avg_confidence > 0.4 ? 'bg-amber-500' : 'bg-rose-400'
                }`} />
              <span className="text-[9px] font-extrabold uppercase tracking-wider opacity-50">
                {hasEmergency ? 'VALIDASI KRUSIAL' : `Akurasi Data ${Math.round((insightStats?.avg_confidence || 0) * 100)}%`}
              </span>
            </div>
          </div>
          <span className="text-[8px] opacity-30 font-bold">
            Pukul {new Date(insightStats.last_update).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
    </motion.div>
  );
}