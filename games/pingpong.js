// GAME: Ping Pong (Player 1 di bawah, Player 2 atau komputer di atas; paddle bergerak kiri dan kanan).
//
// Kontrak game (dibaca oleh shell):
//   id, name, description
//   modes: [{id, label, sub, players}]    players = jumlah pemain yang dibutuhkan mode itu
//   canvas: {width, height}
//   create({canvas, kernel, players, mode, finish, audio}) -> {stop()}
//     players = nomor slot pemain, urut (indeks 0 = pemain pertama)
//     finish(teks) dipanggil saat game selesai (shell menampilkan pemenang dan tombol ke lobi)

const W = 600, H = 800;          // arena tinggi (3:4)
const PW = 110, PH = 16;         // panjang dan tebal paddle
const EDGE = 44, R = 9, WIN = 5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Preset kecepatan bola
const SPEED_PRESETS = {
  slow:   { base: 280, maxVy: 560, maxVx: 400, ai: 185 },
  normal: { base: 380, maxVy: 760, maxVx: 520, ai: 250 },
  fast:   { base: 480, maxVy: 960, maxVx: 640, ai: 320 }
};

export default {
  id: 'pingpong',
  name: 'Ping Pong',
  icon: '🏓',
  description: 'Pantulkan bola dan cetak poin. Pemain bawah melawan pemain atas. Yang pertama mencapai 5 poin menang.',
  modes: [
    {id: '1p', label: '1 Player', sub: 'Lawan komputer', players: 1},
    {id: '2p', label: '2 Player', sub: 'Dua pemain berhadapan', players: 2}
  ],
  canvas: {width: W, height: H},

  create({canvas, kernel, players, mode, finish, audio}){
    canvas.width = W; canvas.height = H;
    const x = canvas.getContext('2d');
    const solo = mode.players === 1;

    // Ambil preferensi kecepatan in-game yang tersimpan di localStorage (default: normal)
    const SPEED_KEYS = ['slow', 'normal', 'fast'];
    let currentSpeedKey = 'normal';
    try {
      const saved = localStorage.getItem('opt_pingpong_speed');
      if (saved && SPEED_PRESETS[saved]) currentSpeedKey = saved;
    } catch(_){}

    let baseSpeed = SPEED_PRESETS[currentSpeedKey].base;
    let maxVy = SPEED_PRESETS[currentSpeedKey].maxVy;
    let maxVx = SPEED_PRESETS[currentSpeedKey].maxVx;
    let aiSpeed = SPEED_PRESETS[currentSpeedKey].ai;

    function applySpeedPreset(key){
      if (!SPEED_PRESETS[key]) return;
      currentSpeedKey = key;
      baseSpeed = SPEED_PRESETS[key].base;
      maxVy = SPEED_PRESETS[key].maxVy;
      maxVx = SPEED_PRESETS[key].maxVx;
      aiSpeed = SPEED_PRESETS[key].ai;
    }

    // Tombol pemilihan kecepatan in-game di layar overlay siap
    const speedButtons = [
      { key: 'slow',   label: 'Lambat', x: 121,       y: H / 2 - 25, w: 110, h: 44 },
      { key: 'normal', label: 'Normal', x: 121 + 124, y: H / 2 - 25, w: 110, h: 44 },
      { key: 'fast',   label: 'Cepat',  x: 121 + 248, y: H / 2 - 25, w: 110, h: 44 }
    ];

    const slotToPaddle = {};
    players.forEach((n, i) => { slotToPaddle[n] = i; });
    const st = {over: false, ready: false, wait: 1, ball: {x: W / 2, y: H / 2, vx: 0, vy: 0},
      p: [{x: W / 2 - PW / 2, dir: 0, s: 0}, {x: W / 2 - PW / 2, dir: 0, s: 0}]};   // 0 = bawah, 1 = atas
    let raf = 0, t0 = 0;

    function beginGame(){
      if (st.ready || st.over) return;
      st.ready = true;
      audio?.play('start');
      serve(Math.random() < .5 ? -1 : 1);
    }

    function serve(dir){                         // dir: +1 ke bawah, -1 ke atas
      const a = (Math.random() - .5) * .8;
      st.ball = {x: W / 2, y: H / 2, vx: baseSpeed * Math.sin(a), vy: dir * baseSpeed};
      st.wait = 1;

      // Semua paddle wajib kembali ke posisi tengah setelah skor dicetak
      st.p[0].x = W / 2 - PW / 2;
      st.p[0].dir = 0;
      st.p[1].x = W / 2 - PW / 2;
      st.p[1].dir = 0;
    }
    function hit(b, p, i){
      b.vy = clamp(-b.vy * 1.06, -maxVy, maxVy);
      b.vx = clamp(b.vx + ((b.x - (p.x + PW / 2)) / (PW / 2)) * 220, -maxVx, maxVx);
      audio?.play('hit', {pan: clamp((b.x - W / 2) / (W / 2), -1, 1)});
    }
    function point(i){
      st.p[i].s++;
      if (st.p[i].s >= WIN) {
        st.over = true;
        if (solo) {
          audio?.play(i === 0 ? 'win' : 'lose');
          finish(i === 0 ? 'Kamu menang!' : 'Komputer menang');
        } else {
          audio?.play('win');
          finish('Player ' + (i + 1) + ' menang!');
        }
      } else {
        audio?.play('score');
        serve(i === 0 ? -1 : 1);                      // bola menuju pemain yang kebobolan & paddle kembali ke tengah
      }
    }
    function step(dt){
      if (st.over) return;
      const b = st.ball;
      st.p.forEach((p, i) => {
        if (i === 1 && solo) {                             // paddle komputer
          if (!st.ready) return;
          const c = p.x + PW / 2;
          const d = (b.vy < 0 && Math.abs(b.x - c) > 12) ? (b.x > c ? 1 : -1) : 0;
          p.x = clamp(p.x + d * aiSpeed * dt, 0, W - PW);
        } else p.x = clamp(p.x + p.dir * 420 * dt, 0, W - PW);
      });
      if (!st.ready) return;                               // bola menunggu aba-aba mulai dari Player 1
      if (st.wait > 0) { st.wait -= dt; return; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); audio?.play('bounce', {pan: -1}); }
      if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx); audio?.play('bounce', {pan: 1}); }
      const bot = st.p[0], top = st.p[1], yb = H - EDGE - PH, yt = EDGE + PH;
      if (b.vy > 0 && b.y + R > yb && b.y + R < yb + PH + 14 && b.x > bot.x - R && b.x < bot.x + PW + R) { b.y = yb - R; hit(b, bot, 0); }
      if (b.vy < 0 && b.y - R < yt && b.y - R > yt - PH - 14 && b.x > top.x - R && b.x < top.x + PW + R) { b.y = yt + R; hit(b, top, 1); }
      if (b.y < -R) point(0);
      else if (b.y > H + R) point(1);
    }
    function draw(){
      x.fillStyle = '#101826'; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 4; x.setLineDash([14, 14]);
      x.beginPath(); x.moveTo(0, H / 2); x.lineTo(W, H / 2); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#4b83ff'; x.fillRect(st.p[0].x, H - EDGE - PH, PW, PH);
      x.fillStyle = '#ff9a2e'; x.fillRect(st.p[1].x, EDGE, PW, PH);
      x.fillStyle = '#fff'; x.beginPath(); x.arc(st.ball.x, st.ball.y, R, 0, 7); x.fill();
      x.font = '700 56px Fredoka, system-ui, sans-serif'; x.textAlign = 'right';
      x.fillStyle = '#ff9a2e'; x.fillText(st.p[1].s, W - 24, H / 2 - 22);
      x.fillStyle = '#4b83ff'; x.fillText(st.p[0].s, W - 24, H / 2 + 66);
      x.font = '500 18px Fredoka, system-ui, sans-serif'; x.textAlign = 'center';
      x.fillStyle = 'rgba(255,255,255,.7)';
      x.fillText(solo ? 'Kamu' : 'Player 1', W / 2, H - 14);
      x.fillText(solo ? 'Komputer' : 'Player 2', W / 2, 30);

      // Indikator kecepatan bola aktif di garis tengah lapangan
      x.font = '600 15px Fredoka, system-ui, sans-serif';
      x.textAlign = 'left';
      x.fillStyle = 'rgba(255, 255, 255, 0.45)';
      const activeSpeedLabel = currentSpeedKey === 'slow' ? '⚡ Bola: Lambat' : currentSpeedKey === 'fast' ? '⚡ Bola: Cepat' : '⚡ Bola: Normal';
      x.fillText(activeSpeedLabel, 24, H / 2 - 14);

      // Tampilan overlay menunggu aba-aba Player 1 & Pemilihan Kecepatan Bola In-Game
      if (!st.ready) {
        const bx = 30, by = H / 2 - 135, bw = W - 60, bh = 270;
        x.save();
        x.fillStyle = 'rgba(16, 24, 38, 0.96)';
        x.fillRect(bx, by, bw, bh);
        x.strokeStyle = '#4b83ff';
        x.lineWidth = 3;
        x.strokeRect(bx, by, bw, bh);

        x.textAlign = 'center';
        x.fillStyle = '#fff';
        x.font = '700 28px Fredoka, system-ui, sans-serif';
        x.fillText('SIAP BERMAIN?', W / 2, H / 2 - 82);

        // Judul Pilihan Kecepatan
        x.font = '600 15px Fredoka, system-ui, sans-serif';
        x.fillStyle = '#94a3b8';
        x.fillText('PILIH KECEPATAN BOLA:', W / 2, H / 2 - 46);

        // Tombol-Tombol Kecepatan Bola In-Game
        speedButtons.forEach(btn => {
          const isActive = btn.key === currentSpeedKey;

          // Kotak Tombol
          x.fillStyle = isActive ? '#2f6df6' : 'rgba(255, 255, 255, 0.08)';
          x.beginPath();
          x.roundRect(btn.x, btn.y, btn.w, btn.h, 12);
          x.fill();

          // Border Tombol
          x.strokeStyle = isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.25)';
          x.lineWidth = isActive ? 2.5 : 1.5;
          x.stroke();

          // Teks Tombol
          x.fillStyle = isActive ? '#ffffff' : '#cbd5e1';
          x.font = isActive ? '700 17px Fredoka, system-ui, sans-serif' : '600 16px Fredoka, system-ui, sans-serif';
          x.textAlign = 'center';
          x.textBaseline = 'middle';
          x.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
        });

        x.textBaseline = 'alphabetic';
        x.fillStyle = '#ff9a2e';
        x.font = '600 20px Fredoka, system-ui, sans-serif';
        x.fillText('Kirim perintah 99# dari Player 1', W / 2, H / 2 + 58);

        x.fillStyle = 'rgba(255, 255, 255, 0.7)';
        x.font = '500 15px Fredoka, system-ui, sans-serif';
        x.fillText('(atau sentuh layar untuk mulai)', W / 2, H / 2 + 92);
        x.restore();
      }
    }
    function loop(t){
      const dt = Math.min(.05, (t - t0) / 1000); t0 = t;
      step(dt); draw();
      raf = requestAnimationFrame(loop);
    }

    // Masukan: 99 = mulai dari Player 1, 1 atau 3 = kiri, 2 atau 4 = kanan, 0 = berhenti.
    const off = kernel.on('input', ({player, cmd}) => {
      if (!st.ready) {
        if (player === players[0] && cmd === '99') {
          beginGame();
          return;
        }
        // Ganti opsi kecepatan via tombol arah micro:bit atau keyboard di layar standby
        if (cmd === '1' || cmd === '3') {
          const idx = SPEED_KEYS.indexOf(currentSpeedKey);
          if (idx > 0) {
            applySpeedPreset(SPEED_KEYS[idx - 1]);
            try { localStorage.setItem('opt_pingpong_speed', currentSpeedKey); } catch(_){}
            audio?.play('click');
          }
          return;
        }
        if (cmd === '2' || cmd === '4') {
          const idx = SPEED_KEYS.indexOf(currentSpeedKey);
          if (idx < SPEED_KEYS.length - 1) {
            applySpeedPreset(SPEED_KEYS[idx + 1]);
            try { localStorage.setItem('opt_pingpong_speed', currentSpeedKey); } catch(_){}
            audio?.play('click');
          }
          return;
        }
        return;
      }

      const i = slotToPaddle[player];
      if (i === undefined) return;
      if (cmd === '1' || cmd === '3') st.p[i].dir = -1;
      else if (cmd === '2' || cmd === '4') st.p[i].dir = 1;
      else if (cmd === '0') st.p[i].dir = 0;
    });

    const onCanvasClick = (e) => {
      if (st.ready) return;
      if (e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const cx = (e.clientX - rect.left) * scaleX;
        const cy = (e.clientY - rect.top) * scaleY;

        for (const btn of speedButtons) {
          if (cx >= btn.x && cx <= btn.x + btn.w && cy >= btn.y && cy <= btn.y + btn.h) {
            applySpeedPreset(btn.key);
            try { localStorage.setItem('opt_pingpong_speed', btn.key); } catch(_){}
            audio?.play('click');
            return; // Klik tombol kecepatan: hanya ganti kecepatan, jangan mulai game
          }
        }
      }
      beginGame();
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
