# Game micro:bit — ROBOPANDA Robotic

Platform media pembelajaran koding dan robotika interaktif dari **ROBOPANDA Robotic**.
Web app untuk bermain game di browser dengan micro:bit sebagai controller nirkabel (Web Bluetooth, Nordic UART).
Arsitekturnya **satu kernel, banyak game**: micro:bit disambung sekali di lobi, lalu pemain berpindah game tanpa menyambung ulang.
Dirancang khusus untuk **layar landscape**: Panel Interaktif Digital (PID) sekolah, laptop, dan tablet.

> Dokumentasi arsitektur & rencana pengembangan lengkap ada di folder `plan/` (ikhtisar: `plan/README.md`; arsitektur shell & UI: `plan/02-shell-and-ui.md`; sistem game: `plan/03-game-system.md`; indeks katalog: `plan/06-games-catalog.md`).

## Struktur

```
index.html            halaman utama, panggung stage overlay, dan laci monitor masukan
core/kernel.js        koneksi BLE, slot pemain, keyboard, kejadian input (tanpa kode game)
core/audio.js         layanan efek suara bersama berbasis Web Audio API (disintesis)
shell/app.js          manajemen layar, orientasi landscape, overlay kontrol, dan laci monitor
shell/monitor.js      panel monitor masukan log (RX, TX, perintah, peringatan)
games/index.js        daftar katalog game
games/pingpong.js     game Ping Pong (1P & 2P)
games/spaceinvaders.js game Space Invaders (1P Solo & 2P Co-op)
games/tankbattle.js   game Tank Battle (1P vs AI, 1v1, 2v2 & 4P FFA)
games/endlessracer.js game Endless Racer (1P – 4P)
games/dinorush.js     game Dino Jump (1P – 4P, landscape 16:9)
games/flappybird.js   game Flappy Bird (1P – 4P, arena bersama)
games/maze.js         game Maze Race (1P – 4P, labirin simetris 4-sudut 3 ronde)
games/catchstar.js    game Tangkap Bintang (1P, 2P, 4P, tangkap bintang jatuh 3 level)
games/sumoarena.js    game Sumo Arena (1P vs AI, 2P, 4P, aksi adu dorong panggung mengecil)
games/tugofwar.js     game Tarik Tambang (1P vs AI, 2P, 4P, adu kekuatan & koordinasi tim)
games/hillclimb.js    game Hill Climbing (1P, 2P, 4P, balap daki bukit & hemat bensin)
games/cacingrakus.js  game Cacing Rakus (1P, 2P, 4P, multiplayer snake grid 40x40)
games/pecahbalok.js   game Pecah Balok (1P, 2P, 4P, arkanoid breakout retro)
games/kejarlabirin.js game Kejar Labirin (1P, 2P, 4P, pac-man multiplayer retro)
games/bomberman.js    game Bomberman (1P, 2P, 4P, arena ledak multiplayer retro)
games/petualangkoin.js game Petualang Koin (1P, 2P, 4P, super bros platformer retro)
styles/app.css        gaya antarmuka, tata letak layar lebar, dan kontrol sentuh
```

## Menjalankan

File memakai ES modules, jadi harus dijalankan lewat server (bukan dibuka langsung dengan klik dua kali).

```
cd microbit-games
python3 -m http.server 8000
```

Buka `http://localhost:8000` di **Chrome atau Edge**. Web Bluetooth hanya jalan di HTTPS atau `localhost`.
Untuk dipakai di kelas, taruh folder ini di hosting statis HTTPS (misalnya GitHub Pages atau domain sendiri).
Safari dan iPhone tidak mendukung Web Bluetooth (keyboard tetap bisa dipakai).

## Standar Layar & Kontrak Game

- **Standar Kanvas**: `1280 × 720 px (16:9 Landscape)`.
- **Game dengan resolusi berbeda**: Tetap berjalan normal (tampil dengan *letterbox* di arena panggung hitam).
- **Kontrol Panggung (.stage)**:
  - Pojok kiri atas: Tombol Keluar (`#quit`).
  - Pojok kanan atas: Tombol Monitor masukan (`#mon`), Suara (`#snd`), dan Layar penuh (`#fs`).
  - Laci monitor: Membuka panel log dari sisi kanan layar game tanpa mendorong kanvas.
- **Area Aman HUD**: Beri jarak minimal 40 px dari pojok atas kanvas agar elemen skor/status tidak tertutup tombol kontrol platform.

## Perintah dari micro:bit

Format: angka lalu `#` (mis. `3#`). Tombol atau gerakan micro:bit yang mengirim tiap angka diatur di MakeCode.
Daftar angkanya milik kernel (`0#` sampai `9#`), tetapi **artinya milik tiap game**.

| Perintah | Arti di Ping Pong | Arti di Space Invaders | Arti di Tank Battle | Arti di Endless Racer | Arti di Dino Jump | Arti di Flappy Bird | Arti di Maze Race | Arti di Tangkap Bintang | Arti di Sumo Arena | Arti di Tarik Tambang | Arti di Hill Climbing | Arti di Cacing Rakus | Arti di Pecah Balok | Arti di Kejar Labirin | Arti di Bomberman | Arti di Petualang Koin |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `99#` | mulai permainan | mulai permainan | mulai permainan | mulai permainan | mulai permainan | mulai permainan (Player 1) | mulai permainan (Player 1) | mulai permainan (Player 1) | mulai permainan (Player 1) | mulai permainan (Player 1) | mulai permainan (Player 1) | mulai permainan (Player 1) | mulai permainan (Player 1) | mulai permainan (Player 1) | mulai permainan (Player 1) | mulai permainan (Player 1) |
| `0#` | berhenti | berhenti | berhenti | berhenti | netral / tidak ada aksi | diabaikan | robot berhenti di tempat | keranjang berhenti | berhenti dorong (meluncur) | diabaikan | lepas gas (netral/meluncur) | netral (diabaikan) | paddle berhenti di tempat | pac-man jalan terus (arah terakhir) | karakter berhenti di tempat | berhenti lari (deselerasi halus) |
| `1#` | paddle ke kiri | pesawat ke kiri | tank maju (atas) | geser ke kiri | lompat | diabaikan | robot bergerak ke atas | keranjang geser ke kiri | dorong ke atas | tarik tali (1 tarikan) | gas (akselerasi) | belok ke atas | diabaikan | belok / bergerak ke atas | bergerak ke atas | melompat (air momentum lock) |
| `2#` | paddle ke kanan | pesawat ke kanan | tank mundur (bawah) | geser ke kanan | lompat | diabaikan | robot bergerak ke bawah | keranjang geser ke kanan | dorong ke bawah | tarik tali (1 tarikan) | rem / mundur | belok ke bawah | diabaikan | belok / bergerak ke bawah | bergerak ke bawah | menunduk / masuk pipa warp |
| `3#` | paddle ke kiri | pesawat ke kiri | tank belok kiri | geser ke kiri | lompat | terbang (flap) | robot belok ke kiri | keranjang geser ke kiri | dorong ke kiri | tarik tali (1 tarikan) | rem / mundur | belok ke kiri | paddle miring ke kiri | belok / bergerak ke kiri | bergerak ke kiri | berlari ke kiri |
| `4#` | paddle ke kanan | pesawat ke kanan | tank belok kanan | geser ke kanan | lompat | terbang (flap) | robot belok ke kanan | keranjang geser ke kanan | dorong ke kanan | tarik tali (1 tarikan) | gas (akselerasi) | belok ke kanan | paddle miring ke kanan | belok / bergerak ke kanan | bergerak ke kanan | berlari ke kanan |
| `5#` | diabaikan | menembak laser | tembak peluru | diabaikan | lompat | terbang (flap) | alternatif mulai (Player 1) | diabaikan | dorongan kuat (dash) | tarik tali (1 tarikan) | gas (akselerasi) | diabaikan | alternatif mulai (Player 1) | alternatif mulai (Player 1) | letakkan bom | alternatif lompat / pecah gelembung |
| lainnya | diabaikan | diabaikan | diabaikan | diabaikan | lompat | diabaikan | diabaikan | diabaikan | diabaikan | diabaikan | diabaikan | diabaikan | diabaikan | diabaikan | diabaikan | diabaikan |

Klik layar kanvas juga berfungsi untuk memulai permainan di semua game.

## Efek suara (Web Audio API)

Semua efek suara dibuat langsung di browser dengan Web Audio API melalui `core/audio.js` (disintesis, tanpa file audio).

## Keyboard (untuk testing)

- Satu slot keyboard: panah **atau** WASD.
- Dua slot keyboard: Player 1 panah, Player 2 WASD.
- Pemetaan tombol:
  - Tombol dilepas = `0` (netral/berhenti).
  - Arah: Atas atau W = `1`, bawah atau S = `2`, kiri atau A = `3`, kanan atau D = `4`.
  - Aksi Player 1 (Panah): `Enter` atau `L` = `5`, `/` atau `K` = `6`, `.` atau `J` = `7`, `,` = `8`, `M` = `9`.
  - Aksi Player 2 (WASD): `Spasi` atau `C` = `5`, `E` atau `V` = `6`, `Q` = `7`, `F` = `8`, `R` = `9`.

## Menambah game baru

1. Buat `games/namagame.js` dengan `export default { ... }` mengikuti kontrak di bawah.
2. Impor di `games/index.js` dan tambahkan ke array `games`.

```js
export default {
  id: 'contoh',
  name: 'Contoh',
  icon: '🎮',
  description: 'Penjelasan singkat.',
  modes: [{id: '1p', label: '1 Player', sub: 'Lawan komputer', players: 1}],
  canvas: {width: 1280, height: 720}, // Standar platform 16:9
  create({canvas, kernel, players, mode, finish, audio}){
    canvas.width = 1280;
    canvas.height = 720;
    const off = kernel.on('input', ({player, cmd}) => { /* input pemain */ });
    return { stop(){ off(); } };
  }
};
```
