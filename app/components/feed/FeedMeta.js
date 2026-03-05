export default function FeedMeta({ item, locationReady, formatTimeAgo }) {

  const estimasiOrang = parseInt(item.estimasi_orang) || 0

  return (
    <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">

      {locationReady && item.distance && (
        <span>
          📍 {item.distance < 1
            ? `${Math.round(item.distance * 1000)}m`
            : `${item.distance.toFixed(1)}km`}
        </span>
      )}

      <span>
        🕒 {formatTimeAgo(item.updated_at || item.created_at)}
      </span>

      {estimasiOrang > 0 && (
        <span>• 👥 {estimasiOrang} orang</span>
      )}

    </div>
  )
}