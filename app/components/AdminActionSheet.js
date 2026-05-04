"use client";

import { MapPin, ImagePlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminActionSheet() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  // Mendengarkan event dari SmartBottomNav
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("open-admin-upload-options", handleOpen);
    return () => window.removeEventListener("open-admin-upload-options", handleOpen);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsOpen(false)}>
      <div 
        className="w-full max-w-[400px] bg-white dark:bg-[#121212] rounded-t-[32px] p-8 animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()} // Agar tidak tertutup saat klik menu
      >
        <div className="w-12 h-1.5 bg-gray-300 dark:bg-white/20 rounded-full mx-auto mb-6" />
        
        <h3 className="text-center text-lg font-bold mb-8">Pilih Aksi Admin</h3>

        <div className="grid grid-cols-2 gap-4">
          {/* Tombol ke Halaman Tambah Tempat */}
          <button 
            onClick={() => { router.push("/tempat/tambah"); setIsOpen(false); }}
            className="flex flex-col items-center gap-4 p-5 rounded-3xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 active:scale-95 transition"
          >
            <div className="p-4 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-500/30">
              <MapPin size={28} />
            </div>
            <span className="text-xs font-bold text-blue-700 dark:text-blue-400">Tambah Lokasi</span>
          </button>

          {/* Tombol untuk trigger Photo Slider (onOpenUpload) */}
          <button 
            onClick={() => { 
                window.dispatchEvent(new CustomEvent("trigger-open-upload")); 
                setIsOpen(false); 
            }}
            className="flex flex-col items-center gap-4 p-5 rounded-3xl bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 active:scale-95 transition"
          >
            <div className="p-4 bg-orange-600 rounded-2xl text-white shadow-lg shadow-orange-500/30">
              <ImagePlus size={28} />
            </div>
            <span className="text-xs font-bold text-orange-700 dark:text-orange-400">Upload Photo</span>
          </button>
        </div>

        <button 
          onClick={() => setIsOpen(false)}
          className="w-full mt-8 py-4 text-sm font-bold text-gray-500 dark:text-gray-400"
        >
          Batal
        </button>
      </div>
    </div>
  );
}