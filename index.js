/**
 * BABYVAL BRAIN — Main entry point
 * Modular AI Content Generation Engine
 * 
 * v2.0 — Added: Discord platform, 6-criteria validation, improved persona loader
 *
 * Usage:
 *   var Brain = require('babyval-brain');
 *   var brain = new Brain();
 *   
 *   // Content generation
 *   var x = await brain.generate('x', { topic: 'GTA 6' });
 *   var tevi = await brain.generate('tevi', { ctaType: 'topup' });
 *   
 *   // Community reply
 *   var discord = await brain.generate('discord', {
 *     originalQuestion: 'Ada yang main RDR2?',
 *     author: 'Deo',
 *     channel: 'general',
 *     topic: 'game'
 *   });
 *   
 *   // Validate with 6 criteria
 *   var v = brain.validate6('teks yang mau dicek', { platform: 'discord', originalQuestion: '...' });
 */
var persona = require('./lib/persona');
var deepseek = require('./lib/deepseek');
var validator = require('./lib/validator');
var knowledge = require('./lib/knowledge');

// Platform generators — auto-loaded (coba semua, skip yg gagal)
var PLATFORMS = {};
var PLATFORM_DIR = __dirname + '/platforms';

var fs = require('fs');
if (fs.existsSync(PLATFORM_DIR)) {
  var files = fs.readdirSync(PLATFORM_DIR);
  for (var fi = 0; fi < files.length; fi++) {
    var f = files[fi];
    if (f.endsWith('.js')) {
      var pName = f.replace('.js', '');
      try {
        PLATFORMS[pName] = require('./platforms/' + pName);
        console.log('[BRAIN] Loaded platform: ' + pName);
      } catch(e) {
        console.log('[BRAIN] Failed to load platform ' + pName + ': ' + (e.message || '').substring(0, 40));
      }
    }
  }
}

// Template fallback engine
var templateEngine = null;
try { templateEngine = new (require('./lib/template'))(); } catch(e) {}

class Brain {
  /**
   * @param {object} opts
   * @param {string} opts.dbDir — path ke folder babyval-db (default: auto-detect)
   */
  constructor(opts) {
    opts = opts || {};
    
    // Init DB paths
    var dbDir = opts.dbDir || validator.getDbDir();
    validator.setDbDir(dbDir);
    knowledge.setDbDir(dbDir);
    
    // Load all knowledge
    this.research = knowledge.loadResearch();
    this.goodContent = knowledge.loadGoodContent();
    this.badContent = validator.loadBadContent();
    
    // Template fallback
    if (opts.templateEngine) {
      this.templateEngine = opts.templateEngine;
    } else {
      this.templateEngine = templateEngine;
    }

    // Reload persona
    persona.loadPersona();

    console.log('[BRAIN] Initialized with ' + Object.keys(PLATFORMS).length + ' platforms: ' +
      Object.keys(PLATFORMS).join(', '));
  }

  /**
   * Generate content for any platform
   * @param {string} platform — 'x', 'tevi', 'discord', etc
   * @param {object} context — platform-specific context
   */
  async generate(platform, context) {
    var generator = PLATFORMS[platform];
    if (!generator) {
      throw new Error('Unknown platform: ' + platform + '. Available: ' + Object.keys(PLATFORMS).join(', '));
    }
    
    // Inject shared resources ke context
    context._brain = this;
    context._research = this.research;
    context._goodContent = this.goodContent;
    context._badContent = this.badContent;
    context._templateEngine = this.templateEngine;
    
    return await generator.generate(context);
  }

  /**
   * Validate content — 6 kriteria (monoton? humanize? solve? goals? value? persona?)
   */
  validate6(text, context) {
    return validator.validate6Criteria(text, context || {});
  }

  /**
   * Legacy: assess quality (good/mid/bad + score)
   */
  assessQuality(text, context) {
    return validator.assessQuality(text, context || {});
  }

  /**
   * Quick check: acceptable?
   */
  isAcceptable(text) {
    var q = validator.assessQuality(text);
    return q.level !== 'bad';
  }

  /**
   * Legacy: check bad content
   */
  checkBad(text) {
    return validator.checkBad(text, this.badContent);
  }

  /**
   * Get good examples untuk platform tertentu
   */
  getGoodExamples(platform, limit) {
    return knowledge.getGoodExamples(this.goodContent, platform, limit);
  }

  /**
   * Get good patterns
   */
  getGoodPatterns() {
    return knowledge.getGoodPatterns(this.goodContent);
  }

  /**
   * Find game context from research DB
   */
  findGameCtx(name) {
    return knowledge.findGameCtx(name, this.research);
  }

  /**
   * Get time context (WIB-aware)
   */
  getTime() {
    return validator.getTimeContext();
  }

  /**
   * Daftar platform yang tersedia
   */
  listPlatforms() {
    return Object.keys(PLATFORMS);
  }

  /**
   * Reload knowledge dari DB (kalo ada update)
   */
  reloadKnowledge() {
    this.research = knowledge.loadResearch();
    this.goodContent = knowledge.loadGoodContent();
    this.badContent = validator.loadBadContent();
    persona.loadPersona();
    console.log('[BRAIN] Knowledge reloaded');
  }
}

module.exports = Brain;
