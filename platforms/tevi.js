/**
 * TEVI — Platform generator
 * Dipanggil oleh Brain.generate('tevi', context)
 */
var callAI = require('../lib/deepseek').callAI;
var persona = require('../lib/persona');
var knowledge = require('../lib/knowledge');
var validator = require('../lib/validator');

async function generate(context) {
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
    '\nREFERENSI KONTEN TERBAIK:\n' + goodEx;

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

async function humanize(text, ctx) {
  var sp = 'Quality editor Baby Val. Kriteria: monoton? bot? cocok initiate?\nHumanize kalo perlu. Final touch kalo perlu.\nGOALS: Kedengeran manusia, genit, alami, gak kaku. Cocok buat Tevi text post NSFW.';
  var up = 'Review text post:\n"' + text + '"\n\n' +
    'KONTEKS: Tevi text post, ' + (ctx.ctaType || '') + ', ' + (ctx.time ? ctx.time.timeOfDay + ' ' + ctx.time.day : '') + ', mood ' + (ctx.mood || '') + '\n\n' +
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
