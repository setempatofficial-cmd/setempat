"use client";

import { useEffect, useState } from "react";
import { X, Smartphone, MapPin } from "lucide-react";

export default function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    if (isIOSDevice && !localStorage.getItem("setempat_ios_guide")) {
      setShowIOSGuide(true);
    }
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);

      const dismissTime = localStorage.getItem("setempat_banner_dismissed_time");
      const now = new Date().getTime();

      // Jeda 24 jam dalam milidetik
      const oneDay = 24 * 60 * 60 * 1000;

      // Banner HANYA muncul jika belum pernah diklik "Lain kali", 
      // ATAU jika waktu klik terakhir sudah lewat dari 24 jam (keesokan harinya)
      if (!dismissTime || (now - parseInt(dismissTime) > oneDay)) {
        setTimeout(() => setShowBanner(true), 4000);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
      setShowBanner(false);
    }

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayChange = (e) => {
      setIsInstalled(e.matches);
      if (e.matches) setShowBanner(false);
    };

    mediaQuery.addEventListener("change", handleDisplayChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      mediaQuery.removeEventListener("change", handleDisplayChange);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setShowBanner(false);
      }
    } catch (error) {
      console.error("PWA Install Error:", error);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    // Simpan waktu klik saat ini
    const now = new Date().getTime();
    localStorage.setItem("setempat_banner_dismissed_time", now.toString());
  };

  const handleCloseIOSGuide = () => {
    setShowIOSGuide(false);
    localStorage.setItem("setempat_ios_guide", "true");
  };

  // 1. TAMPILAN IOS BANNER (Ramah Pengguna & Menggunakan Teks Komunitas)
  if (isIOS && showIOSGuide && !isInstalled) {
    return (
      <div className="fixed top-2 inset-x-2 z-[999] max-w-[420px] mx-auto animate-in slide-in-from-top-4 duration-300">
        <div className="bg-zinc-900/95 border border-zinc-800 backdrop-blur-sm p-3 rounded-xl shadow-xl">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <p className="text-white text-xs font-semibold">Pantau sekitar lewat aplikasi?</p>
            </div>
            <button onClick={handleCloseIOSGuide} className="text-zinc-500 p-1 hover:text-zinc-300 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-zinc-400 text-[11px] leading-relaxed mb-3">
            Ketuk ikon <span className="inline-block bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] text-zinc-200">📤 Bagikan</span> lalu pilih <span className="text-cyan-400 font-medium">"Add to Home Screen"</span> untuk akses cepat SetempatID.
          </p>
          <button onClick={handleCloseIOSGuide} className="w-full text-center text-[11px] font-semibold text-cyan-400 bg-cyan-500/10 py-1.5 rounded-lg active:bg-cyan-500/20 transition-colors">
            Siap, Paham
          </button>
        </div>
      </div>
    );
  }

  if (!showBanner || isInstalled) return null;

  // 2. TAMPILAN ANDROID/CHROME BANNER (Bahasa Kasual SetempatID)
  return (
    <div className="fixed top-2 inset-x-2 z-[999] max-w-[420px] mx-auto animate-in slide-in-from-top-4 duration-300">
      <div className="bg-zinc-900/95 border border-zinc-800/80 backdrop-blur-sm p-2.5 rounded-xl shadow-xl flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Mengubah ikon menjadi MapPin agar selaras dengan esensi radar wilayah/lokal */}
          <div className="bg-cyan-500/10 p-2 rounded-lg shrink-0">
            <MapPin className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-xs truncate">Simpan SetempatID?</p>
            <p className="text-[10px] text-zinc-400 truncate">Pantau info kehidupan sekitar lebih ringan</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={handleDismiss} className="text-zinc-500 hover:text-zinc-300 px-2 py-1.5 text-[11px] transition-colors">
            Lain kali
          </button>
          <button onClick={handleInstall} className="bg-cyan-500 hover:bg-cyan-600 active:scale-95 text-black font-semibold px-3 py-1.5 rounded-lg text-[11px] transition-all">
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}