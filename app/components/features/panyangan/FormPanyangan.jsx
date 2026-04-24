'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { X, Store, Upload, Loader2, Trash2, MapPin } from 'lucide-react';

// 🔥 FUNGSI KOMPRESI (di luar component)
const compressImageInWorker = (file) => {
  return new Promise((resolve, reject) => {
    if (file.size < 500 * 1024) {
      resolve(file);
      return;
    }

    const worker = new Worker(URL.createObjectURL(
      new Blob([`
        self.onmessage = async (e) => {
          const { file } = e.data;
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (ev) => {
            const img = new Image();
            img.src = ev.target.result;
            img.onload = () => {
              const canvas = new OffscreenCanvas(img.width, img.height);
              const ctx = canvas.getContext('2d');
              let width = img.width;
              let height = img.height;
              const maxWidth = 1024;
              
              if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
                canvas.width = width;
                canvas.height = height;
              }
              
              ctx.drawImage(img, 0, 0, width, height);
              canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 }).then((blob) => {
                self.postMessage({ blob });
              });
            };
          };
        };
      `], { type: 'application/javascript' }))
    );

    worker.onmessage = (e) => {
      const compressedFile = new File([e.data.blob], file.name, { type: 'image/jpeg' });
      worker.terminate();
      resolve(compressedFile);
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };

    worker.postMessage({ file });
  });
};

// 🔥 UPLOAD KE CLOUDINARY
const uploadToCloudinary = async (file) => {
  const CLOUD_NAME = "dlluhhe83";
  const UPLOAD_PRESET = "setempat_preset";
  const API_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error("Gagal upload ke Cloudinary");
    }

    const data = await response.json();
    return data.secure_url;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};

export default function FormPanyangan({ isOpen, onClose, onSuccess, tempatId, theme }) {
  // ============================================
  // ✅ 1. SEMUA HOOK DI SINI (PALING ATAS)
  // ============================================
  const [loading, setLoading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImageUrls, setUploadedImageUrls] = useState([]);
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({
    nama_barang: '',
    harga: '',
    satuan: 'Per Kg',
    deskripsi: ''
  });
  
  const isMalam = theme?.isMalam ?? false;

  // ✅ useEffect untuk fetch profile
  useEffect(() => {
    if (isOpen) {
      const fetchProfile = async () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user?.id) setProfile(user);
      };
      fetchProfile();
    }
  }, [isOpen]);

  // ✅ useCallback untuk proses upload
  const processUploadQueue = useCallback(async () => {
    if (uploadQueue.length === 0) {
      setIsUploading(false);
      return;
    }

    setIsUploading(true);
    const file = uploadQueue[0];
    
    try {
      const compressed = await compressImageInWorker(file);
      const imageUrl = await uploadToCloudinary(compressed);
      setUploadedImageUrls(prev => [...prev, imageUrl]);
      setUploadQueue(prev => prev.slice(1));
      setTimeout(() => processUploadQueue(), 500);
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Gagal upload ${file.name}: ${error.message}`);
      setUploadQueue(prev => prev.slice(1));
      setTimeout(() => processUploadQueue(), 500);
    }
  }, [uploadQueue]);

  // ✅ useEffect untuk menjalankan queue
  useEffect(() => {
    if (uploadQueue.length > 0 && !isUploading) {
      processUploadQueue();
    }
  }, [uploadQueue, isUploading, processUploadQueue]);

  // ============================================
  // ✅ 2. CONDITIONAL RETURN (SETELAH SEMUA HOOK)
  // ============================================
  if (!isOpen) return null;

  // ============================================
  // ✅ 3. EVENT HANDLER & HELPER FUNCTIONS
  // ============================================
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files);
    const maxFiles = 3 - uploadedImageUrls.length;
    const newFiles = files.slice(0, maxFiles);
    
    if (newFiles.length === 0) {
      alert(`Maksimal 3 foto! Saat ini sudah ${uploadedImageUrls.length} foto`);
      return;
    }

    setUploadQueue(prev => [...prev, ...newFiles]);
    event.target.value = '';
  };

  const removeImage = (indexToRemove) => {
    setUploadedImageUrls(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!profile?.id) {
      alert('Silakan login terlebih dahulu');
      return;
    }
    
    if (uploadQueue.length > 0) {
      alert('Tunggu hingga semua foto selesai diupload');
      return;
    }
    
    if (!formData.nama_barang) {
      alert('Nama barang wajib diisi');
      return;
    }
    
    if (!formData.harga) {
      alert('Harga wajib diisi');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch('/api/produk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama_barang: formData.nama_barang,
          harga: parseFloat(formData.harga),
          satuan: formData.satuan,
          deskripsi: formData.deskripsi,
          foto_url: uploadedImageUrls,
          tempat_id: tempatId,
          user_id: profile.id,
        }),
      });
      
      if (!response.ok) throw new Error('Gagal menyimpan');
      
      alert('✅ Produk berhasil diunggah!');
      
      setFormData({
        nama_barang: '',
        harga: '',
        satuan: 'Per Kg',
        deskripsi: ''
      });
      setUploadedImageUrls([]);
      
      if (onSuccess) onSuccess();
      onClose();
      
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Gagal menyimpan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // ✅ 4. RENDER JSX
  // ============================================
  return (
    <div className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-sm flex justify-center items-end sm:items-center">
      
      <div className={`w-full max-w-[420px] h-full sm:h-[90vh] sm:rounded-[40px] shadow-2xl animate-in slide-in-from-bottom-10 duration-500 overflow-y-auto ${
        isMalam ? "bg-slate-900" : "bg-white"
      }`}>
        
        <div className={`sticky top-0 backdrop-blur-md px-6 pt-12 pb-4 flex items-center justify-between border-b z-10 ${
          isMalam ? "bg-slate-900/80 border-slate-800" : "bg-white/80 border-slate-100"
        }`}>
          <button 
            onClick={onClose} 
            disabled={loading}
            className={`p-2 rounded-xl active:scale-90 transition-all ${
              isMalam ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"
            }`}
          >
            <X size={20} />
          </button>
          <h3 className={`font-black uppercase tracking-tighter text-sm ${isMalam ? "text-white" : "text-slate-800"}`}>
            Gelar Dagangan
          </h3>
          <div className="w-10"></div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 pb-32 space-y-8">
          
          {/* FOTO BARANG */}
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                Foto Barang
              </label>
              <span className="text-[9px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                MAKS 3 • {uploadedImageUrls.length}/3
                {uploadQueue.length > 0 && ` • Uploading ${uploadQueue.length}`}
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              {uploadedImageUrls.length < 3 && (
                <label className={`aspect-square rounded-[24px] border-2 border-dashed flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  isUploading || loading ? "opacity-50 cursor-wait" : "hover:bg-orange-50 hover:text-orange-500"
                } ${isMalam ? "border-slate-700 text-slate-500 bg-slate-800/50" : "border-slate-200 text-slate-400 bg-white"}`}>
                  {(isUploading || uploadQueue.length > 0) ? (
                    <Loader2 size={24} className="animate-spin" />
                  ) : (
                    <Upload size={24} />
                  )}
                  <span className="text-[8px] font-black mt-2 uppercase">
                    {isUploading ? `Upload ${uploadQueue.length}` : 'Tambah'}
                  </span>
                  <input 
                    type="file" 
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden" 
                    onChange={handleImageUpload}
                    multiple
                    disabled={isUploading || loading}
                  />
                </label>
              )}
              
              {uploadedImageUrls.map((url, idx) => (
                <div key={idx} className="relative aspect-square rounded-[24px] overflow-hidden group">
                  <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              
              {[...Array(Math.max(0, 3 - uploadedImageUrls.length - (uploadedImageUrls.length < 3 ? 1 : 0)))].map((_, idx) => (
                <div key={`empty-${idx}`} className={`aspect-square rounded-[24px] flex items-center justify-center ${
                  isMalam ? "bg-slate-800/50 border border-slate-700 text-slate-600" : "bg-slate-50 border border-slate-100 text-slate-300"
                }`}>
                  <Store size={24} />
                </div>
              ))}
            </div>
          </div>

          {/* INPUT DATA */}
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Jeneng Barang *</label>
              <input 
                type="text" 
                name="nama_barang"
                value={formData.nama_barang}
                onChange={handleInputChange}
                placeholder="Misal: Tomat Mateng Pakijangan" 
                className={`w-full rounded-2xl p-4 text-sm font-bold outline-none ${
                  isMalam ? "bg-slate-800 text-white placeholder:text-slate-500" : "bg-slate-50 text-slate-900 placeholder:text-slate-300"
                }`}
                required
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Rego (Rp) *</label>
                <input 
                  type="number" 
                  name="harga"
                  value={formData.harga}
                  onChange={handleInputChange}
                  placeholder="0" 
                  className={`w-full rounded-2xl p-4 text-sm font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${
                    isMalam ? "bg-slate-800 text-white placeholder:text-slate-500" : "bg-slate-50 text-slate-900 placeholder:text-slate-300"
                  }`}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Satuan</label>
                <select 
                  name="satuan"
                  value={formData.satuan}
                  onChange={handleInputChange}
                  className={`w-full rounded-2xl p-4 text-sm font-bold appearance-none outline-none ${
                    isMalam ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-900"
                  }`}
                  disabled={loading}
                >
                  <option>Per Kg</option>
                  <option>Per Ikat</option>
                  <option>Per Biji</option>
                  <option>Borongan</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Keterangan</label>
              <textarea 
                name="deskripsi"
                value={formData.deskripsi}
                onChange={handleInputChange}
                rows={4} 
                placeholder="Ceritakno barange sampeyan..." 
                className={`w-full rounded-[24px] p-4 text-sm font-medium outline-none resize-none ${
                  isMalam ? "bg-slate-800 text-white placeholder:text-slate-500" : "bg-slate-50 text-slate-900 placeholder:text-slate-300"
                }`}
                disabled={loading}
              />
            </div>
          </div>

          {/* INFORMASI TARGET */}
          {profile && (
            <div className={`p-3 rounded-xl border flex items-center gap-2 ${
              isMalam ? "bg-orange-500/5 border-orange-500/20" : "bg-orange-50 border-orange-100"
            }`}>
              <MapPin size={14} className="text-orange-500" />
              <span className={`text-[11px] font-bold ${isMalam ? "text-orange-300" : "text-orange-700"}`}>
                Berlaku untuk semua pembeli
              </span>
            </div>
          )}

          {/* AKSI */}
          <div className="space-y-3 pt-4">
            <button 
              type="submit"
              disabled={loading || isUploading || uploadQueue.length > 0 || !profile}
              className="w-full bg-gradient-to-r from-orange-600 to-amber-500 text-white p-5 rounded-[24px] font-black text-sm shadow-xl active:scale-95 transition-all uppercase tracking-widest disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 size={20} className="animate-spin" />
                  <span>Menyimpan...</span>
                </div>
              ) : (
                'Unggah Dagangan'
              )}
            </button>
            <button 
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`w-full p-4 font-bold text-[10px] uppercase tracking-[0.2em] transition-all ${
                isMalam ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}