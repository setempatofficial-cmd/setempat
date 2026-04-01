// app/api/groq-headline/route.js
import { NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Model yang lebih cepat dan murah
const MODEL = 'llama-3.1-8b-instant'; // Lebih cepat dari mixtral

// Cache sederhana untuk mengurangi panggilan API
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 menit

export async function POST(request) {
  try {
    const { item, context } = await request.json();
    
    if (!item?.name) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    
    // Generate cache key
    const cacheKey = `${item.id}_${item.updated_at || ''}_${context.estimasiOrang || ''}_${context.waitTime || ''}`;
    
    // Cek cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ headline: cached.headline });
    }
    
    const prompt = buildPrompt(item, context);
    
    // Timeout untuk menghindari hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
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
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Groq API error:', error);
      throw new Error('Groq API error');
    }
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON response
    let headline;
    try {
      headline = JSON.parse(content);
    } catch (e) {
      // Fallback: ekstrak dari teks
      const cleanText = content
        .replace(/[{}]/g, '')
        .replace(/text[":]/g, '')
        .trim()
        .substring(0, 55);
      headline = {
        text: cleanText || 'Update terkini',
        type: 'ai_generated',
        icon: '🤖'
      };
    }
    
    // Validate headline
    if (!headline.text || headline.text.length === 0) {
      headline.text = 'Ada update baru di sekitar';
    }
    if (headline.text.length > 60) {
      headline.text = headline.text.substring(0, 57) + '...';
    }
    
    // Tambahkan emoji jika tidak ada
    if (!headline.icon || headline.icon === '') {
      const emojiMap = {
        event: '🎉',
        viral: '🔥',
        ramai: '🏃',
        sepi: '🍃',
        antrian: '⏳',
        hujan: '🌧️',
        macet: '🚗',
        kuliner: '🍽️'
      };
      headline.icon = emojiMap[headline.type] || '📍';
    }
    
    // Simpan ke cache
    cache.set(cacheKey, {
      headline,
      timestamp: Date.now()
    });
    
    return NextResponse.json({ headline });
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Groq request timeout');
      return NextResponse.json({ 
        headline: {
          text: 'Update terkini',
          type: 'fallback',
          icon: '📍'
        }
      }, { status: 200 });
    }
    
    console.error('Groq headline error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function buildPrompt(item, context) {
  const waktu = getWaktuSekarang();
  
  // Kumpulkan kondisi yang relevan
  const kondisiList = [];
  
  if (context.hasEvent) kondisiList.push('🎉 Ada event spesial');
  if (context.isViral) kondisiList.push('🔥 Sedang viral di medsos');
  if (context.estimasiOrang > 50) kondisiList.push('🔥🔥 Super ramai');
  else if (context.estimasiOrang > 30) kondisiList.push('🏃 Sangat ramai');
  else if (context.estimasiOrang > 15) kondisiList.push('👥 Ramai');
  else if (context.estimasiOrang > 0 && context.estimasiOrang <= 8) kondisiList.push('🍃 Sepi');
  
  if (context.waitTime > 30) kondisiList.push(`🐢 Antrian panjang (${context.waitTime} menit)`);
  else if (context.waitTime > 15) kondisiList.push(`⏳ Antrian ${context.waitTime} menit`);
  else if (context.waitTime > 0) kondisiList.push(`⚡ Antrian pendek (${context.waitTime} menit)`);
  
  if (context.isHujan) kondisiList.push('🌧️ Hujan turun');
  if (context.isMacet) kondisiList.push('🚦 Macet');
  
  const kondisi = kondisiList.length > 0 ? kondisiList.join(' • ') : 'Kondisi normal';
  const recentReport = context.recentReports?.[0] || '';
  
  // Jika ada laporan warga, jadikan inspirasi utama
  const reportHint = recentReport 
    ? `\n\nLaporan warga terbaru: "${recentReport.substring(0, 80)}"` 
    : '';
  
  // Tambahkan info tambahan
  const extraInfo = [];
  if (item.category) extraInfo.push(`kategori: ${item.category}`);
  if (context.hasLaporanHariIni > 1) extraInfo.push(`${context.hasLaporanHariIni} laporan hari ini`);
  
  return `Buatkan headline menarik untuk "${item.name}"${extraInfo.length ? ` (${extraInfo.join(', ')})` : ''}:

📊 Kondisi: ${kondisi}
⏰ Waktu: ${waktu.nama}${reportHint}

📝 INSTRUKSI:
1. Buat 1 headline engaging dengan emoji
2. Maksimal 55 karakter
3. Fokus ke SUASANA, bukan angka (kecuali antrian)
4. Gunakan bahasa santai seperti ngobrol
5. Jangan ulang kata "Update"

Format response JSON: {"text": "headline", "type": "jenis", "icon": "emoji"}`;
}

function getWaktuSekarang() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return { nama: 'pagi', icon: '🌅' };
  if (hour >= 11 && hour < 15) return { nama: 'siang', icon: '☀️' };
  if (hour >= 15 && hour < 19) return { nama: 'sore', icon: '🌆' };
  return { nama: 'malam', icon: '🌙' };
}