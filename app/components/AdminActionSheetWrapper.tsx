// app/components/AdminActionSheetWrapper.tsx
'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// Lazy load di sini (Client Component)
const AdminActionSheet = dynamic(
  () => import('./AdminActionSheet'),
  { 
    ssr: false,
    loading: () => null
  }
);

export default function AdminActionSheetWrapper() {
  return <AdminActionSheet />;
}