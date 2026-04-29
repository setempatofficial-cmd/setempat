'use client';

import React, { useState, useEffect } from 'react';
import { X, Star, Plus, Package } from 'lucide-react'; // Tambahkan Package di sini
import { supabase } from '@/lib/supabaseClient';

export default function UlasanModal({ isOpen, onClose, product, userId, onSuccess }) {
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('Warga Setempat');

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserName();
    }
  }, [isOpen, userId]);

  const fetchUserName = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();
      
      if (data?.full_name) setUserName(data.full_name);
    } catch (err) {
      console.error("Gagal ambil nama:", err);
    }
  };

  if (!isOpen) return null;

  const handleSubmitReview = async () => {
    if (!userId) return alert('Silakan login dulu ya');
    if (!reviewText.trim()) return alert('Monggo diisi ulasannya dulu, Cak.');
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('ulasan')
        .insert({
          produk_id: product.id,
          user_id: userId,
          rating: rating,
          komentar: reviewText,
          nama_pembeli: userName // Nama diambil dari profiles.full_name
        });

      if (error) throw error;
      
      alert('✅ Maturnuwun! Ulasan sampeyan sudah terpasang.');
      onSuccess?.(); // Ini akan memicu fetchUlasan di modal detail
      onClose();
      setReviewText('');
      setRating(5);
    } catch (err) {
      alert('Gagal kirim ulasan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-[420px] rounded-t-[40px] p-8 pb-10 animate-in slide-in-from-bottom duration-500 shadow-2xl relative">
        
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-stone-200 rounded-full" />

        <div className="flex justify-between items-start mb-8 mt-2">
          <div>
            <h3 className="font-black text-2xl text-stone-900 leading-none mb-2">Cerita Warga</h3>
            <p className="text-sm text-stone-500 font-medium italic">Bagikan kesan sampeyan tentang produk ini</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 bg-stone-50 rounded-full text-stone-400 active:scale-90"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-8">
          {/* Foto produk mini */}
          <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-2xl">
            {product.foto_url?.[0] ? (
              <img src={product.foto_url[0]} alt={product.nama_barang} className="w-12 h-12 rounded-xl object-cover" />
            ) : (
              <div className="w-12 h-12 bg-stone-200 rounded-xl flex items-center justify-center">
                <Package size={24} className="text-stone-400" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-black text-stone-800 truncate">{product.nama_barang}</p>
              <p className="text-xs text-stone-500 truncate">Sebagai: {userName}</p>
            </div>
          </div>

          {/* Rating Bintang */}
          <div className="flex flex-col items-center">
            <div className="flex gap-3 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button 
                  key={star} 
                  type="button"
                  onClick={() => setRating(star)}
                  className="transition-all active:scale-125"
                >
                  <Star 
                    size={40} 
                    className={star <= rating ? "text-yellow-400" : "text-stone-100"} 
                    fill={star <= rating ? "currentColor" : "none"}
                    strokeWidth={star <= rating ? 0 : 2}
                  />
                </button>
              ))}
            </div>
            <span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full uppercase tracking-widest">
              {rating === 5 ? 'Jos Gandos!' : rating === 4 ? 'Apik Cak' : rating === 3 ? 'Cukup' : 'Kurang'}
            </span>
          </div>

          {/* Komentar */}
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Komentar Sampeyan</label>
            <textarea 
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Contoh: Barangnya seger pol, kirimnya cepet..."
              className="w-full p-5 bg-stone-50 border-2 border-transparent focus:border-orange-500 focus:bg-white rounded-[24px] transition-all outline-none text-sm min-h-[140px] resize-none leading-relaxed"
            />
          </div>

          {/* Tombol Kirim */}
          <button 
            onClick={handleSubmitReview}
            disabled={loading}
            className="w-full py-5 bg-stone-900 text-white rounded-[24px] font-black shadow-xl shadow-stone-200 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:bg-stone-300"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <div className="bg-white/20 p-1 rounded-md">
                  <Plus size={18} />
                </div>
                PASANG ULASAN SEKARANG
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}