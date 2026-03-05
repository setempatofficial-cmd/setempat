"use client";

export default function FeedActions({
  item,
  comments,
  openAIModal,
  openKomentarModal
}) {

  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-5 mt-2 border-t border-gray-100">

      <button
        onClick={() => openAIModal(item)}
        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200 transition"
      >
        <span className="text-base">🤖</span>
        Tanya AI
      </button>

      <button
        onClick={() => openKomentarModal(item)}
        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200 transition"
      >
        <span className="text-base">💬</span>
        {comments[item.id]?.length || 0} Suara Warga
      </button>

    </div>
  );
}