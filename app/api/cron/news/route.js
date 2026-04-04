// app/api/cron/news/route.js
import { NextResponse } from 'next/server';
import { syncAllNews } from '@/lib/connectors/news';

export async function GET(request) {
  // 1. Verifikasi secret (sudah benar)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('❌ Unauthorized cron attempt');
    return new NextResponse('Unauthorized', { status: 401 });
  }
  
  console.log('🕐 Cron job started:', new Date().toISOString());
  
  try {
    // 2. Jalankan sync
    const results = await syncAllNews();
    
    console.log('✅ Cron job completed:', results);
    
    // 3. Return respons sukses
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    });
    
  } catch (error) {
    // 4. Error handling
    console.error('❌ Cron job failed:', error);
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message
    }, { status: 500 });
  }
}