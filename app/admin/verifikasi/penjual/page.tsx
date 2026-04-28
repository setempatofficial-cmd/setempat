// app/admin/verifikasi/penjual/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/context/AuthContext';
import { 
  Store, CheckCircle, XCircle, Loader2, Search,
  ShieldCheck, Crown, ChevronRight, Eye, Send, MapPin
} from 'lucide-react';

export default function VerifikasiPenjualPage() {
  const { profile, isPetinggi, isRt } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('menunggu');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Modal states
  const [modalType, setModalType] = useState(null); // 'rekomendasi' | 'keputusan'
  const [actionType, setActionType] = useState(''); // 'setuju' | 'tolak'
  const [note, setNote] = useState('');

  useEffect(() => {
    fetchSubmissions();
  }, [filter]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('pendaftar_bakul')
        .select(`
          *,
          profil:user_id ( id, full_name, email, phone, desa ),
          rekomendasi_rt_data:rekomendasi_rt_id ( full_name )
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'semua') query = query.eq('status', filter);
      
      // Filter wilayah jika RT (Server-side safety)
      if (isRt && profile?.wilayah_rt) {
        query = query.eq('desa', profile.wilayah_rt);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSubmissions(data || []);
    } catch (err) {
      console.error('Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!actionType) return alert('Pilih status terlebih dahulu!');
    setIsSubmitting(true);

    try {
      if (modalType === 'rekomendasi') {
        const { error } = await supabase
          .from('pendaftar_bakul')
          .update({
            rekomendasi_rt: actionType,
            rekomendasi_rt_id: profile?.id,
            rekomendasi_rt_note: note,
            rekomendasi_rt_at: new Date().toISOString()
          })
          .eq('id', selectedSubmission.id);
        if (error) throw error;
      } else {
        const newStatus = actionType === 'setuju' ? 'aktif' : 'ditolak';
        
        // 1. Update status pendaftaran
        const { error: updateError } = await supabase
          .from('pendaftar_bakul')
          .update({
            status: newStatus,
            verified_at: new Date().toISOString(),
            verified_by: profile?.id,
            verified_note: note
          })
          .eq('id', selectedSubmission.id);
        if (updateError) throw updateError;

        // 2. Jika disetujui, update role di profile
        if (newStatus === 'aktif') {
          await supabase
            .from('profiles')
            .update({ is_seller: true, business_type: 'panyangan' })
            .eq('id', selectedSubmission.user_id);
        }
      }

      alert('Berhasil memproses data!');
      closeModal();
      fetchSubmissions();
      setSelectedSubmission(null);
    } catch (err) {
      alert('Gagal: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setModalType(null);
    setActionType('');
    setNote('');
  };

  const filteredData = submissions.filter(s => 
    s.toko_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.profil?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header Minimalist */}
      <div className="bg-white border-b sticky top-0 z-20 px-4 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500 rounded-lg text-white"><Store size={20}/></div>
            <div>
              <h1 className="text-lg font-black text-slate-800">Panel Verifikasi</h1>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                {isPetinggi ? 'Otoritas Petinggi' : 'Rekomendasi RT'} • {profile?.desa || 'Wilayah'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18}/>
            <input 
              className="w-full pl-10 pr-4 py-2.5 bg-white border rounded-2xl focus:ring-2 ring-orange-500 outline-none transition-all text-sm"
              placeholder="Cari toko/nama..."
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {['menunggu', 'aktif', 'ditolak'].map(f => (
              <button 
                key={f} 
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize whitespace-nowrap transition-all ${filter === f ? 'bg-orange-500 text-white shadow-orange-200 shadow-lg' : 'bg-white border text-slate-500'}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {loading ? <Loader2 className="animate-spin mx-auto text-orange-500 mt-10"/> : 
              filteredData.map(sub => (
                <div 
                  key={sub.id}
                  onClick={() => setSelectedSubmission(sub)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedSubmission?.id === sub.id ? 'border-orange-500 bg-orange-50/30' : 'bg-white border-transparent shadow-sm'}`}
                >
                  <h4 className="font-bold text-slate-800 text-sm truncate">{sub.toko_name}</h4>
                  <p className="text-[11px] text-slate-500 mb-2">{sub.profil?.full_name}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase ${sub.status === 'aktif' ? 'bg-emerald-100 text-emerald-600' : sub.status === 'ditolak' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                      {sub.status}
                    </span>
                    {sub.rekomendasi_rt && <ShieldCheck size={14} className={sub.rekomendasi_rt === 'setuju' ? 'text-blue-500' : 'text-slate-300'}/>}
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Detail View */}
        <div className="lg:col-span-8">
          {selectedSubmission ? (
            <div className="bg-white rounded-3xl border shadow-sm p-6 sticky top-24">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Detail Pengajuan</span>
                  <h2 className="text-2xl font-black text-slate-800">{selectedSubmission.toko_name}</h2>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400">Terdaftar pada</p>
                  <p className="text-xs font-bold text-slate-700">{new Date(selectedSubmission.created_at).toLocaleDateString('id-ID')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <InfoBox label="Pemilik" value={selectedSubmission.profil?.full_name}/>
                <InfoBox label="WhatsApp" value={selectedSubmission.profil?.phone}/>
                <InfoBox label="Alamat" value={`${selectedSubmission.alamat}, ${selectedSubmission.desa}`}/>
                <InfoBox label="Kecamatan" value={selectedSubmission.kecamatan}/>
              </div>

              {/* Status Rekomendasi RT Section */}
              <div className={`p-4 rounded-2xl mb-8 border ${selectedSubmission.rekomendasi_rt === 'setuju' ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck size={16} className="text-blue-600"/>
                  <span className="text-xs font-black text-blue-800 uppercase">Status Rekomendasi RT</span>
                </div>
                {selectedSubmission.rekomendasi_rt ? (
                  <>
                    <p className="text-sm font-bold text-slate-700">{selectedSubmission.rekomendasi_rt === 'setuju' ? '✅ Disetujui RT' : '❌ Tidak Disetujui RT'}</p>
                    {selectedSubmission.rekomendasi_rt_note && <p className="text-xs text-slate-500 italic mt-1">"{selectedSubmission.rekomendasi_rt_note}"</p>}
                  </>
                ) : <p className="text-xs text-slate-400 italic">Belum ada rekomendasi dari RT setempat.</p>}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {isRt && !selectedSubmission.rekomendasi_rt && selectedSubmission.status === 'menunggu' && (
                  <button 
                    onClick={() => { setModalType('rekomendasi'); setActionType('setuju'); }}
                    className="w-full bg-blue-600 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all"
                  >
                    <Send size={18}/> Beri Rekomendasi
                  </button>
                )}

                {isPetinggi && selectedSubmission.status === 'menunggu' && (
                  <>
                    <button 
                      onClick={() => { setModalType('keputusan'); setActionType('tolak'); }}
                      className="flex-1 bg-rose-50 text-rose-600 py-3 rounded-2xl font-bold hover:bg-rose-100 transition-all"
                    >
                      Tolak
                    </button>
                    <button 
                      onClick={() => { setModalType('keputusan'); setActionType('setuju'); }}
                      className="flex-1 bg-emerald-600 text-white py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                    >
                      Setujui Penjual
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed rounded-3xl">
              <Eye size={40} className="mb-2 opacity-20"/>
              <p className="text-sm font-medium">Pilih data untuk melihat detail</p>
            </div>
          )}
        </div>
      </div>

      {/* Logic Modal yang Digabung */}
      {modalType && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-black text-slate-800 mb-2">
              {modalType === 'rekomendasi' ? 'Kirim Rekomendasi' : 'Putuskan Verifikasi'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Anda akan menyatakan <strong>{actionType}</strong> untuk toko <strong>{selectedSubmission.toko_name}</strong>.
            </p>
            
            <textarea 
              className="w-full border rounded-xl p-3 text-sm min-h-[100px] mb-4 outline-none focus:ring-2 ring-orange-500"
              placeholder="Tambahkan catatan (opsional)..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <div className="flex gap-3">
              <button disabled={isSubmitting} onClick={closeModal} className="flex-1 py-2.5 text-sm font-bold text-slate-400">Batal</button>
              <button 
                disabled={isSubmitting}
                onClick={handleAction}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2 ${actionType === 'setuju' ? 'bg-emerald-600' : 'bg-rose-600'}`}
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{label}</p>
      <p className="text-sm font-bold text-slate-700 truncate">{value || '-'}</p>
    </div>
  );
}