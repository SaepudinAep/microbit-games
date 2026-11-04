// SHELL: kerangka aplikasi. Mengurus layar (Home, lobi koneksi, pilih game, game), memberi game
// kanvas dan daftar pemain, dan menampilkan hasil. Tidak berisi aturan game maupun kode Bluetooth.
import { Kernel, MAX_PLAYERS } from '../core/kernel.js';
import { games } from '../games/index.js';
import { initMonitor } from './monitor.js';
import { Sound } from '../core/audio.js';

const $ = s => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };

// Jumlah slot yang ditampilkan mengikuti kebutuhan terbesar dari semua game.
Kernel.limit = Math.min(MAX_PLAYERS, Math.max(...games.flatMap(g => g.modes.map(m => m.players))));

const screens = {home: $('#home'), connect: $('#connect'), pick: $('#pick'), game: $('#game')};
function show(name){
  for (const k in screens) screens[k].classList.toggle('on', k === name);
  $('#monitor').classList.toggle('on', name !== 'home');
}
const msg = t => { $('#msg').textContent = t || ''; };
let busy = 0, current = null;

const schemeText = s => s.scheme === 'both' ? 'panah atau WASD' : s.scheme === 'arrows' ? 'tombol panah' : 'tombol WASD';

function renderSlots(){
  const box = $('#slots'); box.innerHTML = '';
  Kernel.visible().forEach(s => {
    const d = el('div', 'slot' + (s.type ? ' full' : ''));
    d.style.setProperty('--c', 'var(--p' + s.n + ')');
    d.append(el('h3', null, 'Player ' + s.n));
    d.append(el('div', 'st', !s.type ? 'Belum ada perangkat' : s.type === 'keyboard' ? 'Keyboard (' + schemeText(s) + ')' : s.name));
    if (s.type) {
      const l = el('span', 'last', s.last ? 'Perintah terakhir: ' + s.last + '#' : '');
      l.dataset.last = s.n; d.append(l);
    }
    const row = el('div', 'row');
    const mk = (text, fn, alt, dis) => {
      const b = el('button', 'btn' + (alt ? ' alt' : ''), text);
      b.disabled = !!dis; b.onclick = fn; row.append(b);
    };
    if (!s.type) {
      mk(busy === s.n ? 'Menghubungkan…' : 'Hubungkan micro:bit', () => connectMB(s.n), false, !Kernel.btSupported || busy);
      mk('Pakai keyboard', () => Kernel.addKeyboard(s.n), true, busy);
    } else mk('Lepas', () => Kernel.release(s.n), true);
    d.append(row); box.append(d);
  });
  $('#toPick').disabled = Kernel.filled().length < 1;
  if (!Kernel.btSupported) msg('Browser ini belum mendukung Web Bluetooth. Pakai Chrome atau Edge (HTTPS atau localhost) untuk micro:bit; keyboard tetap bisa dipakai.');
}

function renderPick(){
  const box = $('#games'); box.innerHTML = '';
  const n = Kernel.filled().length;
  games.forEach(g => {
    const c = el('div', 'gcard');
    c.append(el('h3', null, g.name), el('p', null, g.description));
    const row = el('div', 'row');
    g.modes.forEach(m => {
      const b = el('button', 'btn big');
      b.disabled = n < m.players;
      b.append(m.label, el('small', null, m.sub));
      b.onclick = () => startGame(g, m);
      row.append(b);
    });
    c.append(row); box.append(c);
  });
  const most = Math.max(...games.flatMap(g => g.modes.map(m => m.players)));
  $('#pickHint').textContent = n < 1 ? 'Belum ada pemain. Kembali dan hubungkan micro:bit atau pilih keyboard.'
    : n < most ? 'Mode dengan lebih banyak pemain aktif setelah pemain terhubung. Kembali untuk menambah pemain.' : '';
}

async function connectMB(n){
  msg(''); busy = n; renderSlots();
  try { await Kernel.addMicrobit(n); }
  catch (err) {
    if (!(err && err.name === 'NotFoundError'))
      msg('Gagal menghubungkan: ' + err.message + '. Pastikan micro:bit menjalankan program UART dan tidak terhubung ke perangkat lain.');
  }
  busy = 0; renderSlots();
}

function startGame(game, mode){
  const players = Kernel.filled().slice(0, mode.players).map(s => s.n);
  show('game');
  $('#result').classList.remove('on');
  const inst = game.create({
    canvas: $('#cv'), kernel: Kernel, players, mode, audio: Sound,
    finish: text => { $('#resText').textContent = text; $('#result').classList.add('on'); }
  });
  current = {players, stop: inst.stop};
}

function toLobby(){
  if (current) { current.stop(); current = null; }
  show('connect'); renderSlots();
}

Kernel.on('players', () => {
  renderSlots(); renderPick();
  if (current && !current.players.every(n => Kernel.slots[n - 1].type)) {
    toLobby(); msg('Ada pemain yang terputus. Hubungkan lagi lalu lanjut.');
  }
});
Kernel.on('input', ({player, cmd}) => {
  const e = document.querySelector('[data-last="' + player + '"]');
  if (e) e.textContent = 'Perintah terakhir: ' + cmd + '#';
});
Kernel.on('warn', t => msg('Peringatan: ' + t));

$('#start').onclick = () => { Sound.unlock(); show('connect'); renderSlots(); };
$('#toHome').onclick = () => show('home');
$('#toPick').onclick = () => { msg(''); renderPick(); show('pick'); };
$('#backConnect').onclick = () => show('connect');
$('#toLobby').onclick = toLobby;
$('#quit').onclick = toLobby;

const stage = $('.stage');
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
async function toggleFullscreen(){
  try {
    if (fsEl()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else await (stage.requestFullscreen || stage.webkitRequestFullscreen).call(stage);
  } catch (err) { msg('Layar penuh tidak tersedia di browser ini.'); }
}
$('#fs').onclick = toggleFullscreen;
document.addEventListener('fullscreenchange', () => { $('#fs').textContent = fsEl() ? '✕' : '⛶'; });
document.addEventListener('webkitfullscreenchange', () => { $('#fs').textContent = fsEl() ? '✕' : '⛶'; });

const sndBtn = $('#snd');
if (sndBtn) {
  const updateSnd = () => { sndBtn.textContent = Sound.isMuted() ? '🔇' : '🔊'; };
  sndBtn.onclick = () => { Sound.unlock(); Sound.setMuted(!Sound.isMuted()); };
  Sound.onChange(updateSnd);
  updateSnd();
}

initMonitor(Kernel);
renderSlots();
