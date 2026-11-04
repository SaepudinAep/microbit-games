// AUDIO: Layanan efek suara bersama berbasis Web Audio API (tanpa file audio eksternal).
// Didesain lazy: AudioContext baru aktif setelah interaksi pengguna untuk mematuhi kebijakan autoplay browser.

const AudioCtx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;

let ctx = null;
let masterGain = null;
let muted = false;
let volume = 0.25;

const listeners = [];
const activeSounds = [];
const lastPlayed = {};
let noiseBuffer = null;

// Muat pengaturan mute dan volume dari localStorage
try {
  const saved = localStorage.getItem('snd');
  if (saved) {
    const data = JSON.parse(saved);
    if (typeof data.muted === 'boolean') muted = data.muted;
    if (typeof data.volume === 'number') volume = Math.max(0, Math.min(1, data.volume));
  }
} catch (_) {}

function persist() {
  try {
    localStorage.setItem('snd', JSON.stringify({ muted, volume }));
  } catch (_) {}
}

function notify() {
  listeners.slice().forEach(fn => {
    try { fn({ muted, volume }); } catch (_) {}
  });
}

function getNoiseBuffer(c) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== c.sampleRate) {
    const len = Math.floor(c.sampleRate * 0.3);
    noiseBuffer = c.createBuffer(1, len, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

// Resep efek suara disintesis sebagai tabel data
const RECIPES = {
  click:   { kind: 'tone',  wave: 'square',   freq: 880, dur: 0.04 },
  bounce:  { kind: 'tone',  wave: 'triangle', freq: 330, dur: 0.06 },
  hit:     { kind: 'tone',  wave: 'square',   freq: 520, dur: 0.08 },
  score:   { kind: 'notes', wave: 'sine',     freqs: [440, 660], noteDur: 0.12 },
  win:     { kind: 'notes', wave: 'square',   freqs: [523, 659, 784, 1047], noteDur: 0.12 },
  lose:    { kind: 'slide', wave: 'sawtooth', from: 392, to: 196, dur: 0.4 },
  shoot:   { kind: 'slide', wave: 'square',   from: 880, to: 220, dur: 0.12 },
  explode: { kind: 'noise', filterFrom: 1200, filterTo: 200, dur: 0.25 },
  hurt:    { kind: 'slide', wave: 'sawtooth', from: 200, to: 80, dur: 0.3 },
  powerup: { kind: 'slide', wave: 'triangle', from: 400, to: 1200, dur: 0.2 },
  start:   { kind: 'notes', wave: 'sine',     freqs: [440, 554, 659], noteDur: 0.09 }
};

function unlock() {
  if (!AudioCtx) return null;
  if (!ctx) {
    try {
      ctx = new AudioCtx();
      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(muted ? 0 : volume, ctx.currentTime);
      masterGain.connect(ctx.destination);
    } catch (_) {
      return null;
    }
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

// Buka kunci AudioContext pada interaksi pertama pengguna
if (typeof document !== 'undefined') {
  const onFirstInteraction = () => { unlock(); };
  document.addEventListener('pointerdown', onFirstInteraction, { once: true, capture: true });
  document.addEventListener('keydown', onFirstInteraction, { once: true, capture: true });
}

function play(nama, opsi) {
  // Bila AudioContext belum siap atau tidak aktif, abaikan diam-diam tanpa error
  if (!ctx || ctx.state !== 'running') return;
  const recipe = RECIPES[nama];
  if (!recipe) return;

  // Batasi suara berulang dengan nama yang sama dalam 30 ms
  const now = performance.now();
  if (lastPlayed[nama] && now - lastPlayed[nama] < 30) return;
  lastPlayed[nama] = now;

  // Batas polifoni: maksimal 8 suara aktif sekaligus (suara terbaru diprioritaskan)
  while (activeSounds.length >= 8) {
    const oldest = activeSounds.shift();
    try { oldest.stop(); } catch (_) {}
  }

  const t0 = ctx.currentTime;
  const attack = 0.005; // 5 ms attack untuk mencegah bunyi klik
  const voiceGain = ctx.createGain();
  const sndVol = Math.max(0.0001, Math.min(1, typeof opsi?.volume === 'number' ? opsi.volume : 1));

  let outNode = voiceGain;
  if (typeof opsi?.pan === 'number' && typeof ctx.createStereoPanner === 'function') {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, opsi.pan)), t0);
    voiceGain.connect(panner);
    outNode = panner;
  }
  outNode.connect(masterGain);

  let osc = null;
  let source = null;
  let totalDur = recipe.dur || 0;

  if (recipe.kind === 'tone') {
    const dur = recipe.dur;
    voiceGain.gain.setValueAtTime(0.0001, t0);
    voiceGain.gain.exponentialRampToValueAtTime(sndVol, t0 + attack);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc = ctx.createOscillator();
    osc.type = recipe.wave;
    osc.frequency.setValueAtTime(recipe.freq, t0);
    osc.connect(voiceGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } else if (recipe.kind === 'slide') {
    const dur = recipe.dur;
    voiceGain.gain.setValueAtTime(0.0001, t0);
    voiceGain.gain.exponentialRampToValueAtTime(sndVol, t0 + attack);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc = ctx.createOscillator();
    osc.type = recipe.wave;
    osc.frequency.setValueAtTime(Math.max(1, recipe.from), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, recipe.to), t0 + dur);
    osc.connect(voiceGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } else if (recipe.kind === 'notes') {
    const noteDur = recipe.noteDur;
    totalDur = noteDur * recipe.freqs.length;
    osc = ctx.createOscillator();
    osc.type = recipe.wave;
    voiceGain.gain.setValueAtTime(0.0001, t0);

    recipe.freqs.forEach((freq, idx) => {
      const tn = t0 + idx * noteDur;
      osc.frequency.setValueAtTime(freq, tn);
      voiceGain.gain.setValueAtTime(0.0001, tn);
      voiceGain.gain.exponentialRampToValueAtTime(sndVol, tn + attack);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, tn + noteDur);
    });

    osc.connect(voiceGain);
    osc.start(t0);
    osc.stop(t0 + totalDur + 0.02);
  } else if (recipe.kind === 'noise') {
    const dur = recipe.dur;
    voiceGain.gain.setValueAtTime(0.0001, t0);
    voiceGain.gain.exponentialRampToValueAtTime(sndVol, t0 + attack);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    source = ctx.createBufferSource();
    source.buffer = getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(recipe.filterFrom, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(10, recipe.filterTo), t0 + dur);

    source.connect(filter);
    filter.connect(voiceGain);
    source.start(t0);
    source.stop(t0 + dur + 0.02);
  }

  const voice = {
    stop() {
      try {
        if (osc) osc.stop();
        if (source) source.stop();
      } catch (_) {}
      try { voiceGain.disconnect(); } catch (_) {}
    }
  };
  activeSounds.push(voice);

  const cleanupMs = Math.ceil(totalDur * 1000) + 60;
  setTimeout(() => {
    const idx = activeSounds.indexOf(voice);
    if (idx !== -1) activeSounds.splice(idx, 1);
    try { voiceGain.disconnect(); } catch (_) {}
  }, cleanupMs);
}

function setMuted(val) {
  muted = !!val;
  if (masterGain && ctx) {
    masterGain.gain.setValueAtTime(muted ? 0 : volume, ctx.currentTime);
  }
  persist();
  notify();
}

function isMuted() {
  return muted;
}

function setVolume(val) {
  volume = Math.max(0, Math.min(1, typeof val === 'number' ? val : 0.25));
  if (!muted && masterGain && ctx) {
    masterGain.gain.setValueAtTime(volume, ctx.currentTime);
  }
  persist();
  notify();
}

function getVolume() {
  return volume;
}

function onChange(fn) {
  if (typeof fn === 'function') {
    listeners.push(fn);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }
}

export const Sound = {
  unlock,
  play,
  setMuted,
  isMuted,
  setVolume,
  getVolume,
  onChange
};

