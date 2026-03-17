"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from '@supabase/supabase-js'; // <-- INI SUDAH BENAR

export default function AuthModal({ isOpen, onClose }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [mode, setMode] = useState("login");

  // HANYA SATU DEKLARASI - INI YANG DIPAKAI
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // HAPUS BARIS INI:
  // const supabase = createClientComponentClient();

  // 1. LOGIN GOOGLE (Langsung)
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  // 2. LOGIN EMAIL / MAGIC LINK
  const handleMagicLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (!error) setSent(true);
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl relative overflow-hidden"
      >
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black text-slate-900">Mlebu Setempat<span className="text-[#E3655B]">ID</span></h2>
          <p className="text-slate-500 text-sm mt-2 font-medium">Pilih cara masuk yang paling gampang, Lur.</p>
        </div>

        <div className="space-y-4">
          {/* PILIHAN 1: GOOGLE */}
          <button 
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-100 py-4 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-200 active:scale-95 transition-all"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Lanjut dengan Google
          </button>

          {/* PEMISAH */}
          <div className="flex items-center gap-4 my-6">
            <div className="h-[1px] bg-slate-100 flex-1"></div>
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Atau</span>
            <div className="h-[1px] bg-slate-100 flex-1"></div>
          </div>

          {/* PILIHAN 2: EMAIL */}
          {!sent ? (
            <form onSubmit={handleMagicLink} className="space-y-3">
              <input 
                type="email" 
                placeholder="Masukkan emailmu..."
                className="w-full p-4 bg-slate-100 rounded-2xl focus:outline-none focus:ring-2 ring-[#E3655B]/20 text-sm font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-medium"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs tracking-widest active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? "MENGIRIM..." : "KIRIM LINK KE EMAILMU"}
              </button>
            </form>
          ) : (
            <div className="bg-green-50 text-green-600 p-4 rounded-2xl text-xs font-bold text-center animate-in fade-in zoom-in">
              🚀 Link sudah dikirim! Cek inbox/spam emailmu ya.
            </div>
          )}
        </div>

        <button onClick={onClose} className="w-full mt-8 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] hover:text-[#E3655B] transition-colors">
          Tutup
        </button>
      </motion.div>
    </div>
  );
}