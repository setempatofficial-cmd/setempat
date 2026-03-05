export default function FeedInsight({
  aktivitasUtama,
  testimonialTerbaru,
  medsosTerbaru,
  topExternalComment,
  suasana,
  formatTimeAgo
}) {

  return (
    <div className="mt-3 space-y-2">

      {testimonialTerbaru && !aktivitasUtama && (
        <p className="text-sm text-gray-600 italic border-l-2 border-gray-200 pl-2">
          "{testimonialTerbaru.content}"
        </p>
      )}

      {medsosTerbaru && !aktivitasUtama && !testimonialTerbaru && (
        <p className="text-sm text-gray-600 border-l-2 border-gray-200 pl-2">
          📱 {medsosTerbaru.content}
        </p>
      )}

      {topExternalComment && !aktivitasUtama && (
        <div className="flex items-start gap-2">
          <span className="text-purple-400 text-sm mt-0.5">📱</span>

          <div className="flex-1">

            <div className="flex items-baseline gap-2">
              <span className="text-xs font-medium">
                @{topExternalComment.username}
              </span>

              <span className="text-xs text-gray-400">
                {formatTimeAgo(topExternalComment.created_at)}
              </span>
            </div>

            <p className="text-sm text-gray-700 italic">
              "{topExternalComment.content}"
            </p>

          </div>
        </div>
      )}

      {suasana && (
        <p className="text-xs text-gray-500">
          {suasana.deskripsi}
        </p>
      )}

    </div>
  )
}