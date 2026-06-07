/**
 * VALIDATOR — Quality assessment + bad/mid/good content check
 *
 * Bisa dipake oleh platform manapun untuk:
 * 1. Assess quality → good / mid / bad + alasan
 * 2. Check bad content → reject + reason
 * 3. Check double URL
 * 4. Dapat suggestions untuk improve konten
 */
const fs = require('fs');
const path = require('path');

var DB_DIR = null;

function setDbDir(dir) {
  DB_DIR = dir;
}

function getDbDir() {
  if (DB_DIR) return DB_DIR;
  return path.join(__dirname, '..', '..', 'tools', 'babyval-db');
}

// ===================== LOAD DBs =====================

function loadBadContent() {
  try {
    return JSON.parse(fs.readFileSync(path.join(getDbDir(), 'bad-content.json'), 'utf-8'));
  } catch(e) {
    return null;
  }
}

function loadGoodContent() {
  try {
    return JSON.parse(fs.readFileSync(path.join(getDbDir(), 'good-content.json'), 'utf-8'));
  } catch(e) {
    return null;
  }
}

// ===================== QUALITY ASSESSMENT =====================

/**
 * Assess kualitas konten secara lengkap
 * @param {string} text — konten yang mau dinilai
 * @param {object} context — { platform, ctaType, topic } optional
 * @returns {object} { level: 'good'|'mid'|'bad', score: 0-100, reasons: [], warnings: [], suggestions: [], matches: [] }
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
  
  // ===== CHECK BAD PATTERNS =====
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
  
  // Check double URL
  if (checkDoubleUrl(text)) {
    result.level = 'bad';
    result.reasons.push('double URL');
    result.score -= 20;
  }
  
  // Jika udah bad, stop disini (gak perlu cek mid/good lagi)
  if (result.level === 'bad') {
    result.score = Math.max(result.score, 0);
    return result;
  }
  
  // ===== CHECK MID PATTERNS =====
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
  
  // ===== CHECK GOOD PATTERNS =====
  var goodPats = (goodDB && goodDB.goodPatterns) || [];
  for (var g = 0; g < goodPats.length; g++) {
    if (lower.indexOf(goodPats[g].pattern.toLowerCase()) !== -1) {
      result.matches.push(goodPats[g]);
      result.score += goodPats[g].weight || 5;
    }
  }
  
  // ===== LENGTH CHECK =====
  var wordCount = text.split(/\s+/).length;
  if (context && context.platform === 'tevi') {
    if (wordCount < 3) { result.warnings.push('terlalu pendek untuk Tevi (min 3 kata)'); result.score -= 5; }
    if (wordCount > 12) { result.warnings.push('terlalu panjang untuk Tevi desc (max 12 kata)'); result.score -= 5; }
  }
  if (context && context.platform === 'x') {
    if (wordCount < 5) { result.warnings.push('terlalu pendek untuk tweet'); result.score -= 5; }
    if (wordCount > 30) { result.warnings.push('terlalu panjang untuk tweet'); result.score -= 5; }
  }
  
  // ===== FINAL LEVEL =====
  if (result.score >= 80 && result.level !== 'mid') result.level = 'good';
  else if (result.score >= 50) result.level = 'mid';
  else result.level = 'bad';
  
  result.score = Math.min(Math.max(result.score, 0), 100);
  
  return result;
}

// ===================== LEGACY: BAD CHECK =====================

/**
 * Simple bad check (legacy) — return reason or null
 */
function checkBad(text, badContent) {
  if (!badContent || !text) return null;
  
  var result = assessQuality(text);
  if (result.level === 'bad') {
    return result.reasons.join(', ');
  }
  return null;
}

/**
 * Check if text has more than 1 URL
 */
function checkDoubleUrl(text) {
  var count = (text.match(/babyval\.com/g) || []).length + (text.match(/tevi\.com/g) || []).length;
  return count > 1;
}

/**
 * Time context helper
 */
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
  checkBad,
  checkDoubleUrl,
  getTimeContext
};
