// lib/v2/storyFilter.js

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const getProminenceScore = (place) => {
  if (!place) return 0;
  let score = 0;
  if (place.isViral) score += 100;
  if (place.isRamai) score += 50;
  if (place.hasRecentWargaReport) score += 30;
  const reportCount = Math.min((place.laporan_terbaru || []).length, 5);
  score += reportCount * 5;
  score += Math.min(Math.floor((place.viewingCount || 0) / 5), 20);
  score += Math.min(place.vibe_count || 0, 15);
  return score;
};

export const getProminentPlacesInRadius = (allPlaces, userLocation, radiusKm = 5) => {
  // ✅ Guard: pastikan input valid
  if (!allPlaces || !Array.isArray(allPlaces) || allPlaces.length === 0) {
    return [];
  }
  
  if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
    return [];
  }
  
  try {
    const placesWithDistance = allPlaces
      .filter(place => place && place.latitude && place.longitude)
      .map(place => {
        const distance = haversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          place.latitude,
          place.longitude
        );
        return {
          ...place,
          _distance: distance,
          _prominenceScore: getProminenceScore(place)
        };
      })
      .filter(place => place._distance <= radiusKm);
    
    if (placesWithDistance.length === 0) {
      // Ambil 8 tempat terdekat
      const nearest = allPlaces
        .filter(place => place && place.latitude && place.longitude)
        .map(place => ({
          ...place,
          _distance: haversineDistance(
            userLocation.latitude,
            userLocation.longitude,
            place.latitude,
            place.longitude
          ),
          _prominenceScore: getProminenceScore(place)
        }))
        .sort((a, b) => a._distance - b._distance)
        .slice(0, 8);
      
      return nearest;
    }
    
    // Urutkan berdasarkan prominence
    const sorted = placesWithDistance.sort((a, b) => b._prominenceScore - a._prominenceScore);
    
    // Maksimal 12 tempat
    return sorted.slice(0, 12);
    
  } catch (error) {
    console.error("Error in getProminentPlacesInRadius:", error);
    return [];
  }
};

export const getPlaceById = (allPlaces, id) => {
  if (!allPlaces || !Array.isArray(allPlaces) || !id) return null;
  return allPlaces.find(p => p && p.id === id);
};