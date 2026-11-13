# Game: Sumo Arena

| Atribut | Nilai |
|---|---|
| **`id`** | `sumoarena` |
| **Nama** | Sumo Arena |
| **Ikon** | 🥋 |
| **File** | `games/sumoarena.js` |
| **Dokumen induk** | [06-games-catalog.md](../06-games-catalog.md) |

Permainan arkade aksi adu dorong multi-pemain (2 atau 4 pemain). Seluruh pemain mengendalikan bola petarung sumo di atas panggung bundar (*dohyo*) berpusat di `(640, 400)`. Pemain harus mendorong lawan keluar dari panggung ke dalam jurang sebelum panggung mengecil dan sebelum terdorong keluar.

Game ini mengusung desain **antarmuka bersih tanpa menu opsi**: peraturan berlangsung otomatis dalam **3 ronde** kompetisi penuh (ditambah satu ronde penentu / *sudden death* bila terjadi skor seri di puncak).

---

## Mode Permainan

| `id` | Label | Sub | `players` | Keterangan |
|---|---|---|---|---|
| `1p` | 1 Player | Lawan Komputer | 1 | Duel 1v1 melawan AI Sumo Bot otomatis |
| `2p` | 2 Player | Adu dorong | 2 | Duel 1v1 adu dorong di arena bersama |
| `4p` | 4 Player | Sumo berempat | 4 | Pertarungan bebas 4 pemain serentak di satu panggung |

> **Catatan Mode**: Menyediakan mode 1P (vs AI Komputer), 2P (duel), dan 4P (pesta berempat). Mode 3 pemain tidak didukung demi simetri arena.

---

## Spesifikasi Teknis

| Aspek | Nilai | Keterangan |
|---|---|---|
| **Canvas** | `1280 × 720 px` | Rasio 16:9 standar landscape PID sekolah / laptop |
| **Pusat Panggung** | `(640, 400)` | Berada di dalam area aman kanvas (bebas tumpang tindih HUD) |
| **Radius Awal Panggung** | `ARENA_R0 = 280 px` | Panggung bundar tatami dohyo |
| **Radius Minimum Panggung** | `ARENA_R_MIN = 45 px` | Batas panggung terkecil saat ronde mendekati akhir |
| **Jeda Pengecilan** | `SHRINK_DELAY = 8.0 dtk` | Panggung tetap berukuran 280 px selama 8 detik pertama |
| **Durasi Maksimal Ronde** | `ROUND_MAX_SEC = 60.0 dtk` | Pengecilan berlangsung linear dari detik ke-8 hingga detik ke-60 |
| **Radius Bola Sumo** | `BALL_R = 28 px` | Bola berbobot massa normal 1.0 |
| **Posisi Awal Spawn** | `150 px` dari pusat | 2P: kiri (180°) & kanan (0°); 4P: kiri, kanan, atas, bawah |
| **Arah Hadap Awal** | Menghadap pusat panggung | Vektor hadap satuan `(ARENA_CX - x, ARENA_CY - y)` ternormalisasi |
| **Warna Pemain** | P1 `#4b83ff`, P2 `#ff9a2e`, P3 `#3ccf8e`, P4 `#b98cff` | Mengikuti **nomor slot fisik**, bukan urutan array |
| **Area Bebas HUD** | `40 px` dari tepi layar | Mencegah tumpang tindih dengan kontrol panggung shell (`#quit`, `#mon`, `#snd`, `#fs`) |

---

## Tabel Konstanta Fisika

| Konstanta | Nilai | Keterangan |
|---|:---:|---|
| `ACCEL` | `900 px/dtk²` | Percepatan dorong bola searah input aktif |
| `FRICTION` | `3.0` | Koefisien gesekan eksponensial arena: `v *= exp(-FRICTION * dt)` |
| `MAX_SPEED` | `420 px/dtk` | Kecepatan geser normal maksimal |
| `RESTITUTION` | `0.9` | Koefisien elastisitas pemantulan tumbukan antar bola |
| `DASH_SPEED` | `700 px/dtk` | Kecepatan dorongan kuat (*Dash*) searah hadap |
| `DASH_TIME` | `0.18 dtk` | Durasi masa dorongan dash aktif |
| `DASH_COOLDOWN` | `2.5 dtk` | Waktu tunggu pendinginan sebelum dash dapat digunakan kembali |
| `DASH_MASS` | `2.0` | Massa bola saat melakukan dash (menjadikannya lebih berat dan kuat) |
| `FALL_TIME` | `0.6 dtk` | Durasi animasi meluncur, mengecil, dan berputar saat tersingkir |
| `Sub-langkah Integrasi` | `≤ 1/120 dtk` | `ceil(dt / (1/120))` untuk mencegah tembus fisik saat tabrakan berkecepatan tinggi |

---

## Kontrol & Pemetaan

| Perintah | Aksi | micro:bit | Keyboard P1 | Keyboard P2 |
|---|---|:---:|:---:|:---:|
| **Mulai Permainan** | Memicu hitung mundur 3-2-1 | `99#` (Pemain 1) | Klik Kanvas / Enter | - |
| **Dorong ke Atas** | Percepatan ke arah atas | `1#` | Panah Atas (`↑`) | Tombol `W` |
| **Dorong ke Bawah** | Percepatan ke arah bawah | `2#` | Panah Bawah (`↓`) | Tombol `S` |
| **Dorong ke Kiri** | Percepatan ke arah kiri | `3#` | Panah Kiri (`←`) | Tombol `A` |
| **Dorong ke Kanan** | Percepatan ke arah kanan | `4#` | Panah Kanan (`→`) | Tombol `D` |
| **Berhenti Mendorong** | Meluncur dengan kelembaman | `0#` | Lepas Tombol | Lepas Tombol |
| **Dorongan Kuat (Dash)**| Dash berkecepatan 700 px/dtk | `5#` | - *(Khusus micro:bit)* | - *(Khusus micro:bit)* |
| **Perintah Lain** | Diabaikan | Lainnya | - | - |

*Catatan Kontrol Keyboard*: Modul Kernel memetakan tombol keyboard panah dan WASD ke perintah `1`, `2`, `3`, `4`, dan tombol lepas ke `0`. Karena perintah `'5'` tidak dipancarkan oleh keyboard standar, kemampuan Dash menjadi keunggulan eksklusif saat menggunakan controller micro:bit fisik.

---

## Alur Permainan (*Game Flow*)

1. **Fase Siap (`waiting`)**:
   - Seluruh bola berada di posisi awal masing-masing menghadap ke pusat arena.
   - Layar menampilkan judul *"🥋 SUMO ARENA"* serta instruksi: *"Kirim 99# dari micro:bit pemain pertama (P{slot}), atau klik layar untuk mulai"*.
   - Perintah `99#` hanya diterima jika berasal dari pemain pertama sesi (`players[0]`).
2. **Hitung Mundur (`countdown`)**:
   - Tampil hitung mundur besar `3 → 2 → 1` (`COUNTDOWN_SEC = 3`).
   - Suara `click` dimainkan di setiap pergantian angka.
3. **Fase Pertarungan Ronde (`play`)**:
   - Panggung utuh beradius 280 px selama 8 detik pertama.
   - Pada detik ke-8, suara `'bounce'` berbunyi dan muncul peringatan berkedip *"⚠️ PANGGUNG MENGECIL! ⚠️"*. Tepi arena berangsur memerah seiring mengecil hingga radius 45 px pada detik ke-60.
   - Pemain menggunakan arah dan dash untuk saling mendorong. Bola yang terdorong keluar panggung (pusat bola melintasi radius arena) jatuh ke jurang dan tersingkir.
4. **Jeda Akhir Ronde (`roundEnd`)**:
   - Ronde berakhir saat tersisa satu bola hidup (atau durasi 60 detik tercapai).
   - Banner hasil ronde dan klasemen skor sementara tampil selama `2.5 detik` disertai suara `'score'`.
5. **Ronde Penentu (*Sudden Death Tie-Break*)**:
   - Bila setelah 3 ronde normal terdapat perolehan poin tertinggi yang sama, sistem otomatis menggelar **SATU ronde penentu**.
   - Ronde penentu hanya diikuti oleh para pemain yang seri di puncak (pemain lain yang kalah tidak diikutsertakan dan bolanya tidak digambar).
6. **Fase Selesai (`over`)**:
   - Suara `'win'` dimainkan dan panggung menampilkan pemenang akhir.
   - Jeda `600 ms` sebelum memanggil `finish(resultText)` ke shell.

---

## Aturan Skor & Format Hasil Pertandingan (`finish`)

### Sistem Poin Ronde
- Untuk `N` pemain yang bertanding pada ronde tersebut:
  - Pemain yang bertahan terakhir memperoleh `N - 1` poin.
  - Pemain yang gugur kedua terakhir memperoleh `N - 2` poin.
  - ... hingga `0` poin untuk pemain yang pertama kali terdorong keluar.
  - Contoh 2 Pemain: Juara ronde = 1 poin, Kalah = 0 poin.
  - Contoh 4 Pemain: Peringkat 1 = 3 poin, Peringkat 2 = 2 poin, Peringkat 3 = 1 poin, Peringkat 4 = 0 poin.
- **Berbagi Peringkat**: Bila beberapa pemain tersingkir pada frame yang sama atau bertahan bersamaan hingga batas 60 detik habis, mereka berbagi poin rata-rata dari peringkat yang ditempati (dibulatkan ke bawah).

### Format Hasil Akhir (`finish`)

Dipanggil setelah jeda `600 ms`:

- **Pemenang Tunggal**:  
  `"P{winner} juara! P1 {s1}, P2 {s2}..."` (seluruh pemain dicantumkan urut nomor slot)  
  *Contoh 2P*: `"P1 juara! P1 3, P2 0"`  
  *Contoh 4P*: `"P3 juara! P1 4, P2 2, P3 6, P4 3"`

- **Skor Seri**:  
  `"Seri antara {daftar pemenang}! P1 {s1}, P2 {s2}..."`  
  *Contoh Seri 2P*: `"Seri antara P1 dan P2! P1 4, P2 4"`  
  *Contoh Seri 3 Pemain*: `"Seri antara P1, P2 dan P3! P1 5, P2 5, P3 5, P4 1"`

---

## Tampilan HUD (Area Aman)

- **Ketinggian Bar HUD**: `64 px` dari tepi atas kanvas.
- **Tengah**:
  - Judul ronde: `"Ronde N/3"` atau `"Ronde Penentu (Sudden Death)"` (teks merah muda kontras).
  - Penghitung mundur waktu panggung: `"Waktu Ronde: {detik}s"` (memerah saat sisa ≤ 10 detik).
- **Sisi Kiri & Kanan**:
  - Chip skor per pemain berlabel nomor slot (`P1: 4 pts`, `P2: 2 pts`) dengan lampu indikator warna slot.
  - Pemain yang telah tersingkir pada ronde berjalan ditampilkan redup (*opacity 0.4*).
  - Jarak aman minimal 40 px dari kontrol panggung shell (`#quit`, `#mon`, `#snd`, `#fs`).

---

## Integrasi Efek Suara (Web Audio API)

- **Tabrakan Antar Bola**: `audio.play('hit', { pan, volume })` (volume proporsional terhadap kecepatan relatif tabrakan)
- **Dorongan Kuat (Dash)**: `audio.play('shoot', { pan })`
- **Bola Tersingkir / Jatuh**: `audio.play('lose', { pan })`
- **Peringatan Panggung Mulai Mengecil**: `audio.play('bounce')` (detik ke-8)
- **Akhir Setiap Ronde**: `audio.play('score')`
- **Awal Pertandingan**: `audio.play('start')`
- **Akhir Permainan (Juara)**: `audio.play('win')`

---

## Siklus Hidup & Pembersihan (`lifecycle`)

Fungsi `create()` mengembalikan objek `{ stop() }`:
- Menyetel bendera `isStopped = true`.
- Membatalkan loop `requestAnimationFrame(frameId)`.
- Membersihkan seluruh timer `setTimeout` aktif.
- Melepas listener kernel masukan controller (`offInput()`).
- Melepas listener klik kanvas (`canvas.removeEventListener('click', onCanvasClick)`).
- Penjaga `dt = Math.min((now - lastTime) / 1000, 0.05)` mencegah anomali fisika saat tab browser diminimalkan atau mengalami lonjakan frame.

