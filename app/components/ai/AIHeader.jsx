// components/ai/AIHeader.jsx
"use client";
import { memo } from "react";

const AIHeader = memo(({ locationName, isMalam, onClose, theme }) => {
  return (
    <div className={`flex-shrink-0 px-4 py-3 border-b ${theme?.border || 'border-gray-100'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
            <span className="text-xl">🤖</span>
          </div>
          <div>
            <h2 className={`text-[15px] font-bold ${theme?.text || 'text-gray-900'}`}>AKAMSI AI</h2>
            <p className={`text-[11px] ${isMalam ? 'text-gray-400' : 'text-gray-500'}`}>{locationName}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 flex items-center justify-center">
          ✕
        </button>
      </div>
    </div>
  );
});

AIHeader.displayName = "AIHeader";
export default AIHeader;