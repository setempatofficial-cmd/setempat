// components/UploadModal.jsx - FULLY OPTIMIZED WITH UPLOADERADMIN
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Search, MapPin, Camera, Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import UploaderAdmin from "./UploaderAdmin"; // ← IMPORT UPLOADERADMIN

// ========== CONSTANTS ==========
const ALLOWED_ROLES = ["superadmin", "admin"];
const SEARCH_LIMIT = 100;

export default function UploadModal({ isOpen, onClose, userId, userRole }) {
  const router = useRouter();
  
  // ========== STATE ==========
  const [tempatList, setTempatList] = useState([]);
  const [selectedTempat, setSelectedTempat] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeLabel, setTimeLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const abortControllerRef = useRef(null);

  // ========== VALIDASI AKSES ==========
  useEffect(() => {
    const hasAccess = userId && ALLOWED_ROLES.includes(userRole?.toLowerCase());
    setIsAuthorized(hasAccess);
    if (!hasAccess && isOpen) {
      setErrorMessage("Akses ditolak. Hanya Super Admin dan Admin yang dapat mengupload foto official.");
    }
  }, [userId, userRole, isOpen]);

  // ========== SET TIME LABEL ==========
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) setTimeLabel("pagi");
    else if (hour >= 11 && hour < 15) setTimeLabel("siang");
    else if (hour >= 15 && hour < 18) setTimeLabel("sore");
    else setTimeLabel("malam");
  }, []);

  // ========== LOAD TEMPAT ==========
  useEffect(() => {
    if (!isOpen || !isAuthorized) return;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    const loadTempat = async () => {
      setLoading(true);
      setErrorMessage("");
      
      try {
        const { data, error } = await supabase
          .from("tempat")
          .select("id, name, category, alamat")
          .order("name", { ascending: true })
          .limit(SEARCH_LIMIT)
          .abortSignal(abortControllerRef.current.signal);
        
        if (error) throw error;
        if (data) setTempatList(data);
        
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error("Load tempat error:", err);
          setErrorMessage("Gagal memuat daftar tempat");
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadTempat();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isOpen, isAuthorized]);

  // ========== FILTER TEMPAT ==========
  const filteredTempat = searchQuery.trim() 
    ? tempatList.filter(item => {
        const term = searchQuery.toLowerCase();
        return item.name?.toLowerCase().includes(term) ||
               item.category?.toLowerCase().includes(term) ||
               item.alamat?.toLowerCase().includes(term);
      })
    : [];

  const handleRefreshNeeded = useCallback(() => {
    setRefreshKey(prev => prev + 1);
    window.dispatchEvent(new CustomEvent("refresh-photoslider"));
    window.dispatchEvent(new CustomEvent("laporan-updated"));
    window.dispatchEvent(new CustomEvent("refresh-feed"));
  }, []);

  const handleClose = () => {
    setSelectedTempat(null);
    setSearchQuery("");
    setErrorMessage("");
    onClose();
  };

  if (!isOpen) return null;

  // ========== TAMPILAN UNAUTHORIZED ==========
  if (!isAuthorized) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <div className="w-full max-w-sm bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
          <div className="flex justify-between items-center p-4 border-b border-white/10">
            <h3 className="text-white font-semibold">Akses Ditolak</h3>
            <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-full transition">
              <X size={20} className="text-white/60" />
            </button>
          </div>
          <div className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <ShieldAlert size={32} className="text-red-400" />
            </div>
            <p className="text-white font-medium mb-2">Akses Tidak Diizinkan</p>
            <p className="text-white/40 text-sm mb-4">
              Halaman ini hanya dapat diakses oleh Super Admin dan Admin yang ditunjuk.
            </p>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl text-sm font-medium"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // ========== TAMPILAN UTAMA ==========
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="w-full max-w-md bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold">Upload Official Photo</h3>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
              {userRole === "superadmin" ? "SUPER ADMIN" : "ADMIN"}
            </span>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-full transition">
            <X size={20} className="text-white/60" />
          </button>
        </div>

        <div className="p-4 max-h-[80vh] overflow-y-auto space-y-4">
          
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl">
              <p className="text-red-400 text-xs">{errorMessage}</p>
            </div>
          )}

          {/* PENCARIAN TEMPAT */}
          {!selectedTempat ? (
            <>
              <div>
                <label className="text-xs text-white/40 font-medium mb-1 block">Cari Tempat</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ketik nama tempat..."
                    className="w-full pl-9 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-orange-500/50"
                    autoFocus
                  />
                </div>
                
                {/* Hasil pencarian */}
                {searchQuery && (
                  <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                    {loading ? (
                      <div className="p-4 text-center text-white/40 text-sm">
                        <Loader2 size={16} className="animate-spin inline mr-2" />
                        Memuat...
                      </div>
                    ) : filteredTempat.length === 0 ? (
                      <div className="p-4 text-center text-white/40 text-sm">
                        Tidak ada tempat ditemukan
                      </div>
                    ) : (
                      filteredTempat.map((tempat) => (
                        <button
                          key={tempat.id}
                          onClick={() => {
                            setSelectedTempat(tempat);
                            setSearchQuery("");
                            setErrorMessage("");
                          }}
                          className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition text-left"
                        >
                          <MapPin size={16} className="text-orange-400 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-white text-sm font-medium truncate">{tempat.name}</div>
                            <div className="text-white/40 text-xs truncate">{tempat.category || tempat.alamat}</div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            // ========== UPLOADERADMIN INTEGRATION ==========
            <div className="space-y-4">
              {/* Tempat Terpilih */}
              <div className="flex items-center gap-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                <MapPin size={16} className="text-orange-400" />
                <div className="flex-1">
                  <div className="text-white text-sm font-medium">{selectedTempat.name}</div>
                  <div className="text-white/40 text-xs">{selectedTempat.category}</div>
                </div>
                <button
                  onClick={() => setSelectedTempat(null)}
                  className="text-xs text-white/40 hover:text-white"
                >
                  Ganti Tempat
                </button>
              </div>

              {/* UPLOADERADMIN COMPONENT */}
              <UploaderAdmin 
                key={refreshKey}
                tempatId={selectedTempat.id}
                timeLabel={timeLabel}
                onRefreshNeeded={handleRefreshNeeded}
              />

              {/* Catatan untuk admin */}
              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-[10px] text-white/30 text-center">
                  Foto akan muncul di slot {timeLabel} dan menjadi foto utama tempat
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}