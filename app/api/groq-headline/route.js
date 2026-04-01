// app/api/groq-headline/route.js
import { NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function POST(request) {
  try {
    const { item, context } = await request.json();
    
    // Validate input
    if (!item || !item.name) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    
    const prompt = buildPrompt(item, context);
    
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
        messages: [
          {
            role: 'system',
            content: `Kamu adalah asisten pembuat headline untuk aplikasi komunitas warga.
Buat headline yang engaging, informatif, dan sesuai dengan konteks.
Gunakan bahasa Indonesia natural, sedikit santai, dan engaging.
Panjang headline maksimal 55 karakter.
Format output HARUS JSON: {"text": "headline", "type": "jenis", "icon": "emoji"}
Jenis bisa: event, viral, ramai, sepi, antrian, hujan, macet, kuliner, umum`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 80,
        response_format: { type: 'json_object' }
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Groq API error:', error);
      throw new Error('Groq API error');
    }
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON response
    try {
      const headline = JSON.parse(content);
      
      // Validate headline
      if (!headline.text || headline.text.length > 60) {
        headline.text = headline.text?.substring(0, 57) + '...' || 'Update terbaru';
      }
      
      return NextResponse.json({ headline });
      
    } catch (e) {
      // Fallback jika response bukan JSON
      const cleanText = content.replace(/[{}]/g, '').trim().substring(0, 55);
      return NextResponse.json({
        headline: {
          text: cleanText,
          type: 'ai_generated',
          icon: '🤖'
        }
      });
    }
    
  } catch (error) {
    console.error('Groq headline error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function buildPrompt(item, context) {
  const waktu = getWaktuSekarang();
  
  let kondisiText = [];
  if (context.hasEvent) kondisiText.push('Ada event spesial');
  if (context.isViral) kondisiText.push('Sedang viral');
  if (context.estimasiOrang > 30) kondisiText.push('Super ramai');
  else if (context.estimasiOrang > 15) kondisiText.push('Ramai');
  else if (context.estimasiOrang > 0 && context.estimasiOrang <= 8) kondisiText.push('Sepi');
  if (context.waitTime > 15) kondisiText.push(`Antrian panjang (${context.waitTime} menit)`);
  else if (context.waitTime > 0) kondisiText.push(`Antrian ${context.waitTime} menit`);
  if (context.isHujan) kondisiText.push('Hujan turun');
  if (context.isMacet) kondisiText.push('Macet');
  
  const kondisi = kondisiText.length > 0 ? kondisiText.join(', ') : 'Normal';
  const recentReport = context.recentReports[0] || 'Tidak ada laporan terbaru';
  
  return `Buatkan headline menarik untuk "${item.name}" (${item.category || 'tempat'}):

Kondisi: ${kondisi}
Waktu: ${waktu.nama}
Laporan terbaru: "${recentReport}"

Buat 1 headline engaging dengan emoji yang sesuai.
Gunakan bahasa yang natural dan engaging.
Jangan terlalu panjang (maks 55 karakter).`;
}

function getWaktuSekarang() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return { nama: 'pagi', icon: '🌅' };
  if (hour >= 11 && hour < 15) return { nama: 'siang', icon: '☀️' };
  if (hour >= 15 && hour < 19) return { nama: 'sore', icon: '🌆' };
  return { nama: 'malam', icon: '🌙' };
}