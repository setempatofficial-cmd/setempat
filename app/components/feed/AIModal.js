"use client";

import { useEffect, useState, useRef, useCallback } from "react";

export default function AIModal({ isOpen, onClose, tempat, context }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [translateY, setTranslateY] = useState(0);

  const modalContentRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto scroll ke pesan terbaru
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      setTranslateY(0);
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && tempat) {
      // 1. Tentukan Pesan Pembuka berdasarkan Konteks
      let openingText = `Halo! Saya warga AI Setempat yang ngerti **kondisi real-time** di ${tempat.name}.\n\nAdakah yang bisa dibantu?`;

      if (context === "status" || context === "antrean") {
        openingText = `Tentu! Mengenai **antrean dan kondisi** di ${tempat.name}, saat ini terpantau ${tempat.vibe_status || 'Normal'}.\n\nSaya buatkan laporan singkatnya ya...`;
      } else if (context === "visual") {
        openingText = `Halo! Mau tahu suasana di ${tempat.name}? Saya bisa infokan soal live music, spot foto, atau vibe tempatnya sekarang.`;
      }

      setMessages([
        {
          id: 1,
          type: "ai",
          text: openingText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      // 2. AUTO-REPLY JIKA KONTEKSNYA ANTREAN
      if (context === "status" || context === "antrean") {
        setIsTyping(true);
        const timer = setTimeout(() => {
          const autoResponse = {
            id: Date.now() + 99,
            type: "ai",
            text: getRealTimeResponse("antrian", tempat),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages(prev => [...prev, autoResponse]);
          setIsTyping(false);
        }, 1200);

        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, tempat, context]);

  // Handle touch untuk swipe down
  const handleTouchStart = useCallback((e) => {
    const modalContent = modalContentRef.current;
    if (!modalContent) return;

    if (modalContent.scrollTop <= 0) {
      setIsDragging(true);
      setStartY(e.touches[0].clientY);
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;

    if (diff > 0) {
      e.preventDefault();
      setTranslateY(Math.min(diff, 150));
    }
  }, [isDragging, startY]);

  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      if (translateY > 80) {
        onClose();
      } else {
        setTranslateY(0);
      }
      setIsDragging(false);
    }
  }, [isDragging, translateY, onClose]);

  // FUNGSI UTAMA: Kirim pesan ke API
const handleSend = async (customMessage) => {
    const messageToSend = customMessage || input;
    if (!messageToSend.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: "user",
      text: messageToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageToSend,
          tempat: tempat,
          context: context,
        }),
      });

      const data = await response.json();
      console.log("Respon dari API:", data); // Cek di F12 apakah 'text' muncul

      if (data && data.text) {
        const aiResponse = {
          id: Date.now() + 1,
          type: "ai",
          text: data.text,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, aiResponse]);
      } else {
        throw new Error("Data text tidak ditemukan");
      }
    } catch (err) {
      console.error("Chat Error:", err);
      
      // Jika API Error, gunakan fallback cerdas kamu
      const fallbackText = getRealTimeResponse(messageToSend, tempat);
      const fallbackResponse = {
        id: Date.now() + 1,
        type: "ai",
        text: `(Offline Mode) ${fallbackText}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackResponse]);
    } finally {
      setIsTyping(false);
    }
  };
  // Fungsi untuk memberikan respons real-time (FALLBACK)
  const getRealTimeResponse = useCallback((question, tempat) => {
    const lowerQuestion = question.toLowerCase();
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0 = Minggu, 1 = Senin, dst

    // Helper untuk kondisi waktu
    const isWeekend = day === 0 || day === 6;
    const isDinnerTime = hour >= 18 && hour <= 21;
    
    // Simulasi data real-time (nanti bisa diganti dengan API)
    const randomQueue = Math.floor(Math.random() * 30) + 5; // 5-35 menit
    const randomPeople = Math.floor(Math.random() * 80) + 20; // 20-100 orang

    // Respons berdasarkan konteks real-time
    if (lowerQuestion.includes("rame") || lowerQuestion.includes("ramai") || lowerQuestion.includes("sepi") || lowerQuestion.includes("antrian")) {
      if (isWeekend) {
        if (hour >= 18 && hour <= 21) {
          return `📍 **Update Real-time** (${now.getHours()}:${now.getMinutes()} WIB)\n\n**Kondisi:** Sangat ramai (weekend + dinner time)\n**Antrian:** ${randomQueue + 15} menit\n**Pengunjung:** ~${randomPeople + 40} orang\n**Parkir:** 80% terisi\n\n💡 *Tips: Better reserve meja dulu atau datang sebelum jam 6 sore*`;
        } else if (hour >= 11 && hour <= 14) {
          return `📍 **Update Real-time** (${now.getHours()}:${now.getMinutes()} WIB)\n\n**Kondisi:** Ramai (lunch time)\n**Antrian:** ${randomQueue + 5} menit\n**Pengunjung:** ~${randomPeople} orang\n**Parkir:** 60% terisi\n\n💡 *Masih oke buat mampir, antrian gercep*`;
        } else {
          return `📍 **Update Real-time** (${now.getHours()}:${now.getMinutes()} WIB)\n\n**Kondisi:** Normal\n**Antrian:** ${randomQueue - 5} menit\n**Pengunjung:** ~${randomPeople - 20} orang\n**Parkir:** 40% terisi\n\n💡 *Santai, nggak perlu nunggu lama*`;
        }
      } else {
        if (hour >= 17 && hour <= 20) {
          return `📍 **Update Real-time** (${now.getHours()}:${now.getMinutes()} WIB)\n\n**Kondisi:** Ramai (after work)\n**Antrian:** ${randomQueue} menit\n**Pengunjung:** ~${randomPeople - 10} orang\n**Parkir:** 50% terisi\n\n💡 *Lumayan rame tapi masih worth it*`;
        } else {
          return `📍 **Update Real-time** (${now.getHours()}:${now.getMinutes()} WIB)\n\n**Kondisi:** Sepi\n**Antrian:** Nggak ada\n**Pengunjung:** ~${Math.floor(randomPeople / 3)} orang\n**Parkir:** Banyak tersedia\n\n💡 *Pas banget buat yang pengen santai*`;
        }
      }
    } else if (lowerQuestion.includes("live music") || lowerQuestion.includes("musik")) {
      if (isWeekend) {
        if (hour >= 19 && hour <= 23) {
          return `🎵 **Live Music - SEDANG BERLANGSUNG**\n\nMulai 30 menit yang lalu, akan sampai jam 11 malam.\nGenre: Akustik Pop & Rock\nPenyanyi: @bintang_akustik\n\n**Lagu yang dibawain sekarang:**\n• "Kemarin" - Seventeen\n• "Happier" - Olivia Rodrigo\n\n💡 *Lagi asik banget, mampir sambil dinner*`;
        } else if (hour < 19) {
          return `🎵 **Live Music - HARI INI**\n\nAkan mulai jam 7 malam nanti.\nBawa band spesial weekend!\n\n💡 *Dateng lebih awal biar dapet spot depan*`;
        } else {
          return `🎵 **Live Music**\n\nUdah selesai untuk hari ini.\nBesok (${isWeekend ? 'Minggu' : 'Sabtu'}) ada lagi jam 7 malam.`;
        }
      } else {
        return `🎵 **Live Music**\n\nWeekend aja (Jumat-Minggu).\nNext: Jumat jam 7 malam.`;
      }
    } else if (lowerQuestion.includes("parkir")) {
      const parkirMobil = isWeekend ? (isDinnerTime ? "Penuh" : "Sisa 5 slot") : (isDinnerTime ? "Sisa 3 slot" : "Banyak");
      const parkirMotor = isWeekend ? (isDinnerTime ? "Sisa 10 slot" : "Banyak") : "Banyak";

      return `🅿️ **Info Parkir - REAL TIME**\n\n**Mobil:** ${parkirMobil}\n**Motor:** ${parkirMotor}\n**Tarif:**\n• Motor: Rp 2.000\n• Mobil: Rp 5.000\n\n💡 ${parkirMobil.includes('Penuh') ? 'Better pakai motor atau Grab' : 'Masih aman'}`;
    } else if (lowerQuestion.includes("wifi") || lowerQuestion.includes("cepat") || lowerQuestion.includes("internet") || lowerQuestion.includes("signal")) {
      const speedNow = isWeekend && isDinnerTime ? "25-30 Mbps" : "45-50 Mbps";
      const stability = isWeekend && isDinnerTime ? "Kadang melambat" : "Stabil banget";

      return `📶 **WiFi ${tempat?.name} - LIVE**\n\n**Kecepatan sekarang:** ${speedNow}\n**Kondisi:** ${stability}\n**Cocok buat:**\n• Video call ✅\n• Meeting online ✅\n• Streaming 4K ${isWeekend && isDinnerTime ? '⚠️ (bisa buffering)' : '✅'}\n\n💡 *Pas buat WFA (Work From Anywhere)*`;
    } else if (lowerQuestion.includes("promo") || lowerQuestion.includes("diskon") || lowerQuestion.includes("murah") || lowerQuestion.includes("spesial")) {
      const promos = [
        "🍔 **Buy 1 Get 1** semua minuman - hari ini aja!",
        "🎉 **Diskon 30%** untuk pembelian di atas 100rb (berlaku 2 jam lagi)",
        "📱 **Review di Google Maps** - gratis 1 es kopi susu",
        `🎂 **Birthday promo** - gratis dessert untuk yang berulang bulan ${now.toLocaleString('id', { month: 'long' })}`,
      ];

      const randomPromo = promos[Math.floor(Math.random() * promos.length)];

      return `💰 **PROMO REAL-TIME**\n\n${randomPromo}\n\n⏰ *Batas klaim: ${now.getHours() + 2}:${now.getMinutes()} WIB*`;
    } else if (lowerQuestion.includes("menu") || lowerQuestion.includes("makanan") || lowerQuestion.includes("minuman") || lowerQuestion.includes("best seller")) {
      return `🍽️ **Menu Best Seller - HARI INI**\n\n**Makanan:**\n• Nasi Goreng Kampung (🍗 + 🍳) - 35 porsi sold\n• Mie Gacoan (level 2) - 28 porsi sold\n• Kentang Goreng Keju - 22 porsi sold\n\n**Minuman:**\n• Es Kopi Susu Kekinian - 45 cup sold\n• Thai Tea - 32 cup sold\n• Lemon Tea - 28 cup sold\n\n💡 *Es Kopi Susu lagi best banget hari ini!*`;
    } else if (lowerQuestion.includes("tempat") || lowerQuestion.includes("lokasi") || lowerQuestion.includes("detail")) {
      return `📍 **Info ${tempat?.name}**\n\n**Alamat:** ${tempat?.alamat || 'Jl. Contoh No. 123'}\n**Jam Buka:** 08.00 - 23.00 (setiap hari)\n**Fasilitas:** WiFi, Parkir luas, Mushola, Live Music (weekend)\n**Kontak:** 0812-3456-7890\n\n💡 *Tanya kondisi real-time buat tau lagi rame apa sepi*`;
    } else {
      return `Hmm, soal "${question}" aku belum punya data real-time nya. Tapi kamu bisa tanya:\n\n• Lagi rame apa sepi?\n• Ada live music nggak?\n• Parkir masih available?\n• WiFi cepet?\n• Promo hari ini?\n\nLangsung aja, aku cek real-time! 🚀`;
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        ref={modalContentRef}
        className="relative w-full max-w-md h-full sm:h-[90vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-xl transition-transform duration-200 ease-out"
        style={{
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag indicator */}
        <div className="sticky top-0 z-20 flex justify-center pt-2 pb-1 bg-white rounded-t-2xl">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="sticky top-[10px] z-10 bg-white px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E3655B] to-[#c24b45] flex items-center justify-center shadow-sm">
                <span className="text-xl text-white">🤖</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-gray-900">
                    AI Setempat
                  </h2>
                  <span className="bg-green-500 w-2 h-2 rounded-full animate-pulse"></span>
                </div>
                <p className="text-xs text-gray-600">
                  {tempat?.name} • Real-time update
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <span className="text-xl text-gray-600">✕</span>
            </button>
          </div>
        </div>

        {/* Messages Container */}
        <div
          className="overflow-y-auto px-4"
          style={{ height: 'calc(100vh - 180px)' }}
        >
          <div className="py-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-2 ${
                  msg.type === "user" ? "flex-row-reverse" : ""
                }`}
              >
                {/* Avatar AI */}
                {msg.type === "ai" && (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-[#E3655B] to-[#c24b45] flex-shrink-0 shadow-sm">
                    <span className="text-sm text-white">🤖</span>
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] ${
                    msg.type === "user"
                      ? "bg-gradient-to-br from-[#E3655B] to-[#c24b45] text-white rounded-2xl rounded-tr-sm"
                      : "bg-gray-100 text-gray-900 rounded-2xl rounded-tl-sm"
                  } px-4 py-2.5 shadow-sm`}
                >
                  <p className="text-sm whitespace-pre-line leading-relaxed">
                    {msg.text}
                  </p>
                  <p
                    className={`text-[10px] mt-1 ${
                      msg.type === "user" ? "text-white/70" : "text-gray-500"
                    }`}
                  >
                    {msg.time}
                  </p>
                </div>

                {/* Spacer untuk user avatar */}
                {msg.type === "user" && <div className="w-8" />}
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex items-start gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-[#E3655B] to-[#c24b45] flex-shrink-0 shadow-sm">
                  <span className="text-sm text-white">🤖</span>
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick questions real-time */}
            {messages.length === 1 && !isTyping && (
              <div className="mt-6 space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tanya Real-time
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { text: "👥 Lagi rame?", query: "Lagi rame?" },
                    { text: "🎵 Live music sekarang?", query: "Ada live music?" },
                    { text: "🅿️ Parkir penuh?", query: "Parkir penuh?" },
                    { text: "📶 WiFi cepet?", query: "WiFi cepet?" },
                    { text: "💰 Promo hari ini", query: "Promo hari ini" },
                    { text: "🍽️ Best seller", query: "Menu best seller" },
                  ].map((q, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setInput(q.query);
                        setTimeout(() => handleSend(q.query), 100);
                      }}
                      className="px-4 py-2.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition-colors text-gray-700 font-medium"
                    >
                      {q.text}
                    </button>
                  ))}
                </div>

                {/* Real-time status */}
                <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-500 text-lg">⚡</span>
                    <div>
                      <p className="text-xs font-medium text-blue-700">
                        Real-time update
                      </p>
                      <p className="text-xs text-blue-600 mt-0.5">
                        • Kondisi antrian sekarang
                        • Live music yang lagi main
                        • Ketersediaan parkir
                        • Promo yang berlaku
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Section */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 focus-within:ring-2 focus-within:ring-[#E3655B] focus-within:ring-opacity-50">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tanya kondisi real-time..."
                className="w-full bg-transparent text-sm text-gray-900 placeholder-gray-500 focus:outline-none"
                onKeyPress={(e) => e.key === "Enter" && handleSend()}
              />
            </div>
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                input.trim() && !isTyping
                  ? "bg-gradient-to-br from-[#E3655B] to-[#c24b45] text-white shadow-sm hover:shadow-md"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              <span className="text-lg">➤</span>
            </button>
          </div>

          {/* Real-time indicator */}
          <p className="text-[10px] text-gray-400 text-center mt-2 flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
            Live • update real-time kondisi sekarang
          </p>
        </div>
      </div>
    </div>
  );
}