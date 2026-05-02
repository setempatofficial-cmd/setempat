import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

// POST - Membuat produk baru (CREATE)
export async function POST(request) {
  try {
    const body = await request.json();
    const { nama_barang, harga, satuan, deskripsi, foto_url, tempat_id, user_id } = body;
    
    // Validasi input
    if (!nama_barang || !harga || !user_id) {
      return NextResponse.json(
        { error: 'Nama barang, harga, dan user_id wajib diisi' },
        { status: 400 }
      );
    }
    
    // Simpan ke Supabase
    const { data, error } = await supabase
      .from('produk')
      .insert([
        {
          nama_barang,
          harga: parseFloat(harga),
          satuan: satuan || 'Per Kg',
          deskripsi: deskripsi || '',
          foto_url: foto_url || [],
          tempat_id: tempat_id || null,
          user_id,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select();
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Error POST /api/produk:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Mengupdate produk (EDIT)
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, nama_barang, harga, satuan, deskripsi, foto_url } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID produk wajib diisi' },
        { status: 400 }
      );
    }
    
    // Update ke Supabase
    const { data, error } = await supabase
      .from('produk')
      .update({
        nama_barang,
        harga: parseFloat(harga),
        satuan: satuan || 'Per Kg',
        deskripsi: deskripsi || '',
        foto_url: foto_url || [],
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error PUT /api/produk:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET - Mendapatkan produk (untuk list)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    
    let query = supabase.from('produk').select('*');
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error GET /api/produk:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Menghapus produk
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID produk wajib diisi' },
        { status: 400 }
      );
    }
    
    const { error } = await supabase
      .from('produk')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, message: 'Produk berhasil dihapus' });
  } catch (error) {
    console.error('Error DELETE /api/produk:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}