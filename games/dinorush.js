// GAME: Dino Jump (dinorush)
// Horizontal endless runner 1–4 pemain dengan orientasi Landscape 16:9 (1280x720).
// Dioptimalkan untuk Laptop, Tablet, dan Layar PID (Panel Interaktif Digital) Sekolah.
// Tiap pemain memiliki lintasan horizontal sejajar tersusun atas ke bawah.
// Lompati kaktus, bertahan sejauh mungkin. Pemenang = jarak terjauh.
//
// Kontrak game:
//   id, name, icon, description, modes, canvas
//   create({canvas, kernel, players, mode, finish, audio}) -> {stop()}
//
// Kontrol:
//   '99' (dari pemain mana pun) atau klik layar = mulai (hitung mundur 3-2-1)
//   Perintah apa pun selain '0' dan '99' = lompat saat bermain
//   '0' = netral (tidak ada aksi)
//
// options.lives : 1 | 3  (default 3)
// options.end   : 'all'  (semua mati) | 'last' (sisa 1 hidup)  (default 'all')

'use strict';

// ═══════════════════════════════════════════════════════════════════
//  KONSTANTA (Dimensi Landscape 16:9 & Parameter Fisika)
// ═══════════════════════════════════════════════════════════════════

const W = 1280;     // lebar canvas (px) - Standar HD 16:9 untuk PID/Laptop
const H = 720;      // tinggi canvas (px)

// ── Fisika (skala referensi: tinggi lintasan BASE_LH = 240 px) ───
const BASE_LH      = 240;   // px; tinggi lintasan acuan untuk faktor skala s = 1
const GRAV_BASE    = 1550;  // px/dtk² gravitasi pada s = 1
const JUMP_V_BASE  = -640;  // px/dtk kecepatan lompat awal pada s = 1 (negatif = ke atas)

// ── Dino ─────────────────────────────────────────────────────────
const DINO_W_BASE  = 46;    // px lebar dino pada s = 1
const DINO_H_BASE  = 52;    // px tinggi dino pada s = 1
const DINO_X       = 140;   // px; posisi X dino (memberikan reaction distance ~1140 px)
const HITBOX_RATIO = 0.85;  // hitbox = 85 % dari ukuran gambar

// ── Kecepatan lintasan ───────────────────────────────────────────
const SPEED_INIT   = 240;   // px/dtk awal
const SPEED_ACC    = 10;    // px/dtk peningkatan per detik
const SPEED_MAX    = 680;   // px/dtk kecepatan maksimal

// ── Rintangan ────────────────────────────────────────────────────
const METER          = 70;  // 1 meter = 70 px
const CACTUS_S_W     = 24;  // px lebar kaktus tunggal pada s = 1
const CACTUS_S_H     = 44;  // px tinggi kaktus tunggal pada s = 1
const CACTUS_D_W     = 46;  // px lebar kaktus ganda pada s = 1
const CACTUS_D_H     = 40;  // px tinggi kaktus ganda pada s = 1
const MIN_GAP_SEC    = 1.25;// detik minimum antar rintangan (selalu bisa dilompati)

// ── Jump-feel ────────────────────────────────────────────────────
const JUMP_BUFFER_MS = 100; // ms: lompat yang ditekan sblm mendarat tetap jalan
const COYOTE_MS      = 80;  // ms: boleh lompat sesaat setelah jatuh dari tepi

// ── Nyawa & invulnerability ───────────────────────────────────────
const INVULN_SEC   = 1.5;   // dtk kebal setelah tabrakan
const BLINK_HZ     = 8;     // frekuensi kedip saat kebal (kali/dtk)

// ── Hitung mundur ────────────────────────────────────────────────
const COUNTDOWN_N  = 3;     // mulai dari 3 (3-2-1)
const COUNTDOWN_DT = 1.0;   // detik per langkah

// ── Geometri mode 1 pemain (Solo) ─────────────────────────────────
const SOLO_LH      = 280;   // px; tinggi lintasan solo
const SOLO_Y_TOP   = (H - SOLO_LH) / 2; // px; posisi Y atas lintasan solo (tengah)

// ── Warna slot (P1–P4, berdasarkan nomor slot fisik) ─────────────
const SLOT_COLORS = { 1: '#4b83ff', 2: '#ff9a2e', 3: '#3ccf8e', 4: '#b98cff' };

// ═══════════════════════════════════════════════════════════════════
//  SEEDER RNG (LCG sederhana — urutan rintangan sama di semua lintasan)
// ═══════════════════════════════════════════════════════════════════

function makeLCG(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ═══════════════════════════════════════════════════════════════════
//  EXPORT DEFAULT
// ═══════════════════════════════════════════════════════════════════

export default {
  id:   'dinorush',
  name: 'Dino Jump',
  icon: '🦖',
  description: 'Lompati kaktus sejauh mungkin di layar lebar! Tiap pemain di lintasan sendiri. ' +
    'Bertahan paling jauh = menang. Dukung 1–4 pemain.',

  modes: [
    { id: '1p', label: '1 Player', sub: 'Bertahan Sendiri',       players: 1 },
    { id: '2p', label: '2 Player', sub: 'Dua Lintasan Sejajar',   players: 2 },
    { id: '3p', label: '3 Player', sub: 'Tiga Lintasan',          players: 3 },
    { id: '4p', label: '4 Player', sub: 'Empat Lintasan',         players: 4 },
  ],

  canvas: { width: W, height: H },

  // ─────────────────────────────────────────────────────────────────
  create({ canvas, kernel, players, mode, finish, audio }) {
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // ── Aturan Permainan Bersih: Nyawa 3 & Game sampai Semua Mati ──
    const MAX_LIVES = 3;
    const END_MODE  = 'all';

    const numP  = players.length;
    const solo  = numP === 1;

    // ── Geometri lintasan per slot ────────────────────────────────
    function laneGeom(idx) {
      if (solo) return { laneY: SOLO_Y_TOP, lh: SOLO_LH };
      const lh = H / numP;
      return { laneY: idx * lh, lh };
    }

    // s = faktor skala fisika; selalu ≤ 1 agar puncak lompat muat di lintasan
    const scaleFor = lh => Math.min(1, lh / BASE_LH);

    // ── State fase permainan ──────────────────────────────────────
    // 'waiting' → 'countdown' → 'playing' → 'over'
    let phase   = 'waiting';
    let cdCount = COUNTDOWN_N;  // angka yang sedang ditampilkan
    let cdTimer = COUNTDOWN_DT; // dtk menuju pengurangan berikutnya
    let elapsed = 0;            // dtk sejak fase 'playing'
    let speed   = SPEED_INIT;   // px/dtk kecepatan lintasan saat ini

    // ── Lintasan ──────────────────────────────────────────────────
    const lanes = players.map((slot, idx) => {
      const { laneY, lh } = laneGeom(idx);
      const s   = scaleFor(lh);
      const dW  = DINO_W_BASE * s;
      const dH  = DINO_H_BASE * s;
      const groundY = laneY + lh; // Y-koordinat tanah (bawah lintasan)
      return {
        slot,           // nomor slot P1–P4
        idx,            // urutan dalam array players
        laneY,          // Y atas lintasan
        lh,             // tinggi lintasan
        s,              // faktor skala
        dW, dH,
        groundY,

        // Dino
        dinoY:    groundY - dH,  // Y atas sprite dino
        velY:     0,

        // Status
        lives:    MAX_LIVES,
        dead:     false,
        distPx:   0,         // px jarak tempuh (untuk konversi meter)
        dist:     0,         // meter
        survivedDist: 0,     // meter saat mati / game berakhir

        // Lompat
        onGround:    true,
        jumpBufMs:   0,      // buffer lompat yang menunggu pendaratan
        coyoteMs:    0,      // ms sisa coyote time

        // Kebal
        invulnTimer: 0,

        // Rintangan lintasan ini
        obstacles: [],
      };
    });

    // ── RNG bersama untuk rintangan ───────────────────────────────
    const rng = makeLCG(Math.floor(Math.random() * 0x100000000));

    // Antrian rintangan bersama: [{scrollAt, type}]
    const obsQueue  = [];
    let   scrollPx  = 0;        // px total yang sudah discroll
    let   nextAt    = SPEED_INIT * 2.8; // rintangan pertama muncul setelah jeda awal yang cukup

    function queueNext() {
      const minGap = speed * MIN_GAP_SEC;
      nextAt += minGap + rng() * minGap * 0.9;
      obsQueue.push({ scrollAt: nextAt, type: rng() < 0.5 ? 'single' : 'double' });
    }

    // Isi buffer awal
    for (let i = 0; i < 12; i++) queueNext();

    // Terapkan antrian ke semua lintasan hidup
    function flushQueue() {
      while (obsQueue.length && obsQueue[0].scrollAt <= scrollPx) {
        const item = obsQueue.shift();
        queueNext(); // pertahankan isi antrian

        for (const lane of lanes) {
          if (lane.dead) continue;
          const { s, groundY } = lane;
          const cW = item.type === 'double' ? CACTUS_D_W * s : CACTUS_S_W * s;
          const cH = item.type === 'double' ? CACTUS_D_H * s : CACTUS_S_H * s;
          lane.obstacles.push({
            x:    W + 15,
            y:    groundY - cH,
            w:    cW,
            h:    cH,
            type: item.type,
          });
        }
      }
    }

    // ── Cleanup helpers ───────────────────────────────────────────
    let   frameId  = null;
    const timers   = [];
    const safeTO   = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };

    // ── Countdown ─────────────────────────────────────────────────
    function startCountdown() {
      phase   = 'countdown';
      cdCount = COUNTDOWN_N;
      cdTimer = COUNTDOWN_DT;
      audio?.play('click');
    }

    function beginGame() {
      phase = 'playing';
      audio?.play('start');
    }

    // ── Akhir permainan ───────────────────────────────────────────
    function checkEnd() {
      if (phase !== 'playing') return;
      const alive = lanes.filter(l => !l.dead);
      if (solo) {
        if (alive.length === 0) endGame();
        return;
      }
      if (END_MODE === 'all') {
        if (alive.length === 0) endGame();
      } else {
        if (alive.length <= 1) endGame();
      }
    }

    function endGame() {
      if (phase === 'over') return;
      phase = 'over';
      for (const lane of lanes) {
        if (!lane.dead) {
          lane.survivedDist = lane.dist;
          lane.dead = true;
        }
      }
      safeTO(() => {
        audio?.play(solo ? 'lose' : 'win');
        finish(buildResult());
      }, 600);
    }

    function buildResult() {
      if (solo) return `Bertahan ${lanes[0].survivedDist.toFixed(1)} meter! 🦖`;

      const sorted = lanes.slice().sort((a, b) => b.survivedDist - a.survivedDist);
      const best   = sorted[0];
      const details = sorted.map(l => `P${l.slot} ${l.survivedDist.toFixed(1)} m`).join(', ');
      const tied   = sorted.length >= 2 &&
                     Math.abs(best.survivedDist - sorted[1].survivedDist) < 5;

      return tied
        ? `Seri! Jarak sama-sama ${best.survivedDist.toFixed(0)} m — ${details}`
        : `P${best.slot} menang! ${details}`;
    }

    // ── Lompat ────────────────────────────────────────────────────
    function tryJump(lane) {
      if (lane.dead) return;
      if (lane.onGround || lane.coyoteMs > 0) {
        const pan = numP <= 1 ? 0 : (lane.idx / (numP - 1)) * 2 - 1;
        audio?.play('click', { pan });
        lane.velY      = JUMP_V_BASE * lane.s;
        lane.onGround  = false;
        lane.coyoteMs  = 0;
        lane.jumpBufMs = 0;
      } else {
        lane.jumpBufMs = JUMP_BUFFER_MS;
      }
    }

    // ── Update fisika per frame ───────────────────────────────────
    function step(dt) {
      elapsed += dt;
      speed    = Math.min(SPEED_MAX, SPEED_INIT + elapsed * SPEED_ACC);

      const dScroll = speed * dt;
      scrollPx += dScroll;
      flushQueue();

      for (const lane of lanes) {
        if (lane.dead) continue;

        const { s, groundY, dW, dH } = lane;
        const GRAV = GRAV_BASE * s;

        // Jarak
        lane.distPx += dScroll;
        lane.dist    = lane.distPx / METER;

        // Gravitasi & gerak vertikal
        lane.velY  += GRAV * dt;
        lane.dinoY += lane.velY * dt;

        // Clamp ke tanah
        const floorY = groundY - dH;
        if (lane.dinoY >= floorY) {
          lane.dinoY = floorY;
          lane.velY  = 0;
          if (!lane.onGround) {
            lane.onGround = true;
            if (lane.jumpBufMs > 0) tryJump(lane);
          }
          lane.coyoteMs = COYOTE_MS;
        } else {
          lane.onGround = false;
          if (lane.coyoteMs > 0) lane.coyoteMs = Math.max(0, lane.coyoteMs - dt * 1000);
        }

        // Clamp ke batas atas lintasan
        const ceilY = lane.laneY;
        if (lane.dinoY < ceilY) {
          lane.dinoY = ceilY;
          if (lane.velY < 0) lane.velY = 0;
        }

        // Timer buffer & invuln
        if (lane.jumpBufMs > 0)   lane.jumpBufMs   = Math.max(0, lane.jumpBufMs - dt * 1000);
        if (lane.invulnTimer > 0) lane.invulnTimer -= dt;

        // Gerakkan & cek rintangan
        const hW = dW * HITBOX_RATIO;
        const hH = dH * HITBOX_RATIO;
        const hX = DINO_X + (dW - hW) / 2;
        const hY = lane.dinoY + (dH - hH) / 2;

        const nextObs = [];
        let   killed  = false;

        for (const obs of lane.obstacles) {
          obs.x -= dScroll;
          if (obs.x + obs.w < 0) continue; // lewat layar, hapus

          // Deteksi tabrakan AABB
          const hit = lane.invulnTimer <= 0 &&
            hX < obs.x + obs.w && hX + hW > obs.x &&
            hY < obs.y + obs.h && hY + hH > obs.y;

          if (hit) {
            lane.lives--;
            if (lane.lives <= 0) {
              lane.dead         = true;
              lane.survivedDist = lane.dist;
              audio?.play('lose');
              killed = true;
              break;
            } else {
              lane.invulnTimer = INVULN_SEC;
              audio?.play('hurt');
              continue;
            }
          }

          nextObs.push(obs);
        }

        if (!lane.dead) lane.obstacles = nextObs;
        if (killed) checkEnd();
      }
    }

    // ── Gambar satu lintasan ──────────────────────────────────────
    function drawLane(lane) {
      const { slot, laneY, lh, s, dW, dH, groundY, dinoY,
              lives, dead, dist, survivedDist, invulnTimer } = lane;
      const color = SLOT_COLORS[slot] || '#fff';

      // Latar lintasan
      ctx.fillStyle = '#141d30';
      ctx.fillRect(0, laneY, W, lh);

      // Langit gradient horizontal-friendly
      const skyH = lh * 0.55;
      const sky  = ctx.createLinearGradient(0, laneY, 0, laneY + skyH);
      sky.addColorStop(0, '#0a1222');
      sky.addColorStop(1, '#141d30');
      ctx.fillStyle = sky;
      ctx.fillRect(0, laneY, W, skyH);

      // Tanah strip
      ctx.fillStyle = '#3f6b32';
      ctx.fillRect(0, groundY - 4 * s, W, 4 * s);
      ctx.fillStyle = '#7a5a12';
      ctx.fillRect(0, groundY - 2 * s, W, 2 * s);

      // Garis pemisah antar lintasan
      if (lane.idx > 0) {
        ctx.strokeStyle = `${color}44`;
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(0, laneY);
        ctx.lineTo(W, laneY);
        ctx.stroke();
      }

      // HUD: Label Pemain, Jarak, & Nyawa (disusun horizontal rapi di atas lintasan)
      ctx.save();
      const fontSize = Math.round(Math.max(12, 14 * s + 3));
      ctx.font      = `bold ${fontSize}px 'Fredoka', sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.fillText(`Player ${slot}`, 16, laneY + fontSize + 8);

      // Jarak di samping label pemain (mengoptimalkan ruang horizontal)
      ctx.font      = `${fontSize}px 'Fredoka', sans-serif`;
      ctx.fillStyle = '#d0d8ea';
      ctx.fillText(`🚩 ${dist.toFixed(1)} m`, 130, laneY + fontSize + 8);

      // Nyawa (♥ / ♡) di kanan
      ctx.font      = `${fontSize + 3}px 'Fredoka', sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = 'right';
      let hearts = '';
      for (let i = 0; i < MAX_LIVES; i++) hearts += (i < lives ? '♥ ' : '♡ ');
      ctx.fillText(hearts.trim(), W - 20, laneY + fontSize + 8);
      ctx.restore();

      // Rintangan
      for (const obs of lane.obstacles) drawCactus(obs);

      // Dino
      if (!dead) {
        const blink = invulnTimer > 0 && Math.floor(invulnTimer * BLINK_HZ * 2) % 2 === 1;
        if (!blink) drawDino(DINO_X, dinoY, dW, dH, color);
      }

      // Overlay lintasan mati
      if (dead) {
        ctx.fillStyle = 'rgba(10,14,24,0.6)';
        ctx.fillRect(0, laneY, W, lh);
        ctx.save();
        const ofs = Math.round(Math.max(16, 18 * s + 4));
        ctx.font      = `bold ${ofs}px 'Fredoka', sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText(`P${slot} Tereliminasi — ${survivedDist.toFixed(1)} m`, W / 2, laneY + lh / 2);
        ctx.restore();
      }
    }

    // ── Render dino ───────────────────────────────────────────────
    function drawDino(x, y, dW, dH, color) {
      ctx.save();
      ctx.fillStyle = color;

      // Badan
      ctx.beginPath();
      ctx.roundRect(x, y + dH * 0.3, dW * 0.75, dH * 0.7, 4);
      ctx.fill();

      // Kepala
      ctx.beginPath();
      ctx.roundRect(x + dW * 0.28, y, dW * 0.72, dH * 0.48, 4);
      ctx.fill();

      // Ekor
      ctx.beginPath();
      ctx.moveTo(x,            y + dH * 0.5);
      ctx.lineTo(x - dW * 0.32, y + dH * 0.82);
      ctx.lineTo(x,            y + dH * 0.82);
      ctx.closePath();
      ctx.fill();

      // Mata putih
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + dW * 0.78, y + dH * 0.15, dW * 0.1, 0, Math.PI * 2);
      ctx.fill();
      // Pupil hitam
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x + dW * 0.81, y + dH * 0.15, dW * 0.055, 0, Math.PI * 2);
      ctx.fill();

      // Kaki berlari
      const t   = Date.now() * 0.012;
      const off = Math.sin(t) * dH * 0.09;
      ctx.fillStyle = color;
      ctx.fillRect(x + dW * 0.1, y + dH - dH * 0.22, dW * 0.2, dH * 0.22 + off);
      ctx.fillRect(x + dW * 0.4, y + dH - dH * 0.22, dW * 0.2, dH * 0.22 - off);

      ctx.restore();
    }

    // ── Render kaktus ─────────────────────────────────────────────
    function drawCactus(obs) {
      ctx.save();
      ctx.fillStyle = '#2ea44f';

      if (obs.type === 'double') {
        const tw = obs.w * 0.32;
        ctx.fillRect(obs.x,              obs.y + obs.h * 0.25, tw, obs.h * 0.75);
        ctx.fillRect(obs.x + obs.w * 0.6, obs.y,              tw, obs.h);
        ctx.fillRect(obs.x,              obs.y + obs.h * 0.3, obs.w * 0.45, obs.h * 0.18);
        ctx.fillRect(obs.x + obs.w * 0.55, obs.y + obs.h * 0.2, obs.w * 0.45, obs.h * 0.18);
      } else {
        ctx.fillRect(obs.x + obs.w * 0.3, obs.y, obs.w * 0.4, obs.h);
        ctx.fillRect(obs.x,               obs.y + obs.h * 0.3, obs.w * 0.45, obs.h * 0.18);
        ctx.fillRect(obs.x,               obs.y + obs.h * 0.12, obs.w * 0.18, obs.h * 0.3);
        ctx.fillRect(obs.x + obs.w * 0.55, obs.y + obs.h * 0.4, obs.w * 0.45, obs.h * 0.18);
        ctx.fillRect(obs.x + obs.w * 0.82, obs.y + obs.h * 0.22, obs.w * 0.18, obs.h * 0.3);
      }

      ctx.restore();
    }

    // ── Overlay: Menunggu Mulai ────────────────────────────────────
    function drawWaiting() {
      ctx.save();
      ctx.fillStyle = 'rgba(10,14,24,0.82)';
      ctx.fillRect(W / 2 - 280, H / 2 - 110, 560, 220);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      ctx.strokeRect(W / 2 - 280, H / 2 - 110, 560, 220);

      ctx.font      = "bold 38px 'Fredoka', sans-serif";
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText('🦖 Dino Jump (Landscape 16:9)', W / 2, H / 2 - 50);

      ctx.font      = "18px 'Fredoka', sans-serif";
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('Kirim 99# dari micro:bit pemain mana pun', W / 2, H / 2 - 6);
      ctx.fillText('atau klik layar untuk memulai!', W / 2, H / 2 + 24);

      ctx.font      = "14px 'Fredoka', sans-serif";
      ctx.fillStyle = '#60a5fa';
      ctx.fillText('🎮 Kontrol: Tombol selain 0 = Lompat', W / 2, H / 2 + 65);
      ctx.restore();
    }

    // ── Overlay: Hitung Mundur ────────────────────────────────────
    function drawCountdown() {
      ctx.save();
      const r = 85;
      ctx.fillStyle = 'rgba(10,14,24,0.7)';
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.font         = "bold 96px 'Fredoka', sans-serif";
      ctx.fillStyle    = '#fff';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(cdCount), W / 2, H / 2 + 4);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }

    // ── Render Utama ──────────────────────────────────────────────
    function draw() {
      ctx.fillStyle = '#0a0f1d';
      ctx.fillRect(0, 0, W, H);

      for (const lane of lanes) drawLane(lane);

      if (phase === 'waiting')   drawWaiting();
      if (phase === 'countdown') drawCountdown();
    }

    // ── Loop Utama ────────────────────────────────────────────────
    let lastTs = null;

    function loop(ts) {
      if (lastTs == null) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;

      if (phase === 'countdown') {
        cdTimer -= dt;
        if (cdTimer <= 0) {
          cdCount--;
          if (cdCount <= 0) {
            beginGame();
          } else {
            cdTimer = COUNTDOWN_DT;
            audio?.play('click');
          }
        }
      }

      if (phase === 'playing') step(dt);
      draw();

      frameId = requestAnimationFrame(loop);
    }

    // ── Handler Input ─────────────────────────────────────────────
    const slotToLane = {};
    for (const lane of lanes) slotToLane[lane.slot] = lane;

    function onInput({ player, cmd }) {
      if (cmd === '0') return;

      if (phase === 'waiting') {
        if (cmd === '99') startCountdown();
        return;
      }

      if (phase === 'countdown' || phase === 'over') return;

      const lane = slotToLane[player];
      if (!lane || lane.dead) return;
      tryJump(lane);
    }

    function onCanvasClick() {
      if (phase === 'waiting') startCountdown();
    }

    const offInput = kernel.on('input', onInput);
    canvas.addEventListener('click', onCanvasClick);

    frameId = requestAnimationFrame(loop);

    // ── stop() — Cleanup total ────────────────────────────────────
    return {
      stop() {
        cancelAnimationFrame(frameId);
        for (const id of timers) clearTimeout(id);
        timers.length = 0;
        offInput();
        canvas.removeEventListener('click', onCanvasClick);
      }
    };
  }
};
