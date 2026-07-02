// lib/checkLiveStatus.ts
import { supabase } from "@/lib/supabaseClient";

/**
 * Cek apakah stream Cloudflare sedang live berdasarkan manifest HLS.
 * Logic ini SAMA untuk audio & video karena sumbernya identik (1 STREAM_URL).
 */
export async function checkStreamIsLive(streamUrl: string): Promise<boolean> {
  if (!streamUrl) return false;

  try {
    const headResponse = await fetch(streamUrl, {
      method: "HEAD",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });

    if (!headResponse.ok) {
      await syncLiveStatusToDb(false);
      return false;
    }

    const response = await fetch(streamUrl, { cache: "no-store" });
    if (!response.ok) {
      await syncLiveStatusToDb(false);
      return false;
    }

    const text = await response.text();
    const isLive = text.includes("#EXTINF") || text.includes(".ts") || text.length > 50;

    await syncLiveStatusToDb(isLive);
    return isLive;
  } catch (err) {
    console.warn("Error checking live status:", err);
    await syncLiveStatusToDb(false);
    return false;
  }
}

/**
 * Tulis hasil cek ke tabel live_streams, supaya SmartBottomNav
 * (yang subscribe Realtime ke tabel ini) langsung dapat update
 * tanpa perlu toggle manual dari admin.
 *
 * Asumsi: tabel live_streams punya 1 baris dengan id = 1.
 * Sesuaikan kalau struktur tabel kamu berbeda (misal multi-stream).
 */
async function syncLiveStatusToDb(isLive: boolean): Promise<void> {
  try {
    await supabase
      .from("live_streams")
      .upsert({ id: 1, is_active: isLive, updated_at: new Date().toISOString() });
  } catch (err) {
    // Non-blocking — kalau sync gagal, jangan ganggu pengalaman user yang sedang nonton
    console.warn("Gagal sync live status ke DB:", err);
  }
}