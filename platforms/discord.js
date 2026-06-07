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
var knowledge = require('../lib/knowledge');

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
  // KNOWLEDGE LOOKUP — Deteksi intent & cari jawaban (0 token!)
  // Sebelum AI generate, cek dulu apakah ini pertanyaan yang
  // jawabannya udah ada di knowledge base (pricing, FAQ, social)
  // ============================================================
  var knowledgeResult = null;
  var knowledgeType = null;
  var qLower = q.toLowerCase();

  // 1. DETEKSI INTENT: PERTANYAAN VCS / HARGA
  var isVCSQuestion = (qLower.indexOf('vcs') !== -1) &&
    (qLower.indexOf('berapa') !== -1 || qLower.indexOf('harga') !== -1 || qLower.indexOf('price') !== -1 || qLower.indexOf('mahal') !== -1 || qLower.indexOf('cost') !== -1);
  var isPricingQuestion = (qLower.indexOf('harga') !== -1 || qLower.indexOf('price') !== -1) &&
    (qLower.indexOf('member') !== -1 || qLower.indexOf('topup') !== -1 || qLower.indexOf('star') !== -1 || qLower.indexOf('request') !== -1 || qLower.indexOf('content') !== -1);
  var isGeneralVCS = qLower.indexOf('vcs') !== -1 && q.length < 30;

  if (isVCSQuestion || isGeneralVCS) {
    knowledgeResult = knowledge.searchPricing(q);
    knowledgeType = 'pricing_vcs';
    if (!knowledgeResult && isGeneralVCS) {
      // Ambil semua VCS items kalo gak spesifik
      var pricing = knowledge.loadPricing();
      if (pricing && pricing.vcs && pricing.vcs.items) {
        knowledgeResult = pricing.vcs.items.map(function(i) {
          return { category: 'vcs', item: i, label: pricing.vcs.label };
        });
      }
    }
  }

  if (!knowledgeResult && isPricingQuestion) {
    knowledgeResult = knowledge.searchPricing(q);
    knowledgeType = 'pricing';
  }

  // 2. DETEKSI INTENT: PERTANYAAN SOSMED / PLATFORM
  // Kata platform harus minimal 3 huruf (kecuali 'x') biar gak false match
  var socialKeywords = ['instagram', 'ig ', 'twitter', 'tiktok', 'youtube', 'twitch', 'discord', 'tevi', 'ganknow', 'onlyfans', 'sosmed', 'follow', 'subscribe'];
  var isSocialQuestion = false;
  for (var ski = 0; ski < socialKeywords.length; ski++) {
    if (qLower.indexOf(socialKeywords[ski]) !== -1) {
      isSocialQuestion = true;
      break;
    }
  }

  if (!knowledgeResult && isSocialQuestion) {
    var socialResult = knowledge.searchSocial(q);
    if (socialResult) {
      knowledgeResult = socialResult;
      knowledgeType = 'social';
    }
  }

  // 3. DETEKSI INTENT: FAQ / CARA / UMUM
  var isFAQQuestion = (qLower.indexOf('cara') !== -1 || qLower.indexOf('bagaimana') !== -1 ||
    qLower.indexOf('gimana') !== -1 || qLower.indexOf('how') !== -1 ||
    qLower.indexOf('buka') !== -1 || qLower.indexOf('akses') !== -1 ||
    qLower.indexOf('bayar') !== -1 || qLower.indexOf('topup') !== -1 ||
    qLower.indexOf('join') !== -1 || qLower.indexOf('daftar') !== -1 ||
    qLower.indexOf('error') !== -1 || qLower.indexOf('gagal') !== -1);

  if (!knowledgeResult && isFAQQuestion) {
    var faqResult = knowledge.searchFAQ(q);
    if (faqResult) {
      knowledgeResult = faqResult;
      knowledgeType = 'faq';
    }
  }

  // 4. DETEKSI INTENT: SERVICE LOOKUP
  // Minimal 2 kata, dan kata kunci lebih spesifik biar gak false positive
  var isServiceQuestion = q.split(/\s+/).length >= 3 &&
    (qLower.indexOf('itu apa') !== -1 || qLower.indexOf('what') !== -1 ||
    qLower.indexOf('kamu punya') !== -1 || qLower.indexOf('layanan') !== -1 ||
    (qLower.indexOf('request') !== -1 && qLower.indexOf('content') !== -1) ||
    (qLower.indexOf('request') !== -1 && qLower.indexOf('foto') !== -1) ||
    (qLower.indexOf('main') !== -1 && (qLower.indexOf('game') !== -1 || qLower.indexOf('bareng') !== -1)));

  if (!knowledgeResult && isServiceQuestion) {
    var svcResult = knowledge.searchService(q);
    if (svcResult) {
      knowledgeResult = svcResult.service;
      knowledgeType = 'service';
    }
  }

  // ============================================================
  // KNOWLEDGE ANSWER — Template match (0 token!)
  // Kalo ketemu jawaban di knowledge, langsung return pake template
  // ============================================================
  if (knowledgeResult && knowledgeType) {
    var knowledgeAnswer = knowledgeHelper.buildKnowledgeAnswer(knowledgeResult, knowledgeType, author, q);
    if (knowledgeAnswer) {
      console.log('[BRAIN Discord] Knowledge answer: ' + knowledgeType + ' (0 token)');
      return { text: knowledgeAnswer, source: 'knowledge_' + knowledgeType };
    }
  }

  // Inject knowledge context ke AI prompt (kalo ditemukan sebagian)
  var knowledgeContext = '';
  if (knowledgeResult) {
    // Kasih context ke AI biar generate lebih akurat
    knowledgeContext = knowledgeHelper.getKnowledgeContextString(knowledgeResult, knowledgeType);
  }

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
    (knowledgeContext ? '- Data: ' + knowledgeContext + '\n' : '') +
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
  },

  /**
   * Build answer string dari knowledge lookup.
   * Ini yang langsung dikirim sebagai jawaban (0 token cost!)
   */
  buildKnowledgeAnswer: function(result, type, author, originalQuestion) {
    var q = (originalQuestion || '').toLowerCase();

    switch (type) {
      // ============ PRICING: VCS ============
      case 'pricing_vcs':
        if (!result || result.length === 0) return null;
        var lines = [];
        for (var vi = 0; vi < result.length; vi++) {
          var item = result[vi].item;
          lines.push(item.duration + ' — ' + item.price);
        }
        var cta = result[0].item.cta || 'langsung ke babyval.com ya~';
        return 'VCS Baby Val: ' + lines.join(', ') + '. ' + capitalize(cta) + '~ \u2728';

      // ============ PRICING: UMUM ============
      case 'pricing':
        if (!result || result.length === 0) return null;
        var items = [];
        for (var pi = 0; pi < result.length; pi++) {
          items.push(result[pi].item.duration + ' ' + result[pi].item.price);
        }
        var category = result[0].label || 'Layanan';
        return category + ': ' + items.join(', ') + '. Cek babyval.com buat info lengkapnya~';

      // ============ SOCIAL ============
      case 'social':
        if (!result) return null;
        var plat = result.platform || '';
        var uname = result.username || result.server || '';
        var url = result.url || result.invite || '';
        var desc = result.description ? ' ' + result.description : '';
        var ctaText = result.cta || (result.invite ? 'join via ' + result.invite : 'follow ' + plat);
        var displayStr = uname ? plat + ' Baby Val: ' + uname : plat + ' Baby Val';
        var linkStr = url ? ' \u2014 ' + url : '';
        return displayStr + linkStr + '.' + desc + ' ' + capitalize(ctaText) + '~';

      // ============ FAQ ============
      case 'faq':
        if (!result) return null;
        var answer = result.answer || '';
        var ctaLink = result.cta ? ' ' + capitalize(result.cta) + ' ya~' : '';
        return answer + ctaLink;

      // ============ SERVICE ============
      case 'service':
        if (!result) return null;
        var svcName = result.name || '';
        var svcDesc = result.description || '';
        var svcCTA = result.cta ? ' ' + capitalize(result.cta) + ' ya~' : '';
        return svcName + '? ' + svcDesc + svcCTA + ' \u2728';

      default:
        return null;
    }
  },

  /**
   * Build context string buat di-inject ke AI prompt.
   * Dipake kalo knowledge ditemukan tapi gak cocok sempurna.
   */
  getKnowledgeContextString: function(result, type) {
    if (!result) return '';
    switch (type) {
      case 'pricing_vcs':
        return 'VCS: ' + knowledge.getVCSPriceList();
      case 'social':
        return result.platform + '=' + result.url;
      case 'faq':
        return 'FAQ: ' + (result.answer || '').substring(0, 100);
      case 'service':
        return 'Service: ' + (result.description || '').substring(0, 100);
      default:
        return '';
    }
  }
};

// Simple capitalize helper
function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function capital(s) {
  return capitalize(s);
}

module.exports = { generate: generate };
