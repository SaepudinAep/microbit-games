// GAME: Hill Climbing (games/hillclimb.js)
// Daki bukit dengan mobilmu, hemat bensin, dan jadilah yang pertama sampai garis finis!
// Mendukung mode 1P, 2P, dan 4P di kanvas standar 1280x720 dengan split viewport adaptif.

'use strict';

// ═══════════════════════════════════════════════════════════════════
//  KONSTANTA PERMAINAN
// ═══════════════════════════════════════════════════════════════════

const CANVAS_WIDTH            = 1280;
const CANVAS_HEIGHT           = 720;
const SAFE_MARGIN             = 40;
const COUNTDOWN_SEC           = 3;
const FINISH_DELAY_MS         = 600;
const CELEBRATE_DELAY_SEC     = 2.0;

// Lintasan & Medan
const TRACK_LENGTH_PX         = 20000;  // 500 meter
const METER                   = 40;     // 1 meter = 40 piksel
const SEGMENT_W               = 240;    // Jarak horizontal antar titik kontrol
const FLAT_START_PX           = 600;    // Lintasan datar awal
const MAX_SLOPE_DEG           = 25;     // Kemiringan medan maksimal (derajat)
const MAX_SLOPE_RAD           = (MAX_SLOPE_DEG * Math.PI) / 180;
// Beda tinggi maksimal antar titik kontrol agar turunan cosinus tidak pernah > 25°:
const MAX_DY                  = Math.floor((SEGMENT_W * 2 / Math.PI) * Math.tan(MAX_SLOPE_RAD)); // ~71 px
const MAX_AMP                 = 130;    // Batas amplitudo bukit (±130 px)

// Fisika Mobil
const ENGINE_ACC              = 420;    // Akselerasi mesin maju (px/dtk²)
const GRAV                    = 900;    // Gravitasi sepanjang lereng (px/dtk²)
const DRAG                    = 0.35;   // Koefisien redaman gesekan per detik
const BRAKE_DEC               = 700;    // Perlambatan saat rem aktif (px/dtk²)
const ENGINE_REV              = 200;    // Akselerasi saat gigi mundur (px/dtk²)
const REV_MAX_SPEED           = -140;   // Kecepatan mundur maksimal (px/dtk)
const MAX_SPEED               = 520;    // Kecepatan maju maksimal (px/dtk)
const MAX_DT                  = 0.05;   // Pembatas dt frame rate

// Bensin & Penyetelan (Tuned: Full gas kehabisan bensin di 60-95%, Eco finish < 150s)
const FUEL_MAX                = 100;    // Kapasitas tangki maksimal
const FUEL_USE                = 10.3;   // Konsumsi bensin per detik saat gas aktif
const FUEL_PICKUP             = 34;     // Tambahan bensin per kaleng
const FUEL_SPACING            = 2400;   // Jarak rata-rata antar kaleng bensin (px)
const FUEL_JITTER             = 300;    // Variasi acak posisi kaleng bensin (±px)
const LOW_FUEL_PCT            = 0.20;   // Ambang bensin menipis (20%)
const LOW_FUEL_BEEP_INTERVAL  = 1.0;    // Jeda suara peringatan bensin rendah (dtk)
const STOPPED_SPEED_THRESH    = 5;      // Batas kecepatan mobil nyaris diam (px/dtk)
const STOPPED_TIME_THRESH     = 1.5;    // Durasi mobil diam sebelum dinyatakan selesai (dtk)

// Dimensi Mobil & Roda
const CAR_WIDTH               = 50;
const CAR_HEIGHT              = 26;
const WHEEL_RADIUS            = 8.5;
const WHEEL_OFFSET_FRONT      = 16;
const WHEEL_OFFSET_BACK       = -16;

// Warna Pemain Resmi Berdasarkan Nomor Slot Controller
const SLOT_COLORS = {
  1: '#4b83ff', // Biru
  2: '#ff9a2e', // Oranye
  3: '#3ccf8e', // Hijau
  4: '#b98cff'  // Ungu
};

// ═══════════════════════════════════════════════════════════════════
//  PRNG & GENERATOR MEDAN
// ═══════════════════════════════════════════════════════════════════

function createMulberry32(seed) {
  let t = seed;
  return function() {
    t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function generateTrack(seed) {
  const rng = createMulberry32(seed);
  const numPoints = Math.ceil(TRACK_LENGTH_PX / SEGMENT_W) + 6;
  const points = [];

  let curY = 0;
  for (let i = 0; i < numPoints; i++) {
    const x = i * SEGMENT_W;
    if (x <= FLAT_START_PX) {
      curY = 0;
    } else {
      const delta = (rng() * 2 - 1) * MAX_DY;
      curY += delta;
      if (curY > MAX_AMP) curY = MAX_AMP;
      if (curY < -MAX_AMP) curY = -MAX_AMP;
    }
    points.push(curY);
  }

  function getHeightAndSlope(x) {
    if (x <= 0) return { h: 0, slope: 0, angle: 0 };
    const seg = Math.floor(x / SEGMENT_W);
    const i0 = Math.min(seg, points.length - 2);
    const i1 = i0 + 1;
    const t = (x - i0 * SEGMENT_W) / SEGMENT_W;
    const y0 = points[i0];
    const y1 = points[i1];

    // Interpolasi kosinus mulus
    const mu = (1 - Math.cos(t * Math.PI)) / 2;
    const h = y0 * (1 - mu) + y1 * mu;

    // Turunan pertama (slope)
    const dmu = (Math.PI / 2) * Math.sin(t * Math.PI);
    const slope = (y1 - y0) * (dmu / SEGMENT_W);
    const angle = Math.atan(slope);

    return { h, slope, angle };
  }

  // Sebar kaleng bensin dari seed yang sama
  const fuelCans = [];
  for (let fx = FUEL_SPACING; fx < TRACK_LENGTH_PX - 800; fx += FUEL_SPACING) {
    const jitter = (rng() * 2 - 1) * FUEL_JITTER;
    fuelCans.push({ x: fx + jitter });
  }

  return { points, getHeightAndSlope, fuelCans };
}

// ═══════════════════════════════════════════════════════════════════
//  EKSPOR UTAMA MODUL GAME
// ═══════════════════════════════════════════════════════════════════

export default {
  id: 'hillclimb',
  name: 'Hill Climbing',
  icon: '⛰️',
  description: 'Daki bukit dengan mobilmu, hemat bensin, dan jadilah yang pertama sampai garis finis! Balapan solo hingga berempat.',
  modes: [
    { id: '1p', label: '1 Player', sub: 'Solo',           players: 1 },
    { id: '2p', label: '2 Player', sub: 'Adu balap',      players: 2 },
    { id: '4p', label: '4 Player', sub: 'Balap berempat', players: 4 }
  ],
  canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },

  create({ canvas, kernel, players, mode, finish, audio }) {
    const ctx = canvas.getContext('2d');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const numP = players.length;
    const starterPlayer = players[0]; // Hanya players[0] yang boleh '99'

    // Satu seed per sesi game agar semua pemain balapan di bukit yang identik
    const gameSeed = (Date.now() ^ (Math.random() * 0x10000000)) >>> 0;
    const track = generateTrack(gameSeed);

    // =====================================================
    // Tata Letak Viewport per Mode
    // =====================================================
    let viewports = [];
    if (numP === 1) {
      viewports = [
        { x: 0, y: 0, w: CANVAS_WIDTH, h: CANVAS_HEIGHT, pan: 0 }
      ];
    } else if (numP === 2) {
      // Dua viewport bertumpuk (1280x358) dengan garis pemisah 4 px
      viewports = [
        { x: 0, y: 0,   w: CANVAS_WIDTH, h: 358, pan: -0.2 },
        { x: 0, y: 362, w: CANVAS_WIDTH, h: 358, pan:  0.2 }
      ];
    } else {
      // 4 Pemain: Grid 2x2 (638x358) dengan garis pemisah 4 px
      viewports = [
        { x: 0,   y: 0,   w: 638, h: 358, pan: -0.6 },
        { x: 642, y: 0,   w: 638, h: 358, pan:  0.6 },
        { x: 0,   y: 362, w: 638, h: 358, pan: -0.6 },
        { x: 642, y: 362, w: 638, h: 358, pan:  0.6 }
      ];
    }

    // =====================================================
    // Inisialisasi Mobil Pemain
    // =====================================================
    const playerMap = {};
    const playerList = players.map((slot, idx) => {
      const p = {
        slot,
        idx,
        color: SLOT_COLORS[slot] || '#ffffff',
        label: `P${slot}`,
        x: 0,
        vx: 0,
        y: 0,
        angle: 0,
        wheelAngle: 0,
        fuel: FUEL_MAX,
        gasHeld: false,
        brakeHeld: false,
        finished: false,
        finishTime: 0,
        done: false,
        doneReason: '', // 'finis' | 'out_of_fuel'
        stoppedTimer: 0,
        collectedCans: new Set(),
        lowFuelBeepTimer: 0,
        camX: 0,
        camY: 0,
        viewport: viewports[idx] || viewports[0]
      };
      playerMap[slot] = p;
      return p;
    });

    // =====================================================
    // State Game
    // =====================================================
    let state = 'waiting'; // 'waiting' | 'countdown' | 'play' | 'celebrate' | 'over'
    let countdownTimer = COUNTDOWN_SEC;
    let lastCountdownDigit = null;
    let goBannerTimer = 0; // Durasi teks "GO!" tampil di tiap viewport
    let celebrateTimer = 0;
    let finishTimeoutId = null;

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
    // Alur Permainan
    // =====================================================
    function startCountdown() {
      state = 'countdown';
      countdownTimer = COUNTDOWN_SEC;
      lastCountdownDigit = Math.ceil(countdownTimer);
      playAudio('click', { pan: 0, volume: 0.35 });
    }

    function beginPlay() {
      state = 'play';
      goBannerTimer = 0.8;
      playAudio('start');
    }

    function checkGameEnd() {
      if (state !== 'play') return;

      // Cek apakah ada pemain yang sudah finis
      const anyFinished = playerList.some(p => p.finished);
      // Cek apakah semua pemain sudah berstatus done
      const allDone = playerList.every(p => p.done);

      if (anyFinished) {
        state = 'celebrate';
        celebrateTimer = CELEBRATE_DELAY_SEC;
        playAudio('win');
      } else if (allDone) {
        endGameMatch();
      }
    }

    function endGameMatch() {
      if (state === 'over') return;
      state = 'over';

      let finishText = '';
      if (numP === 1) {
        const p1 = playerList[0];
        if (p1.finished) {
          finishText = `Selesai! 500 m dalam ${p1.finishTime.toFixed(1)} dtk`;
        } else {
          const meters = Math.round(p1.x / METER);
          finishText = `Bensin habis di ${meters} m`;
        }
      } else {
        // Tentukan pemenang
        const anyFinished = playerList.some(p => p.finished);
        let winner = null;
        if (anyFinished) {
          // Pemenang adalah yang finis (bila lebih dari 1, yang finishTime-nya terkecil)
          const finishers = playerList.filter(p => p.finished);
          winner = finishers.reduce((a, b) => a.finishTime <= b.finishTime ? a : b);

          const listStr = playerList.map(p => {
            const m = Math.round(p.x / METER);
            return `${p.label} ${m} m${p.finished ? ' (finis)' : ''}`;
          }).join(', ');
          finishText = `${winner.label} menang! ${listStr}`;
        } else {
          // Tidak ada yang finis: pemenang = jarak terjauh
          winner = playerList.reduce((a, b) => a.x >= b.x ? a : b);
          const listStr = playerList.map(p => {
            const m = Math.round(p.x / METER);
            return `${p.label} ${m} m`;
          }).join(', ');
          finishText = `${winner.label} terjauh! ${listStr}`;
        }
      }

      finishTimeoutId = setTimeout(() => {
        if (!stopped) finish(finishText);
      }, FINISH_DELAY_MS);
    }

    // =====================================================
    // Update Fisika & Simulasi per Frame
    // =====================================================
    function step(dt) {
      if (state === 'countdown') {
        countdownTimer -= dt;
        const currentDigit = Math.ceil(countdownTimer);
        if (currentDigit > 0 && currentDigit !== lastCountdownDigit) {
          lastCountdownDigit = currentDigit;
          playAudio('click', { pan: 0, volume: 0.35 });
        }
        if (countdownTimer <= 0) {
          beginPlay();
        }
      } else if (state === 'celebrate') {
        celebrateTimer -= dt;
        if (celebrateTimer <= 0) {
          endGameMatch();
        }
      }

      if (goBannerTimer > 0) {
        goBannerTimer = Math.max(0, goBannerTimer - dt);
      }

      // Update setiap mobil pemain
      playerList.forEach(p => {
        const vp = p.viewport;
        const pan = vp.pan;

        if (state === 'play' || state === 'celebrate') {
          if (!p.done) {
            // Evaluasi medan saat ini
            const terrainData = track.getHeightAndSlope(p.x);
            p.y = terrainData.h;
            p.angle = terrainData.angle;

            // Akselerasi
            let ax = 0;

            // 1. Gas
            if (p.gasHeld && p.fuel > 0) {
              ax += ENGINE_ACC;
              p.fuel = Math.max(0, p.fuel - FUEL_USE * dt);
              if (p.fuel <= 0) {
                playAudio('hurt', { pan, volume: 0.4 });
              }
            }

            // 2. Gravitasi sepanjang lereng: tanjakan (angle > 0) memperlambat
            ax -= GRAV * Math.sin(p.angle);

            // 3. Redaman / Drag
            ax -= DRAG * p.vx;

            // 4. Rem & Gigi Mundur
            if (p.brakeHeld) {
              if (p.vx > 0) {
                // Perlambatan rem
                ax -= BRAKE_DEC;
              } else {
                // Mundur (tanpa konsumsi bensin)
                ax -= ENGINE_REV;
              }
            }

            // Integrasi kecepatan & posisi
            p.vx += ax * dt;

            // Batasi kecepatan maju dan mundur
            if (p.vx > MAX_SPEED) p.vx = MAX_SPEED;
            if (p.vx < REV_MAX_SPEED) p.vx = REV_MAX_SPEED;

            p.x += p.vx * dt;

            // Dinding awal lintasan
            if (p.x < 0) {
              p.x = 0;
              if (p.vx < 0) p.vx = 0;
            }

            // Putaran roda sesuai jarak tempuh
            p.wheelAngle += (p.vx * dt) / WHEEL_RADIUS;

            // Pungut kaleng bensin
            track.fuelCans.forEach((can, cIdx) => {
              if (!p.collectedCans.has(cIdx) && Math.abs(p.x - can.x) <= 40) {
                p.collectedCans.add(cIdx);
                p.fuel = Math.min(FUEL_MAX, p.fuel + FUEL_PICKUP);
                playAudio('powerup', { pan, volume: 0.35 });
              }
            });

            // Peringatan bensin rendah (< 20%)
            if (p.fuel > 0 && (p.fuel / FUEL_MAX) < LOW_FUEL_PCT) {
              p.lowFuelBeepTimer += dt;
              if (p.lowFuelBeepTimer >= LOW_FUEL_BEEP_INTERVAL) {
                p.lowFuelBeepTimer = 0;
                playAudio('bounce', { pan, volume: 0.25 });
              }
            } else {
              p.lowFuelBeepTimer = 0;
            }

            // Cek kondisi selesai:
            // (a) Melewati garis finis
            if (p.x >= TRACK_LENGTH_PX) {
              p.finished = true;
              p.done = true;
              p.doneReason = 'finis';
              p.finishTime = performance.now() / 1000;
              checkGameEnd();
            }
            // (b) Bensin habis dan mobil nyaris diam selama 1.5 detik
            else if (p.fuel <= 0 && Math.abs(p.vx) < STOPPED_SPEED_THRESH) {
              p.stoppedTimer += dt;
              if (p.stoppedTimer >= STOPPED_TIME_THRESH) {
                p.done = true;
                p.doneReason = 'out_of_fuel';
                checkGameEnd();
              }
            } else {
              p.stoppedTimer = 0;
            }
          }
        }

        // Update kamera mengikuti mobil
        const scale = Math.min(1.2, vp.h / 400);
        const targetScreenX = vp.w * 0.3;
        const targetScreenY = vp.h * 0.6;
        const targetCamX = p.x - targetScreenX / scale;
        const targetCamY = p.y - targetScreenY / scale;

        p.camX = targetCamX;
        // Kamera vertikal dihaluskan (lerp)
        p.camY += (targetCamY - p.camY) * Math.min(1.0, 8 * dt);
      });
    }

    // =====================================================
    // Renderer: Visual Dunia, Mobil, Kaleng, dan Viewport
    // =====================================================
    function drawSkyAndParallax(vp, camX, scale) {
      // 1. Langit Gradien Siang
      const skyGrad = ctx.createLinearGradient(vp.x, vp.y, vp.x, vp.y + vp.h);
      skyGrad.addColorStop(0, '#38bdf8');
      skyGrad.addColorStop(0.6, '#bae6fd');
      skyGrad.addColorStop(1, '#e0f2fe');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(vp.x, vp.y, vp.w, vp.h);

      // Matahari
      ctx.fillStyle = 'rgba(254, 240, 138, 0.7)';
      ctx.beginPath();
      ctx.arc(vp.x + vp.w * 0.75, vp.y + vp.h * 0.25, vp.h * 0.12, 0, Math.PI * 2);
      ctx.fill();

      // 2. Pegunungan Jauh (Parallax 0.08x)
      ctx.save();
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(vp.x, vp.y + vp.h);
      const mtnBaseY = vp.y + vp.h * 0.55;
      for (let sx = 0; sx <= vp.w; sx += 40) {
        const worldX = (camX * 0.08) + sx / scale;
        const mtnH = Math.sin(worldX * 0.003) * 45 + Math.cos(worldX * 0.007) * 25;
        ctx.lineTo(vp.x + sx, mtnBaseY - mtnH);
      }
      ctx.lineTo(vp.x + vp.w, vp.y + vp.h);
      ctx.fill();

      // 3. Bukit Sedang (Parallax 0.25x)
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(vp.x, vp.y + vp.h);
      const hillBaseY = vp.y + vp.h * 0.65;
      for (let sx = 0; sx <= vp.w; sx += 30) {
        const worldX = (camX * 0.25) + sx / scale;
        const hillH = Math.sin(worldX * 0.006) * 35 + Math.sin(worldX * 0.012) * 15;
        ctx.lineTo(vp.x + sx, hillBaseY - hillH);
      }
      ctx.lineTo(vp.x + vp.w, vp.y + vp.h);
      ctx.fill();
      ctx.restore();
    }

    function drawTerrain(vp, camX, scale) {
      // Hitung rentang X dunia yang terlihat di viewport
      const startWorldX = Math.max(0, camX - 100);
      const endWorldX = Math.min(TRACK_LENGTH_PX + 1000, camX + vp.w / scale + 100);

      ctx.save();

      // 1. Lapisan Tanah Bawah (Coklat Kaya)
      ctx.fillStyle = '#5c3a21';
      ctx.beginPath();
      ctx.moveTo(startWorldX, 1000); // Batas bawah
      for (let wx = startWorldX; wx <= endWorldX; wx += 20) {
        const th = track.getHeightAndSlope(wx).h;
        ctx.lineTo(wx, th);
      }
      ctx.lineTo(endWorldX, 1000);
      ctx.closePath();
      ctx.fill();

      // 2. Lapisan Rumput Hijau Tebal di Permukaan
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let wx = startWorldX; wx <= endWorldX; wx += 15) {
        const th = track.getHeightAndSlope(wx).h;
        if (wx === startWorldX) ctx.moveTo(wx, th);
        else ctx.lineTo(wx, th);
      }
      ctx.stroke();

      // Garis tanah sekunder
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.restore();
    }

    function drawFuelCans(p, camX, scale) {
      const minX = camX - 60;
      const maxX = camX + p.viewport.w / scale + 60;

      track.fuelCans.forEach((can, cIdx) => {
        if (p.collectedCans.has(cIdx)) return;
        if (can.x < minX || can.x > maxX) return;

        const th = track.getHeightAndSlope(can.x);
        const cy = th.h - 16;

        ctx.save();
        ctx.translate(can.x, cy);
        ctx.rotate(th.angle);

        // Badan Kaleng Merah
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.roundRect(-10, -14, 20, 24, 4);
        ctx.fill();
        ctx.strokeStyle = '#b91c1c';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Tutup & Pegangan Kaleng
        ctx.fillStyle = '#fee2e2';
        ctx.fillRect(-4, -18, 8, 4);
        ctx.strokeStyle = '#fee2e2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-6, -14);
        ctx.lineTo(-6, -20);
        ctx.lineTo(6, -20);
        ctx.lineTo(6, -14);
        ctx.stroke();

        // Ikon Bensin (Tetesan)
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⛽', 0, 3);

        ctx.restore();
      });
    }

    function drawFinishGate(camX, scale, vp) {
      const gateX = TRACK_LENGTH_PX;
      if (gateX < camX - 100 || gateX > camX + vp.w / scale + 100) return;

      const th = track.getHeightAndSlope(gateX);
      const baseY = th.h;

      ctx.save();
      ctx.translate(gateX, baseY);
      ctx.rotate(th.angle);

      // Tiang Gerbang Kiri & Kanan
      ctx.fillStyle = '#334155';
      ctx.fillRect(-6, -120, 12, 120);

      // Spanduk Kotak-Kotak Finis di Atas
      const bannerW = 80;
      const bannerH = 26;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-bannerW / 2, -135, bannerW, bannerH);

      // Pola Kotak-Kotak (Checkered Pattern)
      const sqSize = 8;
      for (let bx = -bannerW / 2; bx < bannerW / 2; bx += sqSize) {
        for (let by = -135; by < -135 + bannerH; by += sqSize) {
          const isWhite = ((Math.floor((bx + bannerW/2) / sqSize) + Math.floor((by + 135) / sqSize)) % 2 === 0);
          ctx.fillStyle = isWhite ? '#ffffff' : '#000000';
          ctx.fillRect(bx, by, sqSize, sqSize);
        }
      }

      // Teks "FINISH"
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';
      ctx.strokeText('🏁 FINIS 500M 🏁', 0, -145);
      ctx.fillText('🏁 FINIS 500M 🏁', 0, -145);

      ctx.restore();
    }

    function drawCar(p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      // 1. Badan Mobil Pickup (Berwarna slot pemain)
      ctx.fillStyle = p.color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Bak belakang & kabin
      ctx.moveTo(-CAR_WIDTH / 2, -WHEEL_RADIUS - 2);
      ctx.lineTo(CAR_WIDTH / 2, -WHEEL_RADIUS - 2);
      ctx.lineTo(CAR_WIDTH / 2, -WHEEL_RADIUS - 12);
      ctx.lineTo(CAR_WIDTH / 2 - 14, -WHEEL_RADIUS - 14); // Moncong kap mesin
      ctx.lineTo(CAR_WIDTH / 2 - 20, -WHEEL_RADIUS - 24); // Kaca depan
      ctx.lineTo(-CAR_WIDTH / 2 + 12, -WHEEL_RADIUS - 24); // Atap kabin
      ctx.lineTo(-CAR_WIDTH / 2 + 10, -WHEEL_RADIUS - 14); // Kaca belakang
      ctx.lineTo(-CAR_WIDTH / 2, -WHEEL_RADIUS - 14); // Bak
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Kaca Jendela
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.moveTo(-CAR_WIDTH / 2 + 12, -WHEEL_RADIUS - 14);
      ctx.lineTo(-CAR_WIDTH / 2 + 14, -WHEEL_RADIUS - 22);
      ctx.lineTo(CAR_WIDTH / 2 - 22, -WHEEL_RADIUS - 22);
      ctx.lineTo(CAR_WIDTH / 2 - 18, -WHEEL_RADIUS - 14);
      ctx.closePath();
      ctx.fill();

      // Label Slot Pemain di Pintu Mobil
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.textAlign = 'center';
      ctx.strokeText(p.label, -4, -WHEEL_RADIUS - 7);
      ctx.fillText(p.label, -4, -WHEEL_RADIUS - 7);

      // Lampu Depan
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(CAR_WIDTH / 2 - 4, -WHEEL_RADIUS - 10, 4, 6);

      // 2. Dua Roda Berputar
      drawWheel(WHEEL_OFFSET_BACK, -WHEEL_RADIUS, p.wheelAngle);
      drawWheel(WHEEL_OFFSET_FRONT, -WHEEL_RADIUS, p.wheelAngle);

      ctx.restore();
    }

    function drawWheel(wx, wy, rotAngle) {
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(rotAngle);

      // Ban Hitam
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0, 0, WHEEL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Velg Perak
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(0, 0, WHEEL_RADIUS * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Jeruji Roda (Menunjukkan putaran)
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-WHEEL_RADIUS * 0.5, 0); ctx.lineTo(WHEEL_RADIUS * 0.5, 0);
      ctx.moveTo(0, -WHEEL_RADIUS * 0.5); ctx.lineTo(0, WHEEL_RADIUS * 0.5);
      ctx.stroke();

      ctx.restore();
    }

    function drawViewportHUD(p, vp) {
      ctx.save();

      const padX = 14;
      const padY = 14;

      // 1. Chip Pemain & Jarak Tempuh di Pojok Kiri Atas Viewport
      const meters = Math.min(500, Math.round(p.x / METER));
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(vp.x + padX, vp.y + padY, 180, 52, 10);
      ctx.fill();
      ctx.stroke();

      // Label P{slot}
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = p.color;
      ctx.textAlign = 'left';
      ctx.fillText(p.label, vp.x + padX + 12, vp.y + padY + 22);

      // Jarak
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`🚩 ${meters} m / 500 m`, vp.x + padX + 12, vp.y + padY + 42);

      // 2. Bilah Bensin (Fuel Bar)
      const fuelBarW = 120;
      const fuelBarH = 12;
      const fuelBarX = vp.x + padX + 190;
      const fuelBarY = vp.y + padY + 12;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(fuelBarX, fuelBarY, fuelBarW, fuelBarH, 6);
      ctx.fill();
      ctx.stroke();

      // Isi Bensin
      const fuelPct = Math.max(0, Math.min(1.0, p.fuel / FUEL_MAX));
      let fuelFillColor = '#22c55e'; // Hijau
      if (fuelPct < 0.20) {
        // Kedip merah saat < 20%
        const flash = Math.floor(performance.now() / 250) % 2 === 0;
        fuelFillColor = flash ? '#ef4444' : '#7f1d1d';
      } else if (fuelPct < 0.45) {
        fuelFillColor = '#eab308'; // Kuning
      }

      if (fuelPct > 0) {
        ctx.fillStyle = fuelFillColor;
        ctx.beginPath();
        ctx.roundRect(fuelBarX + 1, fuelBarY + 1, (fuelBarW - 2) * fuelPct, fuelBarH - 2, 5);
        ctx.fill();
      }

      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = fuelPct < 0.20 ? '#fca5a5' : '#cbd5e1';
      ctx.textAlign = 'left';
      ctx.fillText(`⛽ Bensin: ${Math.round(p.fuel)}%`, fuelBarX, fuelBarY + fuelBarH + 15);

      // 3. Lencana Status (GAS, REM, BENSIN HABIS, FINIS)
      const badgeX = vp.x + vp.w - padX;
      const badgeY = vp.y + padY + 14;

      if (p.finished) {
        drawBadge(badgeX, badgeY, '🏆 FINIS!', '#22c55e');
      } else if (p.done && p.doneReason === 'out_of_fuel') {
        drawBadge(badgeX, badgeY, '⚠️ BENSIN HABIS!', '#ef4444');
      } else if (p.gasHeld) {
        drawBadge(badgeX, badgeY, '🚀 GAS', '#3b82f6');
      } else if (p.brakeHeld) {
        drawBadge(badgeX, badgeY, '🛑 REM', '#f97316');
      } else {
        drawBadge(badgeX, badgeY, '⚪ MELUNCUR', '#64748b');
      }

      // 4. Banner "GO!" di awal ronde
      if (goBannerTimer > 0) {
        ctx.save();
        const alpha = Math.min(1.0, goBannerTimer / 0.3);
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 70px sans-serif';
        ctx.fillStyle = '#fde047';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 8;
        ctx.textAlign = 'center';
        ctx.strokeText('GO!', vp.x + vp.w / 2, vp.y + vp.h / 2 + 10);
        ctx.fillText('GO!', vp.x + vp.w / 2, vp.y + vp.h / 2 + 10);
        ctx.restore();
      }

      ctx.restore();
    }

    function drawBadge(x, y, text, color) {
      ctx.save();
      ctx.font = 'bold 13px sans-serif';
      const textW = ctx.measureText(text).width;
      const boxW = textW + 16;
      const boxH = 26;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - boxW, y, boxW, boxH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(text, x - boxW / 2, y + 17);
      ctx.restore();
    }

    function drawTopProgressBar() {
      // Bilah progres balapan horizontal selebar 560 px di tengah atas kanvas
      const barW = 560;
      const barH = 26;
      const barX = (CANVAS_WIDTH - barW) / 2;
      const barY = 10;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 13);
      ctx.fill();
      ctx.stroke();

      // Ikon Start & Finish
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      ctx.fillText('🏁 0m', barX + 8, barY + 17);
      ctx.textAlign = 'right';
      ctx.fillText('500m 🏁', barX + barW - 8, barY + 17);

      // Garis Lintasan
      const trackStartX = barX + 50;
      const trackEndX = barX + barW - 55;
      const trackSpan = trackEndX - trackStartX;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(trackStartX, barY + barH / 2);
      ctx.lineTo(trackEndX, barY + barH / 2);
      ctx.stroke();

      // Penanda Posisi Mobil Tiap Pemain
      playerList.forEach(p => {
        const pct = Math.max(0, Math.min(1.0, p.x / TRACK_LENGTH_PX));
        const markerX = trackStartX + pct * trackSpan;
        const markerY = barY + barH / 2;

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(markerX, markerY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(p.label, markerX, markerY + 3.5);
      });

      ctx.restore();
    }

    function drawSeparators() {
      // Garis pemisah antar viewport
      ctx.save();
      ctx.fillStyle = '#0f172a';

      if (numP === 2) {
        ctx.fillRect(0, 358, CANVAS_WIDTH, 4);
      } else if (numP === 4) {
        ctx.fillRect(638, 0, 4, CANVAS_HEIGHT);
        ctx.fillRect(0, 358, CANVAS_WIDTH, 4);
      }
      ctx.restore();
    }

    function drawOverlays() {
      // 1. Overlay Waiting
      if (state === 'waiting') {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

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
        ctx.fillText('⛰️ Hill Climbing', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 75);

        ctx.font = '20px sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`Kirim 99# dari micro:bit pemain pertama (P${starterPlayer})`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 15);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText('atau klik layar untuk mulai', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);

        ctx.font = '15px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('1, 4, atau 5 = GAS  |  2 atau 3 = REM / MUNDUR  |  0 = LEPAS', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 75);
        ctx.fillStyle = '#fef08a';
        ctx.fillText('💡 Tip: Lepas gas di turunan untuk menghemat bensin dan capai finis!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 105);

        ctx.restore();
      }

      // 2. Overlay Countdown 3-2-1
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
        ctx.fillText('Siap-siap daki bukit...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 105);
        ctx.restore();
      }
    }

    function render() {
      // Render tiap viewport pemain secara terisolasi
      playerList.forEach(p => {
        const vp = p.viewport;
        const scale = Math.min(1.2, vp.h / 400);

        ctx.save();
        ctx.beginPath();
        ctx.rect(vp.x, vp.y, vp.w, vp.h);
        ctx.clip();

        // Latar langit & paralaks
        drawSkyAndParallax(vp, p.camX, scale);

        // Dunia ter-skala & ter-translasi
        ctx.save();
        ctx.translate(vp.x, vp.y);
        ctx.scale(scale, scale);
        ctx.translate(-p.camX, -p.camY);

        // Gambar tanah, kaleng bensin, gerbang finis, dan mobil
        drawTerrain(vp, p.camX, scale);
        drawFuelCans(p, p.camX, scale);
        drawFinishGate(p.camX, scale, vp);
        drawCar(p);

        ctx.restore();

        // Gambar HUD individual di viewport
        drawViewportHUD(p, vp);

        ctx.restore();
      });

      // Pemisah antar viewport
      if (numP > 1) {
        drawSeparators();
      }

      // Bilah progres balapan bersama di atas
      drawTopProgressBar();

      // Overlay waiting & countdown
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
    // Handler Masukan Input
    // =====================================================
    function onInput({ player, cmd }) {
      if (stopped) return;

      if (state === 'waiting') {
        if (cmd === '99' && player === starterPlayer) {
          startCountdown();
        }
        return;
      }

      // Input sebelum "GO!" diabaikan
      if (state !== 'play' && state !== 'celebrate') return;

      const p = playerMap[player];
      if (!p || p.done) return;

      // '1', '4', '5' = GAS
      // '2', '3' = REM / MUNDUR
      // '0' = LEPAS (netral)
      if (cmd === '1' || cmd === '4' || cmd === '5') {
        p.gasHeld = true;
        p.brakeHeld = false;
      } else if (cmd === '2' || cmd === '3') {
        p.brakeHeld = true;
        p.gasHeld = false;
      } else if (cmd === '0') {
        p.gasHeld = false;
        p.brakeHeld = false;
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

