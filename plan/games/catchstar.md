# Game: Tangkap Bintang (Catch Star)

| Atribut | Nilai |
|---|---|
| **`id`** | `catchstar` |
| **Nama** | Tangkap Bintang |
| **Ikon** | ⭐ |
| **File** | `games/catchstar.js` |
| **Dokumen induk** | [06-games-catalog.md](../06-games-catalog.md) |

Permainan arkade aksi reaksi multi-pemain (1, 2, atau 4 pemain). Seluruh pemain mengendalikan keranjang di dasar arena untuk menangkap bintang-bintang yang berjatuhan dari langit malam sebelum didahului pemain lain.

Game ini mengusung desain **antarmuka bersih tanpa menu opsi**: permainan berlangsung otomatis melewati **3 level bertingkat** (*Hujan Bintang*, *Hujan Deras*, dan *Badai Bintang*), dengan akumulasi skor akhir untuk menentukan pemenang atau penilaian performa bintang.

---

## Mode Permainan

| `id` | Label | Sub | `players` | Keterangan |
|---|---|---|---|---|
| `1p` | 1 Player | Solo | 1 | Uji ketangkasan solo dengan target penilaian bintang (1 hingga 3 bintang) |
| `2p` | 2 Player | Rebut bintang | 2 | Duel 1v1 berebut bintang di arena bersama |
| `4p` | 4 Player | Rebut bintang | 4 | Pertandingan 4 pemain penuh layar kelas PID/laptop |

> **Catatan Mode**: Game ini secara sengaja **tidak menyediakan mode 3 pemain**. Shell menampilkan 3 tombol mode (`1P`, `2P`, `4P`) dan menonaktifkan tombol yang melebihi jumlah pemain terhubung.

---

## Spesifikasi Teknis

| Aspek | Nilai | Keterangan |
|---|---|---|
| **Canvas** | `1280 × 720 px` | Rasio 16:9 standar landscape PID sekolah / laptop |
| **Posisi Keranjang** | Bibir atas di `y = 640` | Tinggi keranjang `40 px` (dasar di `y = 680`) |
| **Bentuk Keranjang** | Trapesium | Berwarna sesuai slot fisik (`P1`..`P4`) dengan label teks `P{slot}` |
| **Kecepatan Geser** | `520 px/dtk` | Pergerakan horizontal responsif di dalam batas arena canvas |
| **Posisi Awal Keranjang** | `x = (i + 1) * W / (N + 1)` | Terdistribusi merata horizontal sesuai jumlah pemain |
| **Interaksi Keranjang** | Boleh saling melintas | Keranjang tidak saling bertabrakan atau memblokir |
| **Radius Bintang Biasa** | `22 px` | Nilai `1 poin`, warna kuning pastel |
| **Radius Bintang Emas** | `26 px` | Nilai `3 poin`, warna emas berkilau dengan lingkaran aura cahaya |
| **Sebaran Kolom Muncul** | `12 Kolom` | Sistem *Shuffle Bag* dengan variasi acak (*jitter*) di dalam kolom |
| **Jeda Muncul Acak** | `±15%` | Variasi jeda waktu kemunculan bintang per level |
| **Rotasi Bintang** | `1.5 rad/dtk` | Animasi rotasi halus bintang lima sudut saat melayang jatuh |
| **Bintang Lolos** | `y - radius > 720` | Bintang hilang di dasar layar tanpa pengurangan poin |
| **Toleransi Tangkap** | `lebar/2 + 0.3 * radius` | Toleransi horizontal kompensasi jeda nirkabel Bluetooth |
| **Warna Pemain** | P1 `#4b83ff`, P2 `#ff9a2e`, P3 `#3ccf8e`, P4 `#b98cff` | Mengikuti **nomor slot fisik**, bukan urutan array |
| **Area Bebas HUD** | `40 px` dari tepi layar | Menjaga jarak aman dari kontrol overlay panggung (`#quit`, `#mon`, `#snd`, `#fs`) |

---

## Tabel Karakteristik Level

Permainan terdiri dari 3 level berurutan otomatis:

| Level | Nama Level | Kecepatan Jatuh | Jeda Muncul | Peluang Bintang Emas | Perilaku Gerak | Lebar Keranjang |
|:---:|---|:---:|:---:|:---:|---|:---:|
| **1** | Hujan Bintang | `150 px/dtk` | `1.4 dtk` | `0%` | Lurus jatuh | `150 px` |
| **2** | Hujan Deras | `230 px/dtk` | `1.0 dtk` | `12%` | Lurus jatuh | `125 px` |
| **3** | Badai Bintang | `330 px/dtk` | `0.7 dtk` | `20%` | 40% bintang bergoyang sinus (amplitudo 60 px, frekuensi 1.2 Hz) | `100 px` |

### Alokasi Bintang per Level

Total bintang per permainan:
- **1 Pemain**: `20 bintang` (L1: 7, L2: 7, L3: 6)
- **2 Pemain**: `30 bintang` (L1: 10, L2: 10, L3: 10)
- **4 Pemain**: `40 bintang` (L1: 14, L2: 13, L3: 13)

Rumus pembagian: `floor(total / 3)`, sisa pembagian didistribusikan mulai dari Level 1.

---

## Kontrol & Pemetaan

| Perintah | Aksi | micro:bit | Keyboard P1 | Keyboard P2 |
|---|---|:---:|:---:|:---:|
| **Mulai Permainan** | Memicu hitung mundur 3-2-1 | `99#` (Pemain 1) | Klik Kanvas / Enter | - |
| **Geser Kiri** | Keranjang meluncur ke kiri | `1#` atau `3#` | Panah Kiri (`←`) | Tombol `A` |
| **Geser Kanan** | Keranjang meluncur ke kanan | `2#` atau `4#` | Panah Kanan (`→`) | Tombol `D` |
| **Berhenti** | Keranjang berhenti di posisi | `0#` | Lepas Tombol | Lepas Tombol |
| **Perintah Lain** | Diabaikan | Lainnya | - | - |

*Catatan Mekanisme Kendali*: Pergerakan berlanjut terus sampai ada perintah arah lain atau perintah berhenti `0#` (mirip mekanisme paddle Ping Pong).

---

## Alur Permainan (*Game Flow*)

1. **Fase Siap (`waiting`)**:
   - Keranjang berada di posisi awal masing-masing.
   - Layar menampilkan judul *"⭐ TANGKAP BINTANG"* serta petunjuk: *"Kirim 99# dari micro:bit pemain pertama (P{slot}), atau klik layar untuk mulai"*.
   - Perintah `99#` hanya diterima dari pemain pertama sesi (`players[0]`). Perintah `99#` dari pemain lain diabaikan.
2. **Hitung Mundur (`countdown`)**:
   - Tampil hitung mundur besar `3 → 2 → 1` (`COUNTDOWN_SEC = 3`).
   - Suara `click` dimainkan pada setiap pergantian angka.
3. **Fase Permainan (`play`)**:
   - Bintang berjatuhan sesuai konfigurasi level aktif.
   - Suara `start` dimainkan pada permulaan setiap level.
   - Bintang tertangkap menambah skor dan memainkan suara `score` (bintang biasa) atau `powerup` (bintang emas) dengan panning stereo.
4. **Jeda Antar Level (`between`)**:
   - Berlangsung selama `2 detik` setelah seluruh bintang pada level aktif selesai diproses.
   - Menampilkan banner besar: *"Level {N}: {Nama Level}"* beserta skor sementara para pemain.
5. **Fase Selesai (`over`)**:
   - Setelah Level 3 usai, audio akhir dimainkan:
     - Solo (1P): `'win'` bila penilaian ≥ 2 bintang, atau `'lose'` bila 1 bintang.
     - Multiplayer (2P/4P): selalu memutar `'win'`.
   - Menunggu jeda `600 ms` sebelum memanggil `finish(resultText)` agar panggung shell menampilkan layar hasil resmi.

---

## Aturan Tangkap & Penentuan Juara

### Aturan Tangkap
- Bintang dinyatakan tertangkap bila:
  1. Bagian bawah bintang menyentuh bibir atas keranjang: `y + radius >= 640`.
  2. Jarak horizontal memenuhi: `|x_bintang - x_pusat_keranjang| <= lebar_keranjang / 2 + 0.3 * radius`.
- **Tie-Break**: Bila beberapa keranjang memenuhi syarat pada frame yang sama, bintang diberikan kepada keranjang yang pusatnya paling dekat. Jika jaraknya sama persis, dipilih acak di antara kandidat terdekat.
- Satu bintang hanya dapat ditangkap oleh satu pemain.

### Format Hasil Pertandingan (`finish`)

#### 1. Mode 1 Pemain (Solo)
Penilaian berdasarkan persentase bintang tertangkap dari total:
- **≥ 80%**: 3 Bintang (`★★★`)
- **≥ 50%**: 2 Bintang (`★★☆`)
- **< 50%**: 1 Bintang (`★☆☆`)

Format:  
`"{stars} Hebat! {caught} dari {total} bintang (skor {score})"`

Contoh:
- `★★★ Hebat! 18 dari 20 bintang (skor 24)`
- `★★☆ Hebat! 12 dari 20 bintang (skor 15)`
- `★☆☆ Hebat! 7 dari 20 bintang (skor 9)`

#### 2. Mode 2 dan 4 Pemain (Multiplayer)
Pemenang adalah pemain dengan total skor tertinggi. Seluruh skor pemain dicantumkan berurutan berdasarkan nomor slot fisik.

- **Menang Tunggal**:  
  `"P{winner} menang! P1 {s1}, P2 {s2}"`  
  Contoh 2P: `"P2 menang! P1 14, P2 21"`  
  Contoh 4P: `"P2 menang! P1 14, P2 21, P3 18, P4 15"`

- **Skor Seri**:  
  `"Seri antara {daftar pemenang seri}! P1 {s1}, P2 {s2}, ..."`  
  Contoh Seri 2P: `"Seri antara P1 dan P2! P1 18, P2 18"`  
  Contoh Seri 4P: `"Seri antara P1 dan P3! P1 15, P2 9, P3 15, P4 11"`  
  Contoh Seri 3 Pemain: `"Seri antara P1, P2 dan P4! P1 20, P2 20, P3 10, P4 20"`

---

## Tampilan HUD (Area Aman)

- **Ketinggian Bar HUD**: `64 px` dari atas kanvas.
- **Tengah**:
  - Baris atas: `Level N/3: {Nama Level}` (teks tebal emas).
  - Baris bawah: `Sisa Bintang: X` (total jatah bintang dikurangi yang sudah tertangkap atau lolos).
- **Sisi Kiri & Kanan**:
  - Chip skor per pemain dengan warna slot fisik (`P1: 14`, `P2: 21`), berjarak aman minimal 40 px dari kontrol layar panggung (tombol Keluar `#quit` di kiri, serta tombol Monitor `#mon`, Suara `#snd`, dan Layar Penuh `#fs` di kanan).

---

## Integrasi Efek Suara (Web Audio API)

- **Tangkap Bintang Biasa**: `audio.play('score', { pan: (x - 640) / 640, volume: 0.5 })`
- **Tangkap Bintang Emas**: `audio.play('powerup', { pan: (x - 640) / 640, volume: 0.6 })`
- **Hitung Mundur (3-2-1)**: `audio.play('click')`
- **Awal Setiap Level**: `audio.play('start')`
- **Akhir Pertandingan**:
  - 1P Solo: `audio.play('win')` jika penilaian ≥ 2 bintang, atau `audio.play('lose')` jika 1 bintang.
  - Multiplayer: selalu `audio.play('win')`.

---

## Siklus Hidup & Pembersihan (`lifecycle`)

Fungsi `create()` mengembalikan objek `{ stop() }`:
- Menyetel bendera `isStopped = true`.
- Membatalkan loop `requestAnimationFrame(frameId)`.
- Membersihkan seluruh timer aktif `setTimeout` (termasuk timer `finish()`).
- Melepas listener kernel masukan controller (`offInput()`).
- Melepas listener klik kanvas (`canvas.removeEventListener('click', onCanvasClick)`).
- Penjaga `dt = Math.min((now - lastTime) / 1000, 0.05)` mencegah lonjakan pergerakan keranjang atau bintang saat terjadi penurunan frame.

