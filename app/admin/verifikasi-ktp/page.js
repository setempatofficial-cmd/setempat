"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { 
  ShieldCheck, CheckCircle, XCircle, Clock, Eye, 
  User, MapPin, Briefcase, Phone, AtSign, Calendar,
  Search, Filter, ArrowLeft, ChevronLeft, ChevronRight,
  Loader2, AlertCircle, Edit2, Save, X
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
  
  // State untuk modal reject
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectUserId, setRejectUserId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State untuk modal edit user
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({});
  const [isEditing, setIsEditing] = useState(false);

  // Deteksi layar mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Cek akses superadmin
  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
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

  useEffect(() => {
    fetchSubmissions();
  }, [filter]);

  const fetchSubmissions = async () => {
    setLoading(true);
    
    let query = supabase
      .from("profiles")
      .select("*")
      .order("ktp_submitted_at", { ascending: false });
    
    if (filter === "menunggu") {
      query = query.eq("ktp_status", "menunggu");
    } else if (filter === "ditolak") {
      query = query.eq("ktp_status", "ditolak");
    } else if (filter === "aktif") {
      query = query.eq("ktp_status", "aktif");
    }
    
    const { data, error } = await query;
    
    if (!error) {
      setSubmissions(data || []);
    }
    
    setLoading(false);
  };

  const handleApprove = async (userId) => {
    const { error } = await supabase
      .from("profiles")
      .update({
        ktp_status: "aktif",
        ktp_verified_at: new Date().toISOString(),
      })
      .eq("id", userId);
    
    if (!error) {
      alert("✅ KTP Digital berhasil diverifikasi!");
      fetchSubmissions();
      if (isMobile) {
        setShowDetail(false);
        setSelectedSubmission(null);
      }
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
      alert("Alasan penolakan wajib diisi!");
      return;
    }
    
    setIsSubmitting(true);
    
    const { error } = await supabase
      .from("profiles")
      .update({
        ktp_status: "ditolak",
        ktp_rejection_reason: rejectReason,
      })
      .eq("id", rejectUserId);
    
    setIsSubmitting(false);
    
    if (!error) {
      setShowRejectModal(false);
      alert("❌ Pengajuan ditolak!");
      fetchSubmissions();
      if (isMobile) {
        setShowDetail(false);
        setSelectedSubmission(null);
      }
    } else {
      alert("Gagal: " + error.message);
    }
  };

  const openEditModal = (submission) => {
    setEditData({
      id: submission.id,
      full_name: submission.full_name || "",
      usia: submission.usia || "",
      profesi: submission.profesi || "",
      whatsapp: submission.whatsapp || "",
      alamat: submission.alamat || "",
      desa: submission.desa || "",
      kecamatan: submission.kecamatan || "",
      kabupaten: submission.kabupaten || "",
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async () => {
    setIsEditing(true);
    
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: editData.full_name,
        usia: parseInt(editData.usia),
        profesi: editData.profesi,
        whatsapp: editData.whatsapp,
        alamat: editData.alamat,
        desa: editData.desa,
        kecamatan: editData.kecamatan,
        kabupaten: editData.kabupaten,
      })
      .eq("id", editData.id);
    
    setIsEditing(false);
    
    if (!error) {
      alert("✅ Data user berhasil diperbarui!");
      setShowEditModal(false);
      fetchSubmissions();
      if (selectedSubmission?.id === editData.id) {
        setSelectedSubmission({ ...selectedSubmission, ...editData });
      }
    } else {
      alert("Gagal: " + error.message);
    }
  };

  const checkDataCompleteness = (profile) => {
    const required = [
      { field: "full_name", label: "Nama Lengkap" },
      { field: "usia", label: "Usia" },
      { field: "profesi", label: "Profesi" },
      { field: "whatsapp", label: "WhatsApp" },
      { field: "alamat", label: "Alamat" },
      { field: "desa", label: "Desa" },
      { field: "kabupaten", label: "Kabupaten" },
    ];
    
    const missing = required.filter(r => !profile[r.field]);
    return {
      isComplete: missing.length === 0,
      missingCount: missing.length,
      missingFields: missing.map(m => m.label),
    };
  };

  const filteredSubmissions = submissions.filter(sub => 
    sub.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    sub.username?.toLowerCase().includes(search.toLowerCase()) ||
    sub.email?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    menunggu: submissions.filter(s => s.ktp_status === "menunggu").length,
    aktif: submissions.filter(s => s.ktp_status === "aktif").length,
    ditolak: submissions.filter(s => s.ktp_status === "ditolak").length,
  };

  // Modal Edit User Component
  const EditUserModal = () => {
    if (!showEditModal) return null;
    
    return (
      <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowEditModal(false)}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="sticky top-0 bg-white dark:bg-slate-900 border-b dark:border-slate-800 p-4 flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Edit2 size="18" />
              Edit Data User
            </h3>
            <button onClick={() => setShowEditModal(false)} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
              <X size="18" />
            </button>
          </div>
          
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-500">Nama Lengkap</label>
              <input
                type="text"
                value={editData.full_name || ""}
                onChange={(e) => setEditData({...editData, full_name: e.target.value})}
                className="w-full mt-1 p-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700"
              />
            </div>
            
            <div>
              <label className="text-xs font-medium text-slate-500">Usia</label>
              <input
                type="number"
                value={editData.usia || ""}
                onChange={(e) => setEditData({...editData, usia: e.target.value})}
                className="w-full mt-1 p-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700"
              />
            </div>
            
            <div>
              <label className="text-xs font-medium text-slate-500">Profesi</label>
              <input
                type="text"
                value={editData.profesi || ""}
                onChange={(e) => setEditData({...editData, profesi: e.target.value})}
                className="w-full mt-1 p-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700"
              />
            </div>
            
            <div>
              <label className="text-xs font-medium text-slate-500">WhatsApp</label>
              <input
                type="tel"
                value={editData.whatsapp || ""}
                onChange={(e) => setEditData({...editData, whatsapp: e.target.value})}
                className="w-full mt-1 p-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700"
              />
            </div>
            
            <div>
              <label className="text-xs font-medium text-slate-500">Alamat</label>
              <input
                type="text"
                value={editData.alamat || ""}
                onChange={(e) => setEditData({...editData, alamat: e.target.value})}
                className="w-full mt-1 p-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Desa</label>
                <input
                  type="text"
                  value={editData.desa || ""}
                  onChange={(e) => setEditData({...editData, desa: e.target.value})}
                  className="w-full mt-1 p-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Kecamatan</label>
                <input
                  type="text"
                  value={editData.kecamatan || ""}
                  onChange={(e) => setEditData({...editData, kecamatan: e.target.value})}
                  className="w-full mt-1 p-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
            </div>
            
            <div>
              <label className="text-xs font-medium text-slate-500">Kabupaten</label>
              <input
                type="text"
                value={editData.kabupaten || ""}
                onChange={(e) => setEditData({...editData, kabupaten: e.target.value})}
                className="w-full mt-1 p-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700"
              />
            </div>
            
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-2 rounded-xl border hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                onClick={handleUpdateUser}
                disabled={isEditing}
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isEditing ? <Loader2 size="14" className="animate-spin" /> : <Save size="14" />}
                {isEditing ? "MENYIMPAN..." : "SIMPAN PERUBAHAN"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Tampilan Mobile: List + Modal
  if (isMobile) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
        {/* Header Mobile */}
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b dark:border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-purple-500" size={20} />
              <h1 className="text-lg font-bold">Verifikasi KTP</h1>
            </div>
            <button onClick={() => router.back()} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800">
              ✕
            </button>
          </div>
          
          <div className="flex gap-2 mt-3">
            <div className="relative flex-1">
              <Search size="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border dark:bg-slate-800 dark:border-slate-700 text-sm"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border dark:bg-slate-800 dark:border-slate-700 text-sm"
            >
              <option value="menunggu">Menunggu</option>
              <option value="semua">Semua</option>
              <option value="aktif">Aktif</option>
              <option value="ditolak">Ditolak</option>
            </select>
          </div>
          
          <div className="flex gap-2 mt-3">
            <div className="flex-1 text-center p-2 rounded-xl bg-yellow-100 dark:bg-yellow-500/20">
              <p className="text-xl font-bold text-yellow-600">{stats.menunggu}</p>
              <p className="text-[10px]">Menunggu</p>
            </div>
            <div className="flex-1 text-center p-2 rounded-xl bg-green-100 dark:bg-green-500/20">
              <p className="text-xl font-bold text-green-600">{stats.aktif}</p>
              <p className="text-[10px]">Aktif</p>
            </div>
            <div className="flex-1 text-center p-2 rounded-xl bg-red-100 dark:bg-red-500/20">
              <p className="text-xl font-bold text-red-600">{stats.ditolak}</p>
              <p className="text-[10px]">Ditolak</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p>Tidak ada pengajuan</p>
            </div>
          ) : (
            filteredSubmissions.map((sub) => {
              const completeness = checkDataCompleteness(sub);
              return (
                <div
                  key={sub.id}
                  onClick={() => {
                    setSelectedSubmission(sub);
                    setShowDetail(true);
                  }}
                  className={`bg-white dark:bg-slate-900 rounded-xl p-4 border cursor-pointer active:scale-98 transition-all
                    ${sub.ktp_status === "menunggu" ? "border-l-4 border-l-yellow-500" : ""}
                    ${sub.ktp_status === "ditolak" ? "border-l-4 border-l-red-500" : ""}
                    ${sub.ktp_status === "aktif" ? "border-l-4 border-l-green-500" : ""}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                      {sub.avatar_url ? (
                        <img src={sub.avatar_url} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <User size="16" className="text-purple-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{sub.full_name || "—"}</p>
                      <p className="text-xs text-slate-500">@{sub.username || "belum ada"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full
                          ${sub.ktp_status === "menunggu" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400" : ""}
                          ${sub.ktp_status === "aktif" ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" : ""}
                          ${sub.ktp_status === "ditolak" ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" : ""}
                        `}>
                          {sub.ktp_status === "menunggu" && "MENUNGGU"}
                          {sub.ktp_status === "aktif" && "AKTIF"}
                          {sub.ktp_status === "ditolak" && "DITOLAK"}
                        </span>
                        {!completeness.isComplete && sub.ktp_status === "menunggu" && (
                          <span className="text-[8px] text-amber-500">⚠️ data kurang</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size="14" className="text-slate-400" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Detail Mobile */}
        {showDetail && selectedSubmission && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => setShowDetail(false)}>
            <div className="bg-white dark:bg-slate-900 rounded-t-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white dark:bg-slate-900 border-b dark:border-slate-800 p-4 flex items-center justify-between">
                <button onClick={() => setShowDetail(false)} className="p-1">
                  <ArrowLeft size="20" />
                </button>
                <h2 className="font-semibold">Detail Pengajuan</h2>
                <div className="w-6" />
              </div>
              
              <div className="p-4 space-y-4">
                <DetailContent 
                  submission={selectedSubmission} 
                  onApprove={handleApprove}
                  onReject={openRejectModal}
                  onEdit={openEditModal}
                  checkCompleteness={checkDataCompleteness}
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal Reject */}
        <RejectModal 
          isOpen={showRejectModal}
          onClose={() => setShowRejectModal(false)}
          onConfirm={handleReject}
          reason={rejectReason}
          setReason={setRejectReason}
          isSubmitting={isSubmitting}
        />
        
        {/* Modal Edit User */}
        <EditUserModal />
      </div>
    );
  }

  // Tampilan Desktop
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="text-purple-500" />
              Verifikasi KTP Digital
            </h1>
            <p className="text-sm text-slate-500">Kelola pengajuan KTP Digital warga</p>
          </div>
          <button onClick={() => router.back()} className="px-4 py-2 rounded-xl border hover:bg-slate-50">
            Kembali
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border">
            <p className="text-2xl font-bold text-yellow-600">{stats.menunggu}</p>
            <p className="text-sm">Menunggu Verifikasi</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border">
            <p className="text-2xl font-bold text-green-600">{stats.aktif}</p>
            <p className="text-sm">Terverifikasi</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border">
            <p className="text-2xl font-bold text-red-600">{stats.ditolak}</p>
            <p className="text-sm">Ditolak</p>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama, username, atau email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border dark:bg-slate-900 dark:border-slate-800"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 rounded-xl border dark:bg-slate-900 dark:border-slate-800"
          >
            <option value="menunggu">Menunggu Verifikasi</option>
            <option value="semua">Semua Pengajuan</option>
            <option value="aktif">Aktif</option>
            <option value="ditolak">Ditolak</option>
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-white dark:bg-slate-900 rounded-xl p-8">
                <p>Tidak ada pengajuan</p>
              </div>
            ) : (
              filteredSubmissions.map((sub) => {
                const completeness = checkDataCompleteness(sub);
                return (
                  <div
                    key={sub.id}
                    onClick={() => setSelectedSubmission(sub)}
                    className={`bg-white dark:bg-slate-900 rounded-xl p-4 border cursor-pointer transition-all
                      ${selectedSubmission?.id === sub.id ? "ring-2 ring-purple-500" : "hover:shadow-md"}
                      ${sub.ktp_status === "menunggu" ? "border-l-4 border-l-yellow-500" : ""}
                      ${sub.ktp_status === "ditolak" ? "border-l-4 border-l-red-500" : ""}
                      ${sub.ktp_status === "aktif" ? "border-l-4 border-l-green-500" : ""}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                        {sub.avatar_url ? (
                          <img src={sub.avatar_url} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <User size="16" className="text-purple-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{sub.full_name || "—"}</p>
                        <p className="text-sm text-slate-500">@{sub.username || "belum ada"}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full
                            ${sub.ktp_status === "menunggu" ? "bg-yellow-100 text-yellow-700" : ""}
                            ${sub.ktp_status === "aktif" ? "bg-green-100 text-green-700" : ""}
                            ${sub.ktp_status === "ditolak" ? "bg-red-100 text-red-700" : ""}
                          `}>
                            {sub.ktp_status === "menunggu" && "MENUNGGU"}
                            {sub.ktp_status === "aktif" && "AKTIF"}
                            {sub.ktp_status === "ditolak" && "DITOLAK"}
                          </span>
                          {!completeness.isComplete && sub.ktp_status === "menunggu" && (
                            <span className="text-[10px] text-amber-500">⚠️ Data tidak lengkap</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size="14" className="text-slate-400" />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border p-5 max-h-[70vh] overflow-y-auto">
            {selectedSubmission ? (
              <DetailContent 
                submission={selectedSubmission} 
                onApprove={handleApprove}
                onReject={openRejectModal}
                onEdit={openEditModal}
                checkCompleteness={checkDataCompleteness}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 py-12">
                <Eye size="40" className="mb-3 opacity-50" />
                <p>Pilih pengajuan dari daftar</p>
                <p className="text-sm">Klik salah satu card untuk melihat detail</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Reject Desktop */}
      <RejectModal 
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleReject}
        reason={rejectReason}
        setReason={setRejectReason}
        isSubmitting={isSubmitting}
      />
      
      {/* Modal Edit User Desktop */}
      <EditUserModal />
    </div>
  );
}

// Komponen Modal Alasan Penolakan
function RejectModal({ isOpen, onClose, onConfirm, reason, setReason, isSubmitting }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
            <AlertCircle size="20" className="text-red-500" />
          </div>
          <h3 className="text-lg font-bold">Tolak Pengajuan</h3>
        </div>
        
        <p className="text-sm text-slate-500 mb-4">
          Berikan alasan penolakan agar pengguna dapat memperbaiki data:
        </p>
        
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Contoh: Data KTP tidak jelas, Foto selfie tidak sesuai, Alamat tidak lengkap, dll."
          className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700 text-sm min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
          autoFocus
        />
        
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting || !reason.trim()}
            className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "PROSES..." : "TOLAK PENGAJUAN"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Komponen Detail Content
function DetailContent({ submission, onApprove, onReject, onEdit, checkCompleteness }) {
  const completeness = checkCompleteness(submission);
  
  return (
    <>
      <div className="flex items-center gap-3 pb-4 border-b dark:border-slate-800">
        <div className="w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
          {submission.avatar_url ? (
            <img src={submission.avatar_url} className="w-full h-full rounded-full object-cover" />
          ) : (
            <User size="24" className="text-purple-500" />
          )}
        </div>
        <div>
          <p className="font-bold text-lg">{submission.full_name || "—"}</p>
          <p className="text-sm text-slate-500">@{submission.username || "belum ada"}</p>
          <p className="text-xs text-slate-400">{submission.email}</p>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
          <User size="14" /> Data Diri
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-slate-500 text-xs">Nama Lengkap</p>
            <p>{submission.full_name || "—"}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Usia</p>
            <p>{submission.usia || "—"} tahun</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">WhatsApp</p>
            <p>{submission.whatsapp || "—"}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Profesi</p>
            <p>{submission.profesi || "—"}</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
          <MapPin size="14" /> Lokasi
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-slate-500 text-xs">Alamat</p>
            <p>{submission.alamat || "—"}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Desa</p>
            <p>{submission.desa || "—"}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Kecamatan</p>
            <p>{submission.kecamatan || "—"}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Kabupaten</p>
            <p>{submission.kabupaten || "—"}</p>
          </div>
        </div>
      </div>

      <div className={`p-3 rounded-lg ${completeness.isComplete ? "bg-green-100 dark:bg-green-500/10" : "bg-amber-100 dark:bg-amber-500/10"}`}>
        <p className="text-sm font-medium">
          {completeness.isComplete ? "✅ Semua data lengkap" : `⚠️ Data tidak lengkap (${completeness.missingCount} field kosong)`}
        </p>
        {!completeness.isComplete && (
          <p className="text-xs mt-1 text-slate-500">
            {completeness.missingFields.join(", ")}
          </p>
        )}
      </div>

      {/* Tombol Aksi untuk status MENUNGGU */}
      {submission.ktp_status === "menunggu" && (
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => onReject(submission.id)}
            className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
          >
            <XCircle size="14" className="inline mr-1" />
            TOLAK
          </button>
          <button
            onClick={() => onApprove(submission.id)}
            className="flex-1 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white font-medium transition-colors"
          >
            <CheckCircle size="14" className="inline mr-1" />
            SETUJUI
          </button>
        </div>
      )}

      {/* Tombol Diskresi Superadmin */}
      {submission.ktp_status === "menunggu" && !completeness.isComplete && (
        <button
          onClick={() => {
            if (confirm("Data tidak lengkap. Verifikasi dengan diskresi superadmin?")) {
              onApprove(submission.id);
            }
          }}
          className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <ShieldCheck size="14" />
          ⚡ SETUJUI (Diskresi Superadmin)
        </button>
      )}

      {/* Tombol EDIT DATA untuk status DITOLAK */}
      {submission.ktp_status === "ditolak" && (
        <button
          onClick={() => onEdit(submission)}
          className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <Edit2 size="14" />
          ✏️ Edit Data User (Perbaiki Manual)
        </button>
      )}

      {/* Alasan Penolakan */}
      {submission.ktp_status === "ditolak" && submission.ktp_rejection_reason && (
        <div className="p-3 rounded-lg bg-red-100 dark:bg-red-500/10">
          <p className="text-sm font-medium text-red-600">Alasan Penolakan:</p>
          <p className="text-sm">{submission.ktp_rejection_reason}</p>
        </div>
      )}
    </>
  );
}