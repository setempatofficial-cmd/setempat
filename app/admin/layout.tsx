'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { 
  LayoutDashboard, ShieldCheck, Users, Package, 
  Store, Truck, Briefcase, LogOut, Menu, X,
  Home, MapPin, ChevronRight, Crown, UserCheck, ChevronDown
} from 'lucide-react';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading, isSuperAdmin, isAdmin, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState(['verifikasi']);

  // Tutup sidebar otomatis saat pindah rute (Penting untuk Mobile)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!loading && !isSuperAdmin && !isAdmin) {
      router.push('/');
    }
  }, [loading, isSuperAdmin, isAdmin, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="relative flex items-center justify-center">
          <div className="absolute animate-ping h-12 w-12 rounded-full bg-purple-400 opacity-20"></div>
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600" />
        </div>
        <p className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Memuat Ruang Kerja...</p>
      </div>
    );
  }

  if (!isSuperAdmin && !isAdmin) return null;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/admin/dashboard', role: 'all' },
    { 
      id: 'verifikasi', 
      label: 'Verifikasi', 
      icon: ShieldCheck, 
      role: 'all',
      isGroup: true, 
      children: [
        { id: 'verifikasi-ktp', label: 'Data KTP', icon: ShieldCheck, href: '/admin/verifikasi/ktp', role: 'superadmin' },
        { id: 'verifikasi-penjual', label: 'Penjual/Bakul', icon: Store, href: '/admin/verifikasi/penjual', role: 'all' },
        { id: 'verifikasi-driver', label: 'Driver Ojek', icon: Truck, href: '/admin/verifikasi/driver', role: 'all' },
        { id: 'verifikasi-rewang', label: 'Jasa Rewang', icon: Briefcase, href: '/admin/verifikasi/rewang', role: 'all' },
      ] 
    },
    { id: 'angkat-rt', label: 'Angkat RT', icon: UserCheck, href: '/admin/angkat-rt', role: 'superadmin' },
    { id: 'users', label: 'Manajemen User', icon: Users, href: '/admin/users', role: 'all' },
  ];

  const toggleGroup = (id) => {
    setOpenGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  const isActive = (href) => pathname === href;

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 overflow-x-hidden">
      
      {/* 1. OVERLAY MOBILE - Diperbaiki logic-nya */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[45]" 
          />
        )}
      </AnimatePresence>

      {/* 2. SIDEBAR - Penyesuaian Lebar & Z-Index */}
      <aside className={`fixed top-0 left-0 z-50 h-screen transition-all duration-300 ease-in-out border-r border-slate-200 bg-white
        ${isSidebarOpen ? 'w-[280px] translate-x-0' : '-translate-x-full md:translate-x-0 md:w-20'}`}>
        
        <div className="flex flex-col h-full">
          {/* Header Sidebar */}
          <div className="h-20 flex items-center px-6 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`shrink-0 p-2 rounded-xl shadow-lg ${isSuperAdmin ? 'bg-purple-600' : 'bg-orange-500'} text-white`}>
                {isSuperAdmin ? <Crown size={20} /> : <ShieldCheck size={20} />}
              </div>
              {(isSidebarOpen || (typeof window !== 'undefined' && window.innerWidth < 768)) && (
                <div className="truncate">
                  <h1 className="font-black text-xs uppercase tracking-tight truncate leading-none">
                    {isSuperAdmin ? 'Petinggi Setempat' : 'RT Setempat'}
                  </h1>
                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Admin Panel</p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {menuItems.map((item) => {
              if (item.role === 'superadmin' && !isSuperAdmin) return null;

              if (item.isGroup) {
                return (
                  <div key={item.id} className="space-y-1">
                    {isSidebarOpen && (
                      <button 
                        onClick={() => toggleGroup(item.id)}
                        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                      >
                        {item.label}
                        <ChevronDown size={12} className={`transition-transform ${openGroups.includes(item.id) ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                    
                    <div className="space-y-1">
                      {item.children.map((child) => {
                        if (child.role === 'superadmin' && !isSuperAdmin) return null;
                        const active = isActive(child.href);
                        // Tampilkan anak menu hanya jika grup terbuka ATAU sidebar sedang menciut (md:w-20)
                        if (!openGroups.includes(item.id) && isSidebarOpen) return null;

                        return (
                          <button
                            key={child.id}
                            onClick={() => router.push(child.href)}
                            className={`w-full group flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200
                              ${active ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
                          >
                            <child.icon size={18} className={active ? 'text-white' : 'text-slate-400 group-hover:text-purple-600'} />
                            {isSidebarOpen && <span className="text-sm font-bold truncate">{child.label}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              const active = isActive(item.href);
              return (
                <button
                  key={item.id}
                  onClick={() => router.push(item.href)}
                  className={`w-full group flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200
                    ${active ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                  <item.icon size={18} className={active ? 'text-white' : 'text-slate-400 group-hover:text-purple-600'} />
                  {isSidebarOpen && <span className="text-sm font-bold truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* Footer Sidebar */}
          <div className="p-4 border-t border-slate-100 space-y-1 bg-slate-50/50">
            <button onClick={() => router.push('/')} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-white hover:text-purple-600 transition-all border border-transparent hover:border-slate-200">
              <Home size={18} />
              {isSidebarOpen && <span>Rumah Setempat</span>}
            </button>
            <button onClick={async () => { await logout(); router.push('/'); }} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-rose-500 hover:bg-rose-50 transition-all">
              <LogOut size={18} />
              {isSidebarOpen && <span>Keluar Panel</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* 3. TOMBOL FLOATING MOBILE - Diperbaiki Z-Index & Posisi */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed bottom-8 right-6 z-[60] md:hidden p-5 bg-slate-900 text-white rounded-full shadow-2xl active:scale-90 transition-all border-4 border-white"
      >
        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* 4. MAIN CONTENT - Tambahan Overflow-X Hidden */}
      <main className={`flex-1 transition-all duration-300 ease-in-out min-h-screen w-full
        ${isSidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
        
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            {/* Ruang kosong untuk tombol desktop toggle */}
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-tight ml-2 md:ml-10">
              {menuItems.find(m => isActive(m.href))?.label || 
               menuItems.flatMap(m => m.children || []).find(c => isActive(c.href))?.label || 
               'Panel Admin'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-800 leading-none">{profile?.full_name}</span>
              <span className="text-[8px] font-bold text-emerald-500 uppercase mt-0.5">Online</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
               {profile?.avatar_url ? (
                 <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center bg-purple-100 text-purple-600 font-bold text-[10px]">
                   {profile?.full_name?.charAt(0)}
                 </div>
               )}
            </div>
          </div>
        </header>

        {/* Content Area - Padding disesuaikan agar tidak tertutup tombol floating */}
        <div className="p-4 md:p-8 pb-24 md:pb-8">
          {children}
        </div>
      </main>

      {/* 5. DESKTOP TOGGLE BUTTON - Diperbaiki posisinya */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={`hidden md:flex fixed z-[60] top-7 transition-all duration-300 bg-white border border-slate-200 p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:shadow-md
          ${isSidebarOpen ? 'left-[265px]' : 'left-[65px]'}`}
      >
        <ChevronRight size={14} className={`transition-transform duration-300 ${isSidebarOpen ? 'rotate-180' : ''}`} />
      </button>

    </div>
  );
}