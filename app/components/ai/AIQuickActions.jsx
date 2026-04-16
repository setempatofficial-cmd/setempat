// components/ai/AIQuickActions.jsx
"use client";
import { memo } from "react";

const AIQuickActions = memo(({ actions, onActionClick, onLaporClick, isMalam }) => {
  return (
    <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar pb-1">
      {actions.map((tag, idx) => (
        <button
          key={idx}
          onClick={() => onActionClick(tag.query)}
          className={`px-3 py-2 rounded-full border border-gray-200 text-[10px] font-medium ${
            isMalam ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
          } whitespace-nowrap transition-all`}
        >
          {tag.label}
        </button>
      ))}
      <button
        onClick={onLaporClick}
        className="px-3 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[10px] font-bold whitespace-nowrap shadow-sm"
      >
        📸 Lapor
      </button>
    </div>
  );
});

AIQuickActions.displayName = "AIQuickActions";
export default AIQuickActions;