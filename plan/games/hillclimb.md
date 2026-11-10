# Game: Hill Climbing

| Atribut | Nilai |
|---|---|
| **`id`** | `hillclimb` |
| **Nama** | Hill Climbing |
| **Ikon** | ⛰️ |
| **File** | `games/hillclimb.js` |
| **Dokumen induk** | [06-games-catalog.md](../06-games-catalog.md) |

Permainan balapan adu daki bukit fisika 2D (*side-scrolling hill climb racer*). Pemain mengendalikan mobil pickup melintasi kontur perbukitan bergelombang sepanjang 500 meter (20.000 px). Tantangan utama permainan adalah mengelola momentum dan menghemat bensin dengan memanfaatkan turunan lereng agar tidak mogok sebelum mencapai garis finis.

Game ini mengusung format layar terbagi (*split viewport*) adaptif: 1P layar penuh, 2P atas-bawah, dan 4P grid 2×2, dengan lintasan bukit yang identik (*single shared random seed*) untuk semua pemain dalam satu sesi pertandingan.

---

## Mode

| `id` | Label | Sub | `players` | Tata Letak Viewport |
|---|---|---|---|---|
| `1p` | 1 Player | Solo | 1 | 1 Viewport penuh (1280 × 720 px) |
| `2p` | 2 Player | Adu balap | 2 | 2 Viewport bertumpuk atas-bawah (1280 × 358 px) |
| `4p` | 4 Player | Balap berempat | 4 | 4 Viewport grid 2×2 (638 × 358 px) |

*Catatan: Tidak ada mode 3 pemain. Tombol mode pada lobi menyesuaikan jumlah controller micro:bit yang terhubung secara otomatis.*

---

## Spesifikasi Teknis

| Aspek | Nilai | Keterangan |
|---|---|---|
| **Canvas** | `1280 × 720 px` | Resolusi standar 16:9 widescreen |
| **Pemisah Viewport** | `4 px` | Garis pembatas gelap antar viewport pemain |
| **Panjang Lintasan** | `20000 px (500 meter)` | Skala konversi: `1 meter = 40 px` |
| **Awal Lintasan Datar** | `600 px` | Area persiapan start yang rata dan mulus |
| **Kemiringan Medan Maksimal** | `25 derajat` | Dibatasi matematis pada turunan cosinus $\le \tan(25^\circ)$ |
| **Amplitudo Puncak Bukit** | `±130 px` | Variasi kontur gelombang bukit |
| **Skala Kamera Dunia** | `Math.min(1.2, vp.h / 400)` | 1.2× untuk 1P, 0.9× untuk 2P dan 4P |
| **Posisi Fokus Kamera** | X 30%, Y 60% viewport | Kamera vertikal dihaluskan dengan interpolasi lerp |
| **Akselerasi Mesin (`ENGINE_ACC`)**| `420 px/dtk²` | Lebih besar dari hambatan gravitasi lereng maksimal ($380.3\text{ px/dtk}^2$) |
| **Gravitasi Lereng (`GRAV`)** | `900 px/dtk²` | Komponen gravitasi $a_g = -900 \cdot \sin(\theta)$ |
| **Redaman Gesekan (`DRAG`)** | `0.35 per detik` | Hambatan udara dan gesekan mekanis |
| **Gigi Mundur (`ENGINE_REV`)** | `200 px/dtk²` | Kecepatan mundur maksimal $-140\text{ px/dtk}$ (tanpa bensin) |
| **Kecepatan Maksimal** | `520 px/dtk` | Batas kecepatan puncak mobil |
| **Torsi Angkat Gas (`PITCH_TORQUE_ACC`)** | `9.0 rad/dtk²` | Mengangkat moncong mobil saat akselerasi (*wheelie*) |
| **Torsi Turun Rem (`PITCH_TORQUE_BRAKE`)** | `14.0 rad/dtk²` | Menurunkan moncong mobil saat pengereman maju (*dive*) |
| **Pegas Suspensi (`PITCH_SPRING`)** | `11.0` | Daya pemulih keselarasan orientasi mobil dengan sudut lereng |
| **Redaman Suspensi (`PITCH_DAMP`)** | `4.0` | Meredam osilasi getaran putaran sasis |
| **Ambang Terjungkal (`FLIP_DIFF`)** | `1.25 rad (~72°)` | Selisih sudut sasis vs lereng yang memicu mobil terbalik (*flip*) |
| **Bensin Awal & Maksimal** | `100 unit` | Tangki bahan bakar penuh saat start |
| **Konsumsi Bensin (`FUEL_USE`)** | `10.3 unit/dtk` | Hanya berkurang saat tombol gas ditekan |
| **Kaleng Bensin (`FUEL_PICKUP`)**| `+34 unit` | Tersebar tiap ~2400 px dengan jitter $\pm 300\text{ px}$ |
| **Peringatan Bensin Rendah** | `< 20%` | Bilah bensin kedip merah & audio peringatan tiap 1 dtk |
| **Warna Pemain Resmi** | P1 `#4b83ff`, P2 `#ff9a2e`, P3 `#3ccf8e`, P4 `#b98cff` | Mengikuti nomor slot fisik controller |

---

## Kontrol

Perintah gas dan rem bersifat **menetap** (*latching*) sampai ada perintah baru yang menggantikannya:

| Perintah | Aksi | Keterangan |
|---|---|---|
| `99#` (Hanya dari `players[0]`) | Memulai balapan (memicu hitung mundur 3-2-1) | Klik canvas juga berfungsi saat fase siap |
| `1#`, `4#`, atau `5#` | **GAS** (Akselerasi maju) | Mengonsumsi bensin saat aktif |
| `2#` atau `3#` | **REM / MUNDUR** | Mengerem maju; bila diam/mundur, bergerak mundur tanpa bensin |
| `0#` | **LEPAS** (Netral) | Mobil meluncur bebas sesuai kelembaman & gravitasi |
| Perintah lain | Diabaikan | Tidak memengaruhi kontrol mobil |

*Skema Keyboard: P1 memakai Panah Atas/Kanan (Gas), Panah Bawah/Kiri (Rem). P2 memakai W/D (Gas), S/A (Rem). Melepas tombol mengirim perintah `0#`.*

---

## Aturan Balapan & Penentuan Pemenang

1. **Kondisi Selesai Pemain (`done`)**:
   - Pemain dinyatakan selesai jika:
     (a) Berhasil melintasi garis finis ($x \ge 20000\text{ px}$).
     (b) Terjungkal / terbalik (*flipped*): sudut sasis mobil menyimpang melebihi $1.25\text{ rad}$ ($\approx 72^\circ$) dari kontur lereng bukit akibat gas terlalu agresif di puncak bukit atau salah mengontrol pendaratan. Mobil terbalik di tanah, mengeluarkan efek ledakan/asap `💥`, dan berstatus `crashed`.
     (c) Kehabisan bensin ($fuel = 0$) dan mobil terhenti ($|vx| < 5\text{ px/dtk}$) selama 1.5 detik berturut-turut.
2. **Kondisi Berakhirnya Permainan**:
   - Balapan berakhir seketika saat ada pemain yang berhasil mencapai garis finis (dengan jeda perayaan 2 detik), ATAU ketika seluruh pemain sudah berstatus `done` (habis bensin atau terjungkal).
3. **Peringkat & Juara**:
   - Jika ada yang finis: Pemenang adalah pemain yang finis tercepat.
   - Jika tidak ada yang finis: Pemenang adalah pemain dengan jarak tempuh terjauh (meskipun terjungkal di titik terjauh).

---

## Format Teks Selesai (`finish()`)

Teks hasil akhir yang dikirimkan ke callback `finish(teks)`:

- **Mode 1 Pemain (Solo)**:
  - Berhasil finis: `Selesai! 500 m dalam 78.4 dtk`
  - Terjungkal: `Terjungkal di 234 m!`
  - Bensin habis: `Bensin habis di 312 m`

- **Mode 2 dan 4 Pemain (Ada yang Finis)**:
  - Contoh 2P: `P2 menang! P1 412 m (terjungkal), P2 500 m (finis)`
  - Contoh 4P: `P1 menang! P1 500 m (finis), P2 445 m, P3 380 m (terjungkal), P4 490 m`
  *(Mencantumkan seluruh pemain berurutan berdasarkan nomor slot, dengan penanda `(finis)` atau `(terjungkal)`)*

- **Mode 2 dan 4 Pemain (Tidak Ada yang Finis)**:
  - Contoh: `P3 terjauh! P1 210 m (terjungkal), P2 188 m, P3 305 m, P4 240 m (terjungkal)`

---

## Tabel Konstanta Permainan

| Nama Konstanta | Tipe | Nilai | Deskripsi |
|---|---|---|---|
| `TRACK_LENGTH_PX` | `number` | `20000` | Panjang lintasan balap (px) |
| `METER` | `number` | `40` | Skala rasio piksel per meter |
| `SEGMENT_W` | `number` | `240` | Jarak antar titik kontrol interpolasi bukit |
| `MAX_SLOPE_DEG` | `number` | `25` | Derajat kemiringan bukit maksimum |
| `ENGINE_ACC` | `number` | `420` | Tenaga dorong akselerasi mesin (px/dtk²) |
| `GRAV` | `number` | `900` | Konstanta gravitasi lereng (px/dtk²) |
| `DRAG` | `number` | `0.35` | Koefisien friksi redaman |
| `BRAKE_DEC` | `number` | `700` | Daya deselerasi pengereman (px/dtk²) |
| `ENGINE_REV` | `number` | `200` | Akselerasi gigi mundur (px/dtk²) |
| `REV_MAX_SPEED` | `number` | `-140` | Batas kecepatan mundur maksimal (px/dtk) |
| `MAX_SPEED` | `number` | `520` | Batas kecepatan maju maksimal (px/dtk) |
| `PITCH_TORQUE_ACC` | `number` | `9.0` | Torsi angkat moncong saat gas (wheelie) |
| `PITCH_TORQUE_BRAKE` | `number` | `14.0` | Torsi turun moncong saat rem |
| `PITCH_SPRING` | `number` | `11.0` | Kekuatan pegas suspensi ke arah sudut lereng |
| `PITCH_DAMP` | `number` | `4.0` | Redaman ayunan putaran suspensi |
| `FLIP_DIFF` | `number` | `1.25` | Ambang selisih sudut untuk terjungkal (~72°) |
| `FUEL_MAX` | `number` | `100` | Batas kapasitas bahan bakar (unit) |
| `FUEL_USE` | `number` | `10.3` | Konsumsi bensin per detik saat gas aktif |
| `FUEL_PICKUP` | `number` | `34` | Penambahan bensin per kaleng bahan bakar |
| `FUEL_SPACING` | `number` | `2400` | Jarak rata-rata sebaran kaleng bensin |

---

## Lifecycle dan Pembersihan

Modul mengekspor fungsi `create(options)` yang mengembalikan objek `{ stop() }`:
- `stop()` membatalkan frame loop animasi `cancelAnimationFrame`.
- Menghapus timer `clearTimeout` (jeda `finish`).
- Melepas listener kejadian kernel via callback unsubscribe `offKernel()`.
- Menghapus event listener klik mouse pada elemen canvas.
- Menjamin tidak ada kebocoran memori atau eksekusi callback liar saat pengguna kembali ke menu utama lobi shell.

