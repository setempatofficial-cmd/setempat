import { generateHeadline } from "./headlineEngine";

function formatRelativeTime(dateString) {
  if (!dateString) return "";
  const now = new Date();
  const past = new Date(dateString);
  const diffInMs = now - past;
  const diffInMin = Math.floor(diffInMs / 60000);

  if (diffInMin < 1) return "Baru saja";
  if (diffInMin < 60) return `${diffInMin}m lalu`;
  const diffInHours = Math.floor(diffInMin / 60);
  if (diffInHours < 24) return `${diffInHours}j lalu`;
  return past.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export function processFeedItem({ item, locationReady, location, comments = {} }) {
  if (!item) return {};

  const estimasiOrang = parseInt(item.estimasi_orang) || 0;
  const laporan = Array.isArray(item.laporan_terbaru) ? item.laporan_terbaru : [];
  const testimonial = Array.isArray(item.testimonial_terbaru) ? item.testimonial_terbaru : [];
  const medsos = Array.isArray(item.medsos_terbaru) ? item.medsos_terbaru : [];
  const aktivitas = Array.isArray(item.aktivitas_terkini) ? item.aktivitas_terkini : [];

  const allSignals = [...medsos, ...laporan, ...testimonial].map((s, idx) => {
    let platform = "Update Warga";
    const sourceText = (s.source || s.platform || "").toLowerCase();
    const urlText = (s.url || "").toLowerCase();
    if (sourceText.includes('instagram') || urlText.includes('instagram')) platform = "Instagram";
    else if (sourceText.includes('tiktok') || urlText.includes('tiktok')) platform = "TikTok";
    else if (s.tipe === "laporan") platform = "Laporan Langsung";

    const timestamp = s.created_at || s.timestamp || s.date || item.updated_at;

    return {
      ...s,
      username: s.username || "warga_lokal",
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.username || idx + item.id}`,
      text: s.konten || s.content || s.text || s.deskripsi || "",
      platformLabel: platform,
      timeAgo: formatRelativeTime(timestamp),
      isLive: (new Date() - new Date(timestamp)) < 3600000 // Live jika < 1 jam
    };
  }).filter(s => s.text.length > 0).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const commentCount = comments[item.id]?.length || 0;
  
  let narasiCerita = "Kondisi terpantau normal";
  if (item.isViral || commentCount > 10) narasiCerita = "Sedang ramai dibahas warga setempat";
  else if (medsos.length > 0) narasiCerita = "Berdasarkan pantauan terbaru di media sosial";
  else if (estimasiOrang > 20) narasiCerita = "Banyak warga terpantau di lokasi saat ini";
  else if (laporan.length > 0) narasiCerita = "Ada laporan update masuk dari warga";

  let badgeStatus = "Tenang";
  let badgeColor = "bg-emerald-50 text-emerald-600 border-emerald-100";
  if (item.isViral || commentCount > 15) {
    badgeStatus = "🔥 Viral";
    badgeColor = "bg-rose-50 text-rose-600 border-rose-100";
  } else if (estimasiOrang > 25) {
    badgeStatus = "🏃 Ramai";
    badgeColor = "bg-orange-50 text-orange-600 border-orange-100";
  } else if (estimasiOrang > 10) {
    badgeStatus = "👀 Populer";
    badgeColor = "bg-amber-50 text-amber-600 border-amber-100";
  }

  const suasana = laporan.find(l => l.tipe === "keramaian" || l.tipe === "suasana") || null;
  const antrian = laporan.find(l => l.tipe === "antrian") || null;
  const aktivitasUtama = aktivitas[0] || null;

  return {
    estimasiOrang,
    allSignals,
    narasiCerita,
    badgeStatus,
    badgeColor,
    category: item.category || item.kategori || "",
    isRamai: estimasiOrang > 15,
    isViral: commentCount > 5,
    headline: generateHeadline({ item, estimasiOrang, antrian, aktivitasUtama, suasana }),
    activityTime: item.lastActivity || item.updated_at || new Date().toISOString()
  };
}