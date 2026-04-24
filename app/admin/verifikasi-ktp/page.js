"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { 
  ShieldCheck, CheckCircle, XCircle, Clock, Eye, 
  User, MapPin, Briefcase, Phone, Search, 
  ChevronRight, Loader2, AlertCircle, Edit2, Map, ExternalLink,
  ZoomIn, Image as ImageIcon, Lock, Key
} from "lucide-react";

export default function VerifikasiKTPPage() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [filter, setFilter] = useState("menunggu");
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [signedUrl, setSignedUrl] = useState(null);
  const [loadingKtp, setLoadingKtp] = useState(false);
  
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectUserId, setRejectUserId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({});
  const [isEditing, setIsEditing] = useState(false);

  // Deteksi mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Cek akses superadmin
  useEffect(() => {
    checkAdminAccess();
  }, []);

  // Fetch submissions ketika filter berubah
  useEffect(() => { 
    fetchSubmissions(); 
  }, [filter]);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/");
      return;
    }
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    
    if (profile?.role !== "superadmin") {
      router.push("/");
    }
  };

  const fetchSubmissions = async () => {
    setLoading(true);
    let query = supabase
      .from("profiles")
      .select("*")
      .order("ktp_submitted_at", { ascending: false });
    
    if (filter !== "semua") {
      query = query.eq("ktp_status", filter);
    }
    
    const { data, error } = await query;
    if (!error) setSubmissions(data || []);
    setLoading(false);
  };

  // 🔐 FUNGSI KEAMANAN: Generate Signed URL (expired 5 menit)
  const getSignedKtpUrl = async (filePath) => {
    if (!filePath) return null;
    
    setLoadingKtp(true);
    try {
      const { data, error } = await supabase.storage
        .from('ktp-verifikasi')
        .createSignedUrl(filePath, 300); // 5 menit = 300 detik
      
      if (error) throw error;
      return data.signedUrl;
    } catch (err) {
      console.error("Gagal generate signed URL:", err);
      return null;
    } finally {
      setLoadingKtp(false);
    }
  };

  // Handle pilih submission & ambil signed URL
  const handleSelectSubmission = async (submission) => {
    setSelectedSubmission(submission);
    setSignedUrl(null);
    setShowDetail(true);
    
    // Generate signed URL untuk KTP
    if (submission.foto_ktp) {
      const url = await getSignedKtpUrl(submission.foto_ktp);
      setSignedUrl(url);
    }
  };

  const handleApprove = async (userId) => {
    const { error } = await supabase
      .from("profiles")
      .update({
        ktp_status: "aktif",
        ktp_verified_at: new Date().toISOString(),
        is_verified: true,
      })
      .eq("id", userId);
    
    if (!error) {
      alert("✅ KTP Digital Warga telah AKTIF!");
      fetchSubmissions();
      setSelectedSubmission(null);
      setShowDetail(false);
      setSignedUrl(null);
    } else {
      alert("Gagal: " + error.message);
    }
  };

  const openRejectModal = (userId) => {
    setRejectUserId(userId);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert("⚠️ Alasan penolakan wajib diisi!");
      return;
    }
    
    setIsSubmitting(true);
    
    const { error } = await supabase
      .from("profiles")
      .update({
        ktp_status: "ditolak",
        ktp_rejection_reason: rejectReason,
        is_verified: false,
      })
      .eq("id", rejectUserId);
    
    setIsSubmitting(false);
    
    if (!error) {
      setShowRejectModal(false);
      alert("❌ Pengajuan KTP ditolak!");
      fetchSubmissions();
      setSelectedSubmission(null);
      setShowDetail(false);
      setSignedUrl(null);
    } else {
      alert("Gagal: " + error.message);
    }
  };

  const openEditModal = (submission) => {
    setEditData(submission);
    setShowEditModal(true);
  };

  const handleUpdateUser = async (updatedData) => {
    setIsEditing(true);
    
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: updatedData.full_name,
        usia: parseInt(updatedData.usia) || 0,
        profesi: updatedData.profesi,
        whatsapp: updatedData.whatsapp,
        alamat: updatedData.alamat,
        desa: updatedData.desa,
        kecamatan: updatedData.kecamatan,
        kabupaten: updatedData.kabupaten,
      })
      .eq("id", editData.id);
    
    setIsEditing(false);
    
    if (!error) {
      alert("✅ Data user berhasil diperbarui!");
      setShowEditModal(false);
      fetchSubmissions();
      if (selectedSubmission?.id === editData.id) {
        setSelectedSubmission({ ...selectedSubmission, ...updatedData });
      }
    } else {
      alert("Gagal: " + error.message);
    }
  };

  const checkDataCompleteness = (profile) => {
    const required = [
      { field: "full_name", label: "Nama" },
      { field: "usia", label: "Usia" },
      { field: "whatsapp", label: "WhatsApp" },
      { field: "alamat", label: "Alamat" }
    ];
    const missing = required.filter(r => !profile[r.field]);
    return { 
      isComplete: missing.length === 0, 
      missingFields: missing.map(m => m.label) 
    };
  };

  const filteredSubmissions = submissions.filter(sub => 
    sub.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    sub.username?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    menunggu: submissions.filter(s => s.ktp_status === "menunggu").length,
    aktif: submissions.filter(s => s.ktp_status === "aktif").length,
    ditolak: submissions.filter(s => s.ktp_status === "ditolak").length,
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* HEADER */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b dark:border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-lg text-white">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Pusat Verifikasi</h1>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Setempat.id Admin Panel</p>
            </div>
          </div>
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <XCircle size={24} className="text-slate-400" />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        {/* STATS CARD */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard label="Menunggu" count={stats.menunggu} color="text-amber-500" bg="bg-amber-50 dark:bg-amber-500/10" />
          <StatCard label="Aktif" count={stats.aktif} color="text-emerald-500" bg="bg-emerald-50 dark:bg-emerald-500/10" />
          <StatCard label="Ditolak" count={stats.ditolak} color="text-rose-500" bg="bg-rose-50 dark:bg-rose-500/10" />
        </div>

        {/* SEARCH & FILTER */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari nama warga..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border-none bg-white dark:bg-slate-900 shadow-sm focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex gap-2">
            {["menunggu", "aktif", "ditolak", "semua"].map((f) => (
              <button 
                key={f} 
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${filter === f ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' : 'bg-white dark:bg-slate-900 text-slate-500'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LIST COLUMN */}
          <div className={`lg:col-span-5 space-y-3 ${isMobile && showDetail ? 'hidden' : 'block'}`}>
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="animate-spin text-purple-500" size={40} />
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl">
                <p className="text-slate-400">Tidak ada pengajuan</p>
              </div>
            ) : (
              filteredSubmissions.map((sub) => (
                <div 
                  key={sub.id} 
                  onClick={() => handleSelectSubmission(sub)}
                  className={`group p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 transition-all cursor-pointer hover:border-purple-400 ${selectedSubmission?.id === sub.id ? 'border-purple-600 shadow-xl' : 'border-transparent shadow-sm'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                        {sub.avatar_url ? (
                          <img src={sub.avatar_url} className="object-cover w-full h-full" alt="avatar" />
                        ) : (
                          <User className="text-slate-400" size={20} />
                        )}
                      </div>
                      {sub.is_rewang && (
                        <div className="absolute -bottom-1 -right-1 p-1 bg-blue-500 rounded-full text-white ring-2 ring-white dark:ring-slate-900">
                          <Briefcase size={10} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate">{sub.full_name || "Tanpa Nama"}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          sub.ktp_status === 'aktif' 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' 
                            : sub.ktp_status === 'ditolak'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                        }`}>
                          {sub.ktp_status}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <MapPin size={10} /> {sub.desa || 'N/A'}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* DETAIL COLUMN */}
          <div className={`lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border dark:border-slate-800 ${isMobile && !showDetail ? 'hidden' : 'block'}`}>
            {selectedSubmission ? (
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setShowDetail(false)} 
                      className="lg:hidden p-2 bg-slate-100 dark:bg-slate-800 rounded-lg"
                    >
                      <XCircle size={20} />
                    </button>
                    <h2 className="text-xl font-bold">Detail Verifikasi</h2>
                  </div>
                  <button 
                    onClick={() => openEditModal(selectedSubmission)} 
                    className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                  >
                    <Edit2 size={20} />
                  </button>
                </div>

                {/* 🔐 FOTO KTP dengan Signed URL + Indikator Keamanan */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock size={12} className="text-emerald-500" />
                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                        Terenkripsi - Signed URL (5 menit)
                      </span>
                    </div>
                    {loadingKtp && (
                      <div className="flex items-center gap-1">
                        <Loader2 size={12} className="animate-spin" />
                        <span className="text-[10px] text-slate-400">Memuat...</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="relative group">
                    <div className="aspect-[16/9] w-full bg-slate-100 dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center overflow-hidden">
                      {selectedSubmission.foto_ktp ? (
                        loadingKtp ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 size={32} className="animate-spin text-purple-500" />
                            <p className="text-xs text-slate-400">Mengambil gambar aman...</p>
                          </div>
                        ) : signedUrl ? (
                          <>
                            <img 
                              src={signedUrl} 
                              className="w-full h-full object-contain cursor-pointer hover:scale-105 transition-transform" 
                              onClick={() => setPreviewImage(signedUrl)}
                              alt="KTP Warga"
                            />
                            <button 
                              onClick={() => setPreviewImage(signedUrl)}
                              className="absolute bottom-2 right-2 p-2 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                            >
                              <ZoomIn size={16} />
                            </button>
                            <div className="absolute top-2 right-2 p-1 bg-black/50 rounded-lg text-white text-[8px] font-mono backdrop-blur-sm">
                              🔐 Signed
                            </div>
                          </>
                        ) : (
                          <div className="text-center p-6">
                            <AlertCircle className="mx-auto text-slate-400 mb-2" size={32} />
                            <p className="text-sm text-slate-500">Gagal memuat gambar KTP</p>
                            <button 
                              onClick={() => handleSelectSubmission(selectedSubmission)}
                              className="mt-2 text-xs text-purple-500 underline"
                            >
                              Coba lagi
                            </button>
                          </div>
                        )
                      ) : (
                        <div className="text-center p-6">
                          <ImageIcon className="mx-auto text-slate-400 mb-2" size={32} />
                          <p className="text-sm text-slate-500">Foto KTP belum diunggah</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-400 flex items-center gap-1">
                    <Key size={10} /> Signed URL berlaku 5 menit demi keamanan data warga
                  </p>
                </div>

                {/* DATA GRID */}
                <div className="grid grid-cols-2 gap-4">
                  <InfoBox icon={<User size={14}/>} label="Nama Lengkap" value={selectedSubmission.full_name} />
                  <InfoBox icon={<Phone size={14}/>} label="WhatsApp" value={selectedSubmission.whatsapp} />
                  <InfoBox icon={<Briefcase size={14}/>} label="Profesi" value={selectedSubmission.profesi} />
                  <InfoBox icon={<Clock size={14}/>} label="Usia" value={`${selectedSubmission.usia || 0} Tahun`} />
                </div>

                {/* LOCATION INFO */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border dark:border-slate-700">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-slate-400 uppercase">Lokasi Terdeteksi</span>
                    {selectedSubmission.latitude && (
                      <a 
                        href={`https://www.google.com/maps?q=${selectedSubmission.latitude},${selectedSubmission.longitude}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-500 flex items-center gap-1 font-bold"
                      >
                        <Map size={12}/> GOOGLE MAPS <ExternalLink size={10}/>
                      </a>
                    )}
                  </div>
                  <p className="text-sm font-medium">{selectedSubmission.alamat || "Alamat tidak diisi"}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedSubmission.desa}, {selectedSubmission.kecamatan}, {selectedSubmission.kabupaten}
                  </p>
                </div>

                {/* ACTIONS */}
                {selectedSubmission.ktp_status === "menunggu" && (
                  <div className="flex gap-3 pt-4">
                    <button 
                      onClick={() => openRejectModal(selectedSubmission.id)} 
                      className="flex-1 py-3 rounded-2xl font-bold border-2 border-rose-500 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"
                    >
                      Tolak
                    </button>
                    <button 
                      onClick={() => handleApprove(selectedSubmission.id)} 
                      className="flex-[2] py-3 rounded-2xl font-bold bg-emerald-600 text-white shadow-lg shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      Setujui KTP Digital
                    </button>
                  </div>
                )}

                {/* Rejection Reason */}
                {selectedSubmission.ktp_status === "ditolak" && selectedSubmission.ktp_rejection_reason && (
                  <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30">
                    <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Alasan Penolakan</p>
                    <p className="text-sm mt-1">{selectedSubmission.ktp_rejection_reason}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-[400px] flex flex-col items-center justify-center text-slate-400">
                <Eye size={48} className="mb-4 opacity-20" />
                <p className="font-medium text-lg">Pilih warga untuk diverifikasi</p>
                <p className="text-sm">Klik card di sebelah kiri</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODALS */}
      <RejectModal 
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleReject}
        reason={rejectReason}
        setReason={setRejectReason}
        isSubmitting={isSubmitting}
      />

      <EditUserModal 
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        editData={editData}
        onUpdate={handleUpdateUser}
        isEditing={isEditing}
      />

      <PreviewKTPModal 
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage}
      />
    </div>
  );
}

// ==================== SUB-COMPONENTS ====================

function StatCard({ label, count, color, bg }) {
  return (
    <div className={`${bg} p-4 rounded-2xl border dark:border-white/5`}>
      <p className={`text-2xl font-black ${color}`}>{count}</p>
      <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{label}</p>
    </div>
  );
}

function InfoBox({ icon, label, value }) {
  return (
    <div className="p-3 rounded-xl border dark:border-slate-800">
      <div className="flex items-center gap-2 text-slate-400 mb-1">
        {icon} <span className="text-[10px] font-bold uppercase">{label}</span>
      </div>
      <p className="text-sm font-semibold truncate">{value || "—"}</p>
    </div>
  );
}

function RejectModal({ isOpen, onClose, onConfirm, reason, setReason, isSubmitting }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
            <AlertCircle size="20" className="text-red-500" />
          </div>
          <h3 className="text-lg font-bold">Tolak Pengajuan KTP</h3>
        </div>
        
        <p className="text-sm text-slate-500 mb-4">
          Berikan alasan penolakan agar warga dapat memperbaiki data:
        </p>
        
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Contoh: Foto KTP blur / tidak jelas, Data tidak sesuai, Foto selfie tidak terlihat, dll."
          className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700 text-sm min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
          autoFocus
        />
        
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting || !reason.trim()}
            className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium disabled:opacity-50"
          >
            {isSubmitting ? "PROSES..." : "TOLAK PENGAJUAN"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditUserModal({ isOpen, onClose, editData, onUpdate, isEditing }) {
  const [localForm, setLocalForm] = useState({
    full_name: "",
    usia: "",
    profesi: "",
    whatsapp: "",
    alamat: "",
    desa: "",
    kecamatan: "",
    kabupaten: "",
  });
  
  useEffect(() => {
    if (editData) {
      setLocalForm({
        full_name: editData.full_name || "",
        usia: editData.usia || "",
        profesi: editData.profesi || "",
        whatsapp: editData.whatsapp || "",
        alamat: editData.alamat || "",
        desa: editData.desa || "",
        kecamatan: editData.kecamatan || "",
        kabupaten: editData.kabupaten || "",
      });
    }
  }, [editData]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b p-4 flex items-center justify-between">
          <h3 className="text-base font-bold">Edit Data Warga</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100">
            <XCircle size={20} />
          </button>
        </div>
        
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium">Nama Lengkap</label>
            <input
              type="text"
              value={localForm.full_name}
              onChange={(e) => setLocalForm({...localForm, full_name: e.target.value})}
              className="w-full mt-1 p-2 rounded-lg border dark:bg-slate-800"
            />
          </div>
          
          <div>
            <label className="text-xs font-medium">Usia</label>
            <input
              type="number"
              value={localForm.usia}
              onChange={(e) => setLocalForm({...localForm, usia: e.target.value})}
              className="w-full mt-1 p-2 rounded-lg border dark:bg-slate-800"
            />
          </div>
          
          <div>
            <label className="text-xs font-medium">Profesi</label>
            <input
              type="text"
              value={localForm.profesi}
              onChange={(e) => setLocalForm({...localForm, profesi: e.target.value})}
              className="w-full mt-1 p-2 rounded-lg border dark:bg-slate-800"
            />
          </div>
          
          <div>
            <label className="text-xs font-medium">WhatsApp</label>
            <input
              type="tel"
              value={localForm.whatsapp}
              onChange={(e) => setLocalForm({...localForm, whatsapp: e.target.value})}
              className="w-full mt-1 p-2 rounded-lg border dark:bg-slate-800"
            />
          </div>
          
          <div>
            <label className="text-xs font-medium">Alamat</label>
            <input
              type="text"
              value={localForm.alamat}
              onChange={(e) => setLocalForm({...localForm, alamat: e.target.value})}
              className="w-full mt-1 p-2 rounded-lg border dark:bg-slate-800"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Desa</label>
              <input
                type="text"
                value={localForm.desa}
                onChange={(e) => setLocalForm({...localForm, desa: e.target.value})}
                className="w-full mt-1 p-2 rounded-lg border dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Kecamatan</label>
              <input
                type="text"
                value={localForm.kecamatan}
                onChange={(e) => setLocalForm({...localForm, kecamatan: e.target.value})}
                className="w-full mt-1 p-2 rounded-lg border dark:bg-slate-800"
              />
            </div>
          </div>
          
          <div>
            <label className="text-xs font-medium">Kabupaten</label>
            <input
              type="text"
              value={localForm.kabupaten}
              onChange={(e) => setLocalForm({...localForm, kabupaten: e.target.value})}
              className="w-full mt-1 p-2 rounded-lg border dark:bg-slate-800"
            />
          </div>
          
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg border hover:bg-slate-50">
              Batal
            </button>
            <button 
              onClick={() => onUpdate(localForm)} 
              disabled={isEditing} 
              className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50 hover:bg-blue-700"
            >
              {isEditing ? "MENYIMPAN..." : "SIMPAN"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewKTPModal({ isOpen, onClose, imageUrl }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-12 right-0 p-2 text-white hover:text-slate-300">
          <XCircle size={32} />
        </button>
        {imageUrl && (
          <img src={imageUrl} alt="Preview KTP" className="w-full h-auto rounded-2xl shadow-2xl" />
        )}
      </div>
    </div>
  );
}