'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion'; // Tambahan untuk animasi smooth
import { 
  Users, Shield, Store, MapPin, Search, 
  Trash2, Edit3, Loader2, Bike, 
  Briefcase, ShoppingBag
} from 'lucide-react';

export default function UserManagementPage() {
  const { isSuperAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('semua'); 

  // State untuk Modal
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (user) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (updatedData) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updatedData)
        .eq('id', selectedUser.id);

      if (error) throw error;
      
      // Update state lokal
      setUsers(users.map(u => u.id === selectedUser.id ? { ...u, ...updatedData } : u));
      setIsEditModalOpen(false);
    } catch (err) {
      alert('Gagal memperbarui data warga.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (confirm('Yakin ingin menghapus warga ini dari sistem?')) {
      try {
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) throw error;
        setUsers(users.filter(u => u.id !== id));
      } catch (err) {
        alert('Gagal menghapus warga.');
      }
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.full_name?.toLowerCase().includes(search.toLowerCase()) || 
                         u.email?.toLowerCase().includes(search.toLowerCase());
    
    if (activeTab === 'driver') return matchesSearch && u.is_driver;
    if (activeTab === 'rewang') return matchesSearch && u.is_rewang;
    if (activeTab === 'seller') return matchesSearch && u.is_seller;
    if (activeTab === 'admin') return matchesSearch && u.role === 'admin';
    
    return matchesSearch;
  });

  if (!isSuperAdmin) return <div className="p-10 text-center font-bold">Akses Khusus Petinggi!</div>;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* HEADER & FILTERS */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Manajemen Warga</h1>
          <p className="text-sm text-slate-400 font-medium">Pantau Driver, Rewang, dan Pengurus Setempat.id</p>
        </div>
        
        <div className="flex gap-2 bg-slate-50 p-2 rounded-2xl overflow-x-auto max-w-full">
          {[
            { id: 'semua', label: 'Semua', icon: <Users size={14}/> },
            { id: 'driver', label: 'Driver', icon: <Bike size={14}/> },
            { id: 'rewang', label: 'Rewang', icon: <Briefcase size={14}/> },
            { id: 'seller', label: 'Lapak', icon: <ShoppingBag size={14}/> },
            { id: 'admin', label: 'Pengurus', icon: <Shield size={14}/> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black transition-all whitespace-nowrap ${
                activeTab === tab.id ? 'bg-white shadow-md text-purple-600' : 'text-slate-400 hover:bg-slate-100'
              }`}
            >
              {tab.icon} {tab.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* SEARCH */}
      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
        <input 
          type="text" 
          placeholder={`Cari di kategori ${activeTab}...`} 
          className="w-full pl-14 pr-6 py-5 rounded-[1.5rem] bg-white border border-slate-100 font-bold text-sm shadow-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Warga</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Profesi</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Wilayah</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={4} className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-purple-500" /></td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={4} className="p-20 text-center text-slate-400 font-bold">Tidak ada warga di kategori ini.</td></tr>
              ) : filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-all">
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center font-black text-purple-600 shadow-inner overflow-hidden">
                        {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : user.full_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800">{user.full_name}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{user.phone || 'No Phone'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-wrap gap-1.5">
                      {user.role === 'admin' && <span className="px-2 py-1 bg-purple-600 text-white text-[8px] font-black rounded-lg uppercase">Admin</span>}
                      {user.is_driver && <span className="px-2 py-1 bg-blue-100 text-blue-600 text-[8px] font-black rounded-lg uppercase flex items-center gap-1"><Bike size={10}/> Driver</span>}
                      {user.is_rewang && <span className="px-2 py-1 bg-emerald-100 text-emerald-600 text-[8px] font-black rounded-lg uppercase flex items-center gap-1"><Briefcase size={10}/> Rewang</span>}
                      {user.is_seller && <span className="px-2 py-1 bg-amber-100 text-amber-600 text-[8px] font-black rounded-lg uppercase flex items-center gap-1"><ShoppingBag size={10}/> Seller</span>}
                    </div>
                  </td>
                  <td className="p-6">
                    <p className="text-[11px] font-black text-slate-700 uppercase">{user.desa || '-'}</p>
                    <p className="text-[9px] text-slate-400 font-bold">{user.kecamatan}</p>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center justify-center gap-2">
                       <button 
                        onClick={() => handleEditClick(user)}
                        className="p-2.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all"
                       >
                         <Edit3 size={18} />
                       </button>
                       <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                       >
                         <Trash2 size={18} />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Render Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <EditModal 
            user={selectedUser} 
            isOpen={isEditModalOpen} 
            onClose={() => setIsEditModalOpen(false)} 
            onSave={handleUpdateUser}
            isSaving={isSaving}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- SUB COMPONENTS ---

function EditModal({ user, isOpen, onClose, onSave, isSaving }) {
  const [formData, setFormData] = useState(user);

  useEffect(() => { setFormData(user); }, [user]);

  if (!isOpen) return null;

  const toggleStatus = (key) => {
    setFormData({ ...formData, [key]: !formData[key] });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" 
        onClick={onClose} 
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8">
          <h2 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tighter">Edit Profil Warga</h2>
          
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Wilayah Desa</label>
                <input 
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                  value={formData?.desa || ''}
                  onChange={(e) => setFormData({...formData, desa: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Kecamatan</label>
                <input 
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                  value={formData?.kecamatan || ''}
                  onChange={(e) => setFormData({...formData, kecamatan: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-3">
               <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Akses & Profesi</label>
               <div className="grid grid-cols-2 gap-2">
                 <ProfessionToggle label="Driver" active={formData?.is_driver} onClick={() => toggleStatus('is_driver')} color="blue" />
                 <ProfessionToggle label="Rewang" active={formData?.is_rewang} onClick={() => toggleStatus('is_rewang')} color="emerald" />
                 <ProfessionToggle label="Seller" active={formData?.is_seller} onClick={() => toggleStatus('is_seller')} color="amber" />
                 <ProfessionToggle 
                    label="Admin" 
                    active={formData?.role === 'admin'} 
                    onClick={() => setFormData({...formData, role: formData.role === 'admin' ? 'user' : 'admin'})} 
                    color="purple" 
                  />
               </div>
            </div>
          </div>

          <div className="mt-10 flex gap-3">
            <button onClick={onClose} className="flex-1 py-4 text-xs font-black text-slate-400 uppercase hover:text-slate-600 transition-colors">Batal</button>
            <button 
              onClick={() => onSave(formData)}
              disabled={isSaving}
              className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ProfessionToggle({ label, active, onClick, color }) {
  const colors = {
    blue: active ? 'bg-blue-600 text-white shadow-blue-200 shadow-lg' : 'bg-slate-50 text-slate-400',
    emerald: active ? 'bg-emerald-600 text-white shadow-emerald-200 shadow-lg' : 'bg-slate-50 text-slate-400',
    amber: active ? 'bg-amber-600 text-white shadow-amber-200 shadow-lg' : 'bg-slate-50 text-slate-400',
    purple: active ? 'bg-purple-600 text-white shadow-purple-200 shadow-lg' : 'bg-slate-50 text-slate-400',
  };

  return (
    <button 
      onClick={onClick} 
      className={`p-4 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-between ${colors[color]}`}
    >
      {label}
      <span className={`w-2 h-2 rounded-full ${active ? 'bg-white animate-pulse' : 'bg-slate-200'}`} />
    </button>
  );
}