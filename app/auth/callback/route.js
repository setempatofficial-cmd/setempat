import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin; // Ambil domain yang sedang aktif

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
            } catch (error) {
              // Middleware Next.js terkadang membatasi set cookies di GET, 
              // tapi exchangeCodeForSession biasanya tetap berhasil menyimpan session.
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Gunakan origin agar selalu pulang ke domain yang benar
      return NextResponse.redirect(new URL('/', origin));
    }
  }

  // Jika error, pulangkan juga ke home
  return NextResponse.redirect(new URL('/', origin));
}