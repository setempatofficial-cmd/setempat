"use client";
import { memo } from "react";
import { Camera, Check, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown"; // Import ini

const AIMessageBubble = memo(({ message, isUser, isMalam, onLaporClick, showLaporButton }) => {
  return (
    <div className={`flex items-start gap-2 mb-4 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar AI */}
      {!isUser && (
        <div className="relative flex-shrink-0 mt-1">
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
        }
      `}>
        {/* Teks Pesan - Sekarang menggunakan ReactMarkdown */}
        <div className={`markdown-content text-[14.5px] leading-snug font-medium ${isUser ? 'prose-invert' : ''}`}>
          <ReactMarkdown
            components={{
              // Menangani Gambar Thumbnail Berita
              img: ({ node, ...props }) => (
                <img 
                  {...props} 
                  className="rounded-xl my-2 w-full object-cover max-h-52 border border-black/10 shadow-sm" 
                  loading="lazy"
                />
              ),
              // Menangani Judul (###)
              h3: ({ node, ...props }) => (
                <h3 {...props} className="text-lg font-black mt-1 mb-2 leading-tight tracking-tight" />
              ),
              // Menangani Garis Pemisah (---)
              hr: ({ node, ...props }) => (
                <hr {...props} className="my-3 border-zinc-300/50 dark:border-white/10" />
              ),
              // Menangani Paragraf agar tidak ada margin bawah berlebih
              p: ({ node, ...props }) => <p {...props} className="mb-2 last:mb-0 whitespace-pre-line" />
            }}
          >
            {message.text}
          </ReactMarkdown>
        </div>

        {/* Tombol Lapor */}
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