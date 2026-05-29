"use client";
import { motion, AnimatePresence } from "framer-motion";
import Uploader from "@/components/Uploader";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function StoryCircle({
  laporanWarga = [],
  tempatId,
  namaTempat,
  tempatKategori,
  openStoryModal
}) {
  const [stories, setStories] = useState(laporanWarga);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [tempThumbnail, setTempThumbnail] = useState(null);
  const refreshTimeoutRef = useRef(null);
  const syncTimeoutRef = useRef(null); // 🔥 Jeda untuk sync
  const prevTempatIdRef = useRef(tempatId);

  // Filter stories
  const laporanDenganFoto = stories.filter(l => l?.photo_url || l?.image_url || l?.video_url);
  const laporanTerbaru = tempThumbnail || laporanDenganFoto[0];
  const jumlahStory = tempThumbnail ? laporanDenganFoto.length + 1 : laporanDenganFoto.length;

  const inisial = namaTempat
    ? namaTempat.split(" ").map(word => word[0]).join("").substring(0, 2).toUpperCase()
    : "??";

  // Preload image thumbnail
  useEffect(() => {
    if (laporanTerbaru?.photo_url || laporanTerbaru?.image_url) {
      const imgUrl = laporanTerbaru.photo_url || laporanTerbaru.image_url;
      const img = new Image();
      img.onload = () => setImageLoaded(true);
      img.src = imgUrl;
    } else {
      setImageLoaded(false);
    }
  }, [laporanTerbaru]);

  // 🔥 Fungsi refresh stories dengan JEDA
  const refreshStories = useCallback(async (silent = false, withDelay = true) => {
    // Hapus timeout sebelumnya
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Fungsi actual refresh
    const doRefresh = async () => {
      if (prevTempatIdRef.current !== tempatId) {
        prevTempatIdRef.current = tempatId;
      }

      try {
        const { data, error } = await supabase
          .from("laporan_warga")
          .select("id, photo_url, image_url, video_url, created_at, user_name, user_id, user_avatar, tipe, deskripsi, tempat")
          .eq("tempat_id", tempatId)
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) throw error;

        if (data && JSON.stringify(data) !== JSON.stringify(stories)) {
          setStories(data);
          // 🔥 JEDA: Hapus temp thumbnail setelah data real masuk (delay 500ms)
          setTimeout(() => {
            setTempThumbnail(null);
          }, 500);
        }
      } catch (err) {
        if (!silent) console.error("Error refreshing stories:", err);
      }
    };

    // 🔥 Jika dengan jeda, tunggu 1.5 detik sebelum sync ke database
    if (withDelay && tempThumbnail) {
      syncTimeoutRef.current = setTimeout(doRefresh, 1500);
    } else {
      await doRefresh();
    }
  }, [tempatId, stories, tempThumbnail]);

  // Reset state saat tempatId berubah
  useEffect(() => {
    setStories(laporanWarga);
    setImageLoaded(false);
    setUploadSuccess(false);
    setIsUploading(false);
    setTempThumbnail(null);

    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
  }, [tempatId, laporanWarga]);

  // 🔥 Listen untuk upload event
  useEffect(() => {
    const handleUploadStart = () => {
      setIsUploading(true);
      setUploadSuccess(false);
    };

    const handleUploadSuccess = async (event) => {
      const newStory = event.detail;

      // 🔥 LANGSUNG tampilkan thumbnail (tanpa nunggu database)
      if (newStory && (newStory.photo_url || newStory.image_url)) {
        setTempThumbnail({
          photo_url: newStory.photo_url || newStory.image_url,
          image_url: newStory.image_url,
          created_at: new Date().toISOString()
        });
        setImageLoaded(false);
      }

      setIsUploading(false);
      setUploadSuccess(true);

      // 🔥 JEDA 1.5 DETIK sebelum sync ke database
      // Biar PhotoSlider tidak berebut
      await refreshStories(true, true);

      setTimeout(() => setUploadSuccess(false), 2000);
    };

    const handleUploadFailed = () => {
      setIsUploading(false);
      setUploadSuccess(false);
      setTempThumbnail(null);
    };

    window.addEventListener('story-upload-start', handleUploadStart);
    window.addEventListener('story-upload-success', handleUploadSuccess);
    window.addEventListener('story-upload-failed', handleUploadFailed);

    return () => {
      window.removeEventListener('story-upload-start', handleUploadStart);
      window.removeEventListener('story-upload-success', handleUploadSuccess);
      window.removeEventListener('story-upload-failed', handleUploadFailed);
    };
  }, [refreshStories]);

  // Refresh saat halaman visible (dengan jeda)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = setTimeout(() => refreshStories(true, false), 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, [refreshStories]);

  return (
    <div className="relative flex items-center justify-center w-20 h-20 group isolate select-none [-webkit-tap-highlight-color:transparent]">

      {/* Ring animasi */}
      {(jumlahStory > 0 || isUploading) && (
        <>
          <div className={`absolute inset-[-4px] rounded-full blur-md animate-pulse z-0 
            ${isUploading ? 'bg-yellow-500/40' : 'bg-cyan-500/20'}`}
          />

          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-[-3px] rounded-full z-0"
            style={{
              background: isUploading
                ? "conic-gradient(from 0deg, #f59e0b, #fbbf24, #f59e0b, #f59e0b)"
                : "conic-gradient(from 0deg, #22d3ee, #d946ef, #f59e0b, #22d3ee)",
              padding: "2.5px",
              WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />
        </>
      )}

      {/* Lingkaran utama */}
      <motion.div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (jumlahStory > 0 && typeof openStoryModal === "function") {
            // Kirim data termasuk temp thumbnail jika ada
            const allStories = tempThumbnail
              ? [{
                id: 'temp-new',
                photo_url: tempThumbnail.photo_url,
                image_url: tempThumbnail.image_url,
                created_at: tempThumbnail.created_at,
                isTemp: true
              }, ...laporanDenganFoto]
              : laporanDenganFoto;
            openStoryModal(tempatId, allStories);
          }
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className={`relative w-full h-full rounded-full z-10 bg-zinc-950 cursor-pointer overflow-hidden
          border-[3px] ${jumlahStory > 0 ? "border-black" : "border-white/5"}
          shadow-[0_8px_20px_rgba(0,0,0,0.8)] transition-all duration-500
          ${uploadSuccess ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-black' : ''}`}
      >
        {(laporanTerbaru?.photo_url || laporanTerbaru?.image_url) ? (
          <>
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 animate-pulse flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            <motion.img
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: imageLoaded ? 1 : 0 }}
              whileHover={{ scale: 1.15 }}
              src={laporanTerbaru.photo_url || laporanTerbaru.image_url}
              className={`w-full h-full object-cover brightness-[0.8] group-hover:brightness-110 transition-all duration-700 pointer-events-none
                ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              alt="latest-story"
              loading="eager"
              fetchPriority="high"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

            <div className="absolute bottom-2 inset-x-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
                <motion.div
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="w-1 h-1 rounded-full bg-rose-500 shadow-[0_0_5px_#f43f5e]"
                />
                <span className="text-[6px] font-black text-white tracking-[0.1em] uppercase">
                  {tempThumbnail ? "NEW" : "LIVE"}
                </span>
              </div>
            </div>

            {tempThumbnail && (
              <div className="absolute top-2 left-2 bg-yellow-500 text-black text-[8px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                NEW
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center relative bg-zinc-900">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent" />
            <span className="text-sm font-black text-white tracking-tighter z-10 group-hover:scale-110 transition-transform">
              {inisial}
            </span>
            <span className="text-[5px] text-cyan-400 font-black uppercase z-10 tracking-[0.2em] mt-1 opacity-60">
              Setempat
            </span>
          </div>
        )}

        {/* Uploading Overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Success Checkmark */}
        {uploadSuccess && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-green-500/80 backdrop-blur-sm flex items-center justify-center"
          >
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
        )}
      </motion.div>

      {/* Tombol upload */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.2, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        className="absolute -bottom-1 -right-1 z-30"
        style={{ touchAction: "manipulation" }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="relative">
          <div className="absolute -inset-3 rounded-full bg-transparent" />

          <div className="relative w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 to-fuchsia-600 p-[2px] shadow-[0_4px_12px_rgba(0,0,0,0.5)] active:scale-95 transition-transform duration-100">
            <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center overflow-hidden 
              [&_button]:!w-full [&_button]:!h-full [&_button]:!text-[16px] [&_button]:!bg-transparent 
              [&_button]:!border-none [&_button]:!flex [&_button]:!items-center [&_button]:!justify-center
              [&_button]:active:scale-95">
              <Uploader
                tempatId={tempatId}
                namaTempat={namaTempat}
                tempatKategori={tempatKategori}
                onUploadSuccess={(newStoryData) => {
                  if (newStoryData && (newStoryData.photo_url || newStoryData.image_url)) {
                    setTempThumbnail({
                      photo_url: newStoryData.photo_url || newStoryData.image_url,
                      image_url: newStoryData.image_url,
                      created_at: new Date().toISOString()
                    });
                  }
                  // Jeda 1.5 detik sebelum refresh database
                  setTimeout(() => refreshStories(true, true), 1500);
                }}
                onRefreshNeeded={() => refreshStories(true, true)}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Jumlah story badge */}
      {jumlahStory > 1 && (
        <div className="absolute -top-1 -right-1 z-30 bg-fuchsia-600 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-black shadow-lg pointer-events-none">
          {jumlahStory}
        </div>
      )}
    </div>
  );
}