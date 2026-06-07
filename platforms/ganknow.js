/**
 * GANKNOW — Platform generator (v1.0: Template-first, SFW ONLY)
 * Dipanggil oleh Brain.generate('ganknow', context)
 *
 * GENRE: SFW Cosplay — No nudity, no vulgar, professional
 * Template match dari good-content.json ganknow_templates
 * Fallback ke static safe templates (0 token)
 */
var persona = require('../lib/persona');
var knowledge = require('../lib/knowledge');
var validator = require('../lib/validator');

async function generate(context) {
  if (context.analysis) return await generateDescription(context);
  if (context.ctaType) return await generateTextPost(context);
  return await generateGeneral(context);
}

// ===================== TEMPLATES =====================

var SFW_TEMPLATES = [
  // Text posts (CTA/promo)
  { category: 'soft_cta', text: 'Ada yang mau liat full set outfit cosplay hari ini? Cek shop buat bundle lengkapnya \u2728', type: 'text' },
  { category: 'soft_cta', text: 'Cosplay collection terbaru udah ada di shop. Bundling include foto + video behind the scene', type: 'text' },
  { category: 'soft_cta', text: 'Dukung Val dengan subscribe di shop. Dapetin akses full album cosplay tiap minggu', type: 'text' },
  { category: 'soft_cta', text: 'Mau request cosplay karakter tertentu? Join membership dan vote di poll mingguan', type: 'text' },
  { category: 'soft_cta', text: 'Thank you buat yang udah subscribe! Next cosplay request bakal diprioritaskan', type: 'text' },
  { category: 'soft_cta', text: 'Cosplay photoshoot hari ini beres! Hasilnya bisa dicek di shop ya', type: 'text' },
  { category: 'soft_cta', text: 'Full album exclusive cosplay cuma di shop. Setiap minggu ada konten baru', type: 'text' },
  { category: 'soft_cta', text: 'Buat yang suka koleksi foto cosplay berkualitas, join membership Val yuk', type: 'text' },
  { category: 'engagement', text: 'Cosplay apa yang paling cocok buat Val menurut kamu? Tulis di komen ya', type: 'text' },
  { category: 'engagement', text: 'Val lagi mikir cosplay karakter baru. Kasih rekomendasi dong', type: 'text' },
  { category: 'engagement', text: 'Poll: better cosplay anime atau game character? Komen pendapat kamu', type: 'text' },
  { category: 'appreciation', text: 'Makasih supportnya selama ini, Val bakal terus kasih konten cosplay terbaik', type: 'text' },
];

// ===================== GENERATORS =====================

function matchTemplate(category) {
  // Cari template yang cocok dengan category
  var candidates = SFW_TEMPLATES.filter(function(t) {
    return t.category === category && t.type === 'text';
  });
  
  if (candidates.length === 0) {
    candidates = SFW_TEMPLATES.filter(function(t) { return t.type === 'text'; });
  }
  
  var idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx];
}

async function generateTextPost(context) {
  var ctaType = context.ctaType || 'soft_cta';
  var category = context.category || ctaType;
  
  // Template match (0 token)
  var tpl = matchTemplate(category);
  if (tpl) {
    return { text: tpl.text, source: 'template' };
  }
  
  // Fallback safe
  return { text: 'Cosplay collection terbaru udah ada. Cek shop buat bundle lengkapnya.', source: 'fallback' };
}

async function generateDescription(context) {
  var a = context.analysis || {};
  var cosplay = a.cosplay || '';
  var outfit = a.outfit || '';
  var charName = cosplay || 'spesial';
  
  // Template match based on analysis
  // For Ganknow = SFW only, no explicit content
  return {
    text: 'Cosplay ' + charName + ' by Baby Val' + (outfit ? ' (' + outfit + ')' : '') + '\n\nFull set nya ada di shop',
    source: 'template'
  };
}

async function generateGeneral(context) {
  return { text: 'Cosplay collection by Baby Val \u2728', source: 'fallback' };
}

module.exports = { generate: generate };
