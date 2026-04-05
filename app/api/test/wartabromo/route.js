// app/api/test/wartabromo/route.js
import { NextResponse } from 'next/server';
import { syncWartaBromoNews } from '@/lib/connectors/wartabromo';

export async function GET(request) {
  // Opsional: tambahkan auth sederhana agar tidak diakses sembarangan
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.TEST_SECRET}`) {
    // Jika tidak pakai auth, bisa diabaikan dengan hapus blok ini
  }
  
  console.log('🧪 Manual test: Syncing WartaBromo...');
  const startTime = Date.now();
  
  try {
    const result = await syncWartaBromoNews();
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      result
    });
  } catch (error) {
    console.error('Test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}