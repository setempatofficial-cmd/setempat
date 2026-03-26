// app/api/chat/route.js
// Groq API — gratis, tidak butuh kartu kredit
// Daftar: console.groq.com → API Keys → Create API Key
// .env.local: GROQ_API_KEY=gsk_...

// ── Rate limiting sederhana (in-memory) ──────────────────────────────────────
// Max 10 request per IP per menit, max 30 per hari
const rateLimitMap = new Map(); // { ip: { count, resetAt, dailyCount, dayResetAt } }

const LIMIT_PER_MINUTE = 10;
const LIMIT_PER_DAY    = 30;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || {
    count: 0,        resetAt: now + 60_000,
    dailyCount: 0,   dayResetAt: now + 86_400_000,
  };

  // Reset per menit
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 60_000;
  }
  // Reset per hari
  if (now > entry.dayResetAt) {
    entry.dailyCount = 0;
    entry.dayResetAt = now + 86_400_000;
  }

  entry.count++;
  entry.dailyCount++;
  rateLimitMap.set(ip, entry);

  if (entry.count > LIMIT_PER_MINUTE) return "minute";
  if (entry.dailyCount > LIMIT_PER_DAY) return "day";
  return null;
}

// Bersihkan map setiap jam agar tidak memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.dayResetAt) rateLimitMap.delete(ip);
  }
}, 3_600_000);

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req) {
  try {
    // Ambil IP user
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "unknown";

    // Cek rate limit
    const limited = checkRateLimit(ip);
    if (limited === "minute") {
      return Response.json({
        text: "Pelan-pelan, Lur! Terlalu banyak pertanyaan dalam 1 menit. Tunggu sebentar ya 😅",
      });
    }
    if (limited === "day") {
      return Response.json({
        text: "Kuota harian AI sudah habis, Lur. Coba lagi besok ya! 🙏",
      });
    }

    const { message, context, tempat } = await req.json();

    if (!message?.trim()) {
      return Response.json({ error: "Pesan kosong" }, { status: 400 });
    }

    // Batasi panjang pesan dari user — cegah token boros
    const safeMessage = message.trim().slice(0, 300);

    const tempatCtx = tempat
      ? `Tempat: ${tempat.name} (${tempat.category || "umum"}, ${tempat.alamat?.split(",")[0] || "setempat"})`
      : "Tidak ada tempat spesifik, jawab soal kondisi wilayah umum.";

    const systemPrompt = `Kamu AI Setempat — asisten kondisi real-time lokal Indonesia.
Panggil user "Warga Setempat". Bahasa santai Jawa Timur.
Fokus: kondisi SEKARANG (ramai/sepi, macet/lancar, cuaca). BUKAN rekomendasi tempat.
Jawab maksimal 2-3 kalimat singkat. Pakai emoji kondisi seperlunya.
Kalau tidak tahu kondisi terkini, jujur dan minta user lapor.
${tempatCtx}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 200,       // hemat token — cukup 2-3 kalimat
        temperature: 0.6,      // sedikit lebih deterministic
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: safeMessage },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("Groq API error:", err);
      if (response.status === 429) {
        return Response.json({
          text: "AI-nya lagi sibuk, Lur. Coba lagi sebentar ya! 🙏",
        });
      }
      throw new Error(err.error?.message || "Groq API error");
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim()
      || "Maaf, tidak ada jawaban dari AI.";

    return Response.json({ text });

  } catch (error) {
    console.error("Chat route error:", error.message);
    return Response.json({
      text: "Maaf, AI Setempat lagi gangguan sebentar. Coba lagi ya, Lur! 🙏",
    });
  }
}
