// app/admin/verifikasi/driver/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/context/AuthContext';
import { 
  Truck, Loader2, Search, MapPin, Eye, ChevronRight, 
  ShieldCheck, Send, Crown, CheckCircle, XCircle, 
  AlertTriangle, CreditCard, Bike
} from 'lucide-react';

export default function VerifikasiDriverPage() {
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
        .from('pendaftar_ojek')
        .select(`
          *,
          profil:user_id ( id, full_name, email, phone, desa, ktp_status, is_verified ),
          rekomendasi_rt_data:rekomendasi_rt_id ( full_name )
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'semua') query = query.eq('status', filter);
      if (isRt && profile?.wilayah_rt) query = query.eq('desa', profile.wilayah_rt);

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
        
        // 1. Update status pendaftaran
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

        // 2. Jika disetujui, update role & info kendaraan di profile
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
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
              <Truck size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight">Verifikasi Driver</h1>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>{profile?.desa || 'Wilayah'}</span>
                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                <span className="flex items-center gap-1 text-emerald-600">
                  {isPetinggi ? <Crown size={12}/> : <ShieldCheck size={12}/>}
                  {isPetinggi ? 'Petinggi' : 'Ketua RT'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: List */}
        <div className="lg:col-span-4 space-y-5">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18}/>
            <input 
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm shadow-sm"
              placeholder="Cari driver atau plat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {['menunggu', 'aktif', 'ditolak'].map(f => (
              <button 
                key={f} 
                onClick={() => setFilter(f)}
                className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-slate-800 text-white shadow-xl shadow-slate-200' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="py-12 flex flex-col items-center gap-3 text-slate-400 font-medium">
                <Loader2 className="animate-spin text-emerald-500" size={32}/>
                <span className="text-xs">Memuat data warga...</span>
              </div>
            ) : filteredData.map(sub => (
              <div 
                key={sub.id}
                onClick={() => setSelectedSubmission(sub)}
                className={`group p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedSubmission?.id === sub.id ? 'border-emerald-500 bg-emerald-50/50 shadow-md' : 'bg-white border-white shadow-sm hover:border-slate-200'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-black text-slate-800 text-sm group-hover:text-emerald-700 transition-colors">{sub.profil?.full_name}</h4>
                  <span className={`text-[9px] px-2 py-0.5 rounded font-black ${sub.status === 'aktif' ? 'bg-emerald-100 text-emerald-600' : sub.status === 'ditolak' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                    {sub.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                  <Bike size={12}/> {sub.plat_nomor}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Detail */}
        <div className="lg:col-span-8">
          {selectedSubmission ? (
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden sticky top-28">
              <div className="bg-slate-900 p-8 text-white">
                <div className="flex justify-between items-center mb-6">
                  <span className="bg-emerald-500 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Detail Pendaftar</span>
                  <div className="flex items-center gap-2 text-slate-400">
                    <CreditCard size={14}/>
                    <span className={`text-xs font-bold ${selectedSubmission.profil?.ktp_status === 'verified' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      KTP: {selectedSubmission.profil?.ktp_status || 'Belum Upload'}
                    </span>
                  </div>
                </div>
                <h2 className="text-3xl font-black mb-1">{selectedSubmission.profil?.full_name}</h2>
                <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
                  <MapPin size={14}/> {selectedSubmission.alamat}, {selectedSubmission.desa}
                </p>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <DetailItem label="Merk/Tipe Motor" value={selectedSubmission.motor_info} icon={<Bike className="text-emerald-500"/>}/>
                  <DetailItem label="Nomor Polisi" value={selectedSubmission.plat_nomor} icon={<Truck className="text-emerald-500"/>}/>
                  <DetailItem label="Kontak WhatsApp" value={selectedSubmission.profil?.phone} icon={<CheckCircle className="text-emerald-500"/>}/>
                  <DetailItem label="Jam Operasional" value={selectedSubmission.jam || 'Fleksibel'} icon={<AlertTriangle className="text-emerald-500"/>}/>
                </div>

                {/* RT Recommendation Logic Section */}
                <div className={`p-5 rounded-2xl mb-8 border-2 border-dashed ${selectedSubmission.rekomendasi_rt === 'setuju' ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <ShieldCheck className={selectedSubmission.rekomendasi_rt === 'setuju' ? 'text-blue-600' : 'text-slate-400'}/>
                    <span className="text-xs font-black uppercase tracking-tighter text-slate-600">Rekomendasi RT Setempat</span>
                  </div>
                  {selectedSubmission.rekomendasi_rt ? (
                    <div>
                      <p className="text-sm font-black text-slate-800">
                        {selectedSubmission.rekomendasi_rt === 'setuju' ? '✅ Direkomendasikan' : '❌ Tidak Direkomendasikan'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 italic">"{selectedSubmission.rekomendasi_rt_note || 'Tidak ada catatan khusus.'}"</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic font-medium">Menunggu tanggapan dari Ketua RT wilayah {selectedSubmission.desa}.</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-4">
                  {isRt && !selectedSubmission.rekomendasi_rt && selectedSubmission.status === 'menunggu' && (
                    <button 
                      onClick={() => { setModalType('rekomendasi'); setActionType('setuju'); }}
                      className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                    >
                      <Send size={18}/> BERI REKOMENDASI KE PETINGGI
                    </button>
                  )}

                  {isPetinggi && selectedSubmission.status === 'menunggu' && (
                    <>
                      <button 
                        onClick={() => { setModalType('keputusan'); setActionType('tolak'); }}
                        className="flex-1 bg-white border-2 border-rose-100 text-rose-600 py-4 rounded-2xl font-black text-sm hover:bg-rose-50 transition-all"
                      >
                        TOLAK PENDAFTAR
                      </button>
                      <button 
                        onClick={() => { setModalType('keputusan'); setActionType('setuju'); }}
                        className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100"
                      >
                        SETUJUI JADI DRIVER
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[400px] bg-white rounded-[32px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
              <Eye size={48} className="mb-4 opacity-10" />
              <p className="font-black text-slate-400 uppercase tracking-widest text-sm">Pilih Data Driver</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal logic yang disatukan */}
      {modalType && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-white">
            <h3 className="text-xl font-black text-slate-800 mb-2">
              {modalType === 'rekomendasi' ? 'Konfirmasi Rekomendasi' : 'Putusan Akhir'}
            </h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Anda memberikan status <span className={`font-bold ${actionType === 'setuju' ? 'text-emerald-600' : 'text-rose-600'}`}>{actionType.toUpperCase()}</span> untuk warga ini. Tindakan ini akan tercatat di sistem.
            </p>
            
            <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Catatan Tambahan</label>
            <textarea 
              className="w-full border border-slate-200 bg-slate-50 rounded-2xl p-4 text-sm min-h-[120px] mb-6 outline-none focus:ring-4 ring-emerald-500/10 focus:border-emerald-500 transition-all"
              placeholder="Tulis alasan atau catatan verifikasi di sini..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <div className="flex gap-4">
              <button disabled={isSubmitting} onClick={() => setModalType(null)} className="flex-1 py-3 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">BATAL</button>
              <button 
                disabled={isSubmitting}
                onClick={handleAction}
                className={`flex-1 py-3 rounded-2xl text-sm font-black text-white transition-all flex items-center justify-center gap-2 ${actionType === 'setuju' ? 'bg-emerald-600 shadow-emerald-200 shadow-lg' : 'bg-rose-600 shadow-rose-200 shadow-lg'}`}
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : 'SIMPAN DATA'}
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
    <div className="group p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-100 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-sm font-black text-slate-800">{value || '-'}</p>
    </div>
  );
}