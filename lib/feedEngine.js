import { generateHeadline } from "./headlineEngine";

export function processFeedItem({
  item,
  locationReady,
  location,
  comments
}) {

  const estimasiOrang = parseInt(item.estimasi_orang) || 0;

  const aktivitas = item.aktivitas_terkini || [];
  const laporan = item.laporan_terbaru || [];
  const testimonial = item.testimonial_terbaru || [];
  const medsos = item.medsos_terbaru || [];
  const externalSignals = item.external_signals_terbaru || [];

  const aktivitasUtama = aktivitas.length > 0 ? aktivitas[0] : null;

  const suasana = laporan.find(
    (l) => l.tipe === "keramaian" || l.tipe === "suasana"
  );

  const antrian = laporan.find((l) => l.tipe === "antrian");

  const testimonialTerbaru = testimonial[0] || null;
  const medsosTerbaru = medsos[0] || null;

  const externalCount = externalSignals.length;

  let totalLikes = 0;
  let totalComments = 0;
  let totalConfidence = 0;

  externalSignals.forEach((s) => {
    totalLikes += s.likes_count || 0;
    totalComments += s.comments_count || 0;
    totalConfidence += s.confidence || 0;
  });

  const avgConfidence =
    externalCount > 0 ? totalConfidence / externalCount : 0;

  const topExternalComment = externalSignals
    .filter((s) => s.content)
    .sort((a, b) => (b.comments_count || 0) - (a.comments_count || 0))[0];

  // ===== BADGE LOGIC =====

  const isRamai = estimasiOrang > 20 || externalCount > 5;

  const isViral =
    (comments[item.id]?.length || 0) > 5 ||
    totalLikes > 100 ||
    totalComments > 20;

  const isHits = externalCount > 2 && avgConfidence > 0.9;

  const isDekat =
    locationReady && item.distance && item.distance < 1;

  const isBaru = (() => {
    const last = item.lastActivity ? new Date(item.lastActivity) : null;
    return last && Date.now() - last < 30 * 60 * 1000;
  })();

  const headline = generateHeadline({
    item,
    estimasiOrang,
    antrian,
    aktivitasUtama
  });

  return {
    estimasiOrang,
    aktivitasUtama,
    suasana,
    testimonialTerbaru,
    medsosTerbaru,
    topExternalComment,
    externalSignals,
    isRamai,
    isViral,
    isHits,
    isDekat,
    isBaru,
    headline
  };
}