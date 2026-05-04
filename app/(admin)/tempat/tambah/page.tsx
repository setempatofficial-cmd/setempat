"use client";

import React, { useState } from 'react';
import { MapPin, Clock, Save, ArrowLeft, Navigation } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Inisialisasi Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function TambahTempatSimple() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    alamat: '',
    description: '',
    latitude: '',
    longitude: '',
    jam_buka: ''
  });

  // FUNGSI UNTUK MENDAPATKAN GPS OTOMATIS
  const getMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation tidak didukung oleh browser Anda");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData({
          ...formData,
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString()
        });
        setLoading(false);
      },
      (error) => {
        alert("Gagal mengambil lokasi: " + error.message);
        setLoading(false);
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validasi data
    if (!formData.name) {
      alert("Nama tempat wajib diisi!");
      return;
    }
    
    if (!formData.latitude || !formData.longitude) {
      alert("Koordinat lokasi wajib diisi! Gunakan tombol 'Ambil GPS' atau isi manual.");
      return;
    }

    setLoading(true);
    
    try {
      // Menyiapkan data yang akan dikirim
      const dataToInsert = {
        name: formData.name,
        category: formData.category || null, // Jika kosong, set ke null
        alamat: formData.alamat || null,
        description: formData.description || null,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        jam_buka: formData.jam_buka || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Insert ke Supabase
      const { data, error } = await supabase
        .from('tempat')
        .insert([dataToInsert])
        .select();

      if (error) {
        throw error;
      }

      console.log("Data berhasil disimpan:", data);
      alert("Tempat berhasil ditambahkan!");
      
      // Reset form atau kembali ke halaman sebelumnya
      router.back();
      
    } catch (error: any) {
      console.error("Error detail:", error);
      alert(`Gagal menyimpan data: ${error.message || "Terjadi kesalahan"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-10">
      <div className="p-4 border-b flex items-center gap-4 sticky top-0 bg-white z-10">
        <button onClick={() => router.back()} disabled={loading}>
          <ArrowLeft size={20}/>
        </button>
        <h1 className="font-bold">Tambah Titik Baru</h1>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5 max-w-2xl mx-auto">
        
        {/* Nama & Kategori */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase text-gray-400">Nama Tempat *</label>
            <input 
              type="text" 
              required
              disabled={loading}
              className="w-full border-b border-gray-200 py-2 focus:border-orange-500 outline-none transition disabled:bg-gray-100"
              placeholder="Misal: Warung Kopi Pakde"
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-gray-400">Kategori (Bebas Isi)</label>
            <input 
              type="text" 
              disabled={loading}
              className="w-full border-b border-gray-200 py-2 focus:border-orange-500 outline-none transition disabled:bg-gray-100"
              placeholder="Misal: Kuliner, Wisata, Jasa"
              onChange={(e) => setFormData({...formData, category: e.target.value})}
            />
          </div>
        </div>

        {/* Alamat & Deskripsi */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase text-gray-400">Alamat</label>
            <textarea 
              disabled={loading}
              className="w-full border border-gray-100 rounded-xl p-3 bg-gray-50 mt-1 disabled:bg-gray-100"
              rows={2}
              onChange={(e) => setFormData({...formData, alamat: e.target.value})}
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-gray-400">Deskripsi Singkat</label>
            <textarea 
              disabled={loading}
              className="w-full border border-gray-100 rounded-xl p-3 bg-gray-50 mt-1 disabled:bg-gray-100"
              rows={3}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>
        </div>

        {/* Lokasi dengan Tombol Auto-GPS */}
        <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase text-orange-600 flex items-center gap-2">
              <MapPin size={14}/> Koordinat Lokasi *
            </label>
            <button 
              type="button"
              onClick={getMyLocation}
              disabled={loading}
              className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold shadow-sm disabled:opacity-50"
            >
              <Navigation size={12}/> {loading ? 'Mencari...' : 'Ambil GPS'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input 
              type="text" 
              placeholder="Latitude" 
              value={formData.latitude}
              required
              disabled={loading}
              className="bg-white p-2 rounded-lg text-sm border border-orange-200 outline-none disabled:bg-gray-100"
              onChange={(e) => setFormData({...formData, latitude: e.target.value})}
            />
            <input 
              type="text" 
              placeholder="Longitude" 
              value={formData.longitude}
              required
              disabled={loading}
              className="bg-white p-2 rounded-lg text-sm border border-orange-200 outline-none disabled:bg-gray-100"
              onChange={(e) => setFormData({...formData, longitude: e.target.value})}
            />
          </div>
        </div>

        {/* Jam Buka */}
        <div>
          <label className="text-xs font-bold uppercase text-gray-400 flex items-center gap-2">
            <Clock size={14}/> Jam Buka
          </label>
          <input 
            type="text" 
            disabled={loading}
            placeholder="Misal: 08:00 - 21:00"
            className="w-full border-b border-gray-200 py-2 focus:border-orange-500 outline-none transition mt-1 disabled:bg-gray-100"
            onChange={(e) => setFormData({...formData, jam_buka: e.target.value})}
          />
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white py-4 rounded-2xl font-bold mt-6 shadow-xl active:scale-95 transition disabled:opacity-50 disabled:active:scale-100"
        >
          {loading ? 'Menyimpan...' : 'Simpan Tempat Baru'}
        </button>
      </form>
    </div>
  );
}