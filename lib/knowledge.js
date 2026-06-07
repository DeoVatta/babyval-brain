/**
 * KNOWLEDGE — Research, Good Examples, Good Patterns
 * Sumber pengetahuan yang terus berkembang
 */
const fs = require('fs');
const path = require('path');

// Path relatif ke tools/babyval-db/ — shared across all tools
var DB_DIR = null;

function setDbDir(dir) {
  DB_DIR = dir;
}

function getDbDir() {
  if (DB_DIR) return DB_DIR;
  // Fallback: relative from tools/
  return path.join(__dirname, '..', '..', 'tools', 'babyval-db');
}

// ===================== RESEARCH =====================

function loadResearch() {
  try {
    return JSON.parse(fs.readFileSync(path.join(getDbDir(), 'research.json'), 'utf-8'));
  } catch(e) {
    return null;
  }
}

function findGameCtx(gameName, research) {
  if (!research || !research.data || !research.data.reddit) return null;
  var results = [];
  var subs = Object.keys(research.data.reddit);
  for (var si = 0; si < subs.length; si++) {
    var arr = research.data.reddit[subs[si]];
    if (Array.isArray(arr)) {
      for (var ti = 0; ti < arr.length; ti++) {
        if (typeof arr[ti] === 'string' && arr[ti].toLowerCase().indexOf(gameName.toLowerCase()) !== -1) {
          results.push({ sub: subs[si], text: arr[ti] });
        }
      }
    }
  }
  return results.length > 0 ? results : null;
}

// ===================== GOOD CONTENT =====================

function loadGoodContent() {
  try {
    return JSON.parse(fs.readFileSync(path.join(getDbDir(), 'good-content.json'), 'utf-8'));
  } catch(e) {
    return null;
  }
}

function getGoodExamples(goodContent, platform, limit) {
  if (!goodContent || !goodContent.good) return '';
  limit = limit || 2;
  var filtered = goodContent.good.filter(function(g) { return g.platform === platform; });
  if (filtered.length === 0) filtered = goodContent.good;
  return filtered.slice(0, limit).map(function(g, i) {
    return 'Contoh ' + (i+1) + ': "' + g.text + '" (' + (g.why || '') + ')';
  }).join('\n');
}

function getGoodPatterns(goodContent) {
  if (!goodContent || !goodContent.goodPatterns) return '';
  var top = goodContent.goodPatterns
    .filter(function(p) { return p.from === 'good'; })
    .sort(function(a,b) { return b.weight - a.weight; })
    .slice(0, 5);
  return 'Gaya yg works:\n' + top.map(function(p) { return '- ' + p.pattern + ' — ' + p.use; }).join('\n');
}

module.exports = {
  setDbDir,
  getDbDir,
  loadResearch,
  findGameCtx,
  loadGoodContent,
  getGoodExamples,
  getGoodPatterns
};
