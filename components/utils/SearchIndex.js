"use client";

/**
 * SearchIndex - Untuk pencarian cepat dengan kompleksitas O(log n)
 * Dipisahkan agar bisa digunakan ulang di komponen lain
 */

class SearchIndex {
  constructor() {
    this.nameIndex = new Map();
    this.categoryIndex = new Map();
    this.reportIndex = new Map();
    this.allItems = [];
    this.isBuilt = false;
  }
  
  // Build index dari data
  buildIndex(items) {
    console.time('Build Search Index');
    
    this.nameIndex.clear();
    this.categoryIndex.clear();
    this.reportIndex.clear();
    this.allItems = items;
    
    for (const item of items) {
      // Index nama
      if (item.name) {
        const nameLower = item.name.toLowerCase();
        this.nameIndex.set(nameLower, item);
        
        // Index kata per kata untuk partial match
        const words = nameLower.split(/\s+/);
        for (const word of words) {
          if (word.length > 2) {
            if (!this.nameIndex.has(word)) this.nameIndex.set(word, item);
          }
        }
      }
      
      // Index kategori
      if (item.category) {
        const categoryLower = item.category.toLowerCase();
        if (!this.categoryIndex.has(categoryLower)) {
          this.categoryIndex.set(categoryLower, []);
        }
        this.categoryIndex.get(categoryLower).push(item);
      }
      
      // Index laporan
      if (item.laporan_terbaru) {
        for (const report of item.laporan_terbaru) {
          // Index tipe laporan
          if (report.tipe) {
            const tipeLower = report.tipe.toLowerCase();
            if (!this.reportIndex.has(tipeLower)) {
              this.reportIndex.set(tipeLower, new Set());
            }
            this.reportIndex.get(tipeLower).add(item.id);
          }
          
          // Index content (hanya 100 karakter pertama)
          if (report.content) {
            const contentPreview = report.content.toLowerCase().slice(0, 100);
            const keywords = contentPreview.split(/\s+/).filter(w => w.length > 3);
            for (const keyword of keywords) {
              if (!this.reportIndex.has(keyword)) {
                this.reportIndex.set(keyword, new Set());
              }
              this.reportIndex.get(keyword).add(item.id);
            }
          }
        }
      }
    }
    
    this.isBuilt = true;
    console.timeEnd('Build Search Index');
    console.log(`Index built: ${this.nameIndex.size} names, ${this.categoryIndex.size} categories`);
  }
  
  // Search dengan query
  search(query, options = {}) {
    if (!query || !this.isBuilt) return [];
    
    const { limit = 50, fuzzy = true } = options;
    const lowerQuery = query.toLowerCase();
    const results = new Map(); // Gunakan Map untuk tracking score
    
    // 1. Cari di nama (priority tinggi)
    for (const [name, item] of this.nameIndex) {
      if (name.includes(lowerQuery)) {
        const score = this.calculateScore(name, lowerQuery, 100);
        results.set(item.id, { item, score: (results.get(item.id)?.score || 0) + score });
      }
    }
    
    // 2. Cari di kategori (priority medium)
    for (const [category, items] of this.categoryIndex) {
      if (category.includes(lowerQuery)) {
        const score = this.calculateScore(category, lowerQuery, 50);
        for (const item of items) {
          results.set(item.id, { item, score: (results.get(item.id)?.score || 0) + score });
        }
      }
    }
    
    // 3. Cari di laporan (priority rendah)
    for (const [keyword, itemIds] of this.reportIndex) {
      if (keyword.includes(lowerQuery) || (fuzzy && this.fuzzyMatch(keyword, lowerQuery))) {
        const score = this.calculateScore(keyword, lowerQuery, 30);
        for (const id of itemIds) {
          const item = this.allItems.find(i => i.id === id);
          if (item) {
            results.set(id, { item, score: (results.get(id)?.score || 0) + score });
          }
        }
      }
    }
    
    // Sort by score dan limit
    const sorted = Array.from(results.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => r.item);
    
    return sorted;
  }
  
  // Hitung relevance score
  calculateScore(text, query, baseScore) {
    if (text === query) return baseScore;
    if (text.startsWith(query)) return baseScore * 0.9;
    if (text.includes(query)) return baseScore * 0.7;
    return baseScore * 0.5;
  }
  
  // Fuzzy matching sederhana
  fuzzyMatch(text, query) {
    if (query.length < 3) return false;
    let matches = 0;
    for (let i = 0; i < query.length - 2; i++) {
      const sub = query.slice(i, i + 3);
      if (text.includes(sub)) matches++;
    }
    return matches >= 2;
  }
  
  // Get suggestions berdasarkan query
  getSuggestions(query, limit = 5) {
    if (!query || !this.isBuilt) return [];
    
    const lowerQuery = query.toLowerCase();
    const suggestions = new Set();
    
    // Suggest dari nama
    for (const [name] of this.nameIndex) {
      if (name.includes(lowerQuery) && name !== lowerQuery) {
        suggestions.add(name);
        if (suggestions.size >= limit) break;
      }
    }
    
    // Suggest dari kategori
    if (suggestions.size < limit) {
      for (const [category] of this.categoryIndex) {
        if (category.includes(lowerQuery)) {
          suggestions.add(category);
          if (suggestions.size >= limit) break;
        }
      }
    }
    
    return Array.from(suggestions);
  }
  
  // Clear index
  clear() {
    this.nameIndex.clear();
    this.categoryIndex.clear();
    this.reportIndex.clear();
    this.allItems = [];
    this.isBuilt = false;
  }
}

// Singleton instance
let searchIndexInstance = null;

export const getSearchIndex = () => {
  if (!searchIndexInstance) {
    searchIndexInstance = new SearchIndex();
  }
  return searchIndexInstance;
};

export default SearchIndex;