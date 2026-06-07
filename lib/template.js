/**
 * TEMPLATE — Fallback content generator
 * Pake persona-engine kalo AI gagal
 */
var templateEngine = null;

try {
  // Coba load dari tools/ atau dari parent
  var paths = [
    '../persona-engine',
    '../../tools/persona-engine'
  ];
  for (var i = 0; i < paths.length; i++) {
    try {
      var PE = require(paths[i]);
      templateEngine = new PE();
      break;
    } catch(e) {}
  }
} catch(e) {}

function generate(platform, category, context) {
  if (!templateEngine) return { text: '' };
  return templateEngine.generate(platform, category, context);
}

module.exports = function() {
  this.generate = generate;
};
