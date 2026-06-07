/**
 * TEVI — Platform generator (v2.2: TEMPLATE-FIRST, AI fallback)
 * Dipanggil oleh Brain.generate('tevi', context)
 * 
 * 2 modes:
 *   1. Content description — context.analysis (caption for uploaded file)
 *   2. Text post (CTA) — context.ctaType
 *
 * FLOW:
 *   1. Analysis dari content DB (0 token)
 *   2. Cari template matching di good-content.json tevi_templates
 *   3. KETEMU → adaptasi, gunakan (0 token)
 *   4. GAK KETEMU → generate pake DeepSeek (jarang)
 */
var callAI = require('../lib/deepseek').callAI;
var persona = require('../lib/persona');
var knowledge = require('../lib/knowledge');
var validator = require('../lib/validator');

async function generate(context) {
  if (context.analysis) return await generateDescription(context);
  return await generateTextPost(context);
}

// ===================== MATCHING ENGINE =====================

function findMatchingTemplate(analysis, brain) {
  var templates = (brain && brain.goodContent && brain.goodContent.tevi_templates) || [];
  if (templates.length === 0) return null;

  var a = analysis || {};
  var outfit = (a.outfit || '').toLowerCase();
  var pose = (a.pose || '').toLowerCase();
  var actions = (a.actions || []).map(function(s) { return s.toLowerCase(); });
  var bodyFocus = (a.bodyFocus || []).map(function(s) { return s.toLowerCase(); });
  var isVideo = a.type === 'video';

  // Scoring tiap template
  var scored = [];
  for (var ti = 0; ti < templates.length; ti++) {
    var t = templates[ti];
    var score = 0;
    
    // Cocok tipe (foto/video)
    if (t.type === a.type) score += 20;
    else if (!t.type) score += 10;
    
    // Cocok NSFW/SFW
    if (t.nsfw === a.nsfw) score += 15;
    
    // Cocok action (paling penting)
    if (actions.length > 0) {
      for (var ai = 0; ai < actions.length; ai++) {
        if (t.category && t.category.toLowerCase().indexOf(actions[ai]) !== -1) {
          score += 25;
        }
      }
    }
    
    // Cocok body focus
    if (bodyFocus.length > 0) {
      for (var bi = 0; bi < bodyFocus.length; bi++) {
        if (t.category && t.category.toLowerCase().indexOf(bodyFocus[bi]) !== -1) {
          score += 15;
        }
      }
    }
    
    // Cocok pose
    if (pose && t.category) {
      var catWords = t.category.toLowerCase().split(/[->_ ]+/);
      for (var ci = 0; ci < catWords.length; ci++) {
        if (pose.indexOf(catWords[ci]) !== -1 || catWords[ci].indexOf(pose) !== -1) {
          score += 10;
          break;
        }
      }
    }
    
    scored.push({ template: t, score: score, text: t.text });
  }
  
  // Sort by score descending
  scored.sort(function(a, b) { return b.score - a.score; });
  
  // Return best match (kalo skor minimal 20)
  if (scored.length > 0 && scored[0].score >= 20) {
    var t = scored[0];
    // Replace template variables
    var text = t.text;
    if (outfit) text = text.replace(/{outfit}/g, outfit);
    if (analysis.outfit) text = text.replace(/{theme}/g, analysis.outfit.toLowerCase().replace(/\s+/g, '_'));
    t.text = text;
    return t;
  }
  
  return null;
}

function findCtaTemplate(ctaType, brain) {
  var templates = (brain && brain.goodContent && brain.goodContent.tevi_templates) || [];
  if (templates.length === 0) return null;
  
  // Cari template foto (photo) atau generic — paling cocok buat text post CTA
  var photoTemplates = templates.filter(function(t) { return t.type === 'photo' || !t.type; });
  if (photoTemplates.length > 0) {
    var pick = photoTemplates[Math.floor(Math.random() * photoTemplates.length)];
    return { text: pick.text, source: 'template_cta' };
  }
  return null;
}

// ===================== CONTENT DESCRIPTION =====================

async function generateDescription(context) {
  var brain = context._brain;
  var analysis = context.analysis || {};
  var fromCache = analysis.fromCache === true;
  
  // STEP 1: Cari template matching (0 token!)
  var match = findMatchingTemplate(analysis, brain);
  if (match) {
    console.log('[BRAIN Tevi Cap] TEMPLATE HIT: score ' + match.score + ' -> ' + match.text.substring(0, 40));
    return { text: match.text, source: 'template_match' };
  }
  
  console.log('[BRAIN Tevi Cap] TEMPLATE MISS — falling back to AI');
  
  // STEP 2: Fallback ke AI (jarang)
  var time = validator.getTimeContext();
  var mood = 'playful';
  if (time.hour >= 22 || time.hour <= 4) mood = 'horny nocturnal';
  else if (time.isWeekend) mood = 'weekend chill';
  
  var parts = (analysis.bodyFocus || []).join(', ') || 'unknown';
  var outfit = analysis.outfit || 'variasi';
  var cosplay = analysis.cosplay || '';
  var pose = analysis.pose || 'unknown';
  var isVid = analysis.type === 'video' ? 'video' : 'foto';
  
  var sp = 'Kamu Baby Val. ' + persona.PERSONA.substring(0, 150) +
    'Buat caption konten Tevi (@cutieval). 1 kalimat 4-10 kata, bikin penasaran. ' +
    'NO emoji NO hashtag NO titik. Genit, playful. ' +
    'DILARANG: semoga, mungkin, sayang, nyamber, posing, buka kaki, bahasa daerah.';
  
  var up = 'Upload ' + isVid + ':\n' +
    'Outfit: ' + outfit + (cosplay ? ' (cosplay ' + cosplay + ')' : '') +
    ' | Pose: ' + pose +
    ' | Fokus: ' + parts +
    ' | Mood: ' + mood +
    ' | ' + time.timeOfDay + '\n' +
    'CAPTION (1 kalimat, tanpa titik):';
  
  for (var retry = 0; retry < 2; retry++) {
    try {
      var t1 = await callAI(sp, up, 80);
      if (!t1 || t1.trim().length < 3) continue;
      var t2 = await humanize(t1, { analysis: analysis, time: time, mood: mood });
      var bad = validator.checkBad(t2, context._badContent);
      if (bad) continue;
      return { text: t2, source: fromCache ? 'ai_fallback_cache' : 'ai_fallback' };
    } catch(e) {
      console.log('[BRAIN Tevi Cap] retry ' + retry + ' error:', (e.message || '').substring(0, 50));
    }
  }
  return { text: null, source: 'failed' };
}

// ===================== TEXT POST (CTA) =====================

async function generateTextPost(context) {
  var brain = context._brain;
  var ctaType = context.ctaType || 'topup';
  var time = validator.getTimeContext();
  
  var mood = 'playful';
  if (time.hour >= 22 || time.hour <= 4) mood = 'horny nocturnal';
  else if (time.timeOfDay === 'pagi') mood = 'casual morning';
  else if (time.isWeekend) mood = 'weekend chill';
  
  // STEP 1: Cari template CTA matching (0 token!)
  var ctaMatch = findCtaTemplate(ctaType, brain);
  if (ctaMatch) {
    console.log('[BRAIN Tevi] CTA TEMPLATE HIT: ' + ctaMatch.text.substring(0, 40));
    return { text: ctaMatch.text, source: 'template_cta' };
  }
  
  // STEP 2: Fallback AI
  console.log('[BRAIN Tevi] CTA TEMPLATE MISS — AI fallback');
  var ctaD = {
    topup: 'Ajak topup star babyval.com',
    exclusive: 'Promo exclusive babyval.com', live: 'Info streaming Tevi',
    vcs: 'Tawaran VCS', membership: 'Promo membership babyval.com'
  };
  
  var sp = 'Kamu Baby Val. ' + persona.PERSONA.substring(0, 150) +
    'Buat text post Tevi (@cutieval). 1 kalimat 4-10 kata, bikin penasaran + mau topup. ' +
    'NO emoji NO hashtag NO tanda kutip NO titik. Jangan vulgar langsung. ' +
    'DILARANG: semoga, mungkin, sayang, nyamber, posing, buka kaki, bahasa daerah.';
  
  var up = 'Text post Tevi:\nJenis: ' + ctaType + ' | Waktu: ' + time.timeOfDay + ', ' + time.day + ' | Mood: ' + mood + '\nTULISAN (1 kalimat, tanpa titik, tanpa emoji):';
  
  for (var retry = 0; retry < 2; retry++) {
    try {
      var t1 = await callAI(sp, up, 80);
      if (!t1 || t1.trim().length < 3) continue;
      var t2 = await humanize(t1, { ctaType: ctaType, time: time, mood: mood });
      var bad = validator.checkBad(t2, context._badContent);
      if (bad) continue;
      return { text: t2, source: 'ai_humanized' };
    } catch(e) {
      console.log('[BRAIN Tevi] retry ' + retry + ' error:', (e.message || '').substring(0, 50));
    }
  }
  
  console.log('[BRAIN Tevi] fallback');
  var catMap = { topup: 'topup_cta', exclusive: 'exclusive_cta', live: 'live_cta', vcs: 'vcs_cta' };
  var cat = catMap[ctaType] || 'default';
  try {
    var te = context._templateEngine;
    if (te) { var r = te.generate('tevi', cat); return { text: r.text, source: 'template' }; }
  } catch(e2) {}
  return { text: 'Topup star di babyval.com ya', source: 'fallback' };
}

// ===================== SHARED HUMANIZE =====================

async function humanize(text, ctx) {
  var sp = 'Quality editor Tevi. Natural? Genit? Cocok? Refine biar makin alami.';
  var up = 'Review:\n"' + text + '"\n' +
    (ctx.ctaType ? 'CTA: ' + ctx.ctaType : '') +
    (ctx.time ? ' | ' + ctx.time.timeOfDay : '') +
    (ctx.mood ? ' | Mood: ' + ctx.mood : '') + '\n\nVersi final (1 kalimat, tanpa label):';
  try {
    var f = await callAI(sp, up, 80);
    f = f.replace(/^["']+|["']+$/g, '').trim();
    var m = f.match(/2\.\s*([^]+)/);
    if (m && m[1]) f = m[1].trim();
    return f.replace(/\.$/g, '') || text;
  } catch(e) { return text; }
}

module.exports = { generate: generate };
