# 🧠 Babyval Brain

AI Content Brain untuk Baby Val — modular, evolving, platform-agnostic.

```
babyval-brain/
├── index.js           ← Main entry: class Brain
├── package.json       ← package: babyval-brain
├── lib/
│   ├── persona.js     ← Baby Val persona (system prompt)
│   ├── deepseek.js    ← AI API caller (swappable)
│   ├── knowledge.js   ← Research DB + good examples
│   ├── validator.js   ← Bad content check + URL check
│   └── template.js    ← Fallback template engine
└── platforms/
    ├── x.js           ← X/Twitter generator
    └── tevi.js        ← Tevi text post generator
```

## Cara Pakai

```js
var Brain = require('babyval-brain');
var brain = new Brain();

// Generate untuk platform apapun
var x = await brain.generate('x', { topic: 'GTA 6', topikAsli: 'GTA 6 hype September' });
var tevi = await brain.generate('tevi', { ctaType: 'topup' });

// Validasi konten
var result = brain.validate('text yang mau dicek');
// { valid: true } atau { valid: false, reason: '...' }

// Referensi konten bagus
brain.getGoodExamples('x', 2);  // 2 contoh terbaik untuk X
brain.getGoodPatterns();         // Pola yang works

// Research
brain.findGameCtx('God of War');

// Daftar platform
brain.listPlatforms();  // ['x', 'tevi']
```

## Cara Kerja

```
generate(platform, context)
  → Inject knowledge (research, good examples, bad patterns)
  → PASS 1: Generate via AI
  → PASS 2: Humanize via AI
  → Validate (bad content check, double URL check)
  → Retry max 3x kalo gagal
  → Fallback ke template engine
  → Return { text, source }
```

## Menambah Platform Baru

Buat file di `platforms/<nama>.js` yang export `{ generate }`:

```js
// platforms/discord.js
async function generate(context) {
  // context._brain, context._research, dll available
  return { text: '...', source: 'ai' };
}
module.exports = { generate };
```

Otomatis terdeteksi oleh brain — gak perlu daftarin manual.

## DB Dependencies

Semua DB di `tools/babyval-db/`:
- `research.json` — gaming trends dari Reddit
- `good-content.json` — good/mid/bad content catalog
- `bad-content.json` — bad patterns untuk validation

## API Key

```
DEEPSEEK_API_KEY=sk-xxx
```
