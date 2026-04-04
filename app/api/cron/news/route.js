// app/api/cron/news/route.js
import { NextResponse } from 'next/server';
import { syncAllNews } from '@/lib/connectors/news';

export async function GET(request) {
  // Verifikasi secret untuk keamanan
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('❌ Unauthorized cron attempt');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  console.log('🕐 Cron job started:', new Date().toISOString());

  try {
    const results = await syncAllNews();
    
    console.log('✅ Cron job completed:', results);
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    });
    
  } catch (error) {
    console.error('❌ Cron job failed:', error);
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message
    }, { status: 500 });
  }
}