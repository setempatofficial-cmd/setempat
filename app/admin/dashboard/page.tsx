// app/admin/dashboard/page.js - VERSION WITH TABS (FINAL + WITHDRAW)
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { Users, Database, LayoutDashboard, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Import komponen yang sudah ada
import UserManagementTab from './tabs/UserManagementTab';
import DataManagementTab from './tabs/DataManagementTab';
import WithdrawTab from './tabs/WithdrawTab';

export default function AdminDashboard() {
  const { profile, isSuperAdmin, isAdmin, loading, user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const router = useRouter();

  // Redirect jika bukan admin
  useEffect(() => {
    if (!loading && !isSuperAdmin && !isAdmin) {
      router.push("/");
    }
  }, [loading, isSuperAdmin, isAdmin, router]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Access denied
  if (!isSuperAdmin && !isAdmin) {
    return null;
  }

  // Hanya SuperAdmin yang bisa akses tab Data & Withdraw
  const showDataTab = isSuperAdmin;
  const showWithdrawTab = isSuperAdmin; // atau bisa juga untuk admin biasa

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header dengan User Info */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard Admin</h1>
        <p className="text-sm text-gray-500 mt-1">
          Login sebagai: <span className="font-medium text-gray-700">
            {profile?.full_name || user?.user_metadata?.full_name || profile?.email || "Admin"}
          </span>
          <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs">
            {isSuperAdmin ? "Super Admin" : "Admin"}
          </span>
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b flex-wrap">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition ${activeTab === 'overview'
              ? 'border-b-2 border-emerald-600 text-emerald-600'
              : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <LayoutDashboard size={18} />
          Overview
        </button>

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

        {showWithdrawTab && (
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition ${activeTab === 'withdraw'
                ? 'border-b-2 border-emerald-600 text-emerald-600'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <Wallet size={18} />
            Penarikan Saldo
          </button>
        )}

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
      {activeTab === 'overview' && (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Selamat Datang di Panel Admin</h2>
          <p className="text-gray-600">
            Gunakan tab di atas untuk mengelola:
          </p>
          <ul className="list-disc list-inside mt-3 text-gray-600 space-y-1">
            <li><strong>Kelola User & Verifikasi</strong> - Verifikasi KTP, Bakul, Ojek, Rewang</li>
            {showWithdrawTab && <li><strong>Penarikan Saldo</strong> - Kelola request penarikan dana</li>}
            {showDataTab && <li><strong>Kelola Data Tempat</strong> - Mengelola data tempat/lokasi</li>}
          </ul>
          <div className="mt-6 p-4 bg-emerald-50 rounded-lg">
            <p className="text-sm text-emerald-800">
              ✅ Anda login sebagai <strong>{isSuperAdmin ? "Super Admin" : "Admin"}</strong> dengan akses penuh
            </p>
          </div>
        </div>
      )}
      {activeTab === 'users' && <UserManagementTab />}
      {activeTab === 'withdraw' && showWithdrawTab && <WithdrawTab />}
      {activeTab === 'data' && showDataTab && <DataManagementTab />}
    </div>
  );
}