// GAME: Flappy Bird (games/flappybird.js)
// Semua burung terbang bersama di arena yang sama melewati celah pipa.
// Dukung 1 sampai 4 pemain, orientasi canvas 800x600.
//
// Kontrak game:
//   id, name, icon, description, modes, canvas
//   create({canvas, kernel, players, mode, finish, audio}) -> {stop()}
//
// Kontrol:
//   '99' = mulai permainan (hanya dari players[0], atau klik canvas)
//   '5', '3', atau '4' = burung terbang (flap)
//   perintah lain ('0', '1', '2', dll.) = diabaikan selama permainan

'use strict';

// ═══════════════════════════════════════════════════════════════════
//  KONSTANTA PERMAINAN
// ═══════════════════════════════════════════════════════════════════

const W = 800;
const H = 600;

// Arena & Lantai
const FLOOR_Y       = 540; // Batas lantai pipa/tanah
const CEIL_Y        = 0;   // Batas atas langit-langit
const GROUND_H      = H - FLOOR_Y; // 60 px tinggi tanah

// Ukuran & Fisika Burung (Disesuaikan Ramah Anak Usia TK & SD)
const BIRD_W        = 34;
const BIRD_H        = 26;
const HITBOX_RATIO  = 0.70; // 70% ukuran visual (toleransi benturan ramah anak)
const GRAV          = 780;  // px/dtk² gravitasi lembut (burung melayang santai, tidak jatuh drastis)
const FLAP_V        = -310; // px/dtk kepakan lembut teratur
const MAX_FALL      = 400;  // px/dtk batas kecepatan jatuh terkontrol
const FLAP_COOLDOWN_MS = 60;// ms jeda minimum antar kepakan per burung

// Posisi Horizontal Burung (staggered)
const BIRD_BASE_X   = 160;
const BIRD_STAGGER_X = 30;

// Pipa (Ramah Anak: Celah Ekstra Lebar & Jarak Antar Pipa Lega)
const PIPE_W        = 70;
const SPEED_ACCEL   = 1.0;  // px/dtk akselerasi sangat halus
const SPEED_MAX     = 175;  // px/dtk batas kecepatan maksimal yang tetap ramah anak
const PIPE_SPACING_SEC = 2.4; // jeda 2.4 dtk antar pipa memberi waktu stabilisasi
const TOP_MARGIN    = 60;   // margin aman dari langit-langit
const BOTTOM_MARGIN = 60;   // margin aman dari lantai
const MAX_GAP_SHIFT = 100;  // pergeseran celah tidak terlalu curam

// Konfigurasi Tingkat Kesulitan (Standar TK & SD)
const LEVELS = {
  mudah:  { gap: 260, speed: 110 },
  sedang: { gap: 240, speed: 125 }, // Celah 240px (~10x tinggi burung), santai & menyenangkan
  sulit:  { gap: 200, speed: 150 }
};

// Nyawa & Kebal
const INVULN_SEC    = 2.5;  // durasi kebal 2.5 detik setelah tabrakan
const BLINK_HZ      = 8;    // frekuensi kedip saat kebal
const COUNTDOWN_SEC = 3;    // hitung mundur sebelum mulai

// Warna Slot Pemain (berdasarkan nomor slot controller, bukan urutan array)
const SLOT_COLORS = {
  1: '#4b83ff',
  2: '#ff9a2e',
  3: '#3ccf8e',
  4: '#b98cff'
};

// ═══════════════════════════════════════════════════════════════════
//  SEEDER RNG (Linear Congruential Generator)
// ═══════════════════════════════════════════════════════════════════

function makeLCG(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ═══════════════════════════════════════════════════════════════════
//  EKSPOR MODUL GAME
// ═══════════════════════════════════════════════════════════════════

export default {
  id: 'flappybird',
  name: 'Flappy Bird',
  icon: '🐦',
  description: 'Terbangkan burung melewati celah pipa. Jangan sampai menabrak! Dukung 1–4 pemain.',

  modes: [
    { id: '1p', label: '1 Player', sub: 'Sendiri',  players: 1 },
    { id: '2p', label: '2 Player', sub: 'Berdua',   players: 2 },
    { id: '3p', label: '3 Player', sub: 'Bertiga',  players: 3 },
    { id: '4p', label: '4 Player', sub: 'Berempat', players: 4 }
  ],

  canvas: { width: W, height: H },

  create({ canvas, kernel, players, mode, finish, audio }) {
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // ── Peraturan Permainan Bersih (Nyawa 5 Ramah Anak & Game sampai Semua Mati) ──
    const MAX_LIVES = 5;
    const END_MODE  = 'all'; // permainan berlangsung sampai semua burung gugur
    const LVL_CFG   = LEVELS.sedang; // celah seimbang & nyaman untuk dinikmati bersama

    const numP = players.length;
    const solo = numP === 1;

    // Pemain pertama yang berhak memulai game dengan '99'
    const starterPlayer = players[0];

    // ── Inisialisasi Burung Pemain ─────────────────────────────────
    const birds = players.map((slot, idx) => ({
      slot,             // nomor slot pemain fisik (1–4)
      idx,              // urutan pemain dalam array
      x: BIRD_BASE_X + idx * BIRD_STAGGER_X,
      y: 260 + idx * 12,// posisi awal Y
      velY: 0,
      lives: MAX_LIVES,
      score: 0,
      alive: true,
      survivedTime: 0,
      invulnTimer: 0,
      lastFlapTime: 0,
      color: SLOT_COLORS[slot] || '#fff'
    }));

    // Peta slot ke objek burung untuk respon kontrol cepat
    const slotToBird = {};
    birds.forEach(b => { slotToBird[b.slot] = b; });

    // ── State Permainan ───────────────────────────────────────────
    let phase        = 'waiting'; // 'waiting' | 'countdown' | 'playing' | 'over'
    let cdCount      = COUNTDOWN_SEC;
    let cdTimer      = 1.0;
    let elapsed      = 0;
    let speed        = LVL_CFG.speed;
    let groundScroll = 0;

    // Pipa & Seeder Generator
    const pipes      = []; // array objek pipa
    let nextPipeDist = 0;  // jarak tempuh (px) sebelum pipa berikutnya muncul
    let lastGapY     = (FLOOR_Y - LVL_CFG.gap) / 2;
    const rngSeed    = Math.floor(Math.random() * 0x100000000);
    const rng        = makeLCG(rngSeed);

    // ── Helper Pembatalan Timer & Listener ────────────────────────
    let frameId      = null;
    const timeouts   = [];
    const safeTimeout = (fn, ms) => {
      const id = setTimeout(fn, ms);
      timeouts.push(id);
      return id;
    };

    // ── Spawn Pipa Ber-Seed ────────────────────────────────────────
    function spawnPipe() {
      const gapSize = LVL_CFG.gap;
      const minGapY = TOP_MARGIN;
      const maxGapY = FLOOR_Y - BOTTOM_MARGIN - gapSize;

      // Geser celah dari posisi sebelumnya dengan batas MAX_GAP_SHIFT
      const shift = (rng() * 2 - 1) * MAX_GAP_SHIFT;
      let newGapY = Math.max(minGapY, Math.min(maxGapY, lastGapY + shift));
      lastGapY = newGapY;

      pipes.push({
        x: W + 10,
        gapY: newGapY,
        gapSize: gapSize,
        scoredBy: {} // lacak pemain mana yang sudah mencetak skor pada pipa ini
      });

      // Jarak antar pipa = kecepatan saat itu * 1.6 detik
      nextPipeDist = speed * PIPE_SPACING_SEC;
    }

    // Pipa pertama muncul setelah jeda awal
    nextPipeDist = speed * 2.2;

    // ── Alur Mulai & Hitung Mundur ─────────────────────────────────
    function triggerStart() {
      if (phase !== 'waiting') return;
      if (COUNTDOWN_SEC > 0) {
        phase = 'countdown';
        cdCount = COUNTDOWN_SEC;
        cdTimer = 1.0;
        audio?.play('click');
      } else {
        startGame();
      }
    }

    function startGame() {
      phase = 'playing';
      audio?.play('start');
    }

    // ── Logika Flap Burung ─────────────────────────────────────────
    function flapBird(bird) {
      if (!bird.alive || phase !== 'playing') return;

      const now = performance.now();
      if (now - bird.lastFlapTime < FLAP_COOLDOWN_MS) return; // anti-spam
      bird.lastFlapTime = now;

      bird.velY = FLAP_V; // set kecepatan langsung ke -420

      // Audio kepakan dengan stereo panning sesuai posisi burung
      const pan = numP <= 1 ? 0 : (bird.idx / (numP - 1)) * 2 - 1;
      audio?.play('click', { pan, volume: 0.3 });
    }

    // ── Periksa Selesai Permainan ──────────────────────────────────
    function checkEnd() {
      if (phase !== 'playing') return;
      const aliveBirds = birds.filter(b => b.alive);

      if (solo) {
        if (aliveBirds.length === 0) endGame();
        return;
      }

      if (END_MODE === 'all') {
        if (aliveBirds.length === 0) endGame();
      } else {
        // Mode 'last': berakhir saat tersisa 1 burung hidup
        if (aliveBirds.length <= 1) endGame();
      }
    }

    function endGame() {
      if (phase === 'over') return;
      phase = 'over';

      // Simpan waktu bertahan untuk burung yang masih hidup
      birds.forEach(b => {
        if (b.alive) {
          b.survivedTime = elapsed;
        }
      });

      safeTimeout(() => {
        const resultText = buildFinishText();
        const anyScore = birds.some(b => b.score > 0);
        audio?.play(solo ? (anyScore ? 'win' : 'lose') : 'win');
        finish(resultText);
      }, 500);
    }

    function buildFinishText() {
      if (solo) {
        return `Skor ${birds[0].score} pipa! Bertahan ${birds[0].survivedTime.toFixed(1)} dtk`;
      }

      if (END_MODE === 'last') {
        const winner = birds.find(b => b.alive) ||
          birds.slice().sort((a, b) => b.score - a.score || b.survivedTime - a.survivedTime)[0];
        const scores = birds.map(b => `P${b.slot} ${b.score} pipa`).join(', ');
        return `P${winner.slot} menang! ${scores}`;
      }

      // Mode 'all': urutkan skor tertinggi, lalu waktu bertahan
      const sorted = birds.slice().sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.survivedTime - a.survivedTime;
      });

      const top = sorted[0];
      const second = sorted[1];
      const isTie = top.score === second.score && Math.abs(top.survivedTime - second.survivedTime) < 0.05;

      const scoreDetails = sorted.map(b => `P${b.slot} ${b.score} pipa`).join(', ');

      if (isTie) {
        return `Seri! Sama-sama ${top.score} pipa`;
      }
      return `P${top.slot} menang! ${scoreDetails}`;
    }

    // ── Update Fisika & Simulasi per Frame ─────────────────────────
    function step(dt) {
      elapsed += dt;

      // Akselerasi kecepatan scroll
      speed = Math.min(SPEED_MAX, speed + SPEED_ACCEL * dt);
      const dScroll = speed * dt;
      groundScroll = (groundScroll + dScroll) % 24;

      // Scroll & Pembuatan Pipa
      nextPipeDist -= dScroll;
      if (nextPipeDist <= 0) {
        spawnPipe();
      }

      for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i];
        p.x -= dScroll;
        if (p.x + PIPE_W < -20) {
          pipes.splice(i, 1);
        }
      }

      // Update Burung
      for (const bird of birds) {
        if (!bird.alive) continue;

        // Gravitasi & gerak vertikal
        bird.velY = Math.min(MAX_FALL, bird.velY + GRAV * dt);
        bird.y += bird.velY * dt;

        if (bird.invulnTimer > 0) {
          bird.invulnTimer = Math.max(0, bird.invulnTimer - dt);
        }

        // Cek Skor: pipa yang berhasil dilewati
        for (const p of pipes) {
          if (!p.scoredBy[bird.idx]) {
            // Tepi belakang burung melewati tepi kanan pipa
            if (bird.x > p.x + PIPE_W) {
              p.scoredBy[bird.idx] = true;
              if (bird.invulnTimer <= 0) {
                bird.score++;
                const pan = numP <= 1 ? 0 : (bird.idx / (numP - 1)) * 2 - 1;
                audio?.play('score', { volume: 0.4, pan });
              }
            }
          }
        }

        // Cek Tabrakan Batas Langit & Lantai
        let hit = false;
        if (bird.y <= CEIL_Y) {
          hit = true;
          bird.y = CEIL_Y;
        } else if (bird.y + BIRD_H >= FLOOR_Y) {
          hit = true;
          bird.y = FLOOR_Y - BIRD_H;
        }

        // Cek Tabrakan Pipa (Hitbox 85%)
        if (!hit && bird.invulnTimer <= 0) {
          const hbW = BIRD_W * HITBOX_RATIO;
          const hbH = BIRD_H * HITBOX_RATIO;
          const hbX = bird.x + (BIRD_W - hbW) / 2;
          const hbY = bird.y + (BIRD_H - hbH) / 2;

          for (const p of pipes) {
            // Cek apakah koordinat X beririsan dengan pipa
            if (hbX + hbW > p.x && hbX < p.x + PIPE_W) {
              // Menabrak pipa atas atau pipa bawah
              if (hbY < p.gapY || hbY + hbH > p.gapY + p.gapSize) {
                hit = true;
                break;
              }
            }
          }
        }

        // Penanganan Tabrakan
        if (hit && bird.invulnTimer <= 0) {
          bird.lives--;
          if (bird.lives > 0) {
            // Masih ada nyawa: pindahkan ke tengah celah pipa berikutnya
            bird.invulnTimer = INVULN_SEC;
            bird.velY = 0;
            audio?.play('hurt');

            // Cari pipa di depan burung
            const aheadPipe = pipes.find(p => p.x + PIPE_W > bird.x);
            if (aheadPipe) {
              bird.y = aheadPipe.gapY + (aheadPipe.gapSize - BIRD_H) / 2;
            } else {
              bird.y = (FLOOR_Y - BIRD_H) / 2;
            }
          } else {
            // Mati
            bird.alive = false;
            bird.survivedTime = elapsed;
            bird.y = FLOOR_Y - BIRD_H;
            bird.velY = 0;
            audio?.play('lose');
            checkEnd();
          }
        }
      }
    }

    // ── Render Frame ──────────────────────────────────────────────
    function draw() {
      // 1. Langit & Latar Belakang
      ctx.fillStyle = '#4dc9d8';
      ctx.fillRect(0, 0, W, FLOOR_Y);

      // Awan dekoratif
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(140, 120, 42, 0, Math.PI * 2);
      ctx.arc(180, 110, 56, 0, Math.PI * 2);
      ctx.arc(220, 120, 40, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(580, 180, 36, 0, Math.PI * 2);
      ctx.arc(620, 170, 50, 0, Math.PI * 2);
      ctx.arc(660, 180, 36, 0, Math.PI * 2);
      ctx.fill();

      // 2. Pipa-pipa
      for (const p of pipes) {
        drawPipe(p);
      }

      // 3. Lantai & Tanah Bergerak
      ctx.fillStyle = '#dec876';
      ctx.fillRect(0, FLOOR_Y, W, GROUND_H);

      // Rumput atas lantai
      ctx.fillStyle = '#5ee270';
      ctx.fillRect(0, FLOOR_Y, W, 14);
      ctx.fillStyle = '#3eb850';
      ctx.fillRect(0, FLOOR_Y + 12, W, 3);

      // Strip tekstur tanah bergerak
      ctx.strokeStyle = '#c4af60';
      ctx.lineWidth = 3;
      for (let x = -groundScroll; x < W; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, FLOOR_Y + 16);
        ctx.lineTo(x + 12, H);
        ctx.stroke();
      }

      // 4. Burung Pemain
      birds.forEach(bird => {
        if (!bird.alive) {
          // Burung mati digambar redup di lantai
          drawBird(bird.x, bird.y, bird.color, 0, 0.4);
        } else {
          // Efek berkedip saat kebal
          const isBlinking = bird.invulnTimer > 0 && Math.floor(bird.invulnTimer * BLINK_HZ * 2) % 2 === 1;
          if (!isBlinking) {
            // Sudut kemiringan visual burung
            const angle = Math.max(-0.5, Math.min(1.1, bird.velY / 550));
            drawBird(bird.x, bird.y, bird.color, angle, 1.0);
          }
        }
      });

      // 5. Animasi melayang pada fase siap
      if (phase === 'waiting') {
        const hoverY = Math.sin(Date.now() * 0.005) * 6;
        birds.forEach(bird => {
          bird.y = 260 + bird.idx * 12 + hoverY;
        });
      }

      // 6. HUD Pemain
      drawHUD();

      // 7. Overlay Status (Waiting & Countdown)
      if (phase === 'waiting')   drawWaitingOverlay();
      if (phase === 'countdown') drawCountdownOverlay();
    }

    // ── Gambar Burung (Bentuk Canvas Murni) ────────────────────────
    function drawBird(x, y, color, angle, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x + BIRD_W / 2, y + BIRD_H / 2);
      ctx.rotate(angle);

      // Badan Burung
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, BIRD_W / 2, BIRD_H / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Sayap
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.ellipse(-6, 2, 9, 6, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Mata Putih
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(8, -5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Pupil Mata
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(10, -5, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Paruh Oranye
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(11, -1);
      ctx.lineTo(20, 2);
      ctx.lineTo(11, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    // ── Gambar Pipa Hijau dengan Cap ──────────────────────────────
    function drawPipe(pipe) {
      const capH = 26;
      const capOver = 4; // cap sedikit lebih lebar dari pipa

      ctx.save();
      ctx.fillStyle = '#73bf2e';
      ctx.strokeStyle = '#2d5a1e';
      ctx.lineWidth = 3;

      // 1. Pipa Atas
      const topH = pipe.gapY;
      if (topH > 0) {
        // Badan pipa atas
        ctx.fillRect(pipe.x, 0, PIPE_W, topH - capH);
        ctx.strokeRect(pipe.x, 0, PIPE_W, topH - capH);
        // Highlight pipa
        ctx.fillStyle = '#8ce038';
        ctx.fillRect(pipe.x + 6, 0, 8, topH - capH);
        // Cap pipa atas
        ctx.fillStyle = '#73bf2e';
        ctx.fillRect(pipe.x - capOver, topH - capH, PIPE_W + capOver * 2, capH);
        ctx.strokeRect(pipe.x - capOver, topH - capH, PIPE_W + capOver * 2, capH);
      }

      // 2. Pipa Bawah
      const botY = pipe.gapY + pipe.gapSize;
      const botH = FLOOR_Y - botY;
      if (botH > 0) {
        // Cap pipa bawah
        ctx.fillRect(pipe.x - capOver, botY, PIPE_W + capOver * 2, capH);
        ctx.strokeRect(pipe.x - capOver, botY, PIPE_W + capOver * 2, capH);
        // Badan pipa bawah
        ctx.fillRect(pipe.x, botY + capH, PIPE_W, botH - capH);
        ctx.strokeRect(pipe.x, botY + capH, PIPE_W, botH - capH);
        // Highlight pipa
        ctx.fillStyle = '#8ce038';
        ctx.fillRect(pipe.x + 6, botY + capH, 8, botH - capH);
      }

      ctx.restore();
    }

    // ── Gambar HUD ────────────────────────────────────────────────
    function drawHUD() {
      ctx.save();

      // Skor Tertinggi di Tengah Atas
      const maxScore = Math.max(...birds.map(b => b.score));
      ctx.font = "bold 44px 'Fredoka', sans-serif";
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 5;
      ctx.textAlign = 'center';
      ctx.strokeText(String(maxScore), W / 2, 54);
      ctx.fillText(String(maxScore), W / 2, 54);

      // Status Baris Pemain di Sudut Kiri Atas
      birds.forEach((bird, i) => {
        const yPos = 36 + i * 26;
        ctx.globalAlpha = bird.alive ? 1.0 : 0.45;

        // Label P1, P2...
        ctx.font = "bold 18px 'Fredoka', sans-serif";
        ctx.fillStyle = bird.color;
        ctx.textAlign = 'left';
        ctx.fillText(`P${bird.slot}`, 18, yPos);

        // Nyawa ♥ / ♡
        let hearts = '';
        for (let l = 0; l < MAX_LIVES; l++) {
          hearts += (l < bird.lives ? '♥ ' : '♡ ');
        }
        ctx.font = "15px 'Fredoka', sans-serif";
        ctx.fillText(hearts.trim(), 50, yPos);

        // Skor pemain
        ctx.fillStyle = '#fff';
        ctx.font = "bold 18px 'Fredoka', sans-serif";
        ctx.fillText(`${bird.score}`, 135, yPos);
      });

      ctx.restore();
    }

    // ── Overlay Siap Menunggu Mulai ───────────────────────────────
    function drawWaitingOverlay() {
      ctx.save();
      ctx.fillStyle = 'rgba(10, 14, 24, 0.78)';
      ctx.fillRect(W / 2 - 270, H / 2 - 105, 540, 210);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(W / 2 - 270, H / 2 - 105, 540, 210);

      ctx.font = "bold 36px 'Fredoka', sans-serif";
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText('🐦 Flappy Bird', W / 2, H / 2 - 45);

      ctx.font = "16px 'Fredoka', sans-serif";
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`Kirim 99# dari micro:bit pemain pertama (P${starterPlayer}),`, W / 2, H / 2 - 6);
      ctx.fillText('atau klik layar untuk mulai!', W / 2, H / 2 + 20);

      ctx.font = "14px 'Fredoka', sans-serif";
      ctx.fillStyle = '#60a5fa';
      ctx.fillText('🎮 Tombol 5, 3, atau 4 = Terbang (Kepak)', W / 2, H / 2 + 62);
      ctx.restore();
    }

    // ── Overlay Hitung Mundur ─────────────────────────────────────
    function drawCountdownOverlay() {
      ctx.save();
      ctx.fillStyle = 'rgba(10, 14, 24, 0.65)';
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 75, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.font = "bold 88px 'Fredoka', sans-serif";
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(cdCount), W / 2, H / 2 + 4);
      ctx.restore();
    }

    // ── Loop Game Utama ───────────────────────────────────────────
    let lastTs = null;

    function loop(ts) {
      if (lastTs == null) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.05); // batas dt maksimal 0.05 dtk
      lastTs = ts;

      if (phase === 'countdown') {
        cdTimer -= dt;
        if (cdTimer <= 0) {
          cdCount--;
          if (cdCount <= 0) {
            startGame();
          } else {
            cdTimer = 1.0;
            audio?.play('click');
          }
        }
      }

      if (phase === 'playing') {
        step(dt);
      }

      draw();
      frameId = requestAnimationFrame(loop);
    }

    // ── Penanganan Input ──────────────────────────────────────────
    function onInput({ player, cmd }) {
      // 1. Perintah Mulai '99'
      if (cmd === '99') {
        if (phase === 'waiting' && player === starterPlayer) {
          triggerStart();
        }
        return;
      }

      // Abaikan perintah selama waiting, countdown, atau over
      if (phase !== 'playing') return;

      // 2. Perintah Flap: hanya '5', '3', atau '4'
      if (cmd === '5' || cmd === '3' || cmd === '4') {
        const bird = slotToBird[player];
        if (bird) {
          flapBird(bird);
        }
      }
      // Perintah lain ('0', '1', '2', dll.) diabaikan sepenuhnya
    }

    function onCanvasClick() {
      if (phase === 'waiting') {
        triggerStart();
      }
    }

    const offInput = kernel.on('input', onInput);
    canvas.addEventListener('click', onCanvasClick);

    // Mulai Animasi Loop
    frameId = requestAnimationFrame(loop);

    // ── Siklus Hidup Cleanup (stop) ───────────────────────────────
    return {
      stop() {
        cancelAnimationFrame(frameId);
        for (const id of timeouts) clearTimeout(id);
        timeouts.length = 0;
        offInput();
        canvas.removeEventListener('click', onCanvasClick);
      }
    };
  }
};

