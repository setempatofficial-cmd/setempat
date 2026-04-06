"use client";
import { useState, useEffect, useRef, memo } from "react";
import { motion } from "framer-motion";
import FeedCard from "@/app/components/feed/FeedCard";

// Skeleton yang mirip dengan FeedCard asli
const FeedCardSkeleton = memo(() => (
  <div className="w-full animate-pulse">
    {/* Header skeleton */}
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-zinc-700" />
        <div className="space-y-2">
          <div className="h-3 bg-zinc-700 rounded w-24" />
          <div className="h-2 bg-zinc-700 rounded w-16" />
        </div>
      </div>
      <div className="w-8 h-8 rounded-full bg-zinc-700" />
    </div>
    
    {/* Image/Media skeleton */}
    <div className="aspect-square bg-zinc-700" />
    
    {/* Action buttons skeleton */}
    <div className="flex gap-4 p-3">
      <div className="w-8 h-8 rounded-full bg-zinc-700" />
      <div className="w-8 h-8 rounded-full bg-zinc-700" />
      <div className="w-8 h-8 rounded-full bg-zinc-700" />
    </div>
    
    {/* Content skeleton */}
    <div className="p-4 space-y-2">
      <div className="h-3 bg-zinc-700 rounded w-32" />
      <div className="space-y-1">
        <div className="h-2 bg-zinc-700 rounded w-full" />
        <div className="h-2 bg-zinc-700 rounded w-3/4" />
      </div>
    </div>
  </div>
));

FeedCardSkeleton.displayName = 'FeedCardSkeleton';

export default function LazyFeedCard({ 
  item, 
  index,
  locationReady, 
  location, 
  comments,
  selectedPhotoIndex,
  setSelectedPhotoIndex,
  openAIModal,
  openKomentarModal,
  onShare,
  priority = false, // 3 card pertama langsung load
  prefetchDistance = 300 // jarak prefetch (px)
}) {
  const [shouldLoad, setShouldLoad] = useState(priority);
  const [hasPrefetched, setHasPrefetched] = useState(false);
  const cardRef = useRef(null);
  
  // 🔥 Intersection Observer dengan rootMargin untuk prefetch
  useEffect(() => {
    // Jika priority (card pertama), langsung load
    if (priority) {
      setShouldLoad(true);
      return;
    }
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Mulai load saat card mendekati viewport
          if (entry.isIntersecting && !hasPrefetched) {
            setShouldLoad(true);
            setHasPrefetched(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0,
        rootMargin: `${prefetchDistance}px` // 🔥 Mulai load sebelum card masuk layar!
      }
    );
    
    if (cardRef.current) {
      observer.observe(cardRef.current);
    }
    
    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, [priority, hasPrefetched, prefetchDistance]);
  
  // 🔥 Prefetch image/media sebelum card di-render
  useEffect(() => {
    if (shouldLoad && item && !hasPrefetched) {
      setHasPrefetched(true);
      
      // Prefetch image_url jika ada
      if (item.image_url && !item.image_url.includes('placeholder')) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = item.image_url;
        document.head.appendChild(link);
        
        setTimeout(() => {
          if (document.head.contains(link)) document.head.removeChild(link);
        }, 5000);
      }
      
      // Prefetch photo pertama dari photos
      const firstPhoto = getFirstPhotoUrl(item.photos);
      if (firstPhoto && !firstPhoto.includes('placeholder')) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'image';
        link.href = firstPhoto;
        document.head.appendChild(link);
      }
    }
  }, [shouldLoad, item, hasPrefetched]);
  
  // Helper ambil URL foto pertama
  const getFirstPhotoUrl = (photos) => {
    if (!photos) return null;
    if (Array.isArray(photos) && photos[0]) {
      return typeof photos[0] === 'string' ? photos[0] : photos[0].url;
    }
    if (typeof photos === 'object') {
      const timeKeys = ['pagi', 'siang', 'sore', 'malam'];
      for (const key of timeKeys) {
        const data = photos[key];
        if (data) {
          if (Array.isArray(data) && data[0]) {
            return typeof data[0] === 'string' ? data[0] : data[0].url;
          }
          if (typeof data === 'string') return data;
          if (data.url) return data.url;
        }
      }
    }
    return null;
  };
  
  return (
    <div ref={cardRef} className="mb-6">
      {shouldLoad ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <FeedCard
            item={item}
            locationReady={locationReady}
            location={location}
            comments={comments}
            selectedPhotoIndex={selectedPhotoIndex}
            setSelectedPhotoIndex={setSelectedPhotoIndex}
            openAIModal={openAIModal}
            openKomentarModal={openKomentarModal}
            onShare={onShare}
          />
        </motion.div>
      ) : (
        <FeedCardSkeleton />
      )}
    </div>
  );
}