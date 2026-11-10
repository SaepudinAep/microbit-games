// GAME: Tangkap Bintang (games/catchstar.js)
// Geser keranjangmu, tangkap bintang yang jatuh sebelum teman-temanmu!
// Mendukung 1, 2, dan 4 pemain di kanvas standar 1280x720.

'use strict';

// ═══════════════════════════════════════════════════════════════════
//  KONSTANTA PERMAINAN
// ═══════════════════════════════════════════════════════════════════

const CANVAS_WIDTH       = 1280;
const CANVAS_HEIGHT      = 720;
const COUNTDOWN_SEC      = 3;
const MAX_DT             = 0.05; // Batas dt maksimal per frame

// Area HUD & Safe Margin
const HUD_HEIGHT         = 64;
const HUD_SAFE_MARGIN_X  = 40;

// Keranjang
const BASKET_Y           = 640; // Posisi bibir atas keranjang
const BASKET_HEIGHT      = 40;  // Tinggi keranjang
const BASKET_SPEED       = 520; // px/dtk kecepatan geser
const BASKET_WIDTH_L1    = 150; // Lebar level 1
const BASKET_WIDTH_L2    = 125; // Lebar level 2
const BASKET_WIDTH_L3    = 100; // Lebar level 3
const BASKET_TAPER_RATIO = 0.76;// Rasio lebar dasar terhadap bibir atas
const CATCH_TOLERANCE    = 0.3; // Toleransi jarak tangkap (0.3 * radius bintang)

// Bintang
const STAR_RADIUS        = 22; // Radius bintang normal
const GOLD_STAR_RADIUS   = 26; // Radius bintang emas
const NORMAL_STAR_POINTS = 1;  // Poin bintang biasa
const GOLD_STAR_POINTS   = 3;  // Poin bintang emas
const STAR_ROT_SPEED     = 1.5;// Kecepatan putar visual bintang (rad/dtk)

// Alokasi Total Bintang per Mode Pemain
const TOTAL_STARS_1P     = 20;
const TOTAL_STARS_2P     = 30;
const TOTAL_STARS_4P     = 40;

// Konfigurasi Level 1: "Hujan Bintang"
const L1_NAME            = 'Hujan Bintang';
const L1_SPEED           = 150;
const L1_SPAWN_INTERVAL  = 1.4;
const L1_GOLD_CHANCE     = 0.0;
const L1_SWAY            = false;

// Konfigurasi Level 2: "Hujan Deras"
const L2_NAME            = 'Hujan Deras';
const L2_SPEED           = 230;
const L2_SPAWN_INTERVAL  = 1.0;
const L2_GOLD_CHANCE     = 0.12;
const L2_SWAY            = false;

// Konfigurasi Level 3: "Badai Bintang"
const L3_NAME            = 'Badai Bintang';
const L3_SPEED           = 330;
const L3_SPAWN_INTERVAL  = 0.7;
const L3_GOLD_CHANCE     = 0.20;
const L3_SWAY_CHANCE     = 0.40;
const L3_SWAY_AMPLITUDE  = 60;
const L3_SWAY_FREQ_HZ    = 1.2;

// Sistem Kemunculan (Spawn & Shuffle Bag)
const NUM_COLUMNS        = 12;
const SPAWN_JITTER_PCT   = 0.15; // Variasi jeda +-15%
const BETWEEN_LEVEL_SEC  = 2.0;  // Jeda antar level 2 detik
const FINISH_DELAY_MS    = 600;  // Jeda sebelum panggil finish()

// Warna Pemain Resmi Berdasarkan Nomor Slot Controller
const SLOT_COLORS = {
  1: '#4b83ff',
  2: '#ff9a2e',
  3: '#3ccf8e',
  4: '#b98cff'
};

// Titik Bintang Latar Belakang (Statis)
const BG_STAR_COUNT = 75;

// ═══════════════════════════════════════════════════════════════════
//  FUNGSI BANTU PEMBENTUK GRAFIS
// ═══════════════════════════════════════════════════════════════════

// Menggambar Bintang Lima Sudut
function drawStarPath(ctx, cx, cy, spikes, outerRadius, innerRadius) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
}

// ═══════════════════════════════════════════════════════════════════
//  EKSPOR UTAMA MODUL GAME
// ═══════════════════════════════════════════════════════════════════

export default {
  id: 'catchstar',
  name: 'Tangkap Bintang',
  icon: '⭐',
  description: 'Geser keranjangmu, tangkap bintang yang jatuh sebelum teman-temanmu! 3 level penuh tantangan.',
  modes: [
    { id: '1p', label: '1 Player', sub: 'Solo', players: 1 },
    { id: '2p', label: '2 Player', sub: 'Rebut bintang', players: 2 },
    { id: '4p', label: '4 Player', sub: 'Rebut bintang', players: 4 }
  ],
  canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },

  create({ canvas, kernel, players, mode, finish, audio }) {
    const ctx = canvas.getContext('2d');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Pelacak Timer dan Siklus Animasi
    let frameId = null;
    const timeouts = [];
    let lastTime = performance.now();
    let isStopped = false;

    // Pemain Pertama sebagai Pemantik Mulai ('99')
    const starterPlayer = players[0];

    // Status Game: 'waiting' | 'countdown' | 'play' | 'between' | 'over'
    let state = 'waiting';
    let countdownVal = COUNTDOWN_SEC;
    let countdownTimer = 0;
    let betweenTimer = 0;

    // Level & Alokasi Bintang
    let currentLevel = 1;
    const totalStars = mode.players === 1 ? TOTAL_STARS_1P : (mode.players === 2 ? TOTAL_STARS_2P : TOTAL_STARS_4P);

    // Hitung jatah bintang per level (total / 3, sisa dibagi dari level 1)
    const baseCount = Math.floor(totalStars / 3);
    const remCount = totalStars % 3;
    const levelQuotas = {
      1: baseCount + (remCount > 0 ? 1 : 0),
      2: baseCount + (remCount > 1 ? 1 : 0),
      3: baseCount
    };

    let starsSpawnedInLevel = 0;
    let spawnTimer = 0;
    let totalCaughtCount = 0;
    let totalMissedCount = 0;

    // Konfigurasi Level Aktif
    function getLevelConfig(lvl) {
      if (lvl === 1) {
        return {
          name: L1_NAME,
          speed: L1_SPEED,
          interval: L1_SPAWN_INTERVAL,
          goldChance: L1_GOLD_CHANCE,
          swayChance: 0,
          basketWidth: BASKET_WIDTH_L1
        };
      }
      if (lvl === 2) {
        return {
          name: L2_NAME,
          speed: L2_SPEED,
          interval: L2_SPAWN_INTERVAL,
          goldChance: L2_GOLD_CHANCE,
          swayChance: 0,
          basketWidth: BASKET_WIDTH_L2
        };
      }
      return {
        name: L3_NAME,
        speed: L3_SPEED,
        interval: L3_SPAWN_INTERVAL,
        goldChance: L3_GOLD_CHANCE,
        swayChance: L3_SWAY_CHANCE,
        basketWidth: BASKET_WIDTH_L3
      };
    }

    // Generator Titik Bintang Latar Belakang Statis
    const bgStars = [];
    for (let i = 0; i < BG_STAR_COUNT; i++) {
      bgStars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        r: 0.6 + Math.random() * 1.6,
        alpha: 0.25 + Math.random() * 0.65
      });
    }

    // Inisialisasi Keranjang Pemain
    const baskets = players.map((slotNum, idx) => {
      const initialX = ((idx + 1) * CANVAS_WIDTH) / (players.length + 1);
      return {
        slot: slotNum,
        color: SLOT_COLORS[slotNum] || '#ffffff',
        x: initialX,
        vx: 0, // Arah gerak: -1 (kiri), 0 (diam), 1 (kanan)
        score: 0,
        caught: 0
      };
    });

    const slotToBasket = {};
    for (const b of baskets) slotToBasket[b.slot] = b;

    // Daftar Bintang yang Sedang Jatuh di Arena
    const activeStars = [];

    // Shuffle Bag untuk Kemunculan Kolom Merata
    let columnBag = [];
    function popColumn() {
      if (columnBag.length === 0) {
        columnBag = Array.from({ length: NUM_COLUMNS }, (_, i) => i);
        // Fisher-Yates shuffle
        for (let i = columnBag.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const tmp = columnBag[i];
          columnBag[i] = columnBag[j];
          columnBag[j] = tmp;
        }
      }
      return columnBag.pop();
    }

    // Menghasilkan Jeda Waktu Muncul dengan Variasi +-15%
    function calcNextSpawnInterval(baseInt) {
      const variation = (Math.random() * 2 - 1) * SPAWN_JITTER_PCT; // -0.15 .. +0.15
      return baseInt * (1 + variation);
    }

    // Memunculkan Bintang Baru
    function spawnStar() {
      const cfg = getLevelConfig(currentLevel);
      const isGold = Math.random() < cfg.goldChance;
      const isSway = cfg.swayChance > 0 && Math.random() < cfg.swayChance;
      const radius = isGold ? GOLD_STAR_RADIUS : STAR_RADIUS;

      // Ambil kolom dari shuffle bag
      const col = popColumn();
      const colWidth = CANVAS_WIDTH / NUM_COLUMNS;
      const colCenter = col * colWidth + colWidth / 2;
      const jitter = (Math.random() - 0.5) * (colWidth * 0.6);
      const baseX = Math.max(radius, Math.min(CANVAS_WIDTH - radius, colCenter + jitter));

      activeStars.push({
        baseX,
        x: baseX,
        y: -radius - 10,
        prevY: -radius - 10,
        radius,
        isGold,
        points: isGold ? GOLD_STAR_POINTS : NORMAL_STAR_POINTS,
        speed: cfg.speed,
        isSway,
        swayPhase: Math.random() * Math.PI * 2,
        timeAlive: 0,
        rot: Math.random() * Math.PI * 2
      });

      starsSpawnedInLevel++;
      spawnTimer = calcNextSpawnInterval(cfg.interval);
    }

    // ── Suara Aman ────────────────────────────────────────────────
    function safePlay(name, opts) {
      if (audio && typeof audio.play === 'function') {
        try {
          audio.play(name, opts);
        } catch (_) {}
      }
    }

    // ── Alur Mulai Game ───────────────────────────────────────────
    function triggerStart() {
      if (state !== 'waiting') return;
      state = 'countdown';
      countdownVal = COUNTDOWN_SEC;
      countdownTimer = 0;
      safePlay('click');
    }

    function beginLevel(lvl) {
      currentLevel = lvl;
      starsSpawnedInLevel = 0;
      activeStars.length = 0;
      state = 'play';
      const cfg = getLevelConfig(lvl);
      spawnTimer = calcNextSpawnInterval(cfg.interval * 0.6); // Sedikit jeda di awal level
      safePlay('start');
    }

    function checkLevelCompletion() {
      const quota = levelQuotas[currentLevel];
      if (starsSpawnedInLevel >= quota && activeStars.length === 0) {
        if (currentLevel < 3) {
          // Masuk Jeda Antar Level
          state = 'between';
          betweenTimer = BETWEEN_LEVEL_SEC;
        } else {
          // Seluruh 3 Level Selesai!
          handleGameFinish();
        }
      }
    }

    // ── Penyelesaian Game & Format Hasil ──────────────────────────
    function handleGameFinish() {
      if (state === 'over') return;
      state = 'over';

      let resultText = '';
      if (mode.players === 1) {
        // Mode 1 Pemain: Penilaian Bintang Berdasarkan Persentase
        const p1 = baskets[0];
        const pct = totalStars > 0 ? (p1.caught / totalStars) * 100 : 0;
        let starRating = 1;
        if (pct >= 80) starRating = 3;
        else if (pct >= 50) starRating = 2;

        const starGlyphs = '★'.repeat(starRating) + '☆'.repeat(3 - starRating);
        resultText = `${starGlyphs} Hebat! ${p1.caught} dari ${totalStars} bintang (skor ${p1.score})`;

        // Suara akhir solo
        if (starRating >= 2) safePlay('win');
        else safePlay('lose');
      } else {
        // Mode 2 dan 4 Pemain: Juara Skor Tertinggi
        safePlay('win');
        const sortedBaskets = [...baskets].sort((a, b) => a.slot - b.slot);
        const maxScore = Math.max(...sortedBaskets.map(b => b.score));
        const winners = sortedBaskets.filter(b => b.score === maxScore);
        const scoreList = sortedBaskets.map(b => `P${b.slot} ${b.score}`).join(', ');

        if (winners.length === 1) {
          resultText = `P${winners[0].slot} menang! ${scoreList}`;
        } else {
          let tieText = '';
          if (winners.length === 2) {
            tieText = `P${winners[0].slot} dan P${winners[1].slot}`;
          } else {
            tieText = winners.slice(0, -1).map(w => `P${w.slot}`).join(', ') + ' dan P' + winners[winners.length - 1].slot;
          }
          resultText = `Seri antara ${tieText}! ${scoreList}`;
        }
      }

      // Jeda 600 ms sebelum panggil finish()
      const tid = setTimeout(() => {
        if (!isStopped && typeof finish === 'function') {
          finish(resultText);
        }
      }, FINISH_DELAY_MS);
      timeouts.push(tid);
    }

    // ── Logika Update Fisika ──────────────────────────────────────
    function update(dt) {
      if (state === 'countdown') {
        countdownTimer += dt;
        if (countdownTimer >= 1.0) {
          countdownTimer -= 1.0;
          countdownVal--;
          if (countdownVal > 0) {
            safePlay('click');
          } else {
            beginLevel(1);
          }
        }
        return;
      }

      if (state === 'between') {
        betweenTimer -= dt;
        if (betweenTimer <= 0) {
          beginLevel(currentLevel + 1);
        }
        return;
      }

      if (state !== 'play') return;

      const cfg = getLevelConfig(currentLevel);
      const basketW = cfg.basketWidth;

      // 1. Gerakkan Keranjang Pemain
      for (const b of baskets) {
        if (b.vx !== 0) {
          b.x += b.vx * BASKET_SPEED * dt;
          // Klem agar keranjang tetap sepenuhnya di dalam arena
          const halfW = basketW / 2;
          if (b.x - halfW < 0) b.x = halfW;
          if (b.x + halfW > CANVAS_WIDTH) b.x = CANVAS_WIDTH - halfW;
        }
      }

      // 2. Pemunculan Bintang
      const quota = levelQuotas[currentLevel];
      if (starsSpawnedInLevel < quota) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          spawnStar();
        }
      }

      // 3. Gerakkan Bintang & Deteksi Tangkap
      for (let i = activeStars.length - 1; i >= 0; i--) {
        const star = activeStars[i];
        star.prevY = star.y;
        star.timeAlive += dt;
        star.y += star.speed * dt;
        star.rot += STAR_ROT_SPEED * dt;

        // Gerakan Bergoyang (Sway) pada Level 3
        if (star.isSway) {
          const omega = 2 * Math.PI * L3_SWAY_FREQ_HZ;
          const swayOffset = L3_SWAY_AMPLITUDE * Math.sin(star.timeAlive * omega + star.swayPhase);
          star.x = Math.max(star.radius, Math.min(CANVAS_WIDTH - star.radius, star.baseX + swayOffset));
        }

        // Cek Apakah Bagian Bawah Bintang Menyentuh Bibir Atas Keranjang
        const bottomY = star.y + star.radius;
        const prevBottomY = star.prevY + star.radius;

        // Kondisi sentuhan: melintasi atau berada di area bibir atas keranjang
        if (bottomY >= BASKET_Y && prevBottomY <= BASKET_Y + 35) {
          // Cari semua keranjang yang memenuhi batas jangkauan horizontal
          const candidates = [];
          for (const b of baskets) {
            const dx = Math.abs(star.x - b.x);
            const maxReach = basketW / 2 + CATCH_TOLERANCE * star.radius;
            if (dx <= maxReach) {
              candidates.push({ basket: b, dist: dx });
            }
          }

          if (candidates.length > 0) {
            // Urutkan berdasarkan jarak pusat keranjang terdekat ke bintang
            candidates.sort((c1, c2) => c1.dist - c2.dist);

            let winnerBasket = candidates[0].basket;
            // Jika jarak sama persis, pilih secara acak
            if (candidates.length > 1 && Math.abs(candidates[0].dist - candidates[1].dist) < 0.001) {
              const tied = candidates.filter(c => Math.abs(c.dist - candidates[0].dist) < 0.001);
              winnerBasket = tied[Math.floor(Math.random() * tied.length)].basket;
            }

            // Tambahkan Poin dan Catat Bintang Tertangkap
            winnerBasket.score += star.points;
            winnerBasket.caught += 1;
            totalCaughtCount += 1;

            // Audio Tangkap Bintang dengan Panning Spasial
            const panVal = Math.max(-1, Math.min(1, (star.x - CANVAS_WIDTH / 2) / (CANVAS_WIDTH / 2)));
            if (star.isGold) {
              safePlay('powerup', { pan: panVal, volume: 0.6 });
            } else {
              safePlay('score', { pan: panVal, volume: 0.5 });
            }

            // Bintang berhasil ditangkap, langsung hapus
            activeStars.splice(i, 1);
            continue;
          }
        }

        // Bintang Lolos Melewati Dasar Layar
        if (star.y - star.radius > CANVAS_HEIGHT) {
          totalMissedCount += 1;
          activeStars.splice(i, 1);
          continue;
        }
      }

      // 4. Periksa Apakah Level Ini Sudah Selesai
      checkLevelCompletion();
    }

    // ── Penggambaran Grafis Kanvas ────────────────────────────────
    function render() {
      // 1. Langit Malam Bergradien
      const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      skyGrad.addColorStop(0, '#0a0e1c');
      skyGrad.addColorStop(0.65, '#12182c');
      skyGrad.addColorStop(1, '#1b223c');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 2. Bintang Latar Belakang (Statis)
      for (const s of bgStars) {
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Garis Pandu Dasar Tempat Keranjang Meluncur
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, BASKET_Y + BASKET_HEIGHT);
      ctx.lineTo(CANVAS_WIDTH, BASKET_Y + BASKET_HEIGHT);
      ctx.stroke();

      // 4. Gambar Bintang Jatuh
      for (const star of activeStars) {
        ctx.save();
        ctx.translate(star.x, star.y);
        ctx.rotate(star.rot);

        if (star.isGold) {
          // Bintang Emas: Efek Kilau Aura
          const glowGrad = ctx.createRadialGradient(0, 0, star.radius * 0.3, 0, 0, star.radius * 1.6);
          glowGrad.addColorStop(0, 'rgba(255, 225, 80, 0.85)');
          glowGrad.addColorStop(0.5, 'rgba(255, 190, 20, 0.35)');
          glowGrad.addColorStop(1, 'rgba(255, 170, 0, 0)');
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(0, 0, star.radius * 1.6, 0, Math.PI * 2);
          ctx.fill();

          // Badan Bintang Emas
          drawStarPath(ctx, 0, 0, 5, star.radius, star.radius * 0.48);
          ctx.fillStyle = '#ffea60';
          ctx.fill();
          ctx.strokeStyle = '#ff9900';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Kilau Inti Bintang Emas
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(-star.radius * 0.22, -star.radius * 0.22, star.radius * 0.18, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Bintang Biasa: Kuning Pastel Bersih
          const glowGrad = ctx.createRadialGradient(0, 0, star.radius * 0.2, 0, 0, star.radius * 1.3);
          glowGrad.addColorStop(0, 'rgba(255, 235, 130, 0.4)');
          glowGrad.addColorStop(1, 'rgba(255, 220, 100, 0)');
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(0, 0, star.radius * 1.3, 0, Math.PI * 2);
          ctx.fill();

          drawStarPath(ctx, 0, 0, 5, star.radius, star.radius * 0.48);
          ctx.fillStyle = '#fce45c';
          ctx.fill();
          ctx.strokeStyle = '#d4aa12';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        ctx.restore();
      }

      // 5. Gambar Keranjang Pemain (Trapesium dengan Label P{slot})
      const cfg = getLevelConfig(currentLevel);
      const basketW = cfg.basketWidth;
      const bottomW = basketW * BASKET_TAPER_RATIO;
      const topHalf = basketW / 2;
      const botHalf = bottomW / 2;

      for (const b of baskets) {
        ctx.save();
        ctx.translate(b.x, BASKET_Y);

        // Bentuk Trapesium Keranjang
        ctx.beginPath();
        ctx.moveTo(-topHalf, 0);
        ctx.lineTo(topHalf, 0);
        ctx.lineTo(botHalf, BASKET_HEIGHT);
        ctx.lineTo(-botHalf, BASKET_HEIGHT);
        ctx.closePath();

        // Isi Keranjang Berwarna Slot Pemain
        ctx.fillStyle = b.color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Bibir Atas Keranjang (Highlight Rim)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fillRect(-topHalf, 0, basketW, 4);

        // Label P{slot} di Tengah Keranjang
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`P${b.slot}`, 0, BASKET_HEIGHT / 2 + 2);

        ctx.restore();
      }

      // 6. HUD Atas (Di dalam Area Aman 40 px)
      renderHUD();

      // 7. Overlay State: Waiting, Countdown, Between
      if (state === 'waiting') {
        renderWaitingOverlay();
      } else if (state === 'countdown') {
        renderCountdownOverlay();
      } else if (state === 'between') {
        renderBetweenOverlay();
      }
    }

    // ── Sub-Render: HUD ───────────────────────────────────────────
    function renderHUD() {
      // Bar Latar Belakang HUD
      ctx.fillStyle = 'rgba(10, 14, 26, 0.72)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, HUD_HEIGHT);
      ctx.lineTo(CANVAS_WIDTH, HUD_HEIGHT);
      ctx.stroke();

      // Info Tengah: Level N/3 & Sisa Bintang
      const remainingTotalStars = Math.max(0, totalStars - (totalCaughtCount + totalMissedCount));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Baris Atas: Level N/3
      ctx.font = 'bold 21px sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText(`Level ${currentLevel}/3: ${getLevelConfig(currentLevel).name}`, CANVAS_WIDTH / 2, 22);

      // Baris Bawah: Sisa Bintang
      ctx.font = '15px sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`Sisa Bintang: ${remainingTotalStars}`, CANVAS_WIDTH / 2, 47);

      // Chip Skor Pemain di Sisi Kiri & Kanan (Jarak Aman >= 40 px dari Tepi)
      // Pemain diurutkan rapi agar tidak menutupi tombol panggung fullscreen/monitor
      const chipLeftX = HUD_SAFE_MARGIN_X + 60; // Jarak aman dari tombol keluar (#quit)
      const chipRightX = CANVAS_WIDTH - (HUD_SAFE_MARGIN_X + 220); // Jarak aman dari tombol kanan (#mon, #snd, #fs)

      if (baskets.length === 1) {
        // Mode 1P: Chip di Kiri
        drawPlayerChip(baskets[0], chipLeftX, 15);
      } else if (baskets.length === 2) {
        // Mode 2P: P1 di Kiri, P2 di Kanan
        drawPlayerChip(baskets[0], chipLeftX, 15);
        drawPlayerChip(baskets[1], chipRightX, 15);
      } else if (baskets.length === 4) {
        // Mode 4P: P1 & P2 di Kiri, P3 & P4 di Kanan
        drawPlayerChip(baskets[0], chipLeftX, 15);
        drawPlayerChip(baskets[1], chipLeftX + 130, 15);
        drawPlayerChip(baskets[2], chipRightX - 130, 15);
        drawPlayerChip(baskets[3], chipRightX, 15);
      }
    }

    function drawPlayerChip(b, x, y) {
      const chipW = 115;
      const chipH = 34;

      ctx.save();
      // Kotak Chip Berlatar Semi Transparan
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, chipW, chipH, 8);
      ctx.fill();
      ctx.stroke();

      // Bulatan Indikator Warna Slot
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(x + 16, y + chipH / 2, 6, 0, Math.PI * 2);
      ctx.fill();

      // Teks Label & Skor
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`P${b.slot}: ${b.score}`, x + 30, y + chipH / 2);
      ctx.restore();
    }

    // ── Sub-Render: Overlay Layar ──────────────────────────────────
    function renderWaitingOverlay() {
      ctx.fillStyle = 'rgba(8, 12, 24, 0.78)';
      ctx.fillRect(0, HUD_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - HUD_HEIGHT);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Judul Game
      ctx.font = 'bold 54px sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('⭐ TANGKAP BINTANG', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50);

      // Petunjuk Kontrol
      ctx.font = '22px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Geser keranjang ke kiri (1 / 3) atau ke kanan (2 / 4) untuk menangkap bintang', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10);

      // Petunjuk Mulai
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`Kirim 99# dari micro:bit pemain pertama (P${starterPlayer}), atau klik layar untuk mulai`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 65);
    }

    function renderCountdownOverlay() {
      ctx.fillStyle = 'rgba(8, 12, 24, 0.65)';
      ctx.fillRect(0, HUD_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - HUD_HEIGHT);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 120px sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText(String(countdownVal), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }

    function renderBetweenOverlay() {
      ctx.fillStyle = 'rgba(8, 12, 24, 0.85)';
      ctx.fillRect(0, HUD_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - HUD_HEIGHT);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const nextLevel = currentLevel + 1;
      const nextCfg = getLevelConfig(nextLevel);

      // Judul Level Berikutnya
      ctx.font = 'bold 44px sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText(`Level ${nextLevel}: ${nextCfg.name}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);

      // Skor Sementara
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = '#ffffff';
      const scoreStr = baskets.map(b => `P${b.slot}: ${b.score} poin`).join('   |   ');
      ctx.fillText(`Skor Sementara: ${scoreStr}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);

      // Teks Bersiap
      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Bersiap! Bintang akan jatuh lebih cepat...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 70);
    }

    // ── Main Game Loop ────────────────────────────────────────────
    function loop(now) {
      if (isStopped) return;
      const dt = Math.min((now - lastTime) / 1000, MAX_DT);
      lastTime = now;

      update(dt);
      render();

      frameId = requestAnimationFrame(loop);
    }

    // ── Penanganan Masukan (Kernel & Canvas) ───────────────────────
    function onInput({ player, cmd }) {
      if (isStopped) return;

      // 1. Perintah Mulai 99#
      if (cmd === '99') {
        if (state === 'waiting' && player === starterPlayer) {
          triggerStart();
        }
        return;
      }

      // Bila game belum aktif berjalan, abaikan perintah gerak
      if (state !== 'play') return;

      const basket = slotToBasket[player];
      if (!basket) return;

      // 2. Perintah Gerak: '1' atau '3' = kiri; '2' atau '4' = kanan; '0' = berhenti
      if (cmd === '1' || cmd === '3') {
        basket.vx = -1;
      } else if (cmd === '2' || cmd === '4') {
        basket.vx = 1;
      } else if (cmd === '0') {
        basket.vx = 0;
      }
      // Perintah lain diabaikan
    }

    function onCanvasClick() {
      if (state === 'waiting') {
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
        isStopped = true;
        if (frameId) cancelAnimationFrame(frameId);
        for (const tid of timeouts) clearTimeout(tid);
        timeouts.length = 0;
        offInput();
        canvas.removeEventListener('click', onCanvasClick);
      }
    };
  }
};

