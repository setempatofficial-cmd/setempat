"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function SplashScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [authReady, setAuthReady] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // Minimum splash screen duration (1 detik untuk UX yang smooth)
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Check authentication status tanpa error
  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 5;

    const checkAuth = async () => {
      try {
        // Coba ambil session
        const { data: { session }, error } = await supabase.auth.getSession();

        // Jika error refresh token, tunggu dan retry
        if (error?.message?.includes('Refresh Token Not Found')) {
          if (retryCount < maxRetries && mounted) {
            retryCount++;
            console.debug(`Auth retry ${retryCount}/${maxRetries}...`);
            setTimeout(checkAuth, 200 * retryCount); // exponential backoff
            return;
          }
        }

        // Set auth ready regardless (biarkan null session)
        if (mounted) {
          setAuthReady(true);
        }
      } catch (err) {
        // Silent fail - tetap lanjutkan
        console.debug("Auth check error:", err.message);
        if (mounted) {
          setAuthReady(true); // Tetap lanjut meskipun error
        }
      }
    };

    checkAuth();

    return () => { mounted = false; };
  }, []);

  // Progress bar logic
  useEffect(() => {
    if (progress === 100) {
      const timer = setTimeout(() => {
        onComplete();
      }, 400);
      return () => clearTimeout(timer);
    }

    // Progress sampai 85% dulu, sisanya menunggu auth & min time
    const targetProgress = (authReady && minTimeElapsed) ? 100 : 85;

    if (progress < targetProgress) {
      const interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + 3;
          return newProgress > targetProgress ? targetProgress : newProgress;
        });
      }, 30);
      return () => clearInterval(interval);
    } else if (authReady && minTimeElapsed && progress === 85) {
      // Lompat ke 100% ketika semua kondisi terpenuhi
      setTimeout(() => setProgress(100), 100);
    }
  }, [progress, authReady, minTimeElapsed, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{
        y: "-100%",
        opacity: 0,
        transition: { duration: 0.6, ease: [0.23, 1, 0.32, 1] }
      }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-[#0B0F19] px-6 py-16"
      style={{ maxWidth: "420px", margin: "0 auto", right: 0, left: 0 }}
    >
      <div className="h-10" />

      <div className="flex flex-col items-center gap-5 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative w-20 h-20 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#E3655B] to-[#ff7d72] shadow-xl shadow-[#E3655B]/20"
        >
          <div className="relative w-10 h-10 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <div className="absolute top-[7px] w-4 h-4 flex items-center justify-center">
              <svg className="w-full h-full text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="flex flex-col items-center"
        >
          <h1 className="text-xl font-black tracking-[0.2em] text-white uppercase">
            SETEMPAT<span className="text-[#E3655B]">.id</span>
          </h1>
          <p className="text-[10px] text-white/40 mt-1 tracking-wide">
            Melihat Kehidupan Sekitar
          </p>
        </motion.div>
      </div>

      <div className="w-full max-w-[180px] flex flex-col items-center gap-2">
        <div className="w-full h-[2px] bg-white/10 rounded-full overflow-hidden relative">
          <motion.div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#E3655B] to-[#ff7d72] rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-[8px] font-medium tracking-widest text-white/40 uppercase">
            {!authReady ? "Memantau Kondisi" : progress < 100 ? "Memuat Sekitar" : "AKAMSI GO!"}
          </span>

          {/* Subtle status indicator */}
          <div className="flex gap-1">
            <div className={`w-1 h-1 rounded-full transition-colors duration-300 ${authReady ? 'bg-[#E3655B]' : 'bg-white/20'}`} />
            <div className={`w-1 h-1 rounded-full transition-colors duration-300 ${minTimeElapsed ? 'bg-[#E3655B]' : 'bg-white/20'}`} />
            <div className={`w-1 h-1 rounded-full transition-colors duration-300 ${progress >= 100 ? 'bg-[#E3655B]' : 'bg-white/20'}`} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}