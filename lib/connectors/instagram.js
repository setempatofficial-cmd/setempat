// lib/connectors/instagram.js

/**
 * Fungsi untuk mencari mention Instagram berdasarkan lokasi
 * @param {Object} tempat - Data tempat { id, name, latitude, longitude }
 * @returns {Array} Array of signal objects
 */
export async function fetchInstagramMentions(tempat) {
  // Ini adalah MOCK DATA untuk testing
  // Nanti ganti dengan API Instagram sungguhan
  
  console.log(`🔍 Mencari mention Instagram untuk: ${tempat.name}`);
  
  // Data dummy berdasarkan nama tempat
  const mockSignals = [
    {
      tempat_id: tempat.id,
      source: 'instagram',
      source_id: `ig_${Date.now()}_1`,
      username: 'anakmuda_bangil',
      content: `Asik banget di ${tempat.name}! 🫶 #setempat #${tempat.name.replace(/\s+/g, '').toLowerCase()}`,
      media_url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500',
      post_url: 'https://instagram.com/p/example1',
      likes_count: Math.floor(Math.random() * 50) + 20,
      comments_count: Math.floor(Math.random() * 20) + 5,
      confidence: 0.95,
      created_at: new Date(),
      fetched_at: new Date()
    },
    {
      tempat_id: tempat.id,
      source: 'instagram',
      source_id: `ig_${Date.now()}_2`,
      username: 'kuliner_pasuruan',
      content: `Review ${tempat.name}: tempatnya cozy, cocok buat nongkrong! 👍`,
      media_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500',
      post_url: 'https://instagram.com/p/example2',
      likes_count: Math.floor(Math.random() * 80) + 30,
      comments_count: Math.floor(Math.random() * 30) + 8,
      confidence: 0.98,
      created_at: new Date(),
      fetched_at: new Date()
    }
  ];
  
  // Random: kadang return 1, kadang 2, kadang 0
  const random = Math.random();
  if (random < 0.3) {
    return [mockSignals[0]];
  } else if (random < 0.6) {
    return mockSignals;
  } else if (random < 0.8) {
    return [mockSignals[1]];
  } else {
    return []; // Tidak ada signal
  }
}

/**
 * Fungsi untuk mencari berdasarkan hashtag
 * @param {string} hashtag - Hashtag tanpa '#' 
 * @returns {Array} Array of signal objects
 */
export async function fetchInstagramByHashtag(hashtag) {
  console.log(`🔍 Mencari Instagram dengan hashtag: #${hashtag}`);
  
  // Mock data
  return [
    {
      source_id: `ig_hashtag_${Date.now()}`,
      username: 'warga_bangil',
      content: `Lagi ramai di #${hashtag} hari ini!`,
      media_url: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=500',
      post_url: 'https://instagram.com/p/example3',
      likes_count: 67,
      comments_count: 12,
      confidence: 0.85,
      created_at: new Date()
    }
  ];
}

/**
 * Fungsi untuk testing - panggil semua tempat
 * @param {Array} tempatList - List semua tempat dari database
 * @returns {Array} Array of all signals
 */
export async function fetchAllInstagramMentions(tempatList) {
  console.log(`🔍 Mencari mention Instagram untuk ${tempatList.length} tempat...`);
  
  let allSignals = [];
  
  for (const tempat of tempatList) {
    const signals = await fetchInstagramMentions(tempat);
    allSignals = [...allSignals, ...signals];
    
    // Delay kecil biar gak overload
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`✅ Ditemukan ${allSignals.length} mention Instagram`);
  return allSignals;
}