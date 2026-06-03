"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  MapPin, Link2, Building, Calendar, AlertTriangle,
  Truck, Plus, Edit, Trash2, Save,
  Database, Home, RefreshCw, Navigation,
  FileText
} from 'lucide-react';

export default function SuperAdminDataPage() {
  const { isSuperAdmin, isLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('tempat');
  const [loading, setLoading] = useState(false);
  const [dataList, setDataList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [tempatList, setTempatList] = useState([]);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !isSuperAdmin) {
      router.push('/admin/dashboard');
    }
  }, [isLoading, isSuperAdmin, router]);

  const fetchTempatList = useCallback(async () => {
    const { data } = await supabase
      .from('tempat')
      .select('id, name')
      .order('name');
    setTempatList(data || []);
  }, []);

  // PERBAIKAN: fetchData dengan query JOIN langsung
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'tempat') {
        // ========== UNTUK TAB TEMPAT ==========
        const [tempatResult, metadataResult] = await Promise.all([
          supabase.from('tempat').select('*').order('name'),
          supabase.from('tempat_metadata').select('*')
        ]);

        if (tempatResult.error) throw tempatResult.error;
        if (metadataResult.error) throw metadataResult.error;

        const formattedData = tempatResult.data.map(tempat => {
          const metadata = metadataResult.data?.find(m => m.tempat_id === tempat.id);
          return {
            ...tempat,
            kapasitas_normal: metadata?.kapasitas_normal || null,
            jam_buka: metadata?.jam_buka || null,
            jam_tutup: metadata?.jam_tutup || null,
            is_24_jam: metadata?.is_24_jam || false,
            tingkat_prioritas: metadata?.tingkat_prioritas || null,
            catatan_khusus: metadata?.catatan_khusus || null,
            metadata_id: metadata?.id || null
          };
        });

        setDataList(formattedData);
      }
      else if (activeTab === 'tempat_koneksi') {
        // Ambil semua data dari tempat_koneksi
        const { data: koneksiData, error: koneksiError } = await supabase
          .from('tempat_koneksi')
          .select('*');

        if (koneksiError) throw koneksiError;

        if (!koneksiData || koneksiData.length === 0) {
          setDataList([]);
          return;
        }

        // Kumpulkan semua ID tempat
        const semuaIds = [];
        koneksiData.forEach(item => {
          semuaIds.push(item.tempat_id_1, item.tempat_id_2);
        });

        // Ambil nama tempat (tanpa JOIN, pakai IN query)
        const { data: tempatData, error: tempatError } = await supabase
          .from('tempat')
          .select('id, name')
          .in('id', semuaIds);

        if (tempatError) throw tempatError;

        // Buat map untuk akses cepat
        const tempatMap = new Map();
        tempatData?.forEach(t => tempatMap.set(t.id, t));

        // Gabungkan data
        const finalData = koneksiData.map(item => ({
          ...item,
          tempat1: tempatMap.get(item.tempat_id_1),
          tempat2: tempatMap.get(item.tempat_id_2)
        }));

        console.log('Final Koneksi Data:', finalData);
        setDataList(finalData);
      }
      else if (activeTab === 'tempat_layanan_terkait') {
        // ========== UNTUK LAYANAN ==========
        const { data, error } = await supabase
          .from('tempat_layanan_terkait')
          .select(`
          *,
          tempat:tempat!fk_layanan_tempat(id, name)
        `);

        if (error) throw error;
        setDataList(data || []);
      }
      else if (activeTab === 'tempat_aktivitas_berkala') {
        // ========== UNTUK AKTIVITAS BERKALA ==========
        const { data, error } = await supabase
          .from('tempat_aktivitas_berkala')
          .select(`
          *,
          tempat:tempat!fk_aktivitas_tempat(id, name)
        `);

        if (error) throw error;
        setDataList(data || []);
      }
      else if (activeTab === 'tempat_insiden_historis') {
        // ========== UNTUK INSIDEN HISTORIS ==========
        const { data, error } = await supabase
          .from('tempat_insiden_historis')
          .select(`
          *,
          tempat:tempat!fk_insiden_tempat(id, name)
        `);

        if (error) throw error;
        setDataList(data || []);
      }
      else if (activeTab === 'tempat_bantuan_tersedia') {
        // ========== UNTUK BANTUAN ==========
        const { data, error } = await supabase
          .from('tempat_bantuan_tersedia')
          .select(`
          *,
          tempat:tempat!fk_bantuan_tempat(id, name)
        `);

        if (error) throw error;
        setDataList(data || []);
      }
      else {
        // Fallback untuk tab lain
        const { data, error } = await supabase.from(activeTab).select('*');
        if (error) throw error;
        setDataList(data || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      alert('Gagal mengambil data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchData();
      if (activeTab !== 'tempat') {
        fetchTempatList();
      }
    }
  }, [activeTab, isSuperAdmin, fetchData, fetchTempatList]);

  const handleSave = async () => {
    if (saveLoading) return;
    setSaveLoading(true);

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
      await fetchData();
    } catch (err) {
      console.error('Save error:', err);
      alert('Error: ' + err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSaveTempat = async () => {
    if (!formData.name) throw new Error('Nama tempat wajib diisi');
    if (!formData.latitude || !formData.longitude) throw new Error('Koordinat lokasi wajib diisi');

    const now = new Date().toISOString();
    const latitude = parseFloat(formData.latitude);
    const longitude = parseFloat(formData.longitude);
    const kapasitasNormal = formData.kapasitas_normal ? parseInt(formData.kapasitas_normal) : null;

    if (editingItem) {
      const updates = [];

      updates.push(
        supabase
          .from('tempat')
          .update({
            name: formData.name,
            alamat: formData.alamat || null,
            latitude,
            longitude,
            category: formData.category || 'umum',
            updated_at: now
          })
          .eq('id', editingItem.id)
      );

      if (editingItem.metadata_id) {
        updates.push(
          supabase
            .from('tempat_metadata')
            .update({
              kapasitas_normal: kapasitasNormal,
              jam_buka: formData.jam_buka || null,
              jam_tutup: formData.jam_tutup || null,
              is_24_jam: formData.is_24_jam || false,
              tingkat_prioritas: formData.tingkat_prioritas || null,
              catatan_khusus: formData.catatan_khusus || null,
              updated_at: now
            })
            .eq('id', editingItem.metadata_id)
        );
      } else if (editingItem.id) {
        updates.push(
          supabase
            .from('tempat_metadata')
            .insert([{
              tempat_id: editingItem.id,
              kapasitas_normal: kapasitasNormal,
              jam_buka: formData.jam_buka || null,
              jam_tutup: formData.jam_tutup || null,
              is_24_jam: formData.is_24_jam || false,
              tingkat_prioritas: formData.tingkat_prioritas || null,
              catatan_khusus: formData.catatan_khusus || null,
              created_at: now,
              updated_at: now
            }])
        );
      }

      const results = await Promise.all(updates);
      for (const result of results) {
        if (result.error) throw result.error;
      }
    } else {
      const { data: tempatBaru, error: errorTempat } = await supabase
        .from('tempat')
        .insert([{
          name: formData.name,
          alamat: formData.alamat || null,
          latitude,
          longitude,
          category: formData.category || 'umum',
          created_at: now,
          updated_at: now
        }])
        .select();

      if (errorTempat) throw errorTempat;

      const { error: errorMetadata } = await supabase
        .from('tempat_metadata')
        .insert([{
          tempat_id: tempatBaru[0].id,
          kapasitas_normal: kapasitasNormal,
          jam_buka: formData.jam_buka || null,
          jam_tutup: formData.jam_tutup || null,
          is_24_jam: formData.is_24_jam || false,
          tingkat_prioritas: formData.tingkat_prioritas || null,
          catatan_khusus: formData.catatan_khusus || null,
          created_at: now,
          updated_at: now
        }]);

      if (errorMetadata) throw errorMetadata;
    }
  };

  const handleSaveOther = async () => {
    const cleanedData = { ...formData };

    if (editingItem) {
      const { error } = await supabase
        .from(activeTab)
        .update(cleanedData)
        .eq('id', editingItem.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from(activeTab)
        .insert([cleanedData]);
      if (error) throw error;
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Yakin hapus data ini?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from(activeTab)
        .delete()
        .eq('id', id);
      if (error) throw error;
      alert('✅ Data berhasil dihapus!');
      await fetchData();
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

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Browser tidak mendukung GPS");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString()
        }));
        alert("✅ Lokasi berhasil diambil!");
      },
      (error) => {
        alert("Gagal ambil lokasi: " + error.message);
      }
    );
  };

  const tabs = [
    { id: 'tempat', label: '📍 Tempat', icon: <MapPin size={16} /> },
    { id: 'tempat_koneksi', label: '🔗 Koneksi', icon: <Link2 size={16} /> },
    { id: 'tempat_layanan_terkait', label: '🏢 Fasilitas', icon: <Building size={16} /> },
    { id: 'tempat_aktivitas_berkala', label: '📅 Aktivitas Rutin', icon: <Calendar size={16} /> },
    { id: 'tempat_insiden_historis', label: '⚠️ Riwayat', icon: <AlertTriangle size={16} /> },
    { id: 'tempat_bantuan_tersedia', label: '🚛 Bantuan', icon: <Truck size={16} /> }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Database size={24} className="text-emerald-600" />
              <h1 className="font-bold text-lg">SuperAdmin - Manajemen Data</h1>
            </div>
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <Home size={16} />
              Kembali
            </button>
          </div>

          <div className="flex overflow-x-auto gap-1 pb-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setShowForm(false);
                  setEditingItem(null);
                  setFormData({});
                }}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition ${activeTab === tab.id
                  ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-4">
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700"
            >
              <Plus size={16} />
              Tambah Data
            </button>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative p-6">
              {renderForm(activeTab, formData, setFormData, tempatList, editingItem, getCurrentLocation)}
              <div className="flex gap-3 mt-6 pt-4 border-t sticky bottom-0 bg-white">
                <button
                  onClick={handleSave}
                  disabled={saveLoading}
                  className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saveLoading ? (
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
                  onClick={() => { setShowForm(false); setEditingItem(null); setFormData({}); }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {renderTable(activeTab, dataList, handleEdit, handleDelete, loading)}
        </div>
      </div>
    </div>
  );
}

// ==================== FORM RENDERER ====================
function renderForm(activeTab, formData, setFormData, tempatList, editingItem, getCurrentLocation) {
  const commonFields = (
    <>
      <h2 className="text-xl font-bold mb-4">
        {editingItem ? '✏️ Edit Data' : '➕ Tambah Data Baru'}
      </h2>
    </>
  );

  switch (activeTab) {
    case 'tempat':
      return (
        <div className="space-y-4">
          {commonFields}
          <div className="border-b pb-4">
            <h3 className="font-semibold text-emerald-700 mb-3 flex items-center gap-2">
              <MapPin size={16} />
              Data Dasar Tempat
            </h3>
            <div>
              <label className="block text-sm font-medium mb-1">Nama Tempat *</label>
              <input type="text" required className="w-full border rounded-lg px-3 py-2" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Contoh: SPBU Pertamina 54.671.16" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Alamat</label>
              <input type="text" className="w-full border rounded-lg px-3 py-2" value={formData.alamat || ''} onChange={(e) => setFormData({ ...formData, alamat: e.target.value })} placeholder="Alamat lengkap" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Kategori</label>
              <select className="w-full border rounded-lg px-3 py-2" value={formData.category || 'umum'} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                <option value="masjid">🕌 Masjid</option>
                <option value="industri">🏭 Industri</option>
                <option value="sekolah">🏫 Sekolah</option>
                <option value="rs">🏥 Rumah Sakit</option>
                <option value="mall">🛍️ Mall</option>
                <option value="wisata">🏖️ Wisata</option>
                <option value="kantor">🏢 Kantor</option>
                <option value="pom_bensin">⛽ SPBU</option>
                <option value="pasar">🛒 Pasar</option>
                <option value="umum">📍 Umum</option>
                <option value="jalan">📍 Jalan</option>
              </select>
            </div>
            <div className="border rounded-lg p-3 bg-blue-50">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium">📍 Koordinat Lokasi *</label>
                <button type="button" onClick={getCurrentLocation} className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-600">
                  <Navigation size={12} />
                  Ambil GPS
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Latitude</label>
                  <input type="text" required className="w-full border rounded-lg px-3 py-2 font-mono text-sm" value={formData.latitude || ''} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} placeholder="-6.200000" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Longitude</label>
                  <input type="text" required className="w-full border rounded-lg px-3 py-2 font-mono text-sm" value={formData.longitude || ''} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} placeholder="106.800000" />
                </div>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-emerald-700 mb-3 flex items-center gap-2">
              <FileText size={16} />
              Detail Metadata
            </h3>
            <div>
              <label className="block text-sm font-medium mb-1">Kapasitas Normal</label>
              <input type="number" className="w-full border rounded-lg px-3 py-2" value={formData.kapasitas_normal || ''} onChange={(e) => setFormData({ ...formData, kapasitas_normal: e.target.value })} placeholder="Jumlah orang" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Jam Buka</label>
                <input type="time" className="w-full border rounded-lg px-3 py-2" value={formData.jam_buka || ''} onChange={(e) => setFormData({ ...formData, jam_buka: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Jam Tutup</label>
                <input type="time" className="w-full border rounded-lg px-3 py-2" value={formData.jam_tutup || ''} onChange={(e) => setFormData({ ...formData, jam_tutup: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_24_jam" checked={formData.is_24_jam || false} onChange={(e) => setFormData({ ...formData, is_24_jam: e.target.checked })} className="w-4 h-4" />
              <label htmlFor="is_24_jam" className="text-sm">Buka 24 Jam</label>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tingkat Prioritas</label>
              <select className="w-full border rounded-lg px-3 py-2" value={formData.tingkat_prioritas || 'normal'} onChange={(e) => setFormData({ ...formData, tingkat_prioritas: e.target.value })}>
                <option value="rendah">🟢 Rendah</option>
                <option value="normal">🔵 Normal</option>
                <option value="tinggi">🟠 Tinggi</option>
                <option value="kritis">🔴 Kritis</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Catatan Khusus</label>
              <textarea className="w-full border rounded-lg px-3 py-2" rows="2" value={formData.catatan_khusus || ''} onChange={(e) => setFormData({ ...formData, catatan_khusus: e.target.value })} placeholder="Catatan tambahan..." />
            </div>
          </div>
        </div>
      );

    case 'tempat_koneksi':
      return (
        <div className="space-y-4">
          {commonFields}
          <div>
            <label className="block text-sm font-medium mb-1">Tempat 1 (Sumber) *</label>
            <select required className="w-full border rounded-lg px-3 py-2" value={formData.tempat_id_1 || ''} onChange={(e) => setFormData({ ...formData, tempat_id_1: e.target.value })}>
              <option value="">Pilih tempat...</option>
              {tempatList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tempat 2 (Tujuan) *</label>
            <select required className="w-full border rounded-lg px-3 py-2" value={formData.tempat_id_2 || ''} onChange={(e) => setFormData({ ...formData, tempat_id_2: e.target.value })}>
              <option value="">Pilih tempat...</option>
              {tempatList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Jarak (km) *</label>
            <input type="number" step="0.1" required className="w-full border rounded-lg px-3 py-2" value={formData.jarak_km || ''} onChange={(e) => setFormData({ ...formData, jarak_km: e.target.value })} placeholder="2.5" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Estimasi Waktu Tempuh (menit)</label>
            <input type="number" className="w-full border rounded-lg px-3 py-2" value={formData.estimasi_waktu_tempuh_menit || ''} onChange={(e) => setFormData({ ...formData, estimasi_waktu_tempuh_menit: e.target.value })} placeholder="10" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tipe Koneksi</label>
            <select className="w-full border rounded-lg px-3 py-2" value={formData.tipe_koneksi || 'satu_kawasan'} onChange={(e) => setFormData({ ...formData, tipe_koneksi: e.target.value })}>
              <option value="satu_kawasan">Satu Kawasan</option>
              <option value="berdekatan">Berdekatan</option>
              <option value="jauh">Jauh</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Pengaruh T1→T2</label>
              <input type="number" step="0.1" min="0" max="1" className="w-full border rounded-lg px-3 py-2" value={formData.tingkat_pengaruh_t1_ke_t2 || ''} onChange={(e) => setFormData({ ...formData, tingkat_pengaruh_t1_ke_t2: e.target.value })} placeholder="0.6" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Pengaruh T2→T1</label>
              <input type="number" step="0.1" min="0" max="1" className="w-full border rounded-lg px-3 py-2" value={formData.tingkat_pengaruh_t2_ke_t1 || ''} onChange={(e) => setFormData({ ...formData, tingkat_pengaruh_t2_ke_t1: e.target.value })} placeholder="0.5" />
            </div>
          </div>
        </div>
      );

    case 'tempat_layanan_terkait':
      return (
        <div className="space-y-4">
          {commonFields}
          <div>
            <label className="block text-sm font-medium mb-1">Tempat *</label>
            <select required className="w-full border rounded-lg px-3 py-2" value={formData.tempat_id || ''} onChange={(e) => setFormData({ ...formData, tempat_id: e.target.value })}>
              <option value="">Pilih tempat...</option>
              {tempatList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Jenis Layanan</label>
            <input type="text" className="w-full border rounded-lg px-3 py-2" value={formData.layanan || ''} onChange={(e) => setFormData({ ...formData, layanan: e.target.value })} placeholder="parkir, toilet, musholah, dll" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sub Layanan (detail)</label>
            <input type="text" className="w-full border rounded-lg px-3 py-2" value={formData.sub_layanan || ''} onChange={(e) => setFormData({ ...formData, sub_layanan: e.target.value })} placeholder="Contoh: Parkir motor gratis" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_tersedia" checked={formData.is_tersedia !== false} onChange={(e) => setFormData({ ...formData, is_tersedia: e.target.checked })} className="w-4 h-4" />
            <label htmlFor="is_tersedia" className="text-sm">Tersedia</label>
          </div>
        </div>
      );

    default:
      return (
        <div className="space-y-4">
          {commonFields}
          <p className="text-gray-500 text-center py-8">Form untuk tab ini sedang dalam pengembangan</p>
        </div>
      );
  }
}

// ==================== TABLE RENDERER ====================
function renderTable(activeTab, dataList, handleEdit, handleDelete, loading) {
  if (loading) {
    return <div className="text-center py-10">Loading...</div>;
  }

  if (dataList.length === 0) {
    return <div className="text-center py-10 text-gray-500">Belum ada data</div>;
  }

  switch (activeTab) {
    case 'tempat':
      return (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Nama</th>
                <th className="p-3 text-left">Kategori</th>
                <th className="p-3 text-left">Alamat</th>
                <th className="p-3 text-left">Kapasitas</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {dataList.map((item) => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">{item.name}</td>
                  <td className="p-3">{item.category || '-'}</td>
                  <td className="p-3 text-sm text-gray-600">{item.alamat?.substring(0, 40) || '-'}</td>
                  <td className="p-3">{item.kapasitas_normal?.toLocaleString() || '-'}</td>
                  <td className="p-3 text-center space-x-2">
                    <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800"><Edit size={16} /></button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'tempat_koneksi':
      return (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Dari</th>
                <th className="p-3 text-left">Ke</th>
                <th className="p-3 text-left">Tipe</th>
                <th className="p-3 text-left">Jarak (km)</th>
                <th className="p-3 text-left">Pengaruh</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {dataList.map((item) => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">{item.tempat1?.name || '-'}</td>
                  <td className="p-3 font-medium">{item.tempat2?.name || '-'}</td>
                  <td className="p-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                      {item.tipe_koneksi || '-'}
                    </span>
                  </td>
                  <td className="p-3">{item.jarak_km || '-'}</td>
                  <td className="p-3">
                    {item.tingkat_pengaruh_t1_ke_t2 ? `${item.tingkat_pengaruh_t1_ke_t2} → ${item.tingkat_pengaruh_t2_ke_t1}` : '-'}
                  </td>
                  <td className="p-3 text-center space-x-2">
                    <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800"><Edit size={16} /></button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'tempat_layanan_terkait':
      return (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Tempat</th>
                <th className="p-3 text-left">Layanan</th>
                <th className="p-3 text-left">Detail</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {dataList.map((item) => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">{item.tempat?.name || '-'}</td>
                  <td className="p-3 font-medium">{item.layanan || '-'}</td>
                  <td className="p-3 text-sm text-gray-600">{item.sub_layanan || '-'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${item.is_tersedia ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {item.is_tersedia ? 'Tersedia' : 'Tidak'}
                    </span>
                  </td>
                  <td className="p-3 text-center space-x-2">
                    <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800"><Edit size={16} /></button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'tempat_aktivitas_berkala':
      return (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Nama Aktivitas</th>
                <th className="p-3 text-left">Tempat</th>
                <th className="p-3 text-left">Jadwal</th>
                <th className="p-3 text-left">Deskripsi</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {dataList.map((item) => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">{item.nama_aktivitas || '-'}</td>
                  <td className="p-3">{item.tempat?.name || '-'}</td>
                  <td className="p-3">{item.jadwal || '-'}</td>
                  <td className="p-3 text-sm text-gray-600">{item.deskripsi?.substring(0, 50) || '-'}</td>
                  <td className="p-3 text-center space-x-2">
                    <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800"><Edit size={16} /></button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'tempat_insiden_historis':
      return (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Judul Insiden</th>
                <th className="p-3 text-left">Tempat</th>
                <th className="p-3 text-left">Tanggal</th>
                <th className="p-3 text-left">Deskripsi</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {dataList.map((item) => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">{item.judul_insiden || '-'}</td>
                  <td className="p-3">{item.tempat?.name || '-'}</td>
                  <td className="p-3">{item.tanggal ? new Date(item.tanggal).toLocaleDateString('id-ID') : '-'}</td>
                  <td className="p-3 text-sm text-gray-600">{item.deskripsi?.substring(0, 50) || '-'}</td>
                  <td className="p-3 text-center space-x-2">
                    <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800"><Edit size={16} /></button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'tempat_bantuan_tersedia':
      return (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Jenis Bantuan</th>
                <th className="p-3 text-left">Tempat</th>
                <th className="p-3 text-left">Kontak</th>
                <th className="p-3 text-left">Keterangan</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {dataList.map((item) => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">{item.jenis_bantuan || '-'}</td>
                  <td className="p-3">{item.tempat?.name || '-'}</td>
                  <td className="p-3">{item.kontak || '-'}</td>
                  <td className="p-3 text-sm text-gray-600">{item.keterangan?.substring(0, 40) || '-'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${item.is_tersedia ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {item.is_tersedia ? 'Tersedia' : 'Tidak'}
                    </span>
                  </td>
                  <td className="p-3 text-center space-x-2">
                    <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800"><Edit size={16} /></button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    default:
      return (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">ID</th>
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {dataList.map((item) => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-mono text-xs">{String(item.id).slice(0, 8)}...</td>
                  <td className="p-3 text-sm text-gray-600">{JSON.stringify(item).slice(0, 100)}...</td>
                  <td className="p-3 text-center space-x-2">
                    <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800"><Edit size={16} /></button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}