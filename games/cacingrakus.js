// GAME: Cacing Rakus (Multiplayer Snake)
// games/cacingrakus.js
// Fixed Canvas 1280x720, Grid 40x40 (32x18 cells)
// Mendukung mode 1P, 2P, dan 4P dengan wrap-around Pac-Man style.

'use strict';

const CANVAS_WIDTH       = 1280;
const CANVAS_HEIGHT      = 720;
const CELL_SIZE          = 40;
const GRID_COLS          = 32; // 1280 / 40
const GRID_ROWS          = 18; // 720 / 40

const GAME_DURATION_SEC  = 90;
const COUNTDOWN_SEC      = 3;
const MOVE_INTERVAL_SEC  = 0.125; // 8 langkah per detik
const RESPAWN_DELAY_SEC  = 1.0;
const INVULN_TIME_SEC    = 2.0;
const GOLDEN_INTERVAL    = 15.0;
const GOLDEN_LIFETIME    = 8.0;
const INITIAL_SNAKE_LEN  = 3;
const INITIAL_LIVES      = 3;

// Warna Khas Tiap Slot Pemain
const SLOT_COLORS = {
  1: { name: 'Merah',  hex: '#ef4444', dark: '#991b1b', light: '#fca5a5' },
  2: { name: 'Biru',   hex: '#3b82f6', dark: '#1e40af', light: '#93c5fd' },
  3: { name: 'Hijau',  hex: '#22c55e', dark: '#166534', light: '#86efac' },
  4: { name: 'Kuning', hex: '#eab308', dark: '#854d0e', light: '#fde047' }
};

// Definisi Vektor Arah
const DIRS = {
  UP:    { code: '1', dx: 0,  dy: -1, name: 'UP' },
  DOWN:  { code: '2', dx: 0,  dy: 1,  name: 'DOWN' },
  LEFT:  { code: '3', dx: -1, dy: 0,  name: 'LEFT' },
  RIGHT: { code: '4', dx: 1,  dy: 0,  name: 'RIGHT' }
};

// Konfigurasi Spawn Awal Simetris 4 Sudut
const SPAWN_CONFIGS = [
  // P1: Kiri-Atas menghadap Kanan
  { col: 4,  row: 3,  dir: DIRS.RIGHT },
  // P2: Kanan-Bawah menghadap Kiri
  { col: 27, row: 14, dir: DIRS.LEFT },
  // P3: Kiri-Bawah menghadap Kanan
  { col: 4,  row: 14, dir: DIRS.RIGHT },
  // P4: Kanan-Atas menghadap Kiri
  { col: 27, row: 3,  dir: DIRS.LEFT }
];

// ═══════════════════════════════════════════════════════════════════
//  MODUL INPUT HANDLER
// ═══════════════════════════════════════════════════════════════════

class InputHandler {
  constructor(kernel, players, onCommand) {
    this.players = players;
    this.onCommand = onCommand;

    // Pasang listener kernel micro:bit
    this.offKernel = kernel.on('input', ({ player, cmd }) => {
      this.onCommand(player, cmd);
    });

    // Pasang keyboard fallback
    this.onKeyDown = (e) => {
      const key = e.key.toLowerCase();

      // P1: W / A / S / D + Spasi
      if (players[0] != null) {
        const p1 = players[0];
        if (key === 'w') this.onCommand(p1, '1');
        else if (key === 's') this.onCommand(p1, '2');
        else if (key === 'a') this.onCommand(p1, '3');
        else if (key === 'd') this.onCommand(p1, '4');
        else if (key === ' ' || key === 'enter') this.onCommand(p1, '99');
      }

      // P2: Arrow Keys
      if (players[1] != null) {
        const p2 = players[1];
        if (e.key === 'ArrowUp') this.onCommand(p2, '1');
        else if (e.key === 'ArrowDown') this.onCommand(p2, '2');
        else if (e.key === 'ArrowLeft') this.onCommand(p2, '3');
        else if (e.key === 'ArrowRight') this.onCommand(p2, '4');
      }
    };

    window.addEventListener('keydown', this.onKeyDown);
  }

  destroy() {
    if (this.offKernel) this.offKernel();
    window.removeEventListener('keydown', this.onKeyDown);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MODUL FOOD MANAGER
// ═══════════════════════════════════════════════════════════════════

class FoodManager {
  constructor(activePlayerCount) {
    this.targetNormalCount = activePlayerCount + 2;
    this.normalFoods = []; // { x, y }
    this.goldenFood = null; // { x, y, timeLeft }
    this.goldenTimer = GOLDEN_INTERVAL;
  }

  update(dt, snakes) {
    // 1. Pastikan jumlah makanan biasa selalu terpenuhi
    while (this.normalFoods.length < this.targetNormalCount) {
      const pos = this.findEmptyCell(snakes);
      if (pos) {
        this.normalFoods.push(pos);
      } else {
        break;
      }
    }

    // 2. Timer kemunculan makanan emas
    this.goldenTimer -= dt;
    if (this.goldenTimer <= 0 && !this.goldenFood) {
      const pos = this.findEmptyCell(snakes);
      if (pos) {
        this.goldenFood = { x: pos.x, y: pos.y, timeLeft: GOLDEN_LIFETIME };
      }
      this.goldenTimer = GOLDEN_INTERVAL;
    }

    // 3. Durasi aktif makanan emas
    if (this.goldenFood) {
      this.goldenFood.timeLeft -= dt;
      if (this.goldenFood.timeLeft <= 0) {
        this.goldenFood = null;
      }
    }
  }

  findEmptyCell(snakes) {
    const occupied = new Set();

    // Tandai seluruh segmen cacing
    for (const snake of snakes) {
      if (!snake.alive) continue;
      for (const seg of snake.body) {
        occupied.add(`${seg.x},${seg.y}`);
      }
    }

    // Tandai makanan yang sudah ada
    for (const f of this.normalFoods) {
      occupied.add(`${f.x},${f.y}`);
    }
    if (this.goldenFood) {
      occupied.add(`${this.goldenFood.x},${this.goldenFood.y}`);
    }

    const freeCells = [];
    for (let x = 0; x < GRID_COLS; x++) {
      for (let y = 0; y < GRID_ROWS; y++) {
        // Jangan spawn di baris HUD paling atas jika memungkinkan
        if (y < 2) continue;
        if (!occupied.has(`${x},${y}`)) {
          freeCells.push({ x, y });
        }
      }
    }

    if (freeCells.length === 0) return null;
    return freeCells[Math.floor(Math.random() * freeCells.length)];
  }

  addFoodAt(x, y) {
    // Cek apakah sel sudah ada makanan
    const exists = this.normalFoods.some(f => f.x === x && f.y === y);
    if (!exists) {
      this.normalFoods.push({ x, y });
    }
  }

  checkCollision(headX, headY) {
    // Cek makanan biasa (+10 poin, +1 panjang)
    const normalIdx = this.normalFoods.findIndex(f => f.x === headX && f.y === headY);
    if (normalIdx !== -1) {
      this.normalFoods.splice(normalIdx, 1);
      return { type: 'normal', points: 10, grow: 1 };
    }

    // Cek makanan emas (+30 poin, +2 panjang)
    if (this.goldenFood && this.goldenFood.x === headX && this.goldenFood.y === headY) {
      this.goldenFood = null;
      return { type: 'golden', points: 30, grow: 2 };
    }

    return null;
  }

  draw(ctx) {
    // 1. Gambar Makanan Biasa (Apel Merah Mengkilap)
    for (const f of this.normalFoods) {
      const cx = f.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = f.y * CELL_SIZE + CELL_SIZE / 2;
      const r = CELL_SIZE * 0.38;

      ctx.save();
      // Bayangan makanan
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.8, r * 0.8, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Buah
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Kilauan cahaya
      ctx.fillStyle = '#fca5a5';
      ctx.beginPath();
      ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Tangkai daun hijau
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.quadraticCurveTo(cx + 4, cy - r - 6, cx + 8, cy - r - 4);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Gambar Makanan Emas (Bintang/Apel Emas Berpendar)
    if (this.goldenFood) {
      const gf = this.goldenFood;
      const cx = gf.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = gf.y * CELL_SIZE + CELL_SIZE / 2;
      const pulse = 1 + 0.15 * Math.sin(performance.now() / 150);
      const r = CELL_SIZE * 0.42 * pulse;

      ctx.save();
      // Pendaran cahaya emas
      ctx.fillStyle = 'rgba(234, 179, 8, 0.35)';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Buah Emas
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Simbol Bintang / Mahkota
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#78350f';
      ctx.textAlign = 'center';
      ctx.fillText('⭐', cx, cy + 5);

      ctx.restore();
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MODUL SNAKE (CACING)
// ═══════════════════════════════════════════════════════════════════

class Snake {
  constructor(slot, spawnCfg) {
    this.slot = slot;
    this.colorData = SLOT_COLORS[slot] || SLOT_COLORS[1];
    this.spawnCfg = spawnCfg;

    this.lives = INITIAL_LIVES;
    this.score = 0;
    this.alive = true;
    this.eliminated = false;

    this.respawnTimer = 0;
    this.invulnerableTimer = 0;
    this.growCount = 0;

    // Buffer antrian input arah (maks 2 antrian)
    this.inputQueue = [];
    this.currentDir = spawnCfg.dir;

    this.resetBody();
  }

  resetBody() {
    this.currentDir = this.spawnCfg.dir;
    this.inputQueue = [];
    this.body = [];

    // Buat 3 segmen awal sesuai arah hadap
    const headX = this.spawnCfg.col;
    const headY = this.spawnCfg.row;
    const oppDx = -this.currentDir.dx;
    const oppDy = -this.currentDir.dy;

    for (let i = 0; i < INITIAL_SNAKE_LEN; i++) {
      this.body.push({
        x: (headX + oppDx * i + GRID_COLS) % GRID_COLS,
        y: (headY + oppDy * i + GRID_ROWS) % GRID_ROWS
      });
    }
  }

  queueDirection(cmd) {
    if (!this.alive || this.eliminated) return;

    let targetDir = null;
    if (cmd === '1') targetDir = DIRS.UP;
    else if (cmd === '2') targetDir = DIRS.DOWN;
    else if (cmd === '3') targetDir = DIRS.LEFT;
    else if (cmd === '4') targetDir = DIRS.RIGHT;
    if (!targetDir) return;

    // Tentukan arah pembanding (arah terakhir di queue atau currentDir)
    const lastDir = this.inputQueue.length > 0
      ? this.inputQueue[this.inputQueue.length - 1]
      : this.currentDir;

    // Cegah putar balik 180 derajat langsung
    const isOpposite = (targetDir.dx === -lastDir.dx && targetDir.dy === -lastDir.dy);
    const isSame = (targetDir.dx === lastDir.dx && targetDir.dy === lastDir.dy);

    if (!isOpposite && !isSame && this.inputQueue.length < 2) {
      this.inputQueue.push(targetDir);
    }
  }

  updateTimers(dt) {
    // Respawn timer
    if (!this.alive && !this.eliminated) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.alive = true;
        this.invulnerableTimer = INVULN_TIME_SEC;
        this.resetBody();
      }
    }

    // Invulnerability timer
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
    }
  }

  move() {
    if (!this.alive || this.eliminated) return null;

    // Ambil input berikutnya dari antrian
    if (this.inputQueue.length > 0) {
      this.currentDir = this.inputQueue.shift();
    }

    const head = this.body[0];
    // Logika Wrap-Around Tembus Dinding (Pac-Man Style)
    const nextX = (head.x + this.currentDir.dx + GRID_COLS) % GRID_COLS;
    const nextY = (head.y + this.currentDir.dy + GRID_ROWS) % GRID_ROWS;

    // Tambah kepala baru
    this.body.unshift({ x: nextX, y: nextY });

    // Cek pertumbuhan panjang
    if (this.growCount > 0) {
      this.growCount--;
    } else {
      this.body.pop(); // Hapus ekor jika tidak tumbuh
    }

    return { x: nextX, y: nextY };
  }

  die(foodManager) {
    this.lives -= 1;
    this.alive = false;

    // Ubah seluruh segmen badan cacing menjadi makanan di arena
    for (const seg of this.body) {
      foodManager.addFoodAt(seg.x, seg.y);
    }
    this.body = [];

    if (this.lives <= 0) {
      this.eliminated = true;
    } else {
      this.respawnTimer = RESPAWN_DELAY_SEC;
    }
  }

  draw(ctx) {
    if (!this.alive || this.body.length === 0) return;

    ctx.save();
    // Efek transparansi kedip saat kebal
    if (this.invulnerableTimer > 0) {
      const flash = Math.floor(performance.now() / 120) % 2 === 0;
      ctx.globalAlpha = flash ? 0.35 : 0.85;
    }

    const len = this.body.length;
    for (let i = len - 1; i >= 0; i--) {
      const seg = this.body[i];
      const cx = seg.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = seg.y * CELL_SIZE + CELL_SIZE / 2;
      const isHead = (i === 0);

      // Hitung radius (sedikit mengecil ke arah ekor)
      const ratio = 1 - (i / len) * 0.35;
      const r = (CELL_SIZE * 0.44) * ratio;

      // 1. Badan Cacing
      ctx.fillStyle = isHead ? this.colorData.hex : this.colorData.dark;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = this.colorData.light;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 2. Mata & Lidah pada Kepala
      if (isHead) {
        ctx.fillStyle = '#ffffff';
        // Posisi mata sesuai arah hadap
        const eyeOffset = r * 0.45;
        let e1x = cx, e1y = cy, e2x = cx, e2y = cy;
        let pX = cx + this.currentDir.dx * (r * 0.5);
        let pY = cy + this.currentDir.dy * (r * 0.5);

        if (this.currentDir.dx !== 0) {
          // Bergerak horizontal
          e1x = cx + this.currentDir.dx * (r * 0.3); e1y = cy - eyeOffset;
          e2x = cx + this.currentDir.dx * (r * 0.3); e2y = cy + eyeOffset;
        } else {
          // Bergerak vertikal
          e1x = cx - eyeOffset; e1y = cy + this.currentDir.dy * (r * 0.3);
          e2x = cx + eyeOffset; e2y = cy + this.currentDir.dy * (r * 0.3);
        }

        // Kornea mata
        ctx.beginPath(); ctx.arc(e1x, e1y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(e2x, e2y, 4, 0, Math.PI * 2); ctx.fill();
        // Pupil mata
        ctx.fillStyle = '#0f172a';
        ctx.beginPath(); ctx.arc(e1x + this.currentDir.dx * 1.5, e1y + this.currentDir.dy * 1.5, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(e2x + this.currentDir.dx * 1.5, e2y + this.currentDir.dy * 1.5, 2, 0, Math.PI * 2); ctx.fill();

        // Label Slot Pemain di atas kepala
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`P${this.slot}`, cx, cy - r - 4);
      }
    }

    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MODUL GAME ENGINE
// ═══════════════════════════════════════════════════════════════════

class GameEngine {
  constructor({ canvas, kernel, players, mode, finish, audio }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.kernel = kernel;
    this.players = players;
    this.mode = mode;
    this.finish = finish;
    this.audio = audio;

    this.state = 'waiting'; // 'waiting' | 'countdown' | 'play' | 'over'
    this.timeLeft = GAME_DURATION_SEC;
    this.countdownTimer = COUNTDOWN_SEC;
    this.moveTimer = 0;

    // Buat instances cacing untuk setiap pemain terhubung
    this.snakes = players.map((slot, idx) => {
      const cfg = SPAWN_CONFIGS[idx % SPAWN_CONFIGS.length];
      return new Snake(slot, cfg);
    });

    // Inisialisasi food manager & input handler
    this.foodManager = new FoodManager(this.snakes.length);
    this.inputHandler = new InputHandler(kernel, players, (slot, cmd) => {
      this.handleInput(slot, cmd);
    });

    // Pasang listener klik canvas untuk mulai
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

  handleInput(slot, cmd) {
    if (this.stopped) return;

    if (this.state === 'waiting') {
      // 99 dari P1 atau spasi memulai permainan
      if (cmd === '99' && slot === this.players[0]) {
        this.startCountdown();
      }
      return;
    }

    if (this.state === 'play') {
      const snake = this.snakes.find(s => s.slot === slot);
      if (snake) {
        snake.queueDirection(cmd);
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

    // 1. Kurangi sisa waktu permainan
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft <= 0) {
      this.gameOver();
      return;
    }

    // 2. Update timer respawn & invulnerability
    for (const snake of this.snakes) {
      snake.updateTimers(dt);
    }

    // 3. Update makanan (normal & golden food)
    this.foodManager.update(dt, this.snakes);

    // 4. Pergerakan Cacing per Grid Tick (MOVE_INTERVAL_SEC)
    this.moveTimer += dt;
    if (this.moveTimer >= MOVE_INTERVAL_SEC) {
      this.moveTimer -= MOVE_INTERVAL_SEC;
      this.stepPhysics();
    }

    // Cek apakah seluruh cacing gugur habis nyawa
    const anyAlive = this.snakes.some(s => !s.eliminated);
    if (!anyAlive) {
      this.gameOver();
    }
  }

  stepPhysics() {
    // 1. Gerakkan setiap cacing yang aktif
    const newHeads = [];
    for (const snake of this.snakes) {
      if (snake.alive) {
        const head = snake.move();
        newHeads.push({ snake, head });
      }
    }

    // 2. Cek makanan yang dimakan
    for (const { snake, head } of newHeads) {
      const foodResult = this.foodManager.checkCollision(head.x, head.y);
      if (foodResult) {
        snake.score += foodResult.points;
        snake.growCount += foodResult.grow;
        if (foodResult.type === 'golden') {
          this.playAudio('score', { volume: 0.4 });
        } else {
          this.playAudio('click', { volume: 0.25 });
        }
      }
    }

    // 3. Deteksi Tabrakan Kepala vs Badan Cacing
    const dyingSnakes = new Set();
    for (const { snake, head } of newHeads) {
      // Abaikan jika cacing masih dalam masa kebal
      if (snake.invulnerableTimer > 0) continue;

      // Cek tabrakan dengan badan seluruh cacing
      for (const targetSnake of this.snakes) {
        if (!targetSnake.alive) continue;

        // Jika cacing sendiri, lewati kepala (index 0)
        const startIndex = (targetSnake === snake) ? 1 : 0;
        for (let i = startIndex; i < targetSnake.body.length; i++) {
          const seg = targetSnake.body[i];
          if (head.x === seg.x && head.y === seg.y) {
            dyingSnakes.add(snake);
            break;
          }
        }
      }
    }

    // Eksekusi kematian cacing yang menabrak
    if (dyingSnakes.size > 0) {
      this.playAudio('hit', { volume: 0.4 });
      for (const snake of dyingSnakes) {
        snake.die(this.foodManager);
      }
    }
  }

  gameOver() {
    if (this.state === 'over') return;
    this.state = 'over';
    this.playAudio('win');

    let finishText = '';
    if (this.snakes.length === 1) {
      const p1 = this.snakes[0];
      let stars = '⭐';
      if (p1.score >= 350) stars = '⭐⭐⭐';
      else if (p1.score >= 200) stars = '⭐⭐';
      finishText = `Waktu Habis! Skor P1: ${p1.score} (${stars})`;
    } else {
      // Urutkan pemenang berdasarkan skor tertinggi
      const sorted = [...this.snakes].sort((a, b) => b.score - a.score);
      const winner = sorted[0];
      const scoreStr = this.snakes.map(s => `P${s.slot} ${s.score} poin`).join(', ');
      finishText = `${winner.colorData.name} (P${winner.slot}) menang! ${scoreStr}`;
    }

    this.finishTimeoutId = setTimeout(() => {
      if (!this.stopped) this.finish(finishText);
    }, 800);
  }

  drawGrid() {
    // Latar gelap papan permainan
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Garis grid halus
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    for (let x = 0; x <= CANVAS_WIDTH; x += CELL_SIZE) {
      this.ctx.moveTo(x, 0); this.ctx.lineTo(x, CANVAS_HEIGHT);
    }
    for (let y = 0; y <= CANVAS_HEIGHT; y += CELL_SIZE) {
      this.ctx.moveTo(0, y); this.ctx.lineTo(CANVAS_WIDTH, y);
    }
    this.ctx.stroke();
  }

  drawHUD() {
    this.ctx.save();

    // 1. Bar Semi-Transparan di Bagian Atas
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, 56);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 56); this.ctx.lineTo(CANVAS_WIDTH, 56);
    this.ctx.stroke();

    // 2. Timer Countdown di Tengah
    this.ctx.font = 'bold 22px sans-serif';
    this.ctx.fillStyle = this.timeLeft <= 15 ? '#ef4444' : '#f8fafc';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`⏱ ${Math.ceil(this.timeLeft)}s`, CANVAS_WIDTH / 2, 36);

    // 3. Statistik Tiap Pemain (Skor & Nyawa)
    const slotW = (CANVAS_WIDTH - 200) / this.snakes.length;
    this.snakes.forEach((s, idx) => {
      const isLeftHalf = idx < this.snakes.length / 2;
      const x = isLeftHalf
        ? 30 + idx * slotW
        : CANVAS_WIDTH / 2 + 100 + (idx - Math.ceil(this.snakes.length / 2)) * slotW;

      // Label P{slot} & Skor
      this.ctx.font = 'bold 16px sans-serif';
      this.ctx.fillStyle = s.colorData.hex;
      this.ctx.textAlign = 'left';
      this.ctx.fillText(`P${s.slot}: ${s.score} pts`, x, 25);

      // Sisa Nyawa (Hearts)
      let hearts = '';
      for (let i = 0; i < INITIAL_LIVES; i++) {
        hearts += (i < s.lives) ? '❤️ ' : '💔 ';
      }
      this.ctx.font = '13px sans-serif';
      this.ctx.fillText(hearts, x, 45);
    });

    this.ctx.restore();
  }

  drawOverlays() {
    // 1. Overlay Waiting
    if (this.state === 'waiting') {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.roundRect(CANVAS_WIDTH / 2 - 360, CANVAS_HEIGHT / 2 - 140, 720, 280, 20);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.font = 'bold 44px sans-serif';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('🪱 Cacing Rakus', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);

      this.ctx.font = '19px sans-serif';
      this.ctx.fillStyle = '#38bdf8';
      this.ctx.fillText(`Kirim 99# dari micro:bit P${this.players[0]} atau klik layar / Spasi untuk mulai`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 5);

      this.ctx.font = '14px sans-serif';
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.fillText('Kontrol Arah: 1=Atas, 2=Bawah, 3=Kiri, 4=Kanan | Tembus Dinding Aktif', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
      this.ctx.fillText('P1: W/A/S/D  |  P2: Panah Keyboard', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 80);

      this.ctx.restore();
    }

    // 2. Countdown 3-2-1
    if (this.state === 'countdown') {
      this.ctx.save();
      const digit = Math.ceil(this.countdownTimer);
      this.ctx.font = 'bold 120px sans-serif';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 8;
      this.ctx.textAlign = 'center';
      this.ctx.strokeText(String(digit), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
      this.ctx.fillText(String(digit), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
      this.ctx.restore();
    }

    // 3. Layar Selesai (Game Over)
    if (this.state === 'over') {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      this.ctx.font = 'bold 50px sans-serif';
      this.ctx.fillStyle = '#fde047';
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 5;
      this.ctx.textAlign = 'center';
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

    this.drawGrid();
    this.foodManager.draw(this.ctx);
    for (const snake of this.snakes) {
      snake.draw(this.ctx);
    }
    this.drawHUD();
    this.drawOverlays();

    this.frameId = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.stopped = true;
    if (this.frameId) cancelAnimationFrame(this.frameId);
    if (this.finishTimeoutId) clearTimeout(this.finishTimeoutId);
    this.inputHandler.destroy();
    this.canvas.removeEventListener('click', this.onCanvasClick);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  EKSPOR DEFAULT SESUAI KONTRAK PLATFORM
// ═══════════════════════════════════════════════════════════════════

export default {
  id: 'cacingrakus',
  name: 'Cacing Rakus',
  icon: '🪱',
  description: 'Makan apel sebanyak mungkin, hindari tabrakan antar cacing, dan kuasai arena grid 1280x720!',
  modes: [
    { id: '1p', label: '1 Player', sub: 'Solo Survival',  players: 1 },
    { id: '2p', label: '2 Player', sub: 'Duel Cacing',    players: 2 },
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

