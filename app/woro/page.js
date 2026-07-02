"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import WoroContent from "@/app/components/layout/woro/WoroContent";
import { useTheme } from "@/app/hooks/useTheme";

export default function WoroPage() {
  const router = useRouter();
  const theme = useTheme();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ State untuk client
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // ========== LOADING SPINNER ==========
  const LoadingSpinner = useMemo(() => {
    const isMalam = theme?.isMalam || false;
    const bgColor = theme?.bg || (isMalam ? 'bg-slate-900' : 'bg-gray-100');
    const textColor = theme?.text || (isMalam ? 'text-white' : 'text-slate-900');
    const textMuted = theme?.textMuted || (isMalam ? 'text-white/60' : 'text-gray-500');
    const spinnerColor = isMalam ? '#22d3ee' : '#E3655B';
    const borderColor = isMalam ? 'border-white/10' : 'border-gray-200';

    return (
      <div className={`min-h-screen ${bgColor} ${textColor} flex items-center justify-center transition-colors duration-300`}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className={`w-12 h-12 rounded-full border-4 ${borderColor}`}>
              <div
                className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin"
                style={{
                  borderColor: `${spinnerColor} transparent transparent transparent`,
                  animationDuration: '0.6s',
                  transition: 'border-color 0.3s ease'
                }}
              />
            </div>
          </div>
          <p className={`${textMuted} text-sm font-medium animate-pulse`}>
            Memuat...
          </p>
        </div>
      </div>
    );
  }, [theme]);

  // ========== ERROR STATE ==========
  const ErrorState = useMemo(() => {
    const isMalam = theme?.isMalam || false;
    const bgColor = theme?.bg || (isMalam ? 'bg-slate-900' : 'bg-gray-100');
    const textColor = theme?.text || (isMalam ? 'text-white' : 'text-slate-900');
    const textMuted = theme?.textMuted || (isMalam ? 'text-white/40' : 'text-gray-500');
    const cardBg = theme?.card || (isMalam ? 'bg-white/5' : 'bg-white');
    const border = theme?.border || (isMalam ? 'border-white/10' : 'border-gray-200');
    const accentBg = theme?.accentBg || 'bg-[#E3655B]';

    return (
      <div className={`min-h-screen ${bgColor} flex items-center justify-center p-4 transition-colors duration-300`}>
        <div className={`${cardBg} ${border} rounded-2xl p-8 max-w-sm w-full text-center shadow-lg`}>
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className={`${textColor} text-lg font-semibold mb-2`}>
            Akses Ditolak
          </h3>
          <p className={`${textMuted} text-sm mb-6`}>
            {error || 'Anda tidak memiliki akses ke halaman ini'}
          </p>
          <button
            onClick={() => router.push("/")}
            className={`w-full py-3 ${accentBg} text-white rounded-xl hover:opacity-80 active:scale-95 transition-all duration-200 font-medium`}
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }, [theme, error, router]);

  // ========== CHECK ACCESS ==========
  // ✅ FIX: definisikan langsung di dalam useEffect supaya cleanup function
  // (`isMounted = false`) benar-benar terpasang sebagai cleanup React,
  // bukan sekadar resolved value dari async function yang dibuang begitu saja.
  useEffect(() => {
    let isMounted = true;

    async function checkAccess() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Session error:", sessionError.message);
          if (isMounted) {
            setError("Gagal memverifikasi sesi");
            setLoading(false);
          }
          return;
        }

        if (!session?.user) {
          if (isMounted) {
            setError("Silakan login untuk mengakses");
            setLoading(false);
            setTimeout(() => {
              if (isMounted) router.push("/");
            }, 2000);
          }
          return;
        }

        if (isMounted) {
          setIsAuthorized(true);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error checking access:", err);
        if (isMounted) {
          setError("Terjadi kesalahan, coba lagi");
          setLoading(false);
          setTimeout(() => {
            if (isMounted) router.push("/");
          }, 2000);
        }
      }
    }

    checkAccess();

    return () => {
      isMounted = false; // cleanup ini sekarang benar-benar jalan saat unmount
    };
  }, [router]);

  // ========== RENDER ==========
  // ✅ Jika belum client, render dengan tema default (siang)
  // TAPI dengan transition agar smooth saat berubah
  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-100 text-slate-900 flex items-center justify-center transition-colors duration-300">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-gray-200">
              <div
                className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin"
                style={{
                  borderColor: '#E3655B transparent transparent transparent',
                  animationDuration: '0.6s',
                  transition: 'border-color 0.3s ease'
                }}
              />
            </div>
          </div>
          <p className="text-gray-500 text-sm font-medium animate-pulse">
            Memuat...
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return LoadingSpinner;
  }

  if (error || !isAuthorized) {
    return ErrorState;
  }

  // ✅ FIX: theme tidak lagi di-pass sebagai prop karena WoroContent
  // sekarang menerima theme dari sini secara eksplisit (single source of truth)
  return <WoroContent theme={theme} />;
}