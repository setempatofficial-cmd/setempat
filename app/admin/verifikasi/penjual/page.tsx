'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/context/AuthContext';
import { 
  Store, CheckCircle, XCircle, Loader2, Search,
  Crown, Eye, Check, X
} from 'lucide-react';

export default function VerifikasiPenjualPage() {
  const { profile, isSuperAdmin, isAdmin } = useAuth(); // Pakai akses admin utama
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('menunggu');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showModal, setShowModal] = useState(false);
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
          profil:user_id ( id, full_name, email, phone, desa )
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'semua') query = query.eq('status', filter);

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
    if (!actionType) return;
    setIsSubmitting(true);

    try {
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

      // 2. Jika disetujui, update profile user menjadi seller
      if (newStatus === 'aktif') {
        await supabase
          .from('profiles')
          .update({ is_seller: true, business_type: 'panyangan' })
          .eq('id', selectedSubmission.user_id);
      }

      alert(`Berhasil: Penjual telah ${newStatus}`);
      closeModal();
      fetchSubmissions();
      setSelectedSubmission(null);
    } catch (err) {
      alert('Gagal memproses: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setActionType('');
    setNote('');
  };

  const filteredData = submissions.filter(s => 
    s.toko_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.profil?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-20 px-4 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-lg text-white"><Store size={20}/></div>
            <div>
              <h1 className="text-lg font-black text-slate-800 tracking-tight">Verifikasi Bakul</h1>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Otoritas Petinggi Setempat</p>
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
              className="w-full pl-10 pr-4 py-2.5 bg-white border rounded-2xl focus:ring-2 ring-purple-500 outline-none transition-all text-sm"
              placeholder="Cari nama toko..."
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {['menunggu', 'aktif', 'ditolak'].map(f => (
              <button 
                key={f} 
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${filter === f ? 'bg-purple-600 text-white shadow-lg shadow-purple-100' : 'bg-white border text-slate-500'}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="space-y-3 h-[calc(100vh-280px)] overflow-y-auto pr-2 custom-scrollbar">
            {loading ? <Loader2 className="animate-spin mx-auto text-purple-600 mt-10"/> : 
              filteredData.map(sub => (
                <div 
                  key={sub.id}
                  onClick={() => setSelectedSubmission(sub)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedSubmission?.id === sub.id ? 'border-purple-600 bg-purple-50/30' : 'bg-white border-transparent shadow-sm'}`}
                >
                  <h4 className="font-bold text-slate-800 text-sm truncate">{sub.toko_name}</h4>
                  <p className="text-[11px] text-slate-500 mb-2">{sub.profil?.full_name}</p>
                  <span className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase ${sub.status === 'aktif' ? 'bg-emerald-100 text-emerald-600' : sub.status === 'ditolak' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                    {sub.status}
                  </span>
                </div>
              ))
            }
          </div>
        </div>

        {/* Detail View */}
        <div className="lg:col-span-8">
          {selectedSubmission ? (
            <div className="bg-white rounded-3xl border shadow-sm p-6 sticky top-24">
              <div className="flex justify-between items-start mb-8">
                <div className="flex gap-4 items-center">
                   <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                      <Store size={32} />
                   </div>
                   <div>
                     <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Detail Pendaftaran</span>
                     <h2 className="text-2xl font-black text-slate-800 leading-none">{selectedSubmission.toko_name}</h2>
                     <p className="text-xs text-slate-400 mt-1">{selectedSubmission.profil?.desa}</p>
                   </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Waktu Daftar</p>
                  <p className="text-xs font-bold text-slate-700">{new Date(selectedSubmission.created_at).toLocaleDateString('id-ID')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                <InfoBox label="Nama Pemilik" value={selectedSubmission.profil?.full_name}/>
                <InfoBox label="Nomor WhatsApp" value={selectedSubmission.profil?.phone}/>
                <InfoBox label="Alamat Toko" value={selectedSubmission.alamat}/>
                <InfoBox label="Kecamatan" value={selectedSubmission.kecamatan}/>
              </div>

              {/* Action Buttons - Hanya muncul jika status menunggu */}
              {selectedSubmission.status === 'menunggu' && (
                <div className="flex gap-4">
                  <button 
                    onClick={() => { setActionType('tolak'); setShowModal(true); }}
                    className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center justify-center gap-2"
                  >
                    <X size={18}/> Tolak Pengajuan
                  </button>
                  <button 
                    onClick={() => { setActionType('setuju'); setShowModal(true); }}
                    className="flex-1 bg-purple-600 text-white py-4 rounded-2xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 flex items-center justify-center gap-2"
                  >
                    <Check size={18}/> Setujui & Aktifkan
                  </button>
                </div>
              )}

              {selectedSubmission.status !== 'menunggu' && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-dashed text-center">
                   <p className="text-xs font-bold text-slate-400">Pengajuan ini sudah berstatus: <span className="uppercase text-slate-600">{selectedSubmission.status}</span></p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-96 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed rounded-[40px] bg-white/50">
              <div className="p-5 bg-white rounded-3xl shadow-sm mb-4">
                <Eye size={32} className="opacity-20 text-purple-600"/>
              </div>
              <p className="text-sm font-bold">Pilih pendaftar untuk verifikasi</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Keputusan */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl transform transition-all animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 mb-2">
              {actionType === 'setuju' ? 'Konfirmasi Setuju' : 'Konfirmasi Tolak'}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Apakah Anda yakin ingin memproses pendaftaran <strong>{selectedSubmission.toko_name}</strong>?
            </p>
            
            <textarea 
              className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm min-h-[120px] mb-6 outline-none focus:border-purple-500 transition-all bg-slate-50"
              placeholder="Catatan verifikasi (opsional)..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <div className="flex gap-3">
              <button disabled={isSubmitting} onClick={closeModal} className="flex-1 py-3 text-sm font-bold text-slate-400 hover:text-slate-600">Batal</button>
              <button 
                disabled={isSubmitting}
                onClick={handleAction}
                className={`flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-all shadow-lg ${actionType === 'setuju' ? 'bg-emerald-600 shadow-emerald-100' : 'bg-rose-600 shadow-rose-100'}`}
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin mx-auto"/> : 'Ya, Proses'}
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
    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 transition-colors hover:border-purple-100">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-sm font-bold text-slate-700 truncate">{value || '-'}</p>
    </div>
  );
}