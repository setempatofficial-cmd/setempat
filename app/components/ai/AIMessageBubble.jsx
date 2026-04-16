// components/ai/AIMessageBubble.jsx
"use client";
import { memo } from "react";

const AIMessageBubble = memo(({ message, isUser, isMalam, onLaporClick, showLaporButton }) => {
  return (
    <div className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="text-sm">🤖</span>
        </div>
      )}
      <div className={`max-w-[85%] px-4 py-2.5 shadow-sm rounded-2xl ${
        isUser
          ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-tr-sm"
          : isMalam ? "bg-white/10 text-white rounded-tl-sm" : "bg-gray-100 text-gray-900 rounded-tl-sm"
      }`}>
        <p className="text-[13px] whitespace-pre-line leading-relaxed">{message.text}</p>
        {showLaporButton && (
          <button 
            onClick={onLaporClick} 
            className="mt-3 w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wider shadow-sm hover:shadow-md transition-all"
          >
            📸 Laporkan Sekarang
          </button>
        )}
        <p className={`text-[10px] mt-1 ${isUser ? "text-white/60" : "text-gray-400"}`}>{message.time}</p>
      </div>
    </div>
  );
});

AIMessageBubble.displayName = "AIMessageBubble";
export default AIMessageBubble;