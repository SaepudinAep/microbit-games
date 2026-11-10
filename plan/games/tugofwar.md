# Game: Tarik Tambang (Tug of War)

| Atribut | Nilai |
|---|---|
| **`id`** | `tugofwar` |
| **Nama** | Tarik Tambang |
| **Ikon** | 🪢 |
| **File** | `games/tugofwar.js` |
| **Dokumen induk** | [06-games-catalog.md](../06-games-catalog.md) |

Permainan pesta adu kekuatan dan koordinasi (*multiplayer team battle*). Dua tim (Tim Kiri vs Tim Kanan) menarik seutas tali tambang horizontal. Setiap tarikan dari tombol micro:bit atau keyboard menggerakkan tali ke arah sisi tim masing-masing.

Game ini mengusung format turnamen otomatis **Best of 3 Ronde** (tim pertama yang mengumpulkan **2 kemenangan ronde** memenangkan pertandingan) tanpa menu opsi konfigurasi yang mengacaukan kesederhanaan permainan.

---

## Mode

| `id` | Label | Sub | `players` | Deskripsi Tim |
|---|---|---|---|---|
| `2p` | 2 Player | Satu lawan satu | 2 | P1 (Tim Kiri) vs P2 (Tim Kanan) |
| `4p` | 4 Player | Dua lawan dua | 4 | Tim Kiri (P1 & P2) vs Tim Kanan (P3 & P4) |

*Catatan: Tidak ada mode 1P atau 3P. Shell secara otomatis hanya menampilkan tombol 2P dan 4P, serta menonaktifkan mode yang melebihi jumlah controller terhubung.*

---

## Spesifikasi Teknis

| Aspek | Nilai | Keterangan |
|---|---|---|
| **Canvas** | `1280 × 720 px` | Resolusi standar 16:9 widescreen |
| **Area Aman (Safe Margin)** | `40 px` | Teks HUD dan chip pemain berada dalam batas aman layar |
| **Garis Kemenangan Kiri** | `x = 220` | Posisi bendera tali jika Tim Kiri menang ronde penuh |
| **Garis Kemenangan Kanan** | `x = 1060` | Posisi bendera tali jika Tim Kanan menang ronde penuh |
| **Posisi Tali** | `y = 420` | Tali membentang horizontal dari $x = 160$ hingga $x = 1120$ |
| **Rentang Posisi Tali (`ropeX`)** | $[-1.0, 1.0]$ | $0$ di tengah ($x = 640$), negatif = Kiri, positif = Kanan |
| **Impuls Tarikan (`PULL_IMPULSE`)** | `0.12` | Kecepatan tali yang ditambahkan per satu tarikan valid |
| **Redaman Tali (`ROPE_DRAG`)** | `2.0` | Koefisien redaman eksponensial $v \leftarrow v \cdot e^{-\text{drag} \cdot \Delta t}$ |
| **Batas Laju Tarikan** | `8 tarikan/dtk` | Jeda minimum `125 ms` antar tarikan valid per pemain |
| **Durasi Ronde Maksimal** | `45 detik` | Batas waktu sebelum penentuan jarak / sudden death |
| **Ambang Sudden Death** | `\|ropeX\| >= 0.02` | Jika waktu habis dan seri, ronde lanjut sampai ada selisih |
| **Jendela Bonus Kompak** | `200 ms` | Toleransi waktu tarikan antar rekan setim (khusus mode 4P) |
| **Pengali Bonus Kompak** | `1.5×` | Nilai impuls tarikan jika dilakukan kompak bersamaan |
| **Target Kemenangan** | `2 Ronde` | Format pertandingan maksimal 3 ronde (*Best of 3*) |
| **Warna Tim Netral** | Tim Kiri `#e53935` (Merah), Tim Kanan `#fdd835` (Kuning) | Tidak bentrok dengan warna slot individual |
| **Warna Pemain Resmi** | P1 `#4b83ff`, P2 `#ff9a2e`, P3 `#3ccf8e`, P4 `#b98cff` | Mengikuti nomor slot fisik controller |

---

## Kontrol

| Perintah | Aksi |
|---|---|
| `99#` (Hanya dari `players[0]`) | Memulai permainan dari fase siap (memicu hitung mundur 3-2-1) |
| Klik canvas | Memulai permainan (alternatif mulai di fase siap) |
| `1#`, `2#`, `3#`, `4#`, atau `5#` | Masing-masing dihitung sebagai **satu tarikan** tali |
| `0#` dan perintah lain | Diabaikan sepenuhnya (tidak memberi tarikan) |
| Tarikan sebelum `"TARIK!"` | Diabaikan sepenuhnya saat fase `waiting` dan `countdown` |

*Skema Keyboard: Pemain 1 memakai tombol Panah (mengirim perintah 1–4 saat ditekan), Pemain 2 memakai tombol WASD.*

---

## Aturan dan Sistem Penilaian

### 1. Pembagian Tim
- **Mode 2P**: `players[0]` = Tim Kiri, `players[1]` = Tim Kanan.
- **Mode 4P**: `players[0]` & `players[1]` = Tim Kiri, `players[2]` & `players[3]` = Tim Kanan.

### 2. Fisika & Bonus Kompak
1. Setiap tarikan valid menambah kecepatan tali:
   - Tim Kiri: `ropeV -= multiplier * PULL_IMPULSE`
   - Tim Kanan: `ropeV += multiplier * PULL_IMPULSE`
2. Pada mode 4P, jika pemain menarik tali dan rekan setimnya menarik dalam rentang `200 ms` sebelumnya (dan belum dipasangkan), tarikan bernilai `1.5×` (`PULL_IMPULSE * 1.5`), efek kilau emas muncul di antara kedua figur, dan audio `powerup` berbunyi stereo.
3. Satu tarikan rekan hanya dapat dipasangkan tepat satu kali (*anti-double-pairing*).

### 3. Kemenangan Ronde & Pertandingan
1. **Kemenangan Tepi Langsung**: Jika tali terseret hingga melewati garis batas (`ropeX <= -1.0` untuk Tim Kiri atau `ropeX >= 1.0` untuk Tim Kanan).
2. **Kemenangan Batas Waktu**: Jika waktu 45 detik habis:
   - Tim dengan tali lebih condong ke sisinya dinyatakan menang ronde.
   - Bila posisi tali tepat di tengah ($|\text{ropeX}| < 0.02$), sistem memasuki status **Sudden Death** tanpa batas waktu sampai terjadi selisih minimal $0.02$.
3. Tim yang pertama mencapai 2 kemenangan ronde dinobatkan sebagai juara pertandingan.

---

## Format Teks Selesai (`finish()`)

Teks hasil akhir yang diteruskan ke callback `finish(teks)`:

- **Mode 2 Pemain**:
  - `P1 menang! Skor ronde 2-0`
  - `P1 menang! Skor ronde 2-1`
  - `P2 menang! Skor ronde 2-0`
  - `P2 menang! Skor ronde 2-1`
  *(Menggunakan nomor slot sebenarnya dari pemain yang menang)*

- **Mode 4 Pemain**:
  - `Tim Kiri (P1 & P2) menang! Skor ronde 2-0`
  - `Tim Kiri (P1 & P2) menang! Skor ronde 2-1`
  - `Tim Kanan (P3 & P4) menang! Skor ronde 2-0`
  - `Tim Kanan (P3 & P4) menang! Skor ronde 2-1`
  *(Menggunakan label slot sebenarnya dari anggota masing-masing tim)*

---

## Tabel Konstanta Permainan

| Nama Konstanta | Tipe | Nilai | Deskripsi |
|---|---|---|---|
| `CANVAS_WIDTH` | `number` | `1280` | Lebar bidang gambar canvas (px) |
| `CANVAS_HEIGHT` | `number` | `720` | Tinggi bidang gambar canvas (px) |
| `COUNTDOWN_SEC` | `number` | `3` | Durasi hitung mundur awal ronde (detik) |
| `ROUNDS_TO_WIN` | `number` | `2` | Jumlah ronde yang dibutuhkan untuk menang |
| `MAX_ROUNDS` | `number` | `3` | Maksimal ronde dalam satu pertandingan |
| `ROUND_MAX_SEC` | `number` | `45` | Batas durasi normal per ronde (detik) |
| `ROUND_END_DELAY` | `number` | `2.5` | Jeda banner pengumuman hasil ronde (detik) |
| `FINISH_DELAY_MS` | `number` | `600` | Jeda sebelum memanggil `finish()` (ms) |
| `PULL_MAX_PER_SEC` | `number` | `8` | Batas frekuensi tarikan maksimal per pemain |
| `PULL_MIN_INTERVAL`| `number` | `0.125` | Interval waktu minimum antar tarikan (detik) |
| `PULL_IMPULSE` | `number` | `0.12` | Kekuatan dorongan kecepatan per tarikan |
| `ROPE_DRAG` | `number` | `2.0` | Koefisien redaman kelembaman tali |
| `ROPE_RANGE` | `number` | `420` | Jarak piksel dari titik tengah ke garis menang |
| `TEAM_SYNC_MS` | `number` | `200` | Jendela toleransi bonus kompak (ms) |
| `SYNC_MULTIPLIER` | `number` | `1.5` | Pengali impuls bonus kompak |
| `SUDDEN_DEATH_THRESHOLD` | `number` | `0.02` | Ambang penentu kemenangan saat sudden death |

---

## Lifecycle dan Pembersihan

Modul mengekspor fungsi `create(options)` yang mengembalikan objek `{ stop() }`:
- `stop()` membatalkan frame loop animasi `cancelAnimationFrame`.
- Menghapus timer `clearTimeout` (jeda `finish` dan jeda ronde).
- Melepas listener kejadian kernel via callback unsubscribe `offKernel()`.
- Menghapus event listener klik mouse pada elemen canvas.
- Menjamin tidak ada kebocoran memori atau eksekusi callback liar saat pengguna kembali ke menu utama lobi shell.

