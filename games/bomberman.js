// GAME: Bomberman (Arena Ledak Multiplayer)
// games/bomberman.js
// Fixed Canvas 1280x720 (16:9 Landscape), 1P (vs AI Bots), 2P (Duel Ledak), dan 4P (Pesta Berempat)
// Koleksi Retro: Aksi penaruh bom klasik di arena 17x11 dengan pilar baja, balok bata berhadiah,
// reaksi berantai ledakan bom, power-up (Bomb, Fire, Speed), dan bantuan belok sudut (Corner Sliding).

'use strict';

// ═══════════════════════════════════════════════════════════════════
//  KONSTANTA PERMAINAN & ARENA GRID
// ═══════════════════════════════════════════════════════════════════

const CANVAS_WIDTH          = 1280;
const CANVAS_HEIGHT         = 720;
const GAME_DURATION_SEC     = 90;
const COUNTDOWN_SEC         = 3;
const FINISH_DELAY_MS       = 800;

// Ukuran Arena Grid (17 Kolom x 11 Baris)
const COLS                  = 17;
const ROWS                  = 11;
const CS                    = 56; // Ukuran petak piksel (17 * 56 = 952, 11 * 56 = 616)
const OX                    = Math.floor((CANVAS_WIDTH - COLS * CS) / 2); // 164 px
const OY                    = 72; // 72 px (ruang aman atas untuk HUD)

// Fisika & Parameter Karakter (Ramah Anak TK & SD)
const BASE_PLAYER_SPEED     = 150; // px/dtk
const MAX_PLAYER_SPEED      = 225; // px/dtk (dengan sepatu speed-up)
const CORNER_SLIDE_ASSIST   = 16;  // toleransi geser otomatis di sudut pilar
const INITIAL_LIVES         = 3;   // nyawa awal per pemain
const INVULN_SEC            = 3.0; // durasi kebal pasca ledakan

// Mekanika Bom & Ledakan
const BOMB_FUSE_SEC         = 2.5; // durasi hitung mundur bom sebelum meledak
const EXPLOSION_DURATION    = 0.55;// durasi api ledakan bertahan di petak
const BASE_BLAST_RANGE      = 2;   // jangkauan ledakan awal (petak)
const MAX_BLAST_RANGE       = 5;
const BASE_MAX_BOMBS        = 1;   // kapasitas bom awal per pemain
const MAX_CAPACITY_BOMBS    = 4;

// Peluang Muncul Power-Up dari Balok Bata yang Hancur
const POWERUP_CHANCE        = 0.38;

// Warna Khas Slot Platform
const SLOT_COLORS = {
  1: { name: 'Merah',  hex: '#EF4444', dark: '#991B1B', light: '#FCA5A5' },
  2: { name: 'Biru',   hex: '#3B82F6', dark: '#1E40AF', light: '#93C5FD' },
  3: { name: 'Hijau',  hex: '#22C55E', dark: '#166534', light: '#86EFAC' },
  4: { name: 'Kuning', hex: '#EAB308', dark: '#854D0E', light: '#FDE047' }
};

// Vektor Arah: 1=Atas, 2=Bawah, 3=Kiri, 4=Kanan, 0=Netral
const DIRS = {
  1: { dx:  0, dy: -1 },
  2: { dx:  0, dy:  1 },
  3: { dx: -1, dy:  0 },
  4: { dx:  1, dy:  0 }
};

// ═══════════════════════════════════════════════════════════════════
//  MODUL ITEM POWER-UP
// ═══════════════════════════════════════════════════════════════════

class PowerUp {
  constructor(c, r, type) {
    this.c = c;
    this.r = r;
    this.x = OX + c * CS + CS / 2;
    this.y = OY + r * CS + CS / 2;
    this.type = type; // 'bomb' (+1 Kapasitas) | 'fire' (+1 Jangkauan) | 'speed' (Sepatu Lari)
    this.pulse = 0;
    this.alive = true;
  }

  update(dt) {
    this.pulse += dt * 5;
  }

  draw(ctx) {
    if (!this.alive) return;
    ctx.save();
    ctx.translate(this.x, this.y);

    const scale = 1.0 + Math.sin(this.pulse) * 0.08;
    ctx.scale(scale, scale);

    // Latar Pelindung Item
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-18, -18, 36, 36, 8);
    ctx.fill();

    let borderColor = '#EF4444';
    let icon = '💣';
    if (this.type === 'bomb') {
      borderColor = '#EF4444';
      icon = '💣';
    } else if (this.type === 'fire') {
      borderColor = '#F97316';
      icon = '🔥';
    } else if (this.type === 'speed') {
      borderColor = '#38BDF8';
      icon = '👟';
    }

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, 0, 1);

    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MODUL BOM & LEDAKAN
// ═══════════════════════════════════════════════════════════════════

class Bomb {
  constructor(c, r, ownerSlot, blastRange) {
    this.c = c;
    this.r = r;
    this.x = OX + c * CS + CS / 2;
    this.y = OY + r * CS + CS / 2;
    this.owner = ownerSlot;
    this.blastRange = blastRange;
    this.timer = BOMB_FUSE_SEC;
    this.exploded = false;
    this.pulse = 0;

    // Set slot pemain yang masih berada di dalam sel bom saat diletakkan (pass-through once)
    this.passThrough = new Set([ownerSlot]);
  }

  update(dt) {
    this.timer -= dt;
    this.pulse += dt * 8;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Animasi denyut bom saat mendekati meledak
    const urgency = 1.0 - Math.max(0, this.timer / BOMB_FUSE_SEC);
    const pulseFactor = Math.sin(this.pulse * (1 + urgency * 2)) * 0.12;
    const radius = 19 * (1.0 + pulseFactor);

    // Bayangan Bom
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 18, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Badan Bom Bulat Hitam Mengkilap
    const grad = ctx.createRadialGradient(-5, -6, 2, 0, 0, radius);
    grad.addColorStop(0, '#64748B');
    grad.addColorStop(0.3, '#1E293B');
    grad.addColorStop(1, '#020617');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 2, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = urgency > 0.6 ? '#EF4444' : '#475569';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Sumbu & Pijar Api di Puncak Bom
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(-3, -radius - 3, 6, 6);

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(0, -radius - 5, 4 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(0, -radius - 5, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

class FlameTile {
  constructor(c, r, ownerSlot, isCenter = false) {
    this.c = c;
    this.r = r;
    this.x = OX + c * CS + CS / 2;
    this.y = OY + r * CS + CS / 2;
    this.owner = ownerSlot;
    this.isCenter = isCenter;
    this.timer = EXPLOSION_DURATION;
  }

  update(dt) {
    this.timer -= dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    const progress = Math.max(0, this.timer / EXPLOSION_DURATION);
    const halfSize = (CS / 2 - 2) * Math.sin(progress * Math.PI);

    // Cahaya Luar Oranye/Merah
    ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-halfSize, -halfSize, halfSize * 2, halfSize * 2, 6);
    ctx.fill();

    // Lidah Api Kuning Emas di Tengah
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(0, 0, halfSize * 0.65, 0, Math.PI * 2);
    ctx.fill();

    // Pijar Putih di Pusat Ledakan
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, halfSize * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MODUL KARAKTER BOMBER (PEMAIN / BOT)
// ═══════════════════════════════════════════════════════════════════

class Bomber {
  constructor(slot, startC, startR, isAi = false) {
    this.slot = slot;
    this.startC = startC;
    this.startR = startR;
    this.colorData = SLOT_COLORS[slot] || SLOT_COLORS[1];
    this.isAi = isAi;

    this.x = OX + startC * CS + CS / 2;
    this.y = OY + startR * CS + CS / 2;
    this.r = 18; // radius tubuh karakter

    this.dir = 0; // 0=diam, 1=atas, 2=bawah, 3=kiri, 4=kanan
    this.facing = 2; // arah menghadap visual
    this.speed = BASE_PLAYER_SPEED;

    this.maxBombs = BASE_MAX_BOMBS;
    this.activeBombs = 0;
    this.blastRange = BASE_BLAST_RANGE;

    this.lives = INITIAL_LIVES;
    this.score = 0;
    this.invulnTimer = 0;
    this.respawnTimer = 0;
    this.alive = true;
    this.walkAnim = 0;

    // AI Variables
    this.aiTimer = Math.random() * 0.3;
    this.aiTargetDir = 0;
  }

  respawn() {
    this.x = OX + this.startC * CS + CS / 2;
    this.y = OY + this.startR * CS + CS / 2;
    this.dir = 0;
    this.facing = 2;
    this.alive = true;
    this.invulnTimer = INVULN_SEC;
  }

  update(dt, canMoveToCellFn) {
    if (this.lives <= 0) return;

    // Timer Respawn Pasca Terkena Ledakan
    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
      return;
    }

    if (this.invulnTimer > 0) {
      this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    }

    if (this.dir === 0) return;

    this.facing = this.dir;
    this.walkAnim += dt * 10;

    const d = DIRS[this.dir];
    if (!d) return;

    const moveStep = this.speed * dt;
    const targetX = this.x + d.dx * moveStep;
    const targetY = this.y + d.dy * moveStep;

    const curC = Math.floor((this.x - OX) / CS);
    const curR = Math.floor((this.y - OY) / CS);
    const cellCenterX = OX + curC * CS + CS / 2;
    const cellCenterY = OY + curR * CS + CS / 2;

    // Bantuan Belok Sudut (Corner Sliding)
    // Jika bergerak horizontal (Kiri/Kanan), sejajarkan Y dengan halus ke garis tengah lorong
    if (d.dx !== 0) {
      const diffY = cellCenterY - this.y;
      if (Math.abs(diffY) <= CORNER_SLIDE_ASSIST) {
        this.y += Math.sign(diffY) * Math.min(Math.abs(diffY), moveStep * 0.8);
      }
      // Uji tabrakan di petak tujuan
      const checkC = curC + d.dx;
      const isBlocked = !canMoveToCellFn(checkC, curR, this.slot);

      if (isBlocked) {
        if (d.dx > 0 && targetX > cellCenterX) this.x = cellCenterX;
        else if (d.dx < 0 && targetX < cellCenterX) this.x = cellCenterX;
        else this.x = targetX;
      } else {
        this.x = targetX;
      }
    }

    // Jika bergerak vertikal (Atas/Bawah), sejajarkan X dengan halus ke garis tengah lorong
    if (d.dy !== 0) {
      const diffX = cellCenterX - this.x;
      if (Math.abs(diffX) <= CORNER_SLIDE_ASSIST) {
        this.x += Math.sign(diffX) * Math.min(Math.abs(diffX), moveStep * 0.8);
      }
      // Uji tabrakan di petak tujuan
      const checkR = curR + d.dy;
      const isBlocked = !canMoveToCellFn(curC, checkR, this.slot);

      if (isBlocked) {
        if (d.dy > 0 && targetY > cellCenterY) this.y = cellCenterY;
        else if (d.dy < 0 && targetY < cellCenterY) this.y = cellCenterY;
        else this.y = targetY;
      } else {
        this.y = targetY;
      }
    }
  }

  draw(ctx) {
    if (this.lives <= 0 || !this.alive) return;

    // Efek Kedip saat Kebal
    if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 10) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Bayangan Karakter
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tubuh Karakter Bomber
    ctx.fillStyle = this.colorData.hex;
    ctx.beginPath();
    ctx.roundRect(-14, -14, 28, 28, 9);
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Helm / Topi Putih Arkade
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, -6, 11, Math.PI, 0, false);
    ctx.fill();

    // Kacamata / Visor Wajah
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    const eyeOffsetY = this.facing === 1 ? -6 : (this.facing === 2 ? 0 : -2);
    const eyeOffsetX = this.facing === 3 ? -3 : (this.facing === 4 ? 3 : 0);
    ctx.roundRect(-8 + eyeOffsetX, -2 + eyeOffsetY, 16, 8, 4);
    ctx.fill();

    // Sorot Mata Biru Muda
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.arc(-3 + eyeOffsetX, 2 + eyeOffsetY, 1.8, 0, Math.PI * 2);
    ctx.arc(3 + eyeOffsetX, 2 + eyeOffsetY, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Antena Kecil di Puncak Topi
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(0, -19);
    ctx.stroke();

    ctx.fillStyle = this.colorData.hex;
    ctx.beginPath();
    ctx.arc(0, -21, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Label P1 / BOT di Atas Karakter
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.textAlign = 'center';
    const labelTxt = this.isAi ? `BOT${this.slot}` : `P${this.slot}`;
    ctx.strokeText(labelTxt, 0, -26);
    ctx.fillText(labelTxt, 0, -26);

    ctx.restore();
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

    this.bombs = [];
    this.flames = [];
    this.powerups = [];
    this.floatingTexts = [];

    // Inisialisasi Peta Arena Grid
    this.initArenaGrid();

    // Titik Spawn 4 Sudut Simetris (Baris ganjil & kolom ganjil)
    const SPAWNS = {
      1: { c: 1,  r: 1 },  // TL
      2: { c: 15, r: 9 },  // BR
      3: { c: 1,  r: 9 },  // BL
      4: { c: 15, r: 1 }   // TR
    };

    // Mode 1P: Pemain 1 adalah Manusia, Slot 2, 3, 4 diisi AI Bot
    this.isSolo = players.length === 1;

    if (this.isSolo) {
      this.bombers = [
        new Bomber(players[0], SPAWNS[1].c, SPAWNS[1].r, false),
        new Bomber(2, SPAWNS[2].c, SPAWNS[2].r, true),
        new Bomber(3, SPAWNS[3].c, SPAWNS[3].r, true),
        new Bomber(4, SPAWNS[4].c, SPAWNS[4].r, true)
      ];
    } else {
      this.bombers = players.map(slot => {
        const sp = SPAWNS[slot] || SPAWNS[1];
        return new Bomber(slot, sp.c, sp.r, false);
      });
    }

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

  initArenaGrid() {
    this.grid = Array.from({ length: ROWS }, () => new Array(COLS).fill('.'));

    const isSafeCell = (c, r) => {
      // Area aman 2 langkah dari 4 sudut agar tidak tertutup balok bata
      if (c <= 2 && r <= 2 && c + r <= 3) return true; // TL
      if (c >= 14 && r <= 2 && (16 - c) + r <= 3) return true; // TR
      if (c <= 2 && r >= 8 && c + (10 - r) <= 3) return true; // BL
      if (c >= 14 && r >= 8 && (16 - c) + (10 - r) <= 3) return true; // BR
      return false;
    };

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // Tembok Luar & Pilar Baja Tetap (Berselang-seling genap)
        if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1 || (r % 2 === 0 && c % 2 === 0)) {
          this.grid[r][c] = '#'; // Tembok Baja (Indestructible)
        } else if (isSafeCell(c, r)) {
          this.grid[r][c] = '.'; // Lantai Kosong Aman
        } else {
          // Balok Bata Hancur (65% kemungkinan)
          if (Math.random() < 0.65) {
            this.grid[r][c] = 'B';
          } else {
            this.grid[r][c] = '.';
          }
        }
      }
    }
  }

  isWallOrBlock(c, r) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
    return this.grid[r][c] === '#' || this.grid[r][c] === 'B';
  }

  canMoveToCell(c, r, slot) {
    if (this.isWallOrBlock(c, r)) return false;

    // Cek tabrakan dengan bom padat
    for (const b of this.bombs) {
      if (b.c === c && b.r === r) {
        // Jika pemain masih dalam daftar pass-through (baru saja ditaruh), diizinkan lewat
        if (b.passThrough.has(slot)) return true;
        return false;
      }
    }
    return true;
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

      if (this.state === 'waiting') {
        if (key === ' ' || key === 'enter') {
          if (p1 != null) this.handleInput(p1, '99');
          return;
        }
      }

      // P1: W / A / S / D + Space (Bom)
      if (key === 'w') this.handleInput(p1, '1');
      else if (key === 's') this.handleInput(p1, '2');
      else if (key === 'a') this.handleInput(p1, '3');
      else if (key === 'd') this.handleInput(p1, '4');
      else if (key === ' ') this.handleInput(p1, '5');

      // P2: Panah + Enter (Bom)
      if (p2 != null) {
        if (e.key === 'ArrowUp')    this.handleInput(p2, '1');
        else if (e.key === 'ArrowDown')  this.handleInput(p2, '2');
        else if (e.key === 'ArrowLeft')  this.handleInput(p2, '3');
        else if (e.key === 'ArrowRight') this.handleInput(p2, '4');
        else if (e.key === 'Enter')      this.handleInput(p2, '5');
      }
    };

    this.onKeyUp = (e) => {
      const key = e.key.toLowerCase();
      const p1 = this.players[0];
      const p2 = this.players[1];

      if (key === 'w' || key === 's' || key === 'a' || key === 'd') {
        this.handleInput(p1, '0');
      }
      if (p2 != null && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        this.handleInput(p2, '0');
      }
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
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
      const b = this.bombers.find(bm => bm.slot === slot);
      if (!b || b.lives <= 0 || !b.alive) return;

      if (cmd === '1' || cmd === '2' || cmd === '3' || cmd === '4') {
        b.dir = parseInt(cmd, 10);
      } else if (cmd === '0') {
        b.dir = 0;
      } else if (cmd === '5') {
        this.tryPlaceBomb(b);
      }
    }
  }

  tryPlaceBomb(bomber) {
    if (bomber.activeBombs >= bomber.maxBombs) return;

    const cellC = Math.floor((bomber.x - OX) / CS);
    const cellR = Math.floor((bomber.y - OY) / CS);

    // Cek apakah sudah ada bom di petak ini
    const existing = this.bombs.find(bm => bm.c === cellC && bm.r === cellR);
    if (existing) return;

    const newBomb = new Bomb(cellC, cellR, bomber.slot, bomber.blastRange);
    this.bombs.push(newBomb);
    bomber.activeBombs++;
    this.playAudio('click', { volume: 0.3 });
  }

  detonateBomb(bomb) {
    bomb.exploded = true;
    const ownerBomber = this.bombers.find(b => b.slot === bomb.owner);
    if (ownerBomber) ownerBomber.activeBombs = Math.max(0, ownerBomber.activeBombs - 1);

    this.playAudio('hit', { volume: 0.6 });

    // Petak Pusat Ledakan
    this.flames.push(new FlameTile(bomb.c, bomb.r, bomb.owner, true));

    // Sebarkan Ledakan ke 4 Arah (Atas, Bawah, Kiri, Kanan)
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];

    for (const [dc, dr] of dirs) {
      for (let step = 1; step <= bomb.blastRange; step++) {
        const nc = bomb.c + dc * step;
        const nr = bomb.r + dr * step;

        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) break;

        // 1. Tembok Baja (Indestructible): Ledakan tertahan total
        if (this.grid[nr][nc] === '#') break;

        // 2. Balok Bata (Destructible): Balok hancur, beri poin, dan ledakan berhenti
        if (this.grid[nr][nc] === 'B') {
          this.grid[nr][nc] = '.';
          this.flames.push(new FlameTile(nc, nr, bomb.owner));

          if (ownerBomber) ownerBomber.score += 10;

          // Peluang Muncul Power-Up
          if (Math.random() < POWERUP_CHANCE) {
            const roll = Math.random();
            let pType = 'bomb';
            if (roll < 0.45) pType = 'bomb';
            else if (roll < 0.80) pType = 'fire';
            else pType = 'speed';
            this.powerups.push(new PowerUp(nc, nr, pType));
          }
          break;
        }

        // 3. Bom Lain: Memicu Reaksi Berantai Langsung
        const otherBomb = this.bombs.find(b => !b.exploded && b.c === nc && b.r === nr);
        if (otherBomb) {
          otherBomb.timer = 0;
        }

        // 4. Lantai Kosong: Munculkan Api Ledakan & Lanjut ke Petak Berikutnya
        this.flames.push(new FlameTile(nc, nr, bomb.owner));
      }
    }
  }

  addFloatingText(txt, x, y, color = '#FDE047') {
    this.floatingTexts.push({ text: txt, x, y, alpha: 1.0, color });
  }

  updateAI(dt) {
    if (!this.isSolo) return;

    for (const b of this.bombers) {
      if (!b.isAi || b.lives <= 0 || !b.alive) continue;

      b.aiTimer -= dt;
      if (b.aiTimer > 0) continue;
      b.aiTimer = 0.2 + Math.random() * 0.15; // Interval keputusan AI

      const curC = Math.floor((b.x - OX) / CS);
      const curR = Math.floor((b.y - OY) / CS);

      // Cek apakah posisi saat ini berbahaya (akan terkena ledakan bom atau api)
      const inDanger = this.flames.some(f => f.c === curC && f.r === curR) ||
        this.bombs.some(bm => {
          if (bm.c === curC && Math.abs(bm.r - curR) <= bm.blastRange) return true;
          if (bm.r === curR && Math.abs(bm.c - curC) <= bm.blastRange) return true;
          return false;
        });

      if (inDanger) {
        // PRIORITAS: Menghindar ke petak aman di sekitarnya
        const escapeDirs = [1, 2, 3, 4].filter(dirNum => {
          const d = DIRS[dirNum];
          return this.canMoveToCell(curC + d.dx, curR + d.dy, b.slot);
        });

        if (escapeDirs.length > 0) {
          b.dir = escapeDirs[Math.floor(Math.random() * escapeDirs.length)];
        }
      } else {
        // Cari balok bata di sekitar untuk diledakkan
        const nearBrick = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dc, dr]) => {
          const checkC = curC + dc;
          const checkR = curR + dr;
          return checkC >= 0 && checkC < COLS && checkR >= 0 && checkR < ROWS && this.grid[checkR][checkC] === 'B';
        });

        if (nearBrick && b.activeBombs < b.maxBombs && Math.random() < 0.45) {
          this.tryPlaceBomb(b);
          // Langsung kabur menjauh setelah meletakkan bom
          const dirs = [1, 2, 3, 4].filter(dirNum => {
            const d = DIRS[dirNum];
            return this.canMoveToCell(curC + d.dx, curR + d.dy, b.slot);
          });
          if (dirs.length > 0) b.dir = dirs[Math.floor(Math.random() * dirs.length)];
        } else {
          // Jelajah santai mencari item atau mendekati lawan
          const validDirs = [1, 2, 3, 4].filter(dirNum => {
            const d = DIRS[dirNum];
            return this.canMoveToCell(curC + d.dx, curR + d.dy, b.slot);
          });
          if (validDirs.length > 0) {
            b.dir = validDirs[Math.floor(Math.random() * validDirs.length)];
          } else {
            b.dir = 0;
          }
        }
      }
    }
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

    // 1. Timer Permainan 90 Detik
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

    // 3. Update Item Power-Up
    for (const pu of this.powerups) pu.update(dt);

    // 4. Update Bom
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bm = this.bombs[i];
      bm.update(dt);

      // Cek apakah pemain yang meletakkan bom sudah melangkah keluar dari petak bom
      for (const slot of bm.passThrough) {
        const bomber = this.bombers.find(b => b.slot === slot);
        if (bomber) {
          const bCellC = Math.floor((bomber.x - OX) / CS);
          const bCellR = Math.floor((bomber.y - OY) / CS);
          if (bCellC !== bm.c || bCellR !== bm.r) {
            bm.passThrough.delete(slot);
          }
        }
      }

      if (bm.timer <= 0 && !bm.exploded) {
        this.detonateBomb(bm);
        this.bombs.splice(i, 1);
      }
    }

    // 5. Update Api Ledakan (Flames)
    for (let i = this.flames.length - 1; i >= 0; i--) {
      const fl = this.flames[i];
      fl.update(dt);

      // Bakar item power-up jika terkena lidah api
      for (let pIdx = this.powerups.length - 1; pIdx >= 0; pIdx--) {
        const pu = this.powerups[pIdx];
        if (pu.alive && pu.c === fl.c && pu.r === fl.r) {
          pu.alive = false;
          this.powerups.splice(pIdx, 1);
        }
      }

      if (fl.timer <= 0) {
        this.flames.splice(i, 1);
      }
    }

    // 6. Update AI Bot
    this.updateAI(dt);

    // 7. Update Karakter Pemain & Deteksi Ledakan
    for (const b of this.bombers) {
      b.update(dt, (c, r, slot) => this.canMoveToCell(c, r, slot));

      if (b.lives <= 0 || !b.alive) continue;

      const curC = Math.floor((b.x - OX) / CS);
      const curR = Math.floor((b.y - OY) / CS);

      // Cek Pengambilan Item Power-Up
      for (let pIdx = this.powerups.length - 1; pIdx >= 0; pIdx--) {
        const pu = this.powerups[pIdx];
        if (pu.alive && pu.c === curC && pu.r === curR) {
          pu.alive = false;
          this.powerups.splice(pIdx, 1);
          this.playAudio('powerup', { volume: 0.45 });

          if (pu.type === 'bomb') {
            b.maxBombs = Math.min(MAX_CAPACITY_BOMBS, b.maxBombs + 1);
            this.addFloatingText('+1 BOM 💣', b.x, b.y - 15, '#EF4444');
          } else if (pu.type === 'fire') {
            b.blastRange = Math.min(MAX_BLAST_RANGE, b.blastRange + 1);
            this.addFloatingText('+1 API 🔥', b.x, b.y - 15, '#F97316');
          } else if (pu.type === 'speed') {
            b.speed = Math.min(MAX_PLAYER_SPEED, b.speed + 25);
            this.addFloatingText('SPEED UP 👟', b.x, b.y - 15, '#38BDF8');
          }
        }
      }

      // Cek Tersengat Api Ledakan
      if (b.invulnTimer <= 0) {
        const hitFlame = this.flames.find(f => f.c === curC && f.r === curR);
        if (hitFlame) {
          b.lives--;
          b.alive = false;
          b.respawnTimer = 1.0;
          this.playAudio('hurt', { volume: 0.5 });

          // Beri poin +100 ke pemain penaruh bom jika mengenai lawan
          if (hitFlame.owner !== b.slot) {
            const killer = this.bombers.find(bm => bm.slot === hitFlame.owner);
            if (killer) {
              killer.score += 100;
              this.addFloatingText('+100 💥', b.x, b.y - 20, '#FACC15');
            }
          }

          // Cek apakah seluruh pemain habis nyawa
          const anyAlive = this.bombers.some(bm => bm.lives > 0);
          if (!anyAlive) {
            this.gameOver();
            return;
          }
        }
      }
    }
  }

  gameOver() {
    if (this.state === 'over') return;
    this.state = 'over';
    this.playAudio('win');

    let finishText = '';
    if (this.isSolo) {
      const p1 = this.bombers[0];
      let stars = '⭐';
      if (p1.score >= 500) stars = '⭐⭐⭐';
      else if (p1.score >= 250) stars = '⭐⭐';
      finishText = `Waktu Habis! Skor P1: ${p1.score} (${stars})`;
    } else {
      const sorted = [...this.bombers].sort((a, b) => b.score - a.score);
      const scoreStr = this.bombers.map(b => `P${b.slot} ${b.score} poin`).join(', ');

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

  drawArena() {
    // Latar Belakang Luar Arena Gelap
    this.ctx.fillStyle = '#060A14';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Permukaan Lantai Arena Hijau Rumput Arkade
    this.ctx.fillStyle = '#166534';
    this.ctx.fillRect(OX, OY, COLS * CS, ROWS * CS);

    // Grid Lantai Halus
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      this.ctx.beginPath();
      this.ctx.moveTo(OX + c * CS, OY);
      this.ctx.lineTo(OX + c * CS, OY + ROWS * CS);
      this.ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      this.ctx.beginPath();
      this.ctx.moveTo(OX, OY + r * CS);
      this.ctx.lineTo(OX + COLS * CS, OY + r * CS);
      this.ctx.stroke();
    }

    // Gambar Balok & Tembok
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const char = this.grid[r][c];
        const px = OX + c * CS;
        const py = OY + r * CS;

        if (char === '#') {
          // Tembok Baja / Pilar Permanen (Indestructible)
          this.ctx.fillStyle = '#334155';
          this.ctx.beginPath();
          this.ctx.roundRect(px + 2, py + 2, CS - 4, CS - 4, 6);
          this.ctx.fill();

          this.ctx.strokeStyle = '#64748B';
          this.ctx.lineWidth = 2;
          this.ctx.stroke();

          // Kilau atas pilar
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          this.ctx.fillRect(px + 6, py + 4, CS - 12, 3);
        } else if (char === 'B') {
          // Balok Bata Hancur (Destructible Brick)
          this.ctx.fillStyle = '#B45309';
          this.ctx.beginPath();
          this.ctx.roundRect(px + 2, py + 2, CS - 4, CS - 4, 6);
          this.ctx.fill();

          this.ctx.strokeStyle = '#D97706';
          this.ctx.lineWidth = 2;
          this.ctx.stroke();

          // Garis Tekstur Bata
          this.ctx.strokeStyle = '#78350F';
          this.ctx.lineWidth = 1.5;
          this.ctx.beginPath();
          this.ctx.moveTo(px + 4, py + CS / 2);
          this.ctx.lineTo(px + CS - 4, py + CS / 2);
          this.ctx.moveTo(px + CS / 2, py + 4);
          this.ctx.lineTo(px + CS / 2, py + CS / 2);
          this.ctx.stroke();
        }
      }
    }
  }

  drawHUD() {
    this.ctx.save();

    // 1. Floating Timer & Mode Chip di Tengah Atas
    const timerW = 180;
    const timerH = 38;
    const timerX = (CANVAS_WIDTH - timerW) / 2;
    const timerY = 14;

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
    this.ctx.fillText(`⏱ ${Math.ceil(this.timeLeft)}s  •  ARENA`, timerX + timerW / 2, timerY + timerH / 2);

    // 2. Statistik Pemain di Kiri & Kanan (Floating Glass Badges)
    let playerPositions = [];
    if (this.bombers.length === 1) {
      playerPositions = [{ x: 300, w: 230 }];
    } else if (this.bombers.length === 2) {
      playerPositions = [
        { x: 280, w: 230 },
        { x: 770, w: 230 }
      ];
    } else {
      playerPositions = [
        { x: 70,  w: 220 },
        { x: 300, w: 220 },
        { x: 760, w: 210 },
        { x: 990, w: 210 }
      ];
    }

    this.bombers.forEach((b, idx) => {
      const pos = playerPositions[idx] || { x: 70 + idx * 220, w: 200 };
      const px = pos.x;
      const py = 12;
      const pw = pos.w;
      const ph = 42;

      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      this.ctx.strokeStyle = b.colorData.hex;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.roundRect(px, py, pw, ph, 8);
      this.ctx.fill();
      this.ctx.stroke();

      // Skor Pemain
      this.ctx.font = 'bold 15px sans-serif';
      this.ctx.fillStyle = b.colorData.hex;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'alphabetic';
      const label = b.isAi ? `BOT${b.slot}` : `P${b.slot}`;
      this.ctx.fillText(`${label}: ${b.score} pts`, px + 10, py + 18);

      // Sisa Nyawa & Buff Aktif
      let statusStr = '';
      if (b.lives <= 0) {
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.fillStyle = '#EF4444';
        statusStr = '💀 GUGUR';
      } else {
        let hearts = '';
        for (let i = 0; i < INITIAL_LIVES; i++) hearts += (i < b.lives) ? '❤️' : '💔';
        let buffs = ` 💣${b.maxBombs} 🔥${b.blastRange}`;
        if (b.invulnTimer > 0) buffs += ' 🛡️';
        this.ctx.font = '12px sans-serif';
        this.ctx.fillStyle = '#F8FAFC';
        statusStr = `${hearts}${buffs}`;
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
      this.ctx.fillStyle = '#EF4444';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('💣 Bomberman Arena', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 75);

      this.ctx.font = '19px sans-serif';
      this.ctx.fillStyle = '#38BDF8';
      this.ctx.fillText(`Kirim 99# dari micro:bit P${this.players[0]}, atau klik layar / Spasi untuk mulai`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);

      this.ctx.font = '14px sans-serif';
      this.ctx.fillStyle = '#94A3B8';
      this.ctx.fillText('Kontrol: Atas (1), Bawah (2), Kiri (3), Kanan (4), Datar (0) = Diam  |  Taruh Bom (5)', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 35);
      this.ctx.fillText('P1: W / A / S / D + Space (Bom)  |  P2: Panah + Enter (Bom)', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 65);

      this.ctx.font = '13px sans-serif';
      this.ctx.fillStyle = '#FDE047';
      this.ctx.fillText('💡 Tip: Hancurkan balok bata untuk mengambil Power-Up (Bomb 💣, Fire 🔥, Speed 👟)!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100);

      this.ctx.restore();
    }

    // 2. Countdown 3-2-1
    if (this.state === 'countdown') {
      this.ctx.save();
      const digit = Math.ceil(this.countdownTimer);
      this.ctx.font = 'bold 120px sans-serif';
      this.ctx.fillStyle = '#EF4444';
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

    this.drawArena();

    for (const pu of this.powerups) pu.draw(this.ctx);
    for (const bm of this.bombs) bm.draw(this.ctx);
    for (const fl of this.flames) fl.draw(this.ctx);
    for (const b of this.bombers) b.draw(this.ctx);

    // Teks Melayang
    for (const ft of this.floatingTexts) {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, ft.alpha);
      this.ctx.font = 'bold 16px sans-serif';
      this.ctx.fillStyle = ft.color;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(ft.text, ft.x, ft.y);
      this.ctx.restore();
    }

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
    if (this.onKeyUp) window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('click', this.onCanvasClick);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  EKSPOR DEFAULT SESUAI KONTRAK PLATFORM
// ═══════════════════════════════════════════════════════════════════

export default {
  id: 'bomberman',
  name: 'Bomberman',
  icon: '💣',
  tag: 'Retro',
  description: 'Taruh bom, ledakkan balok bata untuk mengumpulkan power-up, dan kalahkan lawanmu di arena ledak arkade retro!',
  modes: [
    { id: '1p', label: '1 Player', sub: 'Lawan AI Bot',   players: 1 },
    { id: '2p', label: '2 Player', sub: 'Duel Ledak',     players: 2 },
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
