"use client";

import AIKentonganModal from "./AIKentonganModal";
import AIModalDetail from "./AIModalDetail";

export default function AIModal(props) {
  const { isOpen, mode, data, initialQuery, onClose } = props;

  if (!isOpen) return null;

  /**
   * STRATEGI:
   * Kita gunakan prop 'mode' atau cek keberadaan objek data 
   * untuk menentukan komponen mana yang di-render.
   */

  // 1. Jika Mode Kentongan / Berita
  if (mode === "kentongan" || data?.type === "kentongan" || props.kentongan) {
    return (
      <AIKentonganModal 
        {...props} 
        // Memastikan data kentongan terpetakan dengan benar
        kentongan={props.kentongan || data} 
        initialQuery={initialQuery}
      />
    );
  }

  // 2. Jika Mode Tempat / Detail Bisnis
  if (mode === "tempat" || data?.type === "tempat" || props.item) {
    return (
      <AIModalDetail 
        {...props} 
        // Memastikan data tempat/item terpetakan
        item={props.item || data}
        initialQuery={initialQuery}
      />
    );
  }

  // 3. Fallback jika tidak ada data yang cocok
  return null;
}