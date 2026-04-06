// app/api/groq-narasi/route.js
import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export async function POST(request) {
  try {
    const { prompt } = await request.json();
    
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Kamu adalah asisten yang mengubah laporan warga menjadi narasi tidak langsung yang singkat, hidup, dan natural. Maksimal 100 karakter. Jangan gunakan kutipan berlebihan."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.6,
      max_tokens: 80
    });
    
    const narasi = completion.choices[0]?.message?.content || "";
    
    return NextResponse.json({ narasi });
  } catch (error) {
    console.error('Groq narasi error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}