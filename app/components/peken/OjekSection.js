'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Search, Phone, MessageSquare, 
  MapPin, Navigation, Star, ShieldCheck, Loader2, Truck
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function OjekSection({ locationName, onBack }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serviceMode, setServiceMode] = useState('passenger'); // 'passenger' | 'delivery'
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Header Scroll Logic - Biar smooth pas nyari driver
  useEffect(() => {
    const controlHeader = () => {
      if (window.scrollY < 20) {
        setShowHeader(true);
      } else if (window.scrollY > lastScrollY) {
        setShowHeader(false);
      } else {
        setShowHeader(true);
      }
      setLastScrollY(window.scrollY);
    };

    window.addEventListener('scroll', controlHeader);
    return () => window.removeEventListener('scroll', controlHeader);
  }, [lastScrollY]);

  // Fetch Drivers
  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      // Ambil profile yang is_driver dan aktif
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, full_name, phone, avatar_url, is_driver, 
          driver_status, motor_info, driver_rating,
          latitude, longitude
        `)
        .eq('is_driver', true)
        // Kita tampilkan yang standby di atas
        .order('driver_status', { ascending: false }) 
        .order('driver_rating', { ascending: false });
      
      if (error) throw error;
      
      const formattedDrivers = data?.map(driver => {
        // Safe split motor_info
        const motorParts = driver.motor_info ? driver.motor_info.split('•') : [];
        
        return {
          id: driver.id,
          nama: driver.full_name || 'Driver Setempat',
          phone: driver.phone,
          avatar: driver.avatar_url,
          status: driver.driver_status || 'offline', // standby, busy, offline
          motor: motorParts[0]?.trim() || 'Motor',
          plat: motorParts[1]?.trim() || '-',
          rating: driver.driver_rating || 5.0,
          lat: driver.latitude,
          lng: driver.longitude,
          lokasi: locationName,
          tarif: 'Mulai 5rb'
        };
      }) || [];
      
      setRiders(formattedDrivers);
    } catch (err) {
      console.error('Gagal ngambil data driver:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRiders = riders.filter(rider =>
    rider.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rider.motor.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const standbyCount = riders.filter(r => r.status === 'standby').length;

  const formatWhatsAppLink = (rider) => {
    if (!rider.phone) return null;
    let cleanPhone = rider.phone.toString().replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
    
    const contextText = serviceMode === 'passenger' ? 'antar saya' : 'kirim barang';
    const message = `Halo Cak ${rider.nama}, saya mau pesan ojek untuk ${contextText} dari ${locationName}. Bisa?`;
    
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="animate-in fade-in duration-500 pb-20 bg-slate-50 min-h-screen">
      
      {/* HEADER SECTION */}
      <div className={`fixed top-0 left-0 right-0 z-[110] transition-all duration-500 ${
        showHeader ? 'translate-y-0' : '-translate-y-[50px]'
      }`}>
        <div className="max-w-[420px] mx-auto bg-white/95 backdrop-blur-lg border-b border-slate-200">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-2">
              <button onClick={onBack} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors">
                <ArrowLeft size={22} className="text-slate-700" />
              </button>
              <div>
                <h3 className="font-black text-slate-900 text-base tracking-tight leading-none uppercase italic">OJEK WARGA</h3>
                <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest mt-1">Layanan Lokal Setempat</p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-700 uppercase">{locationName}</span>
            </div>
          </div>

          <div className="px-6 pb-4 space-y-3">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama driver atau motor..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-2xl text-xs focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
              {['passenger', 'delivery'].map((mode) => (
                <button 
                  key={mode}
                  onClick={() => setServiceMode(mode)}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${
                    serviceMode === mode ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {mode === 'passenger' ? <Navigation size={14} /> : <Truck size={14} />}
                  {mode === 'passenger' ? 'Antar Orang' : 'Kirim Barang'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="pt-44 px-6 space-y-4 max-w-[420px] mx-auto">
        
        {/* BANNER STATUS */}
        <div className="bg-emerald-600 p-5 rounded-[32px] text-white shadow-xl shadow-emerald-900/10 relative overflow-hidden">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase opacity-80 tracking-widest">Driver Terdekat</p>
              <h4 className="text-sm font-black mt-1">
                {standbyCount > 0 ? `${standbyCount} Driver Siap Meluncur!` : 'Driver sedang sibuk semua'}
              </h4>
            </div>
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
              <Navigation size={24} className="animate-bounce" />
            </div>
          </div>
          {/* Decorative Circle */}
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
        </div>

        {/* DRIVER LIST */}
        {loading ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <Loader2 size={32} className="animate-spin text-emerald-500" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Golek Driver...</p>
          </div>
        ) : filteredRiders.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-[32px] border border-slate-100">
            <Search size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500 font-bold text-sm">Driver ra ketemu, Lur.</p>
            <p className="text-slate-400 text-[10px] mt-1 italic">Coba ganti kata kunci pencarian.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRiders.map((rider) => (
              <div key={rider.id} className="group bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 border-2 border-slate-50">
                        {rider.avatar ? (
                          <img src={rider.avatar} alt={rider.nama} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-black text-xl">
                            {rider.nama.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className={`absolute -right-1 -bottom-1 w-4 h-4 rounded-full border-2 border-white ${
                        rider.status === 'standby' ? 'bg-emerald-500' : 'bg-orange-400'
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-slate-900 text-sm uppercase">{rider.nama}</h4>
                        <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-50 rounded-lg">
                          <Star size={10} fill="#f97316" className="text-orange-500" />
                          <span className="text-[10px] font-black text-orange-600">{rider.rating}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold mt-0.5 uppercase tracking-tighter">
                        {rider.motor} <span className="text-slate-300 mx-1">•</span> {rider.plat}
                      </p>
                    </div>
                  </div>
                  
                  <div className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter ${
                    rider.status === 'standby' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                  }`}>
                    {rider.status === 'standby' ? 'Standby' : 'On Trip'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <MapPin size={12} className="text-slate-400" />
                    <span className="text-[9px] font-bold text-slate-600 truncate">{rider.lokasi}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <ShieldCheck size={12} className="text-emerald-500" />
                    <span className="text-[9px] font-bold text-slate-600">Tarif Warga</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => window.open(formatWhatsAppLink(rider), '_blank')}
                    className="flex-1 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
                  >
                    <MessageSquare size={14} /> Chat WA
                  </button>
                  <button 
                    onClick={() => handleCall(rider)}
                    className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-200"
                  >
                    <Phone size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <footer className="py-10 text-center">
          <p className="text-[10px] text-slate-400 font-bold italic px-10 leading-relaxed uppercase">
            {serviceMode === 'passenger' 
              ? "Tarif ojek disepakati langsung dengan driver. Tetap waspada & hati-hati di jalan nggih."
              : "Pastikan barang yang dikirim tidak melanggar hukum. Keamanan barang tanggung jawab bersama."}
          </p>
        </footer>
      </div>
    </div>
  );
}