/**
 * PERSONA — Baby Val core identity
 * Load dari shared persona.json (source of truth)
 * Dipake sebagai system prompt untuk AI generation
 */
const fs = require('fs');
const path = require('path');

// Cari persona.json — shared di tools/babyval-db/
function findPersonaFile() {
  var paths = [
    path.join(__dirname, '..', '..', '..', 'tools', 'babyval-db', 'persona.json'),
    path.join(__dirname, '..', '..', 'tools', 'babyval-db', 'persona.json'),
    path.join(__dirname, '..', '..', '..', '..', '.openclaw', 'workspace', 'tools', 'babyval-db', 'persona.json'),
  ];
  for (var i = 0; i < paths.length; i++) {
    if (fs.existsSync(paths[i])) return paths[i];
  }
  return null;
}

// Cache
var _personaCache = null;
var _fullJson = null;

function loadPersona() {
  if (_personaCache) return _personaCache;

  var filePath = findPersonaFile();
  if (!filePath) {
    // Fallback ke hardcoded
    _personaCache = buildFallbackPersona();
    return _personaCache;
  }

  try {
    _fullJson = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    var id = _fullJson.identity || {};
    var plat = _fullJson.platforms || {};

    _personaCache = [
      '',
      'Nama: ' + (id.name || 'Baby Val'),
      'Username: ' + (id.username || 'cutebabyval') + ', @cutieval',
      'Panggilan: ' + ((id.panggilan) || ['Val', 'Kak Val']).slice(0, 3).join(', '),
      'Peran: ' + (id.persona || 'Streamer, Cosplayer, Konten Kreator Indonesia'),
      '',
      'PENAMPILAN: Big boobs, sexy thighs, stocking + cat ear headband' + (id.physical ? ', ' + id.physical.hair : ''),
      'KEPRIBADIAN: ' + (id.vibe || 'Personalitas "mommy" — lembut, manja, tegas, playful'),
      'BAHASA: ' + (id.language || 'Bahasa Indonesia utama, campur Inggris. DILARANG bahasa daerah.'),
      'POV: Pake "aku" dan "kamu". Alami, sehari-hari, genit, playful.',
      'EMOJI: ' + ((id.emojiStyle) || ['💕']).slice(0, 3).join(', ') + ' — signature: ' + (id.signatureEmoji || '💕'),
      'KONTEN: Streaming tiap hari. Gaming: RDR2, horror, open-world.',
      'PLATFORM: ' + (plat.tevi ? 'Tevi (@cutieval) NSFW' : '') + (plat.youtube ? ', YouTube SFW' : '') + (plat.discord ? ', Discord' : ''),
      '',
    ].join('\n');

    return _personaCache;
  } catch (e) {
    console.log('[PERSONA] Error loading:', e.message);
    _personaCache = buildFallbackPersona();
    return _personaCache;
  }
}

function buildFallbackPersona() {
  return [
    '',
    'Nama: Baby Val (username: cutebabyval, @cutieval)',
    'Panggilan: Val, Kak Val',
    'Peran: Streamer, Cosplayer, Konten Kreator Indonesia',
    '',
    'PENAMPILAN: Big boobs, sexy thighs, stocking + cat ear headband',
    'KEPRIBADIAN: Personalitas "mommy" — lembut, manja, tegas, playful',
    'BAHASA: Bahasa Indonesia utama, campur Inggris. DILARANG bahasa daerah.',
    'POV: Pake "aku" dan "kamu". Alami, sehari-hari, genit.',
    'EMOJI: 💕 signature',
    'KONTEN: Streaming tiap hari (Tevi NSFW, YouTube SFW). Gaming: RDR2, horror, open-world.',
    '',
  ].join('\n');
}

/**
 * Dapatkan full JSON persona (buat context yang lebih rich)
 */
function getFullPersona() {
  if (!_fullJson) loadPersona();
  return _fullJson;
}

/**
 * Dapatkan context spesifik untuk platform tertentu
 */
function getPlatformContext(platform) {
  var p = getFullPersona();
  if (!p || !p.platforms) return '';
  var plat = p.platforms[platform];
  if (!plat) return '';

  var ctx = [];
  ctx.push(plat.url || '');
  ctx.push('Content: ' + (plat.contentStyle || plat.status || ''));
  if (plat.avgViewsPerVideo) ctx.push('Avg views: ' + plat.avgViewsPerVideo);
  if (plat.subscribers) ctx.push('Subs: ' + plat.subscribers);
  if (plat.totalEarnings) ctx.push('Earnings: $' + plat.totalEarnings);

  return ctx.filter(Boolean).join(', ');
}

/**
 * Dapatkan context engagement (buat community reply)
 */
function getEngagementContext() {
  var p = getFullPersona();
  if (!p || !p.languageProfile || !p.contentRules) return '';

  var ctx = [];
  var lang = p.languageProfile || {};
  if (lang.commonPhrases) ctx.push('Common: ' + lang.commonPhrases.slice(0, 5).join(', '));
  if (lang.vibeInText) ctx.push('Vibe: ' + lang.vibeInText);
  if (lang.emojiFrequency) ctx.push('Emoji: ' + lang.emojiFrequency);

  var rules = p.contentRules || {};
  if (rules.engagementPatterns && rules.engagementPatterns.discord) {
    ctx.push('Discord pattern: ' + rules.engagementPatterns.discord);
  }
  if (rules.descGuidelines && rules.descGuidelines.discord) {
    ctx.push('Style: ' + rules.descGuidelines.discord);
  }

  return ctx.join(' | ');
}

/**
 * Dapatkan persona sebagai object (buat structured context)
 */
function getPersonaObject() {
  if (!_fullJson) loadPersona();
  return _fullJson ? _fullJson.identity : null;
}

// Load at init
loadPersona();

// Export PERSONA string (backward compat)
const PERSONA = _personaCache || buildFallbackPersona();

module.exports = {
  PERSONA,
  loadPersona,
  getFullPersona,
  getPlatformContext,
  getEngagementContext,
  getPersonaObject
};
