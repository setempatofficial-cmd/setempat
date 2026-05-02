'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/context/AuthContext';
import { 
  Truck, Loader2, Search, MapPin, Eye,
  ShieldCheck, Send, Crown, CheckCircle, 
  AlertTriangle, CreditCard, Bike, X
} from 'lucide-react';

export default function VerifikasiDriverPage() {
  const { profile, isPetinggi, isRt } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('menunggu');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
        .from('pendaftar_ojek')
        .select(`
          *,
          profil:user_id ( id, full_name, email, phone, desa, ktp_status, is_verified ),
          rekomendasi_rt_data:rekomendasi_rt_id ( full_name )
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'semua') query = query.eq('status', filter);
      
      // Filter wilayah jika yang login adalah RT
      if (isRt && profile?.desa) {
        query = query.eq('desa', profile.desa);
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
    if (!actionType) return;
    setIsSubmitting(true);

    try {
      if (modalType === 'rekomendasi') {
        const { error } = await supabase
          .from('pendaftar_ojek')
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
        
        const { error: updateError } = await supabase
          .from('pendaftar_ojek')
          .update({
            status: newStatus,
            verified_at: new Date().toISOString(),
            verified_by: profile?.id,
            verified_note: note
          })
          .eq('id', selectedSubmission.id);
        if (updateError) throw updateError;

        if (newStatus === 'aktif') {
          await supabase
            .from('profiles')
            .update({ 
              is_driver: true, 
              driver_status: 'standby',
              motor_info: `${selectedSubmission.motor_info} (${selectedSubmission.plat_nomor})`
            })
            .eq('id', selectedSubmission.user_id);
        }
      }

      alert('Proses verifikasi berhasil!');
      setModalType(null);
      setNote('');
      fetchSubmissions();
      setSelectedSubmission(null);
    } catch (err) {
      alert('Gagal: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredData = submissions.filter(s => 
    s.profil?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.plat_nomor?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-10">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
              <Truck size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight">Verifikasi Driver</h1>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                <span className="text-slate-400">{profile?.desa || 'Semua Desa'}</span>
                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                <span className="text-emerald-600 flex items-center gap-1">
                  {isPetinggi ? <Crown size={12}/> : <ShieldCheck size={12}/>}
                  {isPetinggi ? 'Petinggi' : 'Ketua RT'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar List */}
        <div className="lg:col-span-4 space-y-5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
            <input 
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 ring-emerald-500/10 transition-all text-sm"
              placeholder="Cari nama atau plat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {['menunggu', 'aktif', 'ditolak'].map(f => (
              <button 
                key={f} 
                onClick={() => setFilter(f)}
                className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-slate-800 text-white shadow-lg' : 'bg-white border text-slate-500'}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="space-y-3 h-[calc(100vh-300px)] overflow-y-auto pr-2 custom-scrollbar">
            {loading ? <Loader2 className="animate-spin mx-auto text-emerald-500 mt-10"/> : 
              filteredData.map(sub => (
                <div 
                  key={sub.id}
                  onClick={() => setSelectedSubmission(sub)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedSubmission?.id === sub.id ? 'border-emerald-500 bg-emerald-50/50' : 'bg-white border-transparent shadow-sm'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-black text-slate-800 text-sm">{sub.profil?.full_name}</h4>
                    {sub.rekomendasi_rt === 'setuju' && <ShieldCheck size={14} className="text-blue-500" />}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 uppercase">
                      <Bike size={12}/> {sub.plat_nomor}
                    </p>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${sub.status === 'aktif' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                      {sub.status}
                    </span>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Detail Section */}
        <div className="lg:col-span-8">
          {selectedSubmission ? (
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden sticky top-28">
              <div className="bg-slate-900 p-8 text-white">
                <div className="flex justify-between items-center mb-4">
                  <span className="bg-emerald-500 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Detail Pendaftar</span>
                  <div className="flex items-center gap-2">
                    <CreditCard size={14} className="text-slate-400"/>
                    <span className={`text-xs font-bold ${selectedSubmission.profil?.ktp_status === 'verified' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      KTP: {selectedSubmission.profil?.ktp_status || 'Belum Verifikasi'}
                    </span>
                  </div>
                </div>
                <h2 className="text-3xl font-black tracking-tight">{selectedSubmission.profil?.full_name}</h2>
                <p className="text-slate-400 text-sm mt-2 flex items-center gap-2 uppercase tracking-wide">
                  <MapPin size={14}/> {selectedSubmission.desa}, {selectedSubmission.kecamatan}
                </p>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <DetailItem label="Merk Motor" value={selectedSubmission.motor_info} icon={<Bike size={16}/>}/>
                  <DetailItem label="Plat Nomor" value={selectedSubmission.plat_nomor} icon={<Truck size={16}/>}/>
                  <DetailItem label="WA Aktif" value={selectedSubmission.profil?.phone} icon={<CheckCircle size={16}/>}/>
                  <DetailItem label="Layanan" value={selectedSubmission.jenis_layanan || 'Ojek & Kurir'} icon={<AlertTriangle size={16}/>}/>
                </div>

                {/* Status Rekomendasi RT - Wajib Dilihat Petinggi */}
                <div className={`p-6 rounded-3xl mb-8 border-2 ${selectedSubmission.rekomendasi_rt === 'setuju' ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-xl ${selectedSubmission.rekomendasi_rt === 'setuju' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                      <ShieldCheck size={20}/>
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-tighter">Rekomendasi RT Setempat</h4>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Wilayah {selectedSubmission.desa}</p>
                    </div>
                  </div>

                  {selectedSubmission.rekomendasi_rt ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black px-2 py-1 rounded-md ${selectedSubmission.rekomendasi_rt === 'setuju' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                          {selectedSubmission.rekomendasi_rt === 'setuju' ? 'DIREKOMENDASIKAN' : 'TIDAK DIREKOMENDASIKAN'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium italic">oleh: {selectedSubmission.rekomendasi_rt_data?.full_name || 'Ketua RT'}</span>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed bg-white/50 p-3 rounded-xl border border-white">
                        "{selectedSubmission.rekomendasi_rt_note || 'Tidak ada catatan.'}"
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Belum ada tanggapan dari Ketua RT wilayah ini.</p>
                  )}
                </div>

                {/* Actions Section */}
<div className="flex gap-4">
  {/* Tombol Khusus RT - Hanya muncul jika belum ada rekomendasi */}
  {isRt && !selectedSubmission.rekomendasi_rt && selectedSubmission.status === 'menunggu' && (
    <button 
      onClick={() => { setModalType('rekomendasi'); setActionType('setuju'); }}
      className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-lg shadow-blue-100"
    >
      <Send size={18}/> BERI REKOMENDASI KE PETINGGI
    </button>
  )}

  {/* Tombol Khusus Petinggi - Selalu Aktif */}
  {isPetinggi && selectedSubmission.status === 'menunggu' && (
    <>
      <button 
        onClick={() => { setModalType('keputusan'); setActionType('tolak'); }}
        className="flex-1 bg-white border-2 border-rose-100 text-rose-600 py-4 rounded-2xl font-black text-sm hover:bg-rose-50 transition-all"
      >
        TOLAK
      </button>
      <button 
        onClick={() => { setModalType('keputusan'); setActionType('setuju'); }}
        className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100"
      >
        SETUJUI SEKARANG
      </button>
    </>
  )}
</div>

{/* Warning Tipis untuk Petinggi jika RT belum respon */}
{isPetinggi && !selectedSubmission.rekomendasi_rt && selectedSubmission.status === 'menunggu' && (
  <div className="mt-4 flex items-center justify-center gap-2 py-2 px-4 bg-amber-50 rounded-xl border border-amber-100">
    <AlertTriangle size={12} className="text-amber-600"/>
    <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest">
      RT Belum Memberi Rekomendasi, Tetap Lanjutkan?
    </p>
  </div>
)}
              </div>
            </div>
          ) : (
            <div className="h-96 bg-white rounded-[40px] border-2 border-dashed flex flex-col items-center justify-center text-slate-300">
              <Eye size={48} className="opacity-10 mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">Pilih driver untuk verifikasi</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Konfirmasi */}
      {modalType && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-black text-slate-800 mb-2">
              {modalType === 'rekomendasi' ? 'Konfirmasi RT' : 'Putusan Petinggi'}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Status yang diberikan: <span className={`font-black ${actionType === 'setuju' ? 'text-emerald-600' : 'text-rose-600'}`}>{actionType.toUpperCase()}</span>
            </p>
            
            <textarea 
              className="w-full border-2 border-slate-100 bg-slate-50 rounded-2xl p-4 text-sm min-h-[120px] mb-6 outline-none focus:border-emerald-500 transition-all"
              placeholder="Berikan alasan atau catatan verifikasi..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <div className="flex gap-3">
              <button disabled={isSubmitting} onClick={() => setModalType(null)} className="flex-1 py-3 text-sm font-bold text-slate-400 uppercase">Batal</button>
              <button 
                disabled={isSubmitting}
                onClick={handleAction}
                className={`flex-1 py-3 rounded-2xl text-sm font-black text-white shadow-lg ${actionType === 'setuju' ? 'bg-emerald-600 shadow-emerald-100' : 'bg-rose-600 shadow-rose-100'}`}
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin mx-auto"/> : 'SIMPAN DATA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value, icon }) {
  return (
    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
      <div className="flex items-center gap-2 text-slate-400 mb-1">
        {icon}
        <p className="text-[9px] font-black uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-sm font-black text-slate-800">{value || '-'}</p>
    </div>
  );
}