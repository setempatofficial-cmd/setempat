"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from "framer-motion";
import { useAIInsight } from "@/hooks/useAIInsight";
import { RefreshCw, Volume2, VolumeX, AlertTriangle, Brain, Sparkles, Activity } from "lucide-react";

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
  // CLEAN TEXT FOR SPEECH SYSTEM
  // ============================================
  const cleanTextForSpeech = (text) => {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
      .replace(/[\u{2600}-\u{27BF}]/gu, '')
      .replace(/@\w+/g, 'kata warga')
      .replace(/[#*_~`>|]/g, '')
      .replace(/\n/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Deteksi darurat dari story
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

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    setIsTyping(true);
    let index = 0;
    setDisplayedStory("");

    const typeNextChar = () => {
      if (index < story.length) {
        setDisplayedStory(story.slice(0, index + 1));
        index++;
        typingTimeoutRef.current = setTimeout(typeNextChar, 10);
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
        return { text: '⚡ Instant', color: 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700/30' };
      case 'groq-8b':
        return { text: '🧠 AI Smart', color: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/30' };
      case 'groq-70b':
        return { text: '✨ AI Pro', color: 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900/30' };
      default:
        return { text: '⚡ Instant', color: 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700/30' };
    }
  }, [modelUsed]);

  // Sistem Text-to-Speech
  const handleSpeak = () => {
    if (!displayedStory || isSpeaking) return;

    if (speechRef.current) window.speechSynthesis.cancel();

    const cleanGreeting = cleanTextForSpeech(greeting);
    const cleanStory = cleanTextForSpeech(displayedStory);
    const speechText = `${cleanGreeting}. ${cleanStory}`;

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = 'id-ID';
    utterance.rate = 0.88;
    utterance.pitch = 1.0;

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

  // Cek apakah baris teks memerlukan expander berdasarkan panjang kalimat
  const textNeedsExpand = displayedStory && (displayedStory.length > 130 || displayedStory.split('\n').length > 2);

  if (!activeTempat) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`mb-5 mx-3 rounded-2xl border backdrop-blur-md shadow-sm transition-all duration-500 relative overflow-hidden
        ${hasEmergency
          ? isMalam
            ? 'bg-rose-950/20 border-rose-500/30 ring-1 ring-rose-500/10 shadow-rose-950/10'
            : 'bg-rose-50/50 border-rose-100 ring-1 ring-rose-500/5 shadow-rose-100/50'
          : isMalam
            ? 'bg-slate-900/40 border-slate-800/60 shadow-slate-950/20'
            : 'bg-white/60 border-slate-100 shadow-slate-100/40'
        }`}
    >
      {/* Background Ambient Glow Terkalibrasi */}
      <div className={`absolute top-0 right-0 w-28 h-28 blur-3xl opacity-15 pointer-events-none rounded-full transition-colors duration-500 
        ${hasEmergency ? 'bg-rose-500' : 'bg-teal-400'}`}
      />

      {/* Wadah Atas / Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3.5">

          {/* Sisi Kiri: Avatar + Info Judul */}
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {/* Lingkaran Avatar AI */}
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm shrink-0 transition-all duration-300 relative mt-0.5
              ${hasEmergency
                ? 'bg-gradient-to-br from-rose-500 to-red-600 text-white'
                : 'bg-slate-50 text-slate-600 border border-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700/60'
              }`}
            >
              {hasEmergency ? (
                <AlertTriangle size={15} />
              ) : isSpeaking ? (
                <Sparkles size={14} className="animate-spin text-emerald-500 dark:text-emerald-400" style={{ animationDuration: '4s' }} />
              ) : (
                <Brain size={15} className="text-slate-500 dark:text-slate-400" />
              )}

              {/* Ring Status */}
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 
                ${isMalam ? 'border-slate-900' : 'border-white'} 
                ${hasEmergency ? 'bg-rose-500' : 'bg-emerald-500'} 
                ${!isLoading ? 'animate-pulse' : ''}`}
              />
            </div>

            {/* Teks Header & Sapaan */}
            <div className="flex flex-col min-w-0 pt-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className={`text-[10px] font-black uppercase tracking-widest shrink-0 ${hasEmergency ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                  {hasEmergency ? '🚨 Kabar Krusial' : 'Warga AI Rangkuman'}
                </h4>
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 tracking-wide ${modelBadge.color}`}>
                  {modelBadge.text}
                </span>
              </div>

              {/* Kalimat Sapaan */}
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded mt-1.5 animate-pulse" />
                ) : (
                  <motion.p
                    key="greet"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.8 }}
                    className={`text-[11.5px] font-bold tracking-tight mt-1 leading-tight break-words text-balance ${hasEmergency ? 'text-rose-700 dark:text-rose-300 !opacity-100' : 'text-slate-800 dark:text-slate-200'
                      }`}
                  >
                    {greeting}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Sisi Kanan: Tombol Kontrol */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-100 dark:border-slate-700/40 shrink-0 shadow-inner">
            <button
              onClick={handleRefresh}
              disabled={isLoading || isTyping}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 active:scale-90 transition-all disabled:opacity-40 shrink-0"
              title="Perbarui situasi"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
            </button>

            {!isLoading && displayedStory && (
              <button
                onClick={isSpeaking ? handleStopSpeaking : handleSpeak}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-90 shrink-0 ${isSpeaking
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
                  }`}
              >
                {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
            )}
          </div>

        </div>

        {/* Tempat Tombol 'NYARI DATA TERBARU' */}
        {isTyping && !isLoading && (
          <div className="text-[9px] font-bold text-sky-600 bg-sky-50 dark:bg-sky-950/20 dark:text-sky-400 px-2 py-0.5 rounded border border-sky-100 dark:border-sky-900/30 w-max mb-3 animate-pulse tracking-wide ml-10">
            🤖 NYARI DATA TERBARU...
          </div>
        )}

        {/* Teks Deskripsi Hasil Olahan AI dengan MODIFIKASI MARKDOWN */}
        <AnimatePresence mode="wait">
          {!isLoading && displayedStory && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="relative pl-0.5"
            >
              {isSpeaking && (
                <div className="flex items-center gap-0.5 mb-2 h-2.5 opacity-80">
                  <span className="w-0.5 h-full bg-emerald-500 rounded-full animate-[bounce_0.5s_infinite]" style={{ animationDelay: '0ms' }} />
                  <span className="w-0.5 h-3/4 bg-emerald-500 rounded-full animate-[bounce_0.5s_infinite]" style={{ animationDelay: '150ms' }} />
                  <span className="w-0.5 h-1/2 bg-emerald-500 rounded-full animate-[bounce_0.5s_infinite]" style={{ animationDelay: '300ms' }} />
                  <span className="w-0.5 h-full bg-emerald-500 rounded-full animate-[bounce_0.5s_infinite]" style={{ animationDelay: '75ms' }} />
                </div>
              )}

              {/* ⚡ DISINI PERUBAHAN UTAMANYA LUUR ⚡ */}
              <div
                className={`text-[12.5px] leading-relaxed font-medium transition-all duration-300 ${isExpanded ? '' : 'line-clamp-3'
                  } ${hasEmergency ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}
              >
                <ReactMarkdown

                  components={{
                    // Merender pembungkus paragraf agar tetap inline & support spasi \n asli
                    p: ({ children }) => <span style={{ whiteSpace: 'pre-line' }}>{children}</span>,
                    // Kasih style tebal kustom biar mencolok di dark/light mode
                    strong: ({ children }) => (
                      <strong className={`font-extrabold ${hasEmergency ? 'text-red-600 dark:text-rose-400' : 'text-slate-950 dark:text-white'}`}>
                        {children}
                      </strong>
                    )
                  }}
                >
                  {displayedStory}
                </ReactMarkdown>

                {isTyping && (
                  <span className="inline-block w-1 h-3 bg-emerald-500 animate-[pulse_0.6s_infinite] ml-1 rounded-full align-middle" />
                )}
              </div>

              {/* Tombol Expand/Collapse Teks */}
              {textNeedsExpand && !isTyping && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={`text-[10px] font-bold mt-2.5 inline-flex items-center gap-1 transition-all ${hasEmergency ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                >
                  <span>{isExpanded ? 'Ringkas Rangkuman' : 'Baca Selengkapnya'}</span>
                  <svg
                    className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Skeleton saat Loading */}
        {isLoading && (
          <div className="space-y-2.5 mt-1">
            <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full w-full animate-pulse" />
            <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full w-11/12 animate-pulse" />
            <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full w-8/12 animate-pulse" />
          </div>
        )}
      </div>

      {/* Bar Statistik Data / Footer */}
      {!isLoading && insightStats && insightStats.total_laporan > 0 && (
        <div className={`px-4 py-2 border-t border-dashed flex items-center justify-between gap-4 transition-colors duration-300
          ${isMalam
            ? 'border-slate-800/80 bg-slate-950/20 text-slate-400'
            : 'border-slate-100 bg-slate-50/40 text-slate-500'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[9px] font-black uppercase tracking-wider opacity-60 flex items-center gap-1 shrink-0">
              <Activity size={10} className="text-slate-400" /> {insightStats.total_laporan} Kabar Warga
            </span>
            <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0" />
            <div className="flex items-center gap-1 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasEmergency ? 'bg-rose-500 animate-ping' :
                insightStats?.avg_confidence > 0.7 ? 'bg-emerald-500' :
                  insightStats?.avg_confidence > 0.4 ? 'bg-amber-500' : 'bg-rose-400'
                }`} />
              <span className="text-[9px] font-black uppercase tracking-wider opacity-60 truncate">
                {hasEmergency ? 'Validasi Darurat' : `Akurasi ${Math.round((insightStats?.avg_confidence || 0) * 100)}%`}
              </span>
            </div>
          </div>
          <span className="text-[8px] font-bold opacity-40 shrink-0">
            {new Date(insightStats.last_update).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
    </motion.div>
  );
}