// app/api/cron/news/route.js
import { NextResponse } from 'next/server';
import { syncAllNews } from '@/lib/connectors/news';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  
  const results = await syncAllNews();
  
  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results
  });
}