// GAME: Kejar Labirin (Pac-Man Multiplayer)
// games/kejarlabirin.js
// Fixed Canvas 1280x720 (16:9 Landscape), 1P (Solo), 2P (Duel), dan 4P (Pesta Berempat)
// Koleksi Retro: Chomper multi-pemain di labirin simetris 4-sudut dengan terowongan tembus,
// titik energi, pil kekuatan, buah bonus, serta 4 hantu NPC AI ramah anak TK & SD.

'use strict';

// ═══════════════════════════════════════════════════════════════════
//  KONSTANTA PERMAINAN & GRID
// ═══════════════════════════════════════════════════════════════════

const CANVAS_WIDTH          = 1280;
const CANVAS_HEIGHT         = 720;
const GAME_DURATION_SEC     = 90;
const COUNTDOWN_SEC         = 3;
const FINISH_DELAY_MS       = 800;

// Grid Labirin
const COLS                  = 31;
const ROWS                  = 17;
const CS                    = 38; // Ukuran sel px (31 * 38 = 1178, 17 * 38 = 646)
const OX                    = Math.floor((CANVAS_WIDTH - COLS * CS) / 2); // 51 px
const OY                    = 66; // 66 px (ruang aman atas untuk HUD)

// Kecepatan & Fisika (Disesuaikan Ramah Anak Usia TK & SD)
const PLAYER_SPEED          = 175; // px/dtk (lincah tapi tidak membingungkan anak)
const GHOST_SPEED_NORMAL    = 115; // px/dtk (lebih lambat dari pemain agar anak merasa aman)
const GHOST_SPEED_FRIGHT    = 80;  // px/dtk saat hantu biru ketakutan
const GHOST_SPEED_EATEN     = 280; // px/dtk saat mata hantu kembali ke sarang
const CORNER_SNAP_DIST      = 12;  // toleransi snap di persimpangan sel
const FRIGHTENED_DURATION   = 8.0; // detik hantu biru ketakutan
const FRUIT_INTERVAL_SEC    = 20.0;// interval kemunculan buah bonus
const FRUIT_DURATION_SEC    = 10.0;// durasi buah bertahan sebelum hilang
const INITIAL_LIVES         = 3;   // nyawa awal per pemain
const INVULN_DURATION_SEC   = 3.0; // durasi kebal pasca kena hantu

// Warna Khas Slot Platform
const SLOT_COLORS = {
  1: { name: 'Merah',  hex: '#EF4444', dark: '#991B1B', light: '#FCA5A5' },
  2: { name: 'Biru',   hex: '#3B82F6', dark: '#1E40AF', light: '#93C5FD' },
  3: { name: 'Hijau',  hex: '#22C55E', dark: '#166534', light: '#86EFAC' },
  4: { name: 'Kuning', hex: '#EAB308', dark: '#854D0E', light: '#FDE047' }
};

// Vektor Arah: 1=Atas, 2=Bawah, 3=Kiri, 4=Kanan, 0=Netral
const DIRS = {
  1: { dx:  0, dy: -1, angle: -Math.PI / 2 },
  2: { dx:  0, dy:  1, angle:  Math.PI / 2 },
  3: { dx: -1, dy:  0, angle:  Math.PI },
  4: { dx:  1, dy:  0, angle:  0 }
};

// ═══════════════════════════════════════════════════════════════════
//  PETA LABIRIN SIMETRIS (31 x 17)
// ═══════════════════════════════════════════════════════════════════

const HALF_MAP = [
  '###############', // 0
  '#o...#.......#.', // 1 (o = Power Pellet di pojok)
  '#.##.#.#####.#.', // 2
  '#..............', // 3
  '#.##.##.######.', // 4
  '#....#....#....', // 5
  '####.####.#.###', // 6
  '####....#.#.   ', // 7 (rumah hantu di tengah)
  '.....##.#.#.   ', // 8 (lorong terowongan tembus wrap-around)
  '####....#.#.###', // 9
  '####.####.#....', // 10
  '#........#.....', // 11
  '#.##.###.######', // 12
  '#o.#...........', // 13 (o = Power Pellet di pojok)
  '##.#.#.###.###.', // 14
  '#....#.....#...', // 15
  '###############'  // 16
];

const CENTER_COL = [
  '#', '.', '#', '.', '#', '.', '#', ' ', ' ', '#', '.', '#', '.', '.', '.', '.', '#'
];

function buildFullMaze() {
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    const left = HALF_MAP[r];
    const mid = CENTER_COL[r];
    const right = left.split('').reverse().join('');
    grid.push((left + mid + right).split(''));
  }
  return grid;
}

// ═══════════════════════════════════════════════════════════════════
//  MODUL KARAKTER CHOMPER (PEMAIN)
// ═══════════════════════════════════════════════════════════════════

class Chomper {
  constructor(slot, startC, startR) {
    this.slot = slot;
    this.colorData = SLOT_COLORS[slot] || SLOT_COLORS[1];
    this.startC = startC;
    this.startR = startR;

    this.x = OX + startC * CS + CS / 2;
    this.y = OY + startR * CS + CS / 2;
    this.r = 15; // radius karakter visual

    this.curDir = slot === 2 || slot === 3 ? 1 : 2; // arah awal hadap
    this.nextDir = this.curDir;
    this.score = 0;
    this.lives = INITIAL_LIVES;
    this.invulnTimer = 0;
    this.mouthAnim = 0;
    this.mouthSpeed = 8.0;
    this.active = true;
  }

  respawn() {
    this.x = OX + this.startC * CS + CS / 2;
    this.y = OY + this.startR * CS + CS / 2;
    this.curDir = this.slot === 2 || this.slot === 3 ? 1 : 2;
    this.nextDir = this.curDir;
    this.invulnTimer = INVULN_DURATION_SEC;
  }

  update(dt, isWallFn) {
    if (!this.active || this.lives <= 0) return;

    if (this.invulnTimer > 0) {
      this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    }

    this.mouthAnim += this.mouthSpeed * dt;

    // Koordinat sel saat ini
    const curC = Math.floor((this.x - OX) / CS);
    const curR = Math.floor((this.y - OY) / CS);
    const cellCenterX = OX + curC * CS + CS / 2;
    const cellCenterY = OY + curR * CS + CS / 2;

    const distToCenterX = this.x - cellCenterX;
    const distToCenterY = this.y - cellCenterY;

    // Evaluasi Buffer Belokan (NextDir) di dekat persimpangan pusat sel
    if (this.nextDir !== this.curDir && DIRS[this.nextDir]) {
      const nd = DIRS[this.nextDir];
      // Jika belok 180 derajat (balik arah langsung), langsung eksekusi tanpa menunggu persimpangan
      const cd = DIRS[this.curDir];
      if (nd.dx === -cd.dx && nd.dy === -cd.dy) {
        this.curDir = this.nextDir;
      } else {
        // Cek apakah dekat dengan pusat sel untuk belok tegak lurus
        const nearCenter = Math.abs(distToCenterX) <= CORNER_SNAP_DIST && Math.abs(distToCenterY) <= CORNER_SNAP_DIST;
        if (nearCenter) {
          const targetC = curC + nd.dx;
          const targetR = curR + nd.dy;
          if (!isWallFn(targetC, targetR)) {
            this.curDir = this.nextDir;
            // Snap pas ke garis tengah sumbu belokan
            if (nd.dx !== 0) this.y = cellCenterY;
            if (nd.dy !== 0) this.x = cellCenterX;
          }
        }
      }
    }

    // Gerak maju mengikuti arah saat ini
    const d = DIRS[this.curDir];
    if (d) {
      const nextX = this.x + d.dx * PLAYER_SPEED * dt;
      const nextY = this.y + d.dy * PLAYER_SPEED * dt;

      // Cek apakah terowongan tembus horizontal (Wrap-Around di row 8)
      if (curR === 8) {
        if (nextX < OX - CS / 2) {
          this.x = OX + (COLS - 0.5) * CS;
          return;
        } else if (nextX > OX + (COLS - 0.5) * CS) {
          this.x = OX - CS / 2;
          return;
        }
      }

      // Deteksi tabrakan dinding di depan
      const checkC = curC + d.dx;
      const checkR = curR + d.dy;
      const willHitWall = isWallFn(checkC, checkR);

      if (willHitWall) {
        // Hentikan pergerakan tepat di tengah sel jika di depannya dinding
        if (d.dx > 0 && nextX > cellCenterX) this.x = cellCenterX;
        else if (d.dx < 0 && nextX < cellCenterX) this.x = cellCenterX;
        else if (d.dy > 0 && nextY > cellCenterY) this.y = cellCenterY;
        else if (d.dy < 0 && nextY < cellCenterY) this.y = cellCenterY;
        else {
          this.x = nextX;
          this.y = nextY;
        }
      } else {
        this.x = nextX;
        this.y = nextY;
        // Bimbingan snap sumbu lateral agar tidak menyenggol sisi lorong
        if (d.dx !== 0) this.y += (cellCenterY - this.y) * 0.25;
        if (d.dy !== 0) this.x += (cellCenterX - this.x) * 0.25;
      }
    }
  }

  draw(ctx) {
    if (!this.active || this.lives <= 0) return;

    // Efek kedip saat kebal
    if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 10) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    const dirData = DIRS[this.curDir] || DIRS[4];
    const baseAngle = dirData.angle;

    // Mulut membuka dan menutup (0 s.d. 0.28 PI)
    const mouthAngle = (Math.sin(this.mouthAnim) * 0.5 + 0.5) * 0.28 * Math.PI;

    // Badan Karakter Chomper (Warna Khas Slot Pemain)
    ctx.fillStyle = this.colorData.hex;
    ctx.beginPath();
    ctx.arc(0, 0, this.r, baseAngle + mouthAngle, baseAngle + Math.PI * 2 - mouthAngle, false);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    // Garis Tepi Mengkilap
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Mata Karakter
    const eyeOffsetAngle = baseAngle - Math.PI / 3;
    const eyeX = Math.cos(eyeOffsetAngle) * (this.r * 0.5);
    const eyeY = Math.sin(eyeOffsetAngle) * (this.r * 0.5);

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Label Slot Pemain di atas Karakter
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.textAlign = 'center';
    ctx.strokeText(`P${this.slot}`, 0, -this.r - 4);
    ctx.fillText(`P${this.slot}`, 0, -this.r - 4);

    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MODUL HANTU NPC AI (GHOST)
// ═══════════════════════════════════════════════════════════════════

class Ghost {
  constructor(id, name, color, homeC, homeR) {
    this.id = id;
    this.name = name;
    this.baseColor = color;
    this.homeC = homeC;
    this.homeR = homeR;

    this.x = OX + homeC * CS + CS / 2;
    this.y = OY + homeR * CS + CS / 2;
    this.r = 14;

    this.curDir = 1; // Mulai bergerak ke atas keluar dari sarang
    this.state = 'chase'; // 'chase' | 'frightened' | 'eaten'
    this.frightenedTimer = 0;
    this.feetAnim = 0;
  }

  resetToHome() {
    this.x = OX + this.homeC * CS + CS / 2;
    this.y = OY + this.homeR * CS + CS / 2;
    this.curDir = 1;
    this.state = 'chase';
    this.frightenedTimer = 0;
  }

  update(dt, players, isWallFn) {
    this.feetAnim += dt * 10;

    // Update Timer Ketakutan (Vulnerable)
    if (this.state === 'frightened') {
      this.frightenedTimer -= dt;
      if (this.frightenedTimer <= 0) {
        this.state = 'chase';
      }
    }

    // Tentukan Kecepatan Hantu
    let currentSpeed = GHOST_SPEED_NORMAL;
    if (this.state === 'frightened') currentSpeed = GHOST_SPEED_FRIGHT;
    else if (this.state === 'eaten') currentSpeed = GHOST_SPEED_EATEN;

    const curC = Math.floor((this.x - OX) / CS);
    const curR = Math.floor((this.y - OY) / CS);
    const cellCenterX = OX + curC * CS + CS / 2;
    const cellCenterY = OY + curR * CS + CS / 2;

    // Cek jika tiba di sarang saat status 'eaten'
    if (this.state === 'eaten') {
      const distHome = Math.hypot(this.x - (OX + this.homeC * CS + CS / 2), this.y - (OY + this.homeR * CS + CS / 2));
      if (distHome < 15) {
        this.state = 'chase';
        this.curDir = 1;
      }
    }

    // Cek persimpangan sel untuk memilih arah baru
    const atCenter = Math.abs(this.x - cellCenterX) <= 2.5 && Math.abs(this.y - cellCenterY) <= 2.5;
    if (atCenter) {
      this.chooseDirection(curC, curR, players, isWallFn);
    }

    // Gerak maju hantu
    const d = DIRS[this.curDir] || DIRS[1];
    const nextX = this.x + d.dx * currentSpeed * dt;
    const nextY = this.y + d.dy * currentSpeed * dt;

    // Terowongan tembus wrap-around di row 8
    if (curR === 8) {
      if (nextX < OX - CS / 2) {
        this.x = OX + (COLS - 0.5) * CS;
        return;
      } else if (nextX > OX + (COLS - 0.5) * CS) {
        this.x = OX - CS / 2;
        return;
      }
    }

    // Deteksi dinding
    const checkC = curC + d.dx;
    const checkR = curR + d.dy;
    if (isWallFn(checkC, checkR)) {
      // Terbentur dinding, langsung pilih arah alternatif segera
      this.chooseDirection(curC, curR, players, isWallFn);
    } else {
      this.x = nextX;
      this.y = nextY;
      if (d.dx !== 0) this.y += (cellCenterY - this.y) * 0.25;
      if (d.dy !== 0) this.x += (cellCenterX - this.x) * 0.25;
    }
  }

  chooseDirection(curC, curR, players, isWallFn) {
    const oppDir = { 1: 2, 2: 1, 3: 4, 4: 3 }[this.curDir];
    const candidates = [];

    // Cari cabang lorong yang tidak bertabrakan dengan dinding
    for (const dirNum of [1, 2, 3, 4]) {
      // Tidak boleh berputar 180 derajat kecuali terpaksa buntu
      if (dirNum === oppDir) continue;
      const d = DIRS[dirNum];
      const nc = curC + d.dx;
      const nr = curR + d.dy;
      if (!isWallFn(nc, nr)) {
        candidates.push(dirNum);
      }
    }

    if (candidates.length === 0) {
      this.curDir = oppDir;
      return;
    }

    // Tentukan Target Koordinat berdasarkan State
    let targetX = 0;
    let targetY = 0;

    if (this.state === 'eaten') {
      targetX = OX + this.homeC * CS + CS / 2;
      targetY = OY + this.homeR * CS + CS / 2;
    } else {
      // Cari pemain aktif terdekat
      const activePlayers = players.filter(p => p.active && p.lives > 0);
      if (activePlayers.length > 0) {
        let minDist = 99999;
        let nearestP = activePlayers[0];
        for (const p of activePlayers) {
          const dist = Math.hypot(p.x - this.x, p.y - this.y);
          if (dist < minDist) {
            minDist = dist;
            nearestP = p;
          }
        }
        targetX = nearestP.x;
        targetY = nearestP.y;
      } else {
        targetX = OX + this.homeC * CS + CS / 2;
        targetY = OY + this.homeR * CS + CS / 2;
      }
    }

    // AI Decision:
    // Jika 'chase' dan roll < 0.70: pilih cabang yang mendekatkan ke target
    // Jika 'frightened': pilih cabang yang menjauhkan dari target
    // Selain itu: acak ramah anak
    const roll = Math.random();
    if (this.state === 'chase' && roll < 0.72) {
      let bestDir = candidates[0];
      let bestDist = 999999;
      for (const cDir of candidates) {
        const d = DIRS[cDir];
        const nextCellX = OX + (curC + d.dx) * CS + CS / 2;
        const nextCellY = OY + (curR + d.dy) * CS + CS / 2;
        const dist = Math.hypot(nextCellX - targetX, nextCellY - targetY);
        if (dist < bestDist) {
          bestDist = dist;
          bestDir = cDir;
        }
      }
      this.curDir = bestDir;
    } else if (this.state === 'frightened') {
      // Menjauh dari pemain terdekat
      let bestDir = candidates[0];
      let maxDist = -1;
      for (const cDir of candidates) {
        const d = DIRS[cDir];
        const nextCellX = OX + (curC + d.dx) * CS + CS / 2;
        const nextCellY = OY + (curR + d.dy) * CS + CS / 2;
        const dist = Math.hypot(nextCellX - targetX, nextCellY - targetY);
        if (dist > maxDist) {
          maxDist = dist;
          bestDir = cDir;
        }
      }
      this.curDir = bestDir;
    } else {
      // Acak santai
      this.curDir = candidates[Math.floor(Math.random() * candidates.length)];
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.state === 'eaten') {
      // Hanya Mata yang Melayang Kembali ke Sarang
      this.drawEyes(ctx);
      ctx.restore();
      return;
    }

    // Warna Badan Hantu
    let ghostColor = this.baseColor;
    if (this.state === 'frightened') {
      // Berkedip putih di 2 detik terakhir
      if (this.frightenedTimer < 2.0 && Math.floor(this.frightenedTimer * 6) % 2 === 0) {
        ghostColor = '#F8FAFC';
      } else {
        ghostColor = '#2563EB'; // Biru ketakutan
      }
    }

    // Kubah Kepala Hantu
    ctx.fillStyle = ghostColor;
    ctx.beginPath();
    ctx.arc(0, -2, this.r, Math.PI, 0, false);
    ctx.lineTo(this.r, this.r - 2);

    // Kaki Berombak Hantu (3 gelombang beranimasi)
    const waveCount = 3;
    const waveW = (this.r * 2) / waveCount;
    const animOffset = Math.sin(this.feetAnim) * 2;

    for (let i = 0; i < waveCount; i++) {
      const startX = this.r - i * waveW;
      const midX = startX - waveW / 2;
      const endX = startX - waveW;
      ctx.quadraticCurveTo(midX, this.r + 4 + (i % 2 === 0 ? animOffset : -animOffset), endX, this.r - 2);
    }

    ctx.lineTo(-this.r, -2);
    ctx.closePath();
    ctx.fill();

    // Bingkai Halus
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Mata Hantu
    if (this.state === 'frightened') {
      // Mata Panik Kecil
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(-4, -2, 2.5, 0, Math.PI * 2);
      ctx.arc(4, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Mulut Bergelombang Panik
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-7, 6);
      ctx.lineTo(-4, 3);
      ctx.lineTo(-1, 6);
      ctx.lineTo(2, 3);
      ctx.lineTo(5, 6);
      ctx.stroke();
    } else {
      this.drawEyes(ctx);
    }

    ctx.restore();
  }

  drawEyes(ctx) {
    const d = DIRS[this.curDir] || DIRS[1];
    const lookX = d.dx * 2.5;
    const lookY = d.dy * 2.5;

    // Bagian Putih Mata
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-5, -3, 4.5, 0, Math.PI * 2);
    ctx.arc(5, -3, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Pupil Biru Menatap Arah Bergerak
    ctx.fillStyle = '#1E3A8A';
    ctx.beginPath();
    ctx.arc(-5 + lookX, -3 + lookY, 2.2, 0, Math.PI * 2);
    ctx.arc(5 + lookX, -3 + lookY, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MODUL GAME ENGINE
// ═══════════════════════════════════════════════════════════════════

class GameEngine {
  constructor({ canvas, kernel, players, mode, finish, audio }) {
    this.canvas = canvas;
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    this.ctx = canvas.getContext('2d');
    this.kernel = kernel;
    this.players = players;
    this.mode = mode;
    this.finish = finish;
    this.audio = audio;

    this.state = 'waiting'; // 'waiting' | 'countdown' | 'play' | 'over'
    this.timeLeft = GAME_DURATION_SEC;
    this.countdownTimer = COUNTDOWN_SEC;
    this.wave = 1;
    this.floatingTexts = [];

    // Inisialisasi Peta Labirin & Titik
    this.rawMaze = buildFullMaze();
    this.initDotsAndItems();

    // Buah Bonus (Cherry / Strawberry)
    this.fruit = null; // { x, y, active, timer, type, points }
    this.fruitSpawnTimer = FRUIT_INTERVAL_SEC;

    // Titik Spawn 4 Sudut Pemain:
    // P1 = Kiri-Atas (1, 1)
    // P2 = Kanan-Bawah (29, 15)
    // P3 = Kiri-Bawah (1, 15)
    // P4 = Kanan-Atas (29, 1)
    const SPAWN_COORDS = {
      1: { c: 1,  r: 1  },
      2: { c: 29, r: 15 },
      3: { c: 1,  r: 15 },
      4: { c: 29, r: 1  }
    };

    // Inisialisasi Karakter Pemain
    this.chompers = players.map(slot => {
      const coord = SPAWN_COORDS[slot] || SPAWN_COORDS[1];
      return new Chomper(slot, coord.c, coord.r);
    });

    // Inisialisasi 4 Hantu NPC AI di sekitar sarang tengah (r=8, c=13..17)
    this.ghosts = [
      new Ghost(1, 'Blinky', '#EF4444', 15, 7), // Merah
      new Ghost(2, 'Pinky',  '#F472B6', 14, 8), // Merah Muda
      new Ghost(3, 'Inky',   '#38BDF8', 16, 8), // Biru Muda
      new Ghost(4, 'Clyde',  '#F59E0B', 15, 8)  // Oranye
    ];

    // Input Kernel Listener
    this.offKernel = (kernel && typeof kernel.on === 'function')
      ? kernel.on('input', ({ player, cmd }) => this.handleInput(player, cmd))
      : null;

    // Keyboard Fallback Lokal
    this.setupKeyboardFallback();

    // Klik Canvas untuk Mulai
    this.onCanvasClick = () => {
      if (this.state === 'waiting') this.startCountdown();
    };
    this.canvas.addEventListener('click', this.onCanvasClick);

    this.frameId = null;
    this.lastTime = null;
    this.stopped = false;
    this.finishTimeoutId = null;

    this.loop = this.loop.bind(this);
    this.frameId = requestAnimationFrame(this.loop);
  }

  initDotsAndItems() {
    this.dots = [];
    this.pellets = [];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const char = this.rawMaze[r][c];
        const cellX = OX + c * CS + CS / 2;
        const cellY = OY + r * CS + CS / 2;

        if (char === '.') {
          this.dots.push({ c, r, x: cellX, y: cellY, eaten: false });
        } else if (char === 'o') {
          this.pellets.push({ c, r, x: cellX, y: cellY, eaten: false });
        }
      }
    }
  }

  isWall(c, r) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
    return this.rawMaze[r][c] === '#';
  }

  playAudio(name, opts) {
    try {
      if (this.audio && typeof this.audio.play === 'function') {
        this.audio.play(name, opts);
      }
    } catch (_) {}
  }

  startCountdown() {
    this.state = 'countdown';
    this.countdownTimer = COUNTDOWN_SEC;
    this.playAudio('click', { pan: 0, volume: 0.35 });
  }

  setupKeyboardFallback() {
    this.onKeyDown = (e) => {
      const key = e.key.toLowerCase();
      const p1 = this.players[0];
      const p2 = this.players[1];

      if (key === ' ' || key === 'enter') {
        if (p1 != null) this.handleInput(p1, '99');
        return;
      }

      // P1: W / A / S / D
      if (key === 'w') this.handleInput(p1, '1');
      else if (key === 's') this.handleInput(p1, '2');
      else if (key === 'a') this.handleInput(p1, '3');
      else if (key === 'd') this.handleInput(p1, '4');

      // P2: Panah Atas / Bawah / Kiri / Kanan
      if (p2 != null) {
        if (e.key === 'ArrowUp')    this.handleInput(p2, '1');
        else if (e.key === 'ArrowDown')  this.handleInput(p2, '2');
        else if (e.key === 'ArrowLeft')  this.handleInput(p2, '3');
        else if (e.key === 'ArrowRight') this.handleInput(p2, '4');
      }
    };
    window.addEventListener('keydown', this.onKeyDown);
  }

  handleInput(slot, cmd) {
    if (this.stopped) return;

    if (this.state === 'waiting') {
      if ((cmd === '99' || cmd === '5') && slot === this.players[0]) {
        this.startCountdown();
      }
      return;
    }

    if (this.state === 'play') {
      const ch = this.chompers.find(c => c.slot === slot);
      if (!ch || ch.lives <= 0) return;

      // 1=Atas, 2=Bawah, 3=Kiri, 4=Kanan, 0=Netral
      if (cmd === '1' || cmd === '2' || cmd === '3' || cmd === '4') {
        ch.nextDir = parseInt(cmd, 10);
      }
      // '0' netral: pac-man terus meluncur di arah terakhir
    }
  }

  spawnBonusFruit() {
    this.fruit = {
      x: OX + 15 * CS + CS / 2,
      y: OY + 8 * CS + CS / 2,
      timer: FRUIT_DURATION_SEC,
      type: this.wave % 2 === 1 ? '🍒' : '🍓',
      points: 50
    };
    this.playAudio('score', { volume: 0.3 });
  }

  addFloatingText(txt, x, y, color = '#FDE047') {
    this.floatingTexts.push({
      text: txt,
      x,
      y,
      alpha: 1.0,
      color
    });
  }

  update(dt) {
    if (this.state === 'countdown') {
      const prevDigit = Math.ceil(this.countdownTimer);
      this.countdownTimer -= dt;
      const curDigit = Math.ceil(this.countdownTimer);
      if (curDigit > 0 && curDigit !== prevDigit) {
        this.playAudio('click', { pan: 0, volume: 0.35 });
      }
      if (this.countdownTimer <= 0) {
        this.state = 'play';
        this.playAudio('start');
      }
      return;
    }

    if (this.state !== 'play') return;

    // 1. Hitung Mundur Waktu 90 Detik
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft <= 0) {
      this.gameOver();
      return;
    }

    // 2. Teks Melayang
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 25 * dt;
      ft.alpha -= 1.2 * dt;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }

    // 3. Buah Bonus
    if (this.fruit) {
      this.fruit.timer -= dt;
      if (this.fruit.timer <= 0) this.fruit = null;
    } else {
      this.fruitSpawnTimer -= dt;
      if (this.fruitSpawnTimer <= 0) {
        this.spawnBonusFruit();
        this.fruitSpawnTimer = FRUIT_INTERVAL_SEC;
      }
    }

    // 4. Update Karakter Pemain
    for (const ch of this.chompers) {
      ch.update(dt, (c, r) => this.isWall(c, r));

      if (ch.lives <= 0) continue;

      // Cek Makan Titik Energi (+10 Pts)
      for (const d of this.dots) {
        if (!d.eaten && Math.hypot(ch.x - d.x, ch.y - d.y) < 14) {
          d.eaten = true;
          ch.score += 10;
          this.playAudio('click', { volume: 0.15 });
          break;
        }
      }

      // Cek Makan Pil Kekuatan (+30 Pts & Hantu Ketakutan)
      for (const p of this.pellets) {
        if (!p.eaten && Math.hypot(ch.x - p.x, ch.y - p.y) < 16) {
          p.eaten = true;
          ch.score += 30;
          this.addFloatingText('+30', p.x, p.y, '#38BDF8');
          this.playAudio('powerup', { volume: 0.45 });

          // Seluruh Hantu Berubah Jadi Biru Ketakutan selama 8 detik
          for (const g of this.ghosts) {
            if (g.state !== 'eaten') {
              g.state = 'frightened';
              g.frightenedTimer = FRIGHTENED_DURATION;
            }
          }
          break;
        }
      }

      // Cek Makan Buah Bonus (+50 Pts)
      if (this.fruit && Math.hypot(ch.x - this.fruit.x, ch.y - this.fruit.y) < 18) {
        ch.score += this.fruit.points;
        this.addFloatingText(`+${this.fruit.points}`, this.fruit.x, this.fruit.y, '#FDE047');
        this.playAudio('score', { volume: 0.5 });
        this.fruit = null;
      }
    }

    // 5. Update Hantu NPC AI & Interaksi dengan Pemain
    for (const g of this.ghosts) {
      g.update(dt, this.chompers, (c, r) => this.isWall(c, r));

      // Cek Tabrakan Hantu dengan Pemain
      for (const ch of this.chompers) {
        if (ch.lives <= 0 || ch.invulnTimer > 0) continue;

        const dist = Math.hypot(ch.x - g.x, ch.y - g.y);
        if (dist < ch.r + g.r - 4) {
          if (g.state === 'frightened') {
            // HANTU TERMAKAN! (+100 Poin untuk Pemain)
            g.state = 'eaten';
            ch.score += 100;
            this.addFloatingText('+100 👻', g.x, g.y, '#38BDF8');
            this.playAudio('score', { volume: 0.55 });
          } else if (g.state === 'chase') {
            // PEMAIN TERKENA HANTU! (-1 Nyawa & Respawn)
            ch.lives--;
            this.playAudio('hurt', { volume: 0.45 });

            if (ch.lives > 0) {
              ch.respawn();
            } else {
              ch.active = false;
            }

            // Cek apakah seluruh pemain habis nyawa
            const anyAlive = this.chompers.some(c => c.lives > 0);
            if (!anyAlive) {
              this.gameOver();
              return;
            }
          }
        }
      }
    }

    // 6. Cek Seluruh Titik Bersih -> Reset Gelombang Labirin Baru
    const dotsRemaining = this.dots.some(d => !d.eaten) || this.pellets.some(p => !p.eaten);
    if (!dotsRemaining) {
      this.wave++;
      this.playAudio('powerup', { volume: 0.6 });
      this.addFloatingText(`WAVE ${this.wave}!`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '#34D399');
      this.initDotsAndItems();
      for (const g of this.ghosts) g.resetToHome();
    }
  }

  gameOver() {
    if (this.state === 'over') return;
    this.state = 'over';
    this.playAudio('win');

    let finishText = '';
    if (this.chompers.length === 1) {
      const p1 = this.chompers[0];
      let stars = '⭐';
      if (p1.score >= 1200) stars = '⭐⭐⭐';
      else if (p1.score >= 600) stars = '⭐⭐';
      finishText = `Waktu Habis! Skor P1: ${p1.score} (${stars})`;
    } else {
      const sorted = [...this.chompers].sort((a, b) => b.score - a.score);
      const scoreStr = this.chompers.map(c => `P${c.slot} ${c.score} poin`).join(', ');

      if (sorted.length > 1 && sorted[0].score === sorted[1].score) {
        finishText = `Seri! ${scoreStr}`;
      } else {
        const winner = sorted[0];
        finishText = `${winner.colorData.name} (P${winner.slot}) menang! ${scoreStr}`;
      }
    }

    this.finishTimeoutId = setTimeout(() => {
      if (!this.stopped) this.finish(finishText);
    }, FINISH_DELAY_MS);
  }

  drawBackground() {
    // Latar Belakang Biru Gelap Luar Angkasa
    this.ctx.fillStyle = '#050811';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Gambar Dinding Labirin Bergaya Retro Arkade
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const char = this.rawMaze[r][c];
        const cellX = OX + c * CS;
        const cellY = OY + r * CS;

        if (char === '#') {
          // Blok Dinding Biru Arkade Neon
          this.ctx.fillStyle = '#1E1B4B';
          this.ctx.fillRect(cellX, cellY, CS, CS);

          this.ctx.strokeStyle = '#3B82F6';
          this.ctx.lineWidth = 2.5;
          this.ctx.strokeRect(cellX + 1, cellY + 1, CS - 2, CS - 2);

          // Efek kilau dalam
          this.ctx.strokeStyle = 'rgba(147, 197, 253, 0.25)';
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(cellX + 4, cellY + 4, CS - 8, CS - 8);
        }
      }
    }

    // Pintu Masuk Sarang Hantu (Garis Merah Muda Lembut di r=7, c=15)
    this.ctx.strokeStyle = '#F472B6';
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.moveTo(OX + 14 * CS, OY + 7 * CS);
    this.ctx.lineTo(OX + 17 * CS, OY + 7 * CS);
    this.ctx.stroke();
  }

  drawItems() {
    // 1. Titik Energi Biasa (Dots)
    this.ctx.fillStyle = '#FEF08A';
    for (const d of this.dots) {
      if (d.eaten) continue;
      this.ctx.beginPath();
      this.ctx.arc(d.x, d.y, 3.5, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // 2. Pil Kekuatan Berdenyut (Power Pellets)
    const pulse = Math.sin(Date.now() * 0.008) * 2 + 8;
    for (const p of this.pellets) {
      if (p.eaten) continue;
      this.ctx.save();
      this.ctx.fillStyle = '#FACC15';
      this.ctx.shadowColor = '#FACC15';
      this.ctx.shadowBlur = 10;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, pulse, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // 3. Buah Bonus
    if (this.fruit) {
      this.ctx.font = '22px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(this.fruit.type, this.fruit.x, this.fruit.y + 1);
    }

    // 4. Teks Melayang
    for (const ft of this.floatingTexts) {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, ft.alpha);
      this.ctx.font = 'bold 15px sans-serif';
      this.ctx.fillStyle = ft.color;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(ft.text, ft.x, ft.y);
      this.ctx.restore();
    }
  }

  drawHUD() {
    this.ctx.save();

    // 1. Floating Timer & Wave Chip di Tengah Atas
    const timerW = 170;
    const timerH = 38;
    const timerX = (CANVAS_WIDTH - timerW) / 2;
    const timerY = 12;

    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    this.ctx.strokeStyle = this.timeLeft <= 15 ? '#EF4444' : 'rgba(255, 255, 255, 0.25)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.roundRect(timerX, timerY, timerW, timerH, 10);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.font = 'bold 16px sans-serif';
    this.ctx.fillStyle = this.timeLeft <= 15 ? '#EF4444' : '#F8FAFC';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(`⏱ ${Math.ceil(this.timeLeft)}s  •  W${this.wave}`, timerX + timerW / 2, timerY + timerH / 2);

    // 2. Statistik Pemain di Kiri & Kanan (Floating Glass Badges)
    let playerPositions = [];
    if (this.chompers.length === 1) {
      playerPositions = [{ x: 300, w: 230 }];
    } else if (this.chompers.length === 2) {
      playerPositions = [
        { x: 290, w: 230 },
        { x: 760, w: 230 }
      ];
    } else {
      playerPositions = [
        { x: 70,  w: 220 },
        { x: 300, w: 220 },
        { x: 760, w: 210 },
        { x: 990, w: 210 }
      ];
    }

    this.chompers.forEach((ch, idx) => {
      const pos = playerPositions[idx] || { x: 70 + idx * 220, w: 200 };
      const px = pos.x;
      const py = 10;
      const pw = pos.w;
      const ph = 42;

      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      this.ctx.strokeStyle = ch.colorData.hex;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.roundRect(px, py, pw, ph, 8);
      this.ctx.fill();
      this.ctx.stroke();

      // Skor
      this.ctx.font = 'bold 15px sans-serif';
      this.ctx.fillStyle = ch.colorData.hex;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'alphabetic';
      this.ctx.fillText(`P${ch.slot}: ${ch.score} pts`, px + 10, py + 18);

      // Nyawa
      let statusStr = '';
      if (ch.lives <= 0) {
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.fillStyle = '#EF4444';
        statusStr = '💀 GUGUR';
      } else {
        let hearts = '';
        for (let i = 0; i < INITIAL_LIVES; i++) hearts += (i < ch.lives) ? '❤️' : '💔';
        if (ch.invulnTimer > 0) hearts += ' 🛡️KEBAL';
        this.ctx.font = '12px sans-serif';
        this.ctx.fillStyle = '#F8FAFC';
        statusStr = hearts;
      }
      this.ctx.fillText(statusStr, px + 10, py + 35);
    });

    this.ctx.restore();
  }

  drawOverlays() {
    // 1. Overlay Waiting
    if (this.state === 'waiting') {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
      this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.roundRect(CANVAS_WIDTH / 2 - 380, CANVAS_HEIGHT / 2 - 150, 760, 300, 20);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.font = 'bold 44px sans-serif';
      this.ctx.fillStyle = '#FDE047';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('🟡 Kejar Labirin (Pac-Man)', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 75);

      this.ctx.font = '19px sans-serif';
      this.ctx.fillStyle = '#38BDF8';
      this.ctx.fillText(`Kirim 99# dari micro:bit P${this.players[0]}, atau klik layar / Spasi untuk mulai`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);

      this.ctx.font = '14px sans-serif';
      this.ctx.fillStyle = '#94A3B8';
      this.ctx.fillText('Kontrol: Atas (1), Bawah (2), Kiri (3), Kanan (4)  |  Datar (0) = Jalan Terus', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 35);
      this.ctx.fillText('P1: W / A / S / D  |  P2: Tombol Panah (Up/Down/Left/Right)', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 65);

      this.ctx.font = '13px sans-serif';
      this.ctx.fillStyle = '#FDE047';
      this.ctx.fillText('💡 Tip: Makan Pil Kuning Besar untuk mengubah hantu jadi biru & buru mereka (+100 poin)!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100);

      this.ctx.restore();
    }

    // 2. Countdown 3-2-1
    if (this.state === 'countdown') {
      this.ctx.save();
      const digit = Math.ceil(this.countdownTimer);
      this.ctx.font = 'bold 120px sans-serif';
      this.ctx.fillStyle = '#FDE047';
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 8;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.strokeText(String(digit), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      this.ctx.fillText(String(digit), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      this.ctx.restore();
    }

    // 3. Layar Selesai (Game Over)
    if (this.state === 'over') {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      this.ctx.font = 'bold 50px sans-serif';
      this.ctx.fillStyle = '#FDE047';
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 5;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.strokeText('WAKTU HABIS!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
      this.ctx.fillText('WAKTU HABIS!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
      this.ctx.restore();
    }
  }

  loop(timestamp) {
    if (this.stopped) return;
    if (this.lastTime === null) this.lastTime = timestamp;
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    this.update(dt);

    this.drawBackground();
    this.drawItems();

    for (const g of this.ghosts) g.draw(this.ctx);
    for (const ch of this.chompers) ch.draw(this.ctx);

    this.drawHUD();
    this.drawOverlays();

    this.frameId = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.stopped = true;
    if (this.frameId) cancelAnimationFrame(this.frameId);
    if (this.finishTimeoutId) clearTimeout(this.finishTimeoutId);
    if (this.offKernel) this.offKernel();
    if (this.onKeyDown) window.removeEventListener('keydown', this.onKeyDown);
    this.canvas.removeEventListener('click', this.onCanvasClick);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  EKSPOR DEFAULT SESUAI KONTRAK PLATFORM
// ═══════════════════════════════════════════════════════════════════

export default {
  id: 'kejarlabirin',
  name: 'Kejar Labirin',
  icon: '🟡',
  tag: 'Retro',
  description: 'Makan titik energi, santap pil kekuatan untuk memburu hantu biru, dan kuasai labirin arkade retro bersama kawan!',
  modes: [
    { id: '1p', label: '1 Player', sub: 'Solo',           players: 1 },
    { id: '2p', label: '2 Player', sub: 'Duel Labirin',   players: 2 },
    { id: '4p', label: '4 Player', sub: 'Pesta Berempat', players: 4 }
  ],
  canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },

  create(options) {
    const engine = new GameEngine(options);
    return {
      stop() {
        engine.destroy();
      }
    };
  }
};
