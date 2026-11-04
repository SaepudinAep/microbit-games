// GAME: Dino Jump (mirip dino saat kehilangan koneksi — endless runner)
// Tiap pemain punya lintasan/jalur sendiri (1-4) agar posisinya tertib.
//
// Kontrak game:
//   id, name, icon, description
//   modes: [{id, label, sub, players}]
//   canvas: {width, height}
//   create({canvas, kernel, players, mode, finish, audio}) -> {stop()}
//
// Kontrol (via kernel.js):
//   tombol apa pun (1#-9#) = lompat   0# = netral   99# = mulai game (Player 1)
//
// Menang: bertahan paling lama (jarak terjauh). Mekanisme per-lintasan:
// lompati rintangan kaktus untuk bertahan.

const W = 600, H = 800;
const DINO_W = 44, DINO_H = 50;
const GRAV = 1500, JUMP_V = -620;
const BASE_SPEED = 220, ACCEL = 9, MAX_SPEED = 640;
const OBS_START = 1.1, OBS_MIN = 0.55;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default {
  id: 'dinorush',
  name: 'Dino Jump',
  icon: '🦖',
  description: 'Lompati rintangan seperti dino saat koneksi hilang! Tiap pemain punya lintasan sendiri; bertahan paling lama menang (s.d. 4 pemain).',
  modes: [
    {id: '1p', label: '1 Player',  sub: 'Bertahan Sendiri',     players: 1},
    {id: '2p', label: '2 Player',  sub: 'Dua Lintasan Sejajar', players: 2},
    {id: '3p', label: '3 Player',  sub: 'Tiga Lintasan',        players: 3},
    {id: '4p', label: '4 Player',  sub: 'Empat Lintasan',       players: 4},
  ],
  canvas: {width: W, height: H},

  create({canvas, kernel, players, mode, finish, audio}) {
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const n = players.length;
    const L = H / n;            // tinggi tiap lintasan
    const MIDX = 96;            // posisi dino (sumbu X tetap)
    const PCOLORS = ['#4b83ff', '#ff9a2e', '#3ccf8e', '#b98cff'];

    const slotToP = {};
    players.forEach((s, i) => { slotToP[s] = i; });
    const st = {ready: false, over: false};

    // Tiap pemain punya lintasan sendiri
    const lanes = players.map((slot, i) => {
      const gy = (i + 1) * L - 34;    // garis tanah lintasan
      return {
        i, slot, gy,
        alive: true,
        air: false,       // sedang melompat?
        h: 0,             // ketinggian di atas tanah (px)
        vy: 0,
        dist: 0,          // jarak / skor
        speed: BASE_SPEED,
        obs: [],          // rintangan
        spawn: OBS_START + i * 0.1,
        color: PCOLORS[i % 4],
        label: `P${i + 1}`,
      };
    });

    function startJump(ln) {
      if (ln.alive && !ln.air) { ln.air = true; ln.vy = JUMP_V; audio?.play('click'); }
    }

    function spawnObs(ln) {
      const oh = [26, 34, 30, 22][(Math.random() * 4) | 0];
      ln.obs.push({kind: 0, x: W + 20, y: ln.gy - oh, w: 18, h: oh});
    }

    function collide(ln, o) {
      const dH = DINO_H;
      const d = 6, px = MIDX - DINO_W / 2 + d, pw = DINO_W - 2 * d;
      const py = ln.gy - dH - ln.h + d, ph = dH - 2 * d;
      return px < o.x + o.w && px + pw > o.x && py < o.y + o.h && py + ph > o.y;
    }

    function die(ln) {
      if (!ln.alive) return;
      ln.alive = false;
      audio?.play('lose');
      if (lanes.every(l => !l.alive) && !st.over) checkWin();
    }

    function checkWin() {
      st.over = true;
      if (n === 1) {
        finish(`Bertahan ${lanes[0].dist.toFixed(1)} meter! 🦖`);
      } else {
        const best = lanes.reduce((a, b) => a.dist >= b.dist ? a : b);
        const tie = lanes.every(l => Math.abs(l.dist - best.dist) < 5);
        finish(tie ? `Seri! Semua ${best.dist.toFixed(1)} m` : `${best.label} Menang! (${best.dist.toFixed(1)} m)`);
      }
    }

    function step(dt) {
      lanes.forEach(ln => {
        // Fisika lompat — selalu dijalankan agar 5# langsung memberi respons visual
        if (ln.air) {
          ln.h += ln.vy * dt;
          ln.vy += GRAV * dt;
          if (ln.h <= 0) { ln.h = 0; ln.vy = 0; ln.air = false; }
        }
        if (!st.ready) return;   // sebelum mulai: belum ada jarak/rintangan
        if (!ln.alive) return;

        ln.dist += ln.speed * dt;
        ln.speed = clamp(ln.speed + ACCEL * dt, BASE_SPEED, MAX_SPEED);

        // Spawn rintangan
        ln.spawn -= dt;
        if (ln.spawn <= 0) {
          spawnObs(ln);
          ln.spawn = clamp((0.55 + Math.random() * 0.6) * (1.15 - (ln.speed / MAX_SPEED) * 0.45), OBS_MIN, 1.5);
        }

        // Gerak & tabrak rintangan
        for (let k = ln.obs.length - 1; k >= 0; k--) {
          const o = ln.obs[k];
          o.x -= ln.speed * dt * (o.sp || 1);
          if (o.x + o.w < -24) ln.obs.splice(k, 1);
          else if (collide(ln, o)) {
            die(ln);
            ln.obs.splice(k, 1);
          }
        }
      });
    }

    let frameId = null, lastTime = null;

    function loop(ts) {
      if (lastTime == null) lastTime = ts;
      const dt = Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;
      if (!st.over) step(dt);   // step menangani sendiri pembatas mulai (st.ready)
      draw();
      frameId = requestAnimationFrame(loop);
    }

    // Mulai permainan
    function beginGame() {
      if (st.ready) return;
      st.ready = true;
      audio?.play('start');
    }

    // Input: tombol apa pun (1#-9# selain 99) = lompat, 0# = netral, 99# = mulai
    const off = kernel.on('input', ({player, cmd}) => {
      const li = slotToP[player];
      if (st.over) return;

      // Mulai game: hanya dengan 99# dari siapa pun (klik layar juga memulai)
      if (!st.ready && cmd === '99') beginGame();

      if (li === undefined) return;
      const ln = lanes[li];
      if (!ln.alive) return;

      // Lompat: tombol apa pun (1#-9# termasuk 5#) kecuali 0#/99# — aktif juga saat baru mulai
      if (cmd !== '0' && cmd !== '99') startJump(ln);
    });

    const onCanvasClick = () => { if (!st.ready) beginGame(); };
    canvas.addEventListener('click', onCanvasClick);

    // --- Gambar ---
    function drawDino(ln) {
      const dH = DINO_H;
      const y = ln.gy - dH - ln.h;
      const x = MIDX - DINO_W / 2;
      // kaki (berlari)
      ctx.fillStyle = ln.color;
      if (!ln.air) {
        const lift = Math.floor(Date.now() / 110) % 2 ? 0 : 4;
        ctx.fillRect(x + 4, y + dH - lift, 8, lift);
        ctx.fillRect(x + DINO_W - 12, y + dH - (4 - lift), 8, 4 - lift);
      }
      // badan + kepala
      ctx.fillStyle = ln.color;
      ctx.fillRect(x, y + 8, DINO_W, dH - 8);
      ctx.fillRect(x + DINO_W / 2 - 4, y, DINO_W / 2 + 4, 10);
      // mata
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + DINO_W - 9, y + 4, 5, 5);
      ctx.fillStyle = '#111';
      ctx.fillRect(x + DINO_W - 8, y + 5, 2, 3);
      // ekor
      ctx.fillRect(x - 6, y + 12, 6, 5);
    }

    function drawObs(ln) {
      ln.obs.forEach(o => {
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillRect(o.x - 5, o.y + 4, 5, 7);
        ctx.fillRect(o.x + o.w, o.y + 2, 5, 9);
      });
    }

    function draw() {
      ctx.fillStyle = '#101826'; ctx.fillRect(0, 0, W, H);
      lanes.forEach((ln, i) => {
        const top = i * L;
        // garis tanah
        ctx.strokeStyle = 'rgba(255,255,255,.18)';
        ctx.beginPath(); ctx.moveTo(0, ln.gy); ctx.lineTo(W, ln.gy); ctx.stroke();
        // tanda gulir tanah
        ctx.fillStyle = 'rgba(255,255,255,.25)';
        const off = ln.dist % 34;
        for (let gx = -off; gx < W; gx += 34) ctx.fillRect(gx, ln.gy + 4, 20, 4);
        // label + jarak
        ctx.fillStyle = ln.color; ctx.font = '700 16px Fredoka, sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(`${ln.label}  ${ln.dist.toFixed(0)}m`, 12, top + 22);
        drawObs(ln);
        if (ln.alive) drawDino(ln);
        else { ctx.fillStyle = '#555'; ctx.font = '700 15px Fredoka, sans-serif'; ctx.fillText('✖ mati', MIDX - 22, ln.gy - 26); }
      });

      // Banner siap
      if (!st.ready) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, H/2 - 80, W, 160);
        ctx.textAlign = 'center';
        ctx.font = 'bold 30px Fredoka, sans-serif'; ctx.fillStyle = '#fff';
        ctx.fillText('🦖 Dino Jump', W/2, H/2 - 38);
        ctx.font = '17px Fredoka, sans-serif'; ctx.fillStyle = '#aaa';
        ctx.fillText('Kirim  99#  dari Player 1', W/2, H/2 + 2);
        ctx.fillText('atau klik layar untuk mulai', W/2, H/2 + 30);
        ctx.font = '13px Fredoka, sans-serif'; ctx.fillStyle = '#6af';
        ctx.fillText('Tombol apa pun = lompat', W/2, H/2 + 58);
        ctx.restore();
      }
    }

    frameId = requestAnimationFrame(loop);

    return {
      stop() {
        cancelAnimationFrame(frameId);
        off();
        canvas.removeEventListener('click', onCanvasClick);
      }
    };
  }
};