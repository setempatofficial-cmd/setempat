// app/components/ai/AIModal.jsx (FILE BARU)
"use client";

import AIKentonganModal from "./AIKentonganModal";
import AIModalTempat from "./AIModalTempat";

export default function AIModal(props) {
  const { kentongan } = props;
  
  // Jika mode kentongan
  if (kentongan) {
    return <AIKentonganModal {...props} />;
  }
  
  // Default: mode tempat
  return <AIModalTempat {...props} />;
}