// /app/api/live-mode/route.ts

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'live_mode')
      .maybeSingle();

    if (error) {
      console.error('❌ [API GET] Error:', error);
      return NextResponse.json({ mode: 'free' });
    }

    if (data && data.value) {
      console.log('✅ [API GET] Found mode:', data.value);
      return NextResponse.json({ mode: data.value });
    }

    return NextResponse.json({ mode: 'free' });
    
  } catch (err) {
    console.error('❌ [API GET] Error:', err);
    return NextResponse.json({ mode: 'free' });
  }
}

export async function POST(request: Request) {
  try {
    const { mode } = await request.json();
    
    console.log('📝 [API POST] Saving mode:', mode);
    
    if (!mode || !['free', 'premium'].includes(mode)) {
      return NextResponse.json(
        { error: 'Mode harus "free" atau "premium"' },
        { status: 400 }
      );
    }

    // 🔥 AMBIL TOKEN DARI HEADER
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    
    console.log('🔐 Token from header:', token ? '✅ Ada' : '❌ Tidak ada');

    // 🔥 SET SESSION DENGAN TOKEN
    if (token) {
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: token,
        refresh_token: ''
      });
      
      if (setSessionError) {
        console.error('❌ Set session error:', setSessionError);
      }
    }

    // 🔥 CEK SESSION
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    console.log('👤 User session:', session?.user?.email || 'Tidak ada session');
    console.log('❌ Session error:', sessionError);

    // 🔥 Jika tidak ada session, coba dengan service role (bypass RLS)
    if (!session) {
      console.log('⚠️ No session, trying with service role...');
      
      // Gunakan Supabase dengan Service Role Key
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (supabaseServiceKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });
        
        const { data, error } = await supabaseAdmin
          .from('app_settings')
          .upsert(
            { 
              key: 'live_mode', 
              value: mode,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'key' }
          )
          .select();

        if (error) {
          console.error('❌ [API POST] Service role error:', error);
          return NextResponse.json(
            { error: 'Gagal menyimpan: ' + error.message },
            { status: 500 }
          );
        }

        console.log('✅ [API POST] Saved with service role:', data);
        return NextResponse.json({ 
          success: true, 
          mode: mode 
        });
      }
      
      return NextResponse.json(
        { error: 'Anda harus login terlebih dahulu' },
        { status: 401 }
      );
    }

    // 🔥 SIMPAN DENGAN SESSION YANG ADA
    const { data, error } = await supabase
      .from('app_settings')
      .upsert(
        { 
          key: 'live_mode', 
          value: mode,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'key' }
      )
      .select();

    if (error) {
      console.error('❌ [API POST] Error:', error);
      return NextResponse.json(
        { error: 'Gagal menyimpan: ' + error.message },
        { status: 500 }
      );
    }

    console.log('✅ [API POST] Saved:', data);
    return NextResponse.json({ 
      success: true, 
      mode: mode 
    });
    
  } catch (err) {
    console.error('❌ [API POST] Error:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan: ' + String(err) },
      { status: 500 }
    );
  }
}