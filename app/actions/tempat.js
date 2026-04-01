// app/actions/tempat.js
"use server";

import { supabase } from "@/lib/supabaseClient";
import { revalidatePath } from "next/cache";

export async function updateWajahLokasi(tempatId, timeLabel, data) {
  console.log("📥 Server action received:", { tempatId, timeLabel, data });

  try {
    // Validasi
    if (!tempatId) {
      return { success: false, error: "ID tempat tidak ditemukan" };
    }
    if (!timeLabel) {
      return { success: false, error: "Waktu tidak valid" };
    }
    if (!data?.url) {
      return { success: false, error: "URL gambar tidak ditemukan" };
    }

    // Caption boleh kosong
    const caption = data?.caption || "";

    // Ambil data photos saat ini
    const { data: currentData, error: fetchError } = await supabase
      .from("tempat")
      .select("photos")
      .eq("id", tempatId)
      .single();

    if (fetchError) {
      console.error("Fetch error:", fetchError);
      return { success: false, error: "Gagal mengambil data: " + fetchError.message };
    }

    // Update JSONB photos
    const currentPhotos = currentData?.photos || {};
    const updatedPhotos = {
      ...currentPhotos,
      [timeLabel]: {
        url: data.url,
        caption: caption,
        updated_at: new Date().toISOString(),
      },
    };

    // Simpan ke database
    const { error: updateError } = await supabase
      .from("tempat")
      .update({ photos: updatedPhotos })
      .eq("id", tempatId);

    if (updateError) {
      console.error("Update error:", updateError);
      return { success: false, error: "Gagal menyimpan: " + updateError.message };
    }

    // Revalidate path
    revalidatePath("/");
    revalidatePath(`/tempat/${tempatId}`);

    return { 
      success: true, 
      data: { 
        id: tempatId, 
        timeLabel, 
        photos: updatedPhotos 
      } 
    };

  } catch (error) {
    console.error("Unexpected error:", error);
    return { success: false, error: error.message || "Terjadi kesalahan" };
  }
}