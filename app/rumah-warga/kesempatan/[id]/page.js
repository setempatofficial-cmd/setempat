"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Camera, X, Send, ArrowLeft, CheckCircle, Clock, AlertCircle, MapPin, UserPlus, Store, Truck, Handshake } from "lucide-react";
import { CldUploadWidget } from "next-cloudinary";

export default function IkutiKesempatanPage() {
  const router = useRouter();
  const { id } = useParams();
  const { user } = useAuth();

  const [opportunity, setOpportunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(false);

  // State untuk bounty laporan (butuh kondisi)
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [selectedTraffic, setSelectedTraffic] = useState(null);
  const [selectedWaitTime, setSelectedWaitTime] = useState(null);

  // State untuk program pendaftaran
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [checkingRegistration, setCheckingRegistration] = useState(false);

  // Helper functions
  const getCurrentTimeTag = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return "Pagi";
    if (hour >= 11 && hour < 15) return "Siang";
    if (hour >= 15 && hour < 18) return "Sore";
    return "Malam";
  };

  const ESTIMATED_PEOPLE = {
    Sepi: { Pagi: 3, Siang: 5, Sore: 4, Malam: 2 },
    Ramai: { Pagi: 12, Siang: 25, Sore: 20, Malam: 15 },
    Antri: { Pagi: 8, Siang: 15, Sore: 12, Malam: 10 }
  };

  const currentTimeTag = getCurrentTimeTag();

  // Deteksi jenis opportunity
  const isProgramBakul = (title) => title?.toLowerCase().includes("bakul baru") || title?.toLowerCase().includes("program bakul");
  const isProgramOjek = (title) => title?.toLowerCase().includes("ojek") || title?.toLowerCase().includes("driver");
  const isProgramRewang = (title) => title?.toLowerCase().includes("rewang") || title?.toLowerCase().includes("jasa");

  // Ekstrak lokasi
  const extractLocation = (title) => {
    const match = title?.match(/(?:di|untuk|di daerah)\s+([A-Za-z\s]+)$/i);
    if (match) return match[1].trim();
    return title?.replace(/^(Dibutuhkan|Video|Foto)\s*/i, '').split(' - ')[0] || "Lokasi Setempat";
  };

  const lokasiName = opportunity ? extractLocation(opportunity.title) : "";

  useEffect(() => {
    const fetchOpportunity = async () => {
      try {
        const { data, error } = await supabase
          .from("opportunities")
          .select("*")
          .eq("id", id)
          .single();
        if (error) throw error;
        setOpportunity(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchOpportunity();
  }, [id]);

  // Cek apakah user sudah terdaftar untuk program tertentu
  useEffect(() => {
    if (!user || !opportunity) return;

    const checkRegistration = async () => {
      setCheckingRegistration(true);
      let isRegistered = false;

      if (isProgramBakul(opportunity.title)) {
        const { data } = await supabase
          .from("seller_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        isRegistered = !!data;
      } else if (isProgramOjek(opportunity.title)) {
        const { data } = await supabase
          .from("driver_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        isRegistered = !!data;
      } else if (isProgramRewang(opportunity.title)) {
        const { data } = await supabase
          .from("rewang_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        isRegistered = !!data;
      }

      setAlreadyRegistered(isRegistered);
      setCheckingRegistration(false);
    };

    // Cek submission biasa
    const checkSubmission = async () => {
      const { data } = await supabase
        .from("bounty_submissions")
        .select("*")
        .eq("user_id", user.id)
        .eq("opportunity_id", opportunity.id)
        .maybeSingle();
      if (data) {
        setSubmitted(true);
        setSubmissionStatus(data.status);
      }
    };

    checkRegistration();
    checkSubmission();
  }, [user, opportunity]);

  const handleUploadDone = (res) => {
    if (res?.event === "success" && res.info?.secure_url) {
      setMediaType(res.info.resource_type);
      setMediaUrl(res.info.secure_url);
      setUploadProgress(false);
    }
  };

  const handleUploadStart = () => setUploadProgress(true);

  // Handler untuk program pendaftaran
  const handleRegisterProgram = async () => {
    if (!user) {
      alert("Silakan login terlebih dahulu");
      router.push("/login");
      return;
    }

    setSubmitting(true);

    let tableName = "";
    let profileData = {};

    if (isProgramBakul(opportunity.title)) {
      tableName = "seller_profiles";
      profileData = {
        user_id: user.id,
        toko_name: "Toko Saya",
        business_type: "UMKM",
        is_active: true
      };
    } else if (isProgramOjek(opportunity.title)) {
      tableName = "driver_profiles";
      profileData = {
        user_id: user.id,
        driver_status: "offline",
        is_verified: false
      };
    } else if (isProgramRewang(opportunity.title)) {
      tableName = "rewang_profiles";
      profileData = {
        user_id: user.id,
        is_available: true
      };
    }

    // Insert ke tabel program
    const { error: insertError } = await supabase
      .from(tableName)
      .insert([profileData]);

    if (!insertError) {
      // Catat partisipasi
      await supabase.from("user_opportunities").insert({
        user_id: user.id,
        opportunity_id: opportunity.id,
        status: "approved",
        completed_at: new Date().toISOString()
      });

      // Tambah poin reward
      const { data: profile } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", user.id)
        .single();

      await supabase
        .from("profiles")
        .update({ points: (profile?.points || 0) + opportunity.reward_value })
        .eq("id", user.id);

      setSubmitted(true);
      setSubmissionStatus("approved");
      alert(`✅ Selamat! Anda berhasil mendaftar ${opportunity.title}\n\nReward: ${opportunity.reward_text} telah ditambahkan ke akun Anda.`);
    } else {
      alert("Gagal mendaftar: " + insertError.message);
    }

    setSubmitting(false);
  };

  const handleSubmit = async () => {
    if (!user) {
      alert("Silakan login terlebih dahulu");
      router.push("/login");
      return;
    }

    // Jika ini program pendaftaran (Bakul/Ojek/Rewang)
    if (isProgramBakul(opportunity.title) || isProgramOjek(opportunity.title) || isProgramRewang(opportunity.title)) {
      if (alreadyRegistered) {
        alert("Anda sudah terdaftar dalam program ini!");
        router.push("/rumah-warga");
        return;
      }
      await handleRegisterProgram();
      return;
    }

    // Bounty laporan atau bounty konten
    if (!mediaUrl) {
      alert("Silakan upload foto/video terlebih dahulu");
      return;
    }

    if (isBountyLaporan && !selectedCondition && !selectedTraffic) {
      alert("Pilih kondisi tempat atau lalu lintas");
      return;
    }

    if (isBountyLaporan && selectedCondition === "Antri" && !selectedWaitTime) {
      alert("Pilih estimasi waktu antrian");
      return;
    }

    setSubmitting(true);

    const getAutoDesc = () => {
      if (!isBountyLaporan) return description.trim() || `Mengirim konten untuk ${opportunity.title}`;
      if (selectedCondition === "Sepi") return `Suasana tenang di ${lokasiName}.`;
      if (selectedCondition === "Ramai") return `Suasana ramai di ${lokasiName}.`;
      if (selectedCondition === "Antri") {
        const waitText = selectedWaitTime === 5 ? "pendek (<5 menit)" : selectedWaitTime === 15 ? "sedang (5-15 menit)" : "panjang (>15 menit)";
        return `Antrian ${waitText} di ${lokasiName}.`;
      }
      if (selectedTraffic) {
        const text = selectedTraffic === 'Lancar' ? 'lancar' : selectedTraffic === 'Ramai' ? 'ramai' : 'macet';
        return `Lalu lintas ${text} di ${lokasiName}.`;
      }
      return description.trim() || `Update dari ${lokasiName}.`;
    };

    const finalDescription = getAutoDesc();
    const estimatedPeople = isBountyLaporan && selectedCondition ? (ESTIMATED_PEOPLE[selectedCondition]?.[currentTimeTag] || 4) : null;

    const submissionData = {
      user_id: user.id,
      opportunity_id: opportunity.id,
      title: opportunity.title,
      description: finalDescription,
      media_url: mediaUrl,
      media_type: mediaType,
      status: "pending",
      submitted_at: new Date().toISOString(),
      metadata: {
        lokasi: lokasiName,
        opportunity_title: opportunity.title,
        bounty_type: isBountyLaporan ? "laporan" : "konten",
        condition: selectedCondition,
        traffic: selectedTraffic,
        wait_time: selectedWaitTime,
        time_tag: currentTimeTag
      }
    };

    if (isBountyLaporan) {
      submissionData.laporan_data = {
        user_id: user.id,
        user_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Warga",
        username: user.user_metadata?.username || user.email?.split("@")[0],
        user_avatar: user.user_metadata?.avatar_url || null,
        deskripsi: finalDescription,
        photo_url: mediaType === "image" ? mediaUrl : null,
        video_url: mediaType === "video" ? mediaUrl : null,
        media_type: mediaType || "text",
        time_tag: currentTimeTag,
        tipe: selectedCondition || (selectedTraffic ? "Lalu Lintas" : null),
        estimated_people: estimatedPeople,
        estimated_wait_time: selectedCondition === "Antri" ? selectedWaitTime : null,
        traffic_condition: selectedTraffic || null,
        status: "approved",
        lokasi_name: lokasiName,
        report_type: "bounty",
        opportunity_id: opportunity.id
      };
    }

    if (isBountyKonten && opportunity.need_publish === false) {
      submissionData.marketplace_data = {
        user_id: user.id,
        title: opportunity.title,
        description: description,
        file_url: mediaUrl,
        file_type: mediaType,
        price: opportunity.reward_value,
        status: "pending",
        submitted_at: new Date().toISOString()
      };
    }

    const { error } = await supabase
      .from("bounty_submissions")
      .insert([submissionData]);

    if (!error) {
      setSubmitted(true);
      setSubmissionStatus("pending");
      alert(`✅ Berhasil mengirim!\n\n${isBountyLaporan ? "Konten akan tayang setelah diverifikasi." : "Konten akan masuk ke marketplace."}\nReward: ${opportunity.reward_text}`);
    } else {
      alert("Gagal mengirim: " + error.message);
    }

    setSubmitting(false);
  };

  // Definisi jenis bounty setelah opportunity tersedia
  const isBountyLaporan = opportunity?.category === "bounty_laporan" ||
    opportunity?.title?.toLowerCase().includes("dibutuhkan") ||
    opportunity?.title?.toLowerCase().includes("kecelakaan");

  const isBountyKonten = opportunity?.category === "bounty_konten" ||
    opportunity?.title?.toLowerCase().includes("wartabromo") ||
    opportunity?.title?.toLowerCase().includes("umkm") ||
    opportunity?.title?.toLowerCase().includes("video anda digunakan");

  const isProgram = isProgramBakul(opportunity?.title) ||
    isProgramOjek(opportunity?.title) ||
    isProgramRewang(opportunity?.title);

  // Loading states
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Memuat kesempatan...</p>
        </div>
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center p-5">
        <div className="text-center max-w-[300px]">
          <AlertCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-4">Kesempatan tidak ditemukan atau sudah berakhir</p>
          <button onClick={() => router.push("/rumah-warga")} className="px-6 py-3 bg-emerald-600 rounded-xl text-white font-bold">
            Kembali ke Rumah Warga
          </button>
        </div>
      </div>
    );
  }

  const isMoney = opportunity.reward_type === "money";
  const deadline = new Date(opportunity.deadline);
  const isExpired = deadline < new Date();

  if (isExpired && !submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center p-5">
        <div className="text-center max-w-[300px]">
          <Clock className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-2">Kesempatan telah berakhir</p>
          <p className="text-xs text-slate-500 mb-4">Deadline: {deadline.toLocaleDateString('id-ID')}</p>
          <button onClick={() => router.push("/rumah-warga")} className="px-6 py-3 bg-emerald-600 rounded-xl text-white font-bold">
            Kembali ke Rumah Warga
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    const statusConfig = {
      pending: { icon: Clock, text: "Menunggu Verifikasi", color: "text-amber-400", bg: "bg-amber-500/10", desc: "Tim kami akan memverifikasi kiriman Anda dalam 1x24 jam" },
      approved: { icon: CheckCircle, text: "Disetujui!", color: "text-emerald-400", bg: "bg-emerald-500/10", desc: "Selamat! Reward akan segera diberikan." },
      rejected: { icon: AlertCircle, text: "Belum Berhasil", color: "text-rose-400", bg: "bg-rose-500/10", desc: "Kiriman Anda belum memenuhi kriteria." }
    };
    const config = statusConfig[submissionStatus] || statusConfig.pending;
    const StatusIcon = config.icon;

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center p-5">
        <div className="text-center max-w-[350px]">
          <div className={`w-20 h-20 rounded-full ${config.bg} flex items-center justify-center mx-auto mb-4`}>
            <StatusIcon className={`w-10 h-10 ${config.color}`} />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">{config.text}</h1>
          <p className="text-slate-400 text-sm mb-4">{config.desc}</p>
          <button onClick={() => router.push("/rumah-warga")} className="px-6 py-3 bg-emerald-600 rounded-xl text-white font-bold w-full">
            Kembali ke Rumah Warga
          </button>
        </div>
      </div>
    );
  }

  // Get icon untuk program
  const getProgramIcon = () => {
    if (isProgramBakul(opportunity.title)) return <Store className="w-8 h-8" />;
    if (isProgramOjek(opportunity.title)) return <Truck className="w-8 h-8" />;
    if (isProgramRewang(opportunity.title)) return <Handshake className="w-8 h-8" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 p-5">
      <div className="max-w-[400px] mx-auto pb-10">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors mb-4">
          <ArrowLeft size={18} />
          <span className="text-sm">Kembali</span>
        </button>

        {/* Header Kesempatan */}
        <div className={`rounded-2xl p-5 mb-6 border ${isProgram ? "bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border-blue-500/30" :
            isBountyLaporan ? "bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border-emerald-500/30"
              : "bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-purple-500/30"
          }`}>
          <div className="text-5xl mb-3 text-center">
            {isProgram ? getProgramIcon() : opportunity.icon}
          </div>
          <h1 className="text-xl font-bold text-white text-center mb-2">{opportunity.title}</h1>
          <p className="text-slate-300 text-sm text-center">{opportunity.description}</p>

          {/* Badge jenis */}
          <div className="mt-3 flex justify-center">
            <span className={`text-[8px] px-2 py-0.5 rounded-full ${isProgram ? "bg-blue-500/20 text-blue-400" :
                isBountyLaporan ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-purple-500/20 text-purple-400"
              }`}>
              {isProgram ? "🎯 Program Pendaftaran" : isBountyLaporan ? "📢 Bounty Laporan" : "🎬 Bounty Konten"}
            </span>
          </div>

          {/* Lokasi (khusus bounty laporan) */}
          {isBountyLaporan && (
            <div className="mt-3 flex items-center justify-center gap-2 text-emerald-400">
              <MapPin size={14} />
              <span className="text-xs font-medium">📍 Lokasi: {lokasiName}</span>
            </div>
          )}

          <div className={`mt-4 p-3 rounded-xl text-center ${isProgram ? "bg-blue-500/20" :
              isBountyLaporan ? "bg-emerald-500/20" : "bg-purple-500/20"
            }`}>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Reward</p>
            <p className={`text-2xl font-black ${isProgram ? "text-blue-400" :
                isBountyLaporan ? "text-emerald-400" : "text-purple-400"
              }`}>
              {opportunity.reward_text}
            </p>
            {isProgram && <p className="text-[8px] text-slate-500 mt-1">🎁 Poin + akses fitur</p>}
            {isBountyLaporan && <p className="text-[8px] text-slate-500 mt-1">🎁 Poin + tayang di feed</p>}
            {!isProgram && !isBountyLaporan && <p className="text-[8px] text-slate-500 mt-1">💰 Royalti + masuk marketplace</p>}
          </div>

          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-slate-400">
            <Clock size={12} />
            <span>Deadline: {new Date(opportunity.deadline).toLocaleDateString('id-ID')}</span>
          </div>
        </div>

        {/* Form Kirim */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white mb-2">
            {isProgram ? "Daftar Sekarang" : "Kirim Konten Anda"}
          </h2>

          {/* Untuk Program Pendaftaran (Bakul/Ojek/Rewang) */}
          {isProgram && (
            <div className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-300">
                  {isProgramBakul(opportunity.title) && "Daftar jadi Bakul dan dapatkan reward!"}
                  {isProgramOjek(opportunity.title) && "Daftar jadi Ojek dan dapatkan reward!"}
                  {isProgramRewang(opportunity.title) && "Daftar jadi Rewang dan dapatkan reward!"}
                </p>
              </div>

              {checkingRegistration ? (
                <div className="text-center py-4">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-400 mt-2">Memeriksa status...</p>
                </div>
              ) : alreadyRegistered ? (
                <div className="text-center p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-green-400 font-bold">Anda sudah terdaftar!</p>
                  <p className="text-xs text-slate-400 mt-1">Reward sudah diberikan.</p>
                  <button onClick={() => router.push("/rumah-warga")} className="mt-3 px-4 py-2 bg-emerald-600 rounded-lg text-white text-sm">
                    Kembali ke Rumah Warga
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white"
                >
                  {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Memproses...</> : <><UserPlus size={14} /> Daftar Sekarang</>}
                </button>
              )}
            </div>
          )}

          {/* Untuk Bounty Laporan atau Bounty Konten (upload media) */}
          {!isProgram && (
            <>
              {/* Upload Area */}
              <div>
                {!mediaUrl ? (
                  <CldUploadWidget
                    uploadPreset="setempat_preset"
                    onSuccess={handleUploadDone}
                    onQueuesStart={handleUploadStart}
                    options={{
                      maxFiles: 1,
                      resourceType: "auto",
                      sources: ["camera", "local", "google_drive"],
                      multiple: false,
                    }}
                  >
                    {({ open }) => (
                      <button onClick={() => open()} disabled={uploadProgress} className="w-full aspect-video rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/50 flex flex-col items-center justify-center gap-2 hover:border-emerald-500 transition-all">
                        {uploadProgress ? (
                          <>
                            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs text-slate-400">Mengupload...</span>
                          </>
                        ) : (
                          <>
                            <Camera size={32} className="text-slate-500" />
                            <span className="text-xs text-slate-400">Klik untuk upload foto/video</span>
                          </>
                        )}
                      </button>
                    )}
                  </CldUploadWidget>
                ) : (
                  <div className="relative rounded-xl overflow-hidden bg-slate-800">
                    {mediaType === "image" ? (
                      <img src={mediaUrl} className="w-full h-auto max-h-[300px] object-contain" alt="preview" />
                    ) : (
                      <video src={mediaUrl} className="w-full h-auto max-h-[300px]" controls />
                    )}
                    <button onClick={() => { setMediaUrl(null); setMediaType(null); }} className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full hover:bg-black/80">
                      <X size={16} className="text-white" />
                    </button>
                  </div>
                )}
              </div>

              {/* Kondisi Tempat (HANYA UNTUK BOUNTY LAPORAN) */}
              {isBountyLaporan && (
                <>
                  <div>
                    <p className="text-xs text-slate-400 mb-2">📍 Kondisi Tempat <span className="text-rose-400">*</span></p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { emoji: "🍃", label: "Sepi", val: "Sepi" },
                        { emoji: "🏃", label: "Ramai", val: "Ramai" },
                        { emoji: "⏳", label: "Antri", val: "Antri" },
                      ].map((btn) => (
                        <button key={btn.val} onClick={() => { setSelectedCondition(btn.val); setSelectedTraffic(null); setSelectedWaitTime(null); }}
                          className={`py-2 rounded-xl text-[11px] font-bold border-2 transition-all flex flex-col items-center gap-1
                            ${selectedCondition === btn.val ? (btn.val === "Sepi" ? "bg-emerald-500 border-emerald-500 text-white" : btn.val === "Ramai" ? "bg-yellow-500 border-yellow-500 text-white" : "bg-rose-500 border-rose-500 text-white") : "bg-slate-800/50 border-slate-700 text-slate-400"}`}>
                          <span className="text-lg">{btn.emoji}</span>
                          <span>{btn.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedCondition === "Antri" && (
                    <div>
                      <p className="text-[10px] text-slate-400 mb-2">⏱️ Estimasi waktu antri <span className="text-rose-400">*</span></p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: 5, label: "< 5 menit", icon: "⚡" },
                          { value: 15, label: "5-15 menit", icon: "⏱️" },
                          { value: 20, label: "> 15 menit", icon: "🐢" },
                        ].map((option) => (
                          <button key={option.value} onClick={() => setSelectedWaitTime(option.value)}
                            className={`py-1.5 px-1 rounded-xl text-[9px] font-bold border transition-all text-center
                              ${selectedWaitTime === option.value ? "bg-cyan-500 border-cyan-500 text-white" : "bg-slate-800/50 border-slate-700 text-slate-400"}`}>
                            <div className="text-sm">{option.icon}</div>
                            <div>{option.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ATAU */}
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-slate-700" />
                    <span className="text-[8px] text-slate-500 uppercase">atau</span>
                    <div className="h-px flex-1 bg-slate-700" />
                  </div>

                  {/* LALU LINTAS */}
                  <div>
                    <p className="text-xs text-slate-400 mb-2">🚦 Kondisi Lalu Lintas</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { emoji: "🛵", label: "Lancar", val: "Lancar" },
                        { emoji: "🚗", label: "Ramai", val: "Ramai" },
                        { emoji: "🚦", label: "Macet", val: "Macet" },
                      ].map((opt) => (
                        <button key={opt.val} onClick={() => { setSelectedTraffic(opt.val); setSelectedCondition(null); setSelectedWaitTime(null); }}
                          className={`py-2 rounded-xl text-[10px] font-bold border-2 transition-all flex flex-col items-center gap-0.5
                            ${selectedTraffic === opt.val ? (opt.val === "Lancar" ? "bg-emerald-500 border-emerald-500 text-white" : opt.val === "Ramai" ? "bg-yellow-500 border-yellow-500 text-white" : "bg-rose-500 border-rose-500 text-white") : "bg-slate-800/50 border-slate-700 text-slate-400"}`}>
                          <span className="text-base">{opt.emoji}</span>
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Deskripsi */}
              <div>
                <label className="text-xs text-slate-400 mb-2 block">Deskripsi (opsional)</label>
                <textarea
                  placeholder={isBountyLaporan ? "Tambahkan keterangan tambahan..." : "Deskripsikan konten Anda..."}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500 resize-none"
                  rows={2}
                />
              </div>

              {/* Submit Button */}
              <button onClick={handleSubmit} disabled={submitting || !mediaUrl || (isBountyLaporan && !selectedCondition && !selectedTraffic)}
                className={`w-full py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2
                  ${(!mediaUrl || (isBountyLaporan && !selectedCondition && !selectedTraffic)) || submitting ? "bg-slate-800 text-slate-500 cursor-not-allowed" : isBountyLaporan ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white" : "bg-gradient-to-r from-purple-600 to-pink-600 text-white"}`}>
                {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Mengirim...</> : <><Send size={14} /> Kirim untuk Kesempatan Ini</>}
              </button>

              <p className="text-[9px] text-slate-500 text-center">
                {isBountyLaporan
                  ? "Konten akan tayang di feed setelah diverifikasi."
                  : "Konten akan masuk ke marketplace untuk dijual."}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}