import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { text, prompt } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Cek apakah API key tersedia
    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY is not set');
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-oss-20b',
        messages: [
          {
            role: 'system',
            content: 'Anda adalah asisten yang membantu mengekstrak nama lokasi dari teks bahasa Indonesia. Hanya balas dengan nama lokasi yang diekstrak, tanpa kalimat tambahan. Jika tidak ada lokasi yang jelas, balas dengan "tidak ditemukan".'
          },
          {
            role: 'user',
            content: prompt || `Ekstrak nama lokasi dari teks berikut. Hanya balas dengan nama lokasi, tanpa kalimat tambahan. Teks: "${text}"`
          }
        ],
        temperature: 0.1,
        max_tokens: 50,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Groq API Error Response:', errorData);
      
      // Jika quota habis atau error lain, fallback ke ekstraksi manual
      return NextResponse.json({
        location: extractLocationManually(text),
        fallback: true
      });
    }

    const data = await response.json();
    const location = data.choices?.[0]?.message?.content?.trim() || '';

    // Jika hasilnya "tidak ditemukan" atau kosong, coba manual
    if (location.toLowerCase() === 'tidak ditemukan' || !location) {
      const manualLocation = extractLocationManually(text);
      return NextResponse.json({ 
        location: manualLocation,
        fallback: true
      });
    }

    return NextResponse.json({ 
      location: location,
      fallback: false
    });

  } catch (error) {
    console.error('Groq API Error:', error);
    
    // Fallback: ekstrak manual jika API gagal
    try {
      const { text } = await request.json();
      const manualLocation = extractLocationManually(text);
      return NextResponse.json({ 
        location: manualLocation,
        fallback: true
      });
    } catch {
      return NextResponse.json(
        { error: 'Failed to extract location' },
        { status: 500 }
      );
    }
  }
}

// Fungsi fallback untuk ekstrak lokasi secara manual
function extractLocationManually(text) {
  // Hilangkan kata-kata yang tidak penting
  const stopwords = ['yang', 'dan', 'di', 'ke', 'dari', 'pada', 'ini', 'itu', 'untuk', 'dengan', 'oleh', 'sebagai', 'atau', 'jika', 'maka', 'saya', 'kami', 'kita', 'ada', 'banyak', 'sangat', 'cukup', 'terlalu', 'begitu', 'sekali', 'seperti', 'karena', 'namun', 'tetapi', 'sedangkan'];
  
  // Split teks menjadi kata-kata
  const words = text.toLowerCase().split(/\s+/);
  
  // Cari kata-kata yang berpotensi sebagai nama tempat
  const potentialLocations = [];
  let currentPhrase = [];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[.,!?;:()"]/g, '');
    
    // Jika kata adalah stopword dan currentPhrase tidak kosong, simpan phrase
    if (stopwords.includes(word) || word.length < 3) {
      if (currentPhrase.length > 0) {
        const phrase = currentPhrase.join(' ');
        if (phrase.length > 3 && !potentialLocations.includes(phrase)) {
          potentialLocations.push(phrase);
        }
        currentPhrase = [];
      }
      continue;
    }
    
    // Jika kata diawali huruf kapital (di teks asli), itu indikasi nama tempat
    const originalText = text.split(/\s+/)[i] || '';
    if (originalText && originalText[0] === originalText[0].toUpperCase() && word.length > 2) {
      if (currentPhrase.length > 0) {
        const phrase = currentPhrase.join(' ');
        if (phrase.length > 3 && !potentialLocations.includes(phrase)) {
          potentialLocations.push(phrase);
        }
        currentPhrase = [];
      }
      currentPhrase.push(word);
    } else {
      currentPhrase.push(word);
    }
  }
  
  // Jangan lupa phrase terakhir
  if (currentPhrase.length > 0) {
    const phrase = currentPhrase.join(' ');
    if (phrase.length > 3 && !potentialLocations.includes(phrase)) {
      potentialLocations.push(phrase);
    }
  }
  
  // Cari kata kunci lokasi
  const locationKeywords = ['jalan', 'desa', 'kecamatan', 'kabupaten', 'kota', 'pasar', 'stasiun', 'terminal', 'bandara', 'alun-alun', 'taman', 'masjid', 'gereja', 'sekolah', 'kampus', 'rumah sakit', 'puskesmas', 'mall', 'supermarket', 'toko', 'warung', 'restoran', 'kafe'];
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const loc of potentialLocations) {
    let score = loc.length / 10; // Length score
    
    for (const keyword of locationKeywords) {
      if (loc.includes(keyword)) {
        score += 2;
      }
    }
    
    // Cek apakah ada kata yang mirip dengan keyword
    const wordsInLoc = loc.split(' ');
    for (const word of wordsInLoc) {
      for (const keyword of locationKeywords) {
        if (keyword.includes(word) || word.includes(keyword)) {
          score += 1.5;
          break;
        }
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = loc;
    }
  }
  
  // Jika ada hasil dengan score yang cukup, return
  if (bestMatch && bestScore > 1) {
    // Capitalize first letter of each word
    return bestMatch.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }
  
  // Fallback: ambil 2-3 kata pertama yang bukan stopword
  const filteredWords = words.filter(w => 
    w.length > 3 && !stopwords.includes(w) && !w.match(/^[0-9]+$/)
  );
  
  if (filteredWords.length > 0) {
    const result = filteredWords.slice(0, 3).join(' ');
    return result.charAt(0).toUpperCase() + result.slice(1);
  }
  
  return null;
}