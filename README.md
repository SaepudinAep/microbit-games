# Game micro:bit

Web app untuk bermain game di browser dengan micro:bit sebagai controller (Web Bluetooth, Nordic UART).
Arsitekturnya **satu kernel, banyak game**: micro:bit disambung sekali di lobi, lalu pemain berpindah game tanpa menyambung ulang.

> Dokumentasi arsitektur & rencana pengembangan lengkap ada di folder `plan/` (ikhtisar: `plan/README.md`; indeks game: `plan/06-games-catalog.md`; dokumentasi **individual per game**: `plan/games/`).

## Struktur

```
index.html
core/kernel.js        koneksi BLE, slot pemain, keyboard, kejadian input (tidak tahu apa pun soal game)
core/audio.js         layanan efek suara bersama berbasis Web Audio API (disintesis)
shell/app.js          layar: Home, lobi koneksi, pilih game, game; hasil dan tombol ke lobi
shell/monitor.js      monitor masukan (RX, TX, perintah, peringatan)
games/index.js        daftar game
games/pingpong.js     game Ping Pong (1P & 2P)
games/spaceinvaders.js game Space Invaders (1P Solo & 2P Co-op)
games/tankbattle.js   game Tank Battle (1v1, 2v2 & 4P FFA)
games/endlessracer.js game Endless Racer (1P & 2P)
styles/app.css        gaya bersama
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

## Perintah dari micro:bit

Format: angka lalu `#` (mis. `3#`). Tombol atau gerakan micro:bit yang mengirim tiap angka diatur di MakeCode.
Daftar angkanya milik kernel (`0#` sampai `9#`), tetapi **artinya milik tiap game**.

| Perintah | Arti di Ping Pong | Arti di Space Invaders | Arti di Tank Battle | Arti di Endless Racer |
|---|---|---|---|---|
| `99#` | mulai permainan dari Player 1 | mulai permainan dari Player 1 | mulai permainan dari Player 1 | mulai permainan dari Player 1 |
| `0#` | berhenti | berhenti | berhenti | berhenti |
| `1#` | paddle ke kiri | pesawat ke kiri | tank maju (atas) | geser ke kiri |
| `2#` | paddle ke kanan | pesawat ke kanan | tank mundur (bawah) | geser ke kanan |
| `3#` | paddle ke kiri | pesawat ke kiri | tank belok kiri | geser ke kiri |
| `4#` | paddle ke kanan | pesawat ke kanan | tank belok kanan | geser ke kanan |
| `5#` | alternatif mulai | tembak laser (juga alternatif mulai) | tembak peluru | alternatif mulai |
| lainnya | diabaikan | diabaikan | diabaikan | diabaikan |

Kernel juga membaca baris berakhir newline, mis. `Mbit:3`, sebagai perintah `3`.

## Efek suara (Web Audio API)

Semua efek suara dibuat langsung di browser dengan Web Audio API melalui `core/audio.js` (disintesis, tanpa file audio). Firmware micro:bit **tidak perlu** menangani kode suara.

```js
import { Sound } from './core/audio.js';

Sound.unlock()                  // aktifkan/resume AudioContext (aman dipanggil berulang)
Sound.play(nama, opsi)          // mainkan efek suara. opsi: { pan: -1..1, volume: 0..1 }
Sound.setMuted(bool)            // bisukan atau nyalakan suara
Sound.isMuted()                 // cek apakah sedang dibisukan
Sound.setVolume(vol)            // atur volume master (0..1)
Sound.getVolume()               // dapatkan volume saat ini
Sound.onChange(fn)              // dipanggil saat status mute/volume berubah
```

Daftar nama efek suara yang tersedia:
- `click`: klik antarmuka (square 880 Hz, 40 ms)
- `bounce`: pantulan dinding (triangle 330 Hz, 60 ms)
- `hit`: pukulan paddle (square 520 Hz, 80 ms)
- `score`: poin tercetak (dua nada sine 440 Hz lalu 660 Hz, @120 ms)
- `win`: kemenangan (arpeggio square 523, 659, 784, 1047 Hz, @120 ms)
- `lose`: kekalahan (sawtooth meluncur 392 -> 196 Hz, 400 ms)
- `shoot`: tembakan peluru (square meluncur 880 -> 220 Hz, 120 ms)
- `explode`: ledakan (noise putih 250 ms + lowpass 1200 -> 200 Hz)
- `hurt`: terkena serangan (sawtooth meluncur 200 -> 80 Hz, 300 ms)
- `powerup`: bonus/daya (triangle meluncur 400 -> 1200 Hz, 200 ms)
- `start`: pembukaan game (tiga nada sine 440, 554, 659 Hz, @90 ms)

## Keyboard (untuk testing)

- Satu slot keyboard: panah **atau** WASD.
- Dua slot keyboard: Player 1 panah, Player 2 WASD.
- Pemetaan tombol:
  - Tombol dilepas = `0` (netral/berhenti).
  - Arah: Atas atau W = `1`, bawah atau S = `2`, kiri atau A = `3`, kanan atau D = `4`.
  - Aksi Player 1 (Panah): `Enter` atau `L` = `5`, `/` atau `K` = `6`, `.` atau `J` = `7`, `,` = `8`, `M` = `9`.
  - Aksi Player 2 (WASD): `Spasi` atau `C` = `5`, `E` atau `V` = `6`, `Q` = `7`, `F` = `8`, `R` = `9`.

## API kernel

```js
import { Kernel } from './core/kernel.js';

Kernel.on('input', ({player, cmd, source}) => {})   // perintah standar berlabel pemain; mengembalikan fungsi untuk berhenti berlangganan
Kernel.on('players', () => {})                      // slot berubah
Kernel.on('raw', ({player, text, bytes}) => {})     // data mentah dari micro:bit
Kernel.on('tx', ({player, text}) => {})             // kode yang dikirim ke micro:bit
Kernel.on('warn', teks => {})

Kernel.slots            // 4 slot: {n, type: null|'microbit'|'keyboard', name, scheme, last}
Kernel.filled()         // slot terisi (yang ditampilkan)
Kernel.addMicrobit(n)   // pilih dan sambung micro:bit ke slot n (harus dari klik pengguna)
Kernel.addKeyboard(n)   // isi slot n dengan keyboard
Kernel.release(n)       // lepas slot n
Kernel.send(n, kode)    // kirim "kode#" ke micro:bit di slot n (antrian, potongan 20 byte)
```

Catatan teknis: UUID TX/RX micro:bit terbalik dari standar Nordic, sehingga kernel memilih karakteristik berdasarkan propertinya (notify atau indicate untuk menerima, write untuk mengirim). Bila notifikasi gagal diaktifkan, slot tetap terisi dan hanya muncul peringatan.

## Menambah game baru

1. Buat `games/namagame.js` dengan `export default { ... }` mengikuti kontrak di bawah.
2. Impor di `games/index.js` dan tambahkan ke array `games`.

Shell otomatis menampilkan kartu game, dan tombol mode aktif sesuai jumlah pemain yang terhubung.

```js
export default {
  id: 'contoh',
  name: 'Contoh',
  description: 'Penjelasan singkat.',
  modes: [{id: '1p', label: '1 Player', sub: 'Lawan komputer', players: 1}],
  canvas: {width: 600, height: 800},
  create({canvas, kernel, players, mode, finish, audio}){
    // players = nomor slot pemain, urut (indeks 0 = pemain pertama)
    const off = kernel.on('input', ({player, cmd}) => { /* gerakkan pemain */ });
    // ... jalankan loop game; panggil finish('Player 1 menang!') saat selesai
    return { stop(){ off(); /* hentikan loop */ } };
  }
};
```

Aturan: antarmuka kernel ke game dijaga stabil; fitur baru ditambahkan tanpa mengubah yang lama.

## Batas yang sudah diketahui

- Batas pemain 4 per permainan (`MAX_PLAYERS`); stabilitas 3 sampai 4 micro:bit sekaligus perlu diuji di perangkat kelas.
- Tidak ada sambung ulang otomatis; slot yang terputus dihubungkan lagi di lobi.
- Game aktual saat ini: Ping Pong, Space Invaders, Tank Battle, dan Endless Racer — skema kontrol tiap game bisa berbeda, lihat `plan/06-games-catalog.md`.
