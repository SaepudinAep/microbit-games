// GAME: Sumo Arena (games/sumoarena.js)
// Dorong lawanmu keluar dari panggung sebelum kamu yang terdorong!
// Mendukung 2 dan 4 pemain di kanvas standar 1280x720.

'use strict';

// ═══════════════════════════════════════════════════════════════════
//  KONSTANTA PERMAINAN
// ═══════════════════════════════════════════════════════════════════

const CANVAS_WIDTH       = 1280;
const CANVAS_HEIGHT      = 720;
const COUNTDOWN_SEC      = 3;
const MAX_DT             = 0.05;   // Batas dt maksimal per frame

// Area HUD & Safe Margin
const HUD_HEIGHT         = 64;
const HUD_SAFE_MARGIN_X  = 40;

// Arena Panggung Bundar
const ARENA_CX           = 640;
const ARENA_CY           = 400;
const ARENA_R0           = 280;    // Radius awal panggung
const ARENA_R_MIN        = 45;     // Radius minimum panggung
const SHRINK_DELAY       = 8.0;    // Detik mulai mengecil
const ROUND_MAX_SEC      = 60.0;   // Durasi maksimum satu ronde
const SPAWN_DIST         = 150;    // Jarak awal bola dari pusat

// Bola & Fisika
const BALL_R             = 28;     // Radius bola sumo
const ACCEL              = 900;    // Percepatan dorongan px/dtk²
const FRICTION           = 3.0;    // Koefisien gesekan eksponensial
const MAX_SPEED          = 420;    // Kecepatan normal maksimal px/dtk
const RESTITUTION        = 0.9;    // Koefisien elastisitas tabrakan
const FALL_TIME          = 0.6;    // Durasi animasi jatuh saat tersingkir

// Kemampuan Dash ('5')
const DASH_SPEED         = 700;    // Kecepatan dorongan kuat px/dtk
const DASH_TIME          = 0.18;   // Durasi dash aktif (detik)
const DASH_COOLDOWN      = 2.5;    // Cooldown dash (detik)
const DASH_MASS          = 2.0;    // Massa saat dash (normal = 1.0)

// Ronde & Hasil
const TOTAL_ROUNDS       = 3;
const ROUND_END_DELAY    = 2.5;    // Jeda banner antar ronde (detik)
const FINISH_DELAY_MS    = 600;    // Jeda sebelum panggil finish()

// Warna Pemain Resmi Berdasarkan Nomor Slot Controller
const SLOT_COLORS = {
  1: '#4b83ff',
  2: '#ff9a2e',
  3: '#3ccf8e',
  4: '#b98cff'
};

// ═══════════════════════════════════════════════════════════════════
//  EKSPOR UTAMA MODUL GAME
// ═══════════════════════════════════════════════════════════════════

export default {
  id: 'sumoarena',
  name: 'Sumo Arena',
  icon: '🥋',
  description: 'Dorong lawanmu keluar dari panggung sebelum kamu yang terdorong! Bertahan hingga akhir.',
  modes: [
    { id: '2p', label: '2 Player', sub: 'Adu dorong', players: 2 },
    { id: '4p', label: '4 Player', sub: 'Sumo berempat', players: 4 }
  ],
  canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },

  create({ canvas, kernel, players, mode, finish, audio }) {
    const ctx = canvas.getContext('2d');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Pelacak Siklus Hidup & Animasi
    let frameId = null;
    const timeouts = [];
    let lastTime = performance.now();
    let isStopped = false;

    // Pemain Pertama sebagai Pemantik Mulai ('99')
    const starterPlayer = players[0];

    // Status Game: 'waiting' | 'countdown' | 'play' | 'roundEnd' | 'over'
    let state = 'waiting';
    let countdownVal = COUNTDOWN_SEC;
    let countdownTimer = 0;
    let roundEndTimer = 0;
    let shrinkSoundPlayed = false;

    // Ronde & Akumulasi Skor
    let currentRound = 1;
    let isTieBreak = false;
    let roundElapsed = 0;
    let roundBannerText = '';

    // Skor Total Berdasarkan Nomor Slot Controller
    const totalScores = {};
    for (const p of players) totalScores[p] = 0;

    // Pemain yang Berpartisipasi pada Ronde Ini
    let activeRoundSlots = [...players];
    let balls = [];

    // ── Suara Aman ────────────────────────────────────────────────
    function safePlay(name, opts) {
      if (audio && typeof audio.play === 'function') {
        try {
          audio.play(name, opts);
        } catch (_) {}
      }
    }

    // ── Inisialisasi Posisi Ronde ──────────────────────────────────
    function initRound(roundSlots) {
      activeRoundSlots = [...roundSlots];
      roundElapsed = 0;
      shrinkSoundPlayed = false;

      const n = activeRoundSlots.length;
      balls = activeRoundSlots.map((slotNum, idx) => {
        let spawnAngle = 0;
        if (n === 2) {
          // 2 pemain: indeks 0 di kiri (180° = Math.PI), indeks 1 di kanan (0° = 0)
          spawnAngle = idx === 0 ? Math.PI : 0;
        } else if (n === 4) {
          // 4 pemain: indeks 0 kiri, 1 kanan, 2 atas, 3 bawah
          const angles = [Math.PI, 0, -Math.PI / 2, Math.PI / 2];
          spawnAngle = angles[idx];
        } else {
          // n pemain lain (misal tie-break 3 pemain): merata
          spawnAngle = (idx * 2 * Math.PI) / n + Math.PI;
        }

        const startX = ARENA_CX + Math.cos(spawnAngle) * SPAWN_DIST;
        const startY = ARENA_CY + Math.sin(spawnAngle) * SPAWN_DIST;

        // Vektor hadap awal: menghadap ke pusat panggung (ARENA_CX, ARENA_CY)
        const toCenterDist = Math.hypot(ARENA_CX - startX, ARENA_CY - startY) || 1;
        const initFacingX = (ARENA_CX - startX) / toCenterDist;
        const initFacingY = (ARENA_CY - startY) / toCenterDist;

        return {
          slot: slotNum,
          color: SLOT_COLORS[slotNum] || '#ffffff',
          x: startX,
          y: startY,
          vx: 0,
          vy: 0,
          pushDx: 0,
          pushDy: 0,
          facingX: initFacingX,
          facingY: initFacingY,
          mass: 1.0,
          dashCooldown: 0,
          dashTimer: 0,
          state: 'alive', // 'alive' | 'falling' | 'dead'
          fallTimer: 0,
          fallRot: 0,
          fallScale: 1.0,
          eliminatedOrder: -1,
          eliminatedTime: -1
        };
      });
    }

    // Hitung Radius Panggung Saat Ini
    function getCurrentArenaRadius(elapsed) {
      if (elapsed < SHRINK_DELAY) return ARENA_R0;
      const progress = Math.min(1.0, (elapsed - SHRINK_DELAY) / (ROUND_MAX_SEC - SHRINK_DELAY));
      return ARENA_R0 - progress * (ARENA_R0 - ARENA_R_MIN);
    }

    // ── Alur Transisi State ───────────────────────────────────────
    function triggerStart() {
      if (state !== 'waiting') return;
      state = 'countdown';
      countdownVal = COUNTDOWN_SEC;
      countdownTimer = 0;
      safePlay('click');
    }

    function beginRound() {
      state = 'play';
      roundElapsed = 0;
      safePlay('start');
    }

    function endRound() {
      state = 'roundEnd';
      roundEndTimer = ROUND_END_DELAY;
      safePlay('score');

      // Tentukan Skor dan Peringkat Ronde
      // Urutan tersingkir: yang bertahan paling lama (atau alive) mendapat poin terbesar
      const n = balls.length;

      // Kelompokkan bola berdasarkan waktu/urutan tersingkir
      // Bola yang masih 'alive' berada di kelompok tertinggi
      const aliveList = balls.filter(b => b.state === 'alive');
      const eliminatedList = balls.filter(b => b.state !== 'alive');

      // Urutkan eliminatedList berdasarkan waktu eliminasi dari pertama gugur ke terakhir gugur
      eliminatedList.sort((a, b) => a.eliminatedTime - b.eliminatedTime);

      // Kelompokkan yang gugur pada waktu yang berdekatan (frame yang sama)
      const rankedGroups = [];
      let currentGroup = [];
      let lastTimeVal = -999;

      for (const b of eliminatedList) {
        if (Math.abs(b.eliminatedTime - lastTimeVal) <= 0.05) {
          currentGroup.push(b);
        } else {
          if (currentGroup.length > 0) rankedGroups.push(currentGroup);
          currentGroup = [b];
          lastTimeVal = b.eliminatedTime;
        }
      }
      if (currentGroup.length > 0) rankedGroups.push(currentGroup);

      // Tambahkan kelompok alive di puncak
      if (aliveList.length > 0) {
        rankedGroups.push(aliveList);
      }

      // Distribusikan poin dari peringkat 0 hingga n - 1
      let currentRankIdx = 0;
      for (const group of rankedGroups) {
        const groupSize = group.length;
        // Peringkat yang dicakup kelompok ini: currentRankIdx s.d. currentRankIdx + groupSize - 1
        let rankSum = 0;
        for (let r = currentRankIdx; r < currentRankIdx + groupSize; r++) {
          rankSum += r;
        }
        const avgPoints = Math.floor(rankSum / groupSize);
        for (const b of group) {
          totalScores[b.slot] += avgPoints;
        }
        currentRankIdx += groupSize;
      }

      // Banner Ronde
      if (aliveList.length === 1) {
        roundBannerText = `Player ${aliveList[0].slot} Bertahan Terakhir! 🏆`;
      } else if (aliveList.length > 1) {
        const slotsStr = aliveList.map(b => `P${b.slot}`).join(' & ');
        roundBannerText = `Waktu Habis! ${slotsStr} Bertahan Bersama!`;
      } else {
        roundBannerText = 'Semua Terjatuh Bersama!';
      }
    }

    function checkRoundEnd() {
      const aliveCount = balls.filter(b => b.state === 'alive').length;
      if (aliveCount <= 1 || roundElapsed >= ROUND_MAX_SEC) {
        endRound();
      }
    }

    function advanceToNextRoundOrFinish() {
      if (!isTieBreak && currentRound < TOTAL_ROUNDS) {
        // Lanjut ke Ronde Normal Berikutnya
        currentRound++;
        initRound(players);
        state = 'countdown';
        countdownVal = COUNTDOWN_SEC;
        countdownTimer = 0;
        safePlay('click');
      } else {
        // Cek Peringkat Akhir (apakah perlu ronde penentu / tie-break)
        const sortedSlots = [...players].sort((a, b) => a - b);
        const maxScore = Math.max(...sortedSlots.map(s => totalScores[s]));
        const topScorers = sortedSlots.filter(s => totalScores[s] === maxScore);

        if (!isTieBreak && topScorers.length > 1) {
          // Mulai Ronde Penentu hanya untuk pemain yang seri di puncak!
          isTieBreak = true;
          initRound(topScorers);
          state = 'countdown';
          countdownVal = COUNTDOWN_SEC;
          countdownTimer = 0;
          safePlay('click');
        } else {
          // Permainan Selesai Total
          handleGameOver(topScorers, maxScore);
        }
      }
    }

    function handleGameOver(topScorers, maxScore) {
      if (state === 'over') return;
      state = 'over';
      safePlay('win');

      const sortedSlots = [...players].sort((a, b) => a - b);
      const scoreDetails = sortedSlots.map(s => `P${s} ${totalScores[s]}`).join(', ');

      let resultText = '';
      if (topScorers.length === 1) {
        resultText = `P${topScorers[0]} juara! ${scoreDetails}`;
      } else {
        let tieStr = '';
        if (topScorers.length === 2) {
          tieStr = `P${topScorers[0]} dan P${topScorers[1]}`;
        } else {
          tieStr = topScorers.slice(0, -1).map(s => `P${s}`).join(', ') + ' dan P' + topScorers[topScorers.length - 1];
        }
        resultText = `Seri antara ${tieStr}! ${scoreDetails}`;
      }

      // Jeda 600 ms sebelum panggil finish()
      const tid = setTimeout(() => {
        if (!isStopped && typeof finish === 'function') {
          finish(resultText);
        }
      }, FINISH_DELAY_MS);
      timeouts.push(tid);
    }

    // Inisialisasi Ronde Pertama
    initRound(players);

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
            beginRound();
          }
        }
        return;
      }

      if (state === 'roundEnd') {
        roundEndTimer -= dt;
        if (roundEndTimer <= 0) {
          advanceToNextRoundOrFinish();
        }
        return;
      }

      if (state !== 'play') return;

      roundElapsed += dt;

      // Peringatan Suara Saat Panggung Mulai Mengecil di Detik ke-8
      if (roundElapsed >= SHRINK_DELAY && !shrinkSoundPlayed) {
        shrinkSoundPlayed = true;
        safePlay('bounce');
      }

      const currentArenaR = getCurrentArenaRadius(roundElapsed);

      // Sub-langkah Integrasi Fisika (Maksimal 1/120 detik per sub-langkah)
      const substeps = Math.ceil(dt / (1 / 120));
      const dtSub = dt / substeps;

      for (let s = 0; s < substeps; s++) {
        // 1. Update Pergerakan & Dash Tiap Bola
        for (const b of balls) {
          if (b.state === 'alive') {
            // Update Cooldown Dash
            if (b.dashCooldown > 0) {
              b.dashCooldown = Math.max(0, b.dashCooldown - dtSub);
            }

            // Update Status Dash
            let fric = FRICTION;
            if (b.dashTimer > 0) {
              b.dashTimer -= dtSub;
              b.mass = DASH_MASS;
              fric = FRICTION * 0.5; // Gesekan berkurang saat dash
            } else {
              b.mass = 1.0;
            }

            // Percepatan Dorongan
            if (b.pushDx !== 0 || b.pushDy !== 0) {
              const pushLen = Math.hypot(b.pushDx, b.pushDy) || 1;
              const pushNormX = b.pushDx / pushLen;
              const pushNormY = b.pushDy / pushLen;

              b.vx += pushNormX * ACCEL * dtSub;
              b.vy += pushNormY * ACCEL * dtSub;

              // Arah hadap mengikuti arah dorongan aktif
              b.facingX = pushNormX;
              b.facingY = pushNormY;
            }

            // Batas Kecepatan Maksimal (Bila tidak sedang dash)
            if (b.dashTimer <= 0) {
              const spd = Math.hypot(b.vx, b.vy);
              if (spd > MAX_SPEED) {
                b.vx = (b.vx / spd) * MAX_SPEED;
                b.vy = (b.vy / spd) * MAX_SPEED;
              }
            }

            // Gesekan Eksponensial
            const frictionMul = Math.exp(-fric * dtSub);
            b.vx *= frictionMul;
            b.vy *= frictionMul;

            // Integrasi Posisi
            b.x += b.vx * dtSub;
            b.y += b.vy * dtSub;

            // Cek Tersingkir: Jarak PUSAT bola ke pusat panggung > radius panggung
            const distToCenter = Math.hypot(b.x - ARENA_CX, b.y - ARENA_CY);
            if (distToCenter > currentArenaR) {
              b.state = 'falling';
              b.fallTimer = FALL_TIME;
              b.fallRot = 0;
              b.fallScale = 1.0;
              b.eliminatedTime = roundElapsed;

              const pan = Math.max(-1, Math.min(1, (b.x - ARENA_CX) / ARENA_CX));
              safePlay('lose', { pan });
            }
          } else if (b.state === 'falling') {
            // Bola Terus Meluncur Saat Jatuh
            b.x += b.vx * dtSub;
            b.y += b.vy * dtSub;
            b.fallTimer -= dtSub;
            b.fallRot += 10.0 * dtSub;
            b.fallScale = Math.max(0, b.fallTimer / FALL_TIME);

            if (b.fallTimer <= 0) {
              b.state = 'dead';
            }
          }
        }

        // 2. Tabrakan Antar Bola (Hanya yang Masih di Panggung)
        for (let i = 0; i < balls.length; i++) {
          const b1 = balls[i];
          if (b1.state !== 'alive') continue;

          for (let j = i + 1; j < balls.length; j++) {
            const b2 = balls[j];
            if (b2.state !== 'alive') continue;

            const dx = b2.x - b1.x;
            const dy = b2.y - b1.y;
            const dist = Math.hypot(dx, dy);
            const minDist = 2 * BALL_R;

            if (dist < minDist && dist > 0.001) {
              const nx = dx / dist;
              const ny = dy / dist;
              const overlap = minDist - dist;

              // Pisahkan Tumpang Tindih Sebanding Kebalikan Massa
              const invM1 = 1 / b1.mass;
              const invM2 = 1 / b2.mass;
              const sumInvM = invM1 + invM2;

              b1.x -= nx * overlap * (invM1 / sumInvM);
              b1.y -= ny * overlap * (invM1 / sumInvM);
              b2.x += nx * overlap * (invM2 / sumInvM);
              b2.y += ny * overlap * (invM2 / sumInvM);

              // Kecepatan Relatif Sepanjang Garis Normal
              const rvx = b2.vx - b1.vx;
              const rvy = b2.vy - b1.vy;
              const velAlongNormal = rvx * nx + rvy * ny;

              // Hanya pantulkan bila kedua bola saling mendekat
              if (velAlongNormal < 0) {
                const impulse = -((1 + RESTITUTION) * velAlongNormal) / sumInvM;
                b1.vx -= (impulse * invM1) * nx;
                b1.vy -= (impulse * invM1) * ny;
                b2.vx += (impulse * invM2) * nx;
                b2.vy += (impulse * invM2) * ny;

                // Efek Suara Tabrakan
                const relSpd = Math.abs(velAlongNormal);
                const vol = Math.min(1.0, Math.max(0.15, relSpd / 500));
                const hitPan = Math.max(-1, Math.min(1, ((b1.x + b2.x) / 2 - ARENA_CX) / ARENA_CX));
                safePlay('hit', { pan: hitPan, volume: vol });
              }
            }
          }
        }
      }

      // 3. Periksa Selesainya Ronde
      checkRoundEnd();
    }

    // ── Penggambaran Grafis Kanvas ────────────────────────────────
    function render() {
      // 1. Jurang / Kolam Gelap Bergradien
      const bgGrad = ctx.createRadialGradient(ARENA_CX, ARENA_CY, 80, ARENA_CX, ARENA_CY, 680);
      bgGrad.addColorStop(0, '#0c1322');
      bgGrad.addColorStop(0.6, '#060a14');
      bgGrad.addColorStop(1, '#020408');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Cincin Hiasan Gelombang di Jurang Luar
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1.5;
      for (let r = 320; r <= 560; r += 60) {
        ctx.beginPath();
        ctx.arc(ARENA_CX, ARENA_CY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 2. Panggung Bundar (Dohyo Arena)
      const currentR = getCurrentArenaRadius(roundElapsed);
      const shrinkProgress = Math.min(1.0, Math.max(0, (roundElapsed - SHRINK_DELAY) / (ROUND_MAX_SEC - SHRINK_DELAY)));

      // Warna Tepi Panggung: Dari Krem/Putih (#f1f5f9) ke Merah Membara (#ef4444)
      const rimR = Math.round(241 + (239 - 241) * shrinkProgress);
      const rimG = Math.round(245 + (68 - 245) * shrinkProgress);
      const rimB = Math.round(249 + (68 - 249) * shrinkProgress);
      const rimColor = `rgb(${rimR},${rimG},${rimB})`;

      // Bayangan Panggung
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.beginPath();
      ctx.arc(ARENA_CX, ARENA_CY + 8, currentR + 4, 0, Math.PI * 2);
      ctx.fill();

      // Permukaan Panggung (Tatami Light Wood/Sand Gradien)
      const arenaGrad = ctx.createRadialGradient(ARENA_CX, ARENA_CY - currentR * 0.2, currentR * 0.1, ARENA_CX, ARENA_CY, currentR);
      arenaGrad.addColorStop(0, '#e8dcbe');
      arenaGrad.addColorStop(0.75, '#cbb892');
      arenaGrad.addColorStop(1, '#a69065');
      ctx.fillStyle = arenaGrad;
      ctx.beginPath();
      ctx.arc(ARENA_CX, ARENA_CY, currentR, 0, Math.PI * 2);
      ctx.fill();

      // Lingkaran Hiasan Dalam Panggung (Dohyo Inner Ring)
      if (currentR > 80) {
        ctx.strokeStyle = 'rgba(120, 95, 60, 0.35)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ARENA_CX, ARENA_CY, currentR * 0.72, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Tepi Luar Panggung (Border Rim)
      ctx.strokeStyle = rimColor;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(ARENA_CX, ARENA_CY, currentR, 0, Math.PI * 2);
      ctx.stroke();

      // Efek Cahaya Tepi Saat Menyusut Cepat
      if (shrinkProgress > 0.3) {
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 12 * shrinkProgress;
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ARENA_CX, ARENA_CY, currentR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.restore();

      // 3. Peringatan Panggung Mengecil (Detik ke-8 s.d. 11.5)
      if (roundElapsed >= SHRINK_DELAY && roundElapsed <= SHRINK_DELAY + 3.5) {
        if (Math.floor(roundElapsed * 4) % 2 === 0) {
          ctx.save();
          ctx.font = 'bold 26px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ef4444';
          ctx.fillText('⚠️ PANGGUNG MENGECIL! ⚠️', ARENA_CX, 180);
          ctx.restore();
        }
      }

      // 4. Gambar Bola Sumo
      for (const b of balls) {
        if (b.state === 'dead') continue;

        ctx.save();
        ctx.translate(b.x, b.y);

        if (b.state === 'falling') {
          ctx.rotate(b.fallRot);
          ctx.scale(b.fallScale, b.fallScale);
        }

        // Bayangan Bola di Bawah
        ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
        ctx.beginPath();
        ctx.ellipse(0, BALL_R * 0.75, BALL_R * 0.9, BALL_R * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        // Efek Aura Dash Saat Aktif
        if (b.dashTimer > 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.beginPath();
          ctx.arc(0, 0, BALL_R + 8, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // Badan Bola Sumo Berwarna Slot Pemain
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
        ctx.fill();

        // Border Lingkaran Bola
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Cincin Cooldown Dash Tipis di Sekeliling Bola
        if (b.state === 'alive') {
          const cdRatio = 1 - Math.max(0, b.dashCooldown / DASH_COOLDOWN);
          ctx.strokeStyle = cdRatio >= 1.0 ? '#38bdf8' : 'rgba(255, 255, 255, 0.28)';
          ctx.lineWidth = cdRatio >= 1.0 ? 3 : 2;
          ctx.beginPath();
          ctx.arc(0, 0, BALL_R + 4, -Math.PI / 2, -Math.PI / 2 + cdRatio * Math.PI * 2);
          ctx.stroke();
        }

        // Mata Bola Menghadap Arah Hadap
        const faceAngle = Math.atan2(b.facingY, b.facingX);
        const eyeOffsetDist = BALL_R * 0.55;
        const eyeSpread = 0.45; // Radian jarak antar dua mata
        const eyeR = 4.5;
        const pupilR = 2.2;

        const leftEyeX = Math.cos(faceAngle - eyeSpread) * eyeOffsetDist;
        const leftEyeY = Math.sin(faceAngle - eyeSpread) * eyeOffsetDist;
        const rightEyeX = Math.cos(faceAngle + eyeSpread) * eyeOffsetDist;
        const rightEyeY = Math.sin(faceAngle + eyeSpread) * eyeOffsetDist;

        // Bagian Putih Mata
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(leftEyeX, leftEyeY, eyeR, 0, Math.PI * 2);
        ctx.arc(rightEyeX, rightEyeY, eyeR, 0, Math.PI * 2);
        ctx.fill();

        // Pupil Hitam Menatap Arah Depan
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(leftEyeX + b.facingX * 1.5, leftEyeY + b.facingY * 1.5, pupilR, 0, Math.PI * 2);
        ctx.arc(rightEyeX + b.facingX * 1.5, rightEyeY + b.facingY * 1.5, pupilR, 0, Math.PI * 2);
        ctx.fill();

        // Label P{slot} di Tengah Bola
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`P${b.slot}`, 0, 0);

        ctx.restore();
      }

      // 5. HUD Atas (Di dalam Area Aman 40 px)
      renderHUD();

      // 6. Overlay State: Waiting, Countdown, RoundEnd
      if (state === 'waiting') {
        renderWaitingOverlay();
      } else if (state === 'countdown') {
        renderCountdownOverlay();
      } else if (state === 'roundEnd') {
        renderRoundEndOverlay();
      }
    }

    // ── Sub-Render: HUD ───────────────────────────────────────────
    function renderHUD() {
      // Bar Latar Belakang HUD
      ctx.fillStyle = 'rgba(8, 12, 22, 0.78)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, HUD_HEIGHT);
      ctx.lineTo(CANVAS_WIDTH, HUD_HEIGHT);
      ctx.stroke();

      // Info Tengah: Ronde & Timer
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const roundTitle = isTieBreak ? 'Ronde Penentu (Sudden Death)' : `Ronde ${currentRound}/${TOTAL_ROUNDS}`;
      ctx.font = 'bold 21px sans-serif';
      ctx.fillStyle = isTieBreak ? '#f43f5e' : '#ffd700';
      ctx.fillText(roundTitle, CANVAS_WIDTH / 2, 22);

      const secRemain = Math.max(0, Math.ceil(ROUND_MAX_SEC - roundElapsed));
      ctx.font = '15px sans-serif';
      ctx.fillStyle = secRemain <= 10 ? '#ef4444' : '#cbd5e1';
      ctx.fillText(`Waktu Ronde: ${secRemain}s`, CANVAS_WIDTH / 2, 47);

      // Chip Skor Tiap Pemain (Jarak Aman >= 40 px dari Tepi)
      const chipLeftX = HUD_SAFE_MARGIN_X + 60; // Aman dari tombol keluar (#quit)
      const chipRightX = CANVAS_WIDTH - (HUD_SAFE_MARGIN_X + 220); // Aman dari tombol kanan (#mon, #snd, #fs)

      if (players.length === 2) {
        drawPlayerChip(players[0], chipLeftX, 15);
        drawPlayerChip(players[1], chipRightX, 15);
      } else if (players.length === 4) {
        drawPlayerChip(players[0], chipLeftX, 15);
        drawPlayerChip(players[1], chipLeftX + 130, 15);
        drawPlayerChip(players[2], chipRightX - 130, 15);
        drawPlayerChip(players[3], chipRightX, 15);
      }
    }

    function drawPlayerChip(slotNum, x, y) {
      const chipW = 115;
      const chipH = 34;
      const b = balls.find(ball => ball.slot === slotNum);
      const isAlive = b ? b.state === 'alive' : false;
      const color = SLOT_COLORS[slotNum] || '#ffffff';

      ctx.save();
      ctx.globalAlpha = isAlive ? 1.0 : 0.4;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, chipW, chipH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + 16, y + chipH / 2, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`P${slotNum}: ${totalScores[slotNum]} pts`, x + 28, y + chipH / 2);

      ctx.restore();
    }

    // ── Sub-Render: Overlay Layar ──────────────────────────────────
    function renderWaitingOverlay() {
      ctx.fillStyle = 'rgba(6, 10, 20, 0.82)';
      ctx.fillRect(0, HUD_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - HUD_HEIGHT);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Judul Game
      ctx.font = 'bold 54px sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('🥋 SUMO ARENA', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);

      // Petunjuk Kontrol
      ctx.font = '21px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Dorong lawanmu keluar panggung! Tekan 1/2/3/4 untuk arah dorong, 5 untuk Dash', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 5);

      // Petunjuk Mulai
      ctx.font = 'bold 23px sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`Kirim 99# dari micro:bit pemain pertama (P${starterPlayer}), atau klik layar untuk mulai`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 65);
    }

    function renderCountdownOverlay() {
      ctx.fillStyle = 'rgba(6, 10, 20, 0.65)';
      ctx.fillRect(0, HUD_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - HUD_HEIGHT);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 120px sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText(String(countdownVal), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }

    function renderRoundEndOverlay() {
      ctx.fillStyle = 'rgba(6, 10, 20, 0.86)';
      ctx.fillRect(0, HUD_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - HUD_HEIGHT);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Judul Hasil Ronde
      ctx.font = 'bold 44px sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText(roundBannerText, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);

      // Skor Sementara
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = '#ffffff';
      const sortedSlots = [...players].sort((a, b) => a - b);
      const scoreStr = sortedSlots.map(s => `P${s}: ${totalScores[s]} poin`).join('   |   ');
      ctx.fillText(`Skor Sementara: ${scoreStr}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);

      // Teks Bersiap
      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Bersiap untuk ronde berikutnya...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 70);
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

      const b = balls.find(ball => ball.slot === player);
      if (!b || b.state !== 'alive') return;

      // 2. Perintah Arah Dorong:
      // '1' = atas, '2' = bawah, '3' = kiri, '4' = kanan, '0' = berhenti dorong
      if (cmd === '1') {
        b.pushDx = 0;
        b.pushDy = -1;
      } else if (cmd === '2') {
        b.pushDx = 0;
        b.pushDy = 1;
      } else if (cmd === '3') {
        b.pushDx = -1;
        b.pushDy = 0;
      } else if (cmd === '4') {
        b.pushDx = 1;
        b.pushDy = 0;
      } else if (cmd === '0') {
        b.pushDx = 0;
        b.pushDy = 0;
      } else if (cmd === '5') {
        // 3. Perintah Dash '5' (Dorongan Kuat)
        if (b.dashCooldown <= 0) {
          b.dashCooldown = DASH_COOLDOWN;
          b.dashTimer = DASH_TIME;

          // Set kecepatan searah hadap bila saat ini lebih kecil dari DASH_SPEED
          const dot = b.vx * b.facingX + b.vy * b.facingY;
          if (dot < DASH_SPEED) {
            b.vx = b.facingX * DASH_SPEED;
            b.vy = b.facingY * DASH_SPEED;
          }

          const pan = Math.max(-1, Math.min(1, (b.x - ARENA_CX) / ARENA_CX));
          safePlay('shoot', { pan });
        }
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

