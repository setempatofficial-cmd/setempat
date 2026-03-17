"use client";

import { CldUploadWidget } from "next-cloudinary";
import { updatePhotos } from "@/app/actions/tempat"; // Jalur Admin
import { supabase } from "@/lib/supabaseClient";      // Jalur Warga
import { useSearchParams } from "next/navigation";

export default function AIModalUploader({ tempatId, namaTempat, onUploadSuccess }) {
  const searchParams = useSearchParams();
  const isAdmin = searchParams.get("mode") === "admin_setempat";

  const handleSuccess = async (result) => {
    const { secure_url, public_id } = result.info;

    if (isAdmin) {
      // --- JALUR ADMIN: Masuk ke Kolom Photos (Tabel Tempat) ---
      const fotoAdmin = {
        url: secure_url,
        public_id: public_id,
        time_tag: "pagi", // Nanti bisa dibuat dinamis sesuai jam
        caption: `Official Photo - ${namaTempat}`
      };
      
      const res = await updatePhotos(tempatId, fotoAdmin);
      
      if (res.success) {
        if (onUploadSuccess) {
          onUploadSuccess(secure_url, true); // true untuk isAdmin
        } else {
          alert("Foto Utama Berhasil Diupdate!");
        }
      } else {
        alert("Gagal update foto: " + res.error);
      }

    } else {
      // --- JALUR WARGA: Masuk ke Tabel Laporan_Warga ---
      const { error } = await supabase.from("laporan_warga").insert([{
        tempat_id: tempatId,
        photo_url: secure_url,
        tipe: "LIVE_REPORT",
        deskripsi: "Warga melaporkan kondisi terkini."
      }]);
      
      if (!error) {
        if (onUploadSuccess) {
          onUploadSuccess(secure_url, false); // false untuk isAdmin
        } else {
          alert("Matur nuwun! Laporan visualmu sudah terkirim.");
        }
      } else {
        alert("Gagal kirim laporan: " + error.message);
      }
    }

    // Hapus window.location.reload() karena akan mengganggu UX di modal
    // window.location.reload();
  };

  return (
    <CldUploadWidget 
      uploadPreset="setempat_preset" 
      onSuccess={handleSuccess}
    >
      {({ open }) => (
        <button
          onClick={() => open()}
          className={`w-full flex items-center justify-center gap-3 p-4 rounded-[24px] border transition-all ${
            isAdmin 
            ? "bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20" 
            : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20"
          }`}
        >
          <span className="text-2xl">📸</span>
          <div className="text-left">
            <p className="text-[11px] font-black uppercase italic leading-none">
              {isAdmin ? "ADMIN_UPDATE_GALLERY" : "KIRIM_LAPORAN_VISUAL"}
            </p>
            <p className="text-[9px] opacity-60 font-bold uppercase tracking-tighter">
              {isAdmin ? "Update Foto Utama Tempat" : "Bantu Pantau Suasana Live"}
            </p>
          </div>
        </button>
      )}
    </CldUploadWidget>
  );
}