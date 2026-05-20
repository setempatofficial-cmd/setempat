"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from 'react-markdown';
import { X, Send, Loader2, Sparkles, Bot, MapPin } from "lucide-react";

export default function AIModalDetail({
  isOpen,
  onClose,
  item,
  initialQuery,
  userId
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [quickPrompts, setQuickPrompts] = useState([]);
  const [greeting, setGreeting] = useState("");
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // ==================== SCROLL TO BOTTOM ====================
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end"
      });
    }, 100);
  }, []);

  // Scroll setiap ada pesan baru
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // Scroll saat loading selesai
  useEffect(() => {
    if (!isLoading) {
      scrollToBottom();
    }
  }, [isLoading, scrollToBottom]);

  // ==================== LOAD QUICK PROMPTS DARI API ====================
  useEffect(() => {
    if (!isOpen || !item?.id) return;

    const loadQuickPrompts = async () => {
      setIsLoadingPrompts(true);
      try {
        const response = await fetch("/api/chat/quick-prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tempatId: item.id,
            userId: userId
          }),
        });

        const data = await response.json();

        if (data.success) {
          setGreeting(data.greeting);
          setQuickPrompts(data.quickPrompts);

          setMessages([{
            id: "greet",
            role: "assistant",
            content: data.greeting,
          }]);
        } else {
          setMessages([{
            id: "greet",
            role: "assistant",
            content: `Halo! 👋 Ada yang bisa saya bantu tentang ${item.name}?`,
          }]);
          setQuickPrompts([
            { text: `Info tentang ${item.name}?`, icon: "ℹ️" },
            { text: "Jam operasional?", icon: "🕐" },
            { text: "Gimana kondisinya?", icon: "📊" }
          ]);
        }
      } catch (error) {
        console.error("Error loading prompts:", error);
        setMessages([{
          id: "greet",
          role: "assistant",
          content: `Halo! 👋 Ada yang bisa saya bantu tentang ${item.name}?`,
        }]);
      } finally {
        setIsLoadingPrompts(false);
      }
    };

    loadQuickPrompts();
  }, [isOpen, item, userId]);

  // ==================== HANDLE QUICK PROMPT CLICK ====================
  const handleQuickPrompt = (prompt) => {
    handleSend(prompt.text);
  };

  // ==================== SEND MESSAGE ====================
  const handleSend = useCallback(async (forcedQuery = null) => {
    const userMessage = forcedQuery || input.trim();
    if (!userMessage || isLoading) return;

    if (!forcedQuery) setInput("");

    // Add user message
    setMessages(prev => [...prev, {
      id: Date.now(),
      role: "user",
      content: userMessage,
    }]);

    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          tempat: item,
          modalType: "tempat_detail"
        }),
      });

      const data = await response.json();
      const reply = data.text || data.reply || "Maaf, saya kurang paham. Coba tanyakan hal lain ya!";

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: "assistant",
        content: reply,
      }]);

    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: "assistant",
        content: "Maaf, terjadi kesalahan teknis. Silakan coba lagi nanti. 🙏",
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, item]);

  // ==================== RESET ====================
  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setInput("");
      setQuickPrompts([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="relative w-full max-w-[420px] h-[85vh] sm:h-[600px] bg-gradient-to-b from-zinc-950 to-black border-t sm:border border-white/10 sm:rounded-[28px] overflow-hidden flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/5 bg-zinc-900/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E3655B]/10 flex items-center justify-center">
                <Bot size={22} className="text-[#E3655B]" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white">AI SETEMPAT</h2>
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin size={10} className="text-[#E3655B]" />
                  <p className="text-[9px] text-white/60 font-bold truncate max-w-[180px]">
                    {item?.name}
                  </p>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full bg-white/5 hover:bg-white/10">
              <X size={18} className="text-white/40" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
            {messages.map((msg) => (
              <motion.div
                initial={{ opacity: 0, x: msg.role === "user" ? 10 : -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[85%] p-3.5 text-sm leading-relaxed ${msg.role === "user"
                    ? "bg-[#E3655B] text-white rounded-[20px] rounded-tr-none"
                    : "bg-white/5 border border-white/10 text-white/90 rounded-[20px] rounded-tl-none"
                  }`}>
                  {msg.role === "assistant" ? (
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
                        strong: ({ children }) => <strong className="font-bold text-[#E3655B]">{children}</strong>,
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

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 p-3.5 rounded-[20px] rounded-tl-none">
                  <div className="flex gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#E3655B] rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-[#E3655B] rounded-full animate-bounce delay-75" />
                    <span className="w-1.5 h-1.5 bg-[#E3655B] rounded-full animate-bounce delay-150" />
                  </div>
                </div>
              </div>
            )}

            {/* QUICK PROMPTS */}
            {!isLoadingPrompts && quickPrompts.length > 0 && messages.length <= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 space-y-2"
              >
                <p className="text-[10px] text-white/40 font-medium px-1">✨ Yuk tanya ini dulu:</p>
                <div className="flex flex-wrap gap-2">
                  {quickPrompts.map((prompt, idx) => (
                    <motion.button
                      key={idx}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => handleQuickPrompt(prompt)}
                      className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all active:scale-95"
                    >
                      <span className="text-sm">{prompt.icon}</span>
                      <span className="text-[11px] font-medium text-white/80">
                        {prompt.text}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-zinc-900/80 border-t border-white/5">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Tanya sesuatu..."
                className="flex-1 px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-[#E3655B]/50"
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                className="p-2.5 rounded-xl bg-[#E3655B] text-white disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}