# Game: Pecah Balok (Arkanoid / Breakout Multiplayer)

| Atribut | Nilai |
|---|---|
| **`id`** | `pecahbalok` |
| **Nama** | Pecah Balok |
| **Ikon** | 🧱 |
| **Kategori / Tag** | `Retro` |
| **File** | `games/pecahbalok.js` |
| **Dokumen induk** | [06-games-catalog.md](../06-games-catalog.md) |

Permainan arkade aksi retro multi-pemain (*competitive breakout / arkanoid battle*) di kanvas 1280×720 piksel. Pemain mengendalikan papan pemantul (*paddle*) di garis dasar horizontal yang sama untuk memantulkan bola dan menghancurkan susunan balok warna-warni secara bersamaan. Menampilkan mekanisme bebas halangan antar-paddle (*ghost overlap* ramah anak), perpindahan kepemilikan bola dan skor (*color transfer on bounce*), gelombang balok bertingkat (*multi-wave*), serta kapsul *power-up* seru (Expand, Multi-Ball, Fireball).

---

## Mode

| `id` | Label | Sub | `players` |
|---|---|---|---|
| `1p` | 1 Player | Solo | 1 |
| `2p` | 2 Player | Duel Balok | 2 |
| `4p` | 4 Player | Pesta Berempat | 4 |

---

## Spesifikasi Teknis

| Aspek | Nilai | Keterangan |
|---|---|---|
| **Canvas** | `1280 × 720 px` | Rasio standar 16:9 widescreen |
| **Target Usia** | **TK & SD (4–12 Tahun)** | Parameter toleran, papan lebar, bola santai |
| **Posisi Paddle Y** | `Y = 665 px` | Garis dasar bersama di bagian bawah kanvas |
| **Tinggi Paddle** | `20 px` | Sudut membulat dengan pencahayaan gradien |
| **Lebar Paddle** | 1P: `220 px`, 2P: `180 px`, 4P: `150 px` | Papan ekstra lebar, melebar $1.5\times$ saat efek *Expand* aktif |
| **Kecepatan Paddle** | `580 px/dtk` | Kecepatan geser mulus membantu menangkap bola |
| **Interaksi Antar Paddle** | *Non-blocking ghost overlap* | Paddle dapat saling menembus tanpa benturan fisik |
| **Kecepatan Bola** | Base `290 px/dtk`, Max `380 px/dtk` | Kecepatan santai ramah refleks anak; radius 13 px jelas terlihat di PID |
| **Sistem Bola** | 1 bola awal per pemain | Bola dapat dipantulkan oleh paddle mana pun & berganti warna kepemilikan |
| **Grid Balok** | 14 kolom × 6 baris (84 balok/wave) | Mulai di Y = 85 px (di bawah area aman HUD) |
| **Jenis Balok** | Normal (1 hit, 10 pt), Baja (2 hit, 25 pt), Emas (1 hit, 50 pt) | Emas berpeluang 80% menjatuhkan power-up |
| **Durasi Game** | `90 detik` | Hitung mundur waktu pertandingan |
| **Nyawa Awal** | `5 Nyawa` | Diwakili 5 ikon ❤️ pada kartu HUD agar tidak cepat game over |
| **Penalti Bola Jatuh** | -1 Nyawa (Tanpa penalti poin) | Poin tidak dikurangi agar anak tidak putus asa; respawn 1.0 dtk |
| **Kapsul Power-Up** | 45% peluang jatuh (kecepatan 110 px/dtk) | **EXPAND** (🟢 15s), **MULTI-BALL** (🟡 +1 bola), **FIREBALL** (🔴 10s tembus balok) |
| **Warna Khas Slot** | P1 Merah (`#EF4444`), P2 Biru (`#3B82F6`), P3 Hijau (`#22C55E`), P4 Kuning (`#EAB308`) | Sesuai slot fisik controller platform |

---

## Kontrol

| Perintah | Aksi | Keterangan |
|---|---|---|
| `99#` atau `5#` | Mulai permainan | Hanya dari `players[0]` atau klik canvas / Spasi |
| `3#` | **Miring Kiri** | Menggerakkan paddle ke kiri secara mulus |
| `4#` | **Miring Kanan** | Menggerakkan paddle ke kanan secara mulus |
| `0#` | **Datar / Netral** | Menghentikan paddle di posisi saat ini |
| `1#` & `2#` | Diabaikan | Tidak memengaruhi pergerakan paddle |

*Skema Keyboard: P1 = A / D (atau Panah Kiri/Kanan bila solo); P2 = Panah Kiri/Kanan.*

---

## Format Teks Selesai (`finish()`)

- **Mode 1P**: `Waktu Habis! Skor P1: {skor} ({⭐⭐⭐})`
- **Mode 2P & 4P (Ada Pemenang)**: `{Warna} (P{winner}) menang! P1 {s1} poin, P2 {s2} poin...`
- **Mode 2P & 4P (Seri)**: `Seri! P1 {s1} poin, P2 {s2} poin...`
