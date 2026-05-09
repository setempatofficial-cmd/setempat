"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";

// Helper hitung jarak
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default function SolutionRadar({ item, theme, userLocation, radius = 1 }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const [nearbyRewang, setNearbyRewang] = useState([]);
  const [nearbyProducts, setNearbyProducts] = useState([]);

  // Kondisi Deteksi
  const isMacet = item.latest_condition === "MACET" || item.isRamai === true;
  const isDarurat = item.latest_condition === "DARURAT" || item.latest_condition === "KECELAKAAN";

  useEffect(() => {
    if (!item?.latitude || !item?.longitude) return;

    async function fetchNearbySolutions() {
      try {
        setLoading(true);

        // 1. FETCH DRIVERS (Ojek)
        const { data: drivers } = await supabase
          .from('profiles')
          .select('id, full_name, username, phone, motor_info, driver_rating, latitude, longitude, is_driver, driver_status')
          .eq('is_driver', true)
          .eq('driver_status', 'online')
          .not('latitude', 'is', null);

        if (drivers) {
          const filtered = drivers.filter(d => calculateDistance(item.latitude, item.longitude, d.latitude, d.longitude) <= radius)
            .map(d => ({
              id: d.id, type: 'ojek', icon: '🛵', phone: d.phone,
              label: `Ojek: ${d.full_name || d.username}`,
              desc: d.motor_info || 'Siap antar cepat',
              rating: d.driver_rating,
              distance: calculateDistance(item.latitude, item.longitude, d.latitude, d.longitude),
              priority: isMacet ? 2 : 0
            }));
          setNearbyDrivers(filtered);
        }

        // 2. FETCH REWANG (Bantuan Tenaga)
        const { data: rewang } = await supabase
          .from('profiles')
          .select('id, full_name, username, phone, deskripsi_jasa, rating_rewang, latitude, longitude, is_rewang')
          .eq('is_rewang', true)
          .not('latitude', 'is', null);

        if (rewang) {
          const filtered = rewang.filter(r => calculateDistance(item.latitude, item.longitude, r.latitude, r.longitude) <= radius)
            .map(r => ({
              id: r.id, type: 'rewang', icon: '🤝', phone: r.phone,
              label: `Rewang: ${r.full_name || r.username}`,
              desc: r.deskripsi_jasa || 'Siap membantu lokasi',
              distance: calculateDistance(item.latitude, item.longitude, r.latitude, r.longitude),
              priority: isDarurat ? 3 : 1
            }));
          setNearbyRewang(filtered);
        }

        // 3. FETCH PRODUK (UMKM) - FIXED
        const { data: products } = await supabase
          .from('produk')
          .select('id, nama_barang, harga, satuan, deskripsi, kategori, tempat_id, user_id')
          .eq('is_active', true)
          .eq('stok_ready', true);

        if (products && products.length > 0) {
          const { data: tempatList } = await supabase
            .from('tempat')
            .select('id, latitude, longitude');
          const tMap = new Map(tempatList?.map(t => [t.id, t]));

          const filtered = products.filter(p => {
            const t = tMap.get(p.tempat_id);
            return t && calculateDistance(item.latitude, item.longitude, t.latitude, t.longitude) <= radius;
          }).map(p => ({
            id: p.id, 
            type: 'produk', 
            icon: p.kategori === 'minuman' ? '🥤' : '🛍️', 
            label: p.nama_barang, 
            phone: null,
            desc: p.deskripsi || 'Produk warga sekitar',
            harga: p.harga, 
            satuan: p.satuan,
            priority: (isMacet && p.kategori === 'minuman') ? 2 : 0
          }));
          setNearbyProducts(filtered);
        }

      } catch (err) {
        console.error("Error fetching solutions:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchNearbySolutions();
    
    const channel = supabase
      .channel('radar_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'produk' }, fetchNearbySolutions)
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [item, radius, isMacet, isDarurat]);

  // Merge & Sort berdasarkan Prioritas Kondisi
  const allSolutions = useMemo(() => {
    return [...nearbyDrivers, ...nearbyRewang, ...nearbyProducts]
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 4);
  }, [nearbyDrivers, nearbyRewang, nearbyProducts]);

  if (loading) return (
    <div className="animate-pulse space-y-2">
      {[1, 2].map(i => <div key={i} className={`h-16 rounded-2xl ${theme.isMalam ? 'bg-white/5' : 'bg-black/5'}`} />)}
    </div>
  );

  if (allSolutions.length === 0) return null;

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {(isMacet || isDarurat) && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className={`p-3 rounded-2xl border flex items-center gap-3 ${isDarurat ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
            <span className="text-lg">{isDarurat ? '🚨' : '🤖'}</span>
            <p className={`text-[10px] font-black uppercase tracking-tight ${isDarurat ? 'text-red-400' : 'text-amber-400'}`}>
              {isDarurat ? "Kondisi Darurat: Bantuan Rewang & Medis diutamakan" : `Macet Lur: ${nearbyDrivers.length} Ojek Online di sekitar`}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-2">
        {allSolutions.map((sol, idx) => (
          <motion.div key={`${sol.type}-${sol.id}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }}
            className={`flex items-center gap-3 p-3 rounded-2xl border ${theme.isMalam ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/5'}`}>
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-xl shadow-inner">{sol.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-[11px] font-black uppercase truncate">{sol.label}</h4>
                {sol.distance && <span className="text-[8px] opacity-40">{sol.distance.toFixed(1)}km</span>}
              </div>
              <p className="text-[10px] opacity-60 truncate">{sol.desc}</p>
              {sol.harga && <p className="text-[10px] font-bold text-cyan-500 mt-0.5">Rp {sol.harga.toLocaleString()}</p>}
            </div>
            {sol.phone && (
              <button 
                onClick={() => sol.phone && window.open(`https://wa.me/${sol.phone}`, '_blank')}
                className="px-4 py-2 bg-white dark:bg-zinc-800 text-[9px] font-black uppercase rounded-full shadow-md active:scale-90 transition-transform">
                {sol.type === 'ojek' ? 'Pesan' : sol.type === 'produk' ? 'Beli' : 'Bantu'}
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}