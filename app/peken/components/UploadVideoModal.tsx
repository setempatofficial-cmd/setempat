// app/peken/components/UploadVideoModal.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Video, Upload, AlertCircle, Loader2, Search, Package, ShoppingBag } from 'lucide-react';
import { useCloudinaryUpload } from '../hooks/useCloudinaryUpload';
import { supabase } from '@/lib/supabaseClient';

interface UploadVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userRole: 'bakul' | 'driver' | 'rewang' | null;
  onSuccess: () => void;
}

export function UploadVideoModal({ isOpen, onClose, userId, userRole, onSuccess }: UploadVideoModalProps) {
  const [judul, setJudul] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [kategori, setKategori] = useState('');
  const [tipeVideo, setTipeVideo] = useState('promosi');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoOrientation, setVideoOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // State untuk pilih produk dari Panyangan
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [searching, setSearching] = useState(false);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const { uploadVideo, uploading, progress, error: cloudinaryError } = useCloudinaryUpload();

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setJudul('');
    setDeskripsi('');
    setKategori('');
    setTipeVideo('promosi');
    setVideoFile(null);
    setUploadError(null);
    setPreviewUrl(null);
    setVideoOrientation('portrait');
    setSelectedProduct(null);
    setSearchQuery('');
    setSearchResults([]);
    setShowProductSearch(false);
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setUploadError('File harus berupa video');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setUploadError('Ukuran video maksimal 100MB');
      return;
    }

    setVideoFile(file);
    setUploadError(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Deteksi orientasi video setelah dimuat
    const video = document.createElement('video');
    video.src = url;
    video.addEventListener('loadedmetadata', () => {
      if (video.videoHeight > video.videoWidth) {
        setVideoOrientation('portrait');
      } else {
        setVideoOrientation('landscape');
      }
    });
  };

  // Cari produk milik sendiri (Bakul)
  const searchUserProducts = async (query: string) => {
    // Jangan panggil jika query kosong
    if (!userId || !query.trim() || userRole !== 'bakul') {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('produk')
        .select('id, nama_barang, harga, foto_url, satuan')
        .eq('user_id', userId)
        .eq('is_active', true)
        .ilike('nama_barang', `%${query}%`)
        .limit(10);

      if (!error && data) {
        setSearchResults(data);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Error searching products:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Debounce search
  useEffect(() => {
    // Hanya proses jika ada query
    if (!searchQuery || searchQuery.trim().length === 0) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      if (searchQuery && showProductSearch) {
        searchUserProducts(searchQuery);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, showProductSearch, userId]);

  const formatRupiah = (harga) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(harga || 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId || !userRole) {
      setUploadError('Anda harus login dan memiliki role untuk upload video');
      return;
    }

    if (!videoFile) {
      setUploadError('Pilih video terlebih dahulu');
      return;
    }

    if (!judul.trim()) {
      setUploadError('Judul video wajib diisi');
      return;
    }

    setUploadError(null);

    try {
      // Upload video ke Cloudinary (TANPA transformation - VERSION YANG SUDAH BERHASIL)
      const videoResult = await uploadVideo(videoFile, {
        folder: `peken/videos/${userId}`,
        onProgress: (p) => console.log('Upload progress:', p)
      });

      if (!videoResult) {
        throw new Error(cloudinaryError || 'Gagal upload video');
      }

      console.log('Video upload success:', videoResult.secure_url);

      // Generate thumbnail otomatis dari Cloudinary (detik ke 5)
      const autoThumbnailUrl = `https://res.cloudinary.com/daoqovlxt/video/upload/so_5/${videoResult.public_id}.jpg`;

      // Siapkan data untuk insert
      const insertData: any = {
        user_id: userId,
        video_url: videoResult.secure_url,
        thumbnail_url: autoThumbnailUrl,
        judul: judul.trim(),
        deskripsi: deskripsi.trim() || null,
        role_type: userRole,
        is_active: true,
        kategori: kategori || null,
        tipe_video: tipeVideo,
        video_orientation: videoOrientation,
        views: 0,
        likes: 0
      };

      // Jika ada produk yang dipilih, simpan link ke produk Panyangan
      if (selectedProduct) {
        insertData.product_link = `/peken/panyangan?product=${selectedProduct.id}`;
        insertData.product_title = selectedProduct.nama_barang;
      }

      const { error: dbError } = await supabase
        .from('video_peken')
        .insert(insertData);

      if (dbError) throw dbError;

      onSuccess();
      onClose();
      resetForm();

    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(err instanceof Error ? err.message : 'Gagal upload video. Silakan coba lagi.');
    }
  };

  const getRoleLabel = () => {
    switch (userRole) {
      case 'bakul': return 'Bakul';
      case 'driver': return 'Driver Ojek';
      case 'rewang': return 'Rewang';
      default: return 'User';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex justify-between items-center">
          <div>
            <h2 className="font-black text-slate-900 text-lg">Bikin Video Peken</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">Upload sebagai {getRoleLabel()}</p>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-2 hover:bg-slate-100 rounded-full transition-all"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Video Upload */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Video * <span className="text-[9px] font-normal text-slate-400">(MP4, Max 100MB)</span>
            </label>

            {!previewUrl ? (
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="w-full aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-orange-400 transition-all"
              >
                <Video size={32} className="text-slate-400" />
                <span className="text-[10px] text-slate-500">Klik untuk pilih video</span>
              </button>
            ) : (
              <div className="relative">
                <video
                  ref={previewVideoRef}
                  src={previewUrl}
                  className={`w-full rounded-xl bg-black ${videoOrientation === 'portrait'
                    ? 'aspect-[9/16] max-h-[400px] mx-auto object-contain'
                    : 'aspect-video object-cover'
                    }`}
                  controls
                />
                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md">
                  <span className="text-[8px] text-white font-medium">
                    {videoOrientation === 'portrait' ? '📱 Potrait' : '🖥️ Landscape'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setVideoFile(null);
                    setPreviewUrl(null);
                  }}
                  className="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-black/70 transition-all"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>
            )}
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleVideoSelect}
            />
            <p className="text-[9px] text-slate-400 mt-1">
              Video akan otomatis menyesuaikan orientasi (Potrait/Landscape)
            </p>
          </div>

          {/* Judul */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Judul Video *
            </label>
            <input
              type="text"
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              placeholder="Contoh: Unboxing produk terbaru..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 placeholder:text-slate-400"
              maxLength={100}
            />
          </div>

          {/* Deskripsi */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Deskripsi
            </label>
            <textarea
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Ceritakan tentang video Anda..."
              rows={3}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none text-slate-900 placeholder:text-slate-400"
              maxLength={500}
            />
          </div>

          {/* Kategori */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Kategori
            </label>
            <select
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
            >
              <option value="">Pilih Kategori</option>
              <option value="makanan">Makanan & Kuliner</option>
              <option value="minuman">Minuman</option>
              <option value="jasa">Jasa & Layanan</option>
              <option value="barang">Barang & Produk</option>
              <option value="promosi">Promosi</option>
              <option value="tutorial">Tutorial</option>
            </select>
          </div>

          {/* Tipe Video */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Tipe Video
            </label>
            <select
              value={tipeVideo}
              onChange={(e) => setTipeVideo(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900"
            >
              <option value="promosi">Promosi Produk</option>
              <option value="tutorial">Tutorial / Tips</option>
              <option value="info">Informasi</option>
              <option value="unboxing">Unboxing</option>
              <option value="review">Review Produk</option>
            </select>
          </div>

          {/* Pilih Produk dari Panyangan (khusus Bakul) */}
          {userRole === 'bakul' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Promosi Produk <span className="text-[9px] font-normal text-slate-400">(Opsional)</span>
              </label>

              {!selectedProduct ? (
                <div className="relative">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => setShowProductSearch(true)}
                      placeholder="Cari produk kamu di Panyangan..."
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>

                  {showProductSearch && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {!searchQuery || searchQuery.trim().length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-xs">
                          <Search size={16} className="inline mr-1" />
                          Ketik minimal 1 karakter untuk mencari produk
                        </div>
                      ) : searching ? (
                        <div className="p-4 text-center">
                          <Loader2 size={20} className="animate-spin mx-auto text-slate-400" />
                        </div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map(product => (
                          <button
                            key={product.id}
                            type="button"
                            className="w-full p-3 flex items-center gap-3 hover:bg-orange-50 border-b last:border-b-0 text-left transition-colors"
                            onClick={() => {
                              setSelectedProduct(product);
                              setShowProductSearch(false);
                              setSearchQuery('');
                            }}
                          >
                            {product.foto_url?.[0] ? (
                              <img src={product.foto_url[0]} className="w-10 h-10 rounded-lg object-cover" />
                            ) : (
                              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                                <Package size={20} className="text-slate-400" />
                              </div>
                            )}
                            <div className="flex-1">
                              <p className="text-sm font-bold text-slate-800">{product.nama_barang}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-orange-600">{formatRupiah(product.harga)}</span>
                                <span className="text-[10px] text-slate-400">/ {product.satuan || 'pcs'}</span>
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-slate-500 text-sm">
                          <Package size={20} className="inline mr-1 text-slate-400" />
                          Produk "{searchQuery}" tidak ditemukan
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                  {selectedProduct.foto_url?.[0] ? (
                    <img src={selectedProduct.foto_url[0]} className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                      <ShoppingBag size={24} className="text-orange-500" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800">{selectedProduct.nama_barang}</p>
                    <p className="text-xs font-bold text-orange-600">{formatRupiah(selectedProduct.harga)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="p-1 hover:bg-orange-200 rounded-full transition-colors"
                  >
                    <X size={16} className="text-orange-500" />
                  </button>
                </div>
              )}
              <p className="text-[9px] text-slate-400 mt-1">
                Pilih produk yang ingin dipromosikan di video ini
              </p>
            </div>
          )}

          {/* Error Message */}
          {uploadError && (
            <div className="bg-red-50 p-3 rounded-xl flex items-start gap-2">
              <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-red-600">{uploadError}</p>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-[9px] text-slate-500">
                <span>Mengunggah video...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={uploading || !videoFile || !judul.trim()}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Mengunggah...</span>
              </>
            ) : (
              <>
                <Upload size={16} />
                <span>Upload Video</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}