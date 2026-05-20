'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/context/AuthContext';
import { motion } from 'framer-motion';
import { 
  Users, Store, Truck, Briefcase, ShieldCheck,
  ShoppingBag, Package, MessageSquare, Clock,
  Crown, MapPin, AlertCircle, ChevronRight, TrendingUp
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const { profile, isSuperAdmin, isAdmin } = useAuth(); // Menggunakan nama role dari context sebelumnya
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPenjual: 0,
    totalDriver: 0,
    totalRewang: 0,
    pendingKtp: 0,
    pendingPenjual: 0,
    pendingDriver: 0,
    pendingRewang: 0,
    totalTransaksiHariIni: 0,
    totalProduk: 0,
    sambatanAktif: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Query Builder dasar
      let userQuery = supabase.from('profiles').select('id', { count: 'exact', head: true });
      let penjualQuery = supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_seller', true);
      let driverQuery = supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_driver', true);
      let rewangQuery = supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_rewang', true);
      let ktpQuery = supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('ktp_status', 'menunggu');
      let penjualDaftarQuery = supabase.from('pendaftar_bakul').select('*', { count: 'exact', head: true }).eq('status', 'menunggu');
      let driverDaftarQuery = supabase.from('pendaftar_ojek').select('*', { count: 'exact', head: true }).eq('status', 'menunggu');
      let rewangDaftarQuery = supabase.from('pendaftar_rewang').select('*', { count: 'exact', head: true }).eq('status', 'menunggu');
      let transaksiQuery = supabase.from('pesanan').select('*', { count: 'exact', head: true }).gte('created_at', new Date().toISOString().split('T')[0]);
      let produkQuery = supabase.from('produk').select('*', { count: 'exact', head: true }).eq('is_active', true);
      let sambatanQuery = supabase.from('sambatan').select('*', { count: 'exact', head: true }).eq('status', 'aktif');

      // Filter Wilayah untuk Admin/RT
     if (!isSuperAdmin && isAdmin && profile?.wilayah_rt) {
        const wilayah = profile.wilayah_rt;
        userQuery = userQuery.eq('desa', wilayah);
        penjualQuery = penjualQuery.eq('desa', wilayah);
        driverQuery = driverQuery.eq('desa', wilayah);
        rewangQuery = rewangQuery.eq('desa', wilayah);
        ktpQuery = ktpQuery.eq('desa', wilayah);
        penjualDaftarQuery = penjualDaftarQuery.eq('desa', wilayah);
        driverDaftarQuery = driverDaftarQuery.eq('desa', wilayah);
        rewangDaftarQuery = rewangDaftarQuery.eq('desa', wilayah);
        produkQuery = produkQuery.eq('desa', wilayah);
        sambatanQuery = sambatanQuery.eq('lokasi_detail', wilayah);
      }

      const results = await Promise.all([
        userQuery, penjualQuery, driverQuery, rewangQuery,
        ktpQuery, penjualDaftarQuery, driverDaftarQuery, rewangDaftarQuery,
        transaksiQuery, produkQuery, sambatanQuery
      ]);

      setStats({
        totalUsers: results[0].count || 0,
        totalPenjual: results[1].count || 0,
        totalDriver: results[2].count || 0,
        totalRewang: results[3].count || 0,
        pendingKtp: results[4].count || 0,
        pendingPenjual: results[5].count || 0,
        pendingDriver: results[6].count || 0,
        pendingRewang: results[7].count || 0,
        totalTransaksiHariIni: results[8].count || 0,
        totalProduk: results[9].count || 0,
        sambatanAktif: results[10].count || 0
      });
    } catch (err) {
      console.error('Fetch Stats Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-600 mb-4" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sinkronisasi Data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      
      {/* 1. Header & Welcome Area */}
      <section className="relative overflow-hidden bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
               <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-[10px] font-black uppercase tracking-widest text-purple-300">
                 {isSuperAdmin ? 'Akses Petinggi' : 'Akses RT'}
               </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">
              Halo, {profile?.full_name?.split(' ')[0] || 'Admin'}! 👋
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-md">
              Berikut adalah ringkasan aktivitas di wilayah <span className="text-white font-bold">{profile?.wilayah_rt || 'Pusat'}</span> hari ini.
            </p>
          </div>
          <div className="flex gap-3">
             <div className="p-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Transaksi</p>
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-emerald-400" />
                  <span className="text-xl font-black">{stats.totalTransaksiHariIni}</span>
                </div>
             </div>
             <div className="p-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Warga</p>
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-blue-400" />
                  <span className="text-xl font-black">{stats.totalUsers}</span>
                </div>
             </div>
          </div>
        </div>
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-purple-600/20 blur-[100px] rounded-full" />
      </section>

      {/* 2. Priority Alerts (Verifikasi) */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <AlertCircle size={18} className="text-amber-500" />
            Perlu Tindakan
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {isSuperAdmin && (
            <PendingCard title="KTP Warga" count={stats.pendingKtp} color="purple" href="/admin/verifikasi/ktp" />
          )}
          <PendingCard title="Pendaftar Bakul" count={stats.pendingPenjual} color="orange" href="/admin/verifikasi/penjual" />
          <PendingCard title="Pendaftar Ojek" count={stats.pendingDriver} color="emerald" href="/admin/verifikasi/driver" />
          <PendingCard title="Pendaftar Jasa" count={stats.pendingRewang} color="rose" href="/admin/verifikasi/rewang" />
        </div>
      </section>

      {/* 3. Main Statistics Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Kolom Kiri: Layanan Mandiri */}
        <div className="lg:col-span-2 space-y-6">
           <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Statistik Layanan</h2>
           <div className="grid grid-cols-2 gap-4">
             <StatCard title="Penjual Aktif" value={stats.totalPenjual} icon={Store} color="orange" href="/admin/verifikasi/penjual" />
             <StatCard title="Driver Aktif" value={stats.totalDriver} icon={Truck} color="emerald" href="/admin/verifikasi/driver" />
             <StatCard title="Produk Tayang" value={stats.totalProduk} icon={Package} color="blue" href="/admin/produk" />
             <StatCard title="Sambatan/Bantuan" value={stats.sambatanAktif} icon={MessageSquare} color="rose" href="/admin/sambatan" />
           </div>
        </div>

        {/* Kolom Kanan: Info Wilayah */}
        <div className="space-y-6">
           <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Informasi Wilayah</h2>
           <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm relative overflow-hidden group">
              <div className="relative z-10">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <MapPin size={24} />
                </div>
                <h3 className="font-black text-slate-800 text-lg leading-tight uppercase tracking-tighter">
                  {profile?.wilayah_rt || 'Wilayah Belum Diset'}
                </h3>
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  Seluruh data yang ditampilkan terbatas pada cakupan wilayah tanggung jawab Anda sebagai {isAdmin ? 'RT' : 'Petinggi'}.
                </p>
                <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                   <div className="text-[10px] font-bold text-slate-400 uppercase italic">Status Server: Normal</div>
                   <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>
           </div>
        </div>
      </section>

    </div>
  );
}

// --- SUB COMPONENTS ---

function StatCard({ title, value, icon: Icon, color, href }) {
  const colorVariants = {
    orange: "bg-orange-50 text-orange-600 border-orange-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
  };

  return (
    <Link href={href} className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${colorVariants[color].split(' ')[0]} ${colorVariants[color].split(' ')[1]} transition-transform group-hover:rotate-6`}>
          <Icon size={20} />
        </div>
        <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
      </div>
      <p className="text-2xl font-black text-slate-800 tracking-tight">{value}</p>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{title}</p>
    </Link>
  );
}

function PendingCard({ title, count, color, href }) {
  const isActive = count > 0;
  const colorVariants = {
    purple: "text-purple-600 bg-purple-50",
    orange: "text-orange-600 bg-orange-50",
    emerald: "text-emerald-600 bg-emerald-50",
    rose: "text-rose-600 bg-rose-50",
  };

  return (
    <Link href={href} 
      className={`relative overflow-hidden flex flex-col p-5 rounded-[1.5rem] border transition-all 
      ${isActive 
        ? 'border-amber-200 bg-white shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/10' 
        : 'border-slate-100 bg-white opacity-60 hover:opacity-100'}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${colorVariants[color]}`}>
          <Clock size={16} />
        </div>
        {isActive && (
          <span className="flex h-2 w-2 rounded-full bg-amber-500 ring-4 ring-amber-100 animate-pulse" />
        )}
      </div>
      <p className="text-[11px] font-black text-slate-500 uppercase tracking-tighter">{title}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={`text-3xl font-black ${isActive ? 'text-amber-600' : 'text-slate-300'}`}>{count}</span>
        <span className="text-[10px] font-bold text-slate-400">Berkas</span>
      </div>
      {isActive && (
         <div className="mt-3 py-1 text-center bg-amber-500 rounded-lg">
           <span className="text-[9px] font-black text-white uppercase tracking-widest">Butuh Verifikasi</span>
         </div>
      )}
    </Link>
  );
}