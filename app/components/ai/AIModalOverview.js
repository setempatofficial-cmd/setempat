"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from 'react-markdown';
import {
  X, Sparkles, MapPin, FileText, TrendingUp,
  MessageCircle, Send, Loader2, Bot, ChevronRight,
  LayoutGrid, MessageSquare, Clock, Users, AlertCircle,
  Calendar, Building2, ExternalLink
} from "lucide-react";

export default function AIModal({ isOpen, onClose, data, userId }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [greeting, setGreeting] = useState("");

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const isOverviewMode = data?._isOverview === true;
  const matchedPlace = isOverviewMode ? data?._matchedPlace : data;
  const results = isOverviewMode ? data?._results || [] : [];
  const allLaporan = isOverviewMode ? data?._allLaporan || [] : [];

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!isOpen || !matchedPlace) return;

    const hour = new Date().getHours();
    let greetingText = "Selamat ";
    if (hour >= 5 && hour < 11) greetingText += "pagi";
    else if (hour >= 11 && hour < 15) greetingText += "siang";
    else if (hour >= 15 && hour < 19) greetingText += "sore";
    else greetingText += "malam";

    setGreeting(greetingText);

    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `${greetingText}! 👋 Saya AI SETEMPAT.\n\nSaya sudah rangkum informasi tentang **${matchedPlace.name}** di atas. Ada yang ingin ditanyakan lebih lanjut?`
    }]);
  }, [isOpen, matchedPlace]);

  const handleSend = useCallback(async () => {
    const userMessage = input.trim();
    if (!userMessage || isLoading) return;

    setInput("");
    setMessages(prev => [...prev, { id: Date.now(), role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // Gunakan API chat yang sudah ada
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          tempat: matchedPlace,
          modalType: "tempat_detail",
          richContext: {
            userLocation: {
              kode_wilayah: matchedPlace?.kode_wilayah || null
            },
            metadata: {
              deskripsi: matchedPlace?.description || null
            }
          },
          userId: userId
        }),
      });

      const data = await response.json();

      // Ambil response dari API
      let reply = data.text || data.reply;

      // Jika tidak ada response, gunakan fallback
      if (!reply) {
        reply = getLocalResponse(userMessage, matchedPlace);
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: "assistant",
        content: reply,
      }]);
    } catch (error) {
      console.error("Error:", error);
      // Fallback ke response lokal
      const reply = getLocalResponse(userMessage, matchedPlace);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: "assistant",
        content: reply,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, matchedPlace, userId]);

  // Fungsi untuk mendapatkan response dari data lokal (fallback)
  const getLocalResponse = useCallback((query, place) => {
    const lowerQuery = query.toLowerCase();
    let response = "";

    // Cari laporan untuk tempat ini
    const laporanTempat = allLaporan.filter(l => l.tempat_id === place?.id);

    if (lowerQuery.includes("kondisi") || lowerQuery.includes("ramai") || lowerQuery.includes("sepi") || lowerQuery.includes("macet")) {
      const kondisiLaporan = laporanTempat.filter(l => l.tipe && ['ramai', 'sepi', 'macet'].includes(l.tipe));
      if (kondisiLaporan.length > 0) {
        response += `**Kondisi Terkini:**\n\n`;
        kondisiLaporan.slice(0, 5).forEach((lap, idx) => {
          const icon = lap.tipe === 'ramai' ? '🟠' : lap.tipe === 'sepi' ? '🟢' : '🔴';
          response += `${idx + 1}. ${icon} **${lap.tipe?.toUpperCase()}**`;
          if (lap.content) {
            response += ` - ${lap.content}`;
          }
          if (lap.created_at) {
            response += `\n   📅 ${new Date(lap.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
          }
          response += '\n';
        });
      } else {
        response += `Belum ada laporan kondisi untuk ${place?.name}.\n`;
      }
    } else if (lowerQuery.includes("laporan")) {
      if (laporanTempat.length > 0) {
        response += `**Laporan Warga:**\n\n`;
        laporanTempat.slice(0, 5).forEach((lap, idx) => {
          response += `${idx + 1}. ${lap.content || 'Tidak ada deskripsi'}`;
          if (lap.user_name) {
            response += `\n   👤 ${lap.user_name}`;
          }
          if (lap.tipe) {
            const icon = lap.tipe === 'ramai' ? '🟠' : lap.tipe === 'sepi' ? '🟢' : '🔴';
            response += ` ${icon} ${lap.tipe}`;
          }
          if (lap.created_at) {
            response += `\n   📅 ${new Date(lap.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
          }
          response += '\n\n';
        });
      } else {
        response += `Belum ada laporan warga untuk ${place?.name}.\n`;
      }
    } else if (lowerQuery.includes("info") || lowerQuery.includes("tentang") || lowerQuery.includes("deskripsi")) {
      response += `**${place?.name}**\n\n`;
      if (place?.description) {
        response += `${place.description}\n\n`;
      }
      if (place?.alamat) {
        response += `📍 **Alamat:** ${place.alamat}\n`;
      }
      if (place?.jam_buka) {
        response += `🕐 **Jam Buka:** ${typeof place.jam_buka === 'object'
          ? Object.entries(place.jam_buka).map(([day, time]) => `${day}: ${time}`).join(', ')
          : place.jam_buka}\n`;
      }
      if (place?.estimasi_orang) {
        response += `👥 **Estimasi Pengunjung:** ${place.estimasi_orang} orang\n`;
      }
    } else if (lowerQuery.includes("jam") || lowerQuery.includes("buka")) {
      if (place?.jam_buka) {
        const jamStr = typeof place.jam_buka === 'object'
          ? Object.entries(place.jam_buka).map(([day, time]) => `${day}: ${time}`).join(', ')
          : place.jam_buka;
        response += `🕐 **Jam Buka ${place?.name}:** ${jamStr}`;
      } else {
        response += `Maaf, belum ada info jam buka untuk ${place?.name}.`;
      }
    } else if (lowerQuery.includes("alamat")) {
      if (place?.alamat) {
        response += `📍 **Alamat ${place?.name}:** ${place.alamat}`;
      } else {
        response += `Maaf, belum ada info alamat untuk ${place?.name}.`;
      }
    } else {
      // Default response - info tempat
      response += `**${place?.name}**\n\n`;
      if (place?.description) {
        response += `${place.description}\n\n`;
      }
      if (place?.alamat) {
        response += `📍 **Alamat:** ${place.alamat}\n`;
      }
      if (place?.jam_buka) {
        response += `🕐 **Jam Buka:** ${typeof place.jam_buka === 'object'
          ? Object.entries(place.jam_buka).map(([day, time]) => `${day}: ${time}`).join(', ')
          : place.jam_buka}\n`;
      }
      if (place?.estimasi_orang) {
        response += `👥 **Estimasi Pengunjung:** ${place.estimasi_orang} orang\n`;
      }
      if (laporanTempat.length > 0) {
        response += `\n📝 **Ada ${laporanTempat.length} laporan** dari warga. Tanya "laporan" untuk detailnya.`;
      } else {
        response += `\n💡 Belum ada laporan dari warga. Jadilah yang pertama melapor!`;
      }
    }

    return response;
  }, [allLaporan]);

  const quickPrompts = matchedPlace ? [
    { text: `Info tentang ${matchedPlace.name}`, icon: "ℹ️" },
    { text: "Jam operasional?", icon: "🕐" },
    { text: "Gimana kondisinya sekarang?", icon: "📊" },
    { text: "Ada laporan terbaru?", icon: "📝" }
  ] : [];

  const handleQuickPrompt = (prompt) => {
    setInput(prompt.text);
    setTimeout(() => handleSend(), 100);
  };

  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setInput("");
      setActiveTab('overview');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getConditionBadge = (condition) => {
    const styles = {
      'ramai': 'bg-orange-500/20 text-orange-500 border-orange-500/30',
      'sepi': 'bg-green-500/20 text-green-500 border-green-500/30',
      'macet': 'bg-red-500/20 text-red-500 border-red-500/30'
    };
    const icons = {
      'ramai': '🟠',
      'sepi': '🟢',
      'macet': '🔴'
    };
    return {
      className: styles[condition] || 'bg-gray-500/20 text-gray-500',
      icon: icons[condition] || '⚪'
    };
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-[480px] h-[90vh] sm:h-[650px] bg-white dark:bg-zinc-900 border-t sm:border border-gray-200 dark:border-white/10 sm:rounded-[28px] overflow-hidden flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/5 bg-white dark:bg-zinc-900/80 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <Sparkles size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                      {isOverviewMode ? "Ringkasan Pencarian" : "Informasi Tempat"}
                    </h2>
                    {matchedPlace && (
                      <p className="text-xs text-gray-500 dark:text-white/50 flex items-center gap-1">
                        <MapPin size={12} className="text-blue-500" />
                        {matchedPlace.name}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                >
                  <X size={18} className="text-gray-500 dark:text-white/40" />
                </button>
              </div>

              {/* Tab Navigation */}
              {matchedPlace && (
                <div className="flex border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-zinc-900/50 flex-shrink-0 px-4">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`py-3 px-4 text-sm font-medium transition-all relative ${activeTab === 'overview'
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60'
                      }`}
                  >
                    <span className="flex items-center gap-2">
                      <FileText size={16} />
                      Ringkasan
                    </span>
                    {activeTab === 'overview' && (
                      <motion.div
                        layoutId="tab-indicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                      />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`py-3 px-4 text-sm font-medium transition-all relative ${activeTab === 'chat'
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60'
                      }`}
                  >
                    <span className="flex items-center gap-2">
                      <MessageCircle size={16} />
                      Tanya AI
                      {messages.length > 1 && (
                        <span className="w-5 h-5 rounded-full bg-blue-500/20 text-[10px] text-blue-600 dark:text-blue-400 flex items-center justify-center">
                          {messages.length - 1}
                        </span>
                      )}
                    </span>
                    {activeTab === 'chat' && (
                      <motion.div
                        layoutId="tab-indicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                      />
                    )}
                  </button>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-gray-50 dark:bg-black/20">
                {activeTab === 'overview' ? (
                  // ====== OVERVIEW TAB ======
                  <>
                    {matchedPlace ? (
                      <div className="space-y-4">
                        {/* Header Tempat */}
                        <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-5 border border-gray-200 dark:border-white/5 shadow-sm">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {matchedPlace.name}
                              </h3>
                              {matchedPlace.category && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 mt-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-xs font-medium text-blue-600 dark:text-blue-400">
                                  <Building2 size={12} />
                                  {matchedPlace.category}
                                </span>
                              )}
                            </div>
                            {matchedPlace.latest_condition && (
                              <div className={`px-3 py-1.5 rounded-full border text-xs font-medium ${getConditionBadge(matchedPlace.latest_condition).className
                                }`}>
                                {getConditionBadge(matchedPlace.latest_condition).icon} {matchedPlace.latest_condition.charAt(0).toUpperCase() + matchedPlace.latest_condition.slice(1)}
                              </div>
                            )}
                          </div>

                          {matchedPlace.description && (
                            <p className="mt-3 text-sm text-gray-600 dark:text-white/70 leading-relaxed">
                              {matchedPlace.description}
                            </p>
                          )}
                        </div>

                        {/* Detail Informasi */}
                        <div className="grid grid-cols-2 gap-3">
                          {matchedPlace.alamat && (
                            <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-4 border border-gray-200 dark:border-white/5 shadow-sm">
                              <div className="flex items-center gap-2 text-gray-400 dark:text-white/40 text-xs font-medium mb-1">
                                <MapPin size={14} />
                                Alamat
                              </div>
                              <p className="text-sm text-gray-800 dark:text-white/80">{matchedPlace.alamat}</p>
                            </div>
                          )}

                          {matchedPlace.estimasi_orang && (
                            <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-4 border border-gray-200 dark:border-white/5 shadow-sm">
                              <div className="flex items-center gap-2 text-gray-400 dark:text-white/40 text-xs font-medium mb-1">
                                <Users size={14} />
                                Estimasi Pengunjung
                              </div>
                              <p className="text-sm text-gray-800 dark:text-white/80">{matchedPlace.estimasi_orang} orang</p>
                            </div>
                          )}

                          {matchedPlace.jam_buka && (
                            <div className="col-span-2 bg-white dark:bg-zinc-800/50 rounded-xl p-4 border border-gray-200 dark:border-white/5 shadow-sm">
                              <div className="flex items-center gap-2 text-gray-400 dark:text-white/40 text-xs font-medium mb-2">
                                <Clock size={14} />
                                Jam Operasional
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-sm">
                                {typeof matchedPlace.jam_buka === 'object' ? (
                                  Object.entries(matchedPlace.jam_buka).slice(0, 6).map(([day, time]) => (
                                    <div key={day} className="flex justify-between border-b border-gray-100 dark:border-white/5 py-1">
                                      <span className="text-gray-600 dark:text-white/60 capitalize">{day}</span>
                                      <span className="text-gray-800 dark:text-white/80 font-medium">{time}</span>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-gray-800 dark:text-white/80 col-span-3">{matchedPlace.jam_buka}</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Laporan Warga */}
                        {isOverviewMode && matchedPlace && (() => {
                          const laporanTempat = allLaporan.filter(l => l.tempat_id === matchedPlace.id);

                          if (laporanTempat.length === 0) {
                            return (
                              <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-4 border border-gray-200 dark:border-white/5 shadow-sm">
                                <div className="flex items-center gap-2 text-gray-400 dark:text-white/40 text-sm">
                                  <FileText size={16} />
                                  <span>Belum ada laporan warga untuk tempat ini</span>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="bg-white dark:bg-zinc-800/50 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm overflow-hidden">
                              <div className="p-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                  <FileText size={16} className="text-blue-500" />
                                  Laporan Warga
                                </h4>
                                <span className="text-xs text-gray-500 dark:text-white/30">{laporanTempat.length} laporan</span>
                              </div>
                              <div className="divide-y divide-gray-200 dark:divide-white/5 max-h-[200px] overflow-y-auto">
                                {laporanTempat.slice(0, 5).map((laporan, idx) => (
                                  <div key={idx} className="p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <p className="text-sm text-gray-700 dark:text-white/80">
                                          {laporan.content || 'Tidak ada deskripsi'}
                                        </p>
                                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                                          {laporan.tipe && (
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${laporan.tipe === 'ramai' ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' :
                                              laporan.tipe === 'sepi' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                                                'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                                              }`}>
                                              {laporan.tipe}
                                            </span>
                                          )}
                                          {laporan.user_name && (
                                            <span className="text-xs text-gray-400 dark:text-white/30">👤 {laporan.user_name}</span>
                                          )}
                                          <span className="text-xs text-gray-400 dark:text-white/30">
                                            {laporan.created_at ? formatDate(laporan.created_at) : ''}
                                          </span>
                                          {laporan.status && (
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${laporan.status === 'verified'
                                              ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'
                                              }`}>
                                              {laporan.status === 'verified' ? '✓ Terverifikasi' : '⏳ Pending'}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                {laporanTempat.length > 5 && (
                                  <div className="p-3 text-center text-xs text-gray-500 dark:text-white/30">
                                    +{laporanTempat.length - 5} laporan lainnya
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Hasil Pencarian Lainnya */}
                        {isOverviewMode && results.length > 1 && (
                          <div className="bg-white dark:bg-zinc-800/50 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <TrendingUp size={16} className="text-blue-500" />
                                Hasil Lainnya
                              </h4>
                              <span className="text-xs text-gray-500 dark:text-white/30">{results.length - 1} hasil</span>
                            </div>
                            <div className="divide-y divide-gray-200 dark:divide-white/5 max-h-[150px] overflow-y-auto">
                              {results
                                .filter(item => item.id !== matchedPlace?.id)
                                .slice(0, 5)
                                .map((item, idx) => (
                                  <button
                                    key={idx}
                                    className="w-full p-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left flex items-center gap-3"
                                    onClick={() => onClose()}
                                  >
                                    <span className="text-xs text-gray-400 dark:text-white/30 w-6">#{idx + 1}</span>
                                    <span className="text-sm text-gray-700 dark:text-white/70 truncate flex-1">
                                      {item?.name || item?.content?.substring(0, 40)}
                                    </span>
                                    {item?._type === 'laporan' && (
                                      <span className="text-xs text-gray-400 dark:text-white/30">📝 Laporan</span>
                                    )}
                                    <ChevronRight size={14} className="text-gray-300 dark:text-white/20" />
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Tombol ke Chat */}
                        {matchedPlace && (
                          <button
                            onClick={() => setActiveTab('chat')}
                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2 shadow-blue-500/25"
                          >
                            <MessageCircle size={18} />
                            Tanya AI Tentang Tempat Ini
                            <ChevronRight size={18} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 dark:text-white/50 py-12">
                        <Sparkles size={40} className="mx-auto mb-3 text-blue-500" />
                        <p className="text-sm">Tidak ada data tempat</p>
                      </div>
                    )}
                  </>
                ) : (
                  // ====== CHAT TAB ======
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={msg.id}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[85%] p-4 text-sm leading-relaxed ${msg.role === "user"
                          ? "bg-blue-500 text-white rounded-2xl rounded-tr-none shadow-md"
                          : "bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white/90 rounded-2xl rounded-tl-none shadow-sm"
                          }`}>
                          {msg.role === "assistant" ? (
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
                                strong: ({ children }) => <strong className="font-bold text-blue-600 dark:text-blue-400">{children}</strong>,
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                      </motion.div>
                    ))}

                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 p-4 rounded-2xl rounded-tl-none shadow-sm">
                          <div className="flex gap-1.5">
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-75" />
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-150" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quick Prompts */}
                    {messages.length <= 2 && quickPrompts.length > 0 && (
                      <div className="mt-6 space-y-3">
                        <p className="text-xs text-gray-500 dark:text-white/40 font-medium px-1">✨ Pertanyaan Populer:</p>
                        <div className="flex flex-wrap gap-2">
                          {quickPrompts.map((prompt, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleQuickPrompt(prompt)}
                              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/10 transition-all active:scale-95 shadow-sm text-sm"
                            >
                              <span className="text-base">{prompt.icon}</span>
                              <span className="font-medium text-gray-700 dark:text-white/80">
                                {prompt.text}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Chat Input - HANYA TAMPIL DI TAB CHAT */}
              {matchedPlace && activeTab === 'chat' && (
                <div className="p-4 bg-white dark:bg-zinc-900/80 border-t border-gray-200 dark:border-white/5 flex-shrink-0">
                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSend()}
                      placeholder="Tanyakan sesuatu..."
                      className="flex-1 px-4 py-3 bg-gray-100 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-gray-800 dark:text-white text-sm outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors placeholder:text-gray-400 dark:placeholder:text-white/30"
                    />
                    <button
                      onClick={handleSend}
                      disabled={isLoading || !input.trim()}
                      className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white disabled:opacity-50 hover:shadow-lg transition-all hover:scale-105"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}