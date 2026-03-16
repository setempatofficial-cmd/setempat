import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req) {
  try {
    const { message, tempat } = await req.json();

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash", 
      generationConfig: {
        temperature: 0.85, 
        maxOutputTokens: 300,
      },
    });

    // 1. IDENTITAS LOKASI & KATEGORI
    const nama = tempat?.name || "tempat ini";
    const kategori = tempat?.category || "Umum";
    const alamat = tempat?.alamat || "Pasuruan";
    const vibe = tempat?.vibe_status || "Normal";
    const deskripsi = tempat?.description || "";

    // 2. LOGIKA KEPRIBADIAN (BEHAVIOR)
    let instruksiKepribadian = "";
    switch (kategori) {
      case 'Rumah Sakit':
        instruksiKepribadian = "Kamu asisten medis yang empati dan tenang. Fokus pada info bantuan dan operasional. Jangan terlalu banyak bercanda.";
        break;
      case 'Stadion':
        instruksiKepribadian = "Kamu suporter fanatik lokal (Persekabpas). Nada bicara semangat, enerjik, dan pakai istilah bola.";
        break;
      case 'Stasiun Kereta Api':
        instruksiKepribadian = "Kamu petugas informasi yang sigap. Bantu soal jadwal dan akses transportasi dengan jelas.";
        break;
      case 'Kuliner Legendaris':
        instruksiKepribadian = "Kamu pecinta kuliner (foodie) lokal yang tahu sejarah rasa tempat ini. Ceritakan dengan antusias.";
        break;
      default:
        instruksiKepribadian = "Kamu warga lokal yang asik, ramah, dan tahu seluk beluk tempat ini.";
    }

    // 3. LOGIKA VIBE (SITUASI REAL-TIME)
    let instruksiVibe = "";
    if (vibe === 'Rame Pol') instruksiVibe = "Kondisi lagi ramai banget, sarankan user untuk bersabar atau cari waktu lain.";
    if (vibe === 'Udan Deras') instruksiVibe = "Lagi hujan lebat, ingatkan user bawa payung atau berteduh dulu.";
    if (vibe === 'Sumuk Banget') instruksiVibe = "Cuaca lagi panas terik khas Pasuruan, sarankan cari minuman segar.";

    // 4. PEMBENTUKAN PROMPT FINAL
    const prompt = `
      PERAN: ${instruksiKepribadian}
      LOKASI: ${nama} (${kategori}).
      DESKRIPSI: ${deskripsi}.
      VIBE SAAT INI: ${vibe}. ${instruksiVibe}

      ATURAN BAHASA:
      - Gunakan gaya bahasa Jawa Timuran khas Pasuruan (Suroboyoan).
      - Gunakan sapaan: 'Cak', 'Ning', atau 'Rek'.
      - Gunakan partikel: 'se', 'tah', 'wes', 'po'o'.
      - Gaya bicara: To-the-point, akrab, dan informatif.

      Pertanyaan User: "${message}"
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return Response.json({ text });
  } catch (error) {
    console.error("AI_ERROR:", error);
    return Response.json({ text: "Waduh Rek, sistem lagi ngelu. Coba sediluk maneh yo!" }, { status: 500 });
  }
}