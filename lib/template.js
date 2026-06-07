/**
 * TEMPLATE — Fallback content generator
 * Pake persona-engine kalo AI gagal, atau fallback built-in
 */

// Fallback templates built-in (tanpa dependency external)
var FALLBACKS = {
  // Discord community replies
  discord: {
    game: [
      'Wah seru tuh, lagi main game apa nih?',
      'Kalo ngomongin game, gue paling suka yg open world. Kamu?',
      'RDR2 emang masterpiece sih. Gak ada bosennya.',
      'Lagi ngumpulin achievement atau main santai aja?',
      'Game horor juga seru loh. Siapa tau cocok.',
    ],
    cosplay: [
      'Bahas cosplay nih, seru. Ada karakter favorit buat di-cosplay?',
      'Baby Val juga jago cosplay, outfitnya selalu detail banget.',
      'Cosplay emang seni yg keren. Apalagi kalo detail kostumnya.',
    ],
    streaming: [
      'Suka nonton streaming juga nih. Biasanya nonton di mana?',
      'Live streaming emang seru, apalagi kalo rame chatnya.',
      'Kalo lagi streaming, lebih suka gaming atau IRL?',
    ],
    general: [
      'Iya sih, gimana menurut kamu?',
      'Wah bener juga tuh. Ada pendapat lain?',
      'Noted. Kalo menurut kamu gimana?',
      'Seru juga. Cerita dong lebih detailnya.',
      'Setuju. Yang lain pada gimana?',
    ],
  },

  // X/Twitter
  x: {
    game_discussion: [
      'Main {topic} nih, seru banget.',
      'Ngobrolin {topic} emang gak ada abisnya.',
    ],
    default: [
      'Seru banget main game ini.',
      'Gak nyangka gamenya sebagus ini.',
    ]
  },

  // Tevi
  tevi: {
    topup_cta: ['Topup star di babyval.com ya'],
    exclusive_cta: ['Koleksi exclusive di babyval.com'],
    live_cta: ['Yang kangen mampir ke Tevi ya beb'],
    vcs_cta: [
      'VCS tersedia 7 menit Rp120K, 10 menit Rp150K, 20 menit Rp250K, 60 menit Rp500K. Langsung ke babyval.com trus pilih Video Call ya~',
      'Pengen VCS? Ada paket 7 menit (Rp120K), 10 menit (Rp150K), 20 menit (Rp250K), 60 menit (Rp500K). Cek babyval.com aja~',
      'VCS bareng Val? Tinggal pilih durasi: 7 menit Rp120K, 10 menit Rp150K, 20 menit Rp250K, 60 menit Rp500K. Kalo mau request, ke babyval.com > Video Call~',
    ],
    membership_cta: [
      'Membership Baby Val bisa kamu akses di babyval.com. Tinggal pilih Membership, pilih paket, beres! Dapetin akses konten exclusive~',
      'Pengen join membership? Buka babyval.com, pilih Membership, terus subscribe. Dapetin album cosplay lengkap & konten hot tiap minggu~',
    ],
    topup_cta: [
      'Topup star bisa di babyval.com atau langsung di Tevi. Kalo di Tevi, masuk ke @cutieval terus pilih topup star~',
      'Buat topup star, cek babyval.com. Gampang kok, tinggal ikutin stepnya~',
    ],
    social_cta: [
      'Instagram: @babyval, X: @CutieVal14, TikTok: @cutebabyval14, YouTube: @cutebabyval14. Cek semua link di babyval.com ya~',
      'Mau follow? BabyVal ada di Instagram @babyval, X @CutieVal14, TikTok @cutebabyval14, YouTube @cutebabyval14~',
    ],
    default: ['Cek babyval.com ya beb'],
  },
};

function generate(platform, category, context) {
  context = context || {};

  // Cek platform
  var platFallbacks = FALLBACKS[platform];
  if (!platFallbacks) return { text: '' };

  // Cek category
  var catFallbacks = platFallbacks[category];
  if (!catFallbacks) catFallbacks = platFallbacks.default || platFallbacks.general || ['Hmm iya sih'];

  // Random pick
  var text = catFallbacks[Math.floor(Math.random() * catFallbacks.length)];

  // Replace variables
  text = text.replace(/{topic}/g, context.topic || '');
  text = text.replace(/{author}/g, context.author || '');
  text = text.replace(/{channel}/g, context.channel || '');
  text = text.replace(/{question}/g, context.question || '');

  return { text: text };
}

module.exports = function() {
  this.generate = generate;
};
