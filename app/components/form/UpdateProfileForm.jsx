"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { 
  Save, User, MapPin, Briefcase, Phone, AtSign, 
  Clock, ShieldCheck, Info, Camera, CheckCircle, XCircle, Calendar,
  Navigation, Loader2, Edit2, RefreshCw, WifiOff, AlertCircle 
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
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [usiaError, setUsiaError] = useState("");
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [isUsingGps, setIsUsingGps] = useState(false);
  const [locationSuccess, setLocationSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    username: "",
    full_name: "",
    usia: "",
    phone: "",
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

  // Geocoding dengan retry
  const geocodeAddress = async (alamat, desa, kecamatan, kabupaten, retryCount = 0) => {
    try {
      const fullAddress = `${alamat}, ${desa}, ${kecamatan}, ${kabupaten}, Indonesia`;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`,
        {
          headers: {
            'User-Agent': 'Setempat.id App/1.0'
          }
        }
      );
      const data = await response.json();
      if (data && data[0]) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon)
        };
      }
      if (retryCount < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return geocodeAddress(alamat, desa, kecamatan, kabupaten, retryCount + 1);
      }
      return null;
    } catch (error) {
      console.error("Geocoding error:", error);
      return null;
    }
  };

  const reverseGeocode = async (lat, lng, retryCount = 0) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'Setempat.id App/1.0'
          }
        }
      );
      const data = await response.json();
      if (data && data.address) {
        return {
          alamat: data.address.road || data.address.hamlet || data.address.village || "",
          desa: data.address.village || data.address.hamlet || data.address.suburb || "",
          kecamatan: data.address.county || data.address.district || "",
          kabupaten: data.address.city || data.address.town || data.address.municipality || data.address.region || "",
        };
      }
      if (retryCount < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return reverseGeocode(lat, lng, retryCount + 1);
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
    setLocationSuccess(false);
    
    if (!navigator.geolocation) {
      setLocationError("Browser tidak mendukung GPS");
      setIsGettingLocation(false);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Tampilkan loading saat reverse geocode
        setLocationError("Mendapatkan alamat...");
        
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
          setLocationSuccess(true);
          setLocationError("");
          
          // Hilangkan notifikasi sukses setelah 3 detik
          setTimeout(() => setLocationSuccess(false), 3000);
        } else {
          // Jika reverse geocode gagal, tetap simpan koordinatnya
          setFormData(prev => ({
            ...prev,
            latitude: latitude,
            longitude: longitude,
          }));
          setIsUsingGps(true);
          setLocationError("Alamat tidak ditemukan, silakan isi manual");
        }
        setIsGettingLocation(false);
      },
      (error) => {
        console.error("GPS Error:", error);
        let errorMsg = "Gagal mendapatkan lokasi. ";
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMsg += "Izinkan akses lokasi di pengaturan browser.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg += "Lokasi tidak tersedia. Coba lagi.";
            break;
          case error.TIMEOUT:
            errorMsg += "Waktu habis. Coba lagi.";
            break;
          default:
            errorMsg += "Aktifkan GPS dan coba lagi.";
        }
        setLocationError(errorMsg);
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
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
      setFormData({
        username: currentUsername,
        full_name: data.full_name || profile?.user_metadata?.full_name || "",
        usia: data.usia || "",
        phone: data.phone || data.whatsapp || "",
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
      if (file.size > 2 * 1024 * 1024) {
        alert("Ukuran file maksimal 2MB");
        return;
      }
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
    if (!formData.phone) {
      alert("Nomor WhatsApp wajib diisi");
      return;
    }
    
    // Lokasi wajib untuk Kampung Kita & estimasi ongkir
    if (!formData.latitude || !formData.longitude) {
      if (!formData.alamat || !formData.desa || !formData.kabupaten) {
        alert("⚠️ Lokasi wajib diisi!\n\nKlik '📍 Gunakan Lokasi Saya' untuk mengisi lokasi otomatis.");
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

      // Jika tidak ada koordinat tapi ada alamat, coba geocode
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
        }
      }

      if (!latitude || !longitude) {
        alert("❌ Lokasi tidak valid.\n\nKlik '📍 Gunakan Lokasi Saya' untuk mendapatkan lokasi otomatis.");
        setLoading(false);
        return;
      }

      const updateData = {
        full_name: formData.full_name,
        usia: parseInt(formData.usia),
        phone: formData.phone,
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

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profile.id);

      if (!error) {
        alert("✅ Profil berhasil disimpan!\n\nLokasi Anda akan digunakan untuk menampilkan kegiatan dalam radius 10km.");
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

  // Cek apakah sudah ada lokasi
  const hasLocation = (formData.latitude && formData.longitude) || formData.alamat || formData.desa || formData.kabupaten;
  const hasCompleteLocation = formData.latitude && formData.longitude && formData.kabupaten;

  const baseInputClass = `w-full pl-10 pr-4 py-2.5 rounded-xl border transition-all outline-none text-sm`;
  const inputClass = `${baseInputClass} ${isMalam
    ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500/50"
    : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-orange-500 shadow-sm"
  }`;
  const inputDisabledClass = `${baseInputClass} opacity-60 cursor-not-allowed ${isMalam
    ? "bg-black/30 border-white/5 text-white/40"
    : "bg-slate-100 border-slate-200 text-slate-400"
  }`;

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

  return (
    <div className={`w-full max-w-[400px] p-5 rounded-2xl border backdrop-blur-xl
      ${isMalam ? "bg-slate-950/90 border-white/10" : "bg-white border-slate-200 shadow-xl"}`}>
      
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className={`text-base font-bold ${isMalam ? "text-white" : "text-slate-900"}`}>
            Profil Warga
          </h3>
          <p className={`text-[8px] font-semibold uppercase tracking-wider mt-0.5
            ${isMalam ? "text-orange-500/60" : "text-orange-600"}`}>
            SETEMPAT.ID
          </p>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-bold bg-green-500/10 text-green-500`}>
          <CheckCircle size={10} />
          <span>Aktif</span>
        </div>
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
            <label className="absolute -bottom-1 -right-1 p-1 rounded-full bg-orange-500 cursor-pointer shadow-lg">
              <Camera size={10} className="text-white" />
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </label>
          </div>
          <div className="flex-1">
            <p className={`text-[9px] font-medium ${isMalam ? "text-white/60" : "text-slate-500"}`}>
              Foto Profil
            </p>
            <p className={`text-[7px] ${isMalam ? "text-white/25" : "text-slate-400"}`}>
              Maksimal 2MB
            </p>
          </div>
        </div>

        {/* Username */}
        <div className="relative">
          <AtSign size="14" className="absolute left-3 top-2.5 text-orange-500" />
          <input
            type="text"
            placeholder="Username unik"
            value={formData.username}
            onChange={handleUsernameChange}
            className={usernameLocked && formData.username === originalUsername ? inputDisabledClass : inputClass}
            disabled={usernameLocked && formData.username === originalUsername}
            required
          />
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
            className={inputClass}
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
            className={inputClass}
            min="17"
            max="100"
            required
          />
          {usiaError && <p className="text-[8px] mt-0.5 ml-3 text-red-500">{usiaError}</p>}
        </div>

        {/* WhatsApp */}
        <div className="relative">
          <Phone size="14" className="absolute left-3 top-2.5 text-orange-500" />
          <input
            type="tel"
            placeholder="Nomor WhatsApp"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className={inputClass}
            required
          />
        </div>

        {/* LOKASI SECTION - YANG DISEMPURNAKAN */}
        <div className="space-y-3">
          {/* Header Lokasi */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <MapPin size={12} className="text-orange-500" />
              <p className={`text-[10px] font-medium ${isMalam ? "text-white/60" : "text-slate-500"}`}>
                Lokasi Saya
              </p>
            </div>
            {hasCompleteLocation && (
              <div className="flex items-center gap-1">
                <CheckCircle size={10} className="text-green-500" />
                <span className="text-[7px] text-green-500">Tersimpan</span>
              </div>
            )}
          </div>

          {/* Tombol GPS */}
          <button
            type="button"
            onClick={getCurrentLocation}
            disabled={isGettingLocation}
            className={`w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all
              ${isGettingLocation 
                ? "bg-slate-700 text-white/40 cursor-not-allowed" 
                : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-md"
              }`}
          >
            {isGettingLocation ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Mendapatkan lokasi...</span>
              </>
            ) : (
              <>
                <Navigation size={16} />
                <span>📍 Gunakan Lokasi Saya Saat Ini</span>
              </>
            )}
          </button>

          {/* Notifikasi Sukses */}
          {locationSuccess && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/20 border border-green-500/40 animate-pulse">
              <CheckCircle size={12} className="text-green-500" />
              <p className="text-[8px] text-green-500">Lokasi berhasil didapatkan! Silakan simpan perubahan.</p>
            </div>
          )}

          {/* Error Lokasi */}
          {locationError && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
              <WifiOff size={10} className="text-red-500" />
              <p className="text-[7px] text-red-500 flex-1">{locationError}</p>
              <button type="button" onClick={() => setLocationError("")} className="text-red-500 text-[8px]">✕</button>
            </div>
          )}

          {/* Info Radius */}
          {!hasCompleteLocation && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <Info size={10} className="text-orange-500" />
              <p className="text-[7px] text-orange-500 flex-1">
                Lokasi digunakan untuk akurasi layanan setempat.id
              </p>
            </div>
          )}

          {/* Tampilan Lokasi Tersimpan */}
          {hasLocation && !isEditingLocation && (
            <div className={`p-3 rounded-xl ${isMalam ? "bg-slate-800/50 border border-slate-700" : "bg-slate-50 border border-slate-200"}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <MapPin size={12} className={hasCompleteLocation ? "text-green-500" : "text-orange-500"} />
                  <p className={`text-[8px] font-medium ${hasCompleteLocation ? "text-green-500" : "text-orange-500"}`}>
                    {isUsingGps ? "📍 Lokasi dari GPS" : "📍 Lokasi Manual"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingLocation(true)}
                  className="text-[8px] text-blue-500 hover:text-blue-400 flex items-center gap-1"
                >
                  <Edit2 size={10} />
                  Edit
                </button>
              </div>
              
              <p className={`text-[10px] leading-relaxed ${isMalam ? "text-white/80" : "text-slate-700"}`}>
                {formData.alamat && `${formData.alamat}, `}
                {formData.desa && `${formData.desa}, `}
                {formData.kecamatan && `${formData.kecamatan}, `}
                {formData.kabupaten && `${formData.kabupaten}`}
                {!formData.alamat && !formData.desa && !formData.kabupaten && (
                  <span className="text-white/40">Lokasi koordinat: {formData.latitude?.toFixed(4)}, {formData.longitude?.toFixed(4)}</span>
                )}
              </p>

              {!hasCompleteLocation && (
                <p className="text-[7px] text-orange-500 mt-2 flex items-center gap-1">
                  <AlertCircle size={8} />
                  Lengkapi alamat untuk memudahkan layanan 
                </p>
              )}
            </div>
          )}

          {/* Edit Manual */}
          {isEditingLocation && (
            <div className="space-y-2 p-3 rounded-xl border border-blue-500/30 bg-blue-500/5">
              <div className="flex items-center justify-between">
                <p className="text-[8px] text-blue-500 font-medium flex items-center gap-1">
                  <Edit2 size={10} />
                  Edit lokasi manual:
                </p>
                <div className="flex gap-1">
                  <button 
                    type="button" 
                    onClick={getCurrentLocation}
                    className="text-[8px] text-blue-500 hover:text-blue-400 flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10"
                  >
                    <RefreshCw size={8} />
                    GPS
                  </button>
                  <button type="button" onClick={() => setIsEditingLocation(false)} className="text-[8px] text-slate-400 px-2 py-0.5">✕</button>
                </div>
              </div>
              
              <input 
                type="text" 
                placeholder="Nama jalan / Alamat" 
                value={formData.alamat} 
                onChange={(e) => { setFormData({ ...formData, alamat: e.target.value }); setIsUsingGps(false); }} 
                className={`w-full p-2 rounded-lg border text-xs ${isMalam ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200"}`} 
              />
              
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="text" 
                  placeholder="Desa / Kelurahan" 
                  value={formData.desa} 
                  onChange={(e) => { setFormData({ ...formData, desa: e.target.value }); setIsUsingGps(false); }} 
                  className={`w-full p-2 rounded-lg border text-xs ${isMalam ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200"}`} 
                />
                <input 
                  type="text" 
                  placeholder="Kecamatan" 
                  value={formData.kecamatan} 
                  onChange={(e) => { setFormData({ ...formData, kecamatan: e.target.value }); setIsUsingGps(false); }} 
                  className={`w-full p-2 rounded-lg border text-xs ${isMalam ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200"}`} 
                />
              </div>
              
              <input 
                type="text" 
                placeholder="Kabupaten / Kota" 
                value={formData.kabupaten} 
                onChange={(e) => { setFormData({ ...formData, kabupaten: e.target.value }); setIsUsingGps(false); }} 
                className={`w-full p-2 rounded-lg border text-xs ${isMalam ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200"}`} 
              />
              
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsEditingLocation(false)} 
                  className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-medium transition-all"
                >
                  Selesai
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tombol Submit */}
        <button
          type="submit"
          disabled={loading || !!usernameError || !!usiaError}
          className={`w-full py-3 rounded-xl font-bold text-[10px] tracking-wide transition-all active:scale-95 flex items-center justify-center gap-2 mt-4
            ${(loading || !!usernameError || !!usiaError) 
              ? "bg-slate-700 text-white/30 cursor-not-allowed" 
              : "bg-orange-600 hover:bg-orange-500 text-white shadow-md"
            }`}
        >
          {loading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={12} />}
          {loading ? "MENYIMPAN..." : "💾 SIMPAN PERUBAHAN"}
        </button>
      </form>

      <p className={`text-[7px] text-center mt-4 ${isMalam ? "text-white/20" : "text-slate-400"}`}>
        🔒 Data Anda aman. Lokasi digunakan untuk layanan dan fitur di setempat.id
      </p>
    </div>
  );
}