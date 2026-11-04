// GAME: Tank Battle (Top-down tank combat, 2P duel, 2v2 tim, atau 4P FFA)
//
// Kontrak game:
//   id, name, icon, description
//   modes: [{id, label, sub, players}]
//   canvas: {width, height}
//   create({canvas, kernel, players, mode, finish, audio}) -> {stop()}
//
// Sistem skor: tiap tank lawan dihancurkan memberi 1 poin ke tim penembak.
// Menang: sisi pertama mencapai SCORE_TARGET poin ATAU mengeliminasi semua lawan.
//
// Kontrol (via kernel.js):
//   1# = maju (atas)   2# = mundur (bawah)   3# = kiri   4# = kanan
//   0# = berhenti      5# = tembak (saat bermain) / mulai (Player 1 saja)
//   99# = mulai game (Player 1)

const W = 600, H = 800;

// --- Konstanta Fisika & Visual ---
const TS      = 30;      // ukuran tank (px, persegi)
const BS      = 7;       // ukuran peluru (radius px)
const SPEED   = 175;     // kecepatan tank px/dtk
const BSPEED  = 440;     // kecepatan peluru px/dtk
const SHOOT_CD = 0.4;    // cooldown tembak (detik)
const LIVES   = 3;       // nyawa per tank
const SCORE_TARGET = 5;  // poin kemenangan per sisi (SkorTim/eliminasi)
const INVULN  = 2.2;     // durasi invulnerable setelah kena (detik)
const BORDER  = 10;      // tebal border arena
const RESPAWN_DELAY = 1000; // ms sebelum respawn

// Warna per player (P1=biru, P2=oranye, P3=hijau, P4=ungu)
const PCOLORS = ['#4b83ff', '#ff9a2e', '#3ccf8e', '#b98cff'];

// Warna tim untuk mode 2v2 (Merah vs Biru)
const TEAM_COLORS = ['#f5484d', '#3c9eff'];

// Vektor arah
const DVEC = {
  u: {dx:  0, dy: -1},
  d: {dx:  0, dy:  1},
  l: {dx: -1, dy:  0},
  r: {dx:  1, dy:  0},
};

// Perintah numerik → arah
const CMD_DIR = {'1':'u', '2':'d', '3':'l', '4':'r'};

// Dinding arena (simetris, sudah diverifikasi bebas dari posisi spawn)
const WALLS = [
  {x:252, y:368, w:96,  h:64},   // blok tengah
  {x:120, y:384, w:80,  h:24},   // lengan kiri
  {x:400, y:384, w:80,  h:24},   // lengan kanan
  {x:60,  y:180, w:80,  h:60},   // penutup kiri-atas
  {x:460, y:180, w:80,  h:60},   // penutup kanan-atas
  {x:60,  y:560, w:80,  h:60},   // penutup kiri-bawah
  {x:460, y:560, w:80,  h:60},   // penutup kanan-bawah
  {x:240, y:240, w:24,  h:80},   // penghalang tengah-atas kiri
  {x:336, y:240, w:24,  h:80},   // penghalang tengah-atas kanan
  {x:240, y:480, w:24,  h:80},   // penghalang tengah-bawah kiri
  {x:336, y:480, w:24,  h:80},   // penghalang tengah-bawah kanan
];

// Posisi awal per jumlah pemain
const STARTS = {
  2: [
    {x: 285, y: 720, dir: 'u'},
    {x: 285, y:  52, dir: 'd'},
  ],
  4: [
    {x:  28, y: 680, dir: 'u'},
    {x: 542, y: 680, dir: 'u'},
    {x:  28, y:  52, dir: 'd'},
    {x: 542, y:  52, dir: 'd'},
  ],
};

export default {
  id: 'tankbattle',
  name: 'Tank Battle',
  icon: '🪖',
  description: 'Duel tank! Hancurkan tank lawan & raih poin tim. Dukung 1v1, 2v2 tim (Merah vs Biru), dan 4P FFA.',
  modes: [
    {id:'1v1', label:'1 vs 1',          sub:'Duel Satu Lawan Satu',   players:2},
    {id:'2v2', label:'2 vs 2',          sub:'Duel Tim Merah vs Biru', players:4},
    {id:'ffa', label:'4 Player FFA',    sub:'Semua Lawan Semua',      players:4},
  ],
  canvas: {width: W, height: H},

  create({canvas, kernel, players, mode, finish, audio}) {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Pemetaan slot micro:bit → indeks tank lokal
    const slotToTank = {};
    players.forEach((slot, i) => { slotToTank[slot] = i; });

    const numPlayers = players.length;
    const starts = STARTS[numPlayers] || STARTS[2];

    // State game
    const st = {ready: false, over: false};

    // Array peluru, partikel
    let bullets    = [];
    let particles  = [];
    let frameId    = null;
    let lastTime   = null;

    // --- Inisialisasi Tank ---
    const tanks = players.map((slot, i) => ({
      i,                              // indeks lokal
      slot,                           // nomor slot micro:bit
      x:    starts[i].x,
      y:    starts[i].y,
      dir:  starts[i].dir,
      dirMove: null,                  // null = diam
      lives: LIVES,
      alive: true,
      invuln: 0,                      // sisa waktu invulnerable (dtk)
      shootCd: 0,                     // sisa cooldown tembak (dtk)
      color: mode.id === '2v2' ? (i < 2 ? TEAM_COLORS[0] : TEAM_COLORS[1]) : PCOLORS[i],
      label: `P${i+1}`,
    }));

    // --- Sistem tim & skor ---
    // 2v2 = 2 tim (Merah: P1+P2, Biru: P3+P4); 1v1/FFA = tiap pemain timnya sendiri.
    const TEAMS   = mode.id === '2v2' ? [[0, 1], [2, 3]] : tanks.map((_, i) => [i]);
    const teamOf  = ti => TEAMS.findIndex(team => team.includes(ti));
    const TEAM_LABELS = mode.id === '2v2'
      ? ['Tim Merah', 'Tim Biru']
      : tanks.map((_, i) => `P${i + 1}`);
    const scores  = TEAMS.map(() => 0);

    // =====================================================
    // Helper: AABB collision (apakah dua kotak bertumpuk?)
    // =====================================================
    function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
      return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
    }

    // =====================================================
    // Periksa apakah kotak (x,y,w,h) menabrak border/dinding
    // =====================================================
    function collidesWall(x, y, w, h) {
      if (x < BORDER || y < BORDER || x+w > W-BORDER || y+h > H-BORDER) return true;
      for (const wall of WALLS) {
        if (aabb(x, y, w, h, wall.x, wall.y, wall.w, wall.h)) return true;
      }
      return false;
    }

    // =====================================================
    // Periksa apakah tank di posisi (x,y,myIdx) menabrak tank lain
    // =====================================================
    function collidesOtherTank(x, y, myIdx) {
      for (const t of tanks) {
        if (t.i === myIdx || !t.alive) continue;
        if (aabb(x, y, TS, TS, t.x, t.y, TS, TS)) return true;
      }
      return false;
    }

    // =====================================================
    // Spawn partikel ledakan
    // =====================================================
    function spawnExplosion(x, y, color, big) {
      const count = big ? 24 : 10;
      const speed = big ? 220 : 120;
      const life  = big ? 0.9 : 0.5;
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 / count) * i + Math.random() * 0.4;
        const sp  = speed * (0.5 + Math.random() * 0.7);
        particles.push({
          x, y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          life,
          maxLife: life,
          r: big ? 5 : 3,
          color,
        });
      }
    }

    // =====================================================
    // Tembak peluru dari tank t
    // =====================================================
    function shoot(t) {
      if (t.shootCd > 0 || !t.alive) return;
      const v = DVEC[t.dir];
      const cx = t.x + TS/2;
      const cy = t.y + TS/2;
      bullets.push({
        x:  cx + v.dx * (TS/2 + BS + 2),
        y:  cy + v.dy * (TS/2 + BS + 2),
        vx: v.dx * BSPEED,
        vy: v.dy * BSPEED,
        owner: t.i,
        color: t.color,
      });
      t.shootCd = SHOOT_CD;
      audio?.play('shoot');
    }

    // =====================================================
    // Kena tembak: kurangi nyawa, invulnerable, respawn
    // =====================================================
    // Poin untuk tim penembak (1 poin per tank lawan yang dihancurkan)
    function addScore(ti) {
      const team = teamOf(ti);
      if (team < 0) return;
      scores[team]++;
      audio?.play('score');
    }

    function hitTank(t, killer) {
      if (t.invuln > 0 || !t.alive) return;
      t.lives--;
      spawnExplosion(t.x + TS/2, t.y + TS/2, t.color, false);
      audio?.play('hit');

      if (t.lives <= 0) {
        // Mati!
        t.alive = false;
        spawnExplosion(t.x + TS/2, t.y + TS/2, t.color, true);
        audio?.play('lose');
        // Poin untuk tim penembak (pastikan bukan kawan setim)
        if (killer != null && teamOf(killer) !== teamOf(t.i)) addScore(killer);
        // Delay untuk periksa menang
        setTimeout(() => {
          if (!st.over) checkWin();
        }, 300);
      } else {
        // Masih hidup → invulnerable + respawn
        t.alive  = false;
        t.invuln = INVULN;
        setTimeout(() => {
          if (st.over) return;
          const sp = starts[t.i];
          t.x   = sp.x;
          t.y   = sp.y;
          t.dir = sp.dir;
          t.dirMove = null;
          t.alive = true;
          // invuln mulai countdown setelah respawn
          t.invuln = INVULN;
        }, RESPAWN_DELAY);
      }
    }

    // =====================================================
    // Periksa kondisi menang
    // =====================================================
    function checkWin() {
      if (st.over) return;
      // 1) Pemenang skor: sisi pertama mencapai target poin
      const byScore = scores.findIndex(s => s >= SCORE_TARGET);
      // 2) Eliminasi: sisi yang masih punya tank hidup
      const aliveIdx = TEAMS
        .map((team, idx) => team.some(i => tanks[i].lives > 0) ? idx : -1)
        .filter(i => i >= 0);

      const winner = byScore >= 0 ? byScore : (aliveIdx.length === 1 ? aliveIdx[0] : -1);

      if (winner >= 0 || aliveIdx.length === 0) {
        st.over = true;
        const txt = winner >= 0
          ? `${TEAM_LABELS[winner]} Menang! 🏆 (${scores[winner]} poin)`
          : 'Seri! Semua habis.';
        setTimeout(() => finish(txt), 600);
      }
    }

    // =====================================================
    // Update state per frame
    // =====================================================
    function step(dt) {
      // Update cooldown tembak & invulnerable
      for (const t of tanks) {
        if (t.shootCd > 0) t.shootCd = Math.max(0, t.shootCd - dt);
        if (t.invuln > 0 && t.alive) t.invuln = Math.max(0, t.invuln - dt);

        if (!t.alive || !t.dirMove) continue;

        // Gerakkan tank dengan sliding collision
        const v = DVEC[t.dirMove];
        const dx = v.dx * SPEED * dt;
        const dy = v.dy * SPEED * dt;

        let nx = t.x + dx;
        let ny = t.y + dy;

        // Coba gerak penuh dulu
        if (!collidesWall(nx, ny, TS, TS) && !collidesOtherTank(nx, ny, t.i)) {
          t.x = nx; t.y = ny;
        } else {
          // Sliding: coba X saja
          if (!collidesWall(nx, t.y, TS, TS) && !collidesOtherTank(nx, t.y, t.i)) {
            t.x = nx;
          }
          // Sliding: coba Y saja
          else if (!collidesWall(t.x, ny, TS, TS) && !collidesOtherTank(t.x, ny, t.i)) {
            t.y = ny;
          }
        }
      }

      // Update peluru
      const nextBullets = [];
      for (const b of bullets) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // Keluar arena → hapus
        if (b.x < BORDER || b.x > W-BORDER || b.y < BORDER || b.y > H-BORDER) continue;

        // Tabrak dinding → ledakan kecil & hapus
        let hitWall = false;
        for (const wall of WALLS) {
          if (b.x > wall.x && b.x < wall.x+wall.w && b.y > wall.y && b.y < wall.y+wall.h) {
            hitWall = true;
            break;
          }
        }
        if (hitWall) {
          spawnExplosion(b.x, b.y, '#aaa', false);
          audio?.play('bounce');
          continue;
        }

        // Tabrak tank
        let hitTankObj = null;
        for (const t of tanks) {
          if (teamOf(b.owner) === teamOf(t.i)) continue; // jangan kena kawan setim
          if (!t.alive || t.invuln > 0) continue;
          if (b.x > t.x && b.x < t.x+TS && b.y > t.y && b.y < t.y+TS) {
            hitTankObj = t;
            break;
          }
        }
        if (hitTankObj) {
          hitTank(hitTankObj, b.owner);
          spawnExplosion(b.x, b.y, b.color, false);
          continue; // hapus peluru
        }

        nextBullets.push(b);
      }
      bullets = nextBullets;

      // Update partikel
      const nextParticles = [];
      for (const p of particles) {
        p.x    += p.vx * dt;
        p.y    += p.vy * dt;
        p.vx   *= 0.92;
        p.vy   *= 0.92;
        p.life -= dt;
        if (p.life > 0) nextParticles.push(p);
      }
      particles = nextParticles;
    }

    // =====================================================
    // Gambar tank (body, track, turret, laras)
    // =====================================================
    function drawTank(t) {
      const cx = t.x + TS/2;
      const cy = t.y + TS/2;
      const ang = {u: -Math.PI/2, d: Math.PI/2, l: Math.PI, r: 0}[t.dir];

      // Efek kedip saat invulnerable
      if (t.invuln > 0 && Math.floor(t.invuln * 8) % 2 === 0) return;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);

      const alpha = t.alive ? 1 : 0.3;
      ctx.globalAlpha = alpha;

      // Track kiri
      ctx.fillStyle = '#555';
      ctx.fillRect(-TS/2, -TS/2,      5, TS);
      // Track kanan
      ctx.fillRect( TS/2-5, -TS/2,    5, TS);

      // Body
      ctx.fillStyle = t.color;
      ctx.fillRect(-TS/2+6, -TS/2+4, TS-12, TS-8);

      // Turret (lingkaran di tengah)
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI*2);
      ctx.fillStyle = t.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Laras (ke depan = kanan setelah rotate)
      ctx.fillStyle = '#ccc';
      ctx.fillRect(4, -2.5, 14, 5);

      ctx.globalAlpha = 1;
      ctx.restore();

      // Label P1/P2 di atas tank
      ctx.save();
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = t.color;
      ctx.textAlign = 'center';
      ctx.fillText(t.label, cx, t.y - 5);
      ctx.restore();
    }

    // =====================================================
    // Gambar HUD (nyawa setiap pemain)
    // =====================================================
    function drawHUD() {
      const colW = W / 2;

      // --- Papan skor (atas) ---
      ctx.save();
      ctx.textAlign = 'center';
      if (mode.id === '2v2') {
        ctx.font = 'bold 24px Fredoka, sans-serif';
        ctx.fillStyle = TEAM_COLORS[0]; ctx.fillText(`🔴 ${scores[0]}`, W/2 - 66, 38);
        ctx.fillStyle = '#fff';          ctx.fillText(':', W/2, 36);
        ctx.fillStyle = TEAM_COLORS[1]; ctx.fillText(`${scores[1]} 🔵`, W/2 + 66, 38);
        ctx.font = 'bold 11px Fredoka, sans-serif';
        ctx.fillStyle = '#9aa0b3';       ctx.fillText('SKOR TIM', W/2, 58);
      } else {
        const xs = mode.id === 'ffa' ? [20, 155, 300, 450] : [40, W - 40];
        ctx.font = 'bold 18px Fredoka, sans-serif';
        tanks.forEach((t, i) => {
          ctx.fillStyle = t.color;
          ctx.fillText(`${TEAM_LABELS[i]} ${scores[i]}`, xs[i % xs.length], 38);
        });
        ctx.font = 'bold 11px Fredoka, sans-serif';
        ctx.fillStyle = '#9aa0b3';
        ctx.fillText('POIN', W/2, 58);
      }
      ctx.restore();

      // --- Nyawa tiap tank (hearts, bawah) ---
      tanks.forEach((t, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const hy  = H - 46 + row * 28;
        const hx  = col === 0 ? 14 : colW + 14;

        ctx.save();
        ctx.font = 'bold 15px Fredoka, sans-serif';
        ctx.fillStyle = t.color;
        ctx.textAlign = 'left';

        let hearts = '';
        for (let j = 0; j < LIVES; j++) hearts += j < t.lives ? '♥' : '♡';

        ctx.fillText(`${t.label} `, hx, hy);
        ctx.fillStyle = t.lives > 0 ? t.color : '#556';
        ctx.fillText(hearts, hx + 36, hy);
        ctx.restore();
      });
    }

    // =====================================================
    // Gambar latar grid + border + dinding
    // =====================================================
    function drawBackground() {
      // Latar gelap
      ctx.fillStyle = '#1a1f2e';
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx <= W; gx += 40) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }
      for (let gy = 0; gy <= H; gy += 40) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }

      // Border arena
      ctx.strokeStyle = '#445';
      ctx.lineWidth = BORDER;
      ctx.strokeRect(BORDER/2, BORDER/2, W-BORDER, H-BORDER);

      // Dinding
      ctx.fillStyle = '#3a4060';
      for (const wall of WALLS) {
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        ctx.strokeStyle = '#5a6090';
        ctx.lineWidth = 2;
        ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
      }
    }

    // =====================================================
    // Render frame
    // =====================================================
    function draw() {
      drawBackground();

      // Partikel
      for (const p of particles) {
        const alpha = p.life / p.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur  = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * alpha + 1, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      }

      // Peluru
      for (const b of bullets) {
        ctx.save();
        ctx.shadowColor = b.color;
        ctx.shadowBlur  = 12;
        ctx.fillStyle   = '#fff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, BS, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      }

      // Tank
      for (const t of tanks) {
        drawTank(t);
      }

      // HUD nyawa
      drawHUD();

      // Banner siap / game over
      if (!st.ready) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, H/2 - 72, W, 144);
        ctx.font = 'bold 28px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('⚔️ Tank Battle — ' + mode.label, W/2, H/2 - 36);
        ctx.font = '17px sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.fillText('Kirim  99#  dari micro:bit Player 1', W/2, H/2);
        ctx.fillText('atau klik layar untuk mulai', W/2, H/2 + 28);
        ctx.font = '13px sans-serif';
        ctx.fillStyle = '#6af';
        ctx.fillText('← → ↑ ↓ gerak  |  Enter = tembak', W/2, H/2 + 60);
        ctx.restore();
      }

      if (st.over) {
        // Overlay game-over ringan (finish() sudah menampilkan hasil)
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
      const ti = slotToTank[player];
      if (ti == null) return; // slot bukan pemain aktif

      // Mulai game: 99# dari Player 1
      if (!st.ready) {
        if (cmd === '99') {
          beginGame();
        }
        return;
      }
      if (st.over) return;

      const tank = tanks[ti];
      if (!tank) return;

      if (cmd === '99') {
        // Tidak ada efek saat bermain
        return;
      }

      if (CMD_DIR[cmd]) {
        // Gerak & putar
        tank.dir    = CMD_DIR[cmd];
        tank.dirMove = CMD_DIR[cmd];
        return;
      }

      if (cmd === '0') {
        // Berhenti
        tank.dirMove = null;
        return;
      }

      if (cmd === '5' || cmd === '6') {
        // Tembak
        shoot(tank);
        return;
      }
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

