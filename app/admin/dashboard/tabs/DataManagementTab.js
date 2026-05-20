"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  MapPin, Link2, Building, Calendar, AlertTriangle, 
  Truck, Plus, Edit, Trash2, Save, X, 
  RefreshCw, Sparkles, Brain, TrendingUp
} from 'lucide-react';

export default function DataManagementTab() {
  const [activeTab, setActiveTab] = useState('tempat');
  const [loading, setLoading] = useState(false);
  const [dataList, setDataList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [tempatList, setTempatList] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState({});
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // ==================== FUNGSI AI OTOMATIS ====================
  
  // 1. Geocoding - Ambil koordinat dari nama tempat (Nominatim/OpenStreetMap)
  const autoGeocode = async (namaTempat) => {
    if (!namaTempat || namaTempat.length < 5) return;
    
    setIsAiProcessing(true);
    setAiSuggestions(prev => ({ ...prev, geocoding: 'Mencari koordinat...' }));
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(namaTempat)}, Indonesia&format=json&limit=1`
      );
      const data = await response.json();
      
      if (data && data[0]) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setFormData(prev => ({ ...prev, latitude: lat, longitude: lon }));
        setAiSuggestions(prev => ({ 
          ...prev, 
          geocoding: `✅ Ditemukan: ${lat}, ${lon}` 
        }));
      } else {
        setAiSuggestions(prev => ({ 
          ...prev, 
          geocoding: '⚠️ Koordinat tidak ditemukan, silakan isi manual' 
        }));
      }
    } catch (err) {
      setAiSuggestions(prev => ({ ...prev, geocoding: '❌ Gagal mengambil koordinat' }));
    } finally {
      setIsAiProcessing(false);
    }
  };

  // 2. Estimasi kapasitas berdasarkan tipe tempat
  const estimasiKapasitas = (tipeTempat) => {
    const estimasi = {
      'masjid': { min: 200, max: 1000, rekomendasi: 500 },
      'mall': { min: 1000, max: 10000, rekomendasi: 5000 },
      'stasiun': { min: 500, max: 5000, rekomendasi: 2000 },
      'sekolah': { min: 200, max: 1500, rekomendasi: 800 },
      'rs': { min: 100, max: 500, rekomendasi: 300 },
      'pom_bensin': { min: 20, max: 100, rekomendasi: 50 },
      'pasar': { min: 500, max: 3000, rekomendasi: 1500 },
      'wisata': { min: 500, max: 5000, rekomendasi: 2000 },
      'kantor': { min: 50, max: 500, rekomendasi: 200 },
      'umum': { min: 50, max: 200, rekomendasi: 100 }
    };
    return estimasi[tipeTempat]?.rekomendasi || 100;
  };

  // 3. Hitung jarak antar 2 titik (Haversine Formula)
  const hitungJarak = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 10) / 10;
  };

  // 4. Auto hitung jarak saat pilih dua tempat
  const autoHitungJarak = async (tempatId1, tempatId2) => {
    if (!tempatId1 || !tempatId2) return;
    
    setIsAiProcessing(true);
    setAiSuggestions(prev => ({ ...prev, jarak: 'Menghitung jarak...' }));
    
    try {
      const { data: tempat1 } = await supabase
        .from('tempat')
        .select('latitude, longitude')
        .eq('id', tempatId1)
        .single();
      
      const { data: tempat2 } = await supabase
        .from('tempat')
        .select('latitude, longitude')
        .eq('id', tempatId2)
        .single();
      
      if (tempat1?.latitude && tempat2?.latitude) {
        const jarak = hitungJarak(
          tempat1.latitude, tempat1.longitude,
          tempat2.latitude, tempat2.longitude
        );
        setFormData(prev => ({ ...prev, jarak_km: jarak }));
        setAiSuggestions(prev => ({ 
          ...prev, 
          jarak: `✅ Jarak: ${jarak} km` 
        }));
      }
    } catch (err) {
      setAiSuggestions(prev => ({ ...prev, jarak: '❌ Gagal hitung jarak' }));
    } finally {
      setIsAiProcessing(false);
    }
  };

  // 5. Auto update metadata saat tipe tempat berubah
  const handleTipeChange = (tipe) => {
    const kapasitas = estimasiKapasitas(tipe);
    setFormData(prev => ({ 
      ...prev, 
      category: tipe,
      kapasitas_normal: kapasitas
    }));
    setAiSuggestions(prev => ({ 
      ...prev, 
      kapasitas: `🤖 AI merekomendasikan kapasitas: ${kapasitas} orang` 
    }));
  };

  // ==================== FETCH DATA ====================
  const fetchTempatList = async () => {
    const { data } = await supabase
      .from('tempat')
      .select('id, name, latitude, longitude')
      .order('name');
    setTempatList(data || []);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'tempat') {
        const { data: tempatData, error: tempatError } = await supabase
          .from('tempat')
          .select('*')
          .order('name');
        
        if (tempatError) throw tempatError;
        
        const { data: metadataData, error: metadataError } = await supabase
          .from('tempat_metadata')
          .select('*');
        
        if (metadataError) throw metadataError;
        
        const formattedData = tempatData.map(tempat => {
          const metadata = metadataData?.find(m => m.tempat_id === tempat.id);
          return {
            ...tempat,
            kapasitas_normal: metadata?.kapasitas_normal || null,
            jam_buka: metadata?.jam_buka || null,
            jam_tutup: metadata?.jam_tutup || null,
            is_24_jam: metadata?.is_24_jam || false,
            metadata_id: metadata?.id || null
          };
        });
        
        setDataList(formattedData);
      } 
      else if (activeTab === 'tempat_koneksi') {
        const { data: koneksiData, error: koneksiError } = await supabase
          .from('tempat_koneksi')
          .select('*');
        
        if (koneksiError) throw koneksiError;
        
        const { data: tempatData, error: tempatError } = await supabase
          .from('tempat')
          .select('id, name');
        
        if (tempatError) throw tempatError;
        
        const tempatMap = {};
        tempatData.forEach(t => { tempatMap[t.id] = t.name; });
        
        const formattedData = koneksiData.map(item => ({
          ...item,
          tempat1_nama: tempatMap[item.tempat_id_1] || '-',
          tempat2_nama: tempatMap[item.tempat_id_2] || '-'
        }));
        
        setDataList(formattedData);
      }
      else {
        const { data, error } = await supabase.from(activeTab).select('*');
        if (error) throw error;
        
        if (activeTab !== 'tempat') {
          const { data: tempatData } = await supabase.from('tempat').select('id, name');
          const tempatMap = {};
          tempatData.forEach(t => { tempatMap[t.id] = t.name; });
          
          const formattedData = data.map(item => ({
            ...item,
            tempat_nama: tempatMap[item.tempat_id] || '-'
          }));
          setDataList(formattedData);
        } else {
          setDataList(data || []);
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      alert('Gagal mengambil data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchTempatList();
  }, [activeTab]);

  // ==================== CRUD ====================
  const handleSave = async () => {
    setLoading(true);
    try {
      if (activeTab === 'tempat') {
        await handleSaveTempat();
      } else {
        await handleSaveOther();
      }
      
      alert(editingItem ? '✅ Berhasil diupdate!' : '✅ Berhasil ditambahkan!');
      setShowForm(false);
      setEditingItem(null);
      setFormData({});
      setAiSuggestions({});
      fetchData();
    } catch (err) {
      console.error('Save error:', err);
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTempat = async () => {
    if (!formData.name) throw new Error('Nama tempat wajib diisi');
    
    if (editingItem) {
      const { error: errorTempat } = await supabase
        .from('tempat')
        .update({
          name: formData.name,
          alamat: formData.alamat || null,
          latitude: formData.latitude || null,
          longitude: formData.longitude || null,
          category: formData.category || 'umum',
          updated_at: new Date().toISOString()
        })
        .eq('id', editingItem.id);
      
      if (errorTempat) throw errorTempat;
      
      if (editingItem.metadata_id) {
        const { error: errorMetadata } = await supabase
          .from('tempat_metadata')
          .update({
            kapasitas_normal: formData.kapasitas_normal || null,
            jam_buka: formData.jam_buka || null,
            jam_tutup: formData.jam_tutup || null,
            is_24_jam: formData.is_24_jam || false,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingItem.metadata_id);
        
        if (errorMetadata) throw errorMetadata;
      }
    } else {
      const { data: tempatBaru, error: errorTempat } = await supabase
        .from('tempat')
        .insert([{
          name: formData.name,
          alamat: formData.alamat || null,
          latitude: formData.latitude || null,
          longitude: formData.longitude || null,
          category: formData.category || 'umum',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select();
      
      if (errorTempat) throw errorTempat;
      
      const { error: errorMetadata } = await supabase
        .from('tempat_metadata')
        .insert([{
          tempat_id: tempatBaru[0].id,
          kapasitas_normal: formData.kapasitas_normal || null,
          jam_buka: formData.jam_buka || null,
          jam_tutup: formData.jam_tutup || null,
          is_24_jam: formData.is_24_jam || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);
      
      if (errorMetadata) throw errorMetadata;
    }
  };

  const handleSaveOther = async () => {
    let result;
    if (editingItem) {
      result = await supabase
        .from(activeTab)
        .update(formData)
        .eq('id', editingItem.id);
    } else {
      result = await supabase
        .from(activeTab)
        .insert([formData]);
    }
    if (result.error) throw result.error;
  };

  const handleDelete = async (id) => {
    if (!confirm('Yakin hapus data ini?')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from(activeTab).delete().eq('id', id);
      if (error) throw error;
      fetchData();
      alert('✅ Data berhasil dihapus');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData(item);
    setShowForm(true);
  };

  // ==================== UI COMPONENTS ====================
  const tabs = [
    { id: 'tempat', label: '📍 Tempat', icon: <MapPin size={16} />, ai: true },
    { id: 'tempat_koneksi', label: '🔗 Koneksi', icon: <Link2 size={16} />, ai: true },
    { id: 'tempat_layanan_terkait', label: '🏢 Fasilitas', icon: <Building size={16} />, ai: false },
    { id: 'tempat_aktivitas_berkala', label: '📅 Aktivitas Rutin', icon: <Calendar size={16} />, ai: false },
    { id: 'tempat_insiden_historis', label: '⚠️ Riwayat', icon: <AlertTriangle size={16} />, ai: false },
    { id: 'tempat_bantuan_tersedia', label: '🚛 Bantuan', icon: <Truck size={16} />, ai: false }
  ];

  return (
    <div>
      {/* Header dengan AI Badge */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={20} className="text-purple-600" />
          <span className="text-sm font-medium text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
            🤖 AI Auto-Fill Active
          </span>
        </div>
        <button
          onClick={fetchData}
          className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 border-b mb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { 
              setActiveTab(tab.id); 
              setShowForm(false); 
              setEditingItem(null); 
              setFormData({});
              setAiSuggestions({});
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id 
                ? 'border-b-2 border-purple-600 text-purple-700' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.ai && <Sparkles size={10} className="text-purple-400" />}
          </button>
        ))}
      </div>

      {/* Tombol Tambah */}
      <div className="mb-4">
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700"
          >
            <Plus size={16} />
            Tambah Data
          </button>
        )}
      </div>

      {/* FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative p-6">
            <button
              onClick={() => { setShowForm(false); setEditingItem(null); setFormData({}); setAiSuggestions({}); }}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
            
            <div className="flex items-center gap-2 mb-4">
              <Brain size={20} className="text-purple-600" />
              <h2 className="text-xl font-bold">
                {editingItem ? '✏️ Edit Data' : '➕ Tambah Data Baru'}
              </h2>
            </div>

            {/* FORM TEMPAT - VERSI AI */}
            {activeTab === 'tempat' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Nama Tempat *
                    <span className="text-purple-500 text-xs ml-2">(AI akan cari koordinat otomatis)</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.name || ''}
                    onChange={(e) => {
                      setFormData({...formData, name: e.target.value});
                      autoGeocode(e.target.value);
                    }}
                    placeholder="Contoh: SPBU Pertamina 54.671.16 Purwosari"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Tipe Tempat *
                    <span className="text-purple-500 text-xs ml-2">(AI akan estimasi kapasitas)</span>
                  </label>
                  <select
                    required
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.category || 'umum'}
                    onChange={(e) => handleTipeChange(e.target.value)}
                  >
                    <option value="masjid">🕌 Masjid</option>
                    <option value="mall">🛍️ Mall</option>
                    <option value="stasiun">🚉 Stasiun</option>
                    <option value="sekolah">🏫 Sekolah</option>
                    <option value="rs">🏥 Rumah Sakit</option>
                    <option value="pom_bensin">⛽ SPBU</option>
                    <option value="pasar">🛒 Pasar</option>
                    <option value="wisata">🏖️ Wisata</option>
                    <option value="kantor">🏢 Kantor</option>
                    <option value="umum">📍 Umum</option>
                  </select>
                </div>

                {/* AI Suggestions Panel */}
                {(isAiProcessing || aiSuggestions.geocoding || aiSuggestions.kapasitas) && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={14} className="text-purple-600" />
                      <span className="text-xs font-semibold text-purple-700">🤖 AI Process</span>
                    </div>
                    {isAiProcessing && (
                      <div className="flex items-center gap-2 text-sm text-purple-600">
                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-purple-600 border-t-transparent" />
                        Memproses...
                      </div>
                    )}
                    {aiSuggestions.geocoding && (
                      <p className="text-sm text-purple-700 mt-1">{aiSuggestions.geocoding}</p>
                    )}
                    {aiSuggestions.kapasitas && (
                      <p className="text-sm text-purple-700 mt-1">{aiSuggestions.kapasitas}</p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">Alamat</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.alamat || ''}
                    onChange={(e) => setFormData({...formData, alamat: e.target.value})}
                    placeholder="Alamat lengkap"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Latitude</label>
                    <input
                      type="text"
                      className="w-full border rounded-lg px-3 py-2 bg-gray-50"
                      value={formData.latitude || ''}
                      onChange={(e) => setFormData({...formData, latitude: e.target.value})}
                      placeholder="Otomatis dari AI"
                      readOnly={!formData.latitude}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Longitude</label>
                    <input
                      type="text"
                      className="w-full border rounded-lg px-3 py-2 bg-gray-50"
                      value={formData.longitude || ''}
                      onChange={(e) => setFormData({...formData, longitude: e.target.value})}
                      placeholder="Otomatis dari AI"
                      readOnly={!formData.longitude}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Kapasitas Normal</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 bg-gray-50"
                    value={formData.kapasitas_normal || ''}
                    onChange={(e) => setFormData({...formData, kapasitas_normal: e.target.value})}
                    placeholder="Estimasi AI"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Jam Buka</label>
                    <input
                      type="time"
                      className="w-full border rounded-lg px-3 py-2"
                      value={formData.jam_buka || ''}
                      onChange={(e) => setFormData({...formData, jam_buka: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Jam Tutup</label>
                    <input
                      type="time"
                      className="w-full border rounded-lg px-3 py-2"
                      value={formData.jam_tutup || ''}
                      onChange={(e) => setFormData({...formData, jam_tutup: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_24_jam"
                    checked={formData.is_24_jam || false}
                    onChange={(e) => setFormData({...formData, is_24_jam: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <label htmlFor="is_24_jam" className="text-sm">Buka 24 Jam</label>
                </div>
              </div>
            )}

            {/* FORM KONEKSI - JARAK OTOMATIS */}
            {activeTab === 'tempat_koneksi' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Tempat 1 (Sumber) *
                    <span className="text-purple-500 text-xs ml-2">(AI akan hitung jarak otomatis)</span>
                  </label>
                  <select
                    required
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.tempat_id_1 || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({...formData, tempat_id_1: val});
                      if (formData.tempat_id_2) {
                        autoHitungJarak(val, formData.tempat_id_2);
                      }
                    }}
                  >
                    <option value="">Pilih tempat...</option>
                    {tempatList.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Tempat 2 (Tujuan) *</label>
                  <select
                    required
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.tempat_id_2 || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({...formData, tempat_id_2: val});
                      if (formData.tempat_id_1) {
                        autoHitungJarak(formData.tempat_id_1, val);
                      }
                    }}
                  >
                    <option value="">Pilih tempat...</option>
                    {tempatList.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {isAiProcessing && (
                  <div className="bg-purple-50 p-3 rounded-lg text-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent inline-block mr-2" />
                    <span className="text-purple-700">AI sedang menghitung jarak terpendek...</span>
                  </div>
                )}

                {aiSuggestions.jarak && !isAiProcessing && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-green-700 text-sm">{aiSuggestions.jarak}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">Jarak (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full border rounded-lg px-3 py-2 bg-gray-50"
                    value={formData.jarak_km || ''}
                    onChange={(e) => setFormData({...formData, jarak_km: e.target.value})}
                    placeholder="Dihitung otomatis oleh AI"
                    readOnly
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    🤖 AI menghitung berdasarkan koordinat kedua tempat
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Estimasi Waktu (menit)</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.estimasi_waktu_menit || ''}
                    onChange={(e) => setFormData({...formData, estimasi_waktu_menit: e.target.value})}
                    placeholder="Estimasi waktu tempuh"
                  />
                </div>
              </div>
            )}

            {/* FORM LAINNYA (sederhana, tanpa AI) */}
            {(activeTab === 'tempat_layanan_terkait' || activeTab === 'tempat_aktivitas_berkala' || 
              activeTab === 'tempat_insiden_historis' || activeTab === 'tempat_bantuan_tersedia') && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tempat *</label>
                  <select
                    required
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.tempat_id || ''}
                    onChange={(e) => setFormData({...formData, tempat_id: e.target.value})}
                  >
                    <option value="">Pilih tempat...</option>
                    {tempatList.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {activeTab === 'tempat_layanan_terkait' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">Jenis Layanan</label>
                      <input
                        type="text"
                        className="w-full border rounded-lg px-3 py-2"
                        value={formData.layanan || ''}
                        onChange={(e) => setFormData({...formData, layanan: e.target.value})}
                        placeholder="parkir, toilet, musholah, dll"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Sub Layanan</label>
                      <input
                        type="text"
                        className="w-full border rounded-lg px-3 py-2"
                        value={formData.sub_layanan || ''}
                        onChange={(e) => setFormData({...formData, sub_layanan: e.target.value})}
                        placeholder="Detail layanan"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is_tersedia"
                        checked={formData.is_tersedia !== false}
                        onChange={(e) => setFormData({...formData, is_tersedia: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <label htmlFor="is_tersedia" className="text-sm">Tersedia</label>
                    </div>
                  </>
                )}

                {activeTab === 'tempat_aktivitas_berkala' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">Nama Aktivitas *</label>
                      <input
                        type="text"
                        required
                        className="w-full border rounded-lg px-3 py-2"
                        value={formData.nama_aktivitas || ''}
                        onChange={(e) => setFormData({...formData, nama_aktivitas: e.target.value})}
                        placeholder="Contoh: Pengajian Rutin"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Deskripsi</label>
                      <textarea
                        className="w-full border rounded-lg px-3 py-2"
                        rows="2"
                        value={formData.deskripsi || ''}
                        onChange={(e) => setFormData({...formData, deskripsi: e.target.value})}
                        placeholder="Deskripsi kegiatan..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Hari</label>
                      <select
                        className="w-full border rounded-lg px-3 py-2"
                        value={formData.hari || ''}
                        onChange={(e) => setFormData({...formData, hari: e.target.value})}
                      >
                        <option value="">Pilih hari...</option>
                        <option value="Senin">Senin</option>
                        <option value="Selasa">Selasa</option>
                        <option value="Rabu">Rabu</option>
                        <option value="Kamis">Kamis</option>
                        <option value="Jumat">Jumat</option>
                        <option value="Sabtu">Sabtu</option>
                        <option value="Minggu">Minggu</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Jam Mulai</label>
                        <input
                          type="time"
                          className="w-full border rounded-lg px-3 py-2"
                          value={formData.jam_mulai || ''}
                          onChange={(e) => setFormData({...formData, jam_mulai: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Jam Selesai</label>
                        <input
                          type="time"
                          className="w-full border rounded-lg px-3 py-2"
                          value={formData.jam_selesai || ''}
                          onChange={(e) => setFormData({...formData, jam_selesai: e.target.value})}
                        />
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'tempat_insiden_historis' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">Judul Insiden *</label>
                      <input
                        type="text"
                        required
                        className="w-full border rounded-lg px-3 py-2"
                        value={formData.judul || ''}
                        onChange={(e) => setFormData({...formData, judul: e.target.value})}
                        placeholder="Contoh: Kebakaran Pasar"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Deskripsi</label>
                      <textarea
                        className="w-full border rounded-lg px-3 py-2"
                        rows="3"
                        value={formData.deskripsi || ''}
                        onChange={(e) => setFormData({...formData, deskripsi: e.target.value})}
                        placeholder="Detail kejadian..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Tanggal Mulai</label>
                      <input
                        type="date"
                        className="w-full border rounded-lg px-3 py-2"
                        value={formData.tanggal_mulai?.split('T')[0] || ''}
                        onChange={(e) => setFormData({...formData, tanggal_mulai: e.target.value})}
                      />
                    </div>
                  </>
                )}

                {activeTab === 'tempat_bantuan_tersedia' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">Jenis Bantuan *</label>
                      <input
                        type="text"
                        required
                        className="w-full border rounded-lg px-3 py-2"
                        value={formData.jenis_bantuan || ''}
                        onChange={(e) => setFormData({...formData, jenis_bantuan: e.target.value})}
                        placeholder="Contoh: Logistik, Medis, Evakuasi"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Kadaluarsa</label>
                      <input
                        type="datetime-local"
                        className="w-full border rounded-lg px-3 py-2"
                        value={formData.kadaluarsa?.slice(0, 16) || ''}
                        onChange={(e) => setFormData({...formData, kadaluarsa: e.target.value})}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Tombol Submit */}
            <div className="flex gap-3 mt-6 pt-4 border-t">
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Simpan
                  </>
                )}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditingItem(null); setFormData({}); setAiSuggestions({}); }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TABEL DATA */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600 mx-auto mb-2" />
            <p className="text-gray-500">Loading...</p>
          </div>
        ) : dataList.length === 0 ? (
          <div className="text-center py-10 text-gray-500">Belum ada data</div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === 'tempat' && (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left">Nama</th>
                    <th className="p-3 text-left">Kategori</th>
                    <th className="p-3 text-left">Alamat</th>
                    <th className="p-3 text-left">Koordinat</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {dataList.map((item) => (
                    <tr key={item.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-medium">{item.name}</td>
                      <td className="p-3">{item.category || '-'}</td>
                      <td className="p-3 text-sm text-gray-600">{item.alamat?.substring(0, 40) || '-'}</td>
                      <td className="p-3 text-xs font-mono text-gray-500">
                        {item.latitude && item.longitude ? `${item.latitude}, ${item.longitude}` : '-'}
                      </td>
                      <td className="p-3 text-center space-x-2">
                        <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'tempat_koneksi' && (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left">Dari</th>
                    <th className="p-3 text-left">Ke</th>
                    <th className="p-3 text-left">Jarak</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {dataList.map((item) => (
                    <tr key={item.id} className="border-t hover:bg-gray-50">
                      <td className="p-3">{item.tempat1_nama}</td>
                      <td className="p-3">{item.tempat2_nama}</td>
                      <td className="p-3">
                        {item.jarak_km} km
                        {item.jarak_km && (
                          <span className="text-xs text-green-600 ml-2">🤖 AI</span>
                        )}
                      </td>
                      <td className="p-3 text-center space-x-2">
                        <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {(activeTab === 'tempat_layanan_terkait' || activeTab === 'tempat_aktivitas_berkala' || 
              activeTab === 'tempat_insiden_historis' || activeTab === 'tempat_bantuan_tersedia') && (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left">Tempat</th>
                    <th className="p-3 text-left">Detail</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {dataList.map((item) => (
                    <tr key={item.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-medium">{item.tempat_nama}</td>
                      <td className="p-3 text-sm text-gray-600">
                        {activeTab === 'tempat_layanan_terkait' && (
                          <span>{item.layanan}{item.sub_layanan && ` - ${item.sub_layanan}`}</span>
                        )}
                        {activeTab === 'tempat_aktivitas_berkala' && (
                          <span>
                            <strong>{item.nama_aktivitas}</strong>
                            {item.hari && <span className="text-gray-500 ml-2">({item.hari})</span>}
                          </span>
                        )}
                        {activeTab === 'tempat_insiden_historis' && (
                          <span>{item.judul}</span>
                        )}
                        {activeTab === 'tempat_bantuan_tersedia' && (
                          <span>{item.jenis_bantuan}</span>
                        )}
                      </td>
                      <td className="p-3 text-center space-x-2">
                        <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}