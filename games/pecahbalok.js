// GAME: Pecah Balok (Arkanoid / Breakout Multiplayer)
// games/pecahbalok.js
// Fixed Canvas 1280x720, 1P (Solo), 2P (Duel), dan 4P (Pesta Berempat)
// Menampilkan sistem multi-paddle non-blocking, transfer warna kepemilikan bola,
// gelombang balok bertingkat, dan power-up ramah anak (Expand, Multi-Ball, Fireball).

'use strict';

// ═══════════════════════════════════════════════════════════════════
//  KONSTANTA PERMAINAN
// ═══════════════════════════════════════════════════════════════════

const CANVAS_WIDTH          = 1280;
const CANVAS_HEIGHT         = 720;
const GAME_DURATION_SEC     = 90;
const COUNTDOWN_SEC         = 3;
const FINISH_DELAY_MS       = 800;

// Paddle & Balok (Disesuaikan ramah anak usia TK & SD)
const PADDLE_Y              = 665;
const PADDLE_H              = 20;
const PADDLE_SPEED          = 580; // px/dtk (gerak lincah membantu anak menangkap bola)
const PADDLE_WIDTHS         = { 1: 220, 2: 180, 4: 150 }; // Papan lebar & toleran

// Bola (Ukuran besar & kecepatan santai ramah refleks anak usia 4-12 tahun)
const BALL_RADIUS           = 13;  // Bola besar, jelas terlihat di layar PID / TV kelas
const BALL_BASE_SPEED       = 290; // Kecepatan terukur, memberi cukup waktu manuver micro:bit
const BALL_MAX_SPEED        = 380;
const BALL_RESPAWN_DELAY    = 1.0;
const INITIAL_LIVES         = 5;   // 5 nyawa awal agar anak tidak cepat game over

// Grid Balok
const BRICK_COLS            = 14;
const BRICK_ROWS            = 6;
const BRICK_W               = 80;
const BRICK_H               = 22;
const BRICK_GAP_X           = 4;
const BRICK_GAP_Y           = 6;
const BRICK_START_X         = Math.round((CANVAS_WIDTH - (BRICK_COLS * BRICK_W + (BRICK_COLS - 1) * BRICK_GAP_X)) / 2); // ~54 px
const BRICK_START_Y         = 85;

// Power-Up (Melimpah & melayang perlahan menyenangkan untuk anak-anak)
const POWERUP_CHANCE        = 0.45; // Hampir setengah balok menjatuhkan hadiah
const POWERUP_GOLD_CHANCE   = 0.80;
const POWERUP_SPEED         = 110; // Kapsul melayang santai ke bawah
const POWERUP_W             = 36;
const POWERUP_H             = 20;
const EXPAND_DURATION       = 15.0; // Durasi power-up panjang
const FIREBALL_DURATION     = 10.0;

// Warna Khas Slot Platform
const SLOT_COLORS = {
  1: { name: 'Merah',  hex: '#EF4444', dark: '#991B1B', light: '#FCA5A5' },
  2: { name: 'Biru',   hex: '#3B82F6', dark: '#1E40AF', light: '#93C5FD' },
  3: { name: 'Hijau',  hex: '#22C55E', dark: '#166534', light: '#86EFAC' },
  4: { name: 'Kuning', hex: '#EAB308', dark: '#854D0E', light: '#FDE047' }
};

// ═══════════════════════════════════════════════════════════════════
//  MODUL POWER-UP
// ═══════════════════════════════════════════════════════════════════

class PowerUpManager {
  constructor() {
    this.capsules = []; // { x, y, type: 'E'|'M'|'F', color, label }
  }

  spawn(x, y, isGold = false) {
    const chance = isGold ? POWERUP_GOLD_CHANCE : POWERUP_CHANCE;
    if (Math.random() > chance) return;

    const roll = Math.random();
    let type = 'E';
    let color = '#22C55E'; // Hijau (Expand)
    let label = 'EXP';

    if (roll < 0.38) {
      type = 'E';
      color = '#22C55E';
      label = 'EXP';
    } else if (roll < 0.72) {
      type = 'M';
      color = '#EAB308'; // Kuning (Multi-Ball)
      label = 'MLT';
    } else {
      type = 'F';
      color = '#EF4444'; // Merah (Fireball)
      label = 'FIR';
    }

    this.capsules.push({ x, y, type, color, label });
  }

  update(dt, paddles, onCatch) {
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const cap = this.capsules[i];
      cap.y += POWERUP_SPEED * dt;

      // Cek apakah tertangkap oleh paddle mana pun
      let caught = false;
      for (const paddle of paddles) {
        if (!paddle.active) continue;
        const padLeft = paddle.x - paddle.w / 2;
        const padRight = paddle.x + paddle.w / 2;
        const padTop = paddle.y - paddle.h / 2;
        const padBottom = paddle.y + paddle.h / 2;

        if (
          cap.x + POWERUP_W / 2 >= padLeft &&
          cap.x - POWERUP_W / 2 <= padRight &&
          cap.y + POWERUP_H / 2 >= padTop &&
          cap.y - POWERUP_H / 2 <= padBottom
        ) {
          onCatch(paddle, cap.type);
          this.capsules.splice(i, 1);
          caught = true;
          break;
        }
      }

      // Hapus jika keluar batas bawah kanvas
      if (!caught && cap.y > CANVAS_HEIGHT + 30) {
        this.capsules.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    for (const cap of this.capsules) {
      ctx.save();
      ctx.translate(cap.x, cap.y);

      // Kapsul Berpendar
      ctx.fillStyle = cap.color;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-POWERUP_W / 2, -POWERUP_H / 2, POWERUP_W, POWERUP_H, 9);
      ctx.fill();
      ctx.stroke();

      // Label Teks Kapsul
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cap.label, 0, 1);

      ctx.restore();
    }
  }

  clear() {
    this.capsules = [];
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MODUL BRICK MANAGER (GELOMBANG BALOK)
// ═══════════════════════════════════════════════════════════════════

class BrickManager {
  constructor() {
    this.bricks = [];
    this.wave = 1;
    this.resetWave(1);
  }

  resetWave(waveNumber = 1) {
    this.wave = waveNumber;
    this.bricks = [];

    // Pola Balok Sesuai Gelombang
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        const bx = BRICK_START_X + c * (BRICK_W + BRICK_GAP_X);
        const by = BRICK_START_Y + r * (BRICK_H + BRICK_GAP_Y);

        let type = 'normal';
        let hits = 1;
        let points = 10;
        let color = '#3B82F6';

        if (this.wave === 1) {
          // Gelombang 1: Formasi Klasik Pelangi (Rainbow Classic)
          if (r === 0)      { color = '#EF4444'; points = 10; } // Merah
          else if (r === 1) { color = '#F97316'; points = 10; } // Oranye
          else if (r === 2) { color = '#EAB308'; points = 10; } // Kuning
          else if (r === 3) { color = '#22C55E'; points = 10; } // Hijau
          else if (r === 4) { color = '#3B82F6'; points = 10; } // Biru
          else              { color = '#8B5CF6'; points = 10; } // Ungu

          // Sisipkan balok baja dan balok emas secara simetris
          if ((r === 1 && (c === 3 || c === 10)) || (r === 4 && (c === 4 || c === 9))) {
            type = 'steel';
            hits = 2;
            points = 25;
            color = '#94A3B8';
          } else if ((r === 0 && (c === 6 || c === 7)) || (r === 3 && (c === 2 || c === 11))) {
            type = 'gold';
            hits = 1;
            points = 50;
            color = '#FACC15';
          }
        } else if (this.wave === 2) {
          // Gelombang 2: Formasi Benteng Kolom (Pillars Fortress)
          const isPillar = (c % 3 === 0);
          if (isPillar) {
            type = 'steel';
            hits = 2;
            points = 25;
            color = '#94A3B8';
          } else if (r === 0 || r === BRICK_ROWS - 1) {
            type = 'gold';
            hits = 1;
            points = 50;
            color = '#FACC15';
          } else {
            type = 'normal';
            hits = 1;
            points = 10;
            color = (c % 2 === 0) ? '#38BDF8' : '#34D399';
          }
        } else {
          // Gelombang 3+: Benteng Berlian (Diamond Citadel)
          const midC = BRICK_COLS / 2;
          const distMid = Math.abs(c - (midC - 0.5));
          if (distMid <= 1.5 && r <= 2) {
            type = 'gold';
            hits = 1;
            points = 50;
            color = '#FACC15';
          } else if (distMid === 2.5 || r === 4) {
            type = 'steel';
            hits = 2;
            points = 25;
            color = '#94A3B8';
          } else {
            type = 'normal';
            hits = 1;
            points = 10;
            color = (r % 2 === 0) ? '#F43F5E' : '#A855F7';
          }
        }

        this.bricks.push({
          x: bx,
          y: by,
          w: BRICK_W,
          h: BRICK_H,
          type,
          hits,
          maxHits: hits,
          points,
          color,
          alive: true
        });
      }
    }
  }

  isAllCleared() {
    return this.bricks.every(b => !b.alive);
  }

  draw(ctx) {
    for (const b of this.bricks) {
      if (!b.alive) continue;

      ctx.save();
      // Badan Balok
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 4);
      ctx.fill();

      // Bingkai Balok
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Highlight kilau atas balok
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, 3);

      // Detail khusus Balok Baja (Retak jika sisa 1 hit)
      if (b.type === 'steel') {
        if (b.hits === 1) {
          // Gambar retakan
          ctx.strokeStyle = '#0F172A';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(b.x + b.w * 0.3, b.y + 3);
          ctx.lineTo(b.x + b.w * 0.5, b.y + b.h * 0.6);
          ctx.lineTo(b.x + b.w * 0.7, b.y + b.h - 3);
          ctx.stroke();
        } else {
          // Baut sudut baja
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.arc(b.x + 6, b.y + 6, 2, 0, Math.PI * 2);
          ctx.arc(b.x + b.w - 6, b.y + 6, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Detail khusus Balok Emas (Simbol Bintang)
      if (b.type === 'gold') {
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#78350F';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⭐', b.x + b.w / 2, b.y + b.h / 2 + 1);
      }

      ctx.restore();
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MODUL BOLA (BALL)
// ═══════════════════════════════════════════════════════════════════

class Ball {
  constructor(ownerSlot, x, y, vx, vy, isExtra = false) {
    this.owner = ownerSlot; // Kepemilikan poin saat ini (1..4)
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.r = BALL_RADIUS;
    this.speed = BALL_BASE_SPEED;

    this.isExtra = isExtra; // Bola Multi-Ball
    this.isAttached = false; // Bola menempel di paddle saat respawn
    this.attachTimer = 0;
    this.fireballTimer = 0; // Mode bola api tembus balok
    this.alive = true;
    this.trail = []; // Partikel jejak bola
  }

  attachTo(paddle) {
    this.isAttached = true;
    this.attachTimer = BALL_RESPAWN_DELAY;
    this.x = paddle.x;
    this.y = paddle.y - paddle.h / 2 - this.r - 2;
    this.vx = 0;
    this.vy = 0;
    this.fireballTimer = 0;
  }

  launch() {
    this.isAttached = false;
    this.attachTimer = 0;
    // Luncurkan ke atas dengan sedikit variasi acak agar dinamis
    const angle = -Math.PI / 2 + (Math.random() * 0.4 - 0.2);
    this.vx = this.speed * Math.cos(angle);
    this.vy = this.speed * Math.sin(angle);
  }

  update(dt, paddle) {
    if (!this.alive) return;

    // Hitung mundur efek bola api
    if (this.fireballTimer > 0) {
      this.fireballTimer = Math.max(0, this.fireballTimer - dt);
    }

    if (this.isAttached) {
      if (paddle) {
        this.x = paddle.x;
        this.y = paddle.y - paddle.h / 2 - this.r - 2;
      }
      this.attachTimer -= dt;
      if (this.attachTimer <= 0) {
        this.launch();
      }
      return;
    }

    // Rekam jejak ekor bola
    this.trail.unshift({ x: this.x, y: this.y, alpha: 1.0 });
    if (this.trail.length > (this.fireballTimer > 0 ? 10 : 5)) {
      this.trail.pop();
    }
    for (const t of this.trail) {
      t.alpha -= dt * 2.5;
    }

    // Pergerakan posisi bola
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx, colorData) {
    if (!this.alive) return;

    ctx.save();

    // 1. Jejak Bola (Trail)
    for (const t of this.trail) {
      if (t.alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = t.alpha * (this.fireballTimer > 0 ? 0.6 : 0.3);
      ctx.fillStyle = this.fireballTimer > 0 ? '#EF4444' : colorData.hex;
      ctx.beginPath();
      ctx.arc(t.x, t.y, this.r * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Badan Bola
    if (this.fireballTimer > 0) {
      // Bola Api (Pijar Api Oranye/Merah)
      const grad = ctx.createRadialGradient(this.x, this.y, 1, this.x, this.y, this.r * 1.5);
      grad.addColorStop(0, '#FEF08A');
      grad.addColorStop(0.4, '#F97316');
      grad.addColorStop(1, '#EF4444');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * 1.25, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Bola Normal Mengkilap sesuai Warna Pemilik
      const grad = ctx.createRadialGradient(
        this.x - this.r * 0.35,
        this.y - this.r * 0.35,
        1,
        this.x,
        this.y,
        this.r
      );
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.4, colorData.light);
      grad.addColorStop(1, colorData.hex);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = colorData.dark;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MODUL PADDLE PEMAIN
// ═══════════════════════════════════════════════════════════════════

class Paddle {
  constructor(slot, idx, totalPlayers) {
    this.slot = slot;
    this.idx = idx;
    this.colorData = SLOT_COLORS[slot] || SLOT_COLORS[1];

    this.baseW = PADDLE_WIDTHS[totalPlayers] || 140;
    this.w = this.baseW;
    this.h = PADDLE_H;
    this.y = PADDLE_Y;

    // Posisi awal horizontal simetris
    if (totalPlayers === 1) {
      this.x = CANVAS_WIDTH / 2;
    } else if (totalPlayers === 2) {
      this.x = (idx === 0) ? 360 : 920;
    } else {
      this.x = 160 + idx * 320;
    }

    this.vx = 0;
    this.dir = 0; // -1 (Kiri), 0 (Diam), 1 (Kanan)
    this.expandTimer = 0; // Timer power-up Expand (+50% lebar)
    this.score = 0;
    this.lives = INITIAL_LIVES;
    this.active = true;
  }

  update(dt) {
    if (!this.active) return;

    // Timer Expand
    if (this.expandTimer > 0) {
      this.expandTimer = Math.max(0, this.expandTimer - dt);
      this.w = this.baseW * 1.5;
    } else {
      this.w = this.baseW;
    }

    // Gerak Horizontal Mulus
    this.vx = this.dir * PADDLE_SPEED;
    this.x += this.vx * dt;

    // Batasi dalam kanvas
    const halfW = this.w / 2;
    if (this.x - halfW < 0) this.x = halfW;
    if (this.x + halfW > CANVAS_WIDTH) this.x = CANVAS_WIDTH - halfW;
  }

  draw(ctx) {
    if (!this.active) return;

    ctx.save();

    const halfW = this.w / 2;
    const halfH = this.h / 2;
    const px = this.x - halfW;
    const py = this.y - halfH;

    // Bayangan paddle di bawah
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.roundRect(px, py + 4, this.w, this.h, 9);
    ctx.fill();

    // Badan Paddle (Gradien Warna Pemain)
    const padGrad = ctx.createLinearGradient(px, py, px, py + this.h);
    padGrad.addColorStop(0, this.colorData.light);
    padGrad.addColorStop(0.5, this.colorData.hex);
    padGrad.addColorStop(1, this.colorData.dark);

    ctx.fillStyle = padGrad;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(px, py, this.w, this.h, 9);
    ctx.fill();
    ctx.stroke();

    // Kilauan atas paddle
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillRect(px + 10, py + 2, this.w - 20, 2);

    // Label Slot Pemain di Tengah Paddle
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(`P${this.slot}`, this.x, this.y);
    ctx.fillText(`P${this.slot}`, this.x, this.y);

    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MODUL INPUT HANDLER
// ═══════════════════════════════════════════════════════════════════

class InputHandler {
  constructor(kernel, players, onCommand) {
    this.players = players;
    this.onCommand = onCommand;

    // Pasang listener kernel micro:bit & keyboard platform
    this.offKernel = (kernel && typeof kernel.on === 'function')
      ? kernel.on('input', ({ player, cmd }) => {
          this.onCommand(player, cmd);
        })
      : null;

    // Pasang keyboard fallback HANYA jika dijalankan mandiri di luar kernel platform
    this.onKeyDown = null;
    this.onKeyUp = null;
    const isPlatformKernel = kernel && typeof kernel.filled === 'function';

    if (!isPlatformKernel) {
      this.onKeyDown = (e) => {
        const key = e.key.toLowerCase();
        const p1 = players[0];
        const p2 = players[1];

        if (key === ' ' || key === 'enter') {
          if (p1 != null) this.onCommand(p1, '99');
          return;
        }

        // P1: A/D atau Panah Kiri/Kanan (bila solo)
        if (p2 == null) {
          if (key === 'a' || e.key === 'ArrowLeft') this.onCommand(p1, '3');
          else if (key === 'd' || e.key === 'ArrowRight') this.onCommand(p1, '4');
        } else {
          // P1 = A/D, P2 = Panah Kiri/Kanan
          if (key === 'a') this.onCommand(p1, '3');
          else if (key === 'd') this.onCommand(p1, '4');

          if (e.key === 'ArrowLeft') this.onCommand(p2, '3');
          else if (e.key === 'ArrowRight') this.onCommand(p2, '4');
        }
      };

      this.onKeyUp = (e) => {
        const key = e.key.toLowerCase();
        const p1 = players[0];
        const p2 = players[1];

        if (p2 == null) {
          if (key === 'a' || key === 'd' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            this.onCommand(p1, '0');
          }
        } else {
          if (key === 'a' || key === 'd') this.onCommand(p1, '0');
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') this.onCommand(p2, '0');
        }
      };

      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
    }
  }

  destroy() {
    if (this.offKernel) this.offKernel();
    if (this.onKeyDown) window.removeEventListener('keydown', this.onKeyDown);
    if (this.onKeyUp) window.removeEventListener('keyup', this.onKeyUp);
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
    this.waveBannerTimer = 0;

    // Inisialisasi Paddle Pemain
    this.paddles = players.map((slot, idx) => new Paddle(slot, idx, players.length));

    // Inisialisasi Bola Awal (1 bola per pemain terhubung)
    this.balls = this.paddles.map(p => {
      const b = new Ball(p.slot, p.x, p.y - p.h / 2 - BALL_RADIUS - 2, 0, 0);
      b.attachTo(p);
      return b;
    });

    // Inisialisasi Balok & Power-Up
    this.brickManager = new BrickManager();
    this.powerUpManager = new PowerUpManager();

    // Inisialisasi Input Handler
    this.inputHandler = new InputHandler(kernel, players, (slot, cmd) => {
      this.handleInput(slot, cmd);
    });

    // Listener Klik Canvas untuk Mulai
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
      // 99 dari P1, atau 5 (Spasi/Enter keyboard) dari P1 memulai permainan
      if ((cmd === '99' || cmd === '5') && slot === this.players[0]) {
        this.startCountdown();
      }
      return;
    }

    if (this.state === 'play') {
      const pad = this.paddles.find(p => p.slot === slot);
      if (!pad || !pad.active) return;

      // 3 = Miring Kiri, 4 = Miring Kanan, 0 = Datar/Netral
      if (cmd === '3') {
        pad.dir = -1;
      } else if (cmd === '4') {
        pad.dir = 1;
      } else if (cmd === '0') {
        pad.dir = 0;
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
        // Luncurkan semua bola saat GO
        for (const b of this.balls) {
          if (b.isAttached) b.launch();
        }
      }
      return;
    }

    if (this.state !== 'play') return;

    // 1. Timer Waktu Permainan 90s
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft <= 0) {
      this.gameOver();
      return;
    }

    if (this.waveBannerTimer > 0) {
      this.waveBannerTimer = Math.max(0, this.waveBannerTimer - dt);
    }

    // 2. Update Paddle Pemain
    for (const p of this.paddles) {
      p.update(dt);
    }

    // 3. Update Bola & Fisika Pantulan
    this.stepBalls(dt);

    // 4. Update Power-Up Jatuh
    this.powerUpManager.update(dt, this.paddles, (paddle, type) => {
      this.applyPowerUp(paddle, type);
    });

    // 5. Cek Gelombang Balok Bersih -> Munculkan Gelombang Baru
    if (this.brickManager.isAllCleared()) {
      this.playAudio('powerup', { volume: 0.5 });
      this.waveBannerTimer = 2.0;
      this.brickManager.resetWave(this.brickManager.wave + 1);
    }

    // 6. Cek Seluruh Pemain Gugur Nyawa
    const anyAlive = this.paddles.some(p => p.lives > 0);
    if (!anyAlive) {
      this.gameOver();
    }
  }

  stepBalls(dt) {
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      if (!ball.alive) continue;

      const ownerPad = this.paddles.find(p => p.slot === ball.owner);
      ball.update(dt, ownerPad);

      if (ball.isAttached) continue;

      // Pantulan Dinding Kiri & Kanan
      if (ball.x - ball.r <= 0) {
        ball.x = ball.r;
        ball.vx = Math.abs(ball.vx);
        this.playAudio('bounce', { volume: 0.25 });
      } else if (ball.x + ball.r >= CANVAS_WIDTH) {
        ball.x = CANVAS_WIDTH - ball.r;
        ball.vx = -Math.abs(ball.vx);
        this.playAudio('bounce', { volume: 0.25 });
      }

      // Pantulan Dinding Atas (Area Aman di bawah HUD: y = 58)
      if (ball.y - ball.r <= 58) {
        ball.y = 58 + ball.r;
        ball.vy = Math.abs(ball.vy);
        this.playAudio('bounce', { volume: 0.25 });
      }

      // Pantulan dengan Paddle (Bebas disentuh oleh paddle mana pun)
      if (ball.vy > 0 && ball.y + ball.r >= PADDLE_Y - PADDLE_H / 2) {
        for (const pad of this.paddles) {
          if (!pad.active || pad.lives <= 0) continue;

          const padLeft = pad.x - pad.w / 2;
          const padRight = pad.x + pad.w / 2;
          const padTop = pad.y - pad.h / 2;
          const padBottom = pad.y + pad.h / 2;

          if (ball.x >= padLeft - ball.r && ball.x <= padRight + ball.r && ball.y - ball.r <= padBottom) {
            // Transfer Kepemilikan Bola ke Paddle yang Memantulkan
            ball.owner = pad.slot;

            // Hitung Sudut Pantulan Dinamis Berdasarkan Titik Benturan Paddle
            const hitRatio = Math.max(-1.0, Math.min(1.0, (ball.x - pad.x) / (pad.w / 2)));
            const bounceAngle = -Math.PI / 2 + hitRatio * (Math.PI / 3); // -90° di tengah, maks ±60°

            ball.vx = ball.speed * Math.cos(bounceAngle);
            ball.vy = ball.speed * Math.sin(bounceAngle);
            ball.y = padTop - ball.r; // Lepas dari paddle

            this.playAudio('bounce', { volume: 0.35 });
            break;
          }
        }
      }

      // Benturan Bola vs Balok
      for (const brick of this.brickManager.bricks) {
        if (!brick.alive) continue;

        // Titik Terdekat Lingkaran ke Persegi Balok (AABB vs Circle)
        const closeX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
        const closeY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
        const dx = ball.x - closeX;
        const dy = ball.y - closeY;
        const distSq = dx * dx + dy * dy;

        if (distSq <= ball.r * ball.r) {
          // Benturan Terjadi!
          const isFireball = ball.fireballTimer > 0;

          if (!isFireball) {
            // Pantulkan arah bola normal
            const prevX = ball.x - ball.vx * dt;
            if (prevX + ball.r <= brick.x || prevX - ball.r >= brick.x + brick.w) {
              ball.vx = -ball.vx;
            } else {
              ball.vy = -ball.vy;
            }
          }

          // Rusak atau Hancurkan Balok
          brick.hits--;
          if (isFireball) brick.hits = 0; // Bola api menembus dan langsung hancur

          if (brick.hits <= 0) {
            brick.alive = false;
            // Beri skor ke pemain pemilik bola saat ini
            const curOwnerPad = this.paddles.find(p => p.slot === ball.owner);
            if (curOwnerPad) curOwnerPad.score += brick.points;

            // Peluang Menjatuhkan Power-Up
            this.powerUpManager.spawn(
              brick.x + brick.w / 2,
              brick.y + brick.h / 2,
              brick.type === 'gold'
            );

            if (brick.type === 'gold') {
              this.playAudio('score', { volume: 0.4 });
            } else {
              this.playAudio('hit', { volume: 0.3 });
            }
          } else {
            // Balok baja retak pada pukulan pertama
            this.playAudio('click', { volume: 0.3 });
          }

          // Jika bukan bola api, 1 bola hanya bentur 1 balok per frame
          if (!isFireball) break;
        }
      }

      // Bola Jatuh Keluar Batas Bawah Layar (Out of Bounds)
      if (ball.y - ball.r > CANVAS_HEIGHT) {
        if (ball.isExtra) {
          // Bola ekstra dari Multi-ball langsung lenyap tanpa penalti
          this.balls.splice(i, 1);
        } else {
          // Bola utama pemain: kurangi nyawa & penalti skor
          const curOwnerPad = this.paddles.find(p => p.slot === ball.owner);
          if (curOwnerPad && curOwnerPad.lives > 0) {
            curOwnerPad.lives--;
            // Ramah anak TK/SD: poin tidak dipotong saat bola jatuh
            this.playAudio('hurt', { volume: 0.4 });

            if (curOwnerPad.lives > 0) {
              // Respawn menempel di paddle pemilik selama 1.5 detik
              ball.attachTo(curOwnerPad);
            } else {
              // Pemain gugur
              ball.alive = false;
            }
          } else {
            ball.alive = false;
          }
        }
      }
    }
  }

  applyPowerUp(paddle, type) {
    this.playAudio('powerup', { volume: 0.45 });

    if (type === 'E') {
      // EXPAND: Perlebar paddle 50% selama 10 dtk
      paddle.expandTimer = EXPAND_DURATION;
    } else if (type === 'M') {
      // MULTI-BALL: Munculkan 1 bola tambahan berwarna pemain
      const angle = -Math.PI / 2 + (Math.random() * 0.8 - 0.4);
      const extraBall = new Ball(
        paddle.slot,
        paddle.x,
        paddle.y - paddle.h / 2 - BALL_RADIUS - 4,
        BALL_BASE_SPEED * Math.cos(angle),
        BALL_BASE_SPEED * Math.sin(angle),
        true // isExtra
      );
      this.balls.push(extraBall);
    } else if (type === 'F') {
      // FIREBALL: Aktifkan mode bola api pada bola milik pemain selama 6 dtk
      for (const b of this.balls) {
        if (b.owner === paddle.slot && b.alive) {
          b.fireballTimer = FIREBALL_DURATION;
        }
      }
    }
  }

  gameOver() {
    if (this.state === 'over') return;
    this.state = 'over';
    this.playAudio('win');

    let finishText = '';
    if (this.paddles.length === 1) {
      const p1 = this.paddles[0];
      let stars = '⭐';
      if (p1.score >= 800) stars = '⭐⭐⭐';
      else if (p1.score >= 400) stars = '⭐⭐';
      finishText = `Waktu Habis! Skor P1: ${p1.score} (${stars})`;
    } else {
      const sorted = [...this.paddles].sort((a, b) => b.score - a.score);
      const scoreStr = this.paddles.map(p => `P${p.slot} ${p.score} poin`).join(', ');

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
    // Latar Belakang Luar Angkasa Arkade Retro
    this.ctx.fillStyle = '#090D16';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Garis Grid Perspektif Halus di Arena
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    for (let x = 0; x <= CANVAS_WIDTH; x += 40) {
      this.ctx.moveTo(x, 60); this.ctx.lineTo(x, CANVAS_HEIGHT);
    }
    for (let y = 60; y <= CANVAS_HEIGHT; y += 40) {
      this.ctx.moveTo(0, y); this.ctx.lineTo(CANVAS_WIDTH, y);
    }
    this.ctx.stroke();

    // Garis Batas Bawah / Garis Maut Lapangan (Merah Halus)
    this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(0, PADDLE_Y + 16);
    this.ctx.lineTo(CANVAS_WIDTH, PADDLE_Y + 16);
    this.ctx.stroke();
  }

  drawHUD() {
    this.ctx.save();

    // 1. Timer Countdown & Gelombang di Tengah (Floating Glass Chip)
    const timerW = 160;
    const timerH = 38;
    const timerX = (CANVAS_WIDTH - timerW) / 2;
    const timerY = 8;

    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    this.ctx.strokeStyle = this.timeLeft <= 15 ? '#EF4444' : 'rgba(255, 255, 255, 0.25)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.roundRect(timerX, timerY, timerW, timerH, 10);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.font = 'bold 17px sans-serif';
    this.ctx.fillStyle = this.timeLeft <= 15 ? '#EF4444' : '#F8FAFC';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(`⏱ ${Math.ceil(this.timeLeft)}s  •  W${this.brickManager.wave}`, timerX + timerW / 2, timerY + timerH / 2);

    // 2. Statistik Tiap Pemain (Floating Glass Badges dengan Area Aman)
    let playerPositions = [];
    if (this.paddles.length === 1) {
      playerPositions = [{ x: 310, w: 230 }];
    } else if (this.paddles.length === 2) {
      playerPositions = [
        { x: 300, w: 230 },
        { x: 750, w: 230 }
      ];
    } else {
      playerPositions = [
        { x: 75,  w: 220 },
        { x: 310, w: 220 },
        { x: 750, w: 210 },
        { x: 975, w: 210 }
      ];
    }

    this.paddles.forEach((p, idx) => {
      const pos = playerPositions[idx] || { x: 75 + idx * 220, w: 200 };
      const px = pos.x;
      const py = 8;
      const pw = pos.w;
      const ph = 42;

      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      this.ctx.strokeStyle = p.colorData.hex;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.roundRect(px, py, pw, ph, 8);
      this.ctx.fill();
      this.ctx.stroke();

      // Skor Pemain
      this.ctx.font = 'bold 15px sans-serif';
      this.ctx.fillStyle = p.colorData.hex;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'alphabetic';
      this.ctx.fillText(`P${p.slot}: ${p.score} pts`, px + 10, py + 18);

      // Sisa Nyawa & Status Power-Up Aktif
      let statusStr = '';
      if (p.lives <= 0) {
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.fillStyle = '#EF4444';
        statusStr = '💀 GUGUR';
      } else {
        let hearts = '';
        for (let i = 0; i < INITIAL_LIVES; i++) hearts += (i < p.lives) ? '❤️' : '💔';
        let buffs = '';
        if (p.expandTimer > 0) buffs += ' 🟢EXP';
        const hasFireball = this.balls.some(b => b.owner === p.slot && b.fireballTimer > 0);
        if (hasFireball) buffs += ' 🔥FIR';

        this.ctx.font = '12px sans-serif';
        this.ctx.fillStyle = '#F8FAFC';
        statusStr = `${hearts}${buffs}`;
      }

      this.ctx.fillText(statusStr, px + 10, py + 35);
    });

    // 3. Banner Pergantian Gelombang (Wave Clear)
    if (this.waveBannerTimer > 0) {
      this.ctx.save();
      const alpha = Math.min(1.0, this.waveBannerTimer / 0.4);
      this.ctx.globalAlpha = alpha;
      this.ctx.font = 'bold 40px sans-serif';
      this.ctx.fillStyle = '#FDE047';
      this.ctx.strokeStyle = '#0F172A';
      this.ctx.lineWidth = 6;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      const waveTxt = `🌊 GELOMBANG ${this.brickManager.wave} 🌊`;
      this.ctx.strokeText(waveTxt, CANVAS_WIDTH / 2, 280);
      this.ctx.fillText(waveTxt, CANVAS_WIDTH / 2, 280);
      this.ctx.restore();
    }

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
      this.ctx.roundRect(CANVAS_WIDTH / 2 - 380, CANVAS_HEIGHT / 2 - 150, 760, 300, 20);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.font = 'bold 44px sans-serif';
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('🧱 Pecah Balok', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 75);

      this.ctx.font = '19px sans-serif';
      this.ctx.fillStyle = '#38BDF8';
      this.ctx.fillText(`Kirim 99# dari micro:bit P${this.players[0]}, atau klik layar / Spasi untuk mulai`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);

      this.ctx.font = '14px sans-serif';
      this.ctx.fillStyle = '#94A3B8';
      this.ctx.fillText('Kontrol: Miring Kiri (3) / Kanan (4)  |  Datar (0) = Berhenti', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 35);
      this.ctx.fillText('P1: A / D (atau Panah bila Solo)  |  P2: Panah Kiri / Kanan', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 65);

      this.ctx.font = '13px sans-serif';
      this.ctx.fillStyle = '#FDE047';
      this.ctx.fillText('💡 Tip: Pantulkan bola di ujung paddle untuk sudut tajam & tangkap kapsul power-up!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100);

      this.ctx.restore();
    }

    // 2. Countdown 3-2-1
    if (this.state === 'countdown') {
      this.ctx.save();
      const digit = Math.ceil(this.countdownTimer);
      this.ctx.font = 'bold 120px sans-serif';
      this.ctx.fillStyle = '#FFFFFF';
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
    this.brickManager.draw(this.ctx);
    this.powerUpManager.draw(this.ctx);

    for (const b of this.balls) {
      const colorData = SLOT_COLORS[b.owner] || SLOT_COLORS[1];
      b.draw(this.ctx, colorData);
    }

    for (const p of this.paddles) {
      p.draw(this.ctx);
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
  id: 'pecahbalok',
  name: 'Pecah Balok',
  icon: '🧱',
  tag: 'Retro',
  description: 'Pantulkan bola, hancurkan balok bersama kawan, dan tangkap kapsul power-up seru untuk mencetak skor tertinggi!',
  modes: [
    { id: '1p', label: '1 Player', sub: 'Solo',            players: 1 },
    { id: '2p', label: '2 Player', sub: 'Duel Balok',       players: 2 },
    { id: '4p', label: '4 Player', sub: 'Pesta Berempat',  players: 4 }
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
