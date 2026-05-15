// lib/tempat-validator.js
export class TempatValidator {
  constructor(daftarTempat, aliasManager) {
    this.tempatMap = new Map();
    this.kecamatanMap = new Map();
    this.aliasManager = aliasManager;
    
    daftarTempat.forEach(tempat => {
      const namaLower = tempat.name.toLowerCase();
      this.tempatMap.set(namaLower, tempat);
      
      const kecamatanMatch = namaLower.match(/kecamatan\s+(\w+)/i);
      if (kecamatanMatch) {
        const kecamatan = kecamatanMatch[1];
        if (!this.kecamatanMap.has(kecamatan)) {
          this.kecamatanMap.set(kecamatan, []);
        }
        this.kecamatanMap.get(kecamatan).push(tempat);
      }
    });
  }
  
  matchLocation(title, content = '') {
    const text = `${title} ${content}`.toLowerCase();
    const matches = [];
    
    // PRIORITAS 1: Match dengan ALIAS (dari entity_aliases)
    if (this.aliasManager) {
      const aliasMatch = this.aliasManager.matchWithAliases(text);
      if (aliasMatch) {
        const tempat = Array.from(this.tempatMap.values()).find(
          t => t.id === aliasMatch.tempatId
        );
        if (tempat) {
          matches.push({
            tempat: tempat,
            score: aliasMatch.confidence * 100,
            method: 'alias',
            matchedAlias: aliasMatch.matchedAlias
          });
        }
      }
    }
    
    // PRIORITAS 2: Exact match dengan nama tempat
    for (const [nama, tempat] of this.tempatMap) {
      if (text.includes(nama)) {
        matches.push({
          tempat: tempat,
          score: 95,
          method: 'exact_name'
        });
      }
    }
    
    // PRIORITAS 3: Match berdasarkan kecamatan
    for (const [kecamatan, tempatList] of this.kecamatanMap) {
      if (text.includes(kecamatan)) {
        tempatList.forEach(tempat => {
          matches.push({
            tempat: tempat,
            score: 70,
            method: 'kecamatan'
          });
        });
      }
    }
    
    if (matches.length === 0) return null;
    
    // Hapus duplikat dan ambil score tertinggi
    const uniqueMatches = Array.from(
      new Map(matches.map(m => [m.tempat.id, m])).values()
    );
    
    uniqueMatches.sort((a, b) => b.score - a.score);
    return uniqueMatches[0];
  }
  
  isFalsePositive(tempat, title) {
    const titleLower = title.toLowerCase();
    const tempatLower = tempat.name.toLowerCase();
    
    // Kasus spesifik: Tosari vs Purwosari
    if (tempatLower.includes('purwosari') && titleLower.includes('tosari')) {
      return true;
    }
    if (tempatLower.includes('tosari') && titleLower.includes('purwosari')) {
      return true;
    }
    
    return false;
  }
}