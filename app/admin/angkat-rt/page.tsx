'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserPlus, Search, MapPin, CheckCircle, 
  Loader2, Crown, ShieldCheck, Calendar,
  Award, Trash2, UserCheck, AlertCircle, Store
} from 'lucide-react';

export default function AngkatRTPage() {
  const { profile, isSuperAdmin } = useAuth();
  const [warga, setWarga] = useState([]);
  const [rtList, setRtList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // State Modal & Form
  const [selectedWarga, setSelectedWarga] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [wilayah, setWilayah] = useState('');
  const [subRole, setSubRole] = useState<'admin_rt' | 'admin_tempat'>('admin_rt');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      refreshData();
    }
  }, [isSuperAdmin]);

  const refreshData = async () => {
    setLoading(true);
    await Promise.all([fetchWarga(), fetchRtList()]);
    setLoading(false);
  };

  const fetchWarga = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'warga') // Hanya warga biasa yang bisa dicalonkan
        .order('full_name', { ascending: true });

      if (error) throw error;
      setWarga(data || []);
    } catch (err: any) {
      console.error('Fetch Warga Error:', err.message);
    }
  };

  const fetchRtList = async () => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'admin')
      // Ganti 'created_at' menjadi 'updated_at'
      .order('updated_at', { ascending: false }); 

    if (error) throw error;
    setRtList(data || []);
  } catch (err: any) {
    console.error('Fetch RT Error:', err.message);
  }
};

  const handleAngkatRt = async () => {
    if (!selectedWarga || !wilayah.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: 'admin',
          sub_role: subRole,
          wilayah_rt: wilayah,
          assigned_desa: selectedWarga.desa,
          assigned_kecamatan: selectedWarga.kecamatan,
          appointed_by: profile?.id,
          rt_status: 'aktif',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedWarga.id);

      if (error) throw error;

      setShowConfirmModal(false);
      setSelectedWarga(null);
      setWilayah('');
      refreshData();
    } catch (err: any) {
      alert('Gagal penobatan: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNonaktifkanRt = async (rtId: string, rtName: string) => {
    if (!confirm(`Cabut wewenang dari ${rtName}? User akan kembali menjadi warga biasa.`)) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: 'warga',
          sub_role: null,
          rt_status: 'nonaktif',
          wilayah_rt: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', rtId);

      if (error) throw error;
      refreshData();
    } catch (err: any) {
      alert('Gagal mencabut jabatan: ' + err.message);
    }
  };

  const filteredWarga = warga.filter(w => 
    w.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    w.desa?.toLowerCase().includes(search.toLowerCase())
  );

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] p-6 text-center">
        <div className="w-20 h-20 bg-rose-100 text-rose-500 rounded-3xl flex items-center justify-center mb-4"><ShieldCheck size={40} /></div>
        <h2 className="text-2xl font-black text-slate-800">Akses Terbatas</h2>
        <p className="text-slate-400 max-w-xs mt-2 text-sm font-medium">Hanya Petinggi Setempat yang memiliki wewenang mengelola pengurus wilayah.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      {/* HEADER SECTION */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 bg-purple-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-purple-200">
             <UserCheck size={32} />
           </div>
           <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Otoritas Pengurus</h1>
              <p className="text-sm text-slate-400 font-medium mt-2 flex items-center gap-1">
                <Crown size={14} className="text-amber-500" /> Panel Kendali Petinggi Setempat
              </p>
           </div>
        </div>
        <div className="flex bg-slate-50 p-2 rounded-2xl gap-4 border border-slate-100">
           <div className="px-5 py-2 text-center border-r border-slate-200">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Pengurus</p>
              <p className="text-xl font-black text-slate-800">{rtList.length}</p>
           </div>
           <div className="px-5 py-2 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Warga Tersedia</p>
              <p className="text-xl font-black text-slate-800">{warga.length}</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LIST WARGA (CALON) */}
        <div className="lg:col-span-7 space-y-4">
           <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-2">Cari Calon Pengurus</h2>
           <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[600px]">
              <div className="p-6 border-b border-slate-50">
                <div className="relative group">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-purple-500 transition-colors" />
                  <input
                    type="text"
                    placeholder="Ketik nama warga atau desa..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-none text-sm font-bold focus:ring-2 focus:ring-purple-500 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                    <Loader2 size={40} className="animate-spin mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">Sinkronisasi Data...</p>
                  </div>
                ) : filteredWarga.length === 0 ? (
                  <div className="text-center py-20 opacity-40">
                    <UserPlus size={60} className="mx-auto mb-4 text-slate-200" />
                    <p className="text-sm font-bold text-slate-400">Warga tidak ditemukan</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {filteredWarga.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => {
                          setSelectedWarga(w);
                          setWilayah(w.desa || '');
                          setShowConfirmModal(true);
                        }}
                        className="flex items-center gap-4 p-4 rounded-[1.5rem] hover:bg-slate-50 transition-all group border border-transparent hover:border-slate-100 text-left"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600 font-black text-lg overflow-hidden">
                          {w.avatar_url ? <img src={w.avatar_url} className="w-full h-full object-cover" alt="avatar" /> : w.full_name?.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-black text-slate-800 leading-none">{w.full_name}</h3>
                          <p className="text-[10px] text-slate-400 font-bold mt-1.5 uppercase flex items-center gap-1">
                             <MapPin size={10} className="text-emerald-500" /> {w.desa || 'Alamat belum lengkap'}
                          </p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 bg-purple-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">
                          Angkat
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
           </div>
        </div>

        {/* LIST PENGURUS AKTIF */}
        <div className="lg:col-span-5 space-y-4">
           <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] px-2">Pejabat Aktif</h2>
           <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[600px]">
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {rtList.length === 0 && !loading ? (
                  <div className="py-20 text-center text-slate-300">
                    <Award size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest">Belum ada pengurus</p>
                  </div>
                ) : (
                  rtList.map((rt) => (
                    <div key={rt.id} className="p-5 rounded-3xl border border-slate-100 bg-white hover:shadow-lg transition-all relative overflow-hidden group">
                       <div className="flex items-start gap-4 relative z-10">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl overflow-hidden shrink-0 shadow-lg ${rt.sub_role === 'admin_tempat' ? 'bg-blue-500' : 'bg-emerald-500'}`}>
                            {rt.avatar_url ? <img src={rt.avatar_url} className="w-full h-full object-cover" alt="p" /> : rt.full_name?.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2">
                               <h3 className="font-black text-slate-800 truncate leading-none">{rt.full_name}</h3>
                               {rt.sub_role === 'admin_tempat' ? <Store size={14} className="text-blue-500" /> : <ShieldCheck size={14} className="text-emerald-500" />}
                             </div>
                             <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg mt-2 ${rt.sub_role === 'admin_tempat' ? 'bg-blue-50' : 'bg-emerald-50'}`}>
                                <MapPin size={10} className={rt.sub_role === 'admin_tempat' ? 'text-blue-600' : 'text-emerald-600'} />
                                <span className={`text-[9px] font-black uppercase ${rt.sub_role === 'admin_tempat' ? 'text-blue-700' : 'text-emerald-700'}`}>
                                   {rt.sub_role === 'admin_tempat' ? 'TEMPAT: ' : 'RT: '} {rt.wilayah_rt}
                                </span>
                             </div>
                          </div>
                          <button onClick={() => handleNonaktifkanRt(rt.id, rt.full_name)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                             <Trash2 size={18} />
                          </button>
                       </div>
                    </div>
                  ))
                )}
              </div>
           </div>
        </div>
      </div>

      {/* MODAL PENOBATAN */}
      <AnimatePresence>
        {showConfirmModal && selectedWarga && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-white rounded-[2.5rem] w-full max-w-md p-8 relative z-10 shadow-2xl overflow-hidden">
              <div className="text-center space-y-4 mb-6">
                <div className="w-20 h-20 bg-purple-100 text-purple-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner"><Award size={40} /></div>
                <h3 className="text-2xl font-black text-slate-900">Penobatan Pengurus</h3>
              </div>

              <div className="space-y-5">
                {/* PILIH SUB-ROLE */}
                <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl">
                  <button onClick={() => setSubRole('admin_rt')} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${subRole === 'admin_rt' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-400'}`}>RT SETEMPAT</button>
                  <button onClick={() => setSubRole('admin_tempat')} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${subRole === 'admin_tempat' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-400'}`}>ADMIN TEMPAT</button>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">
                    {subRole === 'admin_rt' ? 'Wilayah Yurisdiksi RT' : 'Nama Tempat / Kafe'}
                  </label>
                  <div className="relative">
                     <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-500" />
                     <input
                      type="text"
                      value={wilayah}
                      onChange={(e) => setWilayah(e.target.value)}
                      placeholder={subRole === 'admin_rt' ? "Contoh: Dusun Krajan II" : "Contoh: Kafe Kopi Setempat"}
                      className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-800 focus:ring-2 focus:ring-purple-600 outline-none"
                    />
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
                   <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                   <p className="text-[10px] font-bold text-amber-800 leading-relaxed uppercase tracking-tighter">
                     {subRole === 'admin_rt' 
                       ? "RT berwenang memverifikasi Bakul, Ojek, & Jasa di desanya." 
                       : "Admin tempat berwenang membagikan kondisi & promo di lokasinya."}
                   </p>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-4 text-sm font-black text-slate-400 hover:bg-slate-50 rounded-2xl transition-all">BATAL</button>
                <button
                  onClick={handleAngkatRt}
                  disabled={isSubmitting || !wilayah.trim()}
                  className="flex-[2] py-4 rounded-2xl bg-purple-600 text-white text-sm font-black shadow-xl shadow-purple-200 hover:bg-purple-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                  KONFIRMASI
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}