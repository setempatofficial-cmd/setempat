"use client";
import { memo } from "react";
import { Camera, Check, BrainCircuit, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

const AIMessageBubble = memo(({ message, isUser, isMalam, onLaporClick, showLaporButton }) => {
  return (
    <div className={`flex items-start gap-3 mb-8 ${isUser ? "flex-row-reverse" : ""}`}>
      
      {/* Avatar AI - Konsisten dengan Header Akamsi Intel */}
      {!isUser && (
        <div className="relative flex-shrink-0 mt-1">
          <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-20 rounded-full animate-pulse"></div>
          <div className="relative w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center border border-white/10 shadow-lg">
            <BrainCircuit size={18} className="text-indigo-400" />
          </div>
        </div>
      )}

      {/* Hybrid Bubble Container */}
      <div className={`
        relative max-w-[85%] transition-all duration-300
        ${isUser 
          ? "bg-slate-800 text-slate-50 rounded-[22px] rounded-tr-md px-5 py-3.5 shadow-lg shadow-slate-200/50" 
          : isMalam 
            ? "bg-indigo-950/90 backdrop-blur-xl text-indigo-50 rounded-[22px] rounded-tl-md border border-white/5 px-5 py-4" 
            : "bg-white text-slate-800 rounded-[22px] rounded-tl-md border border-indigo-50/50 shadow-sm shadow-indigo-100/30 px-5 py-4"
        }
      `}>
        
        {/* Konten Cerdas (Markdown) */}
        <div className={`
          markdown-content text-[15px] leading-relaxed tracking-normal
          ${isUser ? 'text-slate-100' : 'text-slate-800'}
        `}>
          <ReactMarkdown
            components={{
              // PERBAIKAN: Ganti div dengan span
              img: ({ node, ...props }) => (
                <span className="relative mt-0 mb-1 group inline-block">
                  <span className="absolute inset-0 bg-indigo-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <img 
                    {...props} 
                    className="relative rounded-2xl w-full object-cover max-h-64 border border-slate-200/50 shadow-sm" 
                    loading="lazy"
                  />
                </span>
              ),
              // Judul: Gradient yang identik dengan 'Intelligence'
              h3: ({ node, ...props }) => (
                <h3 {...props} className="text-[17px] font-extrabold mb-1 bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent inline-block tracking-tight" />
              ),
              // Garis pemisah ultra-tipis
              hr: ({ node, ...props }) => (
                <hr {...props} className="my-4 border-slate-100 dark:border-white/5" />
              ),
              // List styling
              li: ({node, ...props}) => (
                <li {...props} className="ml-4 list-disc marker:text-indigo-500 mb-1.5" />
              ),
              p: ({ node, ...props }) => <p {...props} className="mb-3 last:mb-0 leading-7 font-medium" />
            }}
          >
            {message.text}
          </ReactMarkdown>
        </div>

        {/* Action Button: Lapor Visual */}
        {showLaporButton && (
          <button 
            onClick={onLaporClick}
            className={`
              mt-5 flex items-center justify-center gap-2.5 w-full py-3.5 rounded-[18px]
              transition-all active:scale-[0.96] font-bold text-[12px] tracking-wide uppercase
              ${isUser 
                ? "bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-md" 
                : "bg-slate-900 hover:bg-indigo-700 text-white shadow-xl shadow-slate-200 transition-colors duration-300"
              }
            `}
          >
            <Camera size={16} strokeWidth={2.5} />
            <span>Pantau Kondisi Terkini</span>
            <Sparkles size={14} className="text-indigo-400" />
          </button>
        )}

        {/* Meta Info & Time */}
        <div className={`
          flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-50/50 justify-end
          ${isUser ? "text-slate-400" : "text-slate-400"}
        `}>
          <span className="text-[10px] font-bold tracking-tight opacity-70">
            {message.time}
          </span>
          {isUser && <Check size={12} strokeWidth={3} className="text-indigo-500" />}
        </div>
      </div>
    </div>
  );
});

AIMessageBubble.displayName = "AIMessageBubble";
export default AIMessageBubble;