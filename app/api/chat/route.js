import { GoogleGenerativeAI } from "@google/generative-ai";

// Pastikan API Key terbaca
const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// ... kode atas tetap sama ...

export async function POST(req) {
  try {
    const { message, tempat } = await req.json();

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.85, // Naikin dikit biar makin ekspresif logatnya
        maxOutputTokens: 250,
      },
    });

    // DETEKSI LOGAT JAWA TIMURAN
    const alamat = tempat?.alamat?.toLowerCase() || "";
    const namaTempat = tempat?.name || "tempat ini";
    
    let instruksiBahasa = "bahasa Indonesia santai dan gaul";

    // Cek keyword kota-kota di Jatim
    const isJatim = /jawa timur|surabaya|malang|sidoarjo|gresik|mojokerto|pasuruan|probolinggo|kediri|madiun|jember|banyuwangi/.test(alamat);

    if (isJatim) {
      instruksiBahasa = `
        Gaya bahasa Jawa Timuran (Suroboyoan/Malangan). 
        - Gunakan sapaan: 'Cak' (untuk laki-laki), 'Ning' (untuk perempuan), atau 'Rek' (umum).
        - Gunakan partikel khas Jatim: 'se', 'po'o', 'tah', 'wes'.
        - Gaya bicara: To-the-point, bersemangat, akrab banget kayak ke sahabat sendiri.
        - Contoh: 'Wes maem tah Rek?', 'Gak usah kesusu Cak, santai ae!', 'Vibe-nya ciamik pol!'
      `;
    }

    if (alamat.includes("jogja") || alamat.includes("sleman") || alamat.includes("bantul")) {
      gayaBahasa = "bahasa Indonesia campur sedikit bahasa Jawa halus/sedya (pake sapaan 'Lur', 'Mas', 'Mbak')";
    } else if (alamat.includes("bandung") || alamat.includes("jawa barat")) {
      gayaBahasa = "bahasa Indonesia santai dengan dialek Sunda (pake sapaan 'Kang', 'Teh', dan akhiran 'euy', 'mah')";
    } else if (alamat.includes("jakarta")) {
      gayaBahasa = "bahasa Indonesia dialek Jakarta (pake 'lo-gue', 'nih', 'deh')";
    } else if (alamat.includes("medan")) {
      gayaBahasa = "bahasa Indonesia dialek Medan yang tegas tapi akrab (pake 'wak', 'kelen', 'cemana')";
    }

    const prompt = `
      Kamu adalah warga lokal asli yang nongkrong di ${namaTempat}.
      Informasi lokasi: ${alamat}.
      Vibe saat ini: ${tempat?.vibe_status || 'Normal'}.

      ATURAN:
      1. Jawab pakai ${instruksiBahasa}.
      2. Jangan kaku, harus terlihat asik dan ngerti kondisi lapangan.
      3. Berikan informasi yang jujur tapi tetap bikin user tertarik mampir.

      Pertanyaan user: "${message}"
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return Response.json({ text });
  } catch (error) {
    console.error("ERROR NIH:", error);
    return Response.json({ text: "Waduh Rek, otaknya lagi murep, coba sediluk maneh yo!" });
  }
}