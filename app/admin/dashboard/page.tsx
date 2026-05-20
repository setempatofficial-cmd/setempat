// app/admin/dashboard/page.js - VERSION WITH TABS
"use client";

import { useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { Users, Database } from 'lucide-react';

// Import komponen yang sudah ada
import UserManagementTab from './tabs/UserManagementTab';
// Import komponen data management yang baru
import DataManagementTab from './tabs/DataManagementTab';

export default function AdminDashboard() {
  const { profile, isSuperAdmin, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('users');

  // Hanya SuperAdmin yang bisa akses tab Data
  const showDataTab = isSuperAdmin;

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition ${activeTab === 'users'
              ? 'border-b-2 border-emerald-600 text-emerald-600'
              : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <Users size={18} />
          Kelola User & Verifikasi
        </button>

        {showDataTab && (
          <button
            onClick={() => setActiveTab('data')}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition ${activeTab === 'data'
                ? 'border-b-2 border-emerald-600 text-emerald-600'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <Database size={18} />
            Kelola Data Tempat
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'users' && <UserManagementTab />}
      {activeTab === 'data' && <DataManagementTab />}
    </div>
  );
}