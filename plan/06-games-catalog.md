# Sektor 06: Indeks Katalog Game

Dokumen ini adalah **indeks/registry** game yang terdaftar di platform (`games/index.js`). Setiap game memiliki
**dokumentasi individual** di `plan/games/` (lihat kolom "Dokumentasi"). Semua game memenuhi *Game Contract*
(lihat `03-game-system.md`):
`{ id, name, icon, description, modes, canvas, create({canvas, kernel, players, mode, finish, audio}) -> {stop} }`.

## Daftar Game & Dokumentasi Individual

| # | `id` | Nama | Ikon | Mode | File game | Dokumentasi |
|---|------|------|:---:|------|-----------|-------------|
| 1 | `pingpong` | Ping Pong | 🏓 | 1P, 2P | `games/pingpong.js` | [plan/games/pingpong.md](games/pingpong.md) |
| 2 | `spaceinvaders` | Space Invaders | 👾 | 1P, 2P (Co-op) | `games/spaceinvaders.js` | [plan/games/spaceinvaders.md](games/spaceinvaders.md) |
| 3 | `tankbattle` | Tank Battle | 🪖 | 1v1, 2v2, 4P FFA | `games/tankbattle.js` | [plan/games/tankbattle.md](games/tankbattle.md) |
| 4 | `endlessracer` | Endless Racer | 🚗 | 1P, 2P | `games/endlessracer.js` | [plan/games/endlessracer.md](games/endlessracer.md) |
| 5 | `dinorush` | Dino Jump | 🦖 | 1P – 4P | `games/dinorush.js` | [plan/games/dinorush.md](games/dinorush.md) |
| 6 | `flappybird` | Flappy Bird | 🐦 | 1P – 4P | `games/flappybird.js` | [plan/games/flappybird.md](games/flappybird.md) |

> **Konvensi umum** (lihat `01-core-kernel.md`): kernel meneruskan angka standar `0#`–`9#` + `99#` berlabel pemain;
> **arti angka bersifat milik tiap game** (*deterministic commands*). Semua game memakai ready-state: permainan
> dimulai saat Player 1 mengirim `99#` (atau `5#`), tombol Enter/Spasi, atau klik kanvas. Dino Jump memakai alur siap per-pemain tanpa `99#`.

> **Ringkasan gabungan** tiap game dijelaskan lebih lanjut pada bagian di bawah ini sebagai referensi cepat;
> sumber utama & terperinci ada di masing-masing file `plan/games/*.md`.

## 1. Ping Pong (`games/pingpong.js`)

Tenis meja klasik berorientasi vertikal (aspek 3:4, 600×800). Player 1 di bawah, Player 2 / komputer di atas.

| Aspek | Spesifikasi |
|---|---|
| **Mode** | `1p` = *Lawan komputer* (players 1); `2p` = *Dua pemain berhadapan* (players 2) |
| **Canva** | 600 × 800 |
| **Paddle** | Panjang 110 px, tebal 16 px, kecepatan gerak 420 px/dtk |
| **Bola** | Radius 9 px, kecepatan awal 380 px/dtk |
| **Poin kemenangan** | `WIN = 5` |
| **Posisi** | P1 (bawah): `y = H - EDGE - PH`; P2/AI (atas): `y = EDGE` |

**Kontrol:**

| Perintah | Aksi |
|---|---|
| `99#` | Mulai permainan (Player 1 saja) |
| `5#` | Alternatif mulai |
| `1#` / `3#` | Paddle ke kiri |
| `2#` / `4#` | Paddle ke kanan |
| `0#` | Paddle berhenti |

**Fisika & audio:**
- Pantulan paddle: `vy` dibalik dan dipercepat `* 1.06` (maks 760 px/dtk); `vx` dibelokkan sesuai titik tumbuk (maks 520 px/dtk).
- Mode 1P: paddle atas dikendalikan AI sederhana (mengejar posisi bola saat bola menuju ke atas).
- Efek suara: `start`, `bounce` (panning kiri/kanan), `hit` (dengan `pan`), `score`, `win`/`lose`.

---

## 2. Space Invaders (`games/spaceinvaders.js`)

Pemain di bawah menembak pasukan alien yang bergerak turun. Mendukung 1P (Solo) dan 2P (Co-op).

| Aspek | Spesifikasi |
|---|---|
| **Mode** | `1p` = *Misi Tempur Solo*; `2p` = *Co-op Tempur Berdua* (players 2) |
| **Canva** | 600 × 800 |
| **Pesawat** | 38 × 22 px, nyawa 3, warna per pemain (P1 biru, P2 oranye) |
| **Grid alien** | 6 kolom × 4 baris (36×24 px), harga poin rekor `[30, 20, 10, 10]` per baris |
| **Bunker** | 4 blok pelindung (54×34 px, HP 12) di atas pemain |
| **Latar** | Starfield 45 bintang bergerak |
| **Ekstra** | Proyektil pemain & alien, partikel ledakan, efek kedip saat invulnerable |

**Kontrol:**

| Perintah | Aksi |
|---|---|
| `99#` | Mulai permainan (Player 1 saja) |
| `5#` | Alternatif mulai (juga menembak saat bermain) |
| `1#` / `3#` | Pesawat ke kiri |
| `2#` / `4#` | Pesawat ke kanan |
| `0#` | Pesawat berhenti |

**Kemenangan:** Seluruh alien tersingkir; kekalahan jika satu (solo) atau semua (ko-op) pemain kehabisan nyawa.
**Efek suara:** `start`, `shoot`, `explode`, `hurt`, `win`, `lose`.

---

## 3. Tank Battle (`games/tankbattle.js`)

Pertempuran tank *top-down* dalam arena berpagar 600×800, dengan 11 dinding penghalang dan 4 sudut spawn.

| Aspek | Spesifikasi |
|---|---|
| **Mode** | `1v1` = *Duel Satu Lawan Satu* (players 2); `ffa` = *Semua Lawan Semua* (players 4) |
| **Canva** | 600 × 800 |
| **Tank** | 30×30 px, nyawa `LIVES = 3`, kecepatan `175 px/dtk` |
| **Peluru** | Radius 7 px, kecepatan `440 px/dtk`, cooldown `SHOOT_CD = 0.4 dtk` |
| **Invulnerability** | `INVULN = 2.2 dtk` setelah respawn (dengan efek kedip) |
| **Respawn** | Melalui `RESPAWN_DELAY = 1000 ms` di posisi awal masing-masing |
| **Arena** | Border 10 px + 11 dinding simetris (kotak tengah, lengan, penutup, penghalang) |
| **Warna** | P1 biru, P2 oranye, P3 hijau, P4 ungu |

**Kontrol** (skema 4 arah, konsisten dengan mapping keyboard kernel):

| Perintah | Aksi |
|---|---|
| `99#` | Mulai permainan (Player 1 saja) |
| `5#` / `6#` | Tembak peluru (saat bermain) |
| `1#` | Maju (atas) |
| `2#` | Mundur (bawah) |
| `3#` | Belok ke kiri |
| `4#` | Belok ke kanan |
| `0#` | Berhenti |

> Catatan: Berbeda dari Ping Pong/Space Invaders yang "menggeser" pemain, di sini `1`=maju & `2`=mundur
> karena tank adalah objek 4 arah. Arah laras tank mengikuti arah gerak terakhir.

**Mekanik:**
- *Sliding collision*: tank tidak dapat menembus dinding/tank lain, dengan pemisahan sumbu X/Y.
- Peluru mengenai dinding → ledakan kecil & hilang; mengenai tank lawan → kurangi nyawa + invulnerable.
- Kemenangan: tank dengan nyawa tersisa terakhir; seri jika semua habis.
- Pergerakan dihentikan saat `st.over`, dan `finish()` dipanggil dengan string hasil.

**Efek suara:** `start`, `shoot`, `hit`, `bounce`, `lose`, `explode` (ledakan partikel).

---

## 4. Endless Racer (`games/endlessracer.js`)

Balap *endless scroller* *top-down*: pemain menyusuri jalan 4 jalur dan menghindari kendaraan yang datang dari atas.

| Aspek | Spesifikasi |
|---|---|
| **Mode** | `1p` = *Bertahan Sendirian*; `2p` = *Siapa Bertahan Lama?* (players 2) |
| **Canva** | 600 × 800 |
| **Jalan** | Kiri `80`, kanan `520` (lebar 440), 4 jalur, marka putus-putus |
| **Mobil pemain** | 36×60 px, kecepatan geser `320 px/dtk` |
| **Halangan** | 36×60 px, 6 warna, kecepatan relatif acak (0.6–1.1×) |
| **Scroll** | Mulai `220 px/dtk`, naik `14 px/dtk` tiap detik, maks `600 px/dtk` |
| **Spawn** | Interval mulai 1.4 dtk, memendek ke min 0.6 dtk seiring waktu |
| **Posisi mulai** | 1P di tengah; 2P di jalur kiri & kanan |

**Kontrol:**

| Perintah | Aksi |
|---|---|
| `99#` | Mulai permainan (Player 1 saja) |
| `1#` / `3#` | Geser ke kiri |
| `2#` / `4#` | Geser ke kanan |
| `0#` | Berhenti geser (diam) |

**Mekanik:**
- Tabrakan dengan halangan → mobil hancur, catat waktu `survived`.
- 1P: berakhir saat mobil hancur → tampil durasi bertahan. 2P: berakhir saat **semua** mobil hancur
  → tampil pemenang dengan durasi bertahan terlama (atau seri bila selisih < 50 ms).
- Mobil hanya bisa berpindah antar lajur dalam batas jalan (diclamp ke `ROAD_LEFT..ROAD_RIGHT-CAR_W`).

**Efek suara:** `start`, `lose` (saat tabrakan).

---

## 5. Dino Jump (`games/dinorush.js`)

Endless *runner* horizontal dalam orientasi **Landscape 16:9 (1280x720)**, dioptimalkan untuk layar PID sekolah, laptop, dan tablet. **Tiap pemain punya lintasan horizontal sendiri** (1-4, tersusun atas ke bawah); skor = jarak tempuh (meter); nyawa 1 atau 3 (opsi `lives`); pemenang = jarak terjauh, seri bila selisih < 5 m. Satu aksi: **lompat** (tombol apa pun selain `0`). Mulai wajib dengan `99#` atau klik layar. Rincian: [plan/games/dinorush.md](games/dinorush.md).

---



---

## 6. Flappy Bird (games/flappybird.js)

Permainan arkade terbang bersama (*multiplayer shared arena*). Seluruh burung pemain terbang bersama di satu arena yang sama melewati celah pipa ber-seed RNG. Mendukung 1 hingga 4 pemain, konfigurasi opsi (Nyawa, Aturan selesai, Tingkat kesulitan), dan kepakan flap pada perintah `5#`, `3#`, atau `4#`. Rincian: [plan/games/flappybird.md](games/flappybird.md).

---

## Panduan Menjaga Dokumentasi

- Setiap kali game baru ditambahkan ke `games/index.js`, tambahkan barisnya di **tabel daftar game**
  dan satu subseksi lengkap di dokumen ini.
- Perbarui **tabel perintah** pada `../README.md` utama agar daftar arti angka selalu sinkron dengan semua game.
- Jaga kontrak stabil: `finish()` harus menerima **string** (pemenang / hasil akhir), bukan objek.