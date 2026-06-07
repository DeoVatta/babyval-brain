/**
 * BABYVAL BRAIN — Main entry point
 * Modular AI Content Generation Engine
 *
 * Usage:
 *   var Brain = require('babyval-brain');
 *   var brain = new Brain();
 *   var result = await brain.generate('x', { topic: 'GTA 6' });
 *   var result = await brain.generate('tevi', { ctaType: 'topup' });
 */
var persona = require('./lib/persona');
var deepseek = require('./lib/deepseek');
var validator = require('./lib/validator');
var knowledge = require('./lib/knowledge');

// Platform generators — auto-loaded
var PLATFORMS = {};
try { PLATFORMS.x = require('./platforms/x'); } catch(e) {}
try { PLATFORMS.tevi = require('./platforms/tevi'); } catch(e) {}

// Template fallback
var templateEngine = null;
try { templateEngine = new (require('./lib/template'))(); } catch(e) {}

class Brain {
  /**
   * @param {object} opts
   * @param {string} opts.dbDir — path ke folder babyval-db (default: ../tools/babyval-db)
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
    }
  }

  /**
   * Generate content for any platform
   * @param {string} platform — 'x', 'tevi', etc
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
   * Validate content against bad patterns
   */
  validate(text, context) {
    return validator.assessQuality(text, context || {});
  }

  /**
   * Quick check: apakah konten acceptable (good/mid, bukan bad)?
   */
  isAcceptable(text) {
    var q = validator.assessQuality(text);
    return q.level !== 'bad';
  }

  /**
   * Assess quality with suggestions
   */
  assessQuality(text, context) {
    return validator.assessQuality(text, context);
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
   * Get time context
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


  // ===================== BACKWARD COMPAT =====================
  /** @deprecated Use brain.generate('x', { topic }) instead */
  async generateX(opts) { return this.generate('x', opts); }

  /** @deprecated Use brain.generate('tevi', { ctaType }) instead */
  async generateTeviText(opts) { return this.generate('tevi', opts); }
}

module.exports = Brain;
