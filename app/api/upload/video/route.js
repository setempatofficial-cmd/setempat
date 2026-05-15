// app\api\upload\video\route.js
import { NextResponse } from 'next/server';
import { uploadAndOptimizeVideo } from '@/utils/cloudinary-upload';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const video = formData.get('video');
    
    const buffer = Buffer.from(await video.arrayBuffer());
    const result = await uploadAndOptimizeVideo(buffer);
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}