// app/api/live-status/route.js
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const LIVE_INPUT_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_LIVE_INPUT_ID;
    
    if (!LIVE_INPUT_ID) {
      return NextResponse.json(
        { isLive: false },
        { status: 400 }
      );
    }

    const url = `https://videodelivery.net/${LIVE_INPUT_ID}/manifest/video.m3u8`;
    
    const response = await fetch(url, {
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ isLive: false });
    }

    const text = await response.text();
    
    const isLive = 
      text.includes('#EXTINF') || 
      text.includes('.ts');

    return NextResponse.json({ isLive });
    
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ isLive: false });
  }
}