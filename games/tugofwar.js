// GAME: Tarik Tambang (games/tugofwar.js)
// Tarik tali sekuat dan sekompak mungkin untuk menyeret tim lawan!
// Mendukung 2 dan 4 pemain di kanvas standar 1280x720.

'use strict';

// ═══════════════════════════════════════════════════════════════════
//  KONSTANTA PERMAINAN
// ═══════════════════════════════════════════════════════════════════

const CANVAS_WIDTH            = 1280;
const CANVAS_HEIGHT           = 720;
const SAFE_MARGIN             = 40;

// Alur & Ronde
const COUNTDOWN_SEC           = 3;
const ROUNDS_TO_WIN           = 2;
const MAX_ROUNDS              = 3;
const ROUND_MAX_SEC           = 45;
const ROUND_END_DELAY         = 2.5;     // Detik jeda banner akhir ronde
const FINISH_DELAY_MS         = 600;     // Jeda sebelum panggil finish()

// Mekanika Tali & Fisika
const PULL_MAX_PER_SEC        = 8;       // Batas maksimal tarikan per detik
const PULL_MIN_INTERVAL       = 1.0 / PULL_MAX_PER_SEC; // 0.125 dtk (125 ms)
const PULL_IMPULSE            = 0.12;    // Tambahan kecepatan per tarikan
const ROPE_DRAG               = 2.0;     // Redaman eksponensial tali
const ROPE_RANGE              = 420;     // Jarak piksel dari tengah (x=640) ke garis menang
const ROPE_Y                  = 420;     // Posisi vertikal tali
const ROPE_LEFT               = 160;     // Ujung kiri tali
const ROPE_RIGHT              = 1120;    // Ujung kanan tali
const WIN_LINE_LEFT           = 220;     // 640 - 420
const WIN_LINE_RIGHT          = 1060;    // 640 + 420
const SUDDEN_DEATH_THRESHOLD  = 0.02;    // Ambang batas penentu saat sudden death
const MAX_DT                  = 0.05;    // Pembatas dt per frame
const SUB_DT                  = 1 / 120; // Batas sub-langkah integrasi

// Bonus Kompak (Khusus 4 Pemain)
const TEAM_SYNC_MS            = 200;     // Jendela toleransi kekompakan (0.2 dtk)
const SYNC_MULTIPLIER         = 1.5;     // Pengali impuls tarikan kompak

// Posisi Karakter Pemain Relatif terhadap Bendera Tali
const DIST_2P                 = 180;
const DIST_4P_FRONT           = 130;
const DIST_4P_BACK            = 230;

// Warna Tim Netral
const TEAM_COLOR_LEFT         = '#e53935'; // Merah
const TEAM_COLOR_RIGHT        = '#fdd835'; // Kuning

// Warna Pemain Resmi Berdasarkan Nomor Slot Controller
const SLOT_COLORS = {
  1: '#4b83ff', // Biru
  2: '#ff9a2e', // Oranye
  3: '#3ccf8e', // Hijau
  4: '#b98cff'  // Ungu
};

// ═══════════════════════════════════════════════════════════════════
//  EKSPOR UTAMA MODUL GAME
// ═══════════════════════════════════════════════════════════════════

export default {
  id: 'tugofwar',
  name: 'Tarik Tambang',
  icon: '🪢',
  description: 'Tarik tali sekuat dan sekompak mungkin untuk menyeret tim lawan! Kunci kemenangan ada pada koordinasi.',
  modes: [
    { id: '2p', label: '2 Player', sub: 'Satu lawan satu', players: 2 },
    { id: '4p', label: '4 Player', sub: 'Dua lawan dua',   players: 4 }
  ],
  canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },

  create({ canvas, kernel, players, mode, finish, audio }) {
    const ctx = canvas.getContext('2d');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const numP = players.length;
    const starterPlayer = players[0]; // Hanya players[0] yang boleh '99'

    // =====================================================
    // Pemetaan Tim & Inisialisasi Pemain
    // Tim Kiri: 2P -> [players[0]], 4P -> [players[0], players[1]]
    // Tim Kanan: 2P -> [players[1]], 4P -> [players[2], players[3]]
    // =====================================================
    const playerMap = {};
    const playerList = players.map((slot, idx) => {
      const isLeft = (numP === 2) ? (idx === 0) : (idx < 2);
      const teamId = isLeft ? 'left' : 'right';

      // Jarak relatif terhadap bendera tali
      let offset = 0;
      if (numP === 2) {
        offset = isLeft ? -DIST_2P : DIST_2P;
      } else {
        if (idx === 0) offset = -DIST_4P_BACK;
        else if (idx === 1) offset = -DIST_4P_FRONT;
        else if (idx === 2) offset = DIST_4P_FRONT;
        else if (idx === 3) offset = DIST_4P_BACK;
      }

      // Cari rekan setim (khusus 4P)
      let teammateSlot = null;
      if (numP === 4) {
        if (idx === 0) teammateSlot = players[1];
        else if (idx === 1) teammateSlot = players[0];
        else if (idx === 2) teammateSlot = players[3];
        else if (idx === 3) teammateSlot = players[2];
      }

      const pData = {
        slot,
        idx,
        isLeft,
        teamId,
        offset,
        teammateSlot,
        color: SLOT_COLORS[slot] || '#ffffff',
        label: `P${slot}`,
        lastPullTime: -999,
        lastPullPaired: false,
        pullCount: 0,
        pullAnim: 0, // Animasi ayunan mundur saat menarik
        dustList: []
      };
      playerMap[slot] = pData;
      return pData;
    });

    // =====================================================
    // State Game & Variabel Fisika
    // =====================================================
    let state = 'waiting'; // 'waiting' | 'countdown' | 'play' | 'roundEnd' | 'over'
    let currentRound = 1;
    let scoreLeft = 0;
    let scoreRight = 0;

    let ropeX = 0; // Rentang [-1, 1], negatif = ke kiri, positif = ke kanan
    let ropeV = 0; // Kecepatan geser tali

    let countdownTimer = COUNTDOWN_SEC;
    let lastCountdownDigit = null;
    let tarikBannerTimer = 0; // Durasi teks "TARIK!" muncul di awal round

    let roundElapsed = 0;
    let suddenDeath = false;

    let roundEndTimer = 0;
    let roundWinnerBanner = '';

    let finishTimeoutId = null;

    let sparks = []; // Efek partikel bonus kompak
    let floatingTexts = []; // Teks melayang "+50% KOMPAK!"

    let frameId = null;
    let lastTimestamp = null;
    let stopped = false;

    // Helper sound
    function playAudio(name, opts) {
      try {
        if (audio && typeof audio.play === 'function') {
          audio.play(name, opts);
        }
      } catch (_) {}
    }

    // =====================================================
    // Alur Permainan: Mulai, Ronde Baru, Selesai
    // =====================================================
    function startCountdown() {
      state = 'countdown';
      countdownTimer = COUNTDOWN_SEC;
      lastCountdownDigit = Math.ceil(countdownTimer);
      playAudio('click', { pan: 0, volume: 0.35 });
    }

    function beginRound() {
      state = 'play';
      tarikBannerTimer = 0.65;
      roundElapsed = 0;
      suddenDeath = false;
      playAudio('start');
    }

    function endRound(winnerTeam) {
      if (state !== 'play') return;
      state = 'roundEnd';
      roundEndTimer = ROUND_END_DELAY;

      if (winnerTeam === 'left') {
        scoreLeft++;
        roundWinnerBanner = 'Tim Kiri Menang Ronde!';
      } else {
        scoreRight++;
        roundWinnerBanner = 'Tim Kanan Menang Ronde!';
      }

      playAudio('score');
    }

    function checkMatchFinish() {
      if (scoreLeft >= ROUNDS_TO_WIN || scoreRight >= ROUNDS_TO_WIN) {
        state = 'over';
        playAudio('win');

        // Bentuk teks finish() persis sesuai spesifikasi kontrak
        let finishText = '';
        if (numP === 2) {
          const winnerSlot = scoreLeft > scoreRight ? players[0] : players[1];
          const s1 = scoreLeft;
          const s2 = scoreRight;
          finishText = `P${winnerSlot} menang! Skor ronde ${s1}-${s2}`;
        } else {
          if (scoreLeft > scoreRight) {
            finishText = `Tim Kiri (P${players[0]} & P${players[1]}) menang! Skor ronde ${scoreLeft}-${scoreRight}`;
          } else {
            finishText = `Tim Kanan (P${players[2]} & P${players[3]}) menang! Skor ronde ${scoreLeft}-${scoreRight}`;
          }
        }

        finishTimeoutId = setTimeout(() => {
          if (!stopped) finish(finishText);
        }, FINISH_DELAY_MS);
      } else {
        // Lanjut ke ronde berikutnya
        currentRound++;
        resetRope();
        playerList.forEach(p => {
          p.pullCount = 0;
          p.lastPullTime = -999;
          p.lastPullPaired = false;
        });
        startCountdown();
      }
    }

    function resetRope() {
      ropeX = 0;
      ropeV = 0;
    }

    // =====================================================
    // Penanganan Tarikan (Pull Logic & Bonus Kompak)
    // =====================================================
    function handlePull(playerObj) {
      if (state !== 'play') return;

      const now = performance.now() / 1000;
      // Batasi laju tarikan (PULL_MAX_PER_SEC = 8, min 125 ms)
      if (now - playerObj.lastPullTime < PULL_MIN_INTERVAL) return;

      let multiplier = 1.0;
      const isLeft = playerObj.isLeft;
      const teamPan = isLeft ? -0.6 : 0.6;

      // Cek Bonus Kompak untuk mode 4 Pemain
      if (numP === 4 && playerObj.teammateSlot) {
        const teammate = playerMap[playerObj.teammateSlot];
        if (teammate && (now - teammate.lastPullTime) <= (TEAM_SYNC_MS / 1000) && !teammate.lastPullPaired) {
          // Bonus kompak valid!
          multiplier = SYNC_MULTIPLIER;
          playerObj.lastPullPaired = true;
          teammate.lastPullPaired = true;

          // Audio powerup & partikel kilau
          playAudio('powerup', { pan: teamPan, volume: 0.4 });
          triggerSparkEffect(playerObj, teammate);
        } else {
          playerObj.lastPullPaired = false;
          playAudio('click', { pan: teamPan, volume: 0.25 });
        }
      } else {
        playerObj.lastPullPaired = false;
        playAudio('click', { pan: teamPan, volume: 0.25 });
      }

      // Catat waktu tarikan & statistik
      playerObj.lastPullTime = now;
      playerObj.pullCount++;
      playerObj.pullAnim = 0.16; // Ayunan mundur

      // Debu pijakan kaki
      triggerDustEffect(playerObj);

      // Terapkan impuls fisika pada tali
      if (isLeft) {
        ropeV -= multiplier * PULL_IMPULSE;
      } else {
        ropeV += multiplier * PULL_IMPULSE;
      }
    }

    function triggerSparkEffect(p1, p2) {
      const flagX = 640 + ropeX * ROPE_RANGE;
      const x1 = flagX + p1.offset;
      const x2 = flagX + p2.offset;
      const midX = (x1 + x2) / 2;

      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 120;
        sparks.push({
          x: midX,
          y: ROPE_Y - 20,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          life: 0.45,
          maxLife: 0.45,
          color: p1.isLeft ? '#ff5252' : '#ffee58'
        });
      }

      floatingTexts.push({
        text: '✨ KOMPAK! 1.5×',
        x: midX,
        y: ROPE_Y - 60,
        vy: -40,
        alpha: 1.0,
        color: p1.isLeft ? '#ff8a80' : '#fff59d'
      });
    }

    function triggerDustEffect(playerObj) {
      const flagX = 640 + ropeX * ROPE_RANGE;
      const footX = flagX + playerObj.offset + (playerObj.isLeft ? 15 : -15);
      const footY = 485;

      for (let i = 0; i < 3; i++) {
        playerObj.dustList.push({
          x: footX + (Math.random() * 10 - 5),
          y: footY,
          vx: (playerObj.isLeft ? -1 : 1) * (20 + Math.random() * 30),
          vy: -15 - Math.random() * 20,
          life: 0.3,
          maxLife: 0.3,
          size: 4 + Math.random() * 4
        });
      }
    }

    // =====================================================
    // Integrasi Fisika & Update Loop
    // =====================================================
    function updatePhysics(dt) {
      const clampedDt = Math.min(dt, MAX_DT);
      const substeps = Math.ceil(clampedDt / SUB_DT);
      const sdt = clampedDt / substeps;

      for (let s = 0; s < substeps; s++) {
        ropeV *= Math.exp(-ROPE_DRAG * sdt);
        ropeX += ropeV * sdt;
      }

      // Cek kemenangan tepi segera
      if (ropeX <= -1.0) {
        ropeX = -1.0;
        ropeV = 0;
        endRound('left');
        return;
      } else if (ropeX >= 1.0) {
        ropeX = 1.0;
        ropeV = 0;
        endRound('right');
        return;
      }

      // Waktu ronde & Sudden Death
      roundElapsed += clampedDt;
      if (roundElapsed >= ROUND_MAX_SEC) {
        if (ropeX <= -SUDDEN_DEATH_THRESHOLD) {
          endRound('left');
        } else if (ropeX >= SUDDEN_DEATH_THRESHOLD) {
          endRound('right');
        } else {
          suddenDeath = true;
        }
      }
    }

    function step(dt) {
      // Update animasi pemain & efek
      playerList.forEach(p => {
        if (p.pullAnim > 0) p.pullAnim = Math.max(0, p.pullAnim - dt);
        p.dustList = p.dustList.filter(d => {
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          d.life -= dt;
          return d.life > 0;
        });
      });

      // Partikel kilau
      sparks = sparks.filter(sp => {
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.life -= dt;
        return sp.life > 0;
      });

      // Teks melayang
      floatingTexts = floatingTexts.filter(ft => {
        ft.y += ft.vy * dt;
        ft.alpha = Math.max(0, ft.alpha - dt * 1.5);
        return ft.alpha > 0;
      });

      if (state === 'countdown') {
        countdownTimer -= dt;
        const currentDigit = Math.ceil(countdownTimer);
        if (currentDigit > 0 && currentDigit !== lastCountdownDigit) {
          lastCountdownDigit = currentDigit;
          playAudio('click', { pan: 0, volume: 0.35 });
        }
        if (countdownTimer <= 0) {
          beginRound();
        }
      } else if (state === 'play') {
        if (tarikBannerTimer > 0) {
          tarikBannerTimer = Math.max(0, tarikBannerTimer - dt);
        }
        updatePhysics(dt);
      } else if (state === 'roundEnd') {
        roundEndTimer -= dt;
        if (roundEndTimer <= 0) {
          checkMatchFinish();
        }
      }
    }

    // =====================================================
    // Renderer: Latar, Tali, Karakter, HUD
    // =====================================================
    function drawBackground() {
      // 1. Langit biru cerah
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 380);
      skyGrad.addColorStop(0, '#5cb8f8');
      skyGrad.addColorStop(1, '#c5ebff');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, 380);

      // Matahari lembut
      ctx.fillStyle = 'rgba(255, 255, 240, 0.4)';
      ctx.beginPath();
      ctx.arc(640, 90, 60, 0, Math.PI * 2);
      ctx.fill();

      // Awan-awan atmosferik
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      drawCloud(220, 90, 45);
      drawCloud(980, 120, 55);

      // Bukit jauh
      ctx.fillStyle = '#68a87b';
      ctx.beginPath();
      ctx.moveTo(0, 380);
      ctx.quadraticCurveTo(340, 310, 640, 360);
      ctx.quadraticCurveTo(960, 310, CANVAS_WIDTH, 380);
      ctx.lineTo(CANVAS_WIDTH, 420);
      ctx.lineTo(0, 420);
      ctx.fill();

      // 2. Padang Rumput
      const grassGrad = ctx.createLinearGradient(0, 380, 0, CANVAS_HEIGHT);
      grassGrad.addColorStop(0, '#43a047');
      grassGrad.addColorStop(0.3, '#388e3c');
      grassGrad.addColorStop(1, '#1b5e20');
      ctx.fillStyle = grassGrad;
      ctx.fillRect(0, 380, CANVAS_WIDTH, CANVAS_HEIGHT - 380);

      // Tekstur bayangan tanah horizontal
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 490, CANVAS_WIDTH, 60);

      // 3. Garis Kapur Penanda
      // Garis Menang Tim Kiri
      drawBoundaryMarker(WIN_LINE_LEFT, 'GARIS MENANG KIRI', TEAM_COLOR_LEFT);
      // Garis Menang Tim Kanan
      drawBoundaryMarker(WIN_LINE_RIGHT, 'GARIS MENANG KANAN', TEAM_COLOR_RIGHT);

      // Garis Tengah Lapangan
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(640, 360);
      ctx.lineTo(640, 560);
      ctx.stroke();
      ctx.setLineDash([]);

      // Patok tengah di tanah
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(640, 560, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawCloud(cx, cy, r) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.7, cy - r * 0.2, r * 0.75, 0, Math.PI * 2);
      ctx.arc(cx - r * 0.7, cy + r * 0.1, r * 0.65, 0, Math.PI * 2);
      ctx.arc(cx + r * 1.3, cy + r * 0.15, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawBoundaryMarker(x, label, color) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, 370);
      ctx.lineTo(x, 550);
      ctx.stroke();

      // Tiang & bendera penanda batas
      ctx.fillStyle = '#424242';
      ctx.fillRect(x - 3, 330, 6, 40);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, 330);
      ctx.lineTo(x + (x < 640 ? -28 : 28), 345);
      ctx.lineTo(x, 360);
      ctx.fill();

      // Label garis kapur
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, 570);
      ctx.restore();
    }

    function drawRope() {
      const flagX = 640 + ropeX * ROPE_RANGE;

      ctx.save();

      // Bayangan tali di tanah
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(ROPE_LEFT, 490);
      ctx.lineTo(ROPE_RIGHT, 490);
      ctx.stroke();

      // Tali tambang utama (Warna coklat serat alami)
      ctx.strokeStyle = '#8d6e63';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ROPE_LEFT, ROPE_Y);
      ctx.lineTo(ROPE_RIGHT, ROPE_Y);
      ctx.stroke();

      // Pola kepangan / lilitan tali (garis spiral tekstur)
      ctx.strokeStyle = '#5d4037';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let rx = ROPE_LEFT + 8; rx < ROPE_RIGHT - 8; rx += 12) {
        ctx.moveTo(rx, ROPE_Y - 5);
        ctx.lineTo(rx + 6, ROPE_Y + 5);
      }
      ctx.stroke();

      // Ujung tali berjumbai di kiri dan kanan
      drawFrayedEnd(ROPE_LEFT, ROPE_Y, true);
      drawFrayedEnd(ROPE_RIGHT, ROPE_Y, false);

      // Pita Merah Bendera Penanda di Tengah Tali
      ctx.fillStyle = '#d32f2f';
      ctx.beginPath();
      ctx.arc(flagX, ROPE_Y, 9, 0, Math.PI * 2);
      ctx.fill();

      // Kain pita menggantung ke bawah
      ctx.beginPath();
      ctx.moveTo(flagX - 8, ROPE_Y + 2);
      ctx.lineTo(flagX + 8, ROPE_Y + 2);
      ctx.lineTo(flagX + 14, ROPE_Y + 36);
      ctx.lineTo(flagX, ROPE_Y + 28);
      ctx.lineTo(flagX - 14, ROPE_Y + 36);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    function drawFrayedEnd(x, y, isLeft) {
      ctx.save();
      ctx.strokeStyle = '#6d4c41';
      ctx.lineWidth = 2;
      const dir = isLeft ? -1 : 1;
      for (let i = -6; i <= 6; i += 3) {
        ctx.beginPath();
        ctx.moveTo(x, y + i);
        ctx.lineTo(x + dir * 14, y + i * 1.5 + (Math.sin(i) * 4));
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawFigures() {
      const flagX = 640 + ropeX * ROPE_RANGE;

      // Urutkan render agar tidak saling menutupi janggal
      playerList.forEach(p => {
        const charX = flagX + p.offset;
        const lean = (p.pullAnim / 0.16) * (p.isLeft ? -18 : 18);

        ctx.save();

        // Gambar partikel debu pijakan
        ctx.fillStyle = 'rgba(215, 204, 200, 0.6)';
        p.dustList.forEach(d => {
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.size * (d.life / d.maxLife), 0, Math.PI * 2);
          ctx.fill();
        });

        // Bayangan kaki di tanah
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(charX, 485, 24, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Posisi berayun mundur saat menarik
        const curX = charX + lean;

        // Kaki yang menapak kuat
        ctx.strokeStyle = '#263238';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (p.isLeft) {
          // Kaki kiri di belakang menopang, kaki kanan di depan
          ctx.moveTo(curX - 4, 435);
          ctx.lineTo(charX - 18, 482);
          ctx.moveTo(curX + 6, 435);
          ctx.lineTo(charX + 12, 482);
        } else {
          // Kaki kanan di belakang menopang, kaki kiri di depan
          ctx.moveTo(curX + 4, 435);
          ctx.lineTo(charX + 18, 482);
          ctx.moveTo(curX - 6, 435);
          ctx.lineTo(charX - 12, 482);
        }
        ctx.stroke();

        // Badan / Torso (Berwarna slot pemain)
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.roundRect(curX - 18, 385, 36, 52, 10);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Label Slot Pemain di Dada (P1..P4)
        ctx.font = 'bold 15px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(p.label, curX, 417);

        // Kepala Figur
        ctx.fillStyle = '#ffcc80'; // Warna kulit hangat
        ctx.beginPath();
        ctx.arc(curX, 362, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#424242';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Ikat kepala / Bandana sesuai warna tim
        ctx.fillStyle = p.isLeft ? TEAM_COLOR_LEFT : TEAM_COLOR_RIGHT;
        ctx.fillRect(curX - 17, 354, 34, 7);

        // Mata menatap tajam ke arah tali
        ctx.fillStyle = '#212121';
        const eyeOffsetX = p.isLeft ? 5 : -5;
        ctx.beginPath();
        ctx.arc(curX + eyeOffsetX, 362, 3, 0, Math.PI * 2);
        ctx.fill();

        // Lengan memegang tali erat di y = 420
        ctx.strokeStyle = '#ffcc80';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(curX + (p.isLeft ? 8 : -8), 400);
        ctx.lineTo(curX + (p.isLeft ? 20 : -20), ROPE_Y);
        ctx.stroke();

        // Telapak tangan melingkari tali
        ctx.fillStyle = '#ffb74d';
        ctx.beginPath();
        ctx.arc(curX + (p.isLeft ? 20 : -20), ROPE_Y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });
    }

    function drawSparksAndText() {
      // Efek kilau bonus kompak
      ctx.save();
      sparks.forEach(sp => {
        ctx.globalAlpha = Math.max(0, sp.life / sp.maxLife);
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Teks melayang bonus kompak
      floatingTexts.forEach(ft => {
        ctx.globalAlpha = ft.alpha;
        ctx.font = 'bold 22px sans-serif';
        ctx.fillStyle = ft.color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.textAlign = 'center';
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillText(ft.text, ft.x, ft.y);
      });
      ctx.restore();
    }

    function drawHUD() {
      ctx.save();

      // 1. Panel Skor Utama di Tengah Atas
      const hudTopY = SAFE_MARGIN + 10;

      // Pill Latar Belakang Skor
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(460, hudTopY, 360, 68, 16);
      ctx.fill();
      ctx.stroke();

      // Indikator Ronde
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      const roundLabel = suddenDeath
        ? '⚠️ SUDDEN DEATH — SELISIH PERTAMA MENANG!'
        : `RONDE ${currentRound} / ${MAX_ROUNDS}`;
      ctx.fillText(roundLabel, 640, hudTopY + 20);

      // Skor Tim Kiri (Merah) vs Tim Kanan (Kuning)
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = TEAM_COLOR_LEFT;
      ctx.textAlign = 'right';
      ctx.fillText(`Tim Kiri  ${scoreLeft}`, 618, hudTopY + 52);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(':', 640, hudTopY + 50);

      ctx.fillStyle = TEAM_COLOR_RIGHT;
      ctx.textAlign = 'left';
      ctx.fillText(`${scoreRight}  Tim Kanan`, 662, hudTopY + 52);

      // Timer Ronde (Di bawah box skor)
      if (state === 'play' && !suddenDeath) {
        const remainSec = Math.max(0, Math.ceil(ROUND_MAX_SEC - roundElapsed));
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = remainSec <= 10 ? '#ff5252' : '#e2e8f0';
        ctx.textAlign = 'center';
        ctx.fillText(`⏱ Sisa Waktu: ${remainSec} dtk`, 640, hudTopY + 92);
      }

      // 2. Chip Statistik Pemain (Di Kiri dan Kanan)
      // Tim Kiri di Sisi Kiri
      const leftPlayers = playerList.filter(p => p.isLeft);
      leftPlayers.forEach((p, idx) => {
        const chipY = SAFE_MARGIN + 12 + idx * 46;
        drawPlayerChip(SAFE_MARGIN + 20, chipY, p, 'left');
      });

      // Tim Kanan di Sisi Kanan
      const rightPlayers = playerList.filter(p => !p.isLeft);
      rightPlayers.forEach((p, idx) => {
        const chipY = SAFE_MARGIN + 12 + idx * 46;
        drawPlayerChip(CANVAS_WIDTH - SAFE_MARGIN - 20, chipY, p, 'right');
      });

      // 3. Bilah Ketegangan (Tension Bar) di Bawah Layar
      drawTensionBar();

      ctx.restore();
    }

    function drawPlayerChip(x, y, p, side) {
      ctx.save();
      const chipW = 210;
      const chipH = 38;
      const drawX = side === 'left' ? x : x - chipW;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(drawX, y, chipW, chipH, 10);
      ctx.fill();
      ctx.stroke();

      // Lingkaran Slot Pemain
      const circleX = side === 'left' ? drawX + 20 : drawX + chipW - 20;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(circleX, y + chipH / 2, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(p.label, circleX, y + chipH / 2 + 4);

      // Teks Tarikan
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = side === 'left' ? 'left' : 'right';
      const textX = side === 'left' ? drawX + 42 : drawX + chipW - 42;
      ctx.fillText(`${p.pullCount} tarikan`, textX, y + chipH / 2 + 5);

      ctx.restore();
    }

    function drawTensionBar() {
      const barW = 640;
      const barH = 22;
      const barX = (CANVAS_WIDTH - barW) / 2;
      const barY = CANVAS_HEIGHT - SAFE_MARGIN - 26;

      ctx.save();

      // Latar bilah ketegangan
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 11);
      ctx.fill();
      ctx.stroke();

      // Sisi kiri (Merah tint) & Sisi kanan (Kuning tint)
      ctx.fillStyle = 'rgba(229, 57, 53, 0.35)';
      ctx.fillRect(barX + 2, barY + 2, barW / 2 - 2, barH - 4);
      ctx.fillStyle = 'rgba(253, 216, 53, 0.35)';
      ctx.fillRect(barX + barW / 2, barY + 2, barW / 2 - 2, barH - 4);

      // Titik tengah
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH / 2, barY);
      ctx.lineTo(CANVAS_WIDTH / 2, barY + barH);
      ctx.stroke();

      // Penanda Posisi Tali
      const markerX = CANVAS_WIDTH / 2 + ropeX * (barW / 2 - 12);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(markerX, barY + barH / 2, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label Tim Kiri dan Tim Kanan
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = TEAM_COLOR_LEFT;
      ctx.textAlign = 'right';
      ctx.fillText('◀ TIM KIRI', barX - 14, barY + barH / 2 + 4);

      ctx.fillStyle = TEAM_COLOR_RIGHT;
      ctx.textAlign = 'left';
      ctx.fillText('TIM KANAN ▶', barX + barW + 14, barY + barH / 2 + 4);

      ctx.restore();
    }

    function drawOverlays() {
      // 1. Overlay Waiting (Menunggu 99 atau klik)
      if (state === 'waiting') {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Banner Tengah
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(CANVAS_WIDTH / 2 - 380, CANVAS_HEIGHT / 2 - 150, 760, 300, 24);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 44px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('🪢 Tarik Tambang', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 75);

        ctx.font = '20px sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`Kirim 99# dari micro:bit pemain pertama (P${starterPlayer})`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 15);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText('atau klik layar untuk mulai', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);

        ctx.font = '15px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Tekan tombol 1, 2, 3, 4, atau 5 secepatnya untuk menarik tali!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 75);
        if (numP === 4) {
          ctx.fillStyle = '#fef08a';
          ctx.fillText('⚡ Tarik bersamaan dengan rekan setimmu dalam 200 ms untuk Bonus Kompak 1.5×!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 105);
        }

        ctx.restore();
      }

      // 2. Countdown 3-2-1
      if (state === 'countdown') {
        ctx.save();
        const digit = Math.ceil(countdownTimer);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.font = 'bold 140px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = 10;
        ctx.textAlign = 'center';
        ctx.strokeText(String(digit), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 45);
        ctx.fillText(String(digit), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 45);

        ctx.font = 'bold 26px sans-serif';
        ctx.fillStyle = '#fde047';
        ctx.fillText('Bersiap...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 105);
        ctx.restore();
      }

      // 3. Banner "TARIK!" saat ronde baru mulai
      if (state === 'play' && tarikBannerTimer > 0) {
        ctx.save();
        const alpha = Math.min(1.0, tarikBannerTimer / 0.3);
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 100px sans-serif';
        ctx.fillStyle = '#ffeb3b';
        ctx.strokeStyle = '#d32f2f';
        ctx.lineWidth = 12;
        ctx.textAlign = 'center';
        ctx.strokeText('TARIK!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
        ctx.fillText('TARIK!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
        ctx.restore();
      }

      // 4. Banner Akhir Ronde (Round End)
      if (state === 'roundEnd') {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.font = 'bold 48px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 8;
        ctx.textAlign = 'center';
        ctx.strokeText(roundWinnerBanner, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
        ctx.fillText(roundWinnerBanner, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);

        ctx.font = 'bold 28px sans-serif';
        ctx.fillStyle = '#fde047';
        ctx.strokeText(`Skor Sementara: ${scoreLeft} - ${scoreRight}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 35);
        ctx.fillText(`Skor Sementara: ${scoreLeft} - ${scoreRight}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 35);
        ctx.restore();
      }

      // 5. Layar Selesai (Match Over)
      if (state === 'over') {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const isLeftWin = scoreLeft > scoreRight;
        const winnerName = isLeftWin ? 'TIM KIRI JUARA! 🏆' : 'TIM KANAN JUARA! 🏆';
        const winColor = isLeftWin ? TEAM_COLOR_LEFT : TEAM_COLOR_RIGHT;

        ctx.font = 'bold 54px sans-serif';
        ctx.fillStyle = winColor;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.textAlign = 'center';
        ctx.strokeText(winnerName, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);
        ctx.fillText(winnerName, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);

        ctx.font = 'bold 30px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Skor Ronde Akhir: ${scoreLeft} - ${scoreRight}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 35);
        ctx.restore();
      }
    }

    function render() {
      drawBackground();
      drawRope();
      drawFigures();
      drawSparksAndText();
      drawHUD();
      drawOverlays();
    }

    // =====================================================
    // Loop Animasi Utama
    // =====================================================
    function loop(timestamp) {
      if (stopped) return;
      if (lastTimestamp === null) lastTimestamp = timestamp;
      const dt = Math.min((timestamp - lastTimestamp) / 1000, MAX_DT);
      lastTimestamp = timestamp;

      step(dt);
      render();

      frameId = requestAnimationFrame(loop);
    }

    // =====================================================
    // Penanganan Masukan (Kernel Event 'input' & Klik Canvas)
    // =====================================================
    function onInput({ player, cmd }) {
      if (stopped) return;

      // 1. Memulai Permainan dengan 99#
      if (state === 'waiting') {
        if (cmd === '99' && player === starterPlayer) {
          startCountdown();
        }
        return;
      }

      // 2. Tarikan saat permainan berlangsung
      if (state === 'play') {
        if (cmd === '1' || cmd === '2' || cmd === '3' || cmd === '4' || cmd === '5') {
          const pObj = playerMap[player];
          if (pObj) handlePull(pObj);
        }
      }
    }

    function onCanvasClick() {
      if (stopped) return;
      if (state === 'waiting') {
        startCountdown();
      }
    }

    // Pasang Event Listeners
    const offKernel = kernel.on('input', onInput);
    canvas.addEventListener('click', onCanvasClick);

    // Mulai Loop
    frameId = requestAnimationFrame(loop);

    // =====================================================
    // Lifecycle: Stop & Cleanup
    // =====================================================
    return {
      stop() {
        stopped = true;
        if (frameId !== null) cancelAnimationFrame(frameId);
        if (finishTimeoutId !== null) clearTimeout(finishTimeoutId);
        offKernel();
        canvas.removeEventListener('click', onCanvasClick);
      }
    };
  }
};

