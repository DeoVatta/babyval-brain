/**
 * KNOWLEDGE — Research, Good Examples, Good Patterns, Catalogs
 * Sumber pengetahuan yang terus berkembang
 *
 * v2.0 — Added: knowledge/ folder loader (pricing, social, faq, services)
 * Semua data di-cache in-memory setelah load pertama.
 */
const fs = require('fs');
const path = require('path');

// Path relatif ke tools/babyval-db/ — shared across all tools
var DB_DIR = null;

// In-memory cache untuk knowledge
var _knowledgeCache = {};

// Optional Supabase client — kalo di-set, brain query langsung ke DB
var _supabase = null;

function setDbDir(dir) {
  DB_DIR = dir;
  // Invalidate cache on path change
  _knowledgeCache = {};
}

function getDbDir() {
  if (DB_DIR) return DB_DIR;
  // Fallback: relative from tools/
  return path.join(__dirname, '..', '..', 'tools', 'babyval-db');
}

/**
 * Set Supabase client for direct DB queries.
 * Call this saat inisialisasi Brain kalo mau pake Supabase.
 */
function setSupabase(supabaseClient) {
  _supabase = supabaseClient;
  _knowledgeCache = {};
}

/**
 * Check apakah Supabase client tersedia
 */
function hasSupabase() {
  return _supabase !== null && _supabase !== undefined;
}

// ===================== GENERIC KNOWLEDGE LOADER =====================

/**
 * Load a JSON file from knowledge/ folder, cached in memory.
 * @param {string} name — filename without .json (e.g. 'pricing', 'faq')
 * @param {boolean} forceReload — skip cache
 */
function loadKnowledge(name, forceReload) {
  if (!forceReload && _knowledgeCache[name]) return _knowledgeCache[name];
  var filePath = path.join(getDbDir(), 'knowledge', name + '.json');
  try {
    var data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    _knowledgeCache[name] = data;
    return data;
  } catch(e) {
    return null;
  }
}

/**
 * Clear knowledge cache (call after updating files)
 */
function clearKnowledgeCache() {
  _knowledgeCache = {};
}

/**
 * Query knowledge from Supabase (kalo available) atau fallback ke file JSON.
 * Returns: array of { key, category, subcategory, data, keywords, cta }
 */
function queryKnowledge(category, subcategory, searchQuery) {
  if (_supabase) {
    return queryKnowledgeFromDB(category, subcategory, searchQuery);
  }
  // Fallback: search from JSON files in memory
  return queryKnowledgeFromJSON(category, subcategory, searchQuery);
}

/**
 * Query langsung dari Supabase
 */
async function queryKnowledgeFromDB(category, subcategory, searchQuery) {
  try {
    var q = _supabase.from('knowledge').select('*').eq('active', true);
    if (category) q = q.eq('category', category);
    if (subcategory) q = q.eq('subcategory', subcategory);
    q = q.order('id').limit(20);
    
    var result = await q;
    if (result.error) throw result.error;
    return result.data || [];
  } catch(e) {
    console.log('[KNOWLEDGE] DB query error:', e.message);
    return [];
  }
}

/**
 * Search dari in-memory JSON cache
 */
function queryKnowledgeFromJSON(category, subcategory, searchQuery) {
  // Map from known JSON files
  var jsonMap = {
    pricing: loadKnowledge('pricing'),
    social: loadKnowledge('social'),
    faq: loadKnowledge('faq'),
    services: loadKnowledge('services')
  };
  
  // Implementation depends on the category
  // This is a simplified version — for complex searches, use searchPricing/searchSocial/etc
  return [];
}

// ===================== PRICING =====================

function loadPricing() {
  return loadKnowledge('pricing');
}

/**
 * Cari item pricing berdasarkan keyword.
 * Contoh: searchPricing('vcs 10 menit') → item VCS 10 menit
 */
function searchPricing(query) {
  var pricing = loadKnowledge('pricing');
  if (!pricing) return null;
  var q = (query || '').toLowerCase();
  var results = [];
  
  // Cari di VCS items
  if (pricing.vcs && pricing.vcs.items) {
    for (var vi = 0; vi < pricing.vcs.items.length; vi++) {
      var item = pricing.vcs.items[vi];
      if (q.indexOf(item.duration) !== -1) {
        results.push({ category: 'vcs', item: item, label: pricing.vcs.label });
      }
    }
    // Kalo keyword 'vcs' doang, return semua item
    if (results.length === 0 && (q.indexOf('vcs') !== -1 || q.indexOf('video call') !== -1 || q.indexOf('harga') !== -1 || q.indexOf('price') !== -1)) {
      for (var vi2 = 0; vi2 < pricing.vcs.items.length; vi2++) {
        results.push({ category: 'vcs', item: pricing.vcs.items[vi2], label: pricing.vcs.label });
      }
    }
  }
  
  return results.length > 0 ? results : null;
}

/**
 * Get formatted VCS price list string.
 */
function getVCSPriceList() {
  var pricing = loadKnowledge('pricing');
  if (!pricing || !pricing.vcs || !pricing.vcs.items) return '';
  return pricing.vcs.items.map(function(i) {
    return i.duration + ' — ' + i.price;
  }).join(', ');
}

/**
 * Get VCS CTA (cara + link)
 */
function getVCSCTA() {
  var pricing = loadKnowledge('pricing');
  if (!pricing || !pricing.vcs) return 'Cek babyval.com buat info VCS ya~';
  return pricing.vcs.items[0].cta;
}

// ===================== SOCIAL =====================

function loadSocial() {
  return loadKnowledge('social');
}

/**
 * Cari platform/sosmed berdasarkan keyword.
 * searchSocial('instagram') → { platform, username, url, ... }
 * searchSocial('tevi') → streaming platform
 */
function searchSocial(query) {
  var social = loadKnowledge('social');
  if (!social) return null;
  var q = (query || '').toLowerCase();
  
  // Cek semua kategori
  var categories = ['streaming', 'social', 'premium'];
  // Score each entry — cari yang paling cocok
  var best = null;
  var bestScore = 0;
  
  for (var ci = 0; ci < categories.length; ci++) {
    var cat = social[categories[ci]];
    if (!Array.isArray(cat)) continue;
    for (var ei = 0; ei < cat.length; ei++) {
      var entry = cat[ei];
      var platformName = (entry.platform || '').toLowerCase();
      var username = (entry.username || '').toLowerCase();
      var desc = (entry.description || '').toLowerCase();
      var url = (entry.url || '').toLowerCase();
      
      var score = 0;
      // Keyword ada di dalem query? (kebalikan dari sebelumnya!)
      if (q.indexOf(platformName) !== -1) score += 20;
      if (q.indexOf(username.replace('@', '')) !== -1) score += 15;
      if (q.indexOf('sosmed') !== -1 || q.indexOf('link') !== -1) score += 5;
      
      // Platform name sebagai kata terisolasi? (biar 'x' doang gak false match)
      var words = q.split(/\s+/);
      for (var wi = 0; wi < words.length; wi++) {
        var w = words[wi].replace(/[^a-z0-9]/g, '');
        if (w.length > 1 && platformName.indexOf(w) !== -1) score += 10;
      }
      
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
  }
  
  return bestScore >= 15 ? best : null;
}

/**
 * Get formatted social links string.
 */
function getSocialLinks() {
  var social = loadKnowledge('social');
  if (!social) return '';
  var result = [];
  var categories = ['streaming', 'social', 'premium'];
  for (var ci = 0; ci < categories.length; ci++) {
    var cat = social[categories[ci]];
    if (!Array.isArray(cat)) continue;
    for (var ei = 0; ei < cat.length; ei++) {
      var e = cat[ei];
      result.push(e.platform + ': ' + e.url);
    }
  }
  return result.join('\n');
}

// ===================== FAQ =====================

function loadFAQ() {
  return loadKnowledge('faq');
}

/**
 * Cari FAQ berdasarkan pertanyaan user.
 * Returns: { category, question, answer, cta, matchScore }
 */
function searchFAQ(query) {
  var faq = loadKnowledge('faq');
  if (!faq || !faq.categories) return null;
  var q = (query || '').toLowerCase();
  var bestMatch = null;
  var bestScore = 0;
  
  var cats = Object.keys(faq.categories);
  for (var ci = 0; ci < cats.length; ci++) {
    var items = faq.categories[cats[ci]];
    if (!Array.isArray(items)) continue;
    for (var ii = 0; ii < items.length; ii++) {
      var item = items[ii];
      // Score berdasarkan keyword match
      var score = 0;
      if (item.keywords) {
        for (var ki = 0; ki < item.keywords.length; ki++) {
          if (q.indexOf(item.keywords[ki].toLowerCase()) !== -1) {
            score += 10;
          }
        }
      }
      // Score dari question text
      var qText = (item.question || '').toLowerCase();
      if (q.indexOf(qText) !== -1) {
        score += 20;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { category: cats[ci], question: item.question, answer: item.answer, cta: item.cta, score: score };
      }
    }
  }
  
  return bestScore >= 10 ? bestMatch : null;
}

// ===================== SERVICES =====================

function loadServices() {
  return loadKnowledge('services');
}

/**
 * Cari service berdasarkan keyword.
 */
function searchService(query) {
  var services = loadKnowledge('services');
  if (!services || !services.services) return null;
  var q = (query || '').toLowerCase();
  
  for (var si = 0; si < services.services.length; si++) {
    var svc = services.services[si];
    var name = (svc.name || '').toLowerCase();
    var desc = (svc.description || '').toLowerCase();
    // Score dari keywords
    var score = 0;
    if (svc.keywords) {
      for (var ki = 0; ki < svc.keywords.length; ki++) {
        if (q.indexOf(svc.keywords[ki].toLowerCase()) !== -1) {
          score += 10;
        }
      }
    }
    if (name.indexOf(q) !== -1) score += 15;
    if (desc.indexOf(q) !== -1) score += 5;
    if (score >= 10) {
      return { service: svc, score: score };
    }
  }
  return null;
}

/**
 * Get all service CTAs as a formatted string.
 */
function getAllServiceCTAs() {
  var services = loadKnowledge('services');
  if (!services || !services.services) return '';
  return services.services.map(function(s) {
    return s.cta || '';
  }).filter(function(s) { return s.length > 0; }).join('\n');
}

// ===================== RESEARCH =====================

function loadResearch() {
  try {
    return JSON.parse(fs.readFileSync(path.join(getDbDir(), 'research.json'), 'utf-8'));
  } catch(e) {
    return null;
  }
}

function findGameCtx(gameName, research) {
  if (!research || !research.data || !research.data.reddit) return null;
  var results = [];
  var subs = Object.keys(research.data.reddit);
  for (var si = 0; si < subs.length; si++) {
    var arr = research.data.reddit[subs[si]];
    if (Array.isArray(arr)) {
      for (var ti = 0; ti < arr.length; ti++) {
        if (typeof arr[ti] === 'string' && arr[ti].toLowerCase().indexOf(gameName.toLowerCase()) !== -1) {
          results.push({ sub: subs[si], text: arr[ti] });
        }
      }
    }
  }
  return results.length > 0 ? results : null;
}

// ===================== GOOD CONTENT =====================

function loadGoodContent() {
  try {
    return JSON.parse(fs.readFileSync(path.join(getDbDir(), 'good-content.json'), 'utf-8'));
  } catch(e) {
    return null;
  }
}

function getGoodExamples(goodContent, platform, limit) {
  if (!goodContent || !goodContent.good) return '';
  limit = limit || 2;
  var filtered = goodContent.good.filter(function(g) { return g.platform === platform; });
  if (filtered.length === 0) filtered = goodContent.good;
  return filtered.slice(0, limit).map(function(g, i) {
    return 'Contoh ' + (i+1) + ': "' + g.text + '" (' + (g.why || '') + ')';
  }).join('\n');
}

function getGoodPatterns(goodContent) {
  if (!goodContent || !goodContent.goodPatterns) return '';
  var top = goodContent.goodPatterns
    .filter(function(p) { return p.from === 'good'; })
    .sort(function(a,b) { return b.weight - a.weight; })
    .slice(0, 5);
  return 'Gaya yg works:\n' + top.map(function(p) { return '- ' + p.pattern + ' — ' + p.use; }).join('\n');
}

module.exports = {
  setDbDir,
  getDbDir,
  setSupabase,
  hasSupabase,
  clearKnowledgeCache,
  queryKnowledge,
  // Pricing
  loadPricing,
  searchPricing,
  getVCSPriceList,
  getVCSCTA,
  // Social
  loadSocial,
  searchSocial,
  getSocialLinks,
  // FAQ
  loadFAQ,
  searchFAQ,
  // Services
  loadServices,
  searchService,
  getAllServiceCTAs,
  // Research
  loadResearch,
  findGameCtx,
  // Good Content
  loadGoodContent,
  getGoodExamples,
  getGoodPatterns
};
