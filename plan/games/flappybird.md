# Game: Flappy Bird

| Atribut | Nilai |
|---|---|
| **`id`** | `flappybird` |
| **Nama** | Flappy Bird |
| **Ikon** | 🐦 |
| **File** | `games/flappybird.js` |
| **Dokumen induk** | [06-games-catalog.md](../06-games-catalog.md) |

Permainan arkade terbang bersama (*multiplayer shared arena*). Semua burung pemain terbang di arena yang sama melewati rintangan celah pipa yang identik secara simultan tanpa saling bertabrakan. 

Game ini mengusung desain **antarmuka bersih tanpa menu opsi**: peraturan paten **3 nyawa** dan permainan berlangsung penuh sampai **seluruh pemain gugur** (pemain yang bertahan paling lama terus bermain sendirian mengumpulkan skor maksimal).

---

## Mode

| `id` | Label | Sub | `players` |
|---|---|---|---|
| `1p` | 1 Player | Sendiri | 1 |
| `2p` | 2 Player | Berdua | 2 |
| `3p` | 3 Player | Bertiga | 3 |
| `4p` | 4 Player | Berempat | 4 |

---

## Spesifikasi Teknis

| Aspek | Nilai | Keterangan |
|---|---|---|
| **Canvas** | `800 × 600 px` | Rasio 4:3, tampil proporsional di panggung dengan letterbox gelap |
| **Target Usia** | **TK & SD (4–12 Tahun)** | Parameter ramah anak: burung melayang santai, celah lebar |
| **Nyawa** | `5 Nyawa` (❤️❤️❤️❤️❤️) | Tabrakan memberi kebal 2.5 detik di tengah celah pipa berikutnya |
| **Aturan Selesai** | Sampai semua mati (`all`) | Pemain terakhir tetap bermain sendirian memaksimalkan skor |
| **Celah Pipa** | `240 px` | Celah ekstra lebar (~10× tinggi burung), sangat ramah anak |
| **Kecepatan Awal** | `125 px/dtk` | Kecepatan scroll santai bertambah halus `+1 px/dtk` per detik (max 175) |
| **Lantai & Langit** | Lantai di `y = 540`, langit di `y = 0` | Menyentuh lantai atau langit dihitung sebagai tabrakan |
| **Ukuran Burung** | `34 × 26 px` | Digambar murni dengan bentuk canvas (badan elips, sayap, mata, paruh) |
| **Hitbox Burung** | 70 % dari ukuran visual | Toleransi tabrakan tinggi untuk kompensasi latensi nirkabel BLE |
| **Posisi Horizontal (X)** | `x = 160 + (indeks × 30) px` | Posisi X tetap (staggered agar tidak menumpuk), hanya sumbu Y yang bergerak |
| **Gravitasi** | `GRAV = 780 px/dtk²` | Jatuh perlahan & melayang (*floaty*), tidak langsung anjlok |
| **Kepakan (Flap)** | `FLAP_V = -310 px/dtk` | Lompatan teratur dan terukur, tidak melonjak ke langit-langit |
| **Batas Jatuh** | `MAX_FALL = 400 px/dtk` | Kecepatan terminal vertikal maksimal aman |
| **Anti-Spam Flap** | `60 ms` | Jeda minimum antar kepakan per burung |
| **Pipa** | Lebar `70 px`, celah ber-seed RNG | Pipa sama persis untuk semua pemain |
| **Jarak Antar Pipa** | `kecepatan × 2.4 detik` | Jeda 2.4 detik memberi waktu anak menstabilkan ketinggian burung |
| **Margin Celah** | Min `60 px` dari langit/lantai | Pergeseran vertikal maksimal antar celah berturut-turut `100 px` |
| **Warna Pemain** | P1 `#4b83ff`, P2 `#ff9a2e`, P3 `#3ccf8e`, P4 `#b98cff` | Mengikuti **nomor slot fisik**, bukan urutan array |

---

## Kontrol

| Perintah | Aksi |
|---|---|
| `99#` (Hanya dari `players[0]`) | Memulai permainan (memicu hitung mundur 3-2-1) |
| Klik canvas | Memulai permainan (alternatif mulai di fase siap) |
| `5#`, `3#`, atau `4#` | Burung mengepakkan sayap (flap) ke atas |
| Perintah lain (`0#`, `1#`, `2#`, dll.) | Diabaikan sepenuhnya selama permainan berlangsung |

> **Catatan Keyboard untuk Pengujian**:
> Pemetaan keyboard kernel mengikat tombol Panah Kiri (`ArrowLeft`) ke `3` dan Panah Kanan (`ArrowRight`) ke `4`. Untuk Player 2 (WASD), tombol `A` memicu `3` dan `D` memicu `4`.
> Oleh karena itu, pengujian kepakan burung via keyboard dilakukan menggunakan **Panah Kiri / Panah Kanan** (Player 1) dan **A / D** (Player 2). Panah Atas dan Bawah (`1` dan `2`) tidak membuat burung terbang.

---

## Alur Memulai Permainan

1. **Fase Siap (`waiting`)**:
   - Seluruh burung melayang pelan naik-turun (animasi sinus lembut).
   - Layar menampilkan judul *"🐦 Flappy Bird"* serta instruksi: *"Kirim 99# dari micro:bit pemain pertama (P{slot}), atau klik layar untuk mulai!"*.
   - Perintah `99#` hanya diterima jika berasal dari pemain pertama dalam sesi (`players[0]`). Perintah `99#` dari pemain lain diabaikan.
2. **Hitung Mundur (`countdown`)**:
   - Tampil angka hitung mundur besar `3 → 2 → 1` (`COUNTDOWN_SEC = 3`).
   - Suara `click` berbunyi di setiap pergantian angka.
3. **Mulai Terbang (`playing`)**:
   - Suara `start` dimainkan, gravitasi aktif, dan pipa mulai bergeser ke kiri.

---

## Aturan Nyawa, Skor, & Selesai

- **Sistem Nyawa**:
  - `lives = 3`.
  - Saat menabrak pipa, lantai, atau langit-langit:
    - Nyawa berkurang 1.
    - Jika masih ada sisa nyawa: burung dipindahkan ke tengah celah pipa di depannya, kecepatan vertikal di-reset ke `0`, kebal selama `1.5 detik` (berkedip @ 8Hz dan menembus rintangan), serta memutar efek suara `hurt`.
    - Jika nyawa habis: burung mati, jatuh ke lantai, memutar efek suara `lose`, mencatat skor akhir dan waktu bertahan (`survivedTime`).
- **Penghitungan Skor**:
  - Poin bertambah saat tepi belakang burung (`x + w`) melewati tepi kanan pipa (`pipe.x + pipe.w`).
  - Poin hanya diberikan jika burung dalam keadaan hidup dan **tidak sedang dalam status kebal menembus**.
  - Setiap skor baru memutar audio `score` (`volume: 0.4` dengan panning spasial).
- **Aturan Berakhir**:
  - **Solo (1 Player)**: Berakhir saat burung mati.
  - **Multiplayer**: Berakhir setelah seluruh burung mati. Burung yang masih hidup terus bermain sendirian mengumpulkan skor maksimal.
  - **Pemenang**: Pemain dengan skor tertinggi. Bila skor sama, pemain dengan waktu bertahan lebih lama keluar sebagai pemenang (seri bila selisih waktu < 0.05 detik).

---

## Format Hasil Pertandingan (`finish`)

Dipanggil setelah jeda `500 ms`:

| Skenario | Format Output String | Contoh |
|---|---|---|
| **Solo** | `"Skor {skor} pipa! Bertahan {detik} dtk"` | `"Skor 12 pipa! Bertahan 24.3 dtk"` |
| **Menang (Multiplayer)** | `"P{slot} menang! P{slot} {skor} pipa, ..."` | `"P2 menang! P1 8 pipa, P2 12 pipa"` |
| **Seri (Multiplayer)** | `"Seri! Sama-sama {skor} pipa"` | `"Seri! Sama-sama 8 pipa"` |

---

## Tampilan HUD

1. **Sudut Kiri Atas**:
   - Satu baris per pemain berlabel nomor slot (`P1`, `P2`, dst.) dengan warna slot masing-masing.
   - Status nyawa ditampilkan dalam simbol hati `♥` (aktif) dan `♡` (hilang).
   - Nilai skor pemain.
   - Pemain yang telah gugur ditampilkan redup (transparansi `0.45`) dengan skor akhirnya.
2. **Tengah Atas**:
   - Angka skor tertinggi sesi aktif ditampilkan dengan ukuran teks besar kontras.

---

## Integrasi Efek Suara (Web Audio API)

- **Kepakan Sayap (Flap)**: `audio?.play('click', { pan, volume: 0.3 })`
- **Skor Bertambah**: `audio?.play('score', { pan, volume: 0.4 })`
- **Tabrakan (Masih Ada Nyawa)**: `audio?.play('hurt')`
- **Kematian Burung**: `audio?.play('lose')`
- **Awal Pertandingan**: `audio?.play('start')`
- **Kemenangan Akhir**: `audio?.play('win')` (atau `'lose'` pada solo bila skor 0)

---

## Siklus Hidup & Pembersihan (`lifecycle`)

Fungsi `create()` mengembalikan objek `{ stop() }`:
- Membatalkan loop `requestAnimationFrame`.
- Membersihkan seluruh `setTimeout` aktif.
- Melepas listener kernel (`offInput()`).
- Melepas listener klik kanvas (`removeEventListener`).
- Penjaga `dt = Math.min((ts - lastTs) / 1000, 0.05)` mencegah lonjakan frame (*lag spike*).
