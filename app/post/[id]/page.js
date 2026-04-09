"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useTheme } from "@/app/hooks/useTheme";
import FeedCard from "@/app/components/feed/FeedCard";
import LocationProvider, { useLocation } from "@/components/LocationProvider";

function TempatDetailContent({ id }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = useTheme();
  const { location, status: locationStatus } = useLocation();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [highlightCommentId, setHighlightCommentId] = useState(null);
  const cardRef = useRef(null);

  const isMalam = theme.isMalam;

  // Ambil parameter dari URL
  const komentarId = searchParams.get("komentar_id");
  const mention = searchParams.get("mention");

  useEffect(() => {
    if (komentarId) setHighlightCommentId(parseInt(komentarId));
  }, [komentarId]);

  useEffect(() => {
    fetchTempatDetail();
  }, [id]);

  // Scroll ke card setelah data loaded
  useEffect(() => {
    if (!loading && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      
      // Jika ada highlight, tambahkan efek
      if (highlightCommentId || mention) {
        setTimeout(() => {
          const highlightElement = document.querySelector(`.comment-highlight-${highlightCommentId}`);
          if (highlightElement) {
            highlightElement.scrollIntoView({ behavior: "smooth", block: "center" });
            highlightElement.classList.add("ring-2", "ring-orange-500", "animate-pulse");
            setTimeout(() => {
              highlightElement.classList.remove("ring-2", "ring-orange-500", "animate-pulse");
            }, 3000);
          }
        }, 500);
      }
    }
  }, [loading, highlightCommentId, mention]);

  const fetchTempatDetail = async () => {
    setLoading(true);
    try {
      const { data: tempat, error: tempatError } = await supabase
        .from("tempat")
        .select(`
          id, 
          name, 
          category, 
          alamat, 
          photos, 
          latitude, 
          longitude, 
          created_at,
          image_url
        `)
        .eq("id", id)
        .single();

      if (tempatError) throw tempatError;

      const { data: laporan, error: laporanError } = await supabase
        .from("laporan_warga")
        .select(`
          id, 
          tempat_id, 
          photo_url, 
          video_url, 
          content, 
          created_at, 
          user_name, 
          tipe, 
          time_tag,
          comments:laporan_comments(*)
        `)
        .eq("tempat_id", id)
        .order("created_at", { ascending: false });

      if (laporanError) throw laporanError;

      const mergedItem = {
        ...tempat,
        laporan_terbaru: laporan || []
      };

      setItem(mergedItem);
    } catch (err) {
      console.error("Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex justify-center items-center min-h-screen ${theme.bg}`}>
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen ${theme.bg} p-4`}>
        <p className={`text-sm ${theme.textMuted} mb-4`}>
          {error || "Tempat tidak ditemukan"}
        </p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium"
        >
          Kembali
        </button>
      </div>
    );
  }

  return (
    <main className={`relative min-h-screen ${theme.bg}`}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-inherit border-b border-slate-200/10">
        <div className="mx-auto w-[92%] max-w-[400px]">
          <div className="flex items-center gap-3 py-3">
            <button
              onClick={() => router.back()}
              className={`p-2 rounded-full transition-all active:scale-95
                ${isMalam ? "hover:bg-white/10" : "hover:bg-slate-100"}`}
            >
              <ArrowLeft size="18" className={theme.text} />
            </button>
            <h1 className={`text-base font-semibold ${theme.text}`}>Detail Tempat</h1>
            {highlightCommentId && (
              <span className="text-[10px] text-orange-500">Menuju komentar...</span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-[92%] max-w-[400px] mt-4 pb-20" ref={cardRef}>
        <FeedCard
          item={item}
          location={location}
          locationReady={locationStatus === "granted"}
          openAIModal={() => {}}
          openKomentarModal={() => {}}
          onShare={() => {}}
          highlightCommentId={highlightCommentId}
        />
      </div>
    </main>
  );
}

// Wrapper
export default function TempatDetailPage({ params }) {
  const { id } = params;
  
  return (
    <LocationProvider>
      <TempatDetailContent id={id} />
    </LocationProvider>
  );
}