// app/components/ai/AISuggestionBubble.jsx
"use client";
import { motion } from "framer-motion";

export default function AISuggestionBubble({ suggestions, onSuggestionClick }) {
  if (!suggestions?.items?.length) return null;

  return (
    <div className="flex flex-wrap gap-2 py-2">
      {suggestions.items.map((item, idx) => (
        <motion.button
          key={idx}
          whileHover={{ y: -2, backgroundColor: "rgba(0,0,0,0.05)" }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSuggestionClick(item.text)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 
                     dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400
                     hover:border-emerald-500/50 transition-all shadow-sm"
        >
          <span>{item.emoji}</span>
          <span>{item.text}</span>
        </motion.button>
      ))}
    </div>
  );
}