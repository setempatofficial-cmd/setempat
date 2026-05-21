import { NextResponse } from "next/server";

// Fungsi pembantu untuk memotong teks panjang berdasarkan tanda baca (. ! ?)
function splitTextIntoChunks(text, maxLength = 180) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += " " + sentence;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

export async function POST(req) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Teks kosong" }, { status: 400 });
    }

    // Potong teks menjadi bagian kecil agar tidak diblokir Google (max 180 karakter per chunk)
    const textChunks = splitTextIntoChunks(text, 180);
    const audioBuffers = [];

    // Ambil audio untuk setiap potongan teks
    for (const chunk of textChunks) {
      const googleTTSUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        chunk
      )}&tl=id&total=1&idx=0&textlen=${chunk.length}&client=tw-ob`;

      const response = await fetch(googleTTSUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36"
        }
      });

      if (!response.ok) {
        console.error("❌ Google TTS gagal pada chunk:", chunk);
        continue;
      }

      const buffer = await response.arrayBuffer();
      audioBuffers.push(Buffer.from(buffer));
    }

    if (audioBuffers.length === 0) {
      return NextResponse.json({ error: "Gagal memproses audio dari Google" }, { status: 500 });
    }

    // Gabungkan semua potongan audio menjadi satu file utuh
    const combinedBuffer = Buffer.concat(audioBuffers);
    
    return new NextResponse(combinedBuffer, {
      headers: { "Content-Type": "audio/mpeg" },
    });

  } catch (error) {
    console.error("❌ CRASH PADA GOOGLE API ROUTE:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}