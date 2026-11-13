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
const warnedGames = new Set();
const stage = $('.stage');
const monBtn = $('#mon');
const monCloseBtn = $('#monClose');

function show(name){
  for (const k in screens) screens[k].classList.toggle('on', k === name);
  document.body.classList.toggle('in-game', name === 'game');

  const mon = $('#monitor');
  if (name === 'game') {
    mon.classList.remove('on'); // saat di game, monitor hanya muncul sebagai drawer
  } else {
    mon.classList.toggle('on', name !== 'home');
  }
}

const msg = t => { $('#msg').textContent = t || ''; };
let busy = 0, current = null;

const schemeText = s => s.scheme === 'both' ? 'panah atau WASD' : s.scheme === 'arrows' ? 'tombol panah' : 'tombol WASD';

// ── Pengelolaan Opsi Konfigurasi Game (localStorage & fallback) ────
function getGameOptions(game){
  if (!game.options) return {};
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('opt_' + game.id) || '{}'); } catch(_){}
  const res = {};
  for (const k in game.options){
    const optDef = game.options[k];
    res[k] = saved[k] !== undefined ? saved[k] : optDef.default;
  }
  return res;
}

function setGameOption(gameId, key, val){
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('opt_' + gameId) || '{}'); } catch(_){}
  saved[key] = val;
  try { localStorage.setItem('opt_' + gameId, JSON.stringify(saved)); } catch(_){}
}

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

  // Tampilkan ringkasan status pemain yang sedang terhubung
  const badgeBox = $('#pickPlayersBadge');
  if (badgeBox) {
    badgeBox.innerHTML = '';
    const filled = Kernel.filled();
    if (filled.length === 0) {
      badgeBox.innerHTML = '<span class="status-empty">⚠️ Belum ada pemain terhubung</span>';
    } else {
      const lbl = el('span', 'status-lbl', `${filled.length} Pemain Siap:`);
      badgeBox.append(lbl);
      const pills = el('div', 'pills-row');
      filled.forEach(s => {
        const pill = el('span', 'player-pill', `P${s.n}`);
        pill.style.setProperty('--pill-c', `var(--p${s.n})`);
        pills.append(pill);
      });
      badgeBox.append(pills);
    }
  }

  games.forEach(g => {
    const c = el('div', 'gcard');

    // Header kartu: Ikon terbingkai rapi di kiri, Judul & Badge Pemain di kanan
    const header = el('div', 'gcard-header');
    const iconWrap = el('div', 'gcard-icon-wrap');
    iconWrap.append(el('span', 'gcard-icon', g.icon || '🎮'));
    header.append(iconWrap);

    const titleBox = el('div', 'gcard-title-box');
    titleBox.append(el('h3', 'gcard-title', g.name));

    const maxP = Math.max(...g.modes.map(m => m.players));
    const minP = Math.min(...g.modes.map(m => m.players));
    const pLabel = minP === maxP ? `${maxP}P` : `${minP}–${maxP}P`;
    const badgeRow = el('div', 'pbadge-row');
    badgeRow.style.display = 'flex';
    badgeRow.style.alignItems = 'center';
    badgeRow.style.gap = '6px';
    badgeRow.append(el('span', 'pbadge', `👥 ${pLabel}`));
    if (g.tag) {
      badgeRow.append(el('span', 'pbadge tag', `🕹️ ${g.tag}`));
    }
    titleBox.append(badgeRow);
    header.append(titleBox);
    c.append(header);

    // Deskripsi game (tinggi konsisten agar semua kartu sejajar)
    c.append(el('p', 'gcard-desc', g.description));

    // Baris opsi game jika didefinisikan (tetap didukung jika suatu saat ada)
    if (g.options) {
      const curOpts = getGameOptions(g);
      const optBox = el('div', 'gcard-options');
      for (const key in g.options) {
        const optDef = g.options[key];
        const row = el('div', 'opt-row');
        row.append(el('span', 'opt-label', optDef.label));

        const group = el('div', 'opt-group');
        const choices = optDef.choices || [];
        choices.forEach(ch => {
          const val = typeof ch === 'object' && ch !== null ? ch.value : ch;
          const lbl = typeof ch === 'object' && ch !== null ? ch.label : String(ch);
          const btn = el('button', 'opt-btn' + (curOpts[key] === val ? ' active' : ''), lbl);
          btn.onclick = () => {
            setGameOption(g.id, key, val);
            group.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
          };
          group.append(btn);
        });
        row.append(group);
        optBox.append(row);
      }
      c.append(optBox);
    }

    // Bagian pemilihan jumlah pemain: ringkas dan jelas (1P, 2P, 3P, 4P)
    const modeSec = el('div', 'gcard-modes');
    modeSec.append(el('span', 'mode-legend', 'PILIH JUMLAH PEMAIN'));

    const modeRow = el('div', 'mode-buttons');
    g.modes.forEach(m => {
      const shortLabel = `${m.players}P`;
      const b = el('button', 'mode-btn', shortLabel);
      b.disabled = n < m.players;
      b.title = n < m.players
        ? `Butuh ${m.players} pemain terhubung (saat ini ${n})`
        : `Mulai ${g.name} - ${shortLabel} (${m.sub || m.label})`;
      b.onclick = () => startGame(g, m);
      modeRow.append(b);
    });
    modeSec.append(modeRow);
    c.append(modeSec);

    box.append(c);
  });

  const most = Math.max(...games.flatMap(g => g.modes.map(m => m.players)));
  $('#pickHint').textContent = n < 1
    ? '⚠️ Belum ada pemain terhubung. Kembali ke layar sebelumnya untuk menghubungkan micro:bit atau aktifkan keyboard.'
    : n < most
    ? `💡 ${n} pemain aktif. Tombol mode pemain yang lebih tinggi akan aktif otomatis saat pemain terhubung.`
    : '';
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
  // Validasi standar resolusi 1280x720: catat console.warn sekali jika non-standar
  const gw = game.canvas?.width || 1280;
  const gh = game.canvas?.height || 720;
  if (gw !== 1280 || gh !== 720) {
    if (!warnedGames.has(game.id)) {
      console.warn(`[Shell] Game '${game.id}' menggunakan resolusi canvas non-standar (${gw}x${gh}). Standar platform adalah 1280x720.`);
      warnedGames.add(game.id);
    }
  }

  // Pindahkan monitor ke dalam .stage sebagai laci drawer
  const mon = $('#monitor');
  if (mon && stage) {
    mon.classList.add('drawer');
    mon.classList.remove('open', 'on');
    stage.appendChild(mon);
  }
  if (monBtn) monBtn.classList.remove('active');
  if (monCloseBtn) monCloseBtn.style.display = '';

  const players = Kernel.filled().slice(0, mode.players).map(s => s.n);
  show('game');
  $('#result').classList.remove('on');

  // Ambil opsi yang tersimpan untuk game ini
  const options = getGameOptions(game);

  // Backing store canvas dikonfigurasi oleh game melalui game.create()
  const inst = game.create({
    canvas: $('#cv'), kernel: Kernel, players, mode, audio: Sound, options,
    finish: text => { $('#resText').textContent = text; $('#result').classList.add('on'); }
  });
  current = {players, stop: inst.stop};
}

function toLobby(){
  if (current) { current.stop(); current = null; }

  // Kembalikan monitor ke dalam container <main>
  const mon = $('#monitor');
  if (mon) {
    mon.classList.remove('drawer', 'open');
    const mainEl = $('main');
    if (mainEl) mainEl.appendChild(mon);
  }
  if (monBtn) monBtn.classList.remove('active');
  if (monCloseBtn) monCloseBtn.style.display = 'none';

  show('connect'); renderSlots();
}

// Toggle laci drawer monitor di dalam stage game
function toggleMonitorDrawer(){
  const mon = $('#monitor');
  if (!mon || !mon.classList.contains('drawer')) return;
  const isOpen = mon.classList.toggle('open');
  if (monBtn) monBtn.classList.toggle('active', isOpen);
}

if (monBtn) monBtn.onclick = toggleMonitorDrawer;
if (monCloseBtn) monCloseBtn.onclick = toggleMonitorDrawer;

// Tutup laci monitor dengan tombol Esc
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const mon = $('#monitor');
    if (mon && mon.classList.contains('open')) {
      mon.classList.remove('open');
      if (monBtn) monBtn.classList.remove('active');
    }
  }
});

// Cegah menu konteks (long-press) pada tombol, kanvas, dan kontrol
document.addEventListener('contextmenu', e => {
  if (e.target.closest('button, canvas, .stage, .btn')) {
    e.preventDefault();
  }
});

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
