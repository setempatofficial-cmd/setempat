'use server'
import { createClient } from '@supabase/supabase-js'

export async function updatePhotos(tempatId, newPhoto) {
  const supabase = createClient()

  // 1. Ambil data photos yang sudah ada dulu (agar tidak menimpa foto lama)
  const { data: tempat, error: fetchError } = await supabase
    .from('tempat')
    .select('photos')
    .eq('id', tempatId)
    .single()

  if (fetchError) return { success: false, error: fetchError.message }

  // 2. Gabungkan foto lama dengan foto baru dari Cloudinary
  // Jika photos masih kosong (null), buat array baru
  const updatedPhotos = tempat.photos ? [...tempat.photos, newPhoto] : [newPhoto]

  // 3. Simpan kembali ke database
  const { error: updateError } = await supabase
    .from('tempat')
    .update({ photos: updatedPhotos })
    .eq('id', tempatId)

  if (updateError) return { success: false, error: updateError.message }

  return { success: true }
}