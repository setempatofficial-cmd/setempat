"use client";

import PhotoSlider from "./PhotoSlider";
import { generateHeadline } from "../../../lib/headlineEngine";
import FeedMeta from "./FeedMeta";
import FeedInsight from "./FeedInsight";
import FeedSocialSignals from "./FeedSocialSignals";
import FeedActions from "./FeedActions";
import { processFeedItem } from "../../../lib/feedEngine";

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
  currentHour
}) {

  const getAlamatSingkat = (alamat) => {
    if (!alamat) return "";
    const parts = alamat.split(",").map((p) => p.trim());
    return parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : alamat;
  };

  const alamatSingkat = getAlamatSingkat(item.alamat);

  // PROCESS FEED ENGINE
  const feed = processFeedItem({
    item,
    comments,
    locationReady,
    location
  });

  // HEADLINE
  const headline = generateHeadline({
    item,
    estimasiOrang: feed.estimasiOrang,
    antrian: feed.antrian,
    aktivitasUtama: feed.aktivitasUtama,
  });

  // PHOTOS
  const photos =
    item.photos ||
    (item.image_url
      ? [item.image_url]
      : [
          "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500",
          "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500",
        ]);

  const currentPhotoIndex = selectedPhotoIndex[item.id] || 0;

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">

      {/* PHOTO */}
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

      {/* CONTENT */}
      <div className="px-4 pt-4">

        {/* HEADLINE */}
        <div className="flex items-start gap-2">
          <span className="text-2xl">{headline.icon}</span>
          <p className="flex-1 text-lg font-semibold text-[#2D2D2D]">
            {headline.text}
          </p>
        </div>

        {/* NAMA TEMPAT */}
        <div className="flex items-center gap-1 mt-1 ml-8">
          <span className="text-sm font-medium text-[#E3655B]">
            {item.name}
          </span>

          <span className="text-xs text-gray-400">
            • {alamatSingkat}
          </span>
        </div>

        {/* META */}
        <FeedMeta
          item={item}
          locationReady={locationReady}
          formatTimeAgo={formatTimeAgo}
        />

        {/* INSIGHT */}
        <FeedInsight
          estimasiOrang={feed.estimasiOrang}
          antrian={feed.antrian}
          aktivitasUtama={feed.aktivitasUtama}
          suasana={feed.suasana}
          externalCount={feed.externalCount}
        />

        {/* SOCIAL SIGNAL */}
        <FeedSocialSignals
          aktivitasUtama={feed.aktivitasUtama}
          testimonialTerbaru={feed.testimonialTerbaru}
          medsosTerbaru={feed.medsosTerbaru}
          topExternalComment={feed.topExternalComment}
          suasana={feed.suasana}
          formatTimeAgo={formatTimeAgo}
        />

        {/* ACTION */}
        <FeedActions
          item={item}
          comments={comments}
          openAIModal={openAIModal}
          openKomentarModal={openKomentarModal}
        />

      </div>

    </div>
  );
}