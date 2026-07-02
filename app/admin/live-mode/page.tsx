"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Crown, Unlock, Save, Loader2, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function LiveModeAdmin() {
  const router = useRouter();
  const [mode, setMode] = useState<'free' | 'premium'>('free');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ============ CEK AUTH ============
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          router.push('/auth/login');
          return;
        }

        // Cek role admin (opsional)
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profile?.role !== 'superadmin') {
          setMessage({ type: 'error', text: 'Anda tidak memiliki akses ke halaman ini.' });
          setIsLoading(false);
          return;
        }

        setIsAuthenticated(true);
        await fetchCurrentMode();
      } catch (err) {
        console.error('Auth error:', err);
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // ============ FETCH MODE ============
  const fetchCurrentMode = async () => {
    try {
      const response = await fetch('/api/live-mode');
      const data = await response.json();

      // 🔥 Default ke 'free'
      setMode(data.mode || 'free');
    } catch (err) {
      console.error('Error fetching mode:', err);
      setMode('free'); // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  // ============ UPDATE MODE ============
  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      // 🔥 Validasi sebelum kirim
      if (!mode || !['free', 'premium'].includes(mode)) {
        setMessage({ type: 'error', text: 'Mode tidak valid!' });
        setIsSaving(false);
        return;
      }

      const response = await fetch('/api/live-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: 'success',
          text: `✅ Mode berhasil diubah menjadi ${mode === 'premium' ? 'PREMIUM' : 'GRATIS'}`
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Gagal mengubah mode' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan. Silakan coba lagi.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-white font-bold text-lg">Akses Ditolak</h2>
          <p className="text-white/60 text-sm mt-1">Anda tidak memiliki akses ke halaman ini.</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm rounded-lg transition-colors"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 py-8 px-4">
      <div className="max-w-md mx-auto">

        {/* ========== HEADER ========== */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/')}
            className="w-10 h-10 rounded-full bg-neutral-800/50 border border-white/10 flex items-center justify-center text-white hover:bg-neutral-700 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-white">⚙️ Pengaturan Siaran</h1>
        </div>

        {/* ========== CARD ========== */}
        <div className="bg-neutral-900/50 border border-white/10 rounded-2xl p-6">

          {/* Mode Saat Ini */}
          <div className="text-center mb-6">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Mode Saat Ini</div>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold
              ${mode === 'premium'
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}
            >
              {mode === 'premium' ? (
                <Crown className="w-4 h-4" />
              ) : (
                <Unlock className="w-4 h-4" />
              )}
              {mode === 'premium' ? 'PREMIUM' : 'GRATIS'}
            </div>
          </div>

          {/* ========== TOGGLE BUTTONS ========== */}
          <div className="space-y-3 mb-6">
            <p className="text-xs text-white/40 text-center">Pilih mode siaran yang diinginkan</p>

            {/* Mode FREE */}
            <button
              onClick={() => setMode('free')}
              className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4
                ${mode === 'free'
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-white/10 bg-neutral-800/50 hover:bg-neutral-700/50'}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center
                ${mode === 'free' ? 'bg-emerald-500/20' : 'bg-neutral-700/50'}`}
              >
                <Unlock className={`w-5 h-5 ${mode === 'free' ? 'text-emerald-400' : 'text-white/40'}`} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-white font-bold text-sm">GRATIS</div>
                <div className="text-white/40 text-xs">Preview 5 detik, semua bisa nonton</div>
              </div>
              {mode === 'free' && (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              )}
            </button>

            {/* Mode PREMIUM */}
            <button
              onClick={() => setMode('premium')}
              className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4
                ${mode === 'premium'
                  ? 'border-yellow-500 bg-yellow-500/10'
                  : 'border-white/10 bg-neutral-800/50 hover:bg-neutral-700/50'}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center
                ${mode === 'premium' ? 'bg-yellow-500/20' : 'bg-neutral-700/50'}`}
              >
                <Crown className={`w-5 h-5 ${mode === 'premium' ? 'text-yellow-400' : 'text-white/40'}`} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-white font-bold text-sm">PREMIUM</div>
                <div className="text-white/40 text-xs">Preview 30 detik, harus bayar untuk lanjut</div>
              </div>
              {mode === 'premium' && (
                <CheckCircle className="w-5 h-5 text-yellow-400" />
              )}
            </button>
          </div>

          {/* ========== PREVIEW ========== */}
          <div className="bg-neutral-800/30 rounded-xl p-4 mb-6 border border-white/5">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Preview Mode</p>
            <div className="flex items-center gap-4">
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500
                    ${mode === 'premium' ? 'bg-yellow-400' : 'bg-emerald-400'}`}
                  style={{ width: mode === 'premium' ? '100%' : '100%' }}
                />
              </div>
              <span className="text-xs font-bold text-white/60">
                {mode === 'premium' ? '30s' : '5s'}
              </span>
            </div>
            <p className="text-xs text-white/30 mt-2">
              {mode === 'premium'
                ? '🔒 User akan melihat preview 30 detik sebelum diminta bayar'
                : '🔓 User akan melihat preview 5 detik lalu langsung bisa nonton'}
            </p>
          </div>

          {/* ========== MESSAGE ========== */}
          {message && (
            <div className={`p-3 rounded-xl mb-4 text-sm flex items-center gap-2
              ${message.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}
            >
              {message.type === 'success' ? (
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              {message.text}
            </div>
          )}

          {/* ========== SAVE BUTTON ========== */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Simpan Pengaturan
              </>
            )}
          </button>

          {/* ========== INFO ========== */}
          <p className="text-[10px] text-white/20 text-center mt-4">
            Perubahan akan langsung berlaku tanpa perlu refresh halaman
          </p>
        </div>

        {/* ========== STATUS LIVE ========== */}
        <div className="mt-4 bg-neutral-900/30 rounded-xl p-3 border border-white/5 flex items-center justify-between">
          <span className="text-xs text-white/40">Status Siaran</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-400 font-medium">LIVE</span>
            <span className="text-xs text-white/20 mx-1">•</span>
            <span className="text-xs text-white/40">
              Mode: <span className={`font-bold ${mode === 'premium' ? 'text-yellow-400' : 'text-emerald-400'}`}>
                {mode === 'premium' ? 'PREMIUM' : 'GRATIS'}
              </span>
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}