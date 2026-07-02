"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import PilihLokasi from "./PilihLokasi";

export default function PilihLokasiModal({ 
  isOpen, 
  onClose, 
  onSelect, 
  initialValue = "",
  title = "Pilih Lokasi"
}) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-slate-900 rounded-2xl max-w-[420px] w-full p-5 border border-slate-700"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <X size={18} className="text-slate-400" />
            </button>
          </div>

          <PilihLokasi
            onSelect={(location) => {
              onSelect(location);
              onClose();
            }}
            initialValue={initialValue}
            placeholder="Cari lokasi..."
          />

          <button
            onClick={onClose}
            className="mt-3 w-full py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 text-sm font-medium transition-colors"
          >
            Batal
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}