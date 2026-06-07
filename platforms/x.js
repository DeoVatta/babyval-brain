/**
 * X / TWITTER — Platform generator (OPTIMIZED v2: 2-pass, retry 2x)
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

  // Konteks reddit — compressed
  var rl = '';
  if (gc && gc.length) {
    rl = gc.slice(0, 2).map(function(g) { return '[' + g.sub + '] ' + g.text.substring(0, 100); }).join('\n');
  } else if (topikAsli) {
    rl = topikAsli.substring(0, 150);
  }

  // Compressed system prompt
  var sp = 'Kamu Baby Val. ' + persona.PERSONA.substring(0, 150) +
    'Buat tweet game X (@cutieval). Indo+Inggris santai. 1-2 kalimat pendek. ' +
    'NO emoji. Maks 1 URL. Natural, pancing diskusi. Gak formal. ' +
    'DILARANG: bahasa daerah, disclaimer AI, kata semoga/mungkin.';

  var up = 'Tweet X:\n' +
    'Game: "' + topic + '"\n' +
    (rl ? 'Konteks:\n' + rl + '\n' : '') +
    'Waktu: ' + time.timeOfDay + ', ' + time.day + (time.isWeekend ? ' (wiken)' : '') + '\n' +
    'TULISAN (1-2 kalimat, tanpa emoji, tanpa label):';

  for (var retry = 0; retry < 2; retry++) {
    try {
      var spFinal = sp;
      if (retry === 1) {
        var goodEx = knowledge.getGoodExamples(context._goodContent, 'x', 1);
        if (goodEx) spFinal = sp + ' REF GAYA: ' + goodEx.substring(0, 150);
      }

      // PASS 1: Generate
      var t1 = await callAI(spFinal, up, 100);
      if (!t1 || t1.trim().length < 3) continue;

      // PASS 2: Humanize
      var t2 = await humanize(t1, { topic: topic, topikAsli: topikAsli, time: time });

      var bad = validator.checkBad(t2, context._badContent);
      if (bad) { console.log('[BRAIN X] retry ' + retry + ' REJECTED: ' + bad); continue; }
      if (validator.checkDoubleUrl(t2)) { console.log('[BRAIN X] retry ' + retry + ' REJECTED [double URL]'); continue; }

      return { text: t2, source: 'ai_humanized' };
    } catch(e) {
      console.log('[BRAIN X] retry ' + retry + ' error:', (e.message || '').substring(0, 50));
    }
  }

  // Fallback
  console.log('[BRAIN X] fallback');
  try {
    var te = context._templateEngine;
    if (te) { var r = te.generate('x', 'game_discussion', { topic: topic }); return { text: r.text, source: 'template' }; }
  } catch(e2) {}
  return { text: 'Ngobrolin ' + topic + ' nih.', source: 'fallback' };
}

async function humanize(text, ctx) {
  var sp = 'Quality editor X. Natural? Engaging? Pancing diskusi? Refine biar makin alami, cocok buat tweet game. Indo+Iggris santai.';
  var up = 'Refine tweet:\n"' + text + '"\n' + (ctx.topic || '') + ' ' + (ctx.topikAsli || '') + '\n\nVersi final (langsung aja, tanpa label):';
  try {
    var f = await callAI(sp, up, 80);
    f = f.replace(/^["']+|["']+$/g, '').trim();
    return f || text;
  } catch(e) { return text; }
}

module.exports = { generate: generate };
