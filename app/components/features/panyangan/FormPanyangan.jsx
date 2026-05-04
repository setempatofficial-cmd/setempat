'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Store, Upload, Loader2, Trash2, MapPin } from 'lucide-react';

// ✅ FUNGSI KOMPRESI SEDERHANA & STABIL
const compressImage = (file) => {
  return new Promise((resolve) => {
    if (file.size < 500 * 1024) return resolve(file);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxWidth = 1024;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.7);
      };
    };
  });
};

// ✅ UPLOAD KE CLOUDINARY
const uploadToCloudinary = async (file) => {
  const CLOUD_NAME = "dlluhhe83";
  const UPLOAD_PRESET = "setempat_preset";
  const API_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const response = await fetch(API_URL, { method: "POST", body: formData });
  if (!response.ok) throw new Error("Gagal upload");
  const data = await response.json();
  return data.secure_url;
};

export default function FormPanyangan({ 
  isOpen, onClose, onSuccess, tempatId, theme, editingProduct = null 
}) {
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImageUrls, setUploadedImageUrls] = useState([]);
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({
    nama_barang: '', harga: '', satuan: 'Per Kg', deskripsi: ''
  });
  
  const isMalam = theme?.isMalam ?? false;
  const isEditMode = !!editingProduct;

  // Fetch Profile
  useEffect(() => {
    if (isOpen) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user?.id) setProfile(user);
    }
  }, [isOpen]);

  // Load Edit Data
  useEffect(() => {
    if (isOpen && editingProduct) {
      setFormData({
        nama_barang: editingProduct.nama_barang || '',
        harga: editingProduct.harga?.toString() || '',
        satuan: editingProduct.satuan || 'Per Kg',
        deskripsi: editingProduct.deskripsi || ''
      });
      
      // ✅ Perbaikan: handle foto_url yang mungkin string JSON
      let fotoUrls = [];
      if (Array.isArray(editingProduct.foto_url)) {
        fotoUrls = editingProduct.foto_url;
      } else if (typeof editingProduct.foto_url === 'string') {
        try {
          fotoUrls = JSON.parse(editingProduct.foto_url);
        } catch {
          fotoUrls = [];
        }
      }
      setUploadedImageUrls(fotoUrls);
    } else if (isOpen && !editingProduct) {
      // Reset form saat tambah baru
      setFormData({
        nama_barang: '', harga: '', satuan: 'Per Kg', deskripsi: ''
      });
      setUploadedImageUrls([]);
    }
  }, [isOpen, editingProduct]);

  // ✅ HANDLE UPLOAD
  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files);
    const availableSlots = 3 - uploadedImageUrls.length;
    const filesToUpload = files.slice(0, availableSlots);

    if (filesToUpload.length === 0) {
      alert("Maksimal 3 foto!");
      event.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      for (const file of filesToUpload) {
        const compressed = await compressImage(file);
        const url = await uploadToCloudinary(compressed);
        setUploadedImageUrls(prev => [...prev, url]);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert("Gagal upload foto");
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const removeImage = (idx) => {
    setUploadedImageUrls(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  
  // Validasi
  if (isUploading) {
    alert("Tunggu upload foto selesai!");
    return;
  }
  
  if (uploadedImageUrls.length === 0) {
    alert("Minimal 1 foto!");
    return;
  }
  
  if (!formData.nama_barang.trim()) {
    alert("Nama barang wajib diisi!");
    return;
  }
  
  if (!formData.harga || parseFloat(formData.harga) <= 0) {
    alert("Harga wajib diisi dengan angka positif!");
    return;
  }
  
  // Validasi khusus untuk create mode
  if (!isEditMode) {
    if (!tempatId) {
      console.error('❌ tempatId is missing!');
      alert('Data tempat tidak ditemukan');
      return;
    }
    
    if (!profile?.id) {
      console.error('❌ profile.id is missing!');
      alert('Silakan login terlebih dahulu');
      return;
    }
  }

  setLoading(true);
  
  try {
    const payload = {
      nama_barang: formData.nama_barang.trim(),
      harga: parseFloat(formData.harga),
      satuan: formData.satuan,
      deskripsi: formData.deskripsi.trim(),
      foto_url: uploadedImageUrls,
    };
    
    if (isEditMode) {
      payload.id = editingProduct?.id;
    } else {
      payload.tempat_id = tempatId;
      payload.user_id = profile.id;
    }
    
    console.log('📤 Sending payload:', payload);
    
    const res = await fetch('/api/produk', {
      method: isEditMode ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    console.log('📥 Response status:', res.status);
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error('❌ Error response:', errorData);
      throw new Error(errorData.message || errorData.error || `HTTP ${res.status}`);
    }
    
    const result = await res.json();
    console.log('✅ Success:', result);
    
    alert(isEditMode ? '✅ Produk berhasil diupdate!' : '✅ Produk berhasil diunggah!');
    onSuccess?.();
    onClose();
    
  } catch (error) {
    console.error('❌ Submit error:', error);
    alert(`Gagal ${isEditMode ? 'mengupdate' : 'menyimpan'}: ${error.message}`);
  } finally {
    setLoading(false);
  }
};

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-sm flex justify-center items-end sm:items-center">
      <div className={`w-full max-w-[420px] h-full sm:h-[90vh] sm:rounded-[40px] overflow-y-auto ${isMalam ? "bg-slate-900" : "bg-white"}`}>
        
        {/* Header */}
        <div className={`sticky top-0 backdrop-blur-md px-6 pt-12 pb-4 flex items-center justify-between border-b z-10 ${isMalam ? "bg-slate-900/80 border-slate-800" : "bg-white/80 border-slate-100"}`}>
          <button 
            onClick={onClose} 
            disabled={loading}
            className={`p-2 rounded-xl active:scale-90 transition-all ${isMalam ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"}`}
          >
            <X size={20} />
          </button>
          <h3 className={`font-black uppercase tracking-tighter text-sm ${isMalam ? "text-white" : "text-slate-800"}`}>
            {isEditMode ? 'EDIT DAGANGAN' : 'GELAR DAGANGAN BARU'}
          </h3>
          <div className="w-10" />
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8 pb-32">
          
          {/* Foto Section */}
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Foto Barang</label>
              <span className="text-[9px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                {uploadedImageUrls.length}/3
                {isUploading && ` • Uploading`}
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              {uploadedImageUrls.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-[24px] overflow-hidden group">
                  <img src={url} className="w-full h-full object-cover" />
                  <button 
                    type="button" 
                    onClick={() => removeImage(i)} 
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600"
                    disabled={loading}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              
              {uploadedImageUrls.length < 3 && (
                <label className={`aspect-square rounded-[24px] border-2 border-dashed flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isUploading || loading ? "opacity-50 cursor-wait" : "hover:bg-orange-50 hover:text-orange-500"
                } ${isMalam ? "border-slate-700 text-slate-500 bg-slate-800/50" : "border-slate-200 text-slate-400 bg-white"}`}>
                  {isUploading ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
                  <span className="text-[8px] font-black mt-2 uppercase">
                    {isUploading ? 'Uploading' : 'Tambah'}
                  </span>
                  <input 
                    type="file" 
                    hidden 
                    onChange={handleImageUpload} 
                    multiple 
                    accept="image/*" 
                    disabled={isUploading || loading}
                  />
                </label>
              )}
              
              {/* Empty slots */}
              {[...Array(Math.max(0, 3 - uploadedImageUrls.length - 1))].map((_, idx) => (
                <div key={`empty-${idx}`} className={`aspect-square rounded-[24px] flex items-center justify-center ${
                  isMalam ? "bg-slate-800/50 border border-slate-700 text-slate-600" : "bg-slate-50 border border-slate-100 text-slate-300"
                }`}>
                  <Store size={24} />
                </div>
              ))}
            </div>
          </div>

          {/* Form Input */}
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Jeneng Barang *</label>
              <input 
                className={`w-full rounded-2xl p-4 text-sm font-bold outline-none ${
                  isMalam ? "bg-slate-800 text-white placeholder:text-slate-500" : "bg-slate-50 text-slate-900 placeholder:text-slate-300"
                }`}
                placeholder="Misal: Tomat Mateng Pakijangan"
                value={formData.nama_barang}
                onChange={(e) => setFormData({...formData, nama_barang: e.target.value})}
                required
                disabled={loading}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Rego (Rp) *</label>
                <input 
                  type="number"
                  className={`w-full rounded-2xl p-4 text-sm font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${
                    isMalam ? "bg-slate-800 text-white placeholder:text-slate-500" : "bg-slate-50 text-slate-900 placeholder:text-slate-300"
                  }`}
                  placeholder="0"
                  value={formData.harga}
                  onChange={(e) => setFormData({...formData, harga: e.target.value})}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Satuan</label>
                <select 
                  className={`w-full rounded-2xl p-4 text-sm font-bold appearance-none outline-none ${
                    isMalam ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-900"
                  }`}
                  value={formData.satuan}
                  onChange={(e) => setFormData({...formData, satuan: e.target.value})}
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
                className={`w-full rounded-[24px] p-4 text-sm font-medium outline-none resize-none ${
                  isMalam ? "bg-slate-800 text-white placeholder:text-slate-500" : "bg-slate-50 text-slate-900 placeholder:text-slate-300"
                }`}
                rows={4}
                placeholder="Ceritakno barange sampeyan..."
                value={formData.deskripsi}
                onChange={(e) => setFormData({...formData, deskripsi: e.target.value})}
                disabled={loading}
              />
            </div>
          </div>

          {/* Informasi */}
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

          {/* Tombol Submit */}
          <div className="space-y-3 pt-4">
            <button 
              type="submit" 
              disabled={loading || isUploading}
              className="w-full bg-gradient-to-r from-orange-600 to-amber-500 text-white p-5 rounded-[24px] font-black text-sm shadow-xl active:scale-95 transition-all uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 size={20} className="animate-spin" />
                  <span>Menyimpan...</span>
                </div>
              ) : (
                isEditMode ? 'UPDATE DAGANGAN' : 'UNGGah DAGANGAN'
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