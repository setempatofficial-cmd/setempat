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
  const [serviceMode, setServiceMode] = useState('passenger');
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Header scroll logic
  useEffect(() => {
    const controlHeader = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < 20) {
        setShowHeader(true);
      } else if (currentScrollY > lastScrollY) {
        setShowHeader(false);
      } else {
        setShowHeader(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', controlHeader);
    return () => window.removeEventListener('scroll', controlHeader);
  }, [lastScrollY]);

  // Fetch drivers
  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, avatar_url, is_driver, driver_status, motor_info, driver_rating')
        .eq('is_driver', true)
        .order('driver_rating', { ascending: false });
      
      if (error) throw error;
      
      const formattedDrivers = data?.map(driver => ({
        id: driver.id,
        nama: driver.full_name || 'Driver',
        phone: driver.phone,
        avatar: driver.avatar_url,
        status: driver.driver_status || 'offline',
        motor: driver.motor_info?.split('•')[0]?.trim() || 'Motor',
        plat: driver.motor_info?.split('•')[1]?.trim() || '-',
        rating: driver.driver_rating || 4.5,
        lokasi: locationName,
        tarif: 'Mulai 5rb'
      })) || [];
      
      setRiders(formattedDrivers);
    } catch (err) {
      console.error('Error fetching drivers:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRiders = riders.filter(rider =>
    rider.nama.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const standbyCount = riders.filter(r => r.status === 'standby').length;

  const handleChat = (rider) => {
    const phoneNumber = rider.phone;
    if (!phoneNumber) {
      alert('Nomor WhatsApp driver tidak tersedia');
      return;
    }
    let cleanPhone = phoneNumber.toString().replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
    window.open(`https://wa.me/${cleanPhone}?text=Halo, saya mau pesan ojek dari ${locationName}`, '_blank');
  };

  const handleCall = (rider) => {
    const phoneNumber = rider.phone;
    if (!phoneNumber) {
      alert('Nomor telepon driver tidak tersedia');
      return;
    }
    window.open(`tel:${phoneNumber}`, '_blank');
  };

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      
      {/* HEADER dengan efek scroll */}
<div className={`fixed top-0 left-0 right-0 z-[110] transition-all duration-300 ${
        showHeader ? 'translate-y-0' : '-translate-y-[62px]'
      }`}>
        <div className="max-w-[420px] mx-auto bg-white/80 backdrop-blur-md border-b border-slate-100">
    
    {/* Baris 1: Navigasi & Lokasi Aktif */}
    <div className="flex items-center justify-between px-6 py-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-2 -ml-2 text-slate-600 active:scale-90 transition-all">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h3 className="font-black text-slate-900 text-sm italic tracking-tighter leading-none uppercase">OJEK WARGA</h3>
          <p className="text-[8px] text-emerald-500 font-bold uppercase tracking-[0.2em] mt-0.5">Antar Jemput & Kirim</p>
        </div>
      </div>

      {/* LOKASI AKTIF */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full shadow-sm">
        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
        <span className="text-[9px] font-black text-emerald-700 uppercase tracking-tight">
          {locationName}
        </span>
        <MapPin size={10} className="text-emerald-500" />
      </div>
    </div>

    {/* Baris 2: Search & Toggle Mode */}
    <div className="px-6 pb-3 space-y-3">

      {/* Search Input (DI ATAS) */}
      <div className="relative group">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
        <input
          type="text"
          placeholder={serviceMode === 'passenger' ? "Cari driver ojek..." : "Cari driver untuk kirim barang..."}
          className="w-full pl-9 pr-4 py-2 bg-slate-100/80 border border-transparent rounded-xl text-[11px] focus:bg-white focus:border-emerald-200 focus:outline-none transition-all"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Toggle Mode (DI BAWAH SEARCH) */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
        <button 
          onClick={() => setServiceMode('passenger')}
          className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${
            serviceMode === 'passenger' 
              ? 'bg-emerald-500 text-white shadow-md' 
              : 'text-slate-500'
          }`}
        >
          <Navigation size={12} /> Antar Orang
        </button>
        <button 
          onClick={() => setServiceMode('delivery')}
          className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${
            serviceMode === 'delivery' 
              ? 'bg-emerald-500 text-white shadow-md' 
              : 'text-slate-500'
          }`}
        >
          <Truck size={12} /> Kirim Barang
        </button>
      </div>
    </div>
  </div>
</div>

      {/* CONTENT AREA */}
      <div className="pt-48 px-6 space-y-4">
        
        {/* INFO BANNER */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4 rounded-[24px] text-white shadow-lg shadow-emerald-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              {serviceMode === 'passenger' ? <Navigation size={20} /> : <Truck size={20} />}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none">
                {serviceMode === 'passenger' ? 'Status Driver' : 'Layanan Kirim'}
              </p>
              <p className="text-xs font-bold mt-1">
                {serviceMode === 'passenger' 
                  ? `Ada ${standbyCount} driver standby di sekitar Sampeyan`
                  : 'Tarif berdasarkan jarak & berat paket'}
              </p>
            </div>
          </div>
        </div>

        {/* LIST RIDERS */}
        {loading ? (
          <div className="flex flex-col items-center py-20">
            <Loader2 size={32} className="animate-spin text-slate-400 mb-2" />
            <p className="text-[10px] font-bold text-slate-400">Ngunduh data driver...</p>
          </div>
        ) : filteredRiders.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Navigation size={32} className="text-slate-400" />
            </div>
            <p className="text-slate-500 font-bold text-sm">Durung ono driver nang kene.</p>
            <p className="text-slate-400 text-[10px] mt-1">Coba lokasi liyane atau golek maneh.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRiders.map((rider) => (
              <div key={rider.id} className="p-4 bg-white border border-slate-100 rounded-[28px] shadow-sm hover:border-emerald-200 transition-all">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden">
                      {rider.avatar ? (
                        <img src={rider.avatar} alt={rider.nama} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-lg">
                          {rider.nama.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight">{rider.nama}</h4>
                        <div className="flex items-center gap-0.5 text-[10px] font-black text-orange-500">
                          <Star size={10} fill="currentColor" /> {rider.rating}
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                        {rider.motor} • {rider.plat}
                      </p>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${
                    rider.status === 'standby' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                  }`}>
                    {rider.status === 'standby' ? 'Standby' : 'Sedang Bertugas'}
                  </div>
                </div>

                <div className="flex items-center gap-4 py-3 border-t border-dashed border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-600">{rider.lokasi}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={12} className="text-emerald-500" />
                    <span className="text-[10px] font-bold text-slate-600">{rider.tarif}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-1">
                  <button 
                    onClick={() => handleChat(rider)}
                    className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <MessageSquare size={14} /> Chat
                  </button>
                  <button 
                    onClick={() => handleCall(rider)}
                    className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-emerald-100"
                  >
                    <Phone size={14} /> Hubungi
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FOOTER NOTE */}
        <div className="p-6 text-center">
          <p className="text-[10px] text-slate-400 font-bold italic leading-relaxed uppercase">
            {serviceMode === 'passenger' 
              ? '"Tarif disepakati lewat chat/telpon.\nUtamakan keselamatan nggih, Lur!"'
              : '"Barang aman sampai tujuan.\nKomunikasi dengan driver via WhatsApp"'}
          </p>
        </div>
      </div>
    </div>
  );
}