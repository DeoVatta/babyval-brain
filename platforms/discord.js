/**
 * DISCORD — Platform generator untuk community reply
 * Dipanggil oleh Brain.generate('discord', context)
 *
 * Flow: Generate → Humanize → Validate 6 Kriteria → Retry max 3x → Fallback
 *
 * Context yang diharapkan:
 * {
 *   originalQuestion: string,    // Pesan user yang mau dijawab
 *   author: string,              // Username penanya
 *   channel: string,             // #channel name
 *   channelId: string,           // Discord channel ID
 *   communityHealth: object,     // { activityLevel, engagementLevel, healthScore }
 *   isGeneralChat: boolean,      // Apakah di channel general?
 *   topic: string,               // Topik terdeteksi (game/cosplay/streaming/general)
 *   messageAge: number,          // Umur pesan dalam menit (kalo 120 menit rule)
 *   conversationContext: string, // Beberapa pesan sebelumnya (kalo ada)
 * }
 */
var callAI = require('../lib/deepseek').callAI;
var persona = require('../lib/persona');
var validator = require('../lib/validator');

async function generate(context) {
  var brain = context._brain;
  var q = context.originalQuestion || '';
  var author = context.author || 'someone';
  var channel = context.channel || 'general';
  var topic = context.topic || 'general';
  var time = validator.getTimeContext();
  var communityHealth = context.communityHealth || {};
  var isGeneral = context.isGeneralChat !== false;
  var msgAge = context.messageAge || 0;

  // Ambil good examples dari platform terdekat
  var goodEx = '';
  if (context._goodContent) {
    goodEx = knowledgeHelper.getGoodExamples(context._goodContent, 'discord', 2);
  }
  var personaCtx = persona.getEngagementContext();

  // ============================================================
  // BUILD SYSTEM PROMPT (COMPRESSED v2 — -60% token!)
  // ============================================================
  var sp = '' +
    'SUKII = community agent Baby Val. Natural, engaging, Indo+Inggris santai. ' +
    'Tujuan: sustain diskusi. 2-3 kalimat. Pancing reply balik.\n' +
    '\n' +
    'IDENTITAS VAL: ' + persona.PERSONA.substring(0, 150) + '\n' +
    (personaCtx ? '\n' + personaCtx.substring(0, 100) : '') +
    '\n\nATURAN:' +
    '\n- Ngobrol natural, pake partikel (sih, deh, kok, dong)' +
    '\n- JANGAN: bahasa daerah, formalitas, disclaimer AI, panjang >3 kalimat' +
    '\n- JANGAN: mention Tevi/Ganknow/OF di general' +
    '\n- PASTI: jawab pertanyaan user, tanya balik biar diskusi lanjut';

  // Cache goodEx — cuma inject kalo retry (irit token)
  var goodExCached = goodEx;

  // ============================================================
  // BUILD USER PROMPT
  // ============================================================
  var healthStr = '';
  if (communityHealth.activityLevel) {
    healthStr = 'Komunitas: ' + communityHealth.activityLevel + '/' +
      (communityHealth.engagementLevel || 'unknown') +
      ' (health ' + (communityHealth.healthScore ? Math.round(communityHealth.healthScore) : '?') + '%)';
  }

  var timeStr = time.timeOfDay + ', ' + time.day + (time.isWeekend ? ' (weekend)' : '');
  var ageStr = msgAge > 0 ? 'Pesan ini udah ' + Math.round(msgAge) + ' menit gak dijawab.' : 'Pesan baru.';

  var up = '' +
    'Balas chat Discord ini dengan natural — langsung jawaban akhir, gak perlu nulis langkah-langkah:\n\n' +
    'KONTEKS:\n' +
    '- Channel: #' + channel + '\n' +
    '- Topik: ' + topic + '\n' +
    '- Waktu: ' + timeStr + '\n' +
    '- Ditanyakan oleh: ' + author + '\n' +
    '- ' + ageStr + '\n' +
    '- ' + healthStr + '\n' +
    (context.conversationContext ? '- Chat sebelumnya: "' + context.conversationContext.substring(0, 200) + '"\n' : '') +
    '\n' +
    'PESAN USER:\n"' + q + '"\n\n' +
    'JAWABAN FINAL (maks 3 kalimat, engaging, pancing diskusi, pakai partikel alami):';

  // ============================================================
  // RETRY LOOP: Generate → Humanize → Validate (max 2x)
  // OPTIMIZED: 2-pass tetap, tapi prompt compressed, goodEx cuma di retry
  // ============================================================
  for (var retry = 0; retry < 2; retry++) {
    try {
      // Inject goodEx Cuma di retry ke-2 (irit ~200 token/request)
      var spFinal = sp;
      if (retry === 1 && goodExCached) {
        spFinal = sp + '\n\nCONTOH GAYA: ' + goodExCached.substring(0, 300);
      }

      // PASS 1: Generate (compressed prompt, max 100 token)
      var t1 = await callAI(spFinal, up, 100);
      if (!t1 || t1.trim().length < 3) { console.log('[BRAIN Discord] retry ' + retry + ' empty response'); continue; }

      // PASS 2: Humanize (compressed, max 80 token)
      var t2 = await humanize(t1, {
        originalQuestion: q,
        author: author,
        topic: topic,
        channel: channel,
        time: time,
        isGeneral: isGeneral
      });

      // Validate: 6 kriteria
      var validation = validator.validate6Criteria(t2, {
        platform: 'discord',
        originalQuestion: q,
        channel: channel,
        author: author
      });

      console.log('[BRAIN Discord] retry ' + retry + ' v6 score: ' + validation.score + '% (' +
        validation.overall + ')' +
        (validation.suggestions.length > 0 ? ' saran: ' + validation.suggestions[0] : ''));

      // LULUS? (good/mid — mid masih acceptable)
      if (validation.overall !== 'bad') {
        return { text: t2, source: 'ai_humanized', validation: validation };

      // BAD — cek bad content DB juga
      } else {
        var bad = validator.checkBad(t2, context._badContent);
        if (bad) {
          console.log('[BRAIN Discord] REJECTED [' + bad + ']: ' + t2.substring(0, 60));
          continue;
        }
        // Tetap kirim kalo bad karena pattern aja (not content DB)
        return { text: t2, source: 'ai_humanized_risky', validation: validation };
      }
    } catch (e) {
      console.log('[BRAIN Discord] retry ' + retry + ' error:', (e.message || '').substring(0, 60));
    }
  }

  // ============================================================
  // FALLBACK
  // ============================================================
  console.log('[BRAIN Discord] all retries failed, fallback');
  try {
    var te = context._templateEngine;
    if (te) {
      var r = te.generate('discord', topic, {
        author: author,
        channel: channel,
        question: q
      });
      if (r && r.text) return { text: r.text, source: 'template' };
    }
  } catch(e2) {}

  // Fallback final
  var fallbacks = [
    'Hmm iya sih, gimana menurutmu?',
    'Wah bener juga. Ada pendapat lain?',
    'Noted. Kalo menurut kamu gimana?',
    'Iya nih, setuju. Yang lain gimana?',
    'Seru juga tuh. Cerita dong lebih detailnya.'
  ];
  return {
    text: fallbacks[Math.floor(Math.random() * fallbacks.length)],
    source: 'fallback'
  };
}

/**
 * PASS 2: Humanize — review dan refine jawaban (OPTIMIZED: compressed prompt -60%)
 */
async function humanize(text, ctx) {
  var sp = '' +
    'Quality editor Discord. Natural? Engaging? Gak monoton? Pancing diskusi?\n' +
    'Kalo ada minor issue, refine. Kalo oke, kasih final touch doang.\n' +
    'GOALS: Kedengeran manusia, pancing reply balik, Indo+Inggris santai.\n' +
    'RAMBU: pake partikel (sih, deh, dong), max 3 kalimat.';

  var up = '' +
    'Refine balasan Discord:\n\n' +
    'Konteks: #' + (ctx.channel || 'general') + ' | ' + (ctx.topic || 'general') + ' | dari ' + (ctx.author || 'user') + '\n' +
    'Tanya: "' + (ctx.originalQuestion || '').substring(0, 80) + '"\n' +
    'Balasan asli: "' + text + '"\n\n' +
    'Versi final (langsung jawaban aja, tanpa label):';

  try {
    var f = await callAI(sp, up, 80);
    f = f.replace(/^["']+|["']+$/g, '').trim();
    return f || text;
  } catch(e) {
    return text;
  }
}

// Knowledge helper (biar gak perlu brain reference)
var knowledgeHelper = {
  getGoodExamples: function(goodContent, platform, limit) {
    if (!goodContent || !goodContent.good) return '';
    limit = limit || 2;
    var filtered = goodContent.good.filter(function(g) { return g.platform === platform; });
    if (filtered.length === 0) filtered = goodContent.good;
    return filtered.slice(0, limit).map(function(g, i) {
      return 'Contoh ' + (i+1) + ': "' + g.text + '" (' + (g.why || '') + ')';
    }).join('\n');
  }
};

module.exports = { generate: generate };
