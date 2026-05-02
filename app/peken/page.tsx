'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Home, MapPin, Store, Users, LayoutDashboard, MessageSquare, 
  Plus, AlertCircle, UserPlus, ShoppingBag, Truck, Gift, Bell, Heart 
} from 'lucide-react';

// --- SECTIONS & MODALS IMPORTS ---
import RewangSection from "@/app/components/peken/RewangSection";
import PanyanganSection from "@/app/components/peken/PanyanganSection";
import LapakkuSection from "@/app/components/peken/LapakkuSection";
import PesenanSection from "@/app/components/peken/PesenanSection";
import KabarBakulSection from "@/app/components/peken/KabarBakulSection";
import OjekSection from "@/app/components/peken/OjekSection";
import DonasiSection from "@/app/components/peken/DonasiSection";
import FormOjek from "@/app/components/features/ojek/FormOjek";
import FormDonasi from "@/app/components/features/donasi/FormDonasi";
import FormDaftarBakul from "@/app/components/features/penjual/FormDaftarBakul";
import SambatModal from "@/app/components/features/rewang/SambatModal";
import DaftarRewangModal from "@/app/components/features/rewang/DaftarRewangModal";
import FormPanyangan from "@/app/components/features/panyangan/FormPanyangan";
import DetailProdukModal from "@/app/components/peken/DetailProdukModal";

// --- CONTEXTS ---
import { useAuth } from "@/app/context/AuthContext";
import { useLocation } from "@/components/LocationProvider";
import { supabase } from '@/lib/supabaseClient';
import UploadOptions from "@/app/components/upload/UploadOptions";

export default function PekenPage() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const { location, placeName } = useLocation();
  const [showUploadModal, setShowUploadModal] = useState(false);

  // --- STATES ---
  const [activeTab, setActiveTab] = useState('beranda');
  const [manualLocationName, setManualLocationName] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showDaftarBakul, setShowDaftarBakul] = useState(false);
  const [localProfile, setLocalProfile] = useState(null);
  
  // Header Scroll Logic
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Status dari profile

const isSeller = localProfile?.is_seller === true;  
const isDriver = localProfile?.is_driver === true;  
const isRewang = localProfile?.is_rewang === true;  
  
  const finalIsSeller = localProfile?.is_seller === true;
  const finalKtpStatus = localProfile?.ktp_status || 'belum_mengajukan';
  const finalKtpRejectionReason = localProfile?.ktp_rejection_reason;
  
  // State untuk modal-modal
  const [modals, setModals] = useState({
    daftarOjek: false,
    daftarRewang: false,
    donasi: false,
    sambat: false,
    formPanyangan: false
  });
  
  const toggleModal = useCallback((key, value) => {
    setModals(prev => ({ ...prev, [key]: value }));
  }, []);

  const fetchProfileDirect = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      
      console.log("📋 Profile langsung dari DB:", data);
      setLocalProfile(data);
    } catch (error) {
      console.error("Error fetch profile:", error);
    }
  }, [user]);

  useEffect(() => {
    fetchProfileDirect();
  }, [fetchProfileDirect]);

  // Scroll logic
  useEffect(() => {
    const controlHeader = () => {
      if (typeof window !== 'undefined') {
        if (window.scrollY > lastScrollY && window.scrollY > 80) {
          setShowHeader(false);
        } else {
          setShowHeader(true);
        }
        setLastScrollY(window.scrollY);
      }
    };

    window.addEventListener('scroll', controlHeader);
    return () => window.removeEventListener('scroll', controlHeader);
  }, [lastScrollY]);

  const finalLocationName = useMemo(() => {
    if (manualLocationName) return manualLocationName;
    if (placeName) return placeName.split(",")[0].trim();
    return "Pasuruan";
  }, [placeName, manualLocationName]);

  useEffect(() => {
    const handleLocationUpdate = (e) => {
      const name = e.detail?.placeName?.split(",")[0].trim();
      if (name) setManualLocationName(name);
    };
    window.addEventListener('location-updated', handleLocationUpdate);
    
    const handleRefreshProfile = () => {
      if (refreshProfile) refreshProfile();
    };
    window.addEventListener('refresh-user-profile', handleRefreshProfile);
    
    return () => {
      window.removeEventListener('location-updated', handleLocationUpdate);
      window.removeEventListener('refresh-user-profile', handleRefreshProfile);
    };
  }, [refreshProfile]);

  const handleAddProduct = useCallback(() => {
    setEditingProduct(null);
    toggleModal('formPanyangan', true);
  }, [toggleModal]);

  const handleRefreshStatus = useCallback(async () => {
    if (refreshProfile) {
      await refreshProfile();
    }
    window.dispatchEvent(new CustomEvent('refresh-lapak-status'));
  }, [refreshProfile]);

  return (
    <div className="min-h-screen bg-[#FBFBFE] pb-32 max-w-[420px] mx-auto relative shadow-2xl overflow-x-hidden">
      
      {/* HEADER FIXED */}
      <div className={`fixed top-0 left-0 right-0 z-[110] transition-all duration-300 ease-in-out ${
        showHeader ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="max-w-[420px] mx-auto bg-[#FBFBFE]/90 backdrop-blur-md border-b border-slate-100 px-6 py-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">PEKEN</h1>
              <div className="flex items-center text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">
                <MapPin size={10} className="mr-1 text-orange-500" /> {finalLocationName}
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('open-location-modal'))} 
                className="p-2.5 bg-slate-100 rounded-2xl text-slate-600 active:scale-95 transition-all"
              >
                <MapPin size={18} />
              </button>
              <button onClick={() => router.push('/')} className="p-2.5 bg-slate-900 rounded-2xl text-white active:scale-95 transition-all">
                <Home size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div className="h-[84px]" />

      <main className="px-6">
        {activeTab === 'beranda' && (
          <PekenHome location={finalLocationName} setActiveTab={setActiveTab} />
        )}
        
        {activeTab === 'kabarbakul' && (
          <KabarBakulSection locationName={finalLocationName} location={location} onNavigateToProduct={() => setActiveTab('panyangan')} />
        )}
        
        {activeTab === 'panyangan' && (
          <PanyanganSection locationName={finalLocationName} location={location} userId={user?.id} onBack={() => setActiveTab('beranda')} onAddProduct={handleAddProduct} />
        )}
        
        {activeTab === 'rewang' && (
          <RewangSection onBack={() => setActiveTab('beranda')} locationName={finalLocationName} />
        )}
        
        {activeTab === 'pesenan' && (
          <PesenanSection userId={user?.id} locationName={finalLocationName} onBack={() => setActiveTab('beranda')} onReviewOrder={(order) => { setSelectedProduct(order.produk); setShowReviewModal(true); }} />
        )}

        {activeTab === 'ojek' && <OjekSection onBack={() => setActiveTab('beranda')} locationName={finalLocationName} />}
        {activeTab === 'donasi' && <DonasiSection onBack={() => setActiveTab('beranda')} locationName={finalLocationName} />}
        
        {activeTab === 'lapakku' && (
          <LapakkuSection 
            userId={user?.id} 
            locationName={finalLocationName} 
            onBack={() => setActiveTab('beranda')} 
            onAddProduct={handleAddProduct} 
            onEditProduct={(product) => { 
              setEditingProduct(product); 
              toggleModal('formPanyangan', true); 
            }} 
            isSeller={finalIsSeller}
            ktpStatus={finalKtpStatus}                
            ktpRejectionReason={localProfile?.ktp_rejection_reason} 
            onOpenDaftarBakul={() => setShowDaftarBakul(true)} 
            onRefreshStatus={handleRefreshStatus}
          />
        )}
      </main>

      {/* BOTTOM NAVIGATION */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} onPlusClick={() => setShowUploadModal(true)} />

      {/* UPLOAD OPTIONS MODAL */}
      {showUploadModal && (
        <UploadOptions
          onClose={() => setShowUploadModal(false)}
          isSeller={isSeller}
          isDriver={isDriver}
          isRewang={isRewang}
          onDaftarBakul={() => setShowDaftarBakul(true)}
          onDaftarOjek={() => toggleModal('daftarOjek', true)}
          onDaftarRewang={() => toggleModal('daftarRewang', true)}
          onDonasi={() => toggleModal('donasi', true)}
          onSambat={() => toggleModal('sambat', true)}
          onPanyangan={handleAddProduct}
        />
      )}
      
      {/* SEMUA MODAL */}
      <FormDaftarBakul 
        isOpen={showDaftarBakul} 
        onClose={() => setShowDaftarBakul(false)} 
        user={user} 
        profile={profile} 
        onSuccess={() => {
          setShowDaftarBakul(false);
          handleRefreshStatus();
        }} 
      />
      
      <FormPanyangan 
        isOpen={modals.formPanyangan} 
        onClose={() => { 
          toggleModal('formPanyangan', false); 
          setEditingProduct(null); 
        }} 
        editingProduct={editingProduct} 
        onSuccess={() => window.dispatchEvent(new CustomEvent('refresh-lapak'))} 
        theme={{ isMalam: false }} 
      />
      
      <SambatModal 
        isOpen={modals.sambat} 
        onClose={() => toggleModal('sambat', false)} 
        user={user} 
        profile={profile} 
      />
      
      <DaftarRewangModal 
        isOpen={modals.daftarRewang} 
        onClose={() => toggleModal('daftarRewang', false)} 
        profile={profile} 
      />
      
      <FormOjek 
        isOpen={modals.daftarOjek} 
        onClose={() => toggleModal('daftarOjek', false)} 
        user={user} 
        profile={profile} 
      />
      
      <FormDonasi 
        isOpen={modals.donasi} 
        onClose={() => toggleModal('donasi', false)} 
        user={user} 
        profile={profile} 
      />
      
      <DetailProdukModal 
        product={selectedProduct} 
        isOpen={showReviewModal} 
        onClose={() => { 
          setShowReviewModal(false); 
          setSelectedProduct(null); 
        }} 
        userId={user?.id} 
        locationName={finalLocationName} 
        autoOpenUlasan={true} 
        onOrderSuccess={() => {}} 
      />
      
    </div>
  );
}

// --- SUB-COMPONENTS ---
function PekenHome({ location, setActiveTab }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 pb-10">
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-[32px] p-6 text-white shadow-xl shadow-orange-100">
        <h2 className="text-xl font-black leading-tight">Sugeng Rawuh <br/>ing Peken {location}</h2>
        <p className="text-orange-100 text-xs mt-2 font-medium opacity-80">Pusat ekonomi & gotong royong warga {location}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <MenuCard onClick={() => setActiveTab('panyangan')} icon={Store} title="Panyangan" desc="Hasil bumi & barang" color="bg-blue-50 text-blue-600" />
        <MenuCard onClick={() => setActiveTab('rewang')} icon={Users} title="Rewang" desc="Jasa & Gotong Royong" color="bg-purple-50 text-purple-600" />
        <MenuCard onClick={() => setActiveTab('ojek')} icon={Truck} title="Ojek Warga" desc="Antar jemput & kirim" color="bg-emerald-50 text-emerald-600" />
        <MenuCard onClick={()=> setActiveTab('donasi')} icon={Gift} title="Donasi" desc="Berbagi ke sesama" color="bg-red-50 text-red-600" />
      </div>

      <div className="p-8 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200 flex flex-col items-center text-center">
        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-400 mb-3">
          <ShoppingBag size={24} />
        </div>
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Peken {location}</p>
        <p className="text-[10px] text-slate-400 mt-1">Gunakan Kabar Bakul kanggo update harga harian.</p>
      </div>
    </div>
  );
}

function BottomNav({ activeTab, setActiveTab, onPlusClick }) {
  return (
    <div className="fixed bottom-6 left-0 right-0 z-[120] flex justify-center px-6 pointer-events-none">
      <nav className="flex items-center justify-between w-full max-w-[380px] bg-slate-900/95 backdrop-blur-xl p-2 rounded-[32px] shadow-2xl pointer-events-auto border border-white/10">
        <TabButton active={activeTab === 'beranda'} onClick={() => setActiveTab('beranda')} icon={Store} label="Peken" />
        <TabButton active={activeTab === 'kabarbakul'} onClick={() => setActiveTab('kabarbakul')} icon={Bell} label="Bakul" />
        <button onClick={onPlusClick} className="bg-orange-500 text-white p-4 rounded-2xl shadow-lg -mt-10 border-[6px] border-[#FBFBFE] active:scale-90 transition-all">
          <Plus size={24} />
        </button>
        <TabButton active={activeTab === 'pesenan'} onClick={() => setActiveTab('pesenan')} icon={MessageSquare} label="Pesenan" />
        <TabButton active={activeTab === 'lapakku'} onClick={() => setActiveTab('lapakku')} icon={LayoutDashboard} label="Lapak" />
      </nav>
    </div>
  );
}

function MenuCard({ icon: Icon, title, desc, color, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-col items-start p-5 bg-white border border-slate-100 rounded-[32px] text-left hover:border-orange-200 transition-all active:scale-95 group">
      <div className={`p-3 rounded-2xl mb-3 transition-transform group-hover:scale-110 ${color}`}>
        <Icon size={22} />
      </div>
      <h4 className="font-black text-slate-800 text-xs uppercase tracking-tight leading-none">{title}</h4>
      <p className="text-[10px] text-slate-400 mt-1 font-medium leading-tight">{desc}</p>
    </button>
  );
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-14 h-12 transition-all ${active ? 'text-orange-400' : 'text-slate-500 opacity-60'}`}>
      <div className="relative">
        <Icon size={18} strokeWidth={active ? 2.5 : 2} />
        {label === 'Bakul' && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-900 animate-bounce" />}
      </div>
      <span className="text-[7px] font-black mt-1.5 uppercase">{label}</span>
    </button>
  );
}