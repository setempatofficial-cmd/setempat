export class EntityAliasManager {
  constructor(supabase) {
    this.supabase = supabase;
    this.aliasesMap = new Map();
    this.tempatAliases = new Map();
    this.isLoaded = false;
  }

  async loadAliases() {
    if (this.isLoaded) return;
    
    const { data: aliases, error } = await this.supabase
      .from('entity_aliases')
      .select('tempat_id, alias, confidence_threshold');
    
    if (error) throw error;
    
    for (const item of aliases) {
      const aliasLower = item.alias.toLowerCase();
      this.aliasesMap.set(aliasLower, {
        tempatId: item.tempat_id,
        confidence: item.confidence_threshold || 0.7
      });
      
      if (!this.tempatAliases.has(item.tempat_id)) {
        this.tempatAliases.set(item.tempat_id, []);
      }
      this.tempatAliases.get(item.tempat_id).push(aliasLower);
    }
    
    this.isLoaded = true;
    console.log(`📚 Loaded ${aliases.length} entity aliases`);
  }

  matchWithAliases(text) {
    if (!this.isLoaded || this.aliasesMap.size === 0) return null;
    
    const textLower = text.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;
    
    for (const [alias, data] of this.aliasesMap.entries()) {
      if (textLower.includes(alias)) {
        let score = data.confidence;
        score += Math.min(alias.length / 20, 0.3);
        if (textLower.indexOf(alias) === 0) score += 0.2;
        if (new RegExp(`\\b${this.escapeRegex(alias)}\\b`, 'i').test(textLower)) score += 0.1;
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            tempatId: data.tempatId,
            confidence: Math.min(score, 1.0),
            matchedAlias: alias
          };
        }
      }
    }
    return bestMatch;
  }
  
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}