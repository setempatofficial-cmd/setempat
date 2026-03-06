"use client";

import { useState } from "react";
import PhotoSlider from "./PhotoSlider";
import { generateHeadline } from "../../../lib/headlineEngine";
import FeedActions from "./FeedActions";
import { processFeedItem } from "../../../lib/feedEngine";

// Komponen untuk menampilkan nilai sinyal dengan cerdas
const SignalValue = ({ value }) => {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') return <span>“{value}”</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const firstItem = value.find(v => v?.deskripsi || v?.komentar || v?.konten) || value[0];
    const text = firstItem?.deskripsi || firstItem?.komentar || firstItem?.konten;
    if (text) {
      return (
        <span>
          “{text}” {value.length > 1 && <span className="text-gray-500">+{value.length - 1}</span>}
        </span>
      );
    }
    return <span>{value.length} laporan</span>;
  }

  if (typeof value === 'object') {
    const text = value.deskripsi || value.komentar || value.konten || value.text;
    if (text) return <span>“{text}”</span>;
    if (value.username && value.tipe) {
      return <span>Laporan {value.tipe} dari {value.username}</span>;
    }
    return <span>[{value.tipe || 'data'}]</span>;
  }

  return <span>{String(value)}</span>;
};

export default function FeedCard({
  item,
  index,
  locationReady,
  location,
  comments,
  selectedPhotoIndex,
  setSelectedPhotoIndex,
  openAIModal,
  openKomentarModal,
  formatTimeAgo,
  displayLocation,
  onLapor,
  onShare,
}) {
  const [expanded, setExpanded] = useState({});
  const toggleExpand = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const getAlamatSingkat = (alamat) => {
    if (!alamat) return "";
    const parts = alamat.split(",").map(p => p.trim());
    return parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : alamat;
  };

  const alamatSingkat = getAlamatSingkat(item.alamat);
  const feed = processFeedItem({ item, comments, locationReady, location });
  const headline = generateHeadline({
    item,
    estimasiOrang: feed.estimasiOrang,
    antrian: feed.antrian,
    aktivitasUtama: feed.aktivitasUtama,
  });

  const photos = item.photos || (item.image_url ? [item.image_url] : [
    "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500",
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500",
  ]);

  const currentPhotoIndex = selectedPhotoIndex[item.id] || 0;

  // Ambil waktu aktivitas terbaru
  const getLatestActivityTime = () => {
    let latest = null;
    if (Array.isArray(feed.medsosTerbaru)) {
      feed.medsosTerbaru.forEach(ms => {
        if (ms.waktu && (!latest || new Date(ms.waktu) > new Date(latest))) latest = ms.waktu;
      });
    }
    if (feed.testimonialTerbaru?.waktu) {
      if (!latest || new Date(feed.testimonialTerbaru.waktu) > new Date(latest)) latest = feed.testimonialTerbaru.waktu;
    }
    return latest;
  };
  const activityTime = getLatestActivityTime();

  // Format jarak
  const distanceText = displayLocation?.distance
    ? displayLocation.distance < 1
      ? `${Math.round(displayLocation.distance * 1000)}m`
      : `${displayLocation.distance.toFixed(1)}km`
    : null;

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm relative">

      {/* HEADER: Aktivitas terbaru + jarak */}
      <div className="flex justify-between items-center px-4 pt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          {activityTime ? `Aktivitas terbaru ${formatTimeAgo(activityTime)}` : "Belum ada aktivitas terkini"}
        </span>
        {distanceText && (
          <span className="flex items-center gap-1">
            <span>📍</span> {distanceText}
          </span>
        )}
      </div>

      {/* HEADLINE */}
      <div className="px-4 mt-2">
        <div className="flex items-start gap-2">
          <span className="text-3xl">{headline.icon}</span>
          <p className="flex-1 text-2xl font-bold text-[#2D2D2D] leading-tight">{headline.text}</p>
        </div>
        {feed.aktivitasUtama && feed.estimasiOrang && (
          <p className="text-sm text-gray-500 mt-1 ml-10">
            {feed.aktivitasUtama} • {feed.estimasiOrang} orang
          </p>
        )}
      </div>

      {/* FOTO */}
      <div className="px-4 mt-3">
        <PhotoSlider
          photos={photos}
          itemId={item.id}
          selectedPhotoIndex={currentPhotoIndex}
          setSelectedPhotoIndex={setSelectedPhotoIndex}
          isRamai={feed.isRamai}
          isViral={feed.isViral}
          isHits={feed.isHits}
          isDekat={feed.isDekat}
          isBaru={feed.isBaru}
        />
      </div>

      {/* NAMA TEMPAT & META */}
      <div className="px-4 mt-2">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium text-[#E3655B]">{item.name}</span>
          <span className="text-xs text-gray-400">• {alamatSingkat}</span>
        </div>
        {item.jam_operasional && (
          <div className="text-xs text-gray-400 mt-1">🕒 {item.jam_operasional}</div>
        )}
      </div>

      {/* BLOK SINYAL REAL-TIME */}
      <div className="px-4 mt-3 space-y-3">

        {/* Insight singkat */}
        {(feed.estimasiOrang || feed.antrian || feed.suasana) && (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span className="text-lg">📊</span>
            <span>
              {feed.estimasiOrang && `${feed.estimasiOrang} orang • `}
              {feed.antrian && `${feed.antrian} antrean • `}
              {feed.suasana && <>Suasana: <SignalValue value={feed.suasana} /></>}
            </span>
          </div>
        )}

        {/* Sinyal sosial */}
        <div className="space-y-2">
          {Array.isArray(feed.medsosTerbaru) && feed.medsosTerbaru.slice(0, 2).map((ms, idx) => (
            <div key={`medsos-${idx}`} className="flex items-start gap-2 text-sm">
              <span className="text-base">
                {ms.platform === 'instagram' ? '📸' : ms.platform === 'twitter' ? '🐦' : '📱'}
              </span>
              <div>
                <span className="font-medium">{ms.username}</span>
                <span className="text-gray-600">: </span>
                <SignalValue value={ms.konten} />
                <span className="text-xs text-gray-400 ml-1">• {formatTimeAgo(ms.waktu)}</span>
              </div>
            </div>
          ))}

          {feed.testimonialTerbaru && typeof feed.testimonialTerbaru === 'object' && (
            <div className="flex items-start gap-2 text-sm">
              <span className="text-base">🗣️</span>
              <div>
                <span className="font-medium">{feed.testimonialTerbaru.username}</span>
                <span className="text-gray-600">: </span>
                <SignalValue value={feed.testimonialTerbaru.komentar} />
                <span className="text-xs text-gray-400 ml-1">• {formatTimeAgo(feed.testimonialTerbaru.waktu)}</span>
              </div>
            </div>
          )}

          {/* Tombol "X sinyal lainnya" */}
          {(() => {
            const medsosCount = Array.isArray(feed.medsosTerbaru) ? feed.medsosTerbaru.length : 0;
            const testimonialCount = feed.testimonialTerbaru ? 1 : 0;
            const totalSignals = medsosCount + testimonialCount;
            const displayedSignals = Math.min(medsosCount, 2) + (testimonialCount ? 1 : 0);
            const remainingSignals = totalSignals - displayedSignals;

            if (remainingSignals > 0) {
              return (
                <button
                  onClick={() => { /* TODO: buka modal */ }}
                  className="text-sm text-blue-600 flex items-center gap-1 mt-1"
                >
                  <span>➕ {remainingSignals} sinyal lainnya</span>
                </button>
              );
            }
            return null;
          })()}
        </div>
      </div>

      {/* TOMBOL AKSI */}
      <div className="px-4 mt-4 pb-4">
        <FeedActions
          item={item}
          comments={comments}
          openAIModal={openAIModal}
          openKomentarModal={openKomentarModal}
          onLapor={onLapor}
          onShare={onShare}
        />
      </div>
    </div>
  );
}