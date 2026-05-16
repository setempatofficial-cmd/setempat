// app/api/groq-story/route.ts
import { groq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { NextResponse } from 'next/server';

export const maxDuration = 30;
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { 
      tempatName, 
      kategori, 
      signals, 
      comments,
      laporanWarga,
      placeHistory,
      metadata,
      aktivitasBerkala,
      layananWarga,
      umkmProduk,
      aktivitasWarga,
      prediksi,
      tempatTerhubung, // 👈 TAMBAHKAN INI!
      kondisi,
      modelType = '8b',
      storyVersion = 0 // 👈 TAMBAHKAN VERSI CERITA
    } = await req.json();

    const model = modelType === '70b' 
      ? groq('llama-3.3-70b-versatile')
      : groq('llama-3.1-8b-versatile');

    // ============================================
    // DETEKSI DARURAT
    // ============================================
    const emergencyKeywords = [
      'kecelakaan', 'truk', 'korban', 'luka', 'medis', 'darurat',
      'ambulans', 'tabrakan', 'terluka', 'patah', 'berdarah',
      'banjir', 'kebakaran', 'longsor', 'gempa'
    ];

    const allTexts = [
      ...(laporanWarga || []).map(l => `${l.deskripsi || ''} ${l.content || ''} ${l.judul || ''}`),
      ...(signals || []).map(s => s.content || ''),
      ...(comments || []).map(c => c.content || '')
    ].join(' ').toLowerCase();

    const hasEmergency = emergencyKeywords.some(kw => allTexts.includes(kw));
    
    // Ekstrak detail darurat
    let emergencyDetails = '';
    if (hasEmergency) {
      const emergencyReports = [...(laporanWarga || []), ...(signals || [])].filter(item => {
        const text = `${item.deskripsi || ''} ${item.content || ''}`.toLowerCase();
        return emergencyKeywords.some(kw => text.includes(kw));
      });
      if (emergencyReports.length > 0) {
        emergencyDetails = emergencyReports.map(r => r.deskripsi || r.content).join(' | ');
      }
    }

    // ============================================
    // GAYA CERITA BERDASARKAN VERSI
    // ============================================
    const storyStyles = [
      { name: 'santai', temperature: 0.9, vibe: 'cerita kayak lagi ngopi bareng, santai, kadang guyon' },
      { name: 'detail', temperature: 0.5, vibe: 'detail analitis, seperti laporan intelijen, pakai bullet points' },
      { name: 'singkat', temperature: 0.4, vibe: 'to the point, langsung ke inti, tidak bertele-tele' },
      { name: 'bersemangat', temperature: 1.0, vibe: 'energik, hype, memotivasi, pakai kata-kata penyemangat' },
      { name: 'bijak', temperature: 0.6, vibe: 'seperti petuah mbah, penuh nasihat dan kearifan lokal' },
    ];
    
    const currentStyle = storyStyles[storyVersion % storyStyles.length];
    
    // Temperature untuk darurat (tetap serius, tidak peduli versi)
    const finalTemperature = hasEmergency ? 0.3 : currentStyle.temperature;

    // ============================================
    // SYSTEM PROMPT (VERSI RINGKAS & FOKUS)
    // ============================================
    const systemPrompt = `Kamu Mbah AI, penjaga informasi warga Setempat.id.

GAYA: Jawa Timuran (Cak/Mbakyu/Lur). ${currentStyle.vibe}

TUGAS: Ceritakan kondisi ${tempatName} berdasarkan data yang diberikan.

ATURAN:
1. Gunakan data tempat terhubung untuk MEMPERKAYA cerita, BUKAN mengganti fokus
   - Salah: "POM Bensin lagi macet"
   - Benar: "SPBU rame, soale POM Bensin 500m dari sini lagi macet"
2. JANGAN ulang data mentah, jadikan cerita
3. ${hasEmergency ? 'RESPON DARURAT! JANGAN bilang normal!' : 'Buat penasaran, ajak interaksi'}

FORMAT:
[SAPAN] + emoji
[Cerita utama - maksimal 3 kalimat]
[Saran/ajakan]
"Ono sing arep ditakokke? Klik 🧠"`;

    // ============================================
    // BUILD USER PROMPT (DIPERKAYA DENGAN TEMPAT TERHUBUNG)
    // ============================================
    let userPrompt = `Ceritakan kondisi **${tempatName}**.\n\n`;

    // PERINGATAN DARURAT
    if (hasEmergency) {
      userPrompt += `🚨 DARURAT: ${emergencyDetails.substring(0, 200)}\n\n`;
    }

    // METADATA & KARAKTER
    if (metadata) {
      userPrompt += `TEMPAT: ${metadata.tipe_utama || 'Umum'}`;
      if (metadata.kapasitas_normal) userPrompt += `, kapasitas ${metadata.kapasitas_normal} orang`;
      userPrompt += `\n`;
    }

    // LAPORAN WARGA (jangan terlalu banyak)
    if (laporanWarga?.length > 0) {
      userPrompt += `\nLAPORAN:\n`;
      laporanWarga.slice(0, 4).forEach((l: any) => {
        userPrompt += `- "${l.deskripsi || l.content?.substring(0, 100)}"\n`;
      });
    }

    // SIGNAL EKSTERNAL
    if (signals?.length > 0) {
      signals.slice(0, 2).forEach((s: any) => {
        userPrompt += `- (dari ${s.source || 'medsos'}) "${s.content?.substring(0, 80)}"\n`;
      });
    }

    // 👇 INI YANG PALING PENTING: TEMPAT TERHUBUNG SEBAGAI KONTEKS PENJELAS
    if (tempatTerhubung && tempatTerhubung.length > 0) {
      userPrompt += `\n🔗 KONTEKS DARI TEMPAT TERDEKAT (pakai ini untuk memperkaya cerita, BUKAN mengganti fokus dari ${tempatName}):\n`;
      tempatTerhubung.slice(0, 3).forEach((k: any) => {
        const tempatLain = k.tempat_terkait;
        if (tempatLain) {
          userPrompt += `- ${tempatLain.name} berjarak ${k.jarak_km}km, kondisinya ${tempatLain.latest_condition || 'normal'}`;
          if (k.tingkat_pengaruh_t1_ke_t2) {
            userPrompt += ` (berdampak ${Math.round(k.tingkat_pengaruh_t1_ke_t2 * 100)}% ke ${tempatName})`;
          }
          userPrompt += `\n`;
        }
      });
      userPrompt += `\nGunakan info ini sebagai ALASAN/PENJELAS kenapa ${tempatName} seperti sekarang. JANGAN ceritakan tempat lain secara berlebihan!\n`;
    }

    // AKTIVITAS RUTIN (penjelasan pola)
    if (aktivitasBerkala?.length > 0) {
      userPrompt += `\nAKTIVITAS RUTIN DI SINI:\n`;
      aktivitasBerkala.slice(0, 2).forEach((a: any) => {
        userPrompt += `- ${a.nama_aktivitas} (${a.hari || 'rutin'})\n`;
      });
    }

    // PREDIKSI
    if (prediksi?.length > 0) {
      const now = new Date();
      const currentHour = now.getHours();
      const prediksiSekarang = prediksi.find((p: any) => {
        const jamPrediksi = parseInt(p.jam_prediksi?.split(':')[0] || '0');
        return Math.abs(currentHour - jamPrediksi) <= 2;
      });
      if (prediksiSekarang) {
        userPrompt += `\nPREDIKSI: ${prediksiSekarang.prediksi_kondisi} (${Math.round((prediksiSekarang.prediksi_skor || 0.5) * 100)}%)\n`;
      }
    }

    // LAYANAN WARGA & UMKM (sedikit saja)
    if (layananWarga?.length > 0 && !hasEmergency) {
      const rewang = layananWarga.find((l: any) => l.kategori_layanan === 'rewang');
      if (rewang) userPrompt += `\nLAYANAN: Rewang tersedia (respon ${rewang.estimasi_waktu_respon_menit || 'cepat'} menit)\n`;
    }

    if (umkmProduk?.length > 0 && !hasEmergency) {
      userPrompt += `\nUMKM: ${umkmProduk.slice(0, 2).map((u: any) => u.nama_produk).join(', ')}\n`;
    }

    // KALAU TIDAK ADA DATA
    if ((laporanWarga?.length || 0) + (signals?.length || 0) === 0) {
      userPrompt += `\n⚠️ BELUM ADA LAPORAN. Ajak warga untuk melapor!`;
    }

    // INSTRUKSI KHUSUS BERDASARKAN VERSI
    userPrompt += `\n\n🎨 GAYA CERITA: ${currentStyle.name.toUpperCase()} - ${currentStyle.vibe}`;
    userPrompt += `\n\nMulai cerita dengan SAPAN (Selamat [waktu] Cak/Mbakyu!) lalu ceritakan kondisi ${tempatName} dengan gaya tersebut. JANGAN terlalu panjang!`;

    // ============================================
    // STREAMING RESPONSE
    // ============================================
    const result = streamText({
      model: model,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: finalTemperature,
      maxTokens: 450,
    });

    return result.toDataStreamResponse();

  } catch (error) {
    console.error('Groq API Error:', error);
    return NextResponse.json(
      { error: 'Mbah AI lagi sibuk lur, coba sedilit maneh yok!' },
      { status: 500 }
    );
  }
}