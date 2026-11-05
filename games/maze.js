// GAME: Maze Race (Labirin Petualangan 1–4 Pemain)
//
// Fitur:
//   - Labirin Simetris 4-Kuadran (4-Way Quadrant Symmetry): 100% adil untuk 4 sudut pemain
//   - Sistem 3 Babak Bertingkat (Round 1 Easy, Round 2 Medium, Round 3 Final)
//   - Kristal Energi (+50 poin & speed boost) & Gerbang Laser Berdenyut (Stun 1 dtk)
//   - Corner Assist Buffer (pergerakan mulus di persimpangan lorong)
//   - Antarmuka lobi bersih tanpa konfigurasi options
//
// Kontrol (via Kernel):
//   1# = Atas     2# = Bawah    3# = Kiri    4# = Kanan
//   0# = Berhenti 5# = Aksi / Mulai (Player 1)
//   99# = Mulai (Player 1) atau klik canvas

const W = 1280;
const H = 720;

// Grid labirin (harus berukuran ganjil agar memiliki sel pusat tepat)
const COLS = 29;
const ROWS = 15;
const CS   = 38; // Ukuran sel px (29 * 38 = 1102, 15 * 38 = 570)
const OX   = Math.floor((W - COLS * CS) / 2); // 89 px
const OY   = 95; // 95 px (tersedia ruang aman 95 px di atas untuk HUD dan overlay)

const TOTAL_ROUNDS = 3;
const ROUND_TIME   = 60; // detik per ronde
const SPEED_NORMAL = 180; // px/dtk
const SPEED_BOOST  = 215; // px/dtk saat ambil kristal
const ROBOT_R      = 12; // radius robot visual (diameter 24 px)
const HITBOX_R     = 9.5; // toleransi tabrakan dinding
const CORNER_SNAP  = 11; // toleransi belokan di sudut lorong (px)

// Warna pemain konsisten sesuai nomor slot fisik
const PCOLORS = {
  1: {main: '#4b83ff', light: '#85aeff', glow: 'rgba(75,131,255,0.45)'},
  2: {main: '#ff9a2e', light: '#ffc17a', glow: 'rgba(255,154,46,0.45)'},
  3: {main: '#3ccf8e', light: '#7be3b5', glow: 'rgba(60,207,142,0.45)'},
  4: {main: '#b98cff', light: '#d8bfff', glow: 'rgba(185,140,255,0.45)'}
};

// Titik spawn 4 sudut dalam koordinat sel (col, row)
const SPAWN_CELLS = {
  1: {c: 1, r: 1},                    // TL
  2: {c: COLS - 2, r: 1},             // TR
  3: {c: 1, r: ROWS - 2},             // BL
  4: {c: COLS - 2, r: ROWS - 2}       // BR
};

const CENTER_C = Math.floor(COLS / 2); // 14
const CENTER_R = Math.floor(ROWS / 2); // 7

// ── Generator Angka Acak Ber-seed (Mulberry32) ─────────────────────
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Generator Labirin Simetris 4-Kuadran ───────────────────────────
function generateSymmetricMaze(round, rng) {
  // 1 = Dinding, 0 = Lorong
  const grid = Array.from({length: ROWS}, () => new Uint8Array(COLS).fill(1));

  // Ruang terbuka di tengah untuk Portal Inti (3x3 sel di pusat)
  for (let r = CENTER_R - 1; r <= CENTER_R + 1; r++) {
    for (let c = CENTER_C - 1; c <= CENTER_C + 1; c++) {
      grid[r][c] = 0;
    }
  }

  // Node DFS untuk kuadran kiri-atas:
  // r ganjil dari 1 sampai CENTER_R (1, 3, 5, 7)
  // c ganjil dari 1 sampai CENTER_C (1, 3, 5, 7, 9, 11, 13)
  const nodeCols = [];
  for (let c = 1; c <= CENTER_C; c += 2) nodeCols.push(c);
  const nodeRows = [];
  for (let r = 1; r <= CENTER_R; r += 2) nodeRows.push(r);

  const visited = new Set();
  const key = (c, r) => `${c},${r}`;

  // Mulai DFS dari sel dekat pusat: (13, 7)
  const stack = [[nodeCols[nodeCols.length - 1], nodeRows[nodeRows.length - 1]]];
  visited.add(key(stack[0][0], stack[0][1]));
  grid[stack[0][1]][stack[0][0]] = 0;

  const dirs = [
    {dc: 2, dr: 0},
    {dc: -2, dr: 0},
    {dc: 0, dr: 2},
    {dc: 0, dr: -2}
  ];

  while (stack.length > 0) {
    const [cc, cr] = stack[stack.length - 1];
    // Acak arah tetangga
    const neighbors = [];
    for (const d of dirs) {
      const nc = cc + d.dc;
      const nr = cr + d.dr;
      if (nc >= 1 && nc <= CENTER_C && nr >= 1 && nr <= CENTER_R) {
        if (!visited.has(key(nc, nr))) {
          neighbors.push({nc, nr, wc: cc + d.dc / 2, wr: cr + d.dr / 2});
        }
      }
    }

    if (neighbors.length > 0) {
      const chosen = neighbors[Math.floor(rng() * neighbors.length)];
      visited.add(key(chosen.nc, chosen.nr));
      grid[chosen.nr][chosen.nc] = 0;
      grid[chosen.wr][chosen.wc] = 0; // jebol dinding di antara
      stack.push([chosen.nc, chosen.nr]);
    } else {
      stack.pop();
    }
  }

  // Pada Ronde 1 (Easy) dan 2 (Medium), buka beberapa jalan tembus ekstra
  // agar labirin lebih ramah dan memberi rute alternatif
  const extraOpenings = round === 1 ? 8 : round === 2 ? 4 : 1;
  for (let i = 0; i < extraOpenings; i++) {
    const rc = 1 + Math.floor(rng() * (CENTER_C - 1));
    const rr = 1 + Math.floor(rng() * (CENTER_R - 1));
    if (grid[rr][rc] === 1) {
      // Buka jika menghubungkan dua lorong
      const horiz = (grid[rr][rc - 1] === 0 && grid[rr][rc + 1] === 0);
      const vert  = (grid[rr - 1][rc] === 0 && grid[rr + 1][rc] === 0);
      if (horiz || vert) grid[rr][rc] = 0;
    }
  }

  // Pastikan sel spawn kiri-atas (1, 1) terbuka dan punya jalan keluar
  grid[1][1] = 0;
  if (grid[1][2] === 1 && grid[2][1] === 1) grid[1][2] = 0;

  // ── CERMINKAN KE 3 KUADRAN LAINNYA (4-Way Symmetry) ───────────────
  for (let r = 0; r <= CENTER_R; r++) {
    for (let c = 0; c <= CENTER_C; c++) {
      const val = grid[r][c];
      const mr = ROWS - 1 - r;
      const mc = COLS - 1 - c;
      grid[r][mc] = val;   // Cermin kanan (TR)
      grid[mr][c] = val;   // Cermin bawah (BL)
      grid[mr][mc] = val;  // Cermin diagonal (BR)
    }
  }

  // ── TEMPATKAN KRISTAL ENERGI SECARA SIMETRIS ─────────────────────
  // Ronde 1: 3 kristal per kuadran (total 12)
  // Ronde 2: 4 kristal per kuadran (total 16)
  // Ronde 3: 5 kristal per kuadran (total 20)
  const numCrystalsPerQ = round === 1 ? 3 : round === 2 ? 4 : 5;
  const crystals = [];
  const candidateCells = [];

  for (let r = 2; r < CENTER_R; r++) {
    for (let c = 2; c < CENTER_C; c++) {
      if (grid[r][c] === 0) {
        candidateCells.push({c, r});
      }
    }
  }

  // Acak kandidat sel
  for (let i = candidateCells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidateCells[i], candidateCells[j]] = [candidateCells[j], candidateCells[i]];
  }

  const chosenBase = candidateCells.slice(0, numCrystalsPerQ);
  chosenBase.forEach((pt, idx) => {
    const pts = [
      {c: pt.c, r: pt.r},
      {c: COLS - 1 - pt.c, r: pt.r},
      {c: pt.c, r: ROWS - 1 - pt.r},
      {c: COLS - 1 - pt.c, r: ROWS - 1 - pt.r}
    ];
    pts.forEach((p, pIdx) => {
      crystals.push({
        id: `c_${idx}_${pIdx}`,
        c: p.c, r: p.r,
        x: OX + p.c * CS + CS / 2,
        y: OY + p.r * CS + CS / 2,
        alive: true
      });
    });
  });

  // ── TEMPATKAN GERBANG LASER SECARA SIMETRIS ──────────────────────
  // Ronde 1: Tanpa laser
  // Ronde 2: 1 laser per kuadran (total 4)
  // Ronde 3: 2 laser per kuadran (total 8)
  const lasers = [];
  const numLasersPerQ = round === 1 ? 0 : round === 2 ? 1 : 2;
  const laserCandidates = [];

  for (let r = 3; r <= CENTER_R; r++) {
    for (let c = 3; c <= CENTER_C; c++) {
      if (grid[r][c] === 0) {
        // Cek lorong vertikal atau horizontal
        const isHoriz = grid[r][c - 1] === 0 && grid[r][c + 1] === 0 && grid[r - 1][c] === 1 && grid[r + 1][c] === 1;
        const isVert  = grid[r - 1][c] === 0 && grid[r + 1][c] === 0 && grid[r][c - 1] === 1 && grid[r][c + 1] === 1;
        if (isHoriz || isVert) {
          laserCandidates.push({c, r, horiz: isHoriz});
        }
      }
    }
  }

  for (let i = laserCandidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [laserCandidates[i], laserCandidates[j]] = [laserCandidates[j], laserCandidates[i]];
  }

  const chosenLasers = laserCandidates.slice(0, numLasersPerQ);
  chosenLasers.forEach((l, idx) => {
    const pts = [
      {c: l.c, r: l.r, horiz: l.horiz},
      {c: COLS - 1 - l.c, r: l.r, horiz: l.horiz},
      {c: l.c, r: ROWS - 1 - l.r, horiz: l.horiz},
      {c: COLS - 1 - l.c, r: ROWS - 1 - l.r, horiz: l.horiz}
    ];
    pts.forEach((p, pIdx) => {
      lasers.push({
        id: `las_${idx}_${pIdx}`,
        c: p.c, r: p.r,
        x: OX + p.c * CS + CS / 2,
        y: OY + p.r * CS + CS / 2,
        horiz: p.horiz,
        offset: idx * 0.7 // stagger fasa denyut
      });
    });
  });

  return {grid, crystals, lasers};
}

// ── Game Factory ──────────────────────────────────────────────────
function create({canvas, kernel, players, mode, finish, audio}) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;

  let animId = null;
  let lastTime = performance.now();
  let state = 'waiting'; // 'waiting' | 'countdown' | 'playing' | 'intermission' | 'gameover'
  let countdownSec = 3;
  let countdownTimer = 0;
  let currentRound = 1;
  let roundTimer = ROUND_TIME;
  let intermissionTimer = 0;
  let roundWinner = null;
  let finishCalled = false;

  const baseSeed = Date.now() ^ (Math.random() * 0xFFFFFFF);
  let roundSeed = baseSeed;
  let mazeData = null;

  // Data Skor Akumulasi Pemain (berdasarkan slot nomor fisik)
  const playerScores = {};
  const crystalsCollected = {};
  players.forEach(n => {
    playerScores[n] = 0;
    crystalsCollected[n] = 0;
  });

  // State Dinamis Robot Pemain
  let robots = [];

  function initRound(roundNum) {
    currentRound = roundNum;
    roundTimer = ROUND_TIME;
    roundWinner = null;
    roundSeed = (baseSeed + roundNum * 7919) >>> 0;
    const rng = makeRng(roundSeed);
    mazeData = generateSymmetricMaze(currentRound, rng);

    robots = players.map(n => {
      const cell = SPAWN_CELLS[n] || {c: 1, r: 1};
      return {
        n,
        col: cell.c,
        row: cell.r,
        x: OX + cell.c * CS + CS / 2,
        y: OY + cell.r * CS + CS / 2,
        targetDx: 0,
        targetDy: 0,
        dx: 0,
        dy: 0,
        boostTime: 0,
        stunTime: 0,
        finished: false,
        finishTime: 0
      };
    });
  }

  initRound(1);

  // ── Input Listener Kernel ───────────────────────────────────────
  const unbindInput = kernel.on('input', ({player, cmd}) => {
    // Mulai game dengan 99# dari pemain pertama di fase standby
    if (state === 'waiting' && cmd === '99' && player === players[0]) {
      startCountdown();
      return;
    }

    if (state !== 'playing') return;

    const r = robots.find(bot => bot.n === player);
    if (!r || r.finished) return;

    if (cmd === '1') { r.targetDx = 0; r.targetDy = -1; audio.play('click', {volume: 0.2}); }
    else if (cmd === '2') { r.targetDx = 0; r.targetDy = 1; audio.play('click', {volume: 0.2}); }
    else if (cmd === '3') { r.targetDx = -1; r.targetDy = 0; audio.play('click', {volume: 0.2}); }
    else if (cmd === '4') { r.targetDx = 1; r.targetDy = 0; audio.play('click', {volume: 0.2}); }
    else if (cmd === '0') { r.targetDx = 0; r.targetDy = 0; }
  });

  const onCanvasClick = () => {
    if (state === 'waiting') startCountdown();
  };
  canvas.addEventListener('click', onCanvasClick);

  function startCountdown() {
    state = 'countdown';
    countdownSec = 3;
    countdownTimer = 0;
    audio.play('click');
  }

  // ── Fisika & Tabrakan Dinding ────────────────────────────────────
  function isWall(c, r) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return true;
    return mazeData.grid[r][c] === 1;
  }

  function collidesWithWall(x, y) {
    // Cek titik batas kotak robot terhadap grid
    const minC = Math.floor((x - HITBOX_R - OX) / CS);
    const maxC = Math.floor((x + HITBOX_R - OX) / CS);
    const minR = Math.floor((y - HITBOX_R - OY) / CS);
    const maxR = Math.floor((y + HITBOX_R - OY) / CS);

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (isWall(c, r)) return true;
      }
    }
    return false;
  }

  // Update Robot dengan Corner Assist
  function updateRobot(r, dt) {
    if (r.finished) return;

    if (r.stunTime > 0) {
      r.stunTime -= dt;
      return;
    }
    if (r.boostTime > 0) r.boostTime -= dt;

    const speed = r.boostTime > 0 ? SPEED_BOOST : SPEED_NORMAL;

    // Terapkan Corner Assist ketika pemain ingin berbelok
    if (r.targetDx !== 0 && r.targetDy === 0) {
      // Ingin belok horizontal: selaraskan posisi Y ke tengah sel terdekat jika dalam toleransi
      const curCellY = Math.floor((r.y - OY) / CS);
      const centerY  = OY + curCellY * CS + CS / 2;
      const diffY    = centerY - r.y;
      if (Math.abs(diffY) <= CORNER_SNAP) {
        r.y += Math.sign(diffY) * Math.min(Math.abs(diffY), speed * dt);
      }
      r.dx = r.targetDx;
      r.dy = 0;
    } else if (r.targetDy !== 0 && r.targetDx === 0) {
      // Ingin belok vertikal: selaraskan posisi X ke tengah sel terdekat
      const curCellX = Math.floor((r.x - OX) / CS);
      const centerX  = OX + curCellX * CS + CS / 2;
      const diffX    = centerX - r.x;
      if (Math.abs(diffX) <= CORNER_SNAP) {
        r.x += Math.sign(diffX) * Math.min(Math.abs(diffX), speed * dt);
      }
      r.dy = r.targetDy;
      r.dx = 0;
    } else if (r.targetDx === 0 && r.targetDy === 0) {
      r.dx = 0;
      r.dy = 0;
    }

    // Gerakkan sumbu X
    if (r.dx !== 0) {
      const nextX = r.x + r.dx * speed * dt;
      if (!collidesWithWall(nextX, r.y)) {
        r.x = nextX;
      } else {
        r.dx = 0; // Membentur dinding
      }
    }

    // Gerakkan sumbu Y
    if (r.dy !== 0) {
      const nextY = r.y + r.dy * speed * dt;
      if (!collidesWithWall(r.x, nextY)) {
        r.y = nextY;
      } else {
        r.dy = 0; // Membentur dinding
      }
    }

    // Update index sel
    r.col = Math.floor((r.x - OX) / CS);
    r.row = Math.floor((r.y - OY) / CS);

    // Ambil Kristal Energi
    mazeData.crystals.forEach(cry => {
      if (cry.alive) {
        const dist = Math.hypot(r.x - cry.x, r.y - cry.y);
        if (dist < ROBOT_R + 10) {
          cry.alive = false;
          r.boostTime = 1.6;
          playerScores[r.n] += 50;
          crystalsCollected[r.n] += 1;
          audio.play('point', {volume: 0.45});
        }
      }
    });

    // Cek Tabrakan dengan Laser Kejut Aktif
    const nowSec = performance.now() / 1000;
    mazeData.lasers.forEach(las => {
      // Siklus 3.6 dtk: 1.8 dtk mati, 1.8 dtk aktif menyengat
      const cycle = (nowSec + las.offset) % 3.6;
      const isLaserActive = cycle > 1.8;
      if (isLaserActive) {
        const dist = Math.hypot(r.x - las.x, r.y - las.y);
        if (dist < ROBOT_R + 8) {
          r.stunTime = 1.0;
          r.dx = 0; r.dy = 0;
          r.targetDx = 0; r.targetDy = 0;
          audio.play('hurt', {volume: 0.5});
        }
      }
    });

    // Cek Mencapai Portal Inti di Pusat
    const portalCenterX = OX + CENTER_C * CS + CS / 2;
    const portalCenterY = OY + CENTER_R * CS + CS / 2;
    const distToPortal = Math.hypot(r.x - portalCenterX, r.y - portalCenterY);

    if (distToPortal <= 26) {
      r.finished = true;
      r.finishTime = roundTimer;
      if (!roundWinner) {
        roundWinner = r.n;
        const portalBonus = currentRound === 1 ? 300 : currentRound === 2 ? 400 : 500;
        const timeBonus   = Math.floor(roundTimer) * 2;
        playerScores[r.n] += (portalBonus + timeBonus);
        audio.play('win', {volume: 0.6});
        triggerIntermission();
      }
    }
  }

  function triggerIntermission() {
    state = 'intermission';
    intermissionTimer = 3.6; // Durasi selebrasi ronde
  }

  function endEntireGame() {
    state = 'gameover';
    if (finishCalled) return;
    finishCalled = true;

    // Tentukan Pemenang Tertinggi
    const ranking = [...players].sort((a, b) => playerScores[b] - playerScores[a]);
    const topScore = playerScores[ranking[0]];
    const winners = ranking.filter(p => playerScores[p] === topScore);

    let summary = '';
    if (players.length === 1) {
      summary = `Selamat! Misi Labirin Selesai! 🧭\nTotal Skor: ${topScore} Poin | Kristal: ${crystalsCollected[players[0]]}`;
    } else if (winners.length === 1) {
      const w = winners[0];
      const detailScores = players.map(p => `P${p}: ${playerScores[p]}`).join(' | ');
      summary = `Player ${w} Juara Labirin ROBOPANDA! 🏆\n${detailScores}`;
    } else {
      const seriList = winners.map(p => `P${p}`).join(' & ');
      summary = `Pertandingan Seri Antara ${seriList}! 🤝\nSkor Bersama: ${topScore} Poin`;
    }

    finish(summary);
  }

  // ── Loop Permainan Utama ─────────────────────────────────────────
  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // Update Logika
    if (state === 'countdown') {
      countdownTimer += dt;
      if (countdownTimer >= 1.0) {
        countdownTimer -= 1.0;
        countdownSec--;
        if (countdownSec > 0) {
          audio.play('click');
        } else {
          state = 'playing';
          audio.play('start');
        }
      }
    } else if (state === 'playing') {
      roundTimer -= dt;
      if (roundTimer <= 0) {
        roundTimer = 0;
        triggerIntermission();
      } else {
        robots.forEach(bot => updateRobot(bot, dt));
      }
    } else if (state === 'intermission') {
      intermissionTimer -= dt;
      if (intermissionTimer <= 0) {
        if (currentRound < TOTAL_ROUNDS) {
          initRound(currentRound + 1);
          state = 'playing';
          audio.play('start');
        } else {
          endEntireGame();
        }
      }
    }

    // Render Canvas
    render(now);

    if (state !== 'gameover') {
      animId = requestAnimationFrame(loop);
    }
  }

  // ── Render Fungsi Grafis ─────────────────────────────────────────
  function render(now) {
    // Latar Belakang Gelap Luar Angkasa / Sci-Fi
    ctx.fillStyle = '#0c101a';
    ctx.fillRect(0, 0, W, H);

    // Latar Lantai Labirin
    ctx.fillStyle = '#141c2c';
    ctx.fillRect(OX, OY, COLS * CS, ROWS * CS);

    // Garis Kisi Halus di Lantai Labirin
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(OX + c * CS, OY);
      ctx.lineTo(OX + c * CS, OY + ROWS * CS);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(OX, OY + r * CS);
      ctx.lineTo(OX + COLS * CS, OY + r * CS);
      ctx.stroke();
    }

    // Gambar Dinding Labirin
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (mazeData.grid[r][c] === 1) {
          const wx = OX + c * CS;
          const wy = OY + r * CS;

          // Blok Dinding
          ctx.fillStyle = '#1a243a';
          ctx.fillRect(wx, wy, CS, CS);

          // Glow Border Dinding
          ctx.strokeStyle = 'rgba(75,131,255,0.35)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(wx + 0.5, wy + 0.5, CS - 1, CS - 1);
        }
      }
    }

    // Portal Inti (Goal) di Tengah
    const portalX = OX + CENTER_C * CS + CS / 2;
    const portalY = OY + CENTER_R * CS + CS / 2;
    const pulse = 1 + Math.sin(now / 180) * 0.12;

    // Glow Lingkaran Luar Portal
    const grad = ctx.createRadialGradient(portalX, portalY, 6, portalX, portalY, 34 * pulse);
    grad.addColorStop(0, 'rgba(255,215,0,0.85)');
    grad.addColorStop(0.5, 'rgba(255,140,0,0.4)');
    grad.addColorStop(1, 'rgba(255,140,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(portalX, portalY, 34 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Cincin Portal Berputar
    ctx.save();
    ctx.translate(portalX, portalY);
    ctx.rotate(now / 500);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 1.5);
    ctx.stroke();
    ctx.restore();

    // Ikon Piala / Inti di Tengah Portal
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆', portalX, portalY);

    // Gambar Kristal Energi (♦)
    mazeData.crystals.forEach(cry => {
      if (cry.alive) {
        const floatY = Math.sin(now / 220 + cry.c) * 3;
        ctx.save();
        ctx.translate(cry.x, cry.y + floatY);

        // Glow Kristal
        ctx.fillStyle = 'rgba(60,207,142,0.3)';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();

        // Berlian Hijau Neon
        ctx.fillStyle = '#3ccf8e';
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(7, 0);
        ctx.lineTo(0, 9);
        ctx.lineTo(-7, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-2, -3, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    // Gambar Gerbang Laser
    const nowSec = now / 1000;
    mazeData.lasers.forEach(las => {
      const cycle = (nowSec + las.offset) % 3.6;
      const isLaserActive = cycle > 1.8;
      const isWarning = cycle > 1.3 && cycle <= 1.8;

      ctx.save();
      ctx.translate(las.x, las.y);

      // Pemancar Laser di Kedua Sisi
      ctx.fillStyle = '#4a5568';
      if (las.horiz) {
        ctx.fillRect(-CS / 2, -5, 6, 10);
        ctx.fillRect(CS / 2 - 6, -5, 6, 10);
      } else {
        ctx.fillRect(-5, -CS / 2, 10, 6);
        ctx.fillRect(-5, CS / 2 - 6, 10, 6);
      }

      if (isLaserActive) {
        // Berkas Sinar Laser Merah Terang
        ctx.strokeStyle = '#ff334b';
        ctx.lineWidth = 4 + Math.sin(now / 40) * 1.5;
        ctx.shadowColor = '#ff334b';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        if (las.horiz) {
          ctx.moveTo(-CS / 2 + 5, 0);
          ctx.lineTo(CS / 2 - 5, 0);
        } else {
          ctx.moveTo(0, -CS / 2 + 5);
          ctx.lineTo(0, CS / 2 - 5);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (isWarning) {
        // Laser Berkedip Peringatan (Kuning Tipis)
        ctx.strokeStyle = 'rgba(255,200,0,0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        if (las.horiz) {
          ctx.moveTo(-CS / 2 + 5, 0);
          ctx.lineTo(CS / 2 - 5, 0);
        } else {
          ctx.moveTo(0, -CS / 2 + 5);
          ctx.lineTo(0, CS / 2 - 5);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    });

    // Gambar Robot Pemain
    robots.forEach(bot => {
      const colDef = PCOLORS[bot.n] || PCOLORS[1];
      const isStunned = bot.stunTime > 0;
      const isBoosted = bot.boostTime > 0;

      ctx.save();
      ctx.translate(bot.x, bot.y);

      // Efek Aura / Speed Boost
      if (isBoosted) {
        ctx.fillStyle = 'rgba(255,215,0,0.3)';
        ctx.beginPath();
        ctx.arc(0, 0, ROBOT_R + 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Glow Warna Pemain
      ctx.fillStyle = colDef.glow;
      ctx.beginPath();
      ctx.arc(0, 0, ROBOT_R + 3, 0, Math.PI * 2);
      ctx.fill();

      // Badan Robot Bulat
      ctx.fillStyle = isStunned && Math.floor(now / 70) % 2 === 0 ? '#ff4d4f' : colDef.main;
      ctx.beginPath();
      ctx.arc(0, 0, ROBOT_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Wajah / Visor Robot
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(-7, -4, 14, 8, 3);
      ctx.fill();

      // Lampu LED Mata Robot
      ctx.fillStyle = colDef.light;
      ctx.beginPath();
      ctx.arc(-3, 0, 1.8, 0, Math.PI * 2);
      ctx.arc(3, 0, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Label Nomor Pemain di Atas Kepala
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`P${bot.n}`, 0, -ROBOT_R - 3);

      ctx.restore();
    });

    // ── HUD ATAS (Area Aman: Y = 10..65) ───────────────────────────
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fillRect(0, 0, W, 70);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 70);
    ctx.lineTo(W, 70);
    ctx.stroke();

    // Judul & Indikator Ronde di Kiri HUD (Jarak aman 80px dari tombol keluar)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🧭 MAZE RACE', 84, 25);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#94a3b8';
    const roundLabels = ['Ronde 1 (Easy)', 'Ronde 2 (Medium)', 'Ronde 3 (Final)'];
    ctx.fillText(`${roundLabels[currentRound - 1]} • 3 Ronde`, 84, 48);

    // Timer Ronde di Tengah HUD
    ctx.textAlign = 'center';
    const timerColor = roundTimer <= 10 ? '#ff4d4f' : '#ffffff';
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = timerColor;
    const secStr = Math.ceil(roundTimer).toString().padStart(2, '0');
    ctx.fillText(`⏱ 00:${secStr}`, W / 2, 35);

    // Skor Pemain di Kanan HUD
    ctx.textAlign = 'right';
    const scoreStartX = W - 220; // aman dari tombol panggung kanan (mon, snd, fs)
    let curX = scoreStartX;

    players.forEach(n => {
      const colDef = PCOLORS[n] || PCOLORS[1];
      ctx.fillStyle = colDef.main;
      ctx.beginPath();
      ctx.arc(curX - 65, 35, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`P${n}: ${playerScores[n]}`, curX, 35);
      curX -= 95;
    });

    // ── Overlay Fase Permainan ──────────────────────────────────────
    if (state === 'waiting') {
      ctx.fillStyle = 'rgba(10,15,26,0.78)';
      ctx.fillRect(0, 70, W, H - 70);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 44px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('🧭 MAZE RACE ROBOPANDA', W / 2, H / 2 - 50);

      ctx.font = '22px sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('Labirin Simetris 4-Sudut • 3 Babak Bertingkat', W / 2, H / 2 + 5);

      ctx.font = '19px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`Kirim 99# dari micro:bit pemain pertama (P${players[0]}), atau klik layar untuk mulai!`, W / 2, H / 2 + 65);
    } else if (state === 'countdown') {
      ctx.fillStyle = 'rgba(10,15,26,0.65)';
      ctx.fillRect(0, 70, W, H - 70);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 96px sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText(countdownSec.toString(), W / 2, H / 2);
    } else if (state === 'intermission') {
      ctx.fillStyle = 'rgba(10,15,26,0.85)';
      ctx.fillRect(0, 70, W, H - 70);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 40px sans-serif';
      ctx.fillStyle = '#ffd700';
      if (roundWinner) {
        ctx.fillText(`🏆 Ronde ${currentRound} Selesai! Player ${roundWinner} Capai Portal!`, W / 2, H / 2 - 40);
      } else {
        ctx.fillText(`⏱ Waktu Ronde ${currentRound} Habis!`, W / 2, H / 2 - 40);
      }

      ctx.font = '22px sans-serif';
      ctx.fillStyle = '#ffffff';
      const standings = players.map(p => `P${p}: ${playerScores[p]} pts`).join('   |   ');
      ctx.fillText(`Klasemen Sementara:  ${standings}`, W / 2, H / 2 + 20);

      ctx.font = '17px sans-serif';
      ctx.fillStyle = '#94a3b8';
      if (currentRound < TOTAL_ROUNDS) {
        ctx.fillText(`Bersiap menuju Ronde ${currentRound + 1}...`, W / 2, H / 2 + 70);
      } else {
        ctx.fillText('Menghitung hasil akhir podium...', W / 2, H / 2 + 70);
      }
    }
  }

  // Mulai Loop Animasi
  animId = requestAnimationFrame(loop);

  return {
    stop() {
      if (animId) cancelAnimationFrame(animId);
      unbindInput();
      canvas.removeEventListener('click', onCanvasClick);
    }
  };
}

// ── Ekspor Metadata & Kontrak Game ────────────────────────────────
export default {
  id: 'maze',
  name: 'Maze Race',
  icon: '🧭',
  description: 'Adu cepat eksplorasi labirin simetris 4-sudut dalam 3 babak bertingkat. Rebut kristal dan capai portal pusat!',
  modes: [
    {id: '1p', label: '1 Player', sub: 'Solo Time Attack', players: 1},
    {id: '2p', label: '2 Players', sub: 'Duel Sudut', players: 2},
    {id: '3p', label: '3 Players', sub: 'Segitiga Laga', players: 3},
    {id: '4p', label: '4 Players', sub: '4-Sudut Penuh', players: 4}
  ],
  canvas: {width: W, height: H},
  create
};

