import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch (error) { /* Bisa diabaikan saat redirect */ }
          },
        },
      }
    );

    // Proses tukar kode jadi session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // PAKSA pulang ke halaman utama (Localhost:3000 / Setempat.id)
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Jika error, arahkan ke home juga agar user tidak bingung di halaman 404
  return NextResponse.redirect(new URL('/', request.url));
}