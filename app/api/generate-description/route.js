// app/api/generate-description/route.js
import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Rate limiter sederhana
const rateLimit = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - 60000; // 1 menit
  
  if (!rateLimit.has(ip)) {
    rateLimit.set(ip, []);
  }
  
  const requests = rateLimit.get(ip).filter(timestamp => timestamp > windowStart);
  
  if (requests.length >= 10) { // maks 10 request per menit
    return { success: false };
  }
  
  requests.push(now);
  rateLimit.set(ip, requests);
  return { success: true };
}

export async function POST(request) {
  try {
    console.log("✅ API route dipanggil dengan method POST");
    
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'anonymous';
    if (!checkRateLimit(ip).success) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan. Coba lagi nanti.' },
        { status: 429 }
      );
    }
    
    const body = await request.json();
    const { name, category, vibe, avgPeople, hasQueue } = body;
    
    console.log("📦 Request body:", { name, category, vibe, avgPeople, hasQueue });
    
    // Jika tidak ada nama, return error
    if (!name) {
      return NextResponse.json(
        { error: 'Nama tempat diperlukan' },
        { status: 400 }
      );
    }
    
    // Siapkan prompt untuk Groq
    const prompt = `Buat deskripsi singkat (maksimal 100 karakter) untuk tempat ini: ${name}.
Kategori: ${category || 'tempat umum'}
Suasana: ${vibe || 'normal'}
${avgPeople ? `Estimasi pengunjung: ${avgPeople} orang` : ''}
${hasQueue ? 'Ada antrean' : ''}

Hasil: (langsung tulis deskripsinya, tanpa tanda kutip, maksimal 100 karakter)`;

    console.log("🤖 Memanggil Groq API...");
    
    // Panggil Groq
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'Anda adalah asisten yang membuat deskripsi tempat wisata/kuliner/belanja yang singkat, informatif, dan engaging. Output maksimal 100 karakter. Langsung tulis deskripsinya tanpa embel-embel.'
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.1-8b-instant', // Model dengan kuota lebih besar
      temperature: 0.7,
      max_tokens: 150,
    });
    
    let description = completion.choices[0]?.message?.content || '';
    description = description.replace(/^["']|["']$/g, '').trim();
    
    // Fallback jika hasil terlalu pendek
    if (!description || description.length < 10) {
      description = `📍 ${name} - Tempat yang menarik untuk dikunjungi.`;
    }
    
    // Potong jika kepanjangan
    if (description.length > 100) {
      description = description.substring(0, 97) + '...';
    }
    
    console.log("✅ Hasil Groq:", description);
    
    return NextResponse.json({ 
      description: description,
      source: 'groq',
      cached: false 
    });
    
  } catch (error) {
    console.error("Groq API Error:", error);
    
    // Fallback jika Groq gagal
    const body = await request.json().catch(() => ({}));
    const name = body.name || 'tempat';
    
    return NextResponse.json({ 
      description: `📍 ${name} - Tempat yang menarik untuk dikunjungi.`,
      source: 'fallback',
      error: error.message
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Allow': 'POST, OPTIONS',
    },
  });
}