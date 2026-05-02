'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/context/AuthContext';
import { 
  Briefcase, CheckCircle, XCircle, Loader2, Search,
  MapPin, Phone, Mail, User, Calendar, AlertCircle,
  Eye, ChevronRight, Clock, ShieldCheck, Send,
  Crown, Award, Star, Info
} from 'lucide-react';

export default function VerifikasiRewangPage() {
  const { profile, isPetinggi, isRt } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('menunggu');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // States for Modals
  const [showRekomendasiModal, setShowRekomendasiModal] = useState(false);
  const [rekomendasi, setRekomendasi] = useState('');
  const [rekomendasiNote, setRekomendasiNote] = useState('');
  
  const [showKeputusanModal, setShowKeputusanModal] = useState(false);
  const [keputusan, setKeputusan] = useState('');
  const [keputusanNote, setKeputusanNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Responsive Check
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchRewangSubmissions();
  }, [filter]);

  const fetchRewangSubmissions = async () => {
  setLoading(true);
  try {
    let query = supabase
      .from('pendaftar_rewang')
      .select(`
        *,
        profil:user_id (id, full_name, email, phone, desa, avatar_url)
      `)
      .order('created_at', { ascending: false });

    // Filter status berdasarkan state
    if (filter !== 'semua') query = query.eq('status', filter);
    
    // Filter wilayah (pakai 'desa' atau 'wilayah_rt')
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

  const handleRekomendasi = async () => {
    if (!rekomendasi) return alert('Pilih status rekomendasi!');
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('pendaftar_rewang')
        .update({
          rekomendasi_rt: rekomendasi,
          rekomendasi_rt_id: profile?.id,
          rekomendasi_rt_note: rekomendasiNote,
          rekomendasi_rt_at: new Date().toISOString()
        })
        .eq('id', selectedSubmission.id);

      if (error) throw error;
      alert('Rekomendasi berhasil dikirim!');
      setShowRekomendasiModal(false);
      fetchSubmissions();
      setSelectedSubmission(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeputusan = async () => {
  if (!keputusan) return;
  setIsSubmitting(true);
  
  try {
    const newStatus = keputusan === 'setuju' ? 'aktif' : 'ditolak';
    
    // 1. Update pendaftar_rewang
    const { error: updateError } = await supabase
      .from('pendaftar_rewang')
      .update({
        status: newStatus,
        verified_at: new Date().toISOString(),
        verified_by: profile?.id,
        verified_note: keputusanNote
      })
      .eq('id', selectedSubmission.id);
    if (updateError) throw updateError;
    
    // 2. Jika disetujui, update profiles
    if (newStatus === 'aktif') {
      await supabase
        .from('profiles')
        .update({ 
          is_rewang: true,
          profesi: selectedSubmission.profesi,
          deskripsi_jasa: selectedSubmission.deskripsi,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedSubmission.user_id);
    }
    
    alert(`Berhasil ${newStatus === 'aktif' ? 'mengaktifkan' : 'menolak'} rewang!`);
    setShowKeputusanModal(false);
    fetchRewangSubmissions(); // panggil ulang
    setSelectedSubmission(null);
  } catch (err) {
    alert('Gagal: ' + err.message);
  } finally {
    setIsSubmitting(false);
  }
};

  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => 
      sub.profil?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      sub.profesi?.toLowerCase().includes(search.toLowerCase())
    );
  }, [submissions, search]);

  const stats = {
    menunggu: submissions.filter(s => s.status === 'menunggu').length,
    aktif: submissions.filter(s => s.status === 'aktif').length,
    ditolak: submissions.filter(s => s.status === 'ditolak').length,
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* APP BAR */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Briefcase size={22} />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900 leading-tight uppercase tracking-tight">Verifikasi Rewang</h1>
              <p className="text-[10px] text-indigo-600 font-bold uppercase">{profile?.desa || 'Wilayah Pasuruan'}</p>
            </div>
          </div>
          
          <div className="flex flex-col items-end">
             <span className="flex items-center gap-1 text-[10px] font-bold py-1 px-2 bg-slate-100 rounded-full text-slate-600">
               {isPetinggi ? <Crown size={12} className="text-amber-500" /> : <ShieldCheck size={12} className="text-blue-500" />}
               {isPetinggi ? 'Petinggi' : 'RT'}
             </span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 lg:p-8">
        {/* STATS AREA */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Menunggu', val: stats.menunggu, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Aktif', val: stats.aktif, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Ditolak', val: stats.ditolak, color: 'text-rose-600', bg: 'bg-rose-50' },
          ].map((s, i) => (
            <div key={i} className={`${s.bg} p-4 rounded-2xl border border-white shadow-sm`}>
              <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>

        {/* SEARCH & FILTER BAR */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="relative flex-1 group">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Cari nama atau profesi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-none bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-sm"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
            {['menunggu', 'aktif', 'ditolak', 'semua'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                  filter === f
                    ? 'bg-slate-900 text-white shadow-lg'
                    : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LIST BOX */}
          <div className={`lg:col-span-5 space-y-4 ${isMobile && showDetail ? 'hidden' : 'block'}`}>
            {loading ? (
              <div className="flex flex-col items-center py-20 bg-white rounded-3xl border border-slate-100">
                <Loader2 size={40} className="animate-spin text-indigo-500 mb-4" />
                <p className="text-sm font-medium text-slate-400">Memuat data...</p>
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300 p-8">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                  <User size={32} />
                </div>
                <h3 className="text-slate-900 font-bold">Belum Ada Data</h3>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide">Tidak ditemukan pendaftar di kategori ini</p>
              </div>
            ) : (
              filteredSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  onClick={() => { setSelectedSubmission(sub); setShowDetail(true); }}
                  className={`group relative p-5 rounded-3xl bg-white border-2 transition-all cursor-pointer ${
                    selectedSubmission?.id === sub.id
                      ? 'border-indigo-500 shadow-xl shadow-indigo-100'
                      : 'border-transparent shadow-sm hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                      {sub.profil?.avatar_url ? (
                        <img src={sub.profil.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User size={24} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors uppercase text-sm tracking-tight">
                        {sub.profil?.full_name || 'Tanpa Nama'}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium mb-2">{sub.profesi}</p>
                      
                      <div className="flex flex-wrap gap-2">
                        <span className={`text-[8px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest ${
                          sub.status === 'aktif' ? 'bg-emerald-100 text-emerald-700' : 
                          sub.status === 'ditolak' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {sub.status}
                        </span>
                        {sub.rekomendasi_rt && (
                          <span className="text-[8px] px-2 py-0.5 rounded-md font-black uppercase bg-blue-50 text-blue-600 border border-blue-100">
                             RT: {sub.rekomendasi_rt === 'setuju' ? '✓ OK' : '✗ NO'}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={18} className={`text-slate-300 transition-transform ${selectedSubmission?.id === sub.id ? 'translate-x-1 text-indigo-500' : ''}`} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* DETAIL VIEW */}
          <div className={`lg:col-span-7 bg-white rounded-[2rem] p-6 lg:p-8 shadow-xl shadow-slate-200/50 border border-slate-100 sticky top-24 ${isMobile && !showDetail ? 'hidden' : 'block'}`}>
            {selectedSubmission ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                {/* Mobile Back */}
                <button onClick={() => setShowDetail(false)} className="lg:hidden flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase mb-6">
                   <ChevronRight size={16} className="rotate-180" /> Tutup Detail
                </button>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-slate-50 pb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center text-indigo-600 text-2xl font-black uppercase">
                       {selectedSubmission.profil?.full_name?.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 leading-none mb-1 uppercase tracking-tight">{selectedSubmission.profil?.full_name}</h2>
                      <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">{selectedSubmission.profesi}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Diajukan Pada</p>
                    <p className="text-xs font-black text-slate-700">{new Date(selectedSubmission.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                   <div className="space-y-6">
                      <section>
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                           <Info size={12} /> Detail Layanan
                         </h4>
                         <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                            <div>
                               <p className="text-[9px] font-bold text-slate-400 uppercase">Estimasi Biaya</p>
                               <p className="text-sm font-bold text-slate-700">{selectedSubmission.estimasi_biaya || 'Hubungi Langsung'}</p>
                            </div>
                            <div>
                               <p className="text-[9px] font-bold text-slate-400 uppercase">Jam Operasional</p>
                               <p className="text-sm font-bold text-slate-700">{selectedSubmission.jam_operasional || 'Tidak Menentu'}</p>
                            </div>
                            <div>
                               <p className="text-[9px] font-bold text-slate-400 uppercase">Deskripsi</p>
                               <p className="text-xs text-slate-600 leading-relaxed italic">"{selectedSubmission.deskripsi || 'Tidak ada deskripsi'}"</p>
                            </div>
                         </div>
                      </section>
                   </div>

                   <div className="space-y-6">
                      <section>
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                           <User size={12} /> Data Pribadi
                         </h4>
                         <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                            <div className="flex items-center gap-3">
                               <Phone size={14} className="text-slate-400" />
                               <p className="text-sm font-bold text-slate-700">{selectedSubmission.profil?.phone || '-'}</p>
                            </div>
                            <div className="flex items-center gap-3">
                               <MapPin size={14} className="text-slate-400" />
                               <p className="text-xs font-medium text-slate-600 leading-tight">
                                  {selectedSubmission.alamat}, Desa {selectedSubmission.desa}
                               </p>
                            </div>
                         </div>
                      </section>

                      {/* Info Rekomendasi RT */}
                      {selectedSubmission.rekomendasi_rt && (
                        <div className={`p-4 rounded-2xl border-2 ${selectedSubmission.rekomendasi_rt === 'setuju' ? 'bg-blue-50/50 border-blue-100' : 'bg-slate-50 border-slate-200'}`}>
                           <div className="flex items-center gap-2 mb-2">
                              <ShieldCheck size={14} className="text-blue-600" />
                              <span className="text-[9px] font-black text-blue-700 uppercase">Rekomendasi RT</span>
                           </div>
                           <p className="text-xs font-bold text-slate-700 mb-1">
                             {selectedSubmission.rekomendasi_rt === 'setuju' ? '✅ Direkomendasikan' : '❌ Kurang Direkomendasikan'}
                           </p>
                           {selectedSubmission.rekomendasi_rt_note && (
                             <p className="text-[10px] text-slate-500 italic">"{selectedSubmission.rekomendasi_rt_note}"</p>
                           )}
                        </div>
                      )}
                   </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="pt-8 border-t border-slate-100">
                  {isPetinggi && selectedSubmission.status === 'menunggu' && (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button onClick={() => setShowKeputusanModal(true)} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all">
                        Tentukan Keputusan
                      </button>
                    </div>
                  )}

                  {isRt && selectedSubmission.status === 'menunggu' && !selectedSubmission.rekomendasi_rt && (
                    <button onClick={() => setShowRekomendasiModal(true)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-3">
                      <Send size={18} /> Beri Rekomendasi
                    </button>
                  )}

                  {selectedSubmission.status !== 'menunggu' && (
                    <div className="p-4 bg-slate-50 rounded-2xl text-center">
                       <p className="text-xs font-black text-slate-400 uppercase mb-1 tracking-widest">Keputusan Final</p>
                       <p className={`text-sm font-black ${selectedSubmission.status === 'aktif' ? 'text-emerald-600' : 'text-rose-600'} uppercase`}>
                         {selectedSubmission.status === 'aktif' ? 'Terverifikasi & Aktif' : 'Pendaftaran Ditolak'}
                       </p>
                       {selectedSubmission.verified_note && (
                         <p className="text-[10px] text-slate-400 mt-2 italic">"{selectedSubmission.verified_note}"</p>
                       )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-[400px] flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4">
                   <Eye size={40} />
                </div>
                <p className="font-black text-slate-300 uppercase tracking-widest text-sm">Pilih data untuk melihat detail</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* MODAL REKOMENDASI RT */}
      {showRekomendasiModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10">
              <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-8 sm:hidden" />
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Beri Rekomendasi</h3>
              <p className="text-xs font-medium text-slate-500 mb-8 uppercase tracking-wide">Rekomendasi Anda akan dikirim ke Petinggi Setempat</p>

              <div className="space-y-6">
                <div className="flex gap-3">
                   <button onClick={() => setRekomendasi('setuju')} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${rekomendasi === 'setuju' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100 scale-[1.02]' : 'bg-slate-50 text-slate-400'}`}>
                     Sangat Setuju
                   </button>
                   <button onClick={() => setRekomendasi('tidak_setuju')} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${rekomendasi === 'tidak_setuju' ? 'bg-rose-600 text-white shadow-lg shadow-rose-100 scale-[1.02]' : 'bg-slate-50 text-slate-400'}`}>
                     Kurang Setuju
                   </button>
                </div>
                
                <textarea
                  value={rekomendasiNote}
                  onChange={(e) => setRekomendasiNote(e.target.value)}
                  placeholder="Berikan alasan singkat (opsional)..."
                  className="w-full bg-slate-50 rounded-2xl p-4 text-sm outline-none ring-2 ring-transparent focus:ring-indigo-500/20 transition-all min-h-[100px]"
                />

                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowRekomendasiModal(false)} className="flex-1 py-4 font-black text-[10px] uppercase text-slate-400">Batal</button>
                  <button 
                    disabled={isSubmitting || !rekomendasi}
                    onClick={handleRekomendasi} 
                    className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Kirim Rekomendasi
                  </button>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL KEPUTUSAN PETINGGI */}
      {showKeputusanModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Keputusan Final</h3>
              <p className="text-xs font-medium text-slate-500 mb-8 uppercase tracking-wide">Tentukan nasib pengajuan rewang ini</p>

              <div className="space-y-6">
                <div className="flex gap-3">
                   <button onClick={() => setKeputusan('setuju')} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${keputusan === 'setuju' ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                     ACC / Aktifkan
                   </button>
                   <button onClick={() => setKeputusan('tolak')} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${keputusan === 'tolak' ? 'bg-rose-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                     Tolak Data
                   </button>
                </div>
                
                <textarea
                  value={keputusanNote}
                  onChange={(e) => setKeputusanNote(e.target.value)}
                  placeholder="Catatan untuk pendaftar (opsional)..."
                  className="w-full bg-slate-50 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all min-h-[100px]"
                />

                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowKeputusanModal(false)} className="flex-1 py-4 font-black text-[10px] uppercase text-slate-400">Batal</button>
                  <button 
                    disabled={isSubmitting || !keputusan}
                    onClick={handleKeputusan} 
                    className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />} Simpan Keputusan
                  </button>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}