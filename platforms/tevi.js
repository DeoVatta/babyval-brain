/**
 * TEVI — Platform generator
 * Dipanggil oleh Brain.generate('tevi', context)
 * 
 * 2 modes:
 *   1. Text post (CTA) — context.ctaType
 *   2. Content description — context.analysis (caption for uploaded file)
 */
var callAI = require('../lib/deepseek').callAI;
var persona = require('../lib/persona');
var knowledge = require('../lib/knowledge');
var validator = require('../lib/validator');

async function generate(context) {
  // Content description mode (caption for uploaded file)
  if (context.analysis) {
    return await generateDescription(context);
  }
  // Text post mode (CTA)
  return await generateTextPost(context);
}

// ===== CONTENT DESCRIPTION MODE =====
async function generateDescription(context) {
  var brain = context._brain;
  var time = validator.getTimeContext();
  var analysis = context.analysis;
  var a = analysis.analysisRaw || {};

  // Build content context from analysis
  var parts = (a.detected_parts || []).join(', ') || 'unknown';
  var outfit = a.outfit || 'unknown';
  var outfitColor = a.outfit_color || '';
  var cosplay = a.cosplay || '';
  var pose = a.pose || 'unknown';
  var exposed = a.exposed_parts || '';
  var visible = a.visible_parts || '';
  var isVid = a.is_video ? 'video' : 'foto';
  var duration = analysis.durationSec ? analysis.durationSec + ' detik' : '';
  var price = analysis.price || '';
  var location = a.location || '';
  
  var goodEx = knowledge.getGoodExamples(context._goodContent, 'tevi', 2);
  var goodPats = knowledge.getGoodPatterns(context._goodContent);
  
  // Time mood
  var mood = 'playful';
  if (time.hour >= 22 || time.hour <= 4) mood = 'horny nocturnal';
  else if (time.timeOfDay === 'malam') mood = 'playful night';
  else if (time.isWeekend) mood = 'weekend chill';

  var sp = 'Kamu Baby Val. ' + persona.PERSONA + '\n' +
    'Buat caption buat konten yang kamu upload di Tevi (@cutieval). ' +
    'Tujuan: bikin penasaran dan pengen liat kontennya. Deskripsiin apa yang ada di konten dengan gaya natural.\n' +
    'RULES: 1 kalimat 4-10 kata. NO emoji NO hashtag NO tanda kutip NO titik. Jangan pake kata: semoga, mungkin, sayang, nyamber, nyamberin, posing, buka kaki. Jangan vulgar.\n' +
    'GAYA: genit, tease, playful. Bisa pake nada "tanya" atau "tuduh" atau "ajak".\n' +
    '\nREFERENSI KONTEN TERBAIK:\n' + (goodEx || '') + '\n\n' + (goodPats || '');

  var up = 'Upload konten baru ke Tevi:\n' +
    '- Jenis: ' + isVid + (duration ? ' (' + duration + ')' : '') + '\n' +
    '- Body focus: ' + parts + '\n' +
    '- Outfit: ' + outfit + (outfitColor ? ' (' + outfitColor + ')' : '') + '\n' +
    '- Cosplay: ' + (cosplay || 'none') + '\n' +
    '- Pose: ' + pose + '\n' +
    '- Exposed: ' + (exposed || 'none') + '\n' +
    (price ? '- Price: ' + price + ' star\n' : '') +
    '- Waktu: ' + time.timeOfDay + ', ' + time.day + (time.isWeekend ? ' (weekend)' : '') + ' | Suasana: ' + mood + '\n' +
    '- Location: ' + (location || 'unknown') + '\n' +
    'TULISAN (1 kalimat, tanpa titik, variasi tiap run):';

  for (var retry = 0; retry < 3; retry++) {
    try {
      var t1 = await callAI(sp, up, 120);
      var t2 = await humanize(t1, { analysis: analysis, time: time, mood: mood });
      
      // Validasi
      var bad = validator.checkBad(t2, context._badContent);
      if (bad) { console.log('[BRAIN Tevi Caption] REJECTED [' + bad + ']: ' + t2.substring(0, 50)); continue; }
      if (validator.checkDoubleUrl(t2)) { console.log('[BRAIN Tevi Caption] REJECTED [double URL]: ' + t2.substring(0, 50)); continue; }
      
      return { text: t2, source: 'ai_humanized' };
    } catch(e) {
      console.log('[BRAIN Tevi Caption] retry ' + retry + ' error:', (e.message || '').substring(0, 50));
    }
  }
  
  return { text: null, source: 'failed' };
}


// ===== TEXT POST MODE (existing) =====
async function generateTextPost(context) {
  var brain = context._brain;
  var ctaType = context.ctaType || 'topup';
  var time = validator.getTimeContext();
  
  var mood = 'playful';
  if (time.hour >= 22 || time.hour <= 4) mood = 'horny nocturnal';
  else if (time.timeOfDay === 'malam') mood = 'playful night';
  else if (time.timeOfDay === 'pagi') mood = 'casual morning';
  else if (time.isWeekend) mood = 'weekend chill';

  var ctaD = {
    topup: 'Ajak topup star babyval.com',
    exclusive: 'Promo exclusive babyval.com',
    live: 'Info streaming Tevi',
    vcs: 'Tawaran VCS',
    membership: 'Promo membership babyval.com'
  };
  
  var goodEx = knowledge.getGoodExamples(context._goodContent, 'tevi', 2);

  var sp = 'Kamu Baby Val. ' + persona.PERSONA + '\n' +
    'Buat text post Tevi (@cutieval). NSFW. Tujuan: bikin penasaran + mau topup.\n' +
    'RULES: 1 kalimat 4-10 kata. NO emoji NO hashtag NO tanda kutip NO titik. Jangan spill semua. Jangan vulgar. DILARANG pake kata: semoga, mungkin, sayang, nyamber, nyamberin, posing, buka kaki.\n' +
    '\nREFERENSI KONTEN TERBAIK:\n' + (goodEx || '');

  var up = 'Text post Tevi hari ini.\n' +
    'Jenis: ' + ctaType + ' - ' + (ctaD[ctaType] || 'promo') + '\n' +
    'Waktu: ' + time.timeOfDay + ', ' + time.day + ' | Suasana: ' + mood + '\n' +
    'TULISAN (1 kalimat, tanpa titik):';

  for (var retry = 0; retry < 3; retry++) {
    try {
      var t1 = await callAI(sp, up, 100);
      var t2 = await humanize(t1, { ctaType: ctaType, time: time, mood: mood });
      
      var bad = validator.checkBad(t2, context._badContent);
      if (bad) { console.log('[BRAIN Tevi] REJECTED [' + bad + ']: ' + t2.substring(0, 50)); continue; }
      
      return { text: t2, source: 'ai_humanized' };
    } catch(e) {
      console.log('[BRAIN Tevi] retry ' + retry + ' error:', (e.message || '').substring(0, 50));
    }
  }
  
  // Fallback
  console.log('[BRAIN Tevi] all retries failed, fallback');
  var catMap = { topup: 'topup_cta', exclusive: 'exclusive_cta', live: 'live_cta', vcs: 'vcs_cta' };
  var cat = catMap[ctaType] || 'membership_cta';
  try {
    var te = context._templateEngine;
    if (te) { var r = te.generate('tevi', cat); return { text: r.text, source: 'template' }; }
  } catch(e2) {}
  return { text: 'Topup star di babyval.com ya', source: 'fallback' };
}


// ===== SHARED HUMANIZE =====
async function humanize(text, ctx) {
  var sp = 'Quality editor Baby Val. Kriteria: monoton? bot? cocok initiate?\nHumanize kalo perlu. Final touch kalo perlu.\nGOALS: Kedengeran manusia, genit, alami, gak kaku. Cocok buat konten Tevi.';
  var up = 'Review text:\n"' + text + '"\n\n' +
    'KONTEKS: Tevi konten' + (ctx.ctaType ? ', ' + ctx.ctaType : '') + '' +
    (ctx.time ? ', ' + ctx.time.timeOfDay + ' ' + ctx.time.day : '') + '' +
    (ctx.mood ? ', mood ' + ctx.mood : '') + '\n\n' +
    '1. Kritik? 2. Versi final:\nTULIS VERSI FINAL SAJA (1 kalimat, tanpa label, tanpa emoji):';
  try {
    var f = await callAI(sp, up, 100);
    f = f.replace(/^["']+|["']+$/g, '').trim();
    var fi = f.indexOf('Versi final:');
    if (fi !== -1) f = f.substring(fi + 12).trim();
    else { var m = f.match(/2\.\s*([^]+)/); if (m && m[1]) f = m[1].trim(); }
    return f.replace(/\.$/g, '');
  } catch(e) { return text; }
}

module.exports = { generate: generate };
