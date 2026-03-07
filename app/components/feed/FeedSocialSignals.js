"use client";

export default function FeedSocialSignals({
  aktivitasUtama,
  testimonialTerbaru,
  medsosTerbaru,
  topExternalComment,
  suasana,
  formatTimeAgo
}) {
  // Jika benar-benar tidak ada data, jangan render pembungkusnya
  if (!testimonialTerbaru && !medsosTerbaru && !topExternalComment && !suasana) return null;

  return (
    <div className="mt-3 ml-8 space-y-3 border-l-2 border-gray-100 pl-4">
      
      {/* 1. TESTIMONIAL WARGA (Internal) */}
      {testimonialTerbaru && (
        <div className="space-y-1">
          <p className="text-[13px] text-gray-600 italic leading-relaxed">
            "{testimonialTerbaru.content || testimonialTerbaru.konten}"
          </p>
          <span className="text-[10px] font-bold text-emerald-600 uppercase">
            • Warga Setempat
          </span>
        </div>
      )}

      {/* 2. KOMENTAR MEDSOS EKSTERNAL (IG/TikTok/Twitter) */}
      {/* Kita hilangkan syarat !aktivitasUtama agar tetap muncul meskipun ada event */}
      {topExternalComment && (
        <div className="flex items-start gap-2 pt-1">
          <span className="text-sm mt-0.5">📱</span>
          <div className="flex-1">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-[11px] font-black text-gray-900">
                @{topExternalComment.username}
              </span>
              {topExternalComment.created_at && (
                <span className="text-[10px] text-gray-400 font-medium">
                  {formatTimeAgo(topExternalComment.created_at)}
                </span>
              )}
            </div>
            <p className="text-[13px] text-gray-700 leading-tight italic">
              "{topExternalComment.content || topExternalComment.konten || topExternalComment.text}"
            </p>
          </div>
        </div>
      )}

      {/* 3. SUASANA TERKINI */}
      {suasana && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px]">✨</span>
          <p className="text-[11px] text-gray-500 font-medium">
            {suasana.deskripsi || suasana.konten || suasana}
          </p>
        </div>
      )}

    </div>
  );
}