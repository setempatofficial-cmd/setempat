"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Upload,
  Image,
  Search,
  Loader2,
  CheckCircle,
  AlertCircle,
  MapPin,
  PlusCircle,
  Clock,
  Navigation,
  Save,
} from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import UploaderAdmin from "@/components/UploaderAdmin";
import { supabase } from "@/lib/supabaseClient";
import { debounce } from "lodash";

type TabType = 'upload' | 'add';

// --- TIPE DATA ---
interface Tempat {
  id: string;
  name: string;
  category?: string;
  alamat?: string;
}

interface AddFormData {
  name: string;
  category: string;
  alamat: string;
  description: string;
  latitude: string;
  longitude: string;
  jam_buka: string;
}

export default function UploadMediaPage() {
  const router = useRouter();
  const { user, isAdmin, isSuperAdmin, loading } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('upload');

  // Upload tab state
  const [tempatList, setTempatList] = useState<Tempat[]>([]);
  const [filteredTempat, setFilteredTempat] = useState<Tempat[]>([]);
  const [selectedTempat, setSelectedTempat] = useState<Tempat | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Add tempat state
  const [addFormData, setAddFormData] = useState<AddFormData>({
    name: '',
    category: '',
    alamat: '',
    description: '',
    latitude: '',
    longitude: '',
    jam_buka: ''
  });
  const [isAddingPlace, setIsAddingPlace] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Cek akses
  useEffect(() => {
    if (!loading && !isAdmin && !isSuperAdmin) {
      router.push("/");
    }
  }, [loading, isAdmin, isSuperAdmin, router]);

  // Fetch initial places
  useEffect(() => {
    const fetchInitialPlaces = async () => {
      if (!isAdmin && !isSuperAdmin) return;

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('tempat')
          .select('id, name, category, alamat')
          .order('name')
          .limit(50);

        if (error) throw error;
        setTempatList(data || []);
        setFilteredTempat(data || []);
      } catch (err) {
        console.error("Gagal memuat data tempat:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialPlaces();
  }, [isAdmin, isSuperAdmin]);

  // Search with debounce
  const searchPlaces = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setFilteredTempat(tempatList);
        return;
      }

      setIsSearching(true);
      try {
        const { data, error } = await supabase
          .from('tempat')
          .select('id, name, category, alamat')
          .ilike('name', `%${query}%`)
          .limit(30);

        if (error) throw error;
        setFilteredTempat(data || []);
      } catch (err) {
        console.error("Search error:", err);
        setFilteredTempat([]);
      } finally {
        setIsSearching(false);
      }
    }, 500),
    [tempatList]
  );

  // Handle search input
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    searchPlaces(query);
  };

  // Handle place selection
  const handleSelectPlace = (place: Tempat) => {
    setSelectedTempat(place);
    setSearchQuery(place.name);
    setFilteredTempat([]);
  };

  // Handle upload success
  const handleUploadSuccess = () => {
    setUploadSuccess(true);
    setTimeout(() => {
      setUploadSuccess(false);
    }, 3000);
  };

  // --- FUNGSI TAMBAH TEMPAT ---
  const getMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation tidak didukung oleh browser Anda");
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setAddFormData({
          ...addFormData,
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString()
        });
        setGpsLoading(false);
      },
      (error) => {
        alert("Gagal mengambil lokasi: " + error.message);
        setGpsLoading(false);
      }
    );
  };

  const handleAddPlace = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!addFormData.name.trim()) {
      alert("Nama tempat wajib diisi!");
      return;
    }

    if (!addFormData.latitude || !addFormData.longitude) {
      alert("Koordinat lokasi wajib diisi! Gunakan tombol 'Ambil GPS' atau isi manual.");
      return;
    }

    setIsAddingPlace(true);

    try {
      const dataToInsert = {
        name: addFormData.name.trim(),
        category: addFormData.category.trim() || null,
        alamat: addFormData.alamat.trim() || null,
        description: addFormData.description.trim() || null,
        latitude: parseFloat(addFormData.latitude),
        longitude: parseFloat(addFormData.longitude),
        jam_buka: addFormData.jam_buka.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('tempat')
        .insert([dataToInsert]);

      if (error) throw error;

      // Success
      setAddSuccess(true);
      setAddFormData({
        name: '',
        category: '',
        alamat: '',
        description: '',
        latitude: '',
        longitude: '',
        jam_buka: ''
      });

      // Refresh list tempat
      const { data: newData } = await supabase
        .from('tempat')
        .select('id, name, category, alamat')
        .order('name')
        .limit(50);

      if (newData) {
        setTempatList(newData);
        setFilteredTempat(newData);
      }

      setTimeout(() => {
        setAddSuccess(false);
        setActiveTab('upload');
      }, 2000);

    } catch (error: any) {
      console.error("Error detail:", error);

      // Error handling yang lebih baik
      let errorMessage = "Gagal menyimpan data";
      if (error.code === '23505') {
        errorMessage = "Tempat dengan nama ini sudah ada!";
      } else if (error.message) {
        errorMessage = error.message;
      }
      alert(errorMessage);
    } finally {
      setIsAddingPlace(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // Redirect if not admin
  if (!isAdmin && !isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">
                Kelola Media & Tempat
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Upload media atau tambah tempat baru
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white dark:bg-slate-800/50 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'upload'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
          >
            <Upload className="w-4 h-4" />
            Upload Media
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'add'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
          >
            <PlusCircle className="w-4 h-4" />
            Tambah Tempat
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'upload' ? (
          <UploadTab
            selectedTempat={selectedTempat}
            setSelectedTempat={setSelectedTempat}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filteredTempat={filteredTempat}
            isLoading={isLoading}
            isSearching={isSearching}
            handleSearch={handleSearch}
            handleSelectPlace={handleSelectPlace}
            uploadSuccess={uploadSuccess}
            handleUploadSuccess={handleUploadSuccess}
          />
        ) : (
          <AddPlaceTab
            formData={addFormData}
            setFormData={setAddFormData}
            handleSubmit={handleAddPlace}
            getMyLocation={getMyLocation}
            isLoading={isAddingPlace}
            gpsLoading={gpsLoading}
            addSuccess={addSuccess}
          />
        )}
      </div>
    </div>
  );
}

// --- COMPONENT: UPLOAD TAB ---
function UploadTab({
  selectedTempat,
  setSelectedTempat,
  searchQuery,
  setSearchQuery,
  filteredTempat,
  isLoading,
  isSearching,
  handleSearch,
  handleSelectPlace,
  uploadSuccess,
  handleUploadSuccess
}: {
  selectedTempat: Tempat | null;
  setSelectedTempat: (place: Tempat | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredTempat: Tempat[];
  isLoading: boolean;
  isSearching: boolean;
  handleSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSelectPlace: (place: Tempat) => void;
  uploadSuccess: boolean;
  handleUploadSuccess: () => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Panel - Place Selection */}
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-5 sticky top-24">
          <h2 className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-500" />
            Pilih Tempat
          </h2>

          {/* Search Input */}
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Cari tempat..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
            />
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            {isSearching && (
              <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-emerald-500" />
            )}
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto space-y-1.5">
            {isLoading ? (
              <div className="text-center py-8 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p className="text-sm">Memuat tempat...</p>
              </div>
            ) : filteredTempat.length === 0 && searchQuery ? (
              <div className="text-center py-8 text-slate-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Tidak ditemukan</p>
              </div>
            ) : filteredTempat.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Image className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Belum ada tempat</p>
              </div>
            ) : (
              filteredTempat.map((place) => (
                <motion.button
                  key={place.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => handleSelectPlace(place)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all ${selectedTempat?.id === place.id
                      ? "bg-emerald-500/10 dark:bg-emerald-500/20 border-2 border-emerald-500"
                      : "hover:bg-slate-50 dark:hover:bg-slate-700/50 border-2 border-transparent"
                    }`}
                >
                  <p className="font-medium text-slate-800 dark:text-white text-sm">
                    {place.name}
                  </p>
                  {place.category && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {place.category}
                    </p>
                  )}
                  {place.alamat && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {place.alamat}
                    </p>
                  )}
                </motion.button>
              ))
            )}
          </div>

          {/* Selected Place Info */}
          {selectedTempat && (
            <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Tempat dipilih:
              </p>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {selectedTempat.name}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Upload Area */}
      <div className="lg:col-span-2">
        <motion.div
          key={selectedTempat?.id || "empty"}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 min-h-[500px]"
        >
          {uploadSuccess ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                Upload Berhasil!
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                Media berhasil diupload ke {selectedTempat?.name}
              </p>
              <button
                onClick={() => {
                  setUploadSuccess(false);
                  setSelectedTempat(null);
                  setSearchQuery("");
                }}
                className="mt-6 px-6 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors"
              >
                Upload Lagi
              </button>
            </div>
          ) : selectedTempat ? (
            <div>
              <div className="mb-6">
                <h3 className="font-semibold text-slate-800 dark:text-white">
                  Upload ke: {selectedTempat.name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Pilih foto atau video untuk diupload
                </p>
              </div>

              <UploaderAdmin
                tempatId={selectedTempat.id}
                timeLabel="siang"
                onRefreshNeeded={() => { }}
                onSuccess={handleUploadSuccess}
              />

              {/* Tips */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                  💡 Tips Upload:
                </h4>
                <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                  <li>• Gunakan foto dengan resolusi baik (minimal 800x600)</li>
                  <li>• Maksimal ukuran file: 10MB untuk foto, 50MB untuk video</li>
                  <li>• Format yang didukung: JPG, PNG, GIF, MP4, MOV</li>
                  <li>• Foto yang menarik akan meningkatkan vibe count!</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <div className="w-24 h-24 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-6">
                <Upload className="w-10 h-10 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Pilih Tempat Terlebih Dahulu
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                Cari dan pilih tempat dari daftar di sebelah kiri untuk mulai upload media
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// --- COMPONENT: ADD PLACE TAB ---
function AddPlaceTab({
  formData,
  setFormData,
  handleSubmit,
  getMyLocation,
  isLoading,
  gpsLoading,
  addSuccess
}: {
  formData: AddFormData;
  setFormData: (data: AddFormData) => void;
  handleSubmit: (e: React.FormEvent) => void;
  getMyLocation: () => void;
  isLoading: boolean;
  gpsLoading: boolean;
  addSuccess: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6"
    >
      {addSuccess ? (
        <div className="h-full flex flex-col items-center justify-center text-center py-12">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
            Tempat Berhasil Ditambahkan!
          </h3>
          <p className="text-slate-500 dark:text-slate-400">
            {formData.name} telah ditambahkan ke database
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Beralih ke tab Upload untuk menambah media
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nama & Kategori */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1">
                Nama Tempat <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isLoading}
                className="w-full border-b border-slate-200 py-2 focus:border-orange-500 outline-none transition disabled:bg-slate-50 dark:bg-transparent dark:text-white"
                placeholder="Misal: Warung Kopi Pakde"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-slate-400">Kategori</label>
              <input
                type="text"
                disabled={isLoading}
                className="w-full border-b border-slate-200 py-2 focus:border-orange-500 outline-none transition disabled:bg-slate-50 dark:bg-transparent dark:text-white"
                placeholder="Misal: Kuliner, Wisata, Jasa"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
          </div>

          {/* Alamat & Deskripsi */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase text-slate-400">Alamat</label>
              <textarea
                disabled={isLoading}
                className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 dark:bg-slate-700/50 dark:text-white mt-1 disabled:opacity-50"
                rows={2}
                value={formData.alamat}
                onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-slate-400">Deskripsi Singkat</label>
              <textarea
                disabled={isLoading}
                className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 dark:bg-slate-700/50 dark:text-white mt-1 disabled:opacity-50"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>

          {/* Lokasi dengan Tombol Auto-GPS */}
          <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-2xl border border-orange-100 dark:border-orange-800/30 space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase text-orange-600 dark:text-orange-400 flex items-center gap-2">
                <MapPin size={14} /> Koordinat Lokasi <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={getMyLocation}
                disabled={isLoading || gpsLoading}
                className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold shadow-sm hover:bg-orange-600 transition disabled:opacity-50"
              >
                <Navigation size={12} /> {gpsLoading ? 'Mencari...' : 'Ambil GPS'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Latitude"
                value={formData.latitude}
                required
                disabled={isLoading}
                className="bg-white dark:bg-slate-700 p-2 rounded-lg text-sm border border-orange-200 dark:border-orange-800 outline-none focus:border-orange-500 dark:text-white disabled:opacity-50"
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
              />
              <input
                type="text"
                placeholder="Longitude"
                value={formData.longitude}
                required
                disabled={isLoading}
                className="bg-white dark:bg-slate-700 p-2 rounded-lg text-sm border border-orange-200 dark:border-orange-800 outline-none focus:border-orange-500 dark:text-white disabled:opacity-50"
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
              />
            </div>
          </div>

          {/* Jam Buka */}
          <div>
            <label className="text-xs font-bold uppercase text-slate-400 flex items-center gap-2">
              <Clock size={14} /> Jam Buka
            </label>
            <input
              type="text"
              disabled={isLoading}
              placeholder="Misal: 08:00 - 21:00"
              className="w-full border-b border-slate-200 py-2 focus:border-orange-500 outline-none transition mt-1 disabled:bg-slate-50 dark:bg-transparent dark:text-white"
              value={formData.jam_buka}
              onChange={(e) => setFormData({ ...formData, jam_buka: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold shadow-xl hover:bg-orange-600 transition active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Menyimpan...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Save className="w-5 h-5" />
                Simpan Tempat Baru
              </span>
            )}
          </button>
        </form>
      )}
    </motion.div>
  );
}