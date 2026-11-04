// KERNEL: koneksi micro:bit (BLE UART), slot pemain, dan keyboard sebagai sumber masukan.
// Game dan shell hanya memakai kejadian standar; tidak ada kode Bluetooth di luar file ini.
//
// Kejadian (Kernel.on):
//   'input'   {player, cmd, source}      perintah standar berlabel pemain (cmd = '0'..'9', string)
//   'players'                            daftar slot berubah (terhubung, terputus, dilepas)
//   'raw'     {player, text, bytes}      data mentah dari micro:bit (untuk monitor)
//   'tx'      {player, text}             kode yang dikirim ke micro:bit (untuk monitor)
//   'warn'    teks                       peringatan

export const MAX_PLAYERS = 4;
const NUS = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';

const subs = {};
function on(event, fn){
  (subs[event] = subs[event] || []).push(fn);
  return () => { subs[event] = (subs[event] || []).filter(f => f !== fn); };   // fungsi untuk berhenti berlangganan
}
function emit(event, data){ (subs[event] || []).slice().forEach(f => f(data)); }

const slots = Array.from({length: MAX_PLAYERS}, (_, i) =>
  ({n: i + 1, type: null, name: '', link: null, scheme: null, last: '', rx: ''}));

function clear(s){ s.type = null; s.name = ''; s.link = null; s.scheme = null; s.last = ''; s.rx = ''; }

function recompute(){
  const kb = slots.filter(s => s.type === 'keyboard');
  kb.forEach((s, i) => { s.scheme = kb.length === 1 ? 'both' : (i === 0 ? 'arrows' : 'wasd'); });
  emit('players');
}

function input(s, cmd){
  s.last = cmd;
  emit('input', {player: s.n, cmd, source: s.type});
}

// Pesan micro:bit berbentuk "N#" (atau baris berakhir newline, mis. "Mbit:3").
// Data BLE bisa datang terpotong, jadi digabung di buffer lalu dipecah pada '#' atau newline.
function feed(s, text){
  s.rx += text;
  let m;
  while ((m = /[#\n]/.exec(s.rx))) {
    const tok = s.rx.slice(0, m.index);
    s.rx = s.rx.slice(m.index + 1);
    const d = /(\d+)\s*$/.exec(tok);
    if (d) input(s, d[1]);
  }
}

async function addMicrobit(n){
  const s = slots[n - 1];
  const dev = await navigator.bluetooth.requestDevice({
    filters: [{namePrefix: 'BBC micro:bit'}], optionalServices: [NUS]
  });
  if (slots.some(x => x.link && x.link.dev === dev)) throw new Error('micro:bit ini sudah terhubung di slot lain');
  const server = await dev.gatt.connect();
  const svc = await server.getPrimaryService(NUS);
  const chars = await svc.getCharacteristics();
  // UUID TX/RX micro:bit terbalik dari Nordic, jadi karakteristik dipilih lewat properti.
  const nf = chars.find(c => c.properties.notify || c.properties.indicate);
  const wr = chars.find(c => c.properties.write || c.properties.writeWithoutResponse);
  if (s.type) { dev.gatt.disconnect(); return; }
  const dec = new TextDecoder();
  if (nf) {
    try {
      nf.addEventListener('characteristicvaluechanged', e => {
        const v = e.target.value, t = dec.decode(v);
        emit('raw', {player: s.n, text: t, bytes: Array.from(new Uint8Array(v.buffer, v.byteOffset, v.byteLength))});
        feed(s, t);
      });
      await nf.startNotifications();
    } catch (err) { emit('warn', err.message); }
  }
  s.type = 'microbit'; s.name = dev.name || 'micro:bit'; s.link = {dev, wr, q: Promise.resolve()}; s.rx = '';
  dev.addEventListener('gattserverdisconnected', () => {
    if (s.link && s.link.dev === dev) { clear(s); recompute(); }
  });
  recompute();
}

function addKeyboard(n){
  const s = slots[n - 1];
  if (s.type) return;
  s.type = 'keyboard'; s.name = 'Keyboard';
  recompute();
}

function release(n){
  const s = slots[n - 1];
  if (s.type === 'microbit' && s.link) {
    const d = s.link.dev; clear(s);
    try { d.gatt.disconnect(); } catch (_) {}
  } else clear(s);
  recompute();
}

// Kirim kode ke micro:bit (mis. send(1, '!') mengirim "!#"). Memakai antrian dan potongan 20 byte.
// Pemain keyboard tidak punya micro:bit, jadi dilewati.
function send(n, text){
  const s = slots[n - 1];
  if (!s || s.type !== 'microbit' || !s.link || !s.link.wr) return Promise.resolve(false);
  const link = s.link;
  const bytes = new TextEncoder().encode(text + '#');
  emit('tx', {player: n, text: text + '#'});
  link.q = link.q.then(async () => {
    for (let o = 0; o < bytes.length; o += 20) await link.wr.writeValue(bytes.slice(o, o + 20));
    return true;
  }).catch(err => { emit('warn', 'Gagal kirim ke P' + n + ': ' + err.message); return false; });
  return link.q;
}

/* ---- Keyboard: panah dan/atau WASD -> perintah 1..4, dilepas -> 0 ---- */
const SETS = {
  arrows: {ArrowUp: '1', ArrowDown: '2', ArrowLeft: '3', ArrowRight: '4'},
  wasd:   {w: '1', s: '2', a: '3', d: '4'}
};
const held = new Map();
function keyCmd(s, key){
  for (const set of (s.scheme === 'both' ? ['arrows', 'wasd'] : [s.scheme])) {
    const c = SETS[set][key];
    if (c) return c;
  }
}
const kname = e => e.key.length === 1 ? e.key.toLowerCase() : e.key;

if (typeof addEventListener === 'function') {
  addEventListener('keydown', e => {
    const key = kname(e);
    slots.forEach(s => {
      if (s.type !== 'keyboard') return;
      const c = keyCmd(s, key);
      if (!c) return;
      e.preventDefault();
      if (e.repeat) return;
      const h = held.get(s.n) || [];
      h.push([key, c]); held.set(s.n, h);
      input(s, c);
    });
  });
  addEventListener('keyup', e => {
    const key = kname(e);
    slots.forEach(s => {
      if (s.type !== 'keyboard') return;
      const h = held.get(s.n) || [];
      const rest = h.filter(x => x[0] !== key);
      if (rest.length === h.length) return;
      held.set(s.n, rest);
      input(s, rest.length ? rest[rest.length - 1][1] : '0');
    });
  });
  addEventListener('blur', () => slots.forEach(s => {
    if (s.type === 'keyboard' && (held.get(s.n) || []).length) { held.set(s.n, []); input(s, '0'); }
  }));
}

export const Kernel = {
  slots,
  limit: 2,                                   // jumlah slot yang ditampilkan (diatur shell)
  btSupported: typeof navigator !== 'undefined' && 'bluetooth' in navigator,
  on, emit,
  visible(){ return slots.slice(0, this.limit); },
  filled(){ return this.visible().filter(s => s.type); },
  addMicrobit, addKeyboard, release, send
};
