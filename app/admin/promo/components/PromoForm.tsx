"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { sendPromo } from "@/lib/promo/targeting";
import TargetAudienceSelector from "./TargetAudienceSelector";
import {
  Send, Loader2, AlertCircle, Target, CheckCircle, Image as ImageIcon,
  Tag, Clock, Link2, FileText, Megaphone
} from "lucide-react";

const PROMO_TEMPLATES = {
  video: {
    title: "🎬 Video Premium Baru!",
    message: "Nikmati konten eksklusif terbaru. Dapatkan akses dengan 10 poin saja!",
    redirect_url: "/video",
    cta_text: "Tonton Sekarang →"
  },
  live: {
    title: "🔴 Live Streaming Spesial!",
    message: "Siaran langsung akan segera dimulai! Siapkan poin untuk akses tontonan.",
    redirect_url: "/live",
    cta_text: "Lihat Jadwal →"
  },
  product: {
    title: "🛍️ Diskon Produk Lokal!",
    message: "Dapatkan diskon khusus untuk produk UMKM setempat. Jangan lewatkan!",
    redirect_url: "/marketplace",
    cta_text: "Belanja Sekarang →"
  },
  voucher: {
    title: "🎫 Voucher Eksklusif!",
    message: "Tukarkan poinmu dengan voucher menarik dari merchant favorit!",
    redirect_url: "/rumah-warga",
    cta_text: "Tukar Voucher →"
  },
  subscription: {
    title: "📺 Berlangganan Premium!",
    message: "Dapatkan akses tak terbatas ke semua konten premium dengan berlangganan.",
    redirect_url: "/premium",
    cta_text: "Langganan Sekarang →"
  },
  discount: {
    title: "💰 Promo Diskon!",
    message: "Diskon spesial untuk produk pilihan. Gunakan kode promo sekarang!",
    redirect_url: "/promo",
    cta_text: "Lihat Promo →"
  },
  general: {
    title: "📢 Informasi Penting!",
    message: "Ada informasi terbaru untuk warga Setempat. Simak selengkapnya!",
    redirect_url: "/info",
    cta_text: "Baca Selengkapnya →"
  }
};

interface PromoFormProps {
  userId: string;
  isAdmin: boolean;
  onSuccess?: () => void;
}

export default function PromoForm({ userId, isAdmin, onSuccess }: PromoFormProps) {
  const [form, setForm] = useState({
    title: "",
    message: "",
    promoType: "general",
    redirectUrl: "/",
    ctaText: "Lihat Detail →",
    imageUrl: "",
    discountValue: "",
    discountCode: "",
    validUntil: "",
    targeting: {
      targetType: "all",
      radiusKm: undefined,
      latitude: undefined,
      longitude: undefined,
      city: "",
      district: "",
      village: "",
      roles: [],
      activeDays: undefined
    }
  });

  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ total: number; inserted: number } | null>(null);

  const applyTemplate = (type: string) => {
    const template = PROMO_TEMPLATES[type as keyof typeof PROMO_TEMPLATES];
    if (!template) return;
    setForm(prev => ({
      ...prev,
      ...template,
      promoType: type
    }));
  };

  const handleChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleTargetingChange = (targeting: any) => {
    setForm(prev => ({ ...prev, targeting }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title.trim() || !form.message.trim()) {
      setError("Judul dan pesan harus diisi!");
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await sendPromo({
        title: form.title,
        message: form.message,
        promoType: form.promoType,
        redirectUrl: form.redirectUrl,
        ctaText: form.ctaText,
        imageUrl: form.imageUrl || undefined,
        discountValue: form.discountValue || undefined,
        discountCode: form.discountCode || undefined,
        validUntil: form.validUntil || undefined,
        targeting: form.targeting
      }, userId);

      setResult({
        total: result.totalUsers,
        inserted: result.inserted
      });
      setSuccess(true);

      // Reset form
      setForm(prev => ({
        ...prev,
        title: "",
        message: "",
        imageUrl: "",
        discountValue: "",
        discountCode: "",
        validUntil: "",
        redirectUrl: "/",
        ctaText: "Lihat Detail →",
        targeting: { targetType: "all" }
      }));

      if (onSuccess) onSuccess();

      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.error("Error sending promo:", err);
      setError(err.message || "Gagal mengirim promo");
    } finally {
      setSending(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Error & Success */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {success && result && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-2">
          <CheckCircle size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-emerald-400">
              ✅ Promo berhasil dikirim ke {result.total} user!
            </p>
            <p className="text-[10px] text-emerald-400/60">
              {result.inserted} notifikasi berhasil dimasukkan
            </p>
          </div>
        </div>
      )}

      {/* Template Selector */}
      <div className="grid grid-cols-7 gap-1.5">
        {Object.keys(PROMO_TEMPLATES).map((type) => {
          const template = PROMO_TEMPLATES[type as keyof typeof PROMO_TEMPLATES];
          const isActive = form.promoType === type;
          const colors: Record<string, string> = {
            video: 'blue',
            live: 'red',
            product: 'amber',
            voucher: 'emerald',
            subscription: 'purple',
            discount: 'rose',
            general: 'slate'
          };
          const color = colors[type] || 'slate';

          return (
            <button
              key={type}
              type="button"
              onClick={() => applyTemplate(type)}
              className={`p-1.5 rounded-lg text-center transition-all text-[8px] font-bold ${isActive
                  ? `bg-${color}-500/20 border-${color}-500/50 text-${color}-400 border`
                  : `bg-slate-900 border-slate-700 text-slate-400 border hover:bg-slate-800`
                }`}
            >
              <div className="text-base">{template.title.split(' ')[0]}</div>
              <span className="uppercase">{type}</span>
            </button>
          );
        })}
      </div>

      {/* Form Fields */}
      <div>
        <label className="text-xs text-slate-400 block mb-1">Judul Notifikasi *</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="Contoh: 🎬 Video Premium Baru!"
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm"
          required
        />
      </div>

      <div>
        <label className="text-xs text-slate-400 block mb-1">Pesan *</label>
        <textarea
          value={form.message}
          onChange={(e) => handleChange('message', e.target.value)}
          placeholder="Tulis pesan promosi..."
          rows={3}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm resize-none"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">URL Tujuan</label>
          <input
            type="text"
            value={form.redirectUrl}
            onChange={(e) => handleChange('redirectUrl', e.target.value)}
            placeholder="/live, /rumah-warga"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Tombol CTA</label>
          <input
            type="text"
            value={form.ctaText}
            onChange={(e) => handleChange('ctaText', e.target.value)}
            placeholder="Lihat Detail →"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Diskon (opsional)</label>
          <input
            type="text"
            value={form.discountValue}
            onChange={(e) => handleChange('discountValue', e.target.value)}
            placeholder="10%, Rp5.000"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Kode Promo (opsional)</label>
          <input
            type="text"
            value={form.discountCode}
            onChange={(e) => handleChange('discountCode', e.target.value)}
            placeholder="PROMO10"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm uppercase"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Gambar URL (opsional)</label>
          <input
            type="text"
            value={form.imageUrl}
            onChange={(e) => handleChange('imageUrl', e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Berlaku Hingga (opsional)</label>
          <input
            type="datetime-local"
            value={form.validUntil}
            onChange={(e) => handleChange('validUntil', e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm"
          />
        </div>
      </div>

      {/* Target Audience */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Target size={16} className="text-purple-400" />
          <h4 className="text-sm font-bold text-white">🎯 Target Audiens</h4>
        </div>
        <TargetAudienceSelector
          value={form.targeting}
          onChange={handleTargetingChange}
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={sending || !form.title.trim() || !form.message.trim()}
        className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all"
      >
        {sending ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Mengirim...
          </>
        ) : (
          <>
            <Send size={18} />
            Kirim Promo
          </>
        )}
      </button>
    </form>
  );
}