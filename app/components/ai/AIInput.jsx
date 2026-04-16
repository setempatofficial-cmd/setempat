// components/ai/AIInput.jsx
"use client";
import { memo } from "react";

const AIInput = memo(({ value, onChange, onSend, isTyping, placeholder }) => {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 dark:bg-white/10 rounded-full px-4 py-2.5 focus-within:ring-2 focus-within:ring-emerald-500/30">
        <input
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder || "Tanya kondisi, jam buka, atau langsung cerita..."}
          className="w-full bg-transparent text-[13px] text-gray-900 dark:text-white focus:outline-none"
          onKeyPress={(e) => e.key === "Enter" && onSend()}
        />
      </div>
      <button
        onClick={onSend}
        disabled={!value.trim() || isTyping}
        className={`w-10 h-10 rounded-full flex items-center justify-center ${
          value.trim() && !isTyping 
            ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white" 
            : "bg-gray-200 dark:bg-white/20 text-gray-400"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
        </svg>
      </button>
    </div>
  );
});

AIInput.displayName = "AIInput";
export default AIInput;