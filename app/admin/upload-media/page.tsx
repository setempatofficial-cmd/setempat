"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  ArrowLeft, Upload, Image, Search, Loader2, 
  CheckCircle, XCircle, AlertCircle 
} from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import UploaderAdmin from "@/components/UploaderAdmin";
import { supabase } from "@/lib/supabaseClient";
import { debounce } from "lodash";

export default function UploadMediaPage() {
  const router = useRouter();
  const { user, isAdmin, isSuperAdmin, loading } = useAuth();
  
  // State
  const [tempatList, setTempatList] = useState([]);
  const [filteredTempat, setFilteredTempat] = useState([]);
  const [selectedTempat, setSelectedTempat] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Cek akses
  useEffect(() => {
    if (!loading && !isAdmin && !isSuperAdmin) {
      router.push("/");
    }
  }, [loading, isAdmin, isSuperAdmin, router]);

  // Fetch initial places (limited)
  useEffect(() => {
    const fetchInitialPlaces = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('tempat')
          .select('id, name, category, alamat')
          .order('name')
          .limit(50);
        
        if (error) throw error;
        setTempatList(data);
        setFilteredTempat(data);
      } catch (err) {
        setError("Gagal memuat data tempat");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    if (isAdmin || isSuperAdmin) {
      fetchInitialPlaces();
    }
  }, [isAdmin, isSuperAdmin]);

  // Search with debounce
  const searchPlaces = useCallback(
    debounce(async (query) => {
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
  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    searchPlaces(query);
  };

  // Handle place selection
  const handleSelectPlace = (place) => {
    setSelectedTempat(place);
    setSearchQuery(place.name);
    setFilteredTempat([]);
  };

  // Handle upload success
  const handleUploadSuccess = () => {
    setUploadSuccess(true);
    setTimeout(() => {
      setUploadSuccess(false);
      // Optional: reset or navigate
    }, 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
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
                Upload Media
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Tambahkan foto atau video ke tempat favorit
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
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
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                        selectedTempat?.id === place.id
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
                    onRefreshNeeded={() => {}}
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
      </div>
    </div>
  );
}