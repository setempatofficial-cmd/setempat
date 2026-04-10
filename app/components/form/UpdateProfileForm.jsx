"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { 
  Save, User, MapPin, Briefcase, Phone, AtSign, 
  Clock, ShieldCheck, Info, Camera, CheckCircle, XCircle, Clock as ClockIcon, Calendar,
  Navigation, Loader2, Edit2
} from "lucide-react";

export default function UpdateProfileForm({ profile, theme, onSaveSuccess }) {
  const isMalam = theme?.isMalam ?? true;

  const [loading, setLoading] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState(false);
  const [usernameLocked, setUsernameLocked] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [originalUsername, setOriginalUsername] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [ktpStatus, setKtpStatus] = useState("belum_mengajukan");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [usiaError, setUsiaError] = useState("");
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [isUsingGps, setIsUsingGps] = useState(false);
  
  const [formData, setFormData] = useState({
    username: "",
    full_name: "",
    usia: "",
    profesi: "",
    whatsapp: "",
    alamat: "",
    desa: "",
    kecamatan: "",
    kabupaten: "",
    latitude: null,
    longitude: null,
  });

  const checkUsernameChangePermission = (lastChangeDate) => {
    if (!lastChangeDate) return { canChange: true, daysLeft: 0 };
    const lastChange = new Date(lastChangeDate);
    const now = new Date();
    const daysDiff = Math.floor((now - lastChange) / (1000 * 60 * 60 * 24));
    const canChange = daysDiff >= 30;
    const daysLeft = canChange ? 0 : 30 - daysDiff;
    return { canChange, daysLeft };
  };

  // 🔥 FUNGSI GEOCODING (Alamat → Koordinat)
  const geocodeAddress = async (alamat, desa, kecamatan, kabupaten) => {
    try {
      const fullAddress = `${alamat}, ${desa}, ${kecamatan}, ${kabupaten}, Indonesia`;
      console.log("📍 Geocoding address:", fullAddress);
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`
      );
      const data = await response.json();
      
      if (data && data[0]) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon)
        };
      }
      return null;
    } catch (error) {
      console.error("Geocoding error:", error);
      return null;
    }
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
      );
      const data = await response.json();
      
      if (data && data.address) {
        const address = data.address;
        return {
          alamat: data.display_name?.split(",")[0] || "",
          desa: address.village || address.hamlet || address.suburb || "",
          kecamatan: address.county || address.district || "",
          kabupaten: address.city || address.town || address.municipality || "",
        };
      }
      return null;
    } catch (error) {
      console.error("Reverse geocode error:", error);
      return null;
    }
  };

  const getCurrentLocation = () => {
    setIsGettingLocation(true);
    setLocationError("");
    
    if (!navigator.geolocation) {
      setLocationError("Browser tidak mendukung GPS");
      setIsGettingLocation(false);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        const address = await reverseGeocode(latitude, longitude);
        
        if (address) {
          setFormData(prev => ({
            ...prev,
            alamat: address.alamat,
            desa: address.desa,
            kecamatan: address.kecamatan,
            kabupaten: address.kabupaten,
            latitude: latitude,
            longitude: longitude,
          }));
          setIsUsingGps(true);
          setIsEditingLocation(false);
        } else {
          setLocationError("Gagal mendapatkan alamat, coba lagi");
        }
        
        setIsGettingLocation(false);
      },
      (error) => {
        console.error("GPS Error:", error);
        switch(error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Izin lokasi ditolak. Aktifkan GPS di browser.");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Lokasi tidak tersedia. Coba lagi.");
            break;
          case error.TIMEOUT:
            setLocationError("Waktu habis. Coba lagi.");
            break;
          default:
            setLocationError("Gagal mendapatkan lokasi.");
        }
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const fetchProfile = async () => {
    if (!profile?.id) return;
    
    setIsLoadingProfile(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profile.id)
      .single();
    
    if (!error && data) {
      const currentUsername = data.username || "";
      const status = data.ktp_status || "belum_mengajukan";
      
      setKtpStatus(status);
      setFormData({
        username: currentUsername,
        full_name: data.full_name || profile?.user_metadata?.full_name || "",
        usia: data.usia || "",
        profesi: data.profesi || "",
        whatsapp: data.whatsapp || "",
        alamat: data.alamat || "",
        desa: data.desa || "",
        kecamatan: data.kecamatan || "",
        kabupaten: data.kabupaten || "",
        latitude: data.latitude || null,
        longitude: data.longitude || null,
      });
      
      setAvatarPreview(data.avatar_url || profile?.user_metadata?.avatar_url || "");
      setOriginalUsername(currentUsername);
      
      const { canChange, daysLeft } = checkUsernameChangePermission(data.last_username_change);
      setUsernameLocked(!canChange);
      setDaysRemaining(daysLeft);
      
      if (currentUsername) {
        setUsernameAvailable(true);
        const isDefaultUsername = currentUsername === "user" || 
                                   currentUsername?.startsWith("user") ||
                                   (data.email && currentUsername === data.email.split("@")[0]);
        setShowInfo(isDefaultUsername);
      }
    } else {
      const currentUsername = profile.username || "";
      setFormData(prev => ({ 
        ...prev, 
        username: currentUsername,
        full_name: profile?.full_name || profile?.user_metadata?.full_name || "",
      }));
      setAvatarPreview(profile?.user_metadata?.avatar_url || "");
      setOriginalUsername(currentUsername);
    }
    
    setIsLoadingProfile(false);
  };

  useEffect(() => {
    fetchProfile();
  }, [profile?.id]);

  const checkUsername = async (username) => {
    if (usernameLocked && username !== originalUsername) {
      setUsernameError(`Tunggu ${daysRemaining} hari`);
      setUsernameAvailable(false);
      return false;
    }
    
    if (username === originalUsername) {
      setUsernameError("");
      setUsernameAvailable(true);
      setShowInfo(false);
      return true;
    }

    if (!username || username.length < 3) {
      setUsernameError("Minimal 3 karakter");
      setUsernameAvailable(false);
      return false;
    }

    if (username.length > 20) {
      setUsernameError("Maksimal 20 karakter");
      setUsernameAvailable(false);
      return false;
    }

    const usernameRegex = /^[a-z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      setUsernameError("Huruf kecil, angka, underscore");
      setUsernameAvailable(false);
      return false;
    }

    setIsCheckingUsername(true);
    const { data } = await supabase
      .from("profiles")
      .select("username, id")
      .eq("username", username)
      .maybeSingle();
    setIsCheckingUsername(false);

    if (data && data.id !== profile?.id) {
      setUsernameError("Sudah dipakai");
      setUsernameAvailable(false);
      return false;
    }

    setUsernameError("");
    setUsernameAvailable(true);
    setShowInfo(false);
    return true;
  };

  const handleUsernameChange = async (e) => {
    const value = e.target.value.toLowerCase();
    setFormData({ ...formData, username: value });
    await checkUsername(value);
  };

  const handleUsiaChange = (e) => {
    const value = parseInt(e.target.value);
    if (e.target.value === "") {
      setUsiaError("");
      setFormData({ ...formData, usia: "" });
      return;
    }
    
    if (isNaN(value)) {
      setUsiaError("Masukkan angka");
      return;
    }
    
    if (value < 17) {
      setUsiaError("Minimal usia 17 tahun");
    } else if (value > 100) {
      setUsiaError("Maksimal usia 100 tahun");
    } else {
      setUsiaError("");
    }
    
    setFormData({ ...formData, usia: e.target.value });
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const uploadAvatar = async (userId) => {
    if (!avatarFile) return null;
    
    const fileExt = avatarFile.name.split('.').pop();
    const fileName = `${userId}/avatar.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, avatarFile, { upsert: true });
    
    if (uploadError) throw uploadError;
    
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);
    
    return publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!profile?.id) return;

    // Validasi dasar
    if (!formData.username) {
      alert("Username wajib diisi");
      return;
    }
    if (!formData.usia) {
      alert("Usia wajib diisi");
      return;
    }
    if (parseInt(formData.usia) < 17) {
      alert("Minimal usia 17 tahun");
      return;
    }
    if (!formData.whatsapp) {
      alert("Nomor WhatsApp wajib diisi");
      return;
    }
    if (!formData.profesi) {
      alert("Profesi wajib diisi");
      return;
    }
    
    // 🔥 WAJIB PAKAI GPS ATAU GEOCODING
    if (!formData.latitude || !formData.longitude) {
      if (!formData.alamat || !formData.desa || !formData.kabupaten) {
        alert("Silakan klik 'Gunakan Lokasi Saya' untuk mengisi lokasi");
        return;
      }
    }

    const isValid = await checkUsername(formData.username);
    if (!isValid) return;

    const isUsernameChanged = formData.username !== originalUsername;
    
    if (isUsernameChanged) {
      const { canChange } = checkUsernameChangePermission(profile.last_username_change);
      if (!canChange) {
        alert(`Tunggu ${daysRemaining} hari untuk ganti username`);
        return;
      }
    }

    setLoading(true);

    try {
      let avatarUrl = avatarPreview;
      if (avatarFile) {
        avatarUrl = await uploadAvatar(profile.id);
      }

      let latitude = formData.latitude;
      let longitude = formData.longitude;

      // 🔥 Jika tidak punya koordinat tapi ada alamat, lakukan geocoding
      if ((!latitude || !longitude) && formData.alamat && formData.desa && formData.kabupaten) {
        const coords = await geocodeAddress(
          formData.alamat,
          formData.desa,
          formData.kecamatan,
          formData.kabupaten
        );
        if (coords) {
          latitude = coords.latitude;
          longitude = coords.longitude;
          console.log("📍 Geocoding success:", coords);
        } else {
          alert("Gagal mendapatkan koordinat dari alamat. Silakan klik 'Gunakan Lokasi Saya'");
          setLoading(false);
          return;
        }
      }

      // Validasi final koordinat
      if (!latitude || !longitude) {
        alert("Lokasi tidak valid. Silakan klik 'Gunakan Lokasi Saya'");
        setLoading(false);
        return;
      }

      const updateData = {
        full_name: formData.full_name,
        usia: parseInt(formData.usia),
        profesi: formData.profesi,
        whatsapp: formData.whatsapp,
        alamat: formData.alamat,
        desa: formData.desa,
        kecamatan: formData.kecamatan,
        kabupaten: formData.kabupaten,
        latitude: latitude,
        longitude: longitude,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      };
      
      if (isUsernameChanged) {
        updateData.username = formData.username;
        updateData.last_username_change = new Date().toISOString();
        updateData.username_change_count = (profile.username_change_count || 0) + 1;
      }

      if (ktpStatus === "belum_mengajukan" || ktpStatus === "ditolak") {
        updateData.ktp_status = "menunggu";
        updateData.ktp_submitted_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profile.id);

      if (!error) {
        if (ktpStatus === "belum_mengajukan") {
          alert("✅ Pengajuan KTP Digital berhasil dikirim! Menunggu verifikasi Petinggi Setempat.");
        } else if (ktpStatus === "ditolak") {
          alert("✅ Pengajuan ulang berhasil dikirim! Menunggu verifikasi Petinggi Setempat.");
        } else if (isUsernameChanged) {
          alert("✅ Username berhasil diubah!");
        } else {
          alert("✅ Data profil berhasil disimpan!");
        }
        onSaveSuccess?.();
        fetchProfile();
      } else {
        alert("Gagal: " + error.message);
      }
    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const StatusBadge = () => {
    const statusConfig = {
      belum_mengajukan: { text: "BELUM MENGAJUKAN", color: "bg-gray-500/20 text-gray-400", icon: <Info size={10} /> },
      menunggu: { text: "MENUNGGU VERIFIKASI", color: "bg-yellow-500/20 text-yellow-400", icon: <ClockIcon size={10} /> },
      aktif: { text: "KTP AKTIF", color: "bg-green-500/20 text-green-400", icon: <CheckCircle size={10} /> },
      ditolak: { text: "DITOLAK", color: "bg-red-500/20 text-red-400", icon: <XCircle size={10} /> },
    };
    const config = statusConfig[ktpStatus] || statusConfig.belum_mengajukan;
    
    return (
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-bold ${config.color}`}>
        {config.icon}
        <span>{config.text}</span>
      </div>
    );
  };

  const isFormDisabled = ktpStatus === "menunggu";
  const isNewSubmission = ktpStatus === "belum_mengajukan";

  const getButtonText = () => {
    if (loading) return "PROSES...";
    if (isNewSubmission) return "AJUKAN KTP DIGITAL";
    if (ktpStatus === "ditolak") return "AJUKAN ULANG";
    return "SIMPAN PERUBAHAN";
  };

  const baseInputClass = `w-full pl-10 pr-4 py-2.5 rounded-xl border transition-all outline-none text-sm`;
  const inputClass = `${baseInputClass} ${isMalam
    ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500/50"
    : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-orange-500 shadow-sm"
  }`;
  const inputDisabledClass = `${baseInputClass} opacity-60 cursor-not-allowed ${isMalam
    ? "bg-black/30 border-white/5 text-white/40"
    : "bg-slate-100 border-slate-200 text-slate-400"
  }`;
  const inputErrorClass = `${baseInputClass} border-red-500 ${isMalam ? "bg-red-500/10 text-red-200" : "bg-red-50 text-red-900"}`;

  const getUsernameClass = () => {
    if (isFormDisabled) return inputDisabledClass;
    if (usernameLocked && formData.username === originalUsername) return inputDisabledClass;
    return usernameError ? inputErrorClass : inputClass;
  };

  const getPlaceholder = () => {
    if (isLoadingProfile) return "Memuat...";
    if (originalUsername) return `@${originalUsername}`;
    return "Username Unik";
  };

  if (isLoadingProfile) {
    return (
      <div className={`w-full max-w-[400px] p-6 rounded-2xl border backdrop-blur-xl flex items-center justify-center min-h-[500px]
        ${isMalam ? "bg-slate-950/90 border-white/10" : "bg-white border-slate-200 shadow-xl"}`}>
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className={`text-xs ${isMalam ? "text-white/50" : "text-slate-400"}`}>Memuat profil...</p>
        </div>
      </div>
    );
  }

  const hasLocation = formData.alamat || formData.desa || formData.kabupaten;

  return (
    <div className={`w-full max-w-[400px] p-5 rounded-2xl border backdrop-blur-xl
      ${isMalam ? "bg-slate-950/90 border-white/10" : "bg-white border-slate-200 shadow-xl"}`}>
      
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className={`text-base font-bold ${isMalam ? "text-white" : "text-slate-900"}`}>
            {isNewSubmission ? "AJUKAN KTP DIGITAL" : "PROFIL WARGA"}
          </h3>
          <p className={`text-[8px] font-semibold uppercase tracking-wider mt-0.5
            ${isMalam ? "text-orange-500/60" : "text-orange-600"}`}>
            SETEMPAT.ID
          </p>
        </div>
        <StatusBadge />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Foto Profile */}
        <div className="flex items-center gap-3 pb-2">
          <div className="relative">
            {avatarPreview ? (
              <img src={avatarPreview} className="w-14 h-14 rounded-full object-cover border-2 border-orange-500" alt="avatar" />
            ) : (
              <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 border-orange-500
                ${isMalam ? "bg-slate-800" : "bg-slate-100"}`}>
                <User size={24} className="text-orange-500" />
              </div>
            )}
            {!isFormDisabled && (
              <label className="absolute -bottom-1 -right-1 p-1 rounded-full bg-orange-500 cursor-pointer shadow-lg">
                <Camera size={10} className="text-white" />
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </label>
            )}
          </div>
          <div className="flex-1">
            <p className={`text-[9px] font-medium ${isMalam ? "text-white/60" : "text-slate-500"}`}>
              Foto Profil
            </p>
            <p className={`text-[7px] ${isMalam ? "text-white/25" : "text-slate-400"}`}>
              {avatarPreview ? "Klik kamera untuk ganti" : "Kosongkan jika pakai foto Google"}
            </p>
          </div>
        </div>

        {/* Username */}
        <div className="relative">
          <AtSign size="14" className="absolute left-3 top-2.5 text-orange-500" />
          <input
            type="text"
            placeholder={getPlaceholder()}
            value={formData.username}
            onChange={handleUsernameChange}
            className={getUsernameClass()}
            disabled={isFormDisabled || (usernameLocked && formData.username === originalUsername)}
            required
          />
          {originalUsername && !usernameError && !isCheckingUsername && !isFormDisabled && (
            <div className="absolute right-2 top-1.5">
              <div className={`text-[7px] font-mono px-1 py-0.5 rounded ${isMalam ? "bg-orange-500/20 text-orange-400" : "bg-orange-100 text-orange-700"}`}>
                aktif
              </div>
            </div>
          )}
          {usernameLocked && (
            <p className="text-[8px] mt-0.5 ml-3 text-orange-500">Ganti: {daysRemaining} hari lagi</p>
          )}
          {usernameError && <p className="text-[8px] mt-0.5 ml-3 text-red-500">{usernameError}</p>}
        </div>

        {/* Nama Lengkap */}
        <div className="relative">
          <User size="14" className="absolute left-3 top-2.5 text-orange-500" />
          <input
            type="text"
            placeholder="Nama Lengkap"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            className={isFormDisabled ? inputDisabledClass : inputClass}
            disabled={isFormDisabled}
            required
          />
        </div>

        {/* Usia */}
        <div className="relative">
          <Calendar size="14" className="absolute left-3 top-2.5 text-orange-500" />
          <input
            type="number"
            placeholder="Usia (tahun)"
            value={formData.usia}
            onChange={handleUsiaChange}
            className={usiaError ? inputErrorClass : (isFormDisabled ? inputDisabledClass : inputClass)}
            disabled={isFormDisabled}
            min="17"
            max="100"
            required
          />
          {usiaError && <p className="text-[8px] mt-0.5 ml-3 text-red-500">{usiaError}</p>}
        </div>

        {/* Profesi */}
        <div className="relative">
          <Briefcase size="14" className="absolute left-3 top-2.5 text-orange-500" />
          <input
            type="text"
            placeholder="Profesi (contoh: Tukang Las, Montir, Jahit)"
            value={formData.profesi}
            onChange={(e) => setFormData({ ...formData, profesi: e.target.value })}
            className={isFormDisabled ? inputDisabledClass : inputClass}
            disabled={isFormDisabled}
            required
          />
        </div>

        {/* WhatsApp */}
        <div className="relative">
          <Phone size="14" className="absolute left-3 top-2.5 text-orange-500" />
          <input
            type="tel"
            placeholder="Nomor WhatsApp"
            value={formData.whatsapp}
            onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
            className={isFormDisabled ? inputDisabledClass : inputClass}
            disabled={isFormDisabled}
            required
          />
        </div>

        {/* LOKASI SECTION */}
        <div className="space-y-2">
          {/* Tombol GPS */}
          <button
            type="button"
            onClick={getCurrentLocation}
            disabled={isGettingLocation || isFormDisabled}
            className={`w-full py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all
              ${isGettingLocation || isFormDisabled
                ? "bg-slate-700 text-white/40 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-md"
              }`}
          >
            {isGettingLocation ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Navigation size={16} />
            )}
            {isGettingLocation ? "Mendapatkan lokasi..." : "📍 Gunakan Lokasi Saya"}
          </button>
          
          {locationError && (
            <p className="text-[8px] text-center text-red-500">{locationError}</p>
          )}

          {/* Hasil Lokasi */}
          {hasLocation && !isEditingLocation && (
            <div className={`p-2 rounded-lg ${isMalam ? "bg-green-500/10 border border-green-500/20" : "bg-green-50 border border-green-200"}`}>
              <div className="flex items-center gap-1 mb-1">
                <MapPin size={10} className="text-green-500" />
                <p className={`text-[8px] font-medium ${isMalam ? "text-green-400" : "text-green-700"}`}>
                  {isUsingGps ? "📍 Lokasi dari GPS:" : "📍 Lokasi:"}
                </p>
              </div>
              <p className={`text-[9px] ${isMalam ? "text-white/70" : "text-slate-700"}`}>
                {formData.alamat && `${formData.alamat}, `}
                {formData.desa && `${formData.desa}, `}
                {formData.kecamatan && `${formData.kecamatan}, `}
                {formData.kabupaten}
              </p>
              {!isFormDisabled && (
                <button
                  type="button"
                  onClick={() => setIsEditingLocation(true)}
                  className="text-[8px] text-blue-500 hover:text-blue-400 flex items-center justify-center gap-1 w-full mt-1"
                >
                  <Edit2 size={10} />
                  Edit manual jika tidak sesuai
                </button>
              )}
            </div>
          )}

          {/* Form Edit Manual */}
          {isEditingLocation && !isFormDisabled && (
            <div className="space-y-2 p-3 rounded-lg border border-blue-500/30 bg-blue-500/5">
              <div className="flex items-center justify-between">
                <p className="text-[8px] text-blue-500 font-medium">Edit lokasi manual:</p>
                <button
                  type="button"
                  onClick={() => setIsEditingLocation(false)}
                  className="text-[8px] text-slate-400 hover:text-slate-500"
                >
                  ✕
                </button>
              </div>
              
              <div className="relative">
                <MapPin size="12" className="absolute left-2 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Alamat (Jalan / Dusun)"
                  value={formData.alamat}
                  onChange={(e) => {
                    setFormData({ ...formData, alamat: e.target.value });
                    setIsUsingGps(false);
                  }}
                  className={`w-full pl-7 pr-2 py-1.5 rounded-lg border text-xs
                    ${isMalam ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <MapPin size="12" className="absolute left-2 top-2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Desa"
                    value={formData.desa}
                    onChange={(e) => {
                      setFormData({ ...formData, desa: e.target.value });
                      setIsUsingGps(false);
                    }}
                    className={`w-full pl-7 pr-2 py-1.5 rounded-lg border text-xs
                      ${isMalam ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`}
                  />
                </div>
                <div className="relative">
                  <MapPin size="12" className="absolute left-2 top-2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Kecamatan"
                    value={formData.kecamatan}
                    onChange={(e) => {
                      setFormData({ ...formData, kecamatan: e.target.value });
                      setIsUsingGps(false);
                    }}
                    className={`w-full pl-7 pr-2 py-1.5 rounded-lg border text-xs
                      ${isMalam ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`}
                  />
                </div>
              </div>
              
              <div className="relative">
                <MapPin size="12" className="absolute left-2 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Kabupaten"
                  value={formData.kabupaten}
                  onChange={(e) => {
                    setFormData({ ...formData, kabupaten: e.target.value });
                    setIsUsingGps(false);
                  }}
                  className={`w-full pl-7 pr-2 py-1.5 rounded-lg border text-xs
                    ${isMalam ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`}
                />
              </div>
              
              <button
                type="button"
                onClick={() => setIsEditingLocation(false)}
                className="w-full py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-medium"
              >
                Selesai Edit
              </button>
            </div>
          )}
        </div>

        {/* Status Message */}
        {ktpStatus === "menunggu" && (
          <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <p className={`text-[9px] text-center ${isMalam ? "text-yellow-400" : "text-yellow-600"}`}>
              ⏳ Pengajuan sedang diverifikasi. Mohon tunggu maksimal 1x24 jam.
            </p>
          </div>
        )}

        {ktpStatus === "ditolak" && (
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className={`text-[9px] text-center ${isMalam ? "text-red-400" : "text-red-600"}`}>
              ❌ Pengajuan ditolak. Silakan perbaiki data dan ajukan ulang.
            </p>
          </div>
        )}

        {ktpStatus === "aktif" && (
          <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className={`text-[9px] text-center ${isMalam ? "text-green-400" : "text-green-600"}`}>
              ✅ KTP Digital aktif! Anda bisa mengedit data profil.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !!usernameError || !!usiaError || isFormDisabled}
          className={`w-full py-2.5 rounded-xl font-bold text-[10px] tracking-wide transition-all active:scale-95 flex items-center justify-center gap-2 mt-2
            ${(loading || !!usernameError || !!usiaError || isFormDisabled) 
              ? "bg-slate-700 text-white/30 cursor-not-allowed" 
              : "bg-orange-600 hover:bg-orange-500 text-white shadow-md"}`}
        >
          {loading ? (
            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save size={12} />
          )}
          {getButtonText()}
        </button>
      </form>

      <p className={`text-[7px] text-center mt-3 ${isMalam ? "text-white/20" : "text-slate-400"}`}>
  🔒 Data Anda aman dan hanya untuk keperluan layanan Setempat.id
</p>
    </div>
  );
}