"use client";
import { memo } from "react";
import { Camera, Check, Bot } from "lucide-react"; // Pake Bot dari Lucide biar keren

const AIMessageBubble = memo(({ message, isUser, isMalam, onLaporClick, showLaporButton }) => {
  return (
    <div className={`flex items-start gap-2 mb-4 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar AI - Dibuat lebih Berkarakter */}
      {!isUser && (
        <div className="relative flex-shrink-0 mt-1">
          {/* Efek Glow di belakang icon */}
          <div className="absolute inset-0 bg-emerald-500 blur-sm opacity-20 rounded-full"></div>
          <div className="relative w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center border border-emerald-500/30">
            <Bot size={16} className="text-emerald-400" />
          </div>
        </div>
      )}

      {/* Bubble Container */}
      <div className={`
        relative max-w-[85%] px-3.5 py-2.5
        ${isUser 
          ? "bg-emerald-600 text-white rounded-2xl rounded-tr-none shadow-sm" 
          : isMalam 
            ? "bg-zinc-800/80 backdrop-blur-md text-zinc-100 rounded-2xl rounded-tl-none border border-white/5" 
            : "bg-[#F0F2F5] text-zinc-800 rounded-2xl rounded-tl-none border border-transparent shadow-sm"
            /* bg-[#F0F2F5] itu warna abu-abu khas chat premium agar mata gak silau */
        }
      `}>
        {/* Teks Pesan */}
        <p className="text-[14.5px] leading-snug whitespace-pre-line font-medium">
          {message.text}
        </p>

        {/* Tombol Lapor - Dibuat lebih Nyatu */}
        {showLaporButton && (
          <button 
            onClick={onLaporClick}
            className={`
              mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
              transition-all active:scale-95 font-black text-[11px] uppercase tracking-wider
              ${isUser 
                ? "bg-white/20 text-white border border-white/30 backdrop-blur-sm" 
                : "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
              }
            `}
          >
            <Camera size={14} strokeWidth={3} />
            Lapor Kondisi Terkini
          </button>
        )}

        {/* Info Waktu & Centang */}
        <div className={`flex items-center gap-1 mt-1 justify-end ${isUser ? "text-white/60" : "text-zinc-400"}`}>
          <span className="text-[9px] font-bold">
            {message.time}
          </span>
          {isUser && <Check size={10} strokeWidth={4} />}
        </div>
      </div>
    </div>
  );
});

AIMessageBubble.displayName = "AIMessageBubble";
export default AIMessageBubble;