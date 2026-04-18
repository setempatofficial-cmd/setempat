"use client";
import { memo } from "react";
import { SendHorizontal, Camera } from "lucide-react";

const AIInput = memo(({ value, onChange, onSend, onLaporClick, isTyping, placeholder }) => {
  const canSend = value.trim() && !isTyping;

  return (
    <div className="flex items-end gap-2 p-3 bg-transparent">
      {/* Input Field Container */}
      <div className={`
        flex-1 flex items-center min-h-[48px] px-3 py-1.5
        bg-gray-100 dark:bg-white/[0.06] 
        rounded-[26px] border border-transparent
        focus-within:border-emerald-500/20 focus-within:bg-white dark:focus-within:bg-zinc-900
        transition-all duration-300
      `}>
        {/* Tombol Kamera di dalam Input */}
        <button
          onClick={onLaporClick}
          className="p-2 mr-1 text-zinc-400 hover:text-emerald-500 transition-colors active:scale-90"
          title="Kirim Foto"
          type="button"
        >
          <Camera size={20} strokeWidth={2.5} />
        </button>

        <input
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder || "Tanya atau cerita kondisi..."}
          className="w-full bg-transparent text-[14px] font-medium text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none"
          onKeyPress={(e) => e.key === "Enter" && onSend()}
          // ========== PERBAIKAN: HILANGKAN SUGESTI PRIBADI ==========
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          inputMode="text"
          // Khusus untuk menghilangkan saran kartu kredit/password
          name="_ai_chat_input"
          id="_ai_chat_input"
          // Mencegah browser menyimpan data sebagai form
          data-form-type="other"
        />
      </div>

      {/* Action Button */}
      <button
        onClick={onSend}
        disabled={!canSend}
        type="button"
        className={`
          w-[48px] h-[48px] rounded-full flex items-center justify-center 
          transition-all duration-300 active:scale-90
          ${canSend 
            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" 
            : "bg-gray-200 dark:bg-white/10 text-gray-400 cursor-not-allowed"
          }
        `}
      >
        {isTyping ? (
          <div className="flex gap-1">
            <span className="w-1 h-1 bg-white rounded-full animate-bounce" />
            <span className="w-1 h-1 bg-white rounded-full animate-bounce [animation-delay:0.2s]" />
            <span className="w-1 h-1 bg-white rounded-full animate-bounce [animation-delay:0.4s]" />
          </div>
        ) : (
          <SendHorizontal 
            size={20} 
            className={`transition-transform ${canSend ? 'rotate-0 translate-x-0.5' : 'opacity-40'}`} 
          />
        )}
      </button>
    </div>
  );
});

AIInput.displayName = "AIInput";
export default AIInput;