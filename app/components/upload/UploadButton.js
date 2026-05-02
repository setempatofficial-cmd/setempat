'use client';

import { Plus } from 'lucide-react';

export default function UploadButton({ onClick }) {
  return (
    <button 
      onClick={onClick} 
      className="bg-orange-500 text-white p-4 rounded-2xl shadow-lg -mt-10 border-[6px] border-[#FBFBFE] active:scale-90 transition-all"
    >
      <Plus size={24} />
    </button>
  );
}