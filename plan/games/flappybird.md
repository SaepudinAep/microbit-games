# Game: Flappy Bird

| Atribut | Nilai |
|---|---|
| **`id`** | `flappybird` |
| **Nama** | Flappy Bird |
| **Ikon** | 🐦 |
| **File** | `games/flappybird.js` |
| **Dokumen induk** | [06-games-catalog.md](../06-games-catalog.md) |

Permainan arkade terbang bersama (*multiplayer shared arena*). Semua burung pemain terbang di arena yang sama melewati rintangan celah pipa yang identik secara simultan tanpa saling bertabrakan. Pemain dengan skor tertinggi atau yang bertahan paling lama keluar sebagai pemenang.

---

## Mode

| `id` | Label | Sub | `players` |
|---|---|---|---|
| `1p` | 1 Player | Sendiri | 1 |
| `2p` | 2 Player | Berdua | 2 |
| `3p` | 3 Player | Bertiga | 3 |
| `4p` | 4 Player | Berempat | 4 |

---

## Opsi Permainan (`options`)

| Kunci | Label UI | Nilai Default | Pilihan Tersedia | Keterangan |
|---|---|---|---|---|
| `lives` | Nyawa | `3` | `1`, `3` | Jumlah nyawa per burung (1 nyawa = langsung mati; 3 nyawa = kebal 1.5 dtk di celah pipa berikutnya) |
| `end` | Game selesai (2 pemain atau lebih) | `'all'` | `'all'`, `'last'` | `'all'` = tanding sampai semua gugur; `'last'` = selesai saat sisa 1 burung hidup |
| `level` | Tingkat | `'mudah'` | `'mudah'`, `'sedang'`, `'sulit'` | Menentukan lebar celah dan kecepatan awal pipa |

### Pengaruh Tingkat Kesulitan (`level`)

| Tingkat | Lebar Celah Pipa (`gap`) | Kecepatan Awal (`speed`) |
|---|---|---|
| **Mudah** | `210 px` | `150 px/dtk` |
| **Sedang** | `170 px` | `180 px/dtk` |
| **Sulit** | `140 px` | `210 px/dtk` |

---

## Spesifikasi Teknis

| Aspek | Nilai | Keterangan |
|---|---|---|
| **Canvas** | `800 × 600 px` | Rasio 4:3, tampil proporsional di panggung panggung dengan letterbox gelap |
| **Lantai & Langit** | Lantai di `y = 540`, langit di `y = 0` | Menyentuh lantai atau langit dihitung sebagai tabrakan |
| **Ukuran Burung** | `34 × 26 px` | Digambar murni dengan bentuk canvas (badan elips, sayap, mata, paruh) |
| **Hitbox Burung** | 85 % dari ukuran visual | Toleransi tabrakan untuk kompensasi latensi nirkabel BLE |
| **Posisi Horizontal (X)** | `x = 160 + (indeks × 30) px` | Posisi X tetap (staggered agar tidak menumpuk), hanya sumbu Y yang bergerak |
| **Gravitasi** | `GRAV = 1400 px/dtk²` | Percepatan jatuh ke bawah |
| **Kepakan (Flap)** | `FLAP_V = -420 px/dtk` | Menyetel kecepatan vertikal langsung (bukan menambah) |
| **Batas Jatuh** | `MAX_FALL = 700 px/dtk` | Kecepatan terminal vertikal maksimal |
| **Anti-Spam Flap** | `80 ms` | Jeda minimum antar kepakan per burung untuk mencegah spam tombol |
| **Pipa** | Lebar `70 px`, celah ber-seed RNG | Pipa sama persis untuk semua pemain |
| **Akselerasi Pipa** | `+4 px/dtk` tiap detik | Maksimal kecepatan `320 px/dtk` |
| **Jarak Antar Pipa** | `kecepatan × 1.6 detik` | Dihitung saat pipa dibuat, selalu memberi ruang manuver |
| **Margin Celah** | Min `60 px` dari langit/lantai | Pergeseran vertikal maksimal antar celah berturut-turut `150 px` |
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
  - `lives = options.lives ?? 1`.
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
  - **Multiplayer - `'all'`**: Berakhir setelah seluruh burung mati. Burung yang masih hidup terus bermain sendirian mengumpulkan skor.
  - **Multiplayer - `'last'`**: Berakhir seketika tersisa 1 burung yang masih hidup, dan burung tersebut dinyatakan menang.

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

