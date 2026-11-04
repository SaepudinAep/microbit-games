// GAME: Space Invaders (Pemain di bawah menembak pasukan alien yang bergerak turun).
// Mendukung 1 Player (Solo) dan 2 Player (Co-op berjuang bersama).
//
// Kontrak game:
//   id, name, description
//   modes: [{id, label, sub, players}]
//   canvas: {width, height}
//   create({canvas, kernel, players, mode, finish, audio}) -> {stop()}

const W = 600, H = 800;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default {
  id: 'spaceinvaders',
  name: 'Space Invaders',
  icon: '👾',
  description: 'Pertahankan bumi dari invasi alien luar angkasa! Bergerak ke kiri-kanan dan tembak jatuh semua alien.',
  modes: [
    {id: '1p', label: '1 Player', sub: 'Misi Tempur Solo', players: 1},
    {id: '2p', label: '2 Player', sub: 'Co-op Tempur Berdua', players: 2}
  ],
  canvas: {width: W, height: H},

  create({canvas, kernel, players, mode, finish, audio}){
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const solo = mode.players === 1;

    // Pemetaan slot pemain ke indeks
    const slotToPlayer = {};
    players.forEach((n, i) => { slotToPlayer[n] = i; });

    // Pesawat pemain
    const SHIP_W = 38, SHIP_H = 22;
    const playerColors = ['#4b83ff', '#ff9a2e'];
    const pStates = players.map((_, i) => ({
      x: solo ? (W / 2 - SHIP_W / 2) : (i === 0 ? 180 : 380),
      y: H - 65,
      dir: 0,
      lives: 3,
      score: 0,
      cooldown: 0,
      invulnerable: 0,
      color: playerColors[i % playerColors.length]
    }));

    // Bintang latar belakang (Starfield)
    const stars = Array.from({length: 45}, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      s: Math.random() * 2 + 1,
      v: Math.random() * 25 + 15
    }));

    // Grid Alien
    const COLS = 6, ROWS = 4;
    const ALIEN_W = 36, ALIEN_H = 24, GAP_X = 22, GAP_Y = 18;
    const START_X = 80, START_Y = 110;
    const alienColors = ['#ff4081', '#ffd600', '#00e676', '#00e676'];
    const alienPoints = [30, 20, 10, 10];

    const aliens = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        aliens.push({
          x: START_X + c * (ALIEN_W + GAP_X),
          y: START_Y + r * (ALIEN_H + GAP_Y),
          w: ALIEN_W,
          h: ALIEN_H,
          row: r,
          color: alienColors[r],
          pts: alienPoints[r],
          alive: true
        });
      }
    }

    // Bunker pelindung (4 bunker)
    const bunkers = [];
    const B_W = 54, B_H = 34, B_Y = H - 150;
    const bSpacing = (W - (4 * B_W)) / 5;
    for (let b = 0; b < 4; b++) {
      bunkers.push({
        x: bSpacing + b * (B_W + bSpacing),
        y: B_Y,
        w: B_W,
        h: B_H,
        hp: 12
      });
    }

    // Proyektil & partikel
    let playerLasers = [];
    let alienLasers = [];
    let particles = [];

    // Status permainan
    const st = {
      over: false,
      ready: false,
      alienDir: 1,
      alienSpeed: 55,
      alienStepTimer: 0,
      alienShootTimer: 1.5
    };

    let raf = 0, t0 = 0;

    function beginGame(){
      if (st.ready || st.over) return;
      st.ready = true;
      audio?.play('start');
    }

    function spawnExplosion(x, y, color){
      for (let i = 0; i < 10; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = Math.random() * 120 + 30;
        particles.push({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0.35,
          color
        });
      }
    }

    function shootLaser(pIndex){
      const p = pStates[pIndex];
      if (!p || p.lives <= 0 || p.cooldown > 0) return;
      p.cooldown = 0.28;
      playerLasers.push({
        x: p.x + SHIP_W / 2 - 2,
        y: p.y - 8,
        w: 4,
        h: 12,
        vy: -550,
        owner: pIndex,
        color: p.color
      });
      const pan = clamp((p.x - W / 2) / (W / 2), -1, 1);
      audio?.play('shoot', {pan, volume: 0.6});
    }

    function step(dt){
      // Perbarui bintang latar belakang
      stars.forEach(s => {
        s.y += s.v * dt;
        if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
      });

      // Perbarui posisi pemain
      pStates.forEach(p => {
        if (p.lives <= 0) return;
        p.x = clamp(p.x + p.dir * 360 * dt, 15, W - SHIP_W - 15);
        if (p.cooldown > 0) p.cooldown -= dt;
        if (p.invulnerable > 0) p.invulnerable -= dt;
      });

      // Partikel ledakan
      particles.forEach(pt => {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.life -= dt;
      });
      particles = particles.filter(pt => pt.life > 0);

      // Selama belum menekan siap/start, alien dan proyektil tidak aktif
      if (!st.ready || st.over) return;

      // Hitung alien yang masih hidup
      const livingAliens = aliens.filter(a => a.alive);
      if (livingAliens.length === 0) {
        st.over = true;
        audio?.play('win');
        finish(solo ? 'Kamu Menang! Bumi Selamat!' : 'Kemenangan Bersama! Bumi Selamat!');
        return;
      }

      // Pergerakan kawanan alien (semakin sedikit semakin cepat)
      const speedMult = 1 + (aliens.length - livingAliens.length) * 0.055;
      st.alienSpeed = 55 * speedMult;

      let hitWall = false;
      livingAliens.forEach(a => {
        a.x += st.alienDir * st.alienSpeed * dt;
        if (a.x < 15 || a.x + a.w > W - 15) hitWall = true;
      });

      if (hitWall) {
        st.alienDir = -st.alienDir;
        livingAliens.forEach(a => {
          a.y += 18;
          // Alien menyentuh garis pertahanan bumi
          if (a.y + a.h >= H - 80) {
            st.over = true;
            audio?.play('lose');
            finish('Game Over! Alien Menginvasi Bumi');
          }
        });
      }

      // Tembakan alien
      st.alienShootTimer -= dt;
      if (st.alienShootTimer <= 0) {
        st.alienShootTimer = Math.max(0.6, 1.8 / speedMult);
        const shooter = livingAliens[Math.floor(Math.random() * livingAliens.length)];
        if (shooter) {
          alienLasers.push({
            x: shooter.x + shooter.w / 2 - 2,
            y: shooter.y + shooter.h,
            w: 4,
            h: 10,
            vy: 290
          });
        }
      }

      // Gerak laser pemain
      playerLasers.forEach(l => { l.y += l.vy * dt; });
      playerLasers = playerLasers.filter(l => l.y > -20);

      // Gerak laser alien
      alienLasers.forEach(l => { l.y += l.vy * dt; });
      alienLasers = alienLasers.filter(l => l.y < H + 20);

      // Tabrakan: Laser Pemain vs Alien
      playerLasers.forEach((l, lIdx) => {
        livingAliens.forEach(a => {
          if (!a.alive) return;
          if (l.x < a.x + a.w && l.x + l.w > a.x && l.y < a.y + a.h && l.y + l.h > a.y) {
            a.alive = false;
            l.y = -999; // Hapus laser
            pStates[l.owner].score += a.pts;
            spawnExplosion(a.x + a.w / 2, a.y + a.h / 2, a.color);
            const pan = clamp((a.x - W / 2) / (W / 2), -1, 1);
            audio?.play('explode', {pan, volume: 0.8});
          }
        });

        // Laser Pemain vs Bunker
        bunkers.forEach(bk => {
          if (bk.hp <= 0) return;
          if (l.x < bk.x + bk.w && l.x + l.w > bk.x && l.y < bk.y + bk.h && l.y + l.h > bk.y) {
            bk.hp--;
            l.y = -999;
          }
        });
      });

      // Tabrakan: Laser Alien vs Bunker
      alienLasers.forEach(al => {
        bunkers.forEach(bk => {
          if (bk.hp <= 0) return;
          if (al.x < bk.x + bk.w && al.x + al.w > bk.x && al.y < bk.y + bk.h && al.y + al.h > bk.y) {
            bk.hp--;
            al.y = H + 999;
          }
        });

        // Tabrakan: Laser Alien vs Pesawat Pemain
        pStates.forEach((p, pIdx) => {
          if (p.lives <= 0 || p.invulnerable > 0) return;
          if (al.x < p.x + SHIP_W && al.x + al.w > p.x && al.y < p.y + SHIP_H && al.y + al.h > p.y) {
            al.y = H + 999;
            p.lives--;
            p.invulnerable = 1.8;
            spawnExplosion(p.x + SHIP_W / 2, p.y + SHIP_H / 2, p.color);
            const pan = clamp((p.x - W / 2) / (W / 2), -1, 1);
            audio?.play('hurt', {pan});

            // Jika semua pemain gugur
            if (pStates.every(player => player.lives <= 0)) {
              st.over = true;
              audio?.play('lose');
              finish('Game Over! Semua Pesawat Gugur');
            }
          }
        });
      });
    }

    function draw(){
      // Latar belakang angkasa luar
      ctx.fillStyle = '#0a0d16';
      ctx.fillRect(0, 0, W, H);

      // Gambar bintang
      ctx.fillStyle = '#ffffff';
      stars.forEach(s => {
        ctx.fillRect(s.x, s.y, s.s, s.s);
      });

      // Garis batas pertahanan bawah
      ctx.strokeStyle = 'rgba(255, 60, 60, 0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(0, H - 75);
      ctx.lineTo(W, H - 75);
      ctx.stroke();
      ctx.setLineDash([]);

      // Gambar bunker pelindung
      bunkers.forEach(bk => {
        if (bk.hp <= 0) return;
        const opacity = bk.hp / 12;
        ctx.fillStyle = `rgba(0, 230, 118, ${opacity * 0.85 + 0.15})`;
        ctx.fillRect(bk.x, bk.y, bk.w, bk.h);
        ctx.fillStyle = '#0a0d16';
        ctx.fillRect(bk.x + bk.w * 0.25, bk.y + bk.h * 0.65, bk.w * 0.5, bk.h * 0.35); // Lengkungan pintu bunker
      });

      // Gambar alien
      aliens.forEach(a => {
        if (!a.alive) return;
        ctx.fillStyle = a.color;
        // Badan utama alien
        ctx.fillRect(a.x + 4, a.y + 4, a.w - 8, a.h - 8);
        // Antena / capit
        ctx.fillRect(a.x, a.y, 4, 8);
        ctx.fillRect(a.x + a.w - 4, a.y, 4, 8);
        ctx.fillRect(a.x + 2, a.y + a.h - 4, 6, 4);
        ctx.fillRect(a.x + a.w - 8, a.y + a.h - 4, 6, 4);
        // Mata
        ctx.fillStyle = '#0a0d16';
        ctx.fillRect(a.x + 8, a.y + 8, 4, 4);
        ctx.fillRect(a.x + a.w - 12, a.y + 8, 4, 4);
      });

      // Gambar partikel
      particles.forEach(pt => {
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x, pt.y, 3, 3);
      });

      // Gambar laser pemain
      playerLasers.forEach(l => {
        ctx.fillStyle = l.color;
        ctx.fillRect(l.x, l.y, l.w, l.h);
      });

      // Gambar laser alien
      ctx.fillStyle = '#ff3366';
      alienLasers.forEach(l => {
        ctx.fillRect(l.x, l.y, l.w, l.h);
      });

      // Gambar pesawat pemain
      pStates.forEach((p, idx) => {
        if (p.lives <= 0) return;
        if (p.invulnerable > 0 && Math.floor(Date.now() / 80) % 2 === 0) return; // Efek kedip kebal

        ctx.fillStyle = p.color;
        // Bodi pesawat
        ctx.fillRect(p.x + SHIP_W / 2 - 3, p.y, 6, 8);
        ctx.fillRect(p.x + 6, p.y + 8, SHIP_W - 12, 8);
        ctx.fillRect(p.x, p.y + 16, SHIP_W, 6);

        // Sayap & kokpit
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(p.x + SHIP_W / 2 - 2, p.y + 7, 4, 4);
      });

      // HUD / Skor & Nyawa di bagian atas
      ctx.font = '600 18px Fredoka, system-ui, sans-serif';
      pStates.forEach((p, idx) => {
        const xPos = idx === 0 ? 25 : W - 25;
        ctx.textAlign = idx === 0 ? 'left' : 'right';
        ctx.fillStyle = p.color;
        ctx.fillText(`P${idx + 1}: ${p.score} pts`, xPos, 34);

        // Nyawa (indikator kotak/hati)
        const heartStr = '❤️'.repeat(Math.max(0, p.lives));
        ctx.font = '14px Fredoka, system-ui, sans-serif';
        ctx.fillText(heartStr || 'GUGUR', xPos, 54);
        ctx.font = '600 18px Fredoka, system-ui, sans-serif';
      });

      // Banner Menunggu Aba-aba Mulai (Ready State)
      if (!st.ready) {
        const bx = 40, by = H / 2 - 95, bw = W - 80, bh = 190;
        ctx.save();
        ctx.fillStyle = 'rgba(16, 24, 38, 0.94)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = '#00e676';
        ctx.lineWidth = 3;
        ctx.strokeRect(bx, by, bw, bh);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.font = '700 28px Fredoka, system-ui, sans-serif';
        ctx.fillText('SPACE INVADERS', W / 2, H / 2 - 42);

        ctx.fillStyle = '#ffd600';
        ctx.font = '600 20px Fredoka, system-ui, sans-serif';
        ctx.fillText('Kirim perintah 99# dari Player 1', W / 2, H / 2 + 2);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.font = '500 16px Fredoka, system-ui, sans-serif';
        ctx.fillText('(atau klik layar untuk mulai)', W / 2, H / 2 + 45);
        ctx.restore();
      }
    }

    function loop(t){
      const dt = Math.min(0.05, (t - t0) / 1000);
      t0 = t;
      step(dt);
      draw();
      raf = requestAnimationFrame(loop);
    }

    // Penanganan input dari kernel
    const off = kernel.on('input', ({player, cmd}) => {
      // Perintah 99# atau 5# dari Player 1 memulai game
      if (!st.ready && player === players[0] && cmd === '99') {
        beginGame();
        return;
      }

      const pIdx = slotToPlayer[player];
      if (pIdx === undefined) return;
      const p = pStates[pIdx];

      // Gerak: 1/3 = kiri, 2/4 = kanan, 0 = berhenti
      if (cmd === '1' || cmd === '3') p.dir = -1;
      else if (cmd === '2' || cmd === '4') p.dir = 1;
      else if (cmd === '0') p.dir = 0;

      // Aksi tembak: 5# (atau tombol aksi keyboard)
      if (cmd === '5' && st.ready) {
        shootLaser(pIdx);
      }
    });

    const onCanvasClick = () => {
      if (!st.ready) beginGame();
      else shootLaser(0);
    };
    canvas.addEventListener('click', onCanvasClick);

    t0 = performance.now();
    raf = requestAnimationFrame(loop);

    return {
      stop(){
        cancelAnimationFrame(raf);
        off();
        canvas.removeEventListener('click', onCanvasClick);
      }
    };
  }
};

