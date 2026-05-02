"use client";
import { memo, useEffect, useState } from "react";
import { SendHorizontal, Camera, Sparkles, Cpu } from "lucide-react";

const AIInput = memo(({ value, onChange, onSend, onLaporClick, isTyping, placeholder }) => {
  const [hasLocalAI, setHasLocalAI] = useState(false);
  const canSend = value.trim() && !isTyping;
  
  // Warna Brand Kita
  const BRAND_COLOR = "#E3655B";

  useEffect(() => {
    if (typeof window !== "undefined" && window.ai) {
      setHasLocalAI(true);
    }
  }, []);

  return (
    <div className="p-4 bg-transparent backdrop-blur-md">
      <div className="relative flex items-end gap-2.5 max-w-3xl mx-auto">
        
        {/* Input Field Container */}
        <div className={`
          relative flex-1 flex items-center min-h-[52px] px-2 py-2
          bg-white dark:bg-zinc-900 
          rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.02)]
          border-2 transition-all duration-500 ease-out
          ${canSend 
            ? `border-[#E3655B]/30 shadow-[#E3655B]/5` 
            : "border-zinc-100 dark:border-white/5"}
          focus-within:border-[#E3655B] focus-within:ring-4 focus-within:ring-[#E3655B]/10
        `}>
          
          <button
            onClick={onLaporClick}
            className="group flex items-center justify-center w-10 h-10 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-90"
            type="button"
          >
            <Camera 
              size={20} 
              style={{ color: canSend ? BRAND_COLOR : '#a1a1aa' }} 
              className="transition-colors" 
              strokeWidth={2} 
            />
          </button>

          <input
            type="text"
            value={value}
            onChange={onChange}
            placeholder={placeholder || "Tanya sesuatu..."}
            className="flex-1 bg-transparent px-2 text-[15px] font-medium text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
            onKeyPress={(e) => e.key === "Enter" && onSend()}
            autoComplete="off"
            spellCheck="false"
          />

          {/* INDICATOR: AI Lokal / Cloud */}
          {!value && (
            <div className="absolute right-4 pointer-events-none flex items-center gap-1.5">
              {hasLocalAI && (
                <span className="text-[9px] font-black opacity-40 tracking-tighter uppercase" style={{ color: BRAND_COLOR }}>Local</span>
              )}
              {hasLocalAI ? (
                <Cpu size={14} style={{ color: BRAND_COLOR }} className="opacity-30 animate-pulse" />
              ) : (
                <Sparkles size={16} style={{ color: BRAND_COLOR }} className="opacity-30 animate-pulse" />
              )}
            </div>
          )}
        </div>

        {/* Send Button */}
        <button
          onClick={onSend}
          disabled={!canSend}
          style={{ 
            backgroundColor: canSend ? BRAND_COLOR : undefined,
          }}
          className={`
            relative w-[52px] h-[52px] rounded-2xl flex items-center justify-center 
            transition-all duration-300 transform
            ${canSend 
              ? "shadow-lg shadow-[#E3655B]/30 scale-100 active:scale-95 text-white" 
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-300 scale-95 opacity-50 cursor-not-allowed"}
          `}
        >
          {isTyping ? (
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-duration:0.8s]" />
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.4s]" />
            </div>
          ) : (
            <SendHorizontal 
              size={22} 
              strokeWidth={2.5}
              className={`transition-all duration-500 ${canSend ? 'rotate-0 translate-x-0.5 opacity-100' : '-rotate-45 opacity-0'}`} 
            />
          )}
        </button>
      </div>
      
      {/* Footer Info */}
      <p className="text-center text-[10px] font-medium text-zinc-400 mt-3 tracking-tight">
        {hasLocalAI 
          ? "⚡ Berjalan dengan Chrome AI Lokal" 
          : "Akamsi AI dapat membuat kesalahan. Cek kembali info penting."}
      </p>
    </div>
  );
});

AIInput.displayName = "AIInput";
export default AIInput;