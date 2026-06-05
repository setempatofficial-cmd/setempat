"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, ChevronLeft, ChevronRight, Building2, History, Users } from "lucide-react";
import Image from "next/image";
import { useState, useRef, useMemo, useEffect } from "react";

export default function StoryStrip({
  laporanWarga = [],
  tempat = {},
  onSelectStory,
  activeStoryId,
  activeCategoryStories = [],
  isOpen,
  onClose,
  onAddStory
}) {
  const [imageErrors, setImageErrors] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedStories, setSelectedStories] = useState([]);
  const scrollContainerRef = useRef(null);

  // Parse photos JSONB dari tabel tempat
  const tempatPhotos = useMemo(() => {
    if (!tempat?.photos) return [];
    try {
      if (typeof tempat.photos === 'string') {
        const parsed = JSON.parse(tempat.photos);
        return Array.isArray(parsed) ? parsed : [];
      }
      if (Array.isArray(tempat.photos)) {
        return tempat.photos;
      }
      return [];
    } catch (e) {
      console.error("Gagal parse photos:", e);
      return [];
    }
  }, [tempat?.photos]);

  // 1. Kategori Laporan Warga
  const wargaStories = useMemo(() => {
    if (!laporanWarga || !Array.isArray(laporanWarga)) return [];

    return laporanWarga
      .filter(l => l && (l?.photo_url || l?.image_url || l?.video_url))
      .map((l, idx) => ({
        id: l?.id ? `warga_${l.id}` : `warga_idx_${idx}`,
        photo_url: l.photo_url || l.image_url,
        video_url: l.video_url || null,
        title: l.deskripsi || l.content || "Laporan Warga",
        user_name: l.user_name || l.username || "Warga",
        type: "warga",
        source: "laporan_warga",
        originalData: l
      }));
  }, [laporanWarga]);

  // 2. Kategori Official Media
  const officialStories = useMemo(() => {
    const stories = [];

    if (tempat?.image_url && typeof tempat.image_url === 'string' && tempat.image_url.trim() !== '') {
      stories.push({
        id: `official_main_${tempat.id || 'tempat'}`,
        photo_url: tempat.image_url,
        title: tempat.name || "Foto Utama",
        user_name: "Official",
        description: tempat.description,
        type: "official",
        source: "tempat.image_url",
        originalData: tempat
      });
    }

    if (tempatPhotos.length > 0) {
      tempatPhotos.forEach((photo, idx) => {
        if (!photo) return;

        const photoUrl = photo.url || photo.photo_url || photo.image_url || photo.video_url;
        if (!photoUrl) return;

        const kategori = photo.kategori || photo.category || photo.type || '';
        const isSejarah = kategori === 'sejarah' || kategori === 'sejarah_peristiwa' || kategori === 'history' || photo.is_sejarah === true;
        const isWarga = kategori === 'warga';

        if (!isSejarah && !isWarga) {
          stories.push({
            id: photo?.id ? `official_${photo.id}` : `official_idx_${idx}`,
            photo_url: !/\.(mp4|mov|avi|mkv|webm|m3u8)$/i.test(photoUrl) ? photoUrl : null,
            video_url: /\.(mp4|mov|avi|mkv|webm|m3u8)$/i.test(photoUrl) ? photoUrl : null,
            title: photo.caption || photo.title || photo.judul || "Foto Official",
            user_name: photo.uploader || "Official",
            description: photo.deskripsi || photo.keterangan,
            type: "official",
            source: "tempat.photos",
            originalData: photo
          });
        }
      });
    }

    return stories;
  }, [tempat, tempatPhotos]);

  // 3. Kategori Sejarah
  const sejarahStories = useMemo(() => {
    const stories = [];

    if (tempatPhotos.length > 0) {
      tempatPhotos.forEach((photo, idx) => {
        if (!photo) return;

        const photoUrl = photo.url || photo.photo_url || photo.image_url;
        if (!photoUrl) return;

        const kategori = photo.kategori || photo.category || photo.type || '';
        const isSejarah = kategori === 'sejarah' || kategori === 'sejarah_peristiwa' || kategori === 'history' || photo.is_sejarah === true;

        if (isSejarah) {
          stories.push({
            id: photo?.id ? `sejarah_${photo.id}` : `sejarah_idx_${idx}`,
            photo_url: photoUrl,
            title: photo.caption || photo.title || photo.judul || "Dokumen Sejarah",
            tahun: photo.tahun || photo.year,
            user_name: photo.uploader || "Tim Sejarah",
            description: photo.deskripsi || photo.keterangan,
            type: "sejarah",
            source: "tempat.photos",
            originalData: photo
          });
        }
      });
    }

    return stories;
  }, [tempatPhotos]);

  const categories = useMemo(() => [
    {
      id: "warga",
      label: "Laporan Warga",
      icon: Users,
      stories: wargaStories,
      gradient: "from-orange-500 to-red-500",
      emptyMessage: "Belum ada laporan warga"
    },
    {
      id: "official",
      label: "Official Media",
      icon: Building2,
      stories: officialStories,
      gradient: "from-blue-500 to-cyan-500",
      emptyMessage: "Belum ada foto official"
    },
    {
      id: "sejarah",
      label: "Sejarah & Peristiwa",
      icon: History,
      stories: sejarahStories,
      gradient: "from-amber-600 to-yellow-500",
      emptyMessage: "Belum ada dokumen sejarah"
    }
  ], [wargaStories, officialStories, sejarahStories]);

  const totalStories = wargaStories.length + officialStories.length + sejarahStories.length;

  // FIX LOGIKA TOGGLE BERGANTI ISI:
  const handleCategoryClick = (stories, categoryLabel, categoryId) => {
    if (!stories || stories.length === 0) return;

    if (selectedCategory === categoryId) {
      // Jika kategori yang sama di-klik lagi, cari story berikutnya (next index)
      const currentIndex = stories.findIndex(s => s.id === activeStoryId);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % stories.length;
      const nextStory = stories[nextIndex];

      if (onSelectStory) {
        onSelectStory(nextStory, stories, categoryId, nextIndex);
      }
    } else {
      // FIX UTAMA: Menambahkan kata 'else' yang hilang agar alur tidak tabrakan
      setSelectedCategory(categoryId);
      setSelectedStories(stories);

      const firstStory = stories[0];
      if (onSelectStory) {
        // Kirim list full stories dari kategori tersebut ke parent agar HeroCard tahu total isinya
        onSelectStory(firstStory, stories, categoryId, 0);
      }
    }
  };

  const handleImageError = (id) => {
    if (id) {
      setImageErrors(prev => ({ ...prev, [id]: true }));
    }
  };

  const handleScroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setSelectedCategory(null);
      setSelectedStories([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div className="fixed inset-0 z-50 isolate" key="storystrip-modal">
          <motion.div
            key="storystrip-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-transparent pointer-events-auto"
          />

          <motion.div
            key="storystrip-modal-container"
            initial={{ y: "100vh" }}
            animate={{ y: 0 }}
            exit={{ y: "100vh" }}
            transition={{ type: "spring", damping: 32, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 pointer-events-none"
            style={{ height: "auto", maxHeight: "60vh", WebkitFontSmoothing: "subpixel-antialiased" }}
          >
            <div
              key="storystrip-content"
              className="bg-gradient-to-t from-zinc-950 via-zinc-950 to-zinc-900/98 border-t border-white/10 rounded-t-[28px] pt-3 px-4 pb-3 shadow-[0_-20px_50px_rgba(0,0,0,0.95)] flex flex-col pointer-events-auto"
              style={{ maxWidth: "420px", marginLeft: "auto", marginRight: "auto", width: "100%" }}
            >
              <div className="w-10 h-1 bg-white/30 rounded-full mx-auto mb-3 cursor-pointer" onClick={onClose} />

              <div className="flex items-center justify-between mb-3 shrink-0">
                <div>
                  <h4 className="text-sm font-black text-white tracking-tight flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center">
                      <Eye size={12} className="text-cyan-400" />
                    </div>
                    Cerita & Momen
                    {tempat?.name && <span className="text-[10px] font-normal text-white/40 ml-1">• {tempat.name}</span>}
                  </h4>
                  <p className="text-[9px] text-white/40 mt-0.5">{totalStories} momen • tap untuk lihat cerita</p>
                </div>
                <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                  <X size={14} className="text-white" />
                </button>
              </div>

              <div className="relative flex-1 min-h-0">
                {totalStories > 3 && (
                  <>
                    <button onClick={() => handleScroll('left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white"><ChevronLeft size={14} /></button>
                    <button onClick={() => handleScroll('right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white"><ChevronRight size={14} /></button>
                  </>
                )}

                <div
                  ref={scrollContainerRef}
                  className="flex gap-5 overflow-x-auto pb-4 pt-2 px-2 justify-start snap-x snap-mandatory scrollbar-hide"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                >
                  {categories.map((cat, catIdx) => {
                    const hasStories = cat.stories.length > 0;
                    const isActive = selectedCategory === cat.id;
                    const previewPhoto = hasStories ? (cat.stories[0].photo_url || cat.stories[0].video_url) : null;
                    const hasError = imageErrors[cat.id];

                    return (
                      <div key={`category-${cat.id}-${catIdx}`} className="flex flex-col items-center gap-1.5 snap-start shrink-0 group">
                        <div className="relative">
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            disabled={!hasStories}
                            onClick={() => handleCategoryClick(cat.stories, cat.label, cat.id)}
                            className={`relative p-[2px] rounded-full transition-all duration-300 ${isActive
                              ? 'bg-gradient-to-br from-cyan-400 to-indigo-500 ring-2 ring-cyan-400/30'
                              : hasStories ? `bg-gradient-to-tr ${cat.gradient}` : 'bg-zinc-800 border border-dashed border-zinc-600'
                              }`}
                          >
                            <div className="relative w-14 h-14 rounded-full overflow-hidden bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                              {hasStories && previewPhoto && !hasError ? (
                                <Image
                                  src={previewPhoto}
                                  alt={cat.label}
                                  fill
                                  sizes="56px"
                                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={() => handleImageError(cat.id)}
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center">
                                  <cat.icon size={18} className="text-white/30" />
                                  <span className="text-[6px] text-white/30 mt-0.5">{hasStories ? 'Error' : 'Kosong'}</span>
                                </div>
                              )}
                            </div>
                            {hasStories && (
                              <span className="absolute -top-1 -right-1 bg-cyan-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full border border-white/20 min-w-[16px] text-center">
                                {cat.stories.length}
                              </span>
                            )}
                          </motion.button>
                        </div>
                        <span className={`text-[9px] font-semibold max-w-[70px] text-center truncate ${isActive ? 'text-cyan-400' : 'text-white/70'}`}>{cat.label}</span>
                        {isActive && <span className="text-[5px] text-cyan-400/80 tracking-widest">● PLAYING</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="shrink-0 mt-2 pt-2 border-t border-white/10 text-center">
                <p className="text-[6px] text-white/30 tracking-wider">
                  {totalStories === 0 ? "Belum ada cerita untuk tempat ini" : `Geser untuk lihat semua • ${totalStories} cerita`}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}