"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  const [newReportNotif, setNewReportNotif] = useState(null); // ✅ NOTIF STATE
  const typingTimeoutRef = useRef(null);
  const speechRef = useRef(null);
  const [audioPlayer, setAudioPlayer] = useState(null);
  const voicesLoadedRef = useRef(false);

  // ✅ SATU KALI SAJA - dengan callback untuk notifikasi
  const { greeting, story, insightStats, isLoading, modelUsed, refresh } =
    useAIInsight(activeTempat, (laporanBaru) => {
      console.log("📢 NOTIF: Laporan baru!", laporanBaru);
      setNewReportNotif({
        id: laporanBaru.id,
        deskripsi: laporanBaru.deskripsi,
        waktu: new Date()
      });

      // Hilangkan notifikasi setelah 3 detik
      setTimeout(() => setNewReportNotif(null), 3000);
    });

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
      .replace(/@(\w+)(?:\s+(\w+))?/g, (match, p1, p2) => {
        // Jika ada dua kata (misal @sutejo pramono)
        if (p2) {
          return p1 + p2;
        }
        // Jika hanya satu kata (misal @sutejo)
        return p1;
      })
      .replace(/[#*_~`>|]/g, '')
      .replace(/\n/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const handleStopSpeaking = useCallback(() => {
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
    }
    setIsSpeaking(false);
  }, [audioPlayer]);

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

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        voicesLoadedRef.current = true;
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Informasi Badge Model AI
  const modelBadge = useMemo(() => {
    switch (modelUsed) {
      case 'local':
        return { text: '⚡ Instant', color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/40' };
      case 'groq-8b':
        return { text: '🧠 AI Smart', color: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/30' };
      case 'groq-70b':
        return { text: '✨ AI Pro', color: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900/30' };
      default:
        return { text: '⚡ Instant', color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/40' };
    }
  }, [modelUsed]);

  // Sistem Text-to-Speech
  const handleSpeak = useCallback(async () => {
    if (!displayedStory || isSpeaking) return;

    handleStopSpeaking();

    const cleanGreeting = cleanTextForSpeech(greeting);
    const cleanStory = cleanTextForSpeech(displayedStory);
    const speechText = `${cleanGreeting}. ${cleanStory}`;

    setIsSpeaking(true);

    try {
      const response = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: speechText }),
      });

      if (!response.ok) throw new Error("Gagal mengambil audio dari server");

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);

      setAudioPlayer(audio);

      audio.onstart = () => {
        setIsSpeaking(true);
      };

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        setAudioPlayer(null);
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        setAudioPlayer(null);
      };

      await audio.play();

    } catch (error) {
      console.error("Error TTS ElevenLabs:", error);
      setIsSpeaking(false);
      setAudioPlayer(null);
    }
  }, [displayedStory, isSpeaking, greeting, handleStopSpeaking]);

  const handleRefresh = useCallback(() => {
    setIsTyping(true);
    setDisplayedStory("");
    if (isSpeaking) handleStopSpeaking();
    refresh();
  }, [isSpeaking, handleStopSpeaking, refresh]);

  const textNeedsExpand = displayedStory && (displayedStory.length > 130 || displayedStory.split('\n').length > 2);

  if (!activeTempat) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`mb-5 mx-3 rounded-2xl border backdrop-blur-md shadow-sm transition-all duration-500 relative overflow-hidden
        ${hasEmergency
          ? 'bg-rose-50/80 border-rose-200 ring-1 ring-rose-500/10 shadow-rose-100/40 dark:bg-rose-950/20 dark:border-rose-500/30 dark:shadow-rose-950/10'
          : 'bg-white/90 border-slate-200/80 shadow-slate-200/40 dark:bg-slate-900/40 dark:border-slate-800/60 dark:shadow-slate-950/20'
        }`}
    >
      {/* ✅ NOTIFICATION BANNER - DITARUH DI SINI (di dalam return) */}
      <AnimatePresence>
        {newReportNotif && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute top-0 left-0 right-0 bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-2 rounded-t-2xl text-xs font-bold text-center z-10 shadow-lg"
          >
            📢 Laporan baru: {newReportNotif.deskripsi?.substring(0, 60)}...
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Ambient Glow */}
      <div className={`absolute top-0 right-0 w-28 h-28 blur-3xl opacity-15 pointer-events-none rounded-full transition-colors duration-500 
        ${hasEmergency ? 'bg-rose-500' : 'bg-teal-400'}`}
      />

      {/* Wadah Atas / Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">

          {/* Sisi Kiri: Avatar + Info Judul */}
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm shrink-0 transition-all duration-300 relative mt-0.5
              ${hasEmergency
                ? 'bg-gradient-to-br from-rose-500 to-red-600 text-white'
                : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700/60'
              }`}
            >
              {hasEmergency ? (
                <AlertTriangle size={14} />
              ) : isSpeaking ? (
                <Sparkles size={14} className="animate-spin text-emerald-600 dark:text-emerald-400" style={{ animationDuration: '4s' }} />
              ) : (
                <Brain size={14} className="text-slate-600 dark:text-slate-400" />
              )}

              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 
                bg-emerald-500 dark:border-slate-900 border-white
                ${hasEmergency ? 'bg-rose-500' : 'bg-emerald-500'} 
                ${!isLoading ? 'animate-pulse' : ''}`}
              />
            </div>

            <div className="flex flex-col min-w-0 pt-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className={`text-[10px] font-black uppercase tracking-widest shrink-0 ${hasEmergency ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                  {hasEmergency ? '🚨 Kabar Setempat' : 'AKAMSI AI'}
                </h4>
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 tracking-wide ${modelBadge.color}`}>
                  {modelBadge.text}
                </span>
              </div>

              <AnimatePresence mode="wait">
                {isLoading ? (
                  <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800/80 rounded mt-1.5 animate-pulse" />
                ) : (
                  <motion.p
                    key="greet"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`text-[12px] font-bold tracking-tight mt-1 leading-snug break-words text-balance ${hasEmergency ? 'text-rose-900 dark:text-rose-300' : 'text-slate-900 dark:text-slate-200'
                      }`}
                  >
                    {greeting}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Tombol Kontrol */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/50 shrink-0 shadow-inner">
            <button
              onClick={handleRefresh}
              disabled={isLoading || isTyping}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 active:scale-90 transition-all disabled:opacity-40 shrink-0"
              title="Perbarui situasi"
            >
              <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
            </button>

            {!isLoading && displayedStory && (
              <button
                onClick={isSpeaking ? handleStopSpeaking : handleSpeak}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all active:scale-90 shrink-0 ${isSpeaking
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
                  }`}
              >
                {isSpeaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
              </button>
            )}
          </div>
        </div>

        {/* Indikator Loading Mesin Tik */}
        {isTyping && !isLoading && (
          <div className="text-[9px] font-bold text-sky-700 bg-sky-50 dark:bg-sky-950/30 dark:text-sky-400 px-2 py-0.5 rounded border border-sky-100 dark:border-sky-900/20 w-max mb-3 animate-pulse tracking-wide ml-10">
            🤖 NYARI DATA TERBARU...
          </div>
        )}

        {/* Teks Deskripsi */}
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

              <div
                className={`text-[12.5px] leading-relaxed font-semibold transition-all duration-300 ${isExpanded ? '' : 'line-clamp-3'
                  } ${hasEmergency ? 'text-slate-900 dark:text-slate-100' : 'text-slate-800 dark:text-slate-300'}`}
              >
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <span style={{ whiteSpace: 'pre-line' }}>{children}</span>,
                    strong: ({ children }) => (
                      <strong className={`font-black ${hasEmergency ? 'text-red-700 dark:text-rose-400' : 'text-slate-950 dark:text-white'
                        }`}>
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

              {textNeedsExpand && !isTyping && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={`text-[10px] font-bold mt-2.5 inline-flex items-center gap-1 transition-all ${hasEmergency ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
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

        {isLoading && (
          <div className="space-y-2 mt-1.5">
            <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full w-full animate-pulse" />
            <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full w-11/12 animate-pulse" />
            <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full w-8/12 animate-pulse" />
          </div>
        )}
      </div>

      {/* Footer */}
      {!isLoading && insightStats && insightStats.total_laporan > 0 && (
        <div className={`px-4 py-2 border-t border-dashed flex items-center justify-between gap-2 flex-wrap transition-colors duration-300 ${isMalam
          ? 'border-slate-800/80 bg-slate-950/10 text-slate-400'
          : 'border-slate-200 bg-slate-50/60 text-slate-600 font-medium'
          }`}
        >
          <div className="flex items-center gap-x-2 gap-y-1 flex-wrap min-w-0">
            <span className="text-[9px] font-black uppercase tracking-wider opacity-80 flex items-center gap-1 shrink-0">
              <Activity size={10} className="text-slate-400" /> {insightStats.total_laporan} Kabar Warga
            </span>

            <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0 hidden xs:block" />

            <div className="flex items-center gap-1 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasEmergency ? 'bg-rose-500 animate-ping' :
                insightStats?.avg_confidence > 0.7 ? 'bg-emerald-500' :
                  insightStats?.avg_confidence > 0.4 ? 'bg-amber-500' : 'bg-rose-500'
                }`} />
              <span className="text-[9px] font-black uppercase tracking-wider opacity-80 truncate">
                {hasEmergency ? 'Validasi Darurat' : `Akurasi ${Math.round((insightStats?.avg_confidence || 0) * 100)}%`}
              </span>
            </div>
          </div>

          <span className="text-[8px] font-bold opacity-60 shrink-0 ml-auto pt-0.5 xs:pt-0">
            {new Date(insightStats.last_update).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
    </motion.div>
  );
}