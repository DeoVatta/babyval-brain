/**
 * VALIDATOR — Quality assessment + 6 Kriteria Validasi
 *
 * Bisa dipake oleh platform manapun untuk:
 * 1. assessQuality → good / mid / bad + score + alasan
 * 2. validate6Criteria → 6 kriteria: monoton? humanize? solve? goals? value? persona?
 * 3. checkBad → reject + reason (legacy)
 * 4. checkDoubleUrl
 */
const fs = require('fs');
const path = require('path');

var DB_DIR = null;

function setDbDir(dir) {
  DB_DIR = dir;
}

function getDbDir() {
  if (DB_DIR) return DB_DIR;
  return path.join(__dirname, '..', '..', '..', 'tools', 'babyval-db');
}

// ===================== LOAD DBs =====================

function loadBadContent() {
  try {
    return JSON.parse(fs.readFileSync(path.join(getDbDir(), 'bad-content.json'), 'utf-8'));
  } catch(e) { return null; }
}

function loadGoodContent() {
  try {
    return JSON.parse(fs.readFileSync(path.join(getDbDir(), 'good-content.json'), 'utf-8'));
  } catch(e) { return null; }
}

// ===================== 6 KRITERIA VALIDASI =====================

/**
 * Validate konten dengan 6 kriteria.
 * Ini yang dipanggil setelah AI generate + humanize.
 *
 * @param {string} text — konten yang mau divalidasi
 * @param {object} context — { platform, originalQuestion, channel, author, communityHealth }
 * @returns {object} {
 *   passed: boolean,
 *   score: number (0-100),
 *   criteria: { nama_kriteria: { passed, score, reason } },
 *   overall: 'good'|'mid'|'bad',
 *   suggestions: []
 * }
 */
function validate6Criteria(text, context) {
  if (!text || text.trim().length === 0) {
    return {
      passed: false,
      score: 0,
      criteria: {},
      overall: 'bad',
      suggestions: ['Konten kosong']
    };
  }

  var ctx = context || {};
  var lower = text.toLowerCase();
  var criteria = {};
  var totalScore = 0;
  var maxScore = 600; // 6 kriteria × 100
  var suggestions = [];

  // ============================================================
  // KRITERIA 1: MONOTON? (Apakah jawaban monoton/itu-itu aja?)
  // ============================================================
  var c1 = { passed: true, score: 80, reason: '', details: [] };

  // Cek kata berulang
  var words = text.split(/\s+/);
  var wordFreq = {};
  for (var w = 0; w < words.length; w++) {
    var wl = words[w].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (wl.length > 2) wordFreq[wl] = (wordFreq[wl] || 0) + 1;
  }
  var repeatedWords = Object.keys(wordFreq).filter(function(k) { return wordFreq[k] > 1; });
  if (repeatedWords.length > 0 && words.length > 3 && repeatedWords.length / words.length > 0.5) {
    c1.passed = false;
    c1.score -= 30;
    c1.reason = 'Terlalu banyak kata diulang — monoton';
    c1.details.push('Kata diulang: ' + repeatedWords.slice(0, 5).join(', '));
    suggestions.push('Variasikan pilihan kata, hindari pengulangan');
  }

  // Cek pola template umum yang monoton
  var templatePatterns = ['untuk kamu', 'buat kamu', 'nih', 'dong', 'ya', 'santai aja'];
  var foundTemplates = [];
  for (var tp = 0; tp < templatePatterns.length; tp++) {
    if (lower.indexOf(templatePatterns[tp]) !== -1) foundTemplates.push(templatePatterns[tp]);
  }
  if (foundTemplates.length >= 3) {
    c1.passed = false;
    c1.score -= 20;
    c1.reason = 'Terlalu banyak template pattern — keliatan bot';
    c1.details.push('Patterns: ' + foundTemplates.join(', '));
    suggestions.push('Kurangi penggunaan kata template, bikin lebih natural');
  }

  // Cek panjang kalimat monoton (semua pendek atau semua panjang)
  var sentences = text.split(/[.!?]+/).filter(Boolean);
  if (sentences.length > 1) {
    var lengths = sentences.map(function(s) { return s.trim().split(/\s+/).length; });
    var avgLen = lengths.reduce(function(a, b) { return a + b; }, 0) / lengths.length;
    var variance = lengths.reduce(function(a, b) { return a + Math.abs(b - avgLen); }, 0) / lengths.length;
    if (variance < 0.5 && sentences.length > 2) {
      c1.score -= 10;
      c1.details.push('Struktur kalimat terlalu seragam');
      suggestions.push('Variasikan panjang kalimat — campur pendek dan panjang');
    }
  }

  criteria.monoton = c1;
  totalScore += c1.score;

  // ============================================================
  // KRITERIA 2: HUMANIZE? (Kedengeran kayak orang ngobrol?)
  // ============================================================
  var c2 = { passed: true, score: 80, reason: '', details: [] };

  // Cek apakah terlalu formal
  var formalPatterns = ['berdasarkan', 'oleh karena itu', 'dapat disimpulkan', 'merupakan',
    'adalah', 'dengan demikian', 'sehingga', 'oleh sebab itu', 'maka dari itu',
    'terima kasih atas', 'saya ucapkan', 'demikian'];
  var foundFormal = [];
  for (var fp = 0; fp < formalPatterns.length; fp++) {
    if (lower.indexOf(formalPatterns[fp]) !== -1) foundFormal.push(formalPatterns[fp]);
  }
  if (foundFormal.length > 0) {
    c2.passed = false;
    c2.score -= 30;
    c2.reason = 'Terlalu formal — gak natural buat chat';
    c2.details.push('Kata formal: ' + foundFormal.join(', '));
    suggestions.push('Ganti dengan bahasa sehari-hari yang lebih santai');
  }

  // Cek apakah ada tanda-tanda bot
  var botPatterns = ['sebagai ai', 'saya adalah bot', 'saya tidak bisa', 'maaf saya',
    'saya hanya', 'saya tidak memiliki', 'apakah ada yang'];
  for (var bp = 0; bp < botPatterns.length; bp++) {
    if (lower.indexOf(botPatterns[bp]) !== -1) {
      c2.passed = false;
      c2.score -= 40;
      c2.reason = 'Keliatan banget kayak bot — hindari disclaimer AI';
      c2.details.push('Bot pattern: "' + botPatterns[bp] + '"');
      suggestions.push('Jangan pake frasa AI/bot, ngomong natural kayak manusia');
      break;
    }
  }

  // Cek natural language flow — ada kontraksi/ngomong biasa?
  var naturalMarkers = ['si', 'deh', 'sih', 'dong', 'aja', 'ya', 'kok', 'kan', 'tuh',
    'loh', 'nih', 'gue', 'lu', 'aku', 'kamu'];
  var naturalCount = 0;
  for (var nm = 0; nm < naturalMarkers.length; nm++) {
    if (lower.indexOf(naturalMarkers[nm]) !== -1) naturalCount++;
  }
  if (naturalCount < 2 && words.length > 5) {
    c2.score -= 15;
    c2.details.push('Kurang natural speech markers');
    suggestions.push('Tambahkan partikel alami: sih, deh, kok, dll biar lebih ngobrol');
  }

  criteria.humanize = c2;
  totalScore += c2.score;

  // ============================================================
  // KRITERIA 3: SOLVE CASE? (Menyelesaikan masalah user?)
  // ============================================================
  var c3 = { passed: true, score: 80, reason: '', details: [] };

  if (ctx.originalQuestion) {
    var q = ctx.originalQuestion.toLowerCase();
    var qWords = q.split(/\s+/);
    var relevantWords = 0;

    // Cek apakah jawaban mengandung kata kunci dari pertanyaan
    for (var qi = 0; qi < qWords.length; qi++) {
      var qw = qWords[qi].replace(/[^a-z0-9]/g, '');
      if (qw.length > 3 && lower.indexOf(qw) !== -1) {
        relevantWords++;
      }
    }

    var ratio = qWords.length > 0 ? relevantWords / qWords.length : 0;
    if (ratio < 0.2) {
      c3.passed = false;
      c3.score -= 40;
      c3.reason = 'Jawaban gak nyambung sama pertanyaan user';
      c3.details.push('Pertanyaan: "' + ctx.originalQuestion.substring(0, 50) + '"');
      c3.details.push('Relevansi kata kunci: ' + Math.round(ratio * 100) + '%');
      suggestions.push('Pastikan jawaban relate langsung dengan apa yang ditanya');
    }

    // Cek apakah jawaban ngasih solusi/arah (bukan cuma ooh iya aja)
    var solutionMarkers = ['coba', 'bisa', 'coba aja', 'mungkin', 'kalo', 'kalau', 'saran',
      'cek', 'lihat', 'tengok', 'intip', 'lirik'];
    var hasSolution = false;
    for (var sm = 0; sm < solutionMarkers.length; sm++) {
      if (lower.indexOf(solutionMarkers[sm]) !== -1) { hasSolution = true; break; }
    }
    if (!hasSolution && words.length > 3) {
      c3.score -= 10;
      c3.details.push('Kurang solusi/arahan — cuma komentar doang');
      suggestions.push('Tambahkan saran atau arah ke solusi biar lebih membantu');
    }
  }

  criteria.solveCase = c3;
  totalScore += c3.score;

  // ============================================================
  // KRITERIA 4: GOALS? (Mengarah ke goals komunitas/engagement?)
  // ============================================================
  var c4 = { passed: true, score: 80, reason: '', details: [] };
  var platform = ctx.platform || 'discord';

  // Goals Discord: engagement, diskusi, sustain chat
  if (platform === 'discord' || platform === 'general') {
    // Cek apakah ada ajakan diskusi
    var discussionMarkers = ['menurut kamu', 'kalo kamu', 'gimana', 'pendapat', 'setuju',
      'kayaknya', 'menurutmu', 'gmn', 'gimana menurut', 'kamu gimana'];
    var hasDiscussionHook = false;
    for (var dm = 0; dm < discussionMarkers.length; dm++) {
      if (lower.indexOf(discussionMarkers[dm]) !== -1) { hasDiscussionHook = true; break; }
    }
    if (!hasDiscussionHook) {
      c4.score -= 15;
      c4.details.push('Gak ada ajakan diskusi — kurang engaging');
      suggestions.push('Tambah pertanyaan atau ajakan diskusi di akhir biar rame');
    }

    // Cek apakah ada hook
    var hookMarkers = ['liat', 'tahu', 'tau', 'penasaran', 'udah pada', 'yang suka',
      'siapa yang', 'ada yang', 'pernah', 'udah coba'];
    var hasHook = false;
    for (var hm = 0; hm < hookMarkers.length; hm++) {
      if (lower.indexOf(hookMarkers[hm]) !== -1) { hasHook = true; break; }
    }
    if (!hasHook) {
      c4.score -= 10;
      c4.details.push('Kurang hook buat narik perhatian');
    }

    // Cek panjang — terlalu panjang = kurang engaging di chat
    if (words.length > 60) {
      c4.score -= 10;
      c4.details.push('Terlalu panjang untuk chat — orang males baca');
      suggestions.push('Bikin lebih pendek, 2-3 kalimat aja');
    }
    if (words.length < 3) {
      c4.score -= 15;
      c4.details.push('Terlalu pendek — gak engaging');
      suggestions.push('Tambah konteks atau pertanyaan biar gak cuma "oh"');
    }
  }

  // Goals Tevi: bikin penasaran + topup
  if (platform === 'tevi') {
    var teviGoodMarkers = ['koleksi', 'exclusive', 'spill', 'intip', 'liat', 'penasaran',
      'pengen', 'kangen', 'versi', 'cuma', 'ada yang', 'siapa yang'];
    var hasGoodMarker = false;
    for (var tgm = 0; tgm < teviGoodMarkers.length; tgm++) {
      if (lower.indexOf(teviGoodMarkers[tgm]) !== -1) { hasGoodMarker = true; break; }
    }
    if (!hasGoodMarker) {
      c4.score -= 15;
      c4.details.push('Kurang hook buat Tevi — gak bikin penasaran');
    }
  }

  // Goals X: pancing diskusi game
  if (platform === 'x') {
    var xMarkers = ['tadi', 'baru', 'liat', 'nonton', 'coba', 'main', 'game', 'steam',
      'discord', 'live', 'stream'];
    var hasXMarker = false;
    for (var xm = 0; xm < xMarkers.length; xm++) {
      if (lower.indexOf(xMarkers[xm]) !== -1) { hasXMarker = true; break; }
    }
    if (!hasXMarker) {
      c4.score -= 10;
      c4.details.push('Kurang hook untuk Twitter game discussion');
    }
  }

  criteria.goals = c4;
  totalScore += c4.score;

  // ============================================================
  // KRITERIA 5: VALUE? (Apakah ada value yang bisa dipetik?)
  // ============================================================
  var c5 = { passed: true, score: 80, reason: '', details: [] };

  // Value = insight, data, opini, pengalaman, humor
  var valueMarkers = ['tadi', 'baru', 'kemarin', 'tadi malem', 'tadi siang', 'baru aja',
    'gue liat', 'aku liat', 'gue rasa', 'menurut', 'pengalaman', 'pas', 'waktu',
    'seru', 'lucu', 'gila', 'parah', 'keren', 'recommend', 'recommended'];
  var hasValue = false;
  for (var vm = 0; vm < valueMarkers.length; vm++) {
    if (lower.indexOf(valueMarkers[vm]) !== -1) { hasValue = true; break; }
  }

  // Cek apakah ada data spesifik
  var dataPatterns = [/\d+K/, /\d+M/, /\d+%/, /\d+rb/, /\d+jt/];
  var hasData = dataPatterns.some(function(dp) { return dp.test(text); });

  if (!hasValue && !hasData) {
    c5.score -= 20;
    c5.details.push('Gak ada value tambahan — cuma basa-basi');
    suggestions.push('Tambahkan opini, pengalaman, atau insight biar ada value');
  }

  if (hasData) c5.score += 10;

  criteria.value = c5;
  totalScore += c5.score;

  // ============================================================
  // KRITERIA 6: PERSONA? (Sesuai persona Baby Val?)
  // ============================================================
  var c6 = { passed: true, score: 80, reason: '', details: [] };
  var persona = require('./persona');
  var pCtx = persona.getEngagementContext();

  // Cek apakah ada bahasa daerah (dilarang)
  // Cek bahasa daerah dengan word boundary (biar substrings gak kena)
  var daerahRegex = /(?:^|\s)(nyamber|nyamberin|bojo|bojone|bojoku|tong|mangga|atos|kulan|urang|simkuring|abdi|punten|nyai|aing|maneh|eta(?=[\s,.)!?])|tea|mah)(?:\s|$|[.,!?])/i;
  var daerahMatch = text.match(daerahRegex);
  if (daerahMatch) {
    c6.passed = false;
    c6.score -= 40;
    c6.reason = 'Mengandung bahasa daerah - DILARANG';
    c6.details.push('kata daerah: ' + daerahMatch[1]);
    suggestions.push('Ganti dengan Bahasa Indonesia baku, bukan bahasa daerah');
  }

  // Cek tone — harus playful, manja, mommy vibe
  if (ctx.requirePlayful !== false) {
    var playfulMarkers = ['santai', 'yuk', 'nyantai', 'tenang', 'pelan',
      'manja', 'sayang', 'beb', 'cinta', 'hmm', 'ah'];
    var hasPlayful = false;
    for (var pm = 0; pm < playfulMarkers.length; pm++) {
      if (lower.indexOf(playfulMarkers[pm]) !== -1) { hasPlayful = true; break; }
    }
    if (!hasPlayful && words.length > 3) {
      c6.score -= 10;
      c6.details.push('Tone kurang playful — coba lebih hangat/manja');
      suggestions.push('Tambahkan tone playful khas Baby Val');
    }
  }

  criteria.persona = c6;
  totalScore += c6.score;

  // ============================================================
  // FINAL SCORE & DECISION
  // ============================================================
  var finalScore = Math.round((totalScore / maxScore) * 100);
  var overall = finalScore >= 70 ? 'good' : (finalScore >= 45 ? 'mid' : 'bad');
  var passed = overall !== 'bad';

  return {
    passed: passed,
    score: finalScore,
    criteria: criteria,
    overall: overall,
    suggestions: suggestions
  };
}

// ===================== LEGACY: ASSESS QUALITY =====================

/**
 * Assess kualitas konten (legacy, pake good/bad DB)
 */
function assessQuality(text, context) {
  if (!text) return { level: 'bad', score: 0, reasons: ['empty'], warnings: [], suggestions: [], matches: [] };

  var lower = text.toLowerCase();
  var result = {
    level: 'good',
    score: 80,
    reasons: [],
    warnings: [],
    suggestions: [],
    matches: []
  };

  var badDB = loadBadContent();
  var goodDB = loadGoodContent();

  // Check bad patterns
  var badPats = (badDB && badDB.badPatterns) || [];
  for (var i = 0; i < badPats.length; i++) {
    if (lower.indexOf(badPats[i].pattern.toLowerCase()) !== -1) {
      result.level = 'bad';
      result.reasons.push(badPats[i].reason);
      result.score -= 25;
    }
  }

  // Check exact bad texts
  var badTexts = (badDB && badDB.badTexts) || [];
  for (var t = 0; t < badTexts.length; t++) {
    if (lower.indexOf(badTexts[t].text.toLowerCase()) !== -1) {
      result.level = 'bad';
      result.reasons.push(badTexts[t].reason);
      result.score -= 30;
    }
  }

  // Check bad patterns by string match
  if (badDB && badDB.badPatterns) {
    for (var bp2 = 0; bp2 < badDB.badPatterns.length; bp2++) {
      if (lower.indexOf(badDB.badPatterns[bp2].pattern) !== -1) {
        result.level = 'bad';
        result.reasons.push(badDB.badPatterns[bp2].reason);
        result.score -= 25;
      }
    }
  }

  // Check double URL
  if (checkDoubleUrl(text)) {
    result.level = 'bad';
    result.reasons.push('double URL');
    result.score -= 20;
  }

  if (result.level === 'bad') {
    result.score = Math.max(result.score, 0);
    return result;
  }

  // Check mid patterns
  var midPats = (goodDB && goodDB.midPatterns) || [];
  var midFound = [];
  for (var m = 0; m < midPats.length; m++) {
    if (lower.indexOf(midPats[m].pattern.toLowerCase()) !== -1) {
      midFound.push(midPats[m]);
      result.warnings.push(midPats[m].reason);
      if (midPats[m].suggestion) result.suggestions.push(midPats[m].suggestion);
      result.score -= midPats[m].weight || 3;
    }
  }
  if (midFound.length > 0 && result.level === 'good') {
    result.level = 'mid';
    result.reasons.push('mengandung pola mid (' + midFound.length + 'x)');
  }

  // Check good patterns
  var goodPats = (goodDB && goodDB.goodPatterns) || [];
  for (var g = 0; g < goodPats.length; g++) {
    if (lower.indexOf(goodPats[g].pattern.toLowerCase()) !== -1) {
      result.matches.push(goodPats[g]);
      result.score += goodPats[g].weight || 5;
    }
  }

  // Length check
  var wordCount = text.split(/\s+/).length;
  if (context && context.platform === 'tevi') {
    if (wordCount < 3) { result.warnings.push('terlalu pendek untuk Tevi (min 3 kata)'); result.score -= 5; }
    if (wordCount > 12) { result.warnings.push('terlalu panjang untuk Tevi desc (max 12 kata)'); result.score -= 5; }
  }
  if (context && context.platform === 'x') {
    if (wordCount < 5) { result.warnings.push('terlalu pendek untuk tweet'); result.score -= 5; }
    if (wordCount > 30) { result.warnings.push('terlalu panjang untuk tweet'); result.score -= 5; }
  }

  // Final level
  if (result.score >= 80 && result.level !== 'mid') result.level = 'good';
  else if (result.score >= 50) result.level = 'mid';
  else result.level = 'bad';

  result.score = Math.min(Math.max(result.score, 0), 100);

  return result;
}

// ===================== LEGACY FUNCTIONS =====================

function checkBad(text, badContent) {
  if (!badContent || !text) return null;
  var result = assessQuality(text);
  if (result.level === 'bad') return result.reasons.join(', ');
  return null;
}

function checkDoubleUrl(text) {
  var count = (text.match(/babyval\.com/g) || []).length + (text.match(/tevi\.com/g) || []).length;
  return count > 1;
}

function getTimeContext() {
  var now = new Date();
  var hour = now.getHours();
  var dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  var day = dayNames[now.getDay()];
  var isWeekend = now.getDay() === 0 || now.getDay() === 6;
  var tod = hour < 5 ? 'dini hari' : hour < 10 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam';
  return { hour: hour, day: day, isWeekend: isWeekend, timeOfDay: tod };
}

module.exports = {
  setDbDir,
  getDbDir,
  loadBadContent,
  loadGoodContent,
  assessQuality,
  validate6Criteria,
  checkBad,
  checkDoubleUrl,
  getTimeContext
};
