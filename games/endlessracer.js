// GAME: Endless Racer (Top-down scrolling racer — hindari kendaraan dari atas)
//
// Kontrak game:
//   id, name, icon, description
//   modes: [{id, label, sub, players}]
//   canvas: {width, height}
//   create({canvas, kernel, players, mode, finish, audio}) -> {stop()}
//
// Kontrol (via kernel.js):
//   1# / 3# = geser ke kiri
//   2# / 4# = geser ke kanan
//   0#       = berhenti geser (kembali ke tengah secara perlahan)
//   99#      = mulai game (Player 1)

const W = 600, H = 800;

// --- Lebar jalur & kendaraan ---
const ROAD_LEFT  = 80;    // batas kiri jalan
const ROAD_RIGHT = 520;   // batas kanan jalan
const ROAD_W     = ROAD_RIGHT - ROAD_LEFT;  // 440
const LANE_W     = ROAD_W / 4;             // 4 jalur

const CAR_W  = 36;   // lebar mobil pemain
const CAR_H  = 60;   // panjang mobil pemain
const OBS_W  = 36;   // lebar halangan
const OBS_H  = 60;   // panjang halangan

// Warna pemain
const PCOLORS = ['#4b83ff', '#ff9a2e'];

// Warna kendaraan halangan
const OBS_COLORS = ['#e53935','#8e24aa','#00897b','#f4511e','#c0ca33','#039be5'];

// Kecepatan awal & batas
const SCROLL_INIT  = 220;   // px/dtk kecepatan scroll jalan
const SCROLL_MAX   = 600;
const SCROLL_ACC   = 14;    // tambah px/dtk per detik
const CAR_SPEED    = 320;   // kecepatan geser pemain (px/dtk)
const OBS_INTERVAL_MIN = 0.6;   // detik antar spawn halangan (minimum)
const OBS_INTERVAL_START = 1.4; // detik antar spawn (awal)

// Marka jalan (garis putus-putus)
const MARK_H  = 50;
const MARK_GAP = 30;

export default {
  id: 'endlessracer',
  name: 'Endless Racer',
  icon: '🚗',
  description: 'Kebut di jalan tanpa henti! Hindari kendaraan dari atas, bertahan selama mungkin. Dukung 1P dan 2P.',
  modes: [
    {id: '1p', label: '1 Player',  sub: 'Bertahan Sendirian',    players: 1},
    {id: '2p', label: '2 Player',  sub: 'Siapa Bertahan Lama?',  players: 2},
  ],
  canvas: {width: W, height: H},

  create({canvas, kernel, players, mode, finish, audio}) {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const solo = mode.players === 1;
    const numP  = players.length;

    // Pemetaan slot → indeks pemain
    const slotToP = {};
    players.forEach((slot, i) => { slotToP[slot] = i; });

    // =====================================================
    // State game
    // =====================================================
    const st = {ready: false, over: false};
    let scrollY    = 0;      // posisi scroll marka jalan
    let scrollSpeed = SCROLL_INIT;
    let obsTimer   = 0;
    let obsInterval = OBS_INTERVAL_START;
    let elapsed    = 0;      // waktu bermain (dtk)
    let frameId    = null;
    let lastTime   = null;

    let obstacles  = [];

    // =====================================================
    // Inisialisasi mobil pemain
    // =====================================================
    function initCarX(i) {
      if (solo) return ROAD_LEFT + ROAD_W/2 - CAR_W/2;
      // 2P: kiri dan kanan
      return i === 0
        ? ROAD_LEFT + ROAD_W/4 - CAR_W/2
        : ROAD_LEFT + 3*ROAD_W/4 - CAR_W/2;
    }

    const cars = players.map((slot, i) => ({
      i,
      slot,
      x:    initCarX(i),
      y:    H - 120,
      dir:  0,       // -1=kiri, 0=diam, 1=kanan
      alive: true,
      survived: 0,   // dtk bertahan saat mati
      color: PCOLORS[i % PCOLORS.length],
      label: `P${i+1}`,
    }));

    // =====================================================
    // Spawn halangan dari atas
    // =====================================================
    function spawnObstacle() {
      // Pilih jalur acak (4 jalur) — untuk 2P hindari jalur yang sama dua kali
      const laneCount = 4;
      const lane = Math.floor(Math.random() * laneCount);
      const x = ROAD_LEFT + lane * LANE_W + (LANE_W - OBS_W) / 2;
      obstacles.push({
        x,
        y: -OBS_H - 10,
        w: OBS_W,
        h: OBS_H,
        color: OBS_COLORS[Math.floor(Math.random() * OBS_COLORS.length)],
        // Variasi kecepatan halangan
        speedMult: 0.6 + Math.random() * 0.5,
      });
    }

    // =====================================================
    // Periksa AABB collision
    // =====================================================
    function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
      return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
    }

    // =====================================================
    // Update state per frame
    // =====================================================
    function step(dt) {
      elapsed += dt;
      scrollSpeed = Math.min(SCROLL_MAX, SCROLL_INIT + elapsed * SCROLL_ACC);

      // Scroll marka
      scrollY = (scrollY + scrollSpeed * dt) % (MARK_H + MARK_GAP);

      // Interval spawn makin cepat seiring waktu
      obsInterval = Math.max(OBS_INTERVAL_MIN, OBS_INTERVAL_START - elapsed * 0.04);
      obsTimer -= dt;
      if (obsTimer <= 0) {
        spawnObstacle();
        obsTimer = obsInterval * (0.7 + Math.random() * 0.6);
      }

      // Gerakkan mobil pemain
      for (const car of cars) {
        if (!car.alive) continue;
        if (car.dir !== 0) {
          car.x += car.dir * CAR_SPEED * dt;
          // Clamp dalam batas jalan
          car.x = Math.max(ROAD_LEFT, Math.min(ROAD_RIGHT - CAR_W, car.x));
        }
      }

      // Gerakkan halangan ke bawah
      const nextObs = [];
      for (const obs of obstacles) {
        obs.y += scrollSpeed * obs.speedMult * dt;
        if (obs.y > H + OBS_H) continue; // keluar layar

        // Cek collision dengan setiap mobil pemain
        for (const car of cars) {
          if (!car.alive) continue;
          if (aabb(car.x, car.y, CAR_W, CAR_H, obs.x, obs.y, obs.w, obs.h)) {
            // Tabrak!
            car.alive   = false;
            car.survived = elapsed;
            audio?.play('lose');
            checkAllDead();
          }
        }

        nextObs.push(obs);
      }
      obstacles = nextObs;
    }

    // =====================================================
    // Periksa apakah semua pemain mati
    // =====================================================
    function checkAllDead() {
      const aliveCars = cars.filter(c => c.alive);
      if (aliveCars.length > 0) return; // masih ada yang hidup

      st.over = true;
      const best = cars.reduce((a, b) => a.survived >= b.survived ? a : b);

      setTimeout(() => {
        if (solo) {
          finish(`Bertahan ${best.survived.toFixed(1)} detik! 🏁`);
        } else {
          // Siapa bertahan lebih lama?
          const winner = cars.reduce((a, b) => a.survived >= b.survived ? a : b);
          const tied = cars.every(c => Math.abs(c.survived - winner.survived) < 0.05);
          finish(tied
            ? `Seri! Semua bertahan ${winner.survived.toFixed(1)} dtk`
            : `${winner.label} Bertahan Paling Lama! (${winner.survived.toFixed(1)} dtk)`);
        }
      }, 500);
    }

    // =====================================================
    // Gambar latar jalan
    // =====================================================
    function drawRoad() {
      // Latar bumi
      ctx.fillStyle = '#1a1f2e';
      ctx.fillRect(0, 0, W, H);

      // Tanah di luar jalan
      ctx.fillStyle = '#1e3a1e';
      ctx.fillRect(0,          0, ROAD_LEFT,       H);
      ctx.fillRect(ROAD_RIGHT, 0, W - ROAD_RIGHT,  H);

      // Aspal
      ctx.fillStyle = '#2a2f3e';
      ctx.fillRect(ROAD_LEFT, 0, ROAD_W, H);

      // Tepi jalan (garis putih solid)
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(ROAD_LEFT,  0); ctx.lineTo(ROAD_LEFT,  H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ROAD_RIGHT, 0); ctx.lineTo(ROAD_RIGHT, H); ctx.stroke();

      // Marka putus-putus antar jalur
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([MARK_H, MARK_GAP]);
      ctx.lineDashOffset = -scrollY;
      for (let lane = 1; lane < 4; lane++) {
        const lx = ROAD_LEFT + lane * LANE_W;
        ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, H); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;

      // Tanaman/batas (opsional dekoratif)
      ctx.fillStyle = '#2d5a2d';
      ctx.fillRect(0, 0, ROAD_LEFT-4, H);
      ctx.fillRect(ROAD_RIGHT+4, 0, W-ROAD_RIGHT-4, H);
    }

    // =====================================================
    // Gambar mobil pemain
    // =====================================================
    function drawCar(car) {
      if (!car.alive) return;
      const {x, y, color} = car;

      ctx.save();

      // Body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, CAR_W, CAR_H, 6);
      ctx.fill();

      // Kaca depan (atas)
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(x+4, y+6, CAR_W-8, 14);

      // Roda
      ctx.fillStyle = '#222';
      ctx.fillRect(x-5,       y+8,       8, 14);  // kiri depan
      ctx.fillRect(x+CAR_W-3, y+8,       8, 14);  // kanan depan
      ctx.fillRect(x-5,       y+CAR_H-22, 8, 14);  // kiri belakang
      ctx.fillRect(x+CAR_W-3, y+CAR_H-22, 8, 14);  // kanan belakang

      // Label
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(car.label, x + CAR_W/2, y - 5);

      ctx.restore();
    }

    // =====================================================
    // Gambar halangan
    // =====================================================
    function drawObstacle(obs) {
      ctx.save();
      ctx.fillStyle = obs.color;
      ctx.beginPath();
      ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 5);
      ctx.fill();

      // Kaca
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(obs.x+4, obs.y+obs.h-20, obs.w-8, 14);

      // Roda
      ctx.fillStyle = '#111';
      ctx.fillRect(obs.x-4,       obs.y+6,        7, 12);
      ctx.fillRect(obs.x+obs.w-3, obs.y+6,        7, 12);
      ctx.fillRect(obs.x-4,       obs.y+obs.h-18, 7, 12);
      ctx.fillRect(obs.x+obs.w-3, obs.y+obs.h-18, 7, 12);
      ctx.restore();
    }

    // =====================================================
    // Gambar HUD (skor waktu)
    // =====================================================
    function drawHUD() {
      ctx.save();
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(`⏱ ${elapsed.toFixed(1)} dtk`, W/2, 32);

      // Kecepatan
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#aaa';
      ctx.fillText(`🚀 ${Math.round(scrollSpeed)} px/s`, W/2, 52);

      // Status pemain
      if (!solo) {
        cars.forEach((car, i) => {
          const hx = i === 0 ? ROAD_LEFT + 10 : W/2 + 10;
          ctx.font = 'bold 12px sans-serif';
          ctx.fillStyle = car.alive ? car.color : '#555';
          ctx.textAlign = 'left';
          ctx.fillText(
            car.alive
              ? `${car.label}: ✅`
              : `${car.label}: 💥 ${car.survived.toFixed(1)}s`,
            hx, H - 15
          );
        });
      }
      ctx.restore();
    }

    // =====================================================
    // Render frame
    // =====================================================
    function draw() {
      drawRoad();

      for (const obs of obstacles) drawObstacle(obs);
      for (const car of cars)      drawCar(car);

      drawHUD();

      // Banner siap
      if (!st.ready) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, H/2 - 80, W, 160);
        ctx.font = 'bold 30px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('🚗 Endless Racer', W/2, H/2 - 38);
        ctx.font = '17px sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.fillText('Kirim  99#  dari micro:bit Player 1', W/2, H/2 + 2);
        ctx.fillText('atau klik layar untuk mulai', W/2, H/2 + 30);
        ctx.font = '13px sans-serif';
        ctx.fillStyle = '#6af';
        ctx.fillText('← → geser  |  hindari kendaraan dari atas!', W/2, H/2 + 60);
        ctx.restore();
      }

      if (st.over) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }

    // =====================================================
    // Game loop
    // =====================================================
    function loop(ts) {
      if (lastTime == null) lastTime = ts;
      const dt = Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;

      if (st.ready && !st.over) step(dt);
      draw();

      frameId = requestAnimationFrame(loop);
    }

    // =====================================================
    // Mulai permainan
    // =====================================================
    function beginGame() {
      if (st.ready) return;
      st.ready = true;
      audio?.play('start');
    }

    // =====================================================
    // Handler input
    // =====================================================
    function onInput({player, cmd}) {
      const pi = slotToP[player];
      if (pi == null) return;

      if (!st.ready) {
        if (cmd === '99') beginGame();
        return;
      }
      if (st.over) return;

      const car = cars[pi];
      if (!car || !car.alive) return;

      if (cmd === '1' || cmd === '3') { car.dir = -1; return; }
      if (cmd === '2' || cmd === '4') { car.dir =  1; return; }
      if (cmd === '0')                { car.dir =  0; return; }
    }

    // Click canvas untuk mulai
    function onCanvasClick() {
      if (!st.ready) beginGame();
    }

    // Daftarkan listener
    const off = kernel.on('input', onInput);
    canvas.addEventListener('click', onCanvasClick);

    // Mulai render
    frameId = requestAnimationFrame(loop);

    // =====================================================
    // Kembalikan fungsi stop untuk cleanup
    // =====================================================
    return {
      stop() {
        cancelAnimationFrame(frameId);
        off();
        canvas.removeEventListener('click', onCanvasClick);
      }
    };
  }
};

