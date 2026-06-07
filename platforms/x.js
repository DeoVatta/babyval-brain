/**
 * X / TWITTER — Platform generator
 * Dipanggil oleh Brain.generate('x', context)
 */
var callAI = require('../lib/deepseek').callAI;
var persona = require('../lib/persona');
var knowledge = require('../lib/knowledge');
var validator = require('../lib/validator');

async function generate(context) {
  var brain = context._brain;
  var topic = context.topic;
  var topikAsli = context.topikAsli;
  var time = validator.getTimeContext();
  var gc = knowledge.findGameCtx(topic, context._research);
  
  var rl = '';
  if (gc && gc.length) {
    rl = gc.slice(0, 3).map(function(g) { return '- [' + g.sub + '] ' + g.text; }).join('\n');
  } else if (topikAsli) {
    rl = '- ' + topikAsli;
  }

  var goodEx = knowledge.getGoodExamples(context._goodContent, 'x', 2);
  var goodPats = knowledge.getGoodPatterns(context._goodContent);

  var sp = 'Kamu adalah Baby Val. ' + persona.PERSONA + '\n' +
    'Buat tweet game dgn gaya Baby Val. Indonesia campur Inggris. Tujuan: pancing diskusi seru.\n' +
    'RULES: 1-3 kalimat pendek, natural. NO emoji. Jangan maksa komen. Jangan kesimpulan formal. MAX 1 URL per tweet. Kalo konten streaming, pake link Tevi bukan babyval.com.\n' +
    '\nREFERENSI KONTEN TERBAIK:\n' + goodEx + '\n\n' + goodPats;

  var up = 'Buat tweet X untuk @cutieval.\n' +
    'KONTEKS:\n' +
    '- Game: "' + topic + '"\n' +
    (topikAsli ? '- Reddit: "' + topikAsli + '"\n' : '') +
    (rl ? '- Reddit diskusi:\n' + rl + '\n' : '') +
    '- Waktu: ' + time.timeOfDay + ', ' + time.day + (time.isWeekend ? ' (weekend)' : '') + '\n' +
    'TULISAN (1-3 kalimat, tanpa emoji):';

  for (var retry = 0; retry < 3; retry++) {
    try {
      var t1 = await callAI(sp, up, 150);
      var t2 = await humanize(t1, { topic: topic, topikAsli: topikAsli, time: time });
      
      var bad = validator.checkBad(t2, context._badContent);
      if (bad) { console.log('[BRAIN X] REJECTED [' + bad + ']: ' + t2.substring(0, 50)); continue; }
      if (validator.checkDoubleUrl(t2)) { console.log('[BRAIN X] REJECTED [double URL]: ' + t2.substring(0, 50)); continue; }
      
      return { text: t2, source: 'ai_humanized' };
    } catch(e) {
      console.log('[BRAIN X] retry ' + retry + ' error:', (e.message || '').substring(0, 50));
    }
  }
  
  // Fallback
  console.log('[BRAIN X] all retries failed, fallback');
  try {
    var te = context._templateEngine;
    if (te) { var r = te.generate('x', 'game_discussion', { topic: topic }); return { text: r.text, source: 'template' }; }
  } catch(e2) {}
  return { text: 'Ngobrolin ' + topic + ' nih.', source: 'fallback' };
}

async function humanize(text, ctx) {
  var sp = 'Kamu quality editor konten Baby Val. Kriteria: 1. Monoton? 2. Bot/kurang natural? 3. Cocok initiate?\n' +
    'Kalo perlu humanize, bikin lebih alami. Kalo perlu final touch, perbaiki.\n' +
    'GOALS: Kedengeran manusia, pancing penasaran, Indonesia natural campur Inggris, gak kaku.';
  var up = 'Review dan perbaiki tweet:\n"' + text + '"\n\n' +
    'KONTEKS: ' + (ctx.topic || '') + ' ' + (ctx.topikAsli || '') + ' ' +
    (ctx.time ? ctx.time.timeOfDay + ' ' + ctx.time.day : '') + '\n\n' +
    '1. Kritik apa? 2. Versi final:\nTULIS VERSI FINAL SAJA (tanpa label, tanpa emoji):';
  try {
    var f = await callAI(sp, up, 150);
    f = f.replace(/^["']+|["']+$/g, '').trim();
    var fi = f.indexOf('Versi final:');
    if (fi !== -1) f = f.substring(fi + 12).trim();
    else { var m = f.match(/2\.\s*([^]+)/); if (m && m[1]) f = m[1].trim(); }
    return f.replace(/[.?!]{2,}$/g, function(m) { return m[0]; });
  } catch(e) { return text; }
}

module.exports = { generate: generate };
