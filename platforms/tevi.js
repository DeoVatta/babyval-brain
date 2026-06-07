/**
 * TEVI — Platform generator (OPTIMIZED v2.1: 2-pass, retry 2x, compressed)
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
  
  var mood = 'playful';
  if (time.hour >= 22 || time.hour <= 4) mood = 'horny nocturnal';
  else if (time.timeOfDay === 'malam') mood = 'playful night';
  else if (time.isWeekend) mood = 'weekend chill';

  // Compressed prompt -55%
  var sp = 'Kamu Baby Val. ' + persona.PERSONA.substring(0, 150) +
    'Buat caption konten Tevi (@cutieval) NSFW. 1 kalimat 4-10 kata, bikin penasaran. ' +
    'NO emoji NO hashtag NO titik. Genit, tease, playful. ' +
    'DILARANG: semoga, mungkin, sayang, nyamber, posing, buka kaki, bahasa daerah.';

  var up = 'Upload konten Tevi:\n' +
    '- ' + isVid + (duration ? ' (' + duration + ')' : '') +
    ' | Fokus: ' + parts +
    ' | Outfit: ' + outfit + (outfitColor ? ' ' + outfitColor : '') +
    (cosplay ? ' | Cosplay: ' + cosplay : '') +
    (exposed ? ' | Exposed: ' + exposed : '') +
    (price ? ' | Price: ' + price + ' star' : '') +
    ' | Mood: ' + mood + ' | ' + time.timeOfDay + '\n' +
    'TULISAN (1 kalimat, variasi, tanpa titik):';

  for (var retry = 0; retry < 2; retry++) {
    try {
      var spFinal = sp;
      if (retry === 1) {
        var goodEx = knowledge.getGoodExamples(context._goodContent, 'tevi', 1);
        if (goodEx) spFinal = sp + ' REF: ' + goodEx.substring(0, 150);
      }

      // PASS 1: Generate
      var t1 = await callAI(spFinal, up, 80);
      if (!t1 || t1.trim().length < 3) continue;

      // PASS 2: Humanize
      var t2 = await humanize(t1, { analysis: analysis, time: time, mood: mood });
      
      var bad = validator.checkBad(t2, context._badContent);
      if (bad) { console.log('[BRAIN Tevi Cap] retry ' + retry + ' REJECTED: ' + bad); continue; }
      if (validator.checkDoubleUrl(t2)) { console.log('[BRAIN Tevi Cap] retry ' + retry + ' REJECTED [double URL]'); continue; }
      
      return { text: t2, source: 'ai_humanized' };
    } catch(e) {
      console.log('[BRAIN Tevi Cap] retry ' + retry + ' error:', (e.message || '').substring(0, 50));
    }
  }
  
  return { text: null, source: 'failed' };
}

// ===== TEXT POST MODE =====
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

  // Compressed prompt -55%
  var sp = 'Kamu Baby Val. ' + persona.PERSONA.substring(0, 150) +
    'Buat text post Tevi (@cutieval) NSFW. 1 kalimat 4-10 kata, bikin penasaran + mau topup. ' +
    'NO emoji NO hashtag NO tanda kutip NO titik. Jangan vulgar langsung. ' +
    'DILARANG: semoga, mungkin, sayang, nyamber, posing, buka kaki, bahasa daerah.';

  var up = 'Text post Tevi:\n' +
    'Jenis: ' + ctaType + ' - ' + (ctaD[ctaType] || 'promo') + '\n' +
    'Waktu: ' + time.timeOfDay + ', ' + time.day + ' | Mood: ' + mood + '\n' +
    'TULISAN (1 kalimat, tanpa titik, tanpa emoji):';

  for (var retry = 0; retry < 2; retry++) {
    try {
      var spFinal = sp;
      if (retry === 1) {
        var goodEx = knowledge.getGoodExamples(context._goodContent, 'tevi', 1);
        if (goodEx) spFinal = sp + ' REF: ' + goodEx.substring(0, 150);
      }

      // PASS 1: Generate
      var t1 = await callAI(spFinal, up, 80);
      if (!t1 || t1.trim().length < 3) continue;

      // PASS 2: Humanize (compressed)
      var t2 = await humanize(t1, { ctaType: ctaType, time: time, mood: mood });

      var bad = validator.checkBad(t2, context._badContent);
      if (bad) { console.log('[BRAIN Tevi] retry ' + retry + ' REJECTED: ' + bad); continue; }

      return { text: t2, source: 'ai_humanized' };
    } catch(e) {
      console.log('[BRAIN Tevi] retry ' + retry + ' error:', (e.message || '').substring(0, 50));
    }
  }

  // Fallback
  console.log('[BRAIN Tevi] fallback');
  var catMap = { topup: 'topup_cta', exclusive: 'exclusive_cta', live: 'live_cta', vcs: 'vcs_cta' };
  var cat = catMap[ctaType] || 'default';
  try {
    var te = context._templateEngine;
    if (te) { var r = te.generate('tevi', cat); return { text: r.text, source: 'template' }; }
  } catch(e2) {}
  return { text: 'Topup star di babyval.com ya', source: 'fallback' };
}

// ===== SHARED HUMANIZE (compressed) =====
async function humanize(text, ctx) {
  var sp = 'Quality editor Tevi. Natural? Genit? Cocok? Refine biar makin alami & engaging. Gak kaku, gak monoton.';
  var up = 'Review text Tevi:\n"' + text + '"\n' +
    (ctx.ctaType ? 'CTA: ' + ctx.ctaType : '') +
    (ctx.time ? ' | ' + ctx.time.timeOfDay + ' ' + ctx.time.day : '') +
    (ctx.mood ? ' | Mood: ' + ctx.mood : '') + '\n\n' +
    '1. Kritik? 2. Versi final:\nVERSI FINAL (1 kalimat, tanpa label):';
  try {
    var f = await callAI(sp, up, 80);
    f = f.replace(/^["']+|["']+$/g, '').trim();
    var m = f.match(/2\.\s*([^]+)/);
    if (m && m[1]) f = m[1].trim();
    return f.replace(/\.$/g, '') || text;
  } catch(e) { return text; }
}

module.exports = { generate: generate };
