"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import QRCode from "react-qr-code";
import {
  Fingerprint,
  Globe,
  ShieldCheck,
  Cpu,
} from "lucide-react";

export default function KTPCardPublic({ user, profile, theme }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const isMalam = theme?.isMalam ?? true;

  const userData = useMemo(() => {
    const name = profile?.full_name || user?.user_metadata?.full_name || "WARGA DIGITAL";
    const username = profile?.username || "";
    const avatar = profile?.avatar_url || user?.user_metadata?.avatar_url || null;

    return {
      fullName: name,
      username: username,
      avatar: avatar,
      nik: profile?.nik || user?.id?.substring(0, 12).toUpperCase() || "STMPT-2026-X",
      profileUrl: `https://setempat.id/${username}`
    };
  }, [user, profile]);

  // Hanya untuk user dengan KTP aktif
  if (profile?.ktp_status !== "aktif") {
    return (
      <div className="text-center p-8 bg-slate-900 rounded-2xl border border-slate-800">
        <ShieldCheck className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-white mb-2">KTP Digital Belum Aktif</h3>
        <p className="text-slate-400 text-sm">
          Warga ini belum mengaktifkan KTP Digital.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 w-full">
      {/* Card Container - SAMA PERSIS DENGAN KTPCard TAPI TANPA TOMBOL UPDATE */}
      <div className="relative w-full max-w-[420px] h-[240px] [perspective:2000px]">
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: "spring", damping: 20, stiffness: 100 }}
          style={{ transformStyle: "preserve-3d", willChange: "transform" }}
          className="relative w-full h-full cursor-pointer"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          {/* FRONT SIDE - SAMA PERSIS */}
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
                <ShieldCheck size={20} className="text-orange-500" />
                <span className={`text-[7px] font-mono mt-1 ${isMalam ? "text-white/30" : "text-slate-400"}`}>VALIDATED</span>
              </div>
            </div>

            {/* Profile Section */}
            <div className="flex gap-6 items-center relative z-10">
              <div className="relative">
                <div className={`w-[90px] h-[90px] rounded-2xl rotate-3 border p-1.5 backdrop-blur-2xl transition-transform group-hover:rotate-0
                  ${isMalam ? 'bg-orange-500/10 border-white/20' : 'bg-orange-500/10 border-slate-200'}`}>
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
                  <div className="h-1.5 w-1.5 rounded-full animate-pulse bg-orange-500" />
                  <p className={`text-[8px] font-mono tracking-tighter uppercase ${isMalam ? "text-white/50" : "text-slate-500"}`}>
                    Verified Resident
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

          {/* BACK SIDE - SAMA PERSIS */}
          <div className={`absolute inset-0 w-full h-full rounded-[28px] p-8 [transform:rotateY(180deg)] [backface-visibility:hidden]
            border flex flex-col items-center justify-between shadow-2xl overflow-hidden
            ${isMalam ? "bg-slate-900 border-white/5 text-white" : "bg-slate-50 border-slate-200 text-slate-800"}`}>
            <div className="w-full flex justify-between items-center opacity-40">
              <Fingerprint size={24} />
              <div className={`h-px flex-1 mx-4 bg-gradient-to-r from-transparent ${isMalam ? "via-white/20" : "via-slate-300"} to-transparent`} />
              <Cpu size={24} />
            </div>
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
          </div>
        </motion.div>
      </div>

      {/* 🔥 TANPA TOMBOL UPDATE PROFILE - HANYA INFORMASI */}
      <div className="mt-4 text-center">
        <p className="text-[8px] text-slate-500">
          KTP Digital Terverifikasi • Setempat.id
        </p>
      </div>
    </div>
  );
}