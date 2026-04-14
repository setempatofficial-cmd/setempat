"use client";
import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import QRCode from "react-qr-code"; 
import { supabase } from "@/lib/supabaseClient";
import {
  Fingerprint,
  Globe,
  ShieldCheck,
  Cpu,
  Loader2,
  Clock,
  XCircle
} from "lucide-react";
 
import KTPModal from "@/app/components/layout/KTPModal";
import UpdateProfileForm from "@/app/components/form/UpdateProfileForm";

export default function KTPCard({ user, role, theme, onProfileUpdated }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [profile, setProfile] = useState(null);
  const [ktpStatus, setKtpStatus] = useState("loading");
  const [loading, setLoading] = useState(true);

  const isMalam = theme?.isMalam ?? true;

  // Fetch profile dan status KTP
  const fetchProfile = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    
    if (!error && data) {
      setProfile(data);
      setKtpStatus(data.ktp_status || "belum_mengajukan");
    } else {
      setKtpStatus("belum_mengajukan");
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchProfile();
  }, [user?.id]);

  // Memoize Data - PRIORITAS dari profile database
  const userData = useMemo(() => {
    const meta = user?.user_metadata || {};
    // 🔥 Prioritaskan dari profile (database)
    const name = profile?.full_name || user?.full_name || meta.full_name || meta.name || "WARGA DIGITAL";
    const username = profile?.username || user?.username || "";
    const avatar = profile?.avatar_url || meta.avatar_url || meta.picture || null;
    
    return {
      fullName: name,
      username: username,
      avatar: avatar,
      nik: profile?.nik || user?.id?.substring(0, 12).toUpperCase() || "STMPT-2026-X",
      profileUrl: `https://setempat.id/${username || user?.id?.substring(0, 8)}`
    };
  }, [user, profile]);

  // Tampilkan loading
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 w-full min-h-[300px]">
        <Loader2 size={32} className="animate-spin text-orange-500" />
        <p className={`text-sm mt-3 ${isMalam ? "text-white/50" : "text-slate-500"}`}>
          Memuat KTP Digital...
        </p>
      </div>
    );
  }

  // Handle daftar Rewang - dispatch event ke parent
  const handleDaftarRewang = () => {
    // Tutup modal KTP dulu
    setShowModal(false);
    // Kirim event ke RewangPage
    window.dispatchEvent(new CustomEvent("open-daftar-rewang"));
  };

  // Handle setelah update profile sukses
  const handleProfileUpdated = () => {
    setShowModal(false);
    // Refresh data profile tanpa reload page
    fetchProfile();
    // Panggil callback dari parent jika ada
    if (onProfileUpdated) onProfileUpdated();
  };

  // Tentukan konten berdasarkan status
  let content;

  if (ktpStatus === "belum_mengajukan") {
    content = (
      <div className="flex flex-col items-center justify-center p-6 w-full max-w-[400px] mx-auto">
        <div className={`text-center p-6 rounded-2xl border ${isMalam ? "bg-slate-900 border-white/10" : "bg-white border-slate-200"}`}>
          <ShieldCheck size={48} className="mx-auto mb-4 text-slate-400" />
          
          <h3 className={`text-base font-bold mb-2 ${isMalam ? "text-white" : "text-slate-900"}`}>
            Ajukan KTP Digital
          </h3>
          
          <p className={`text-xs mb-4 ${isMalam ? "text-white/50" : "text-slate-500"}`}>
            Dapatkan akses istimewa setelah verifikasi:
          </p>
          
          <div className={`text-left text-xs space-y-2 mb-6 p-3 rounded-xl ${isMalam ? "bg-slate-800/50" : "bg-slate-50"}`}>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                <span className="text-orange-500 text-[10px] font-bold">✓</span>
              </div>
              <span className={isMalam ? "text-white/70" : "text-slate-600"}>
                📸 <strong>Dapat Point & Reward</strong> dari setiap upload Story & Laporan
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                <span className="text-orange-500 text-[10px] font-bold">✓</span>
              </div>
              <span className={isMalam ? "text-white/70" : "text-slate-600"}>
                🔍 <strong>Dibutuhkan tetangga</strong> dan ditemukan di pencarian jasa
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                <span className="text-orange-500 text-[10px] font-bold">✓</span>
              </div>
              <span className={isMalam ? "text-white/70" : "text-slate-600"}>
                🏆 <strong>Badge Terverifikasi</strong> di profil Anda
              </span>
            </div>
          </div>
          
          <button
            onClick={() => setShowModal(true)}
            className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-medium text-sm transition-all active:scale-95"
          >
            Ajukan KTP Digital
          </button>
          
          <p className={`text-[9px] mt-3 ${isMalam ? "text-white/25" : "text-slate-400"}`}>
            Gratis! Verifikasi oleh Petinggi Setempat maksimal 1x24 jam
          </p>
        </div>
      </div>
    );
  } 
  else if (ktpStatus === "menunggu") {
    content = (
      <div className="flex flex-col items-center justify-center p-8 w-full max-w-[420px] mx-auto">
        <div className={`text-center p-8 rounded-2xl border ${isMalam ? "bg-slate-900 border-white/10" : "bg-white border-slate-200"}`}>
          <Clock size={48} className="mx-auto mb-4 text-yellow-500" />
          <h3 className={`text-lg font-bold mb-2 ${isMalam ? "text-white" : "text-slate-900"}`}>
            Menunggu Verifikasi
          </h3>
          <p className={`text-sm mb-2 ${isMalam ? "text-white/50" : "text-slate-500"}`}>
            Pengajuan KTP Digital Anda sedang diverifikasi oleh Petinggi Setempat.
          </p>
          <p className={`text-xs ${isMalam ? "text-white/30" : "text-slate-400"}`}>
            Proses verifikasi maksimal 1x24 jam
          </p>
        </div>
      </div>
    );
  } 
  else if (ktpStatus === "ditolak") {
    content = (
      <div className="flex flex-col items-center justify-center p-8 w-full max-w-[420px] mx-auto">
        <div className={`text-center p-8 rounded-2xl border ${isMalam ? "bg-slate-900 border-white/10" : "bg-white border-slate-200"}`}>
          <XCircle size={48} className="mx-auto mb-4 text-red-500" />
          <h3 className={`text-lg font-bold mb-2 ${isMalam ? "text-white" : "text-slate-900"}`}>
            Pengajuan Ditolak
          </h3>
          <p className={`text-sm mb-4 ${isMalam ? "text-white/50" : "text-slate-500"}`}>
            {profile?.ktp_rejection_reason || "Data yang Anda kirimkan tidak sesuai. Silakan ajukan ulang dengan data yang benar."}
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-medium"
          >
            Ajukan Ulang
          </button>
        </div>
      </div>
    );
  } 
  else if (ktpStatus === "aktif") {
    content = (
      <>
        <div className="flex flex-col items-center justify-center p-4 w-full">
          {/* Card Container */}
          <div className="relative w-full max-w-[420px] h-[240px] [perspective:2000px]">
            <motion.div
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.6, type: "spring", damping: 20, stiffness: 100 }}
              style={{ transformStyle: "preserve-3d", willChange: "transform" }}
              className="relative w-full h-full cursor-pointer"
              onClick={() => setIsFlipped(!isFlipped)}
            >
              {/* FRONT SIDE */}
              <div className={`absolute inset-0 w-full h-full rounded-[28px] p-6 [backface-visibility:hidden]
                border shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col justify-between overflow-hidden group
                ${isMalam ? "bg-slate-950 border-white/10" : "bg-white border-slate-200 shadow-xl"}`}>

                {/* Background Glow */}
                <div className={`absolute top-0 right-0 w-[200px] h-[200px] blur-[80px] -mr-20 -mt-20 
                  ${isMalam ? "bg-orange-500/20" : "bg-orange-500/10"}`} />

                {/* Header */}
                <div className="flex justify-between items-start relative z-10">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl border ${isMalam ? "bg-white/5 border-white/10" : "bg-slate-100 border-slate-200"}`}>
                      <Globe size={18} className={isMalam ? "text-orange-500 animate-[spin_15s_linear_infinite]" : "text-orange-600"} />
                    </div>
                    <div>
                      <h1 className={`text-[12px] font-black tracking-[0.3em] ${isMalam ? "text-white" : "text-slate-900"}`}>SETEMPAT.ID</h1>
                      <p className={`text-[8px] font-bold tracking-widest uppercase ${isMalam ? "text-orange-500/80" : "text-orange-600"}`}>Digital Citizenship</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <ShieldCheck size={20} className={role === 'superadmin' ? "text-purple-500" : "text-orange-500"} />
                    <span className={`text-[7px] font-mono mt-1 ${isMalam ? "text-white/30" : "text-slate-400"}`}>SECURE NODE: 0x412</span>
                  </div>
                </div>

                {/* Profile Section */}
                <div className="flex gap-6 items-center relative z-10">
                  <div className="relative">
                    <div className={`w-[90px] h-[90px] rounded-2xl rotate-3 border p-1.5 backdrop-blur-2xl transition-transform group-hover:rotate-0
                      ${role === 'superadmin' ? 'bg-purple-500/20 border-purple-500/30' : isMalam ? 'bg-orange-500/10 border-white/20' : 'bg-orange-500/10 border-slate-200'}`}>
                      <div className="w-full h-full rounded-xl overflow-hidden grayscale-[40%] hover:grayscale-0 transition-all">
                        {userData.avatar ? (
                          <img src={userData.avatar} className="w-full h-full object-cover" alt="avatar" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center text-4xl font-black ${isMalam ? "bg-slate-800 text-white/20" : "bg-slate-100 text-slate-400"}`}>
                            {userData.fullName.charAt(0)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={`absolute -bottom-1 -right-1 p-1.5 border rounded-lg shadow-xl ${isMalam ? "bg-slate-900 border-white/10" : "bg-white border-slate-200"}`}>
                      <Cpu size={12} className={isMalam ? "text-orange-400" : "text-orange-500"} />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-[9px] font-bold tracking-widest ${isMalam ? "text-white/40" : "text-slate-500"}`}>FULL NAME</p>
                    <h2 className={`font-black leading-[1.05] tracking-tight break-words ${isMalam ? "text-white" : "text-slate-900"} ${userData.fullName.length > 16 ? 'text-[17px]' : 'text-[19px]'}`}>
                      {userData.fullName.toUpperCase()}
                    </h2>
                    <p className={`text-[8px] font-mono mt-1 ${isMalam ? "text-orange-400" : "text-orange-600"}`}>
                      @{userData.username}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className={`h-1.5 w-1.5 rounded-full animate-pulse ${role === 'superadmin' ? 'bg-purple-500' : 'bg-orange-500'}`} />
                      <p className={`text-[8px] font-mono tracking-tighter uppercase ${isMalam ? "text-white/50" : "text-slate-500"}`}>
                        {role === 'superadmin' ? 'Superior Access' : role === 'admin' ? 'District Manager' : 'Verified Resident'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer Front */}
                <div className={`flex justify-between items-end relative z-10 border-t pt-4 ${isMalam ? "border-white/5" : "border-slate-100"}`}>
                  <div>
                    <p className={`text-[7px] font-black uppercase ${isMalam ? "text-white/20" : "text-slate-400"}`}>ID Number</p>
                    <p className={`text-[11px] font-mono font-bold tracking-widest ${isMalam ? "text-white/80" : "text-slate-700"}`}>{userData.nik}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[7px] font-black uppercase ${isMalam ? "text-white/20" : "text-slate-400"}`}>Pasuruan Region</p>
                    <p className={`text-[10px] font-black tracking-widest ${isMalam ? "text-white" : "text-slate-800"}`}>EAST JAVA</p>
                  </div>
                </div>
              </div>

              {/* BACK SIDE */}
              <div className={`absolute inset-0 w-full h-full rounded-[28px] p-8 [transform:rotateY(180deg)] [backface-visibility:hidden]
                border flex flex-col items-center justify-between shadow-2xl overflow-hidden
                ${isMalam ? "bg-slate-900 border-white/5 text-white" : "bg-slate-50 border-slate-200 text-slate-800"}`}>
                
                <div className="w-full flex justify-between items-center opacity-40">
                  <Fingerprint size={24} />
                  <div className={`h-px flex-1 mx-4 bg-gradient-to-r from-transparent ${isMalam ? "via-white/20" : "via-slate-300"} to-transparent`} />
                  <Cpu size={24} />
                </div>

                {/* QR Section */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-orange-500 blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
                  <div className={`p-4 rounded-[2.5rem] relative z-10 shadow-2xl transition-transform duration-500 group-hover:scale-105
                    ${isMalam ? "bg-white" : "bg-slate-900"}`}>
                    <QRCode 
                      value={userData.profileUrl} 
                      size={110} 
                      bgColor={isMalam ? "#ffffff" : "#0f172a"}
                      fgColor={isMalam ? "#020617" : "#ffffff"}
                      level="H" 
                    />
                  </div>
                </div>

                {/* Footer Back */}
                <div className="text-center space-y-1 relative z-10">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="h-1 w-1 rounded-full bg-orange-500 animate-pulse" />
                    <p className="text-[10px] font-black tracking-[0.5em] uppercase">VALIDATED</p>
                    <div className="h-1 w-1 rounded-full bg-orange-500 animate-pulse" />
                  </div>
                  <p className={`text-[8px] font-mono uppercase opacity-30 tracking-tight`}>
                    Authorized by Setempat.id Smart Contract
                  </p>
                </div>

                {/* Grain Texture */}
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/asfalt-dark.png')]" />
              </div>
            </motion.div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex gap-3 w-full max-w-[420px]">
            <button
              onClick={() => setIsFlipped(!isFlipped)}
              className={`flex-1 px-6 py-4 rounded-2xl border text-[11px] font-black tracking-widest transition-all active:scale-95
                ${isMalam ? "bg-white/5 hover:bg-white/10 border-white/10 text-white shadow-xl shadow-black/20" : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 shadow-md"}`}
            >
              {isFlipped ? "FRONT VIEW" : "BACK VIEW"}
            </button>

            <button
              onClick={() => setShowModal(true)}
              className="flex-1 px-6 py-4 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-black tracking-widest transition-all active:scale-95 shadow-lg shadow-orange-600/30"
            >
              UPDATE PROFILE
            </button>

            {/* 🔥 TOMBOL DAFTAR REWANG - HANYA UNTUK USER YANG SUDAH KTP AKTIF */}
            {ktpStatus === "aktif" && (
              <button
                onClick={handleDaftarRewang}
                className="flex-1 px-6 py-4 rounded-2xl bg-green-600 hover:bg-green-500 text-white text-[11px] font-black tracking-widest transition-all active:scale-95 shadow-lg shadow-green-600/30"
              >
                DAFTAR REWANG
              </button>
            )}
          </div>
        </div>
      </>
    );
  } 
  else {
    content = (
      <div className="flex flex-col items-center justify-center p-8 w-full max-w-[420px] mx-auto">
        <div className={`text-center p-8 rounded-2xl border ${isMalam ? "bg-slate-900 border-white/10" : "bg-white border-slate-200"}`}>
          <Loader2 size={48} className="mx-auto mb-4 text-slate-400 animate-spin" />
          <h3 className={`text-lg font-bold mb-2 ${isMalam ? "text-white" : "text-slate-900"}`}>
            Memuat Status...
          </h3>
          <p className={`text-sm ${isMalam ? "text-white/50" : "text-slate-500"}`}>
            Silakan tunggu sebentar
          </p>
        </div>
      </div>
    );
  }

  // RENDER dengan modal di luar kondisi
  return (
    <>
      {content}
      
      <KTPModal isOpen={showModal} onClose={() => setShowModal(false)} theme={theme}>
        <UpdateProfileForm
          profile={profile || user}  // 🔥 Prioritaskan profile database, fallback ke user
          theme={theme}
          onSaveSuccess={handleProfileUpdated}
        />
      </KTPModal>
    </>
  );
}