// app/api/tempat/[id]/photos/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request, { params }) {
    try {
        // ✅ Unwrap params untuk Next.js 13+
        const unwrappedParams = await params;
        const id = unwrappedParams.id;
        
        // ✅ Validasi ID
        if (!id || isNaN(parseInt(id))) {
            return NextResponse.json(
                { error: 'Invalid tempat ID' },
                { status: 400 }
            );
        }
        
        const tempatId = parseInt(id);
        
        // ✅ Fetch official photos dari database
        const { data: tempat, error: tempatError } = await supabase
            .from('tempat')
            .select('photos, official_photos, name')
            .eq('id', tempatId)
            .single();
        
        if (tempatError || !tempat) {
            console.error('[API] Tempat not found:', tempatId);
            return NextResponse.json(
                { error: 'Tempat not found' },
                { status: 404 }
            );
        }
        
        // ✅ Format response
        let photos = [];
        
        if (tempat.official_photos && Array.isArray(tempat.official_photos)) {
            photos = tempat.official_photos;
        } else if (tempat.photos && Array.isArray(tempat.photos)) {
            photos = tempat.photos;
        }
        
        // ✅ Filter valid photos
        const validPhotos = photos.filter(photo => 
            photo && typeof photo === 'string' && photo.startsWith('http')
        );
        
        return NextResponse.json({
            success: true,
            photos: validPhotos,
            total: validPhotos.length,
            tempatName: tempat.name
        });
        
    } catch (error) {
        console.error('[API] Error fetching official photos:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}