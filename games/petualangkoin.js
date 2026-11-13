// GAME: Petualang Koin (Super Bros Platformer)
// games/petualangkoin.js
// Fixed Canvas 1280x720 (16:9 Landscape), 1P (Solo), 2P (Co-op/Duel), dan 4P (Pesta Berempat)
// Koleksi Retro: Petualangan platformer klasik melompat, sundul balok '?', kumpulkan koin,
// kalahkan musuh (Goomba & Koopa), power-up Jamur & Bintang, tiang bendera finis,
// dan sistem Gelembung Penyelamat (Catch-Up Bubble) anti-tertinggal ramah anak TK - SMP.

'use strict';

// ═══════════════════════════════════════════════════════════════════
//  KONSTANTA PERMAINAN & FISIKA PLATFORMER
// ═══════════════════════════════════════════════════════════════════

const CANVAS_WIDTH          = 1280;
const CANVAS_HEIGHT         = 720;
const GAME_DURATION_SEC     = 90;
const COUNTDOWN_SEC         = 3;
const FINISH_DELAY_MS       = 800;

// Dimensi Level Panjang (Side-Scrolling)
const LEVEL_WIDTH           = 5200;
const GROUND_Y              = 620; // Garis pijakan tanah utama

// Fisika Karakter (Dioptimalkan untuk Ramah Anak TK - SMP)
const GRAVITY               = 1250; // px/dtk²
const RUN_SPEED             = 265;  // px/dtk kecepatan lari normal
const STAR_RUN_SPEED        = 340;  // px/dtk kecepatan lari saat Bintang Kebal
const JUMP_FORCE            = -590; // px/dtk dorongan lompat ke atas
const JUMP_BOUNCE           = -360; // px/dtk pantulan saat menginjak musuh
const COYOTE_TIME_MAX       = 0.12; // toleransi lompat sesaat setelah lepas tepi
const JUMP_BUFFER_MAX       = 0.12; // toleransi tekan lompat sebelum mendarat
const INITIAL_LIVES         = 3;
const INVULN_TIME_SEC       = 2.2;  // durasi kebal setelah cedera

// Skema Warna Karakter Slot Platform
const SLOT_COLORS = {
  1: { name: 'Merah',  hex: '#EF4444', dark: '#991B1B', light: '#FCA5A5', hat: '#DC2626' },
  2: { name: 'Biru',   hex: '#3B82F6', dark: '#1E40AF', light: '#93C5FD', hat: '#2563EB' },
  3: { name: 'Hijau',  hex: '#22C55E', dark: '#166534', light: '#86EFAC', hat: '#16A34A' },
  4: { name: 'Kuning', hex: '#EAB308', dark: '#854D0E', light: '#FDE047', hat: '#CA8A04' }
};

// ═══════════════════════════════════════════════════════════════════
//  KELAS LEVEL MAP (BLOK, PIPA, JURANG & ELEMEN PANGGUNG)
// ═══════════════════════════════════════════════════════════════════

class LevelMap {
  constructor() {
    this.width = LEVEL_WIDTH;
    this.groundY = GROUND_Y;

    // Jurang (Pits) - dibuat pendek agar mudah dilompati anak
    this.pits = [
      { x1: 1220, x2: 1340 },
      { x1: 2360, x2: 2500 },
      { x1: 3550, x2: 3680 }
    ];

    // Pipa Hijau (Pipes)
    this.pipes = [
      { x: 480,  w: 76, h: 80,  isWarp: false },
      { x: 920,  w: 76, h: 120, isWarp: false },
      { x: 1800, w: 84, h: 100, isWarp: true, warpUsed: false }, // Pipa Rahasia Bonus
      { x: 2850, w: 76, h: 90,  isWarp: false },
      { x: 3350, w: 76, h: 130, isWarp: false },
      { x: 4100, w: 76, h: 90,  isWarp: false }
    ];

    // Balok Interaktif (type: 'q' = ?, 'b' = bata, 'solid' = pilar/baja)
    this.blocks = [];
    this.initBlocks();

    // Koin Melayang
    this.floatingCoins = [];
    this.initFloatingCoins();

    // Tiang Bendera & Kastel Finis
    this.flagpole = {
      x: 4680,
      baseY: GROUND_Y,
      topY: 260,
      height: GROUND_Y - 260, // 360 px
      flagY: 280,
      touched: false,
      winnerSlot: null
    };

    this.castle = {
      x: 4860,
      y: GROUND_Y - 220,
      w: 220,
      h: 220,
      doorX: 4940,
      doorW: 60,
      doorH: 100
    };
  }

  initBlocks() {
    // Helper tambah balok
    const addB = (x, y, type, content = 'coin') => {
      this.blocks.push({
        x, y, w: 44, h: 44,
        type, content,
        bumpY: 0,
        bumpVel: 0,
        hit: false
      });
    };

    // Zona 1: Awal pengenalan
    addB(600, 460, 'b', 'none');
    addB(644, 460, 'q', 'mushroom'); // Hadiah Jamur Pertama
    addB(688, 460, 'b', 'none');
    addB(732, 460, 'q', 'coin');
    addB(666, 330, 'q', 'coin'); // Balok tinggi

    // Zona 2: Menjelang jurang pertama
    addB(1080, 460, 'q', 'coin');
    addB(1124, 460, 'b', 'none');

    // Zona 3: Melintasi Pipa Rahasia & Barisan Balok
    addB(1520, 460, 'b', 'none');
    addB(1564, 460, 'q', 'coin');
    addB(1608, 460, 'b', 'none');
    addB(1652, 460, 'q', 'star'); // Hadiah Bintang Kebal ⭐
    addB(1696, 460, 'b', 'none');

    // Zona 4: Jembatan pijakan di atas Jurang ke-2
    addB(2390, 490, 'b', 'none');
    addB(2434, 490, 'q', 'coin');
    addB(2478, 490, 'b', 'none');

    // Zona 5: Tangga Bata Bertingkat
    const sx = 2980;
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row <= col; row++) {
        addB(sx + col * 44, GROUND_Y - (row + 1) * 44, 'b', 'none');
      }
    }
    addB(3200, 440, 'q', 'mushroom');

    // Zona 6: Platform Tinggi sebelum Jurang ke-3
    addB(3720, 450, 'b', 'none');
    addB(3764, 450, 'q', 'coin');
    addB(3808, 450, 'b', 'none');
    addB(3852, 450, 'q', 'coin');

    // Zona 7: Tangga Piramida Menuju Tiang Bendera
    const px = 4380;
    for (let c = 0; c < 5; c++) {
      for (let r = 0; r <= c; r++) {
        addB(px + c * 44, GROUND_Y - (r + 1) * 44, 'b', 'none');
      }
    }
  }

  initFloatingCoins() {
    const addC = (x, y) => this.floatingCoins.push({ x, y, r: 14, collected: false, rot: Math.random() * 6 });

    // Rangkaian koin pemandu lompatan
    for (let i = 0; i < 5; i++) addC(780 + i * 40, 520);
    for (let i = 0; i < 4; i++) addC(1250 + i * 35, 430); // Di atas jurang 1
    for (let i = 0; i < 6; i++) addC(2020 + i * 40, 480);
    for (let i = 0; i < 4; i++) addC(2400 + i * 35, 380); // Di atas jurang 2
    for (let i = 0; i < 5; i++) addC(3450 + i * 40, 460);
    for (let i = 0; i < 4; i++) addC(3580 + i * 35, 420); // Di atas jurang 3
    for (let i = 0; i < 8; i++) addC(4180 + i * 40, 500);
  }

  isPitAt(x) {
    for (const p of this.pits) {
      if (x >= p.x1 && x <= p.x2) return true;
    }
    return false;
  }

  update(dt) {
    // Animasi pantulan balok saat disundul
    for (const b of this.blocks) {
      if (b.bumpY !== 0 || b.bumpVel !== 0) {
        b.bumpY += b.bumpVel * dt;
        b.bumpVel += 800 * dt;
        if (b.bumpY >= 0) {
          b.bumpY = 0;
          b.bumpVel = 0;
        }
      }
    }

    // Animasi putaran koin
    for (const c of this.floatingCoins) {
      if (!c.collected) c.rot += 5 * dt;
    }

    // Animasi penurunan bendera finis bila sudah disentuh
    if (this.flagpole.touched && this.flagpole.flagY < this.flagpole.baseY - 40) {
      this.flagpole.flagY += 240 * dt;
      if (this.flagpole.flagY > this.flagpole.baseY - 40) {
        this.flagpole.flagY = this.flagpole.baseY - 40;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  KELAS ENTITAS MUSUH (GOOMBA & KOOPA)
// ═══════════════════════════════════════════════════════════════════

class Enemy {
  constructor(type, x, y) {
    this.type = type; // 'goomba' atau 'koopa'
    this.x = x;
    this.y = y;
    this.w = type === 'goomba' ? 38 : 40;
    this.h = type === 'goomba' ? 36 : 48;
    this.vx = (type === 'goomba' ? -65 : -75);
    this.vy = 0;
    this.alive = true;
    this.squashed = false;
    this.squashTimer = 0;
    this.walkAnim = 0;
  }

  update(dt, map) {
    if (!this.alive) {
      if (this.squashed) {
        this.squashTimer += dt;
      }
      return;
    }

    this.walkAnim += dt * 6;

    // Gerak horizontal
    this.x += this.vx * dt;

    // Cek batas jurang & pipa (balik arah bila mentok)
    if (map.isPitAt(this.x + (this.vx > 0 ? this.w + 10 : -10))) {
      this.vx = -this.vx;
    }

    for (const p of map.pipes) {
      const pipeY = map.groundY - p.h;
      if (this.y + this.h > pipeY) {
        if (this.vx > 0 && this.x + this.w >= p.x && this.x < p.x + p.w) {
          this.x = p.x - this.w;
          this.vx = -this.vx;
        } else if (this.vx < 0 && this.x <= p.x + p.w && this.x + this.w > p.x) {
          this.x = p.x + p.w;
          this.vx = -this.vx;
        }
      }
    }
  }

  render(ctx, camX) {
    const rx = this.x - camX;
    const ry = this.y;
    if (rx + this.w < -60 || rx > CANVAS_WIDTH + 60) return;

    ctx.save();
    if (this.squashed) {
      // Gambar musuh terinjak (gepeng)
      ctx.fillStyle = this.type === 'goomba' ? '#92400E' : '#15803D';
      ctx.beginPath();
      ctx.ellipse(rx + this.w / 2, ry + this.h - 8, this.w / 2 + 4, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'goomba') {
      // Goomba (Jamur Cokelat Berjalan)
      const legToggle = Math.sin(this.walkAnim) > 0;
      // Kaki
      ctx.fillStyle = '#1C1917';
      ctx.beginPath();
      ctx.ellipse(rx + 10 + (legToggle ? 3 : -2), ry + this.h - 4, 8, 5, 0, 0, Math.PI * 2);
      ctx.ellipse(rx + this.w - 10 + (legToggle ? -2 : 3), ry + this.h - 4, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tubuh / Kepala Jamur
      ctx.fillStyle = '#B45309';
      ctx.beginPath();
      ctx.moveTo(rx + 6, ry + this.h - 6);
      ctx.quadraticCurveTo(rx - 2, ry + 10, rx + this.w / 2, ry);
      ctx.quadraticCurveTo(rx + this.w + 2, ry + 10, rx + this.w - 6, ry + this.h - 6);
      ctx.closePath();
      ctx.fill();

      // Batang leher krem
      ctx.fillStyle = '#FEF3C7';
      ctx.beginPath();
      ctx.ellipse(rx + this.w / 2, ry + this.h - 9, 9, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Mata galak
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(rx + 10, ry + 12, 6, 10);
      ctx.fillRect(rx + this.w - 16, ry + 12, 6, 10);
      ctx.fillStyle = '#000000';
      ctx.fillRect(rx + 12, ry + 14, 3, 7);
      ctx.fillRect(rx + this.w - 14, ry + 14, 3, 7);
      // Alis miring
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rx + 8, ry + 10); ctx.lineTo(rx + 17, ry + 14);
      ctx.moveTo(rx + this.w - 8, ry + 10); ctx.lineTo(rx + this.w - 17, ry + 14);
      ctx.stroke();
    } else {
      // Koopa (Kura-kura Hijau)
      const legToggle = Math.sin(this.walkAnim) > 0;
      // Kaki kuning
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.ellipse(rx + 8 + (legToggle ? 3 : -2), ry + this.h - 4, 8, 5, 0, 0, Math.PI * 2);
      ctx.ellipse(rx + this.w - 8 + (legToggle ? -2 : 3), ry + this.h - 4, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tempurung Hijau
      ctx.fillStyle = '#16A34A';
      ctx.beginPath();
      ctx.ellipse(rx + this.w / 2, ry + 24, 16, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#FEF08A';
      ctx.stroke();

      // Kepala
      const facing = this.vx < 0 ? -1 : 1;
      const headX = rx + (facing < 0 ? 8 : this.w - 8);
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.ellipse(headX, ry + 10, 10, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      // Mata
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(headX + facing * 3, ry + 8, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════════
//  KELAS POWER-UP & EFEK MELAYANG (JAMUR, BINTANG, KOIN POP)
// ═══════════════════════════════════════════════════════════════════

class PowerUp {
  constructor(type, x, y) {
    this.type = type; // 'mushroom' atau 'star'
    this.x = x;
    this.y = y;
    this.w = 34;
    this.h = 34;
    this.vx = 90;
    this.vy = -180; // Pop naik keluar balok
    this.collected = false;
    this.onGround = false;
  }

  update(dt, map) {
    if (this.collected) return;

    this.vy += GRAVITY * 0.8 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Tabrakan lantai
    if (this.y + this.h >= map.groundY) {
      if (!map.isPitAt(this.x + this.w / 2)) {
        this.y = map.groundY - this.h;
        if (this.type === 'star') {
          this.vy = -380; // Bintang membal-membal ceria
        } else {
          this.vy = 0;
          this.onGround = true;
        }
      }
    }

    // Balik arah bila menabrak pipa
    for (const p of map.pipes) {
      const py = map.groundY - p.h;
      if (this.y + this.h > py) {
        if (this.vx > 0 && this.x + this.w >= p.x && this.x < p.x + p.w) {
          this.x = p.x - this.w;
          this.vx = -this.vx;
        } else if (this.vx < 0 && this.x <= p.x + p.w && this.x + this.w > p.x) {
          this.x = p.x + p.w;
          this.vx = -this.vx;
        }
      }
    }
  }

  render(ctx, camX) {
    if (this.collected) return;
    const rx = this.x - camX;
    const ry = this.y;
    if (rx + this.w < -40 || rx > CANVAS_WIDTH + 40) return;

    ctx.save();
    if (this.type === 'mushroom') {
      // Payung Jamur Merah Berbintik Putih
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(rx + this.w / 2, ry + 14, 16, Math.PI, 0);
      ctx.closePath();
      ctx.fill();

      // Bintik putih
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(rx + this.w / 2, ry + 7, 5, 0, Math.PI * 2);
      ctx.arc(rx + 7, ry + 13, 3.5, 0, Math.PI * 2);
      ctx.arc(rx + this.w - 7, ry + 13, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Batang Jamur Krem
      ctx.fillStyle = '#FEF3C7';
      ctx.beginPath();
      ctx.roundRect(rx + 9, ry + 14, 16, 16, 4);
      ctx.fill();

      // Mata Jamur
      ctx.fillStyle = '#000000';
      ctx.fillRect(rx + 12, ry + 18, 3, 6);
      ctx.fillRect(rx + 19, ry + 18, 3, 6);
    } else {
      // Bintang Kebal ⭐
      ctx.fillStyle = '#FBBF24';
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 2;
      drawStar(ctx, rx + this.w / 2, ry + this.h / 2, 5, 16, 8);
      ctx.fill();
      ctx.stroke();

      // Mata bintang lucu
      ctx.fillStyle = '#000000';
      ctx.fillRect(rx + this.w / 2 - 4, ry + this.h / 2 - 3, 2.5, 5);
      ctx.fillRect(rx + this.w / 2 + 2, ry + this.h / 2 - 3, 2.5, 5);
    }
    ctx.restore();
  }
}

// Helper gambar bintang
function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
}

// ═══════════════════════════════════════════════════════════════════
//  KELAS PEMAIN (PLAYER CONTROLLER DENGAN BUBBLE CATCH-UP)
// ═══════════════════════════════════════════════════════════════════

class Player {
  constructor(slot, isBot = false) {
    this.slot = slot;
    this.isBot = isBot;
    this.color = SLOT_COLORS[slot] || SLOT_COLORS[1];

    // Dimensi Normal
    this.w = 36;
    this.h = 48;
    this.x = 100 + (slot - 1) * 60;
    this.y = GROUND_Y - this.h;
    this.vx = 0;
    this.vy = 0;

    // Kontrol & State
    this.facing = 1; // 1 = Kanan, -1 = Kiri
    this.onGround = false;
    this.coyoteTimer = 0;
    this.jumpBuffer = 0;
    this.ducking = false;

    // Optimasi Lompat micro:bit: Air Momentum Lock
    this.airMomentumLock = 0; // Mengunci kecepatan laju horizontal saat melompat
    this.desiredDir = 0;      // -1 = Kiri, 0 = Netral, 1 = Kanan

    // Power-Up & Status
    this.isSuper = false;     // Karakter membesar (Jamur Super)
    this.starTimer = 0;       // Waktu aktif Bintang Kebal
    this.invulnTimer = 0;     // Durasi kedip pasca cedera
    this.lives = INITIAL_LIVES;
    this.score = 0;
    this.coins = 0;

    // Gelembung Penyelamat (Rescue Bubble)
    this.inBubble = false;
    this.bubbleTimer = 0;

    // Status Finis Tiang Bendera
    this.finished = false;
    this.flagBonus = 0;
    this.walkAnim = 0;
  }

  update(dt, map, leadPlayer, audioPlay) {
    // 1. Status Finis (Otomatis jalan masuk ke kastel)
    if (this.finished) {
      if (this.x < map.castle.doorX + 20) {
        this.x += 120 * dt;
        this.walkAnim += dt * 8;
        this.facing = 1;
      }
      return;
    }

    // 2. Status Gelembung Penyelamat (Catch-Up Bubble)
    if (this.inBubble) {
      this.bubbleTimer -= dt;
      // Melayang mendekati pemain terdepan
      const targetX = leadPlayer ? leadPlayer.x - 30 : this.x;
      const targetY = leadPlayer ? Math.min(GROUND_Y - 120, leadPlayer.y - 40) : GROUND_Y - 100;
      this.x += (targetX - this.x) * Math.min(1, 3.5 * dt);
      this.y += (targetY - this.y) * Math.min(1, 3.5 * dt);

      // Pecahkan gelembung otomatis saat tiba dekat atau waktu habis
      if (this.bubbleTimer <= 0 || (leadPlayer && Math.hypot(this.x - targetX, this.y - targetY) < 40)) {
        this.popBubble(audioPlay);
      }
      return;
    }

    // Timer status
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.starTimer > 0) this.starTimer -= dt;
    if (this.coyoteTimer > 0) this.coyoteTimer -= dt;
    if (this.jumpBuffer > 0) this.jumpBuffer -= dt;

    // Update ukuran tubuh jika Super
    const targetH = this.isSuper ? 64 : 48;
    const targetW = this.isSuper ? 42 : 36;
    if (this.h !== targetH) {
      this.y -= (targetH - this.h);
      this.h = targetH;
      this.w = targetW;
    }

    // Kecepatan lari maksimal (naik jika memiliki Bintang)
    const maxSpeed = this.starTimer > 0 ? STAR_RUN_SPEED : RUN_SPEED;

    // Penanganan Kecepatan Horizontal & Air Momentum Lock
    if (this.onGround) {
      if (this.desiredDir !== 0 && !this.ducking) {
        this.vx = this.desiredDir * maxSpeed;
        this.facing = this.desiredDir;
        this.walkAnim += dt * 10;
        this.airMomentumLock = this.vx;
      } else {
        // Deselerasi halus di tanah
        this.vx *= Math.pow(0.001, dt);
        if (Math.abs(this.vx) < 10) this.vx = 0;
      }
    } else {
      // Saat di udara: jika pemain menekan arah eksplisit, ikuti arah itu
      if (this.desiredDir !== 0) {
        this.vx = this.desiredDir * maxSpeed;
        this.facing = this.desiredDir;
        this.airMomentumLock = this.vx;
      } else {
        // Pertahankan momentum lompat melengkung ke depan (Air Momentum Lock)
        this.vx = this.airMomentumLock;
      }
    }

    // Gravitasi
    this.vy += GRAVITY * dt;
    if (this.vy > 900) this.vy = 900;

    // Gerak sumbu X & Tabrakan Pipa
    this.x += this.vx * dt;
    if (this.x < 10) this.x = 10;

    for (const p of map.pipes) {
      const py = map.groundY - p.h;
      if (this.y + this.h > py + 4) {
        if (this.vx > 0 && this.x + this.w >= p.x && this.x < p.x + p.w) {
          this.x = p.x - this.w;
          this.vx = 0;
          this.airMomentumLock = 0;
        } else if (this.vx < 0 && this.x <= p.x + p.w && this.x + this.w > p.x) {
          this.x = p.x + p.w;
          this.vx = 0;
          this.airMomentumLock = 0;
        }
      }
    }

    // Gerak sumbu Y
    this.y += this.vy * dt;
    this.onGround = false;

    // Tabrakan dengan Tanah Normal (Kecuali di Jurang)
    if (this.y + this.h >= map.groundY) {
      const midX = this.x + this.w / 2;
      if (!map.isPitAt(midX)) {
        this.y = map.groundY - this.h;
        this.vy = 0;
        this.onGround = true;
        this.coyoteTimer = COYOTE_TIME_MAX;
      }
    }

    // Tabrakan dengan Pipa dari Atas (Pijakan)
    for (const p of map.pipes) {
      const py = map.groundY - p.h;
      if (this.x + this.w > p.x + 4 && this.x < p.x + p.w - 4) {
        // Mendarat di atas pipa
        if (this.vy >= 0 && this.y + this.h >= py && this.y + this.h <= py + 24) {
          this.y = py - this.h;
          this.vy = 0;
          this.onGround = true;
          this.coyoteTimer = COYOTE_TIME_MAX;

          // Cek pipa rahasia (Warp Pipe)
          if (p.isWarp && this.ducking && !p.warpUsed) {
            p.warpUsed = true;
            this.score += 100;
            this.coins += 5;
            audioPlay('powerup');
            // Pantulan bahagia dari pipa bonus
            this.vy = -500;
          }
        }
      }
    }

    // Tabrakan Balok (Dari Atas dan Dari Bawah / Sundul)
    for (const b of map.blocks) {
      if (this.x + this.w > b.x + 4 && this.x < b.x + b.w - 4) {
        // Mendarat di atas balok
        if (this.vy >= 0 && this.y + this.h >= b.y && this.y + this.h <= b.y + 20) {
          this.y = b.y - this.h;
          this.vy = 0;
          this.onGround = true;
          this.coyoteTimer = COYOTE_TIME_MAX;
        }
        // Sundul balok dari bawah
        else if (this.vy < 0 && this.y <= b.y + b.h && this.y >= b.y + b.h - 18) {
          this.y = b.y + b.h;
          this.vy = 40;
          b.bumpVel = -260; // Animasi pantulan naik balok
          if (!b.hit) {
            b.hit = true;
            if (b.type === 'q') {
              if (b.content === 'coin') {
                this.score += 20;
                this.coins++;
                audioPlay('score');
              } else if (b.content === 'mushroom') {
                audioPlay('hit');
              } else if (b.content === 'star') {
                audioPlay('hit');
              }
            } else if (b.type === 'b') {
              this.score += 10;
              audioPlay('hit');
            }
          }
        }
      }
    }

    // Eksekusi Lompat (Didukung Jump Buffer & Coyote Time)
    if (this.jumpBuffer > 0 && (this.onGround || this.coyoteTimer > 0)) {
      this.vy = JUMP_FORCE;
      this.onGround = false;
      this.coyoteTimer = 0;
      this.jumpBuffer = 0;
      audioPlay('bounce');
    }

    // Cek Jatuh ke Jurang
    if (this.y > CANVAS_HEIGHT + 40) {
      this.enterBubble(leadPlayer, audioPlay);
    }

    // Cek Tiang Bendera Finis
    if (!map.flagpole.touched && this.x + this.w >= map.flagpole.x) {
      map.flagpole.touched = true;
      map.flagpole.winnerSlot = this.slot;
      this.finished = true;
      // Hitung bonus ketinggian sentuh bendera
      const heightBonus = Math.max(50, Math.min(250, Math.floor((GROUND_Y - this.y) * 0.7)));
      this.flagBonus = 200 + heightBonus;
      this.score += this.flagBonus;
      audioPlay('win');
    } else if (map.flagpole.touched && this.x + this.w >= map.flagpole.x && !this.finished) {
      // Pemain berikutnya menyentuh bendera
      this.finished = true;
      this.flagBonus = 100;
      this.score += this.flagBonus;
    }
  }

  jump() {
    this.jumpBuffer = JUMP_BUFFER_MAX;
  }

  takeDamage(leadPlayer, audioPlay) {
    if (this.invulnTimer > 0 || this.inBubble || this.starTimer > 0) return;

    if (this.isSuper) {
      this.isSuper = false;
      this.invulnTimer = INVULN_TIME_SEC;
      audioPlay('hurt');
    } else {
      this.lives--;
      this.score = Math.max(0, this.score - 20);
      audioPlay('hurt');
      this.enterBubble(leadPlayer, audioPlay);
    }
  }

  enterBubble(leadPlayer, audioPlay) {
    if (this.inBubble) return;
    this.inBubble = true;
    this.bubbleTimer = 2.0; // Maksimal 2 detik melayang
    this.vy = -180;
    this.vx = 0;
    this.isSuper = false;
    audioPlay('lose');
  }

  popBubble(audioPlay) {
    this.inBubble = false;
    this.vy = -120;
    this.invulnTimer = INVULN_TIME_SEC;
    audioPlay('bounce');
  }

  render(ctx, camX) {
    const rx = this.x - camX;
    const ry = this.y;

    ctx.save();

    // Gambar Gelembung Penyelamat bila aktif
    if (this.inBubble) {
      ctx.fillStyle = 'rgba(147, 197, 253, 0.45)';
      ctx.strokeStyle = '#93C5FD';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(rx + this.w / 2, ry + this.h / 2, Math.max(this.w, this.h) / 2 + 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Kilau gelembung
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(rx + this.w / 2 - 8, ry + this.h / 2 - 8, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Efek Kedip saat Kebal
    if (this.invulnTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    // Efek Rainbow Flash saat Bintang Kebal ⭐
    let bodyColor = this.color.hex;
    let hatColor = this.color.hat;
    if (this.starTimer > 0) {
      const rainbow = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
      bodyColor = rainbow[Math.floor(Date.now() / 90) % rainbow.length];
      hatColor = bodyColor;
    }

    // Bayangan Kaki Karakter
    if (this.onGround && !this.inBubble) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(rx + this.w / 2, ry + this.h, this.w / 2, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tubuh & Pakaian Overalls
    ctx.fillStyle = '#1E3A8A'; // Celana biru
    ctx.beginPath();
    ctx.roundRect(rx + 4, ry + this.h - 22, this.w - 8, 16, 4);
    ctx.fill();

    // Baju Sesuai Warna Slot
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.roundRect(rx + 6, ry + this.h - 32, this.w - 12, 14, 4);
    ctx.fill();

    // Kepala / Wajah Krem
    ctx.fillStyle = '#FED7AA';
    ctx.beginPath();
    ctx.ellipse(rx + this.w / 2, ry + 16, 12, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hidung & Mata
    const eyeX = rx + (this.facing > 0 ? this.w / 2 + 3 : this.w / 2 - 6);
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(eyeX, ry + 14, 2, 0, Math.PI * 2);
    ctx.fill();

    // Kumis Ikonik
    ctx.fillStyle = '#451A03';
    ctx.beginPath();
    ctx.roundRect(rx + (this.facing > 0 ? this.w / 2 : this.w / 2 - 8), ry + 18, 9, 4, 2);
    ctx.fill();

    // Topi Petualang
    ctx.fillStyle = hatColor;
    ctx.beginPath();
    ctx.ellipse(rx + this.w / 2, ry + 8, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Lidah topi (Visor)
    ctx.beginPath();
    ctx.roundRect(rx + (this.facing > 0 ? this.w / 2 + 2 : this.w / 2 - 14), ry + 9, 12, 4, 2);
    ctx.fill();

    // Badge Pemain di Atas Kepala (P1, P2, P3, P4)
    ctx.fillStyle = this.color.hex;
    ctx.beginPath();
    ctx.roundRect(rx + this.w / 2 - 14, ry - 18, 28, 14, 4);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`P${this.slot}`, rx + this.w / 2, ry - 11);

    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════════
//  GAME ENGINE UTAMA (PETUALANG KOIN)
// ═══════════════════════════════════════════════════════════════════

class GameEngine {
  constructor(canvas, kernel, players, mode, finish, audio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.kernel = kernel;
    this.playerSlots = players;
    this.mode = mode;
    this.finish = finish;
    this.audio = audio;

    this.state = 'countdown'; // 'countdown' | 'playing' | 'ended'
    this.countdownTimer = COUNTDOWN_SEC;
    this.gameTime = GAME_DURATION_SEC;
    this.camX = 0;

    this.map = new LevelMap();
    this.players = [];
    this.enemies = [];
    this.powerups = [];
    this.particles = [];

    this.initPlayers();
    this.initEnemies();

    this.lastTime = performance.now();
    this.running = true;

    this.safeAudio('start');
  }

  safeAudio(name) {
    if (this.audio && typeof this.audio.play === 'function') {
      try { this.audio.play(name); } catch (_) {}
    }
  }

  initPlayers() {
    this.players = [];
    for (let i = 0; i < this.playerSlots.length; i++) {
      const slotNum = this.playerSlots[i];
      this.players.push(new Player(slotNum, false));
    }
  }

  initEnemies() {
    this.enemies = [
      new Enemy('goomba', 750,  GROUND_Y - 36),
      new Enemy('goomba', 1050, GROUND_Y - 36),
      new Enemy('koopa',  1400, GROUND_Y - 48),
      new Enemy('goomba', 1950, GROUND_Y - 36),
      new Enemy('goomba', 2020, GROUND_Y - 36),
      new Enemy('koopa',  2650, GROUND_Y - 48),
      new Enemy('goomba', 3200, GROUND_Y - 36),
      new Enemy('koopa',  3850, GROUND_Y - 48),
      new Enemy('goomba', 4250, GROUND_Y - 36)
    ];
  }

  spawnPowerUp(type, x, y) {
    this.powerups.push(new PowerUp(type, x, y));
    this.safeAudio('powerup');
  }

  getLeadPlayer() {
    let lead = null;
    let maxX = -9999;
    for (const p of this.players) {
      if (!p.inBubble && p.x > maxX) {
        maxX = p.x;
        lead = p;
      }
    }
    return lead || this.players[0];
  }

  handleInput(slot, cmd) {
    const p = this.players.find(pl => pl.slot === slot);
    if (!p) return;

    if (this.state === 'countdown' && (cmd === '99' || cmd === '5')) {
      this.countdownTimer = 0;
      return;
    }

    if (this.state !== 'playing') return;

    if (cmd === '3') {
      // Miring Kiri
      p.desiredDir = -1;
      p.ducking = false;
    } else if (cmd === '4') {
      // Miring Kanan
      p.desiredDir = 1;
      p.ducking = false;
    } else if (cmd === '0') {
      // Datar / Netral
      p.desiredDir = 0;
      p.ducking = false;
    } else if (cmd === '1' || cmd === '5') {
      // Lompat (Melompat dengan Air Momentum Lock)
      if (p.inBubble) {
        p.popBubble(name => this.safeAudio(name));
      } else {
        p.jump();
      }
    } else if (cmd === '2') {
      // Menunduk / Masuk Pipa Rahasia
      p.ducking = true;
      p.desiredDir = 0;
    }
  }

  update(dt) {
    if (this.state === 'countdown') {
      this.countdownTimer -= dt;
      if (this.countdownTimer <= 0) {
        this.state = 'playing';
      }
      return;
    }

    if (this.state === 'playing') {
      this.gameTime -= dt;
      if (this.gameTime <= 0) {
        this.gameTime = 0;
        this.endGame();
        return;
      }

      this.map.update(dt);
      const leadPlayer = this.getLeadPlayer();

      // Kamera Multiplayer Mengikuti Pemain Terdepan
      const targetCamX = Math.max(0, Math.min(LEVEL_WIDTH - CANVAS_WIDTH, leadPlayer.x - 380));
      this.camX += (targetCamX - this.camX) * Math.min(1, 4.0 * dt);

      // Update Seluruh Pemain
      let allFinished = true;
      for (const p of this.players) {
        p.update(dt, this.map, leadPlayer, name => this.safeAudio(name));

        // Anti-Tertinggal: Jika terdorong keluar tepi kiri layar, masuk gelembung
        if (p.x < this.camX - 60 && !p.inBubble && !p.finished) {
          p.enterBubble(leadPlayer, name => this.safeAudio(name));
        }

        // Ambil Koin Melayang
        for (const c of this.map.floatingCoins) {
          if (!c.collected && Math.hypot((p.x + p.w / 2) - c.x, (p.y + p.h / 2) - c.y) < 28) {
            c.collected = true;
            p.coins++;
            p.score += 10;
            this.safeAudio('score');
          }
        }

        // Ambil Power-Up
        for (const pw of this.powerups) {
          if (!pw.collected && Math.hypot((p.x + p.w / 2) - (pw.x + pw.w / 2), (p.y + p.h / 2) - (pw.y + pw.h / 2)) < 36) {
            pw.collected = true;
            if (pw.type === 'mushroom') {
              p.isSuper = true;
              p.score += 50;
              this.safeAudio('powerup');
            } else if (pw.type === 'star') {
              p.starTimer = 8.0;
              p.score += 100;
              this.safeAudio('powerup');
            }
          }
        }

        // Interaksi dengan Musuh
        for (const e of this.enemies) {
          if (!e.alive || e.squashed) continue;
          if (p.x + p.w > e.x + 4 && p.x < e.x + e.w - 4 && p.y + p.h > e.y && p.y < e.y + e.h) {
            // Jika pemain memiliki Bintang Kebal: musuh langsung kalah
            if (p.starTimer > 0) {
              e.alive = false;
              e.squashed = true;
              p.score += 100;
              this.safeAudio('hit');
            }
            // Menginjak dari atas (Stomp)
            else if (p.vy > 0 && p.y + p.h <= e.y + 18) {
              e.alive = false;
              e.squashed = true;
              p.vy = JUMP_BOUNCE;
              p.score += 50;
              this.safeAudio('hit');
            }
            // Tersenggol dari samping / bawah
            else {
              p.takeDamage(leadPlayer, name => this.safeAudio(name));
            }
          }
        }

        if (!p.finished) allFinished = false;
      }

      // Bila semua pemain sudah menyentuh bendera finis
      if (allFinished && this.players.length > 0) {
        this.endGame();
      }

      // Update Musuh & Power-Up
      for (const e of this.enemies) e.update(dt, this.map);
      for (const pw of this.powerups) pw.update(dt, this.map);

      // Cek Munculkan Power-Up dari Balok yang Baru Disundul
      for (const b of this.map.blocks) {
        if (b.hit && b.type === 'q' && (b.content === 'mushroom' || b.content === 'star')) {
          this.spawnPowerUp(b.content, b.x + 5, b.y - 36);
          b.content = 'empty';
        }
      }
    }
  }

  endGame() {
    if (this.state === 'ended') return;
    this.state = 'ended';

    setTimeout(() => {
      let finishText = '';
      if (this.players.length === 1) {
        const p1 = this.players[0];
        let stars = '⭐';
        if (p1.score >= 1000) stars = '⭐⭐⭐';
        else if (p1.score >= 500) stars = '⭐⭐';
        finishText = `🏆 P1 Selesai! Skor: ${p1.score} (Rating: ${stars})`;
      } else {
        const sorted = [...this.players].sort((a, b) => b.score - a.score);
        const ranks = sorted.map((p, idx) => `${idx === 0 ? '🏆 ' : ''}P${p.slot}: ${p.score} pt`).join(' | ');
        finishText = `${ranks}`;
      }
      if (typeof this.finish === 'function') {
        this.finish(finishText);
      }
    }, FINISH_DELAY_MS);
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Latar Langit Retro Biru Cantik
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    skyGrad.addColorStop(0, '#60A5FA');
    skyGrad.addColorStop(1, '#93C5FD');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Parallax Awan & Bukit Hijau
    this.renderParallax(ctx);

    // 3. Tanah & Jurang
    this.renderGround(ctx);

    // 4. Balok Bata & Balok '?'
    for (const b of this.map.blocks) {
      this.renderBlock(ctx, b);
    }

    // 5. Pipa Hijau
    for (const p of this.map.pipes) {
      this.renderPipe(ctx, p);
    }

    // 6. Koin Melayang
    for (const c of this.map.floatingCoins) {
      if (!c.collected) {
        this.renderCoin(ctx, c);
      }
    }

    // 7. Tiang Bendera & Kastel Finis
    this.renderGoal(ctx);

    // 8. Musuh & Power-Up
    for (const e of this.enemies) e.render(ctx, this.camX);
    for (const pw of this.powerups) pw.render(ctx, this.camX);

    // 9. Pemain
    for (const p of this.players) p.render(ctx, this.camX);

    // 10. Floating HUD Atas
    this.renderHUD(ctx);

    // 11. Layar Hitung Mundur (Countdown)
    if (this.state === 'countdown') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#FDE047';
      ctx.font = 'bold 76px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const secLeft = Math.ceil(this.countdownTimer);
      ctx.fillText(secLeft > 0 ? secLeft : 'MULAI!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('Miringkan micro:bit ke Kiri / Kanan untuk lari • Atas / Tombol A untuk lompat!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
    }
  }

  renderParallax(ctx) {
    // Awan putih melayang (Parallax lambat)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    const cloudOffset = (this.camX * 0.25) % 800;
    for (let i = -1; i < 3; i++) {
      const cx = i * 500 - cloudOffset;
      ctx.beginPath();
      ctx.arc(cx + 80, 140, 36, 0, Math.PI * 2);
      ctx.arc(cx + 120, 120, 44, 0, Math.PI * 2);
      ctx.arc(cx + 170, 140, 38, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bukit Hijau Bergulir di Belakang (Parallax sedang)
    ctx.fillStyle = '#86EFAC';
    const hillOffset = (this.camX * 0.45) % 600;
    for (let i = -1; i < 4; i++) {
      const hx = i * 420 - hillOffset;
      ctx.beginPath();
      ctx.ellipse(hx + 200, GROUND_Y, 220, 160, 0, Math.PI, 0);
      ctx.fill();
    }
  }

  renderGround(ctx) {
    const startX = Math.floor(this.camX / 40) * 40;
    const endX = startX + CANVAS_WIDTH + 80;

    for (let x = startX; x < endX; x += 40) {
      if (this.map.isPitAt(x + 20)) continue; // Jangan gambar bila di jurang

      const rx = x - this.camX;
      // Rumput hijau atas
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(rx, GROUND_Y, 40, 16);
      ctx.fillStyle = '#16A34A';
      ctx.fillRect(rx, GROUND_Y + 12, 40, 4);

      // Tanah cokelat
      ctx.fillStyle = '#92400E';
      ctx.fillRect(rx, GROUND_Y + 16, 40, CANVAS_HEIGHT - GROUND_Y - 16);
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx, GROUND_Y + 16, 40, CANVAS_HEIGHT - GROUND_Y - 16);
    }
  }

  renderBlock(ctx, b) {
    const rx = b.x - this.camX;
    const ry = b.y + b.bumpY;
    if (rx + b.w < -20 || rx > CANVAS_WIDTH + 20) return;

    ctx.save();
    if (b.type === 'q') {
      if (b.hit) {
        // Balok kosong mati (kecokelatan)
        ctx.fillStyle = '#A16207';
        ctx.fillRect(rx, ry, b.w, b.h);
        ctx.strokeStyle = '#713F12';
        ctx.lineWidth = 2;
        ctx.strokeRect(rx, ry, b.w, b.h);
      } else {
        // Balok '?' Kuning Emas Berdenyut
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(rx, ry, b.w, b.h);
        ctx.fillStyle = '#FDE68A';
        ctx.fillRect(rx + 2, ry + 2, b.w - 4, 4);
        ctx.fillRect(rx + 2, ry + 2, 4, b.h - 4);
        ctx.fillStyle = '#D97706';
        ctx.fillRect(rx + b.w - 4, ry + 2, 4, b.h - 4);
        ctx.fillRect(rx + 2, ry + b.h - 4, b.w - 4, 4);

        // Simbol '?'
        ctx.fillStyle = '#FEF3C7';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', rx + b.w / 2, ry + b.h / 2 + 1);
      }
    } else {
      // Balok Bata Cokelat
      ctx.fillStyle = '#B45309';
      ctx.fillRect(rx, ry, b.w, b.h);
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, b.w, b.h);
      ctx.beginPath();
      ctx.moveTo(rx, ry + b.h / 2); ctx.lineTo(rx + b.w, ry + b.h / 2);
      ctx.moveTo(rx + b.w / 2, ry); ctx.lineTo(rx + b.w / 2, ry + b.h / 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderPipe(ctx, p) {
    const rx = p.x - this.camX;
    const py = GROUND_Y - p.h;
    if (rx + p.w < -20 || rx > CANVAS_WIDTH + 20) return;

    ctx.save();
    // Bibir Pipa Atas
    ctx.fillStyle = '#15803D';
    ctx.fillRect(rx - 4, py, p.w + 8, 24);
    ctx.fillStyle = '#4ADE80';
    ctx.fillRect(rx - 2, py + 2, 8, 20); // Highlight kilau
    ctx.strokeStyle = '#14532D';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(rx - 4, py, p.w + 8, 24);

    // Batang Pipa
    ctx.fillStyle = '#16A34A';
    ctx.fillRect(rx, py + 24, p.w, p.h - 24);
    ctx.fillStyle = '#86EFAC';
    ctx.fillRect(rx + 4, py + 24, 6, p.h - 24);
    ctx.strokeStyle = '#14532D';
    ctx.strokeRect(rx, py + 24, p.w, p.h - 24);

    // Indikator Pipa Rahasia (Warp Pipe)
    if (p.isWarp && !p.warpUsed) {
      ctx.fillStyle = '#FDE047';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▼ BONUS', rx + p.w / 2, py - 8);
    }
    ctx.restore();
  }

  renderCoin(ctx, c) {
    const rx = c.x - this.camX;
    const ry = c.y;
    if (rx < -20 || rx > CANVAS_WIDTH + 20) return;

    ctx.save();
    const scaleX = Math.abs(Math.cos(c.rot));
    ctx.fillStyle = '#FBBF24';
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(rx, ry, Math.max(3, c.r * scaleX), c.r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  renderGoal(ctx) {
    const f = this.map.flagpole;
    const frx = f.x - this.camX;

    // Tiang Bendera
    if (frx > -60 && frx < CANVAS_WIDTH + 60) {
      ctx.save();
      // Bola Emas Atas
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(frx, f.topY, 12, 0, Math.PI * 2);
      ctx.fill();

      // Tiang Putih Baja
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(frx - 4, f.topY, 8, f.height);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(frx - 4, f.topY, 8, f.height);

      // Bendera Segitiga Hijau
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.moveTo(frx + 4, f.flagY);
      ctx.lineTo(frx + 44, f.flagY + 18);
      ctx.lineTo(frx + 4, f.flagY + 36);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Kastel Finis
    const cas = this.map.castle;
    const crx = cas.x - this.camX;
    if (crx > -260 && crx < CANVAS_WIDTH + 260) {
      ctx.save();
      // Dinding Kastel Bata Merah Tua
      ctx.fillStyle = '#991B1B';
      ctx.fillRect(crx, cas.y, cas.w, cas.h);
      ctx.strokeStyle = '#7F1D1D';
      ctx.lineWidth = 3;
      ctx.strokeRect(crx, cas.y, cas.w, cas.h);

      // Menara Atas Kastel (Gerigi)
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(crx + i * 44 + 4, cas.y - 24, 32, 24);
        ctx.strokeRect(crx + i * 44 + 4, cas.y - 24, 32, 24);
      }

      // Pintu Masuk Lengkung
      ctx.fillStyle = '#18181B';
      const drx = cas.doorX - this.camX;
      ctx.beginPath();
      ctx.roundRect(drx, GROUND_Y - cas.doorH, cas.doorW, cas.doorH, [24, 24, 0, 0]);
      ctx.fill();

      ctx.restore();
    }
  }

  renderHUD(ctx) {
    // HUD Atas: Skor Pemain, Nyawa, Koin, dan Countdown Waktu
    ctx.save();
    const leftMargin = 130; // Aman dari tombol #quit

    // 1. Chip Tiap Pemain
    let curX = leftMargin;
    for (const p of this.players) {
      const chipW = 160;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.beginPath();
      ctx.roundRect(curX, 16, chipW, 38, 10);
      ctx.fill();

      // Badge Pemain
      ctx.fillStyle = p.color.hex;
      ctx.beginPath();
      ctx.roundRect(curX + 6, 21, 32, 28, 6);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`P${p.slot}`, curX + 22, 35);

      // Skor, Koin & Nyawa
      ctx.fillStyle = '#FDE047';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`⭐ ${p.score}`, curX + 44, 28);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '11px sans-serif';
      ctx.fillText(`🪙 ${p.coins}  ❤️ ${p.lives}`, curX + 44, 44);

      curX += chipW + 12;
    }

    // 2. Chip Timer Hitung Mundur (Tengah Atas)
    const timerW = 130;
    const timerX = CANVAS_WIDTH / 2 - timerW / 2;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(timerX, 16, timerW, 38, 10);
    ctx.fill();

    const secLeft = Math.max(0, Math.ceil(this.gameTime));
    ctx.fillStyle = secLeft <= 15 ? '#EF4444' : '#38BDF8';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`⏱️ ${secLeft}s`, timerX + timerW / 2, 35);

    ctx.restore();
  }

  loop(timestamp) {
    if (!this.running) return;
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame(ts => this.loop(ts));
  }
}

// ═══════════════════════════════════════════════════════════════════
//  EXPORT GAME MODULE
// ═══════════════════════════════════════════════════════════════════

export default {
  id: 'petualangkoin',
  name: 'Petualang Koin',
  icon: '🪙',
  tag: 'Retro',
  description: 'Petualangan platformer klasik 1P, 2P & 4P! Kumpulkan koin, sundul balok, injak musuh, dan capai tiang bendera!',
  modes: [
    { id: '1p', label: '1 Player', sub: 'Solo Petualang', players: 1 },
    { id: '2p', label: '2 Player', sub: 'Petualang Berdua', players: 2 },
    { id: '4p', label: '4 Player', sub: 'Pesta Berempat', players: 4 }
  ],
  canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },

  create({ canvas, kernel, players, mode, finish, audio }) {
    const engine = new GameEngine(canvas, kernel, players, mode, finish, audio);

    // Listener Input Kernel micro:bit
    const offInput = kernel.on('input', ({ player, cmd }) => {
      engine.handleInput(player, cmd);
    });

    // Keyboard Fallback Handler (P1 WASD/Space, P2 Panah/Enter)
    const onKeyDown = e => {
      // Player 1
      if (e.key === 'a' || e.key === 'A') engine.handleInput(1, '3');
      else if (e.key === 'd' || e.key === 'D') engine.handleInput(1, '4');
      else if (e.key === 'w' || e.key === 'W' || e.key === ' ') engine.handleInput(1, '1');
      else if (e.key === 's' || e.key === 'S') engine.handleInput(1, '2');

      // Player 2
      if (e.key === 'ArrowLeft') engine.handleInput(2, '3');
      else if (e.key === 'ArrowRight') engine.handleInput(2, '4');
      else if (e.key === 'ArrowUp') engine.handleInput(2, '1');
      else if (e.key === 'ArrowDown') engine.handleInput(2, '2');
      else if (e.key === 'Enter') engine.handleInput(2, '1');

      if (e.key === 'Enter' || e.key === ' ') {
        if (engine.state === 'countdown') engine.countdownTimer = 0;
      }
    };

    const onKeyUp = e => {
      if (e.key === 'a' || e.key === 'A' || e.key === 'd' || e.key === 'D') engine.handleInput(1, '0');
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') engine.handleInput(2, '0');
    };

    const onClick = () => {
      if (engine.state === 'countdown') engine.countdownTimer = 0;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('click', onClick);

    requestAnimationFrame(ts => {
      engine.lastTime = ts;
      engine.loop(ts);
    });

    return {
      stop() {
        engine.running = false;
        offInput();
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        canvas.removeEventListener('click', onClick);
      }
    };
  }
};
