import { NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function POST(request) {
  try {
    const { prompt, context, model, temperature, maxTokens } = await request.json();

    // Validasi input
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required', suggestions: [] },
        { status: 400 }
      );
    }

    // Cek API key
    if (!GROQ_API_KEY) {
      console.error('GROQ_API_KEY is not configured in environment variables');
      return NextResponse.json(
        { error: 'GROQ API key not configured', suggestions: [] },
        { status: 500 }
      );
    }

    // Prepare context dengan fallback values
    const safeContext = {
      time: context?.time || new Date().toLocaleTimeString('id-ID'),
      day: context?.day || new Date().toLocaleDateString('id-ID', { weekday: 'long' }),
      location: context?.location || 'Indonesia',
      ...context
    };

    // Optimasi prompt untuk lebih hemat token
    const systemPrompt = `You are a helpful assistant for a local discovery app in Indonesia.
Provide 3-5 relevant search keywords about places, atmosphere, or current conditions.
Rules:
- Respond in Indonesian language
- Format: just keywords separated by commas
- Keep each keyword under 30 characters
- Be concise and practical

Context: ${safeContext.time}, ${safeContext.day} in ${safeContext.location}`;

    const userPrompt = prompt.length > 100 ? prompt.substring(0, 100) : prompt;

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'mixtral-8x7b-32768',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: temperature || 0.7,
        max_tokens: maxTokens || 100,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GROQ API error:', response.status, errorText);
      
      // Return empty suggestions instead of error
      return NextResponse.json(
        { 
          error: `API error: ${response.status}`,
          suggestions: [] 
        },
        { status: 200 } // Return 200 with empty suggestions to avoid client error
      );
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || '';
    
    // Parse suggestions dengan lebih robust
    let suggestionsArray = [];
    
    if (aiResponse) {
      // Split by comma, newline, or Indonesian comma
      suggestionsArray = aiResponse
        .split(/[,،\n\r]+/)
        .map(s => s.trim())
        .filter(s => {
          // Filter empty strings and very long strings
          return s.length > 0 && s.length < 60;
        })
        .slice(0, 5);
      
      // Jika tidak ada hasil dari parsing, coba gunakan raw response
      if (suggestionsArray.length === 0 && aiResponse.length > 0) {
        suggestionsArray = [aiResponse.substring(0, 50)];
      }
    }

    // Log untuk debugging
    console.log('AI Suggestions generated:', suggestionsArray);

    return NextResponse.json({ 
      suggestions: suggestionsArray,
      success: true
    });
    
  } catch (error) {
    console.error('GROQ route error:', error);
    
    // Return empty suggestions on error
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        suggestions: [] 
      },
      { status: 200 } // Return 200 with empty suggestions
    );
  }
}