"use client";

import { useEffect, useState } from "react";

export default function AIModal({ isOpen, onClose, tempat }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (isOpen && tempat) {
      setMessages([
        {
          id: 1,
          type: "ai",
          text: `Halo! Saya AI Setempat. Mau tanya apa tentang ${tempat.name}?`,
          time: "Baru saja",
        },
      ]);
    }
  }, [isOpen, tempat]);

  if (!isOpen) return null;

  const handleSend = () => {
    if (!input.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        type: "user",
        text: input,
        time: "Baru saja",
      },
    ]);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          type: "ai",
          text: "Maaf, fitur AI masih dalam pengembangan. Nanti akan bisa jawab pertanyaan tentang jam buka, antrian, promo, dan lainnya!",
          time: "Baru saja",
        },
      ]);
    }, 1000);

    setInput("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[80vh] overflow-hidden bg-white rounded-t-2xl animate-slide-up sm:rounded-2xl">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl text-[#E3655B]">🤖</span>
            <div>
              <span className="font-semibold">Tanya AI Setempat</span>
              <p className="text-xs text-gray-400">{tempat?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-xl text-gray-400">
            ✕
          </button>
        </div>

        <div className="h-96 p-4 space-y-4 overflow-y-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2 ${msg.type === "user" ? "flex-row-reverse" : ""
                }`}
            >
              {msg.type === "ai" && (
                <div className="flex items-center justify-center w-8 h-8 bg-opacity-10 rounded-full bg-[#E3655B] flex-shrink-0">
                  <span className="text-[#E3655B]">🤖</span>
                </div>
              )}
              <div
                className={`max-w-[80%] ${msg.type === "user"
                  ? "bg-[#E3655B] text-white"
                  : "bg-gray-100"
                  } rounded-2xl p-3`}
              >
                <p className="text-sm">{msg.text}</p>
                <p
                  className={`text-xs mt-1 ${msg.type === "user" ? "text-white/70" : "text-gray-400"
                    }`}
                >
                  {msg.time}
                </p>
              </div>
            </div>
          ))}

          {messages.length === 1 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-gray-400">Pertanyaan cepat:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "Jam operasional?",
                  "Lagi antrian?",
                  "Info parkir",
                  "Live music?",
                ].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(q);
                      setTimeout(() => handleSend(), 100);
                    }}
                    className="px-3 py-2 text-xs bg-gray-100 rounded-full hover:bg-gray-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tanya sesuatu..."
              className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E3655B] focus:ring-opacity-50"
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${input.trim()
                ? "bg-[#E3655B] text-white shadow-sm"
                : "bg-gray-200 text-gray-400"
                }`}
            >
              <span className="text-lg">➤</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}