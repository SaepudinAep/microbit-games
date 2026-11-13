# Game: Bomberman (Arena Ledak Multiplayer)

| Atribut | Nilai |
|---|---|
| **`id`** | `bomberman` |
| **Nama** | Bomberman |
| **Ikon** | 💣 |
| **Kategori / Tag** | `Retro` |
| **File** | `games/bomberman.js` |
| **Dokumen induk** | [06-games-catalog.md](../06-games-catalog.md) |

Permainan arkade aksi ledak retro multi-pemain (*multiplayer grid arena*) di kanvas 1280×720 piksel. Pemain mengendalikan karakter penaruh bom di arena kotak-kotak (17 kolom × 11 baris) dengan pilar baja permanen dan balok bata yang dapat dihancurkan. Hancurkan balok untuk mengumpulkan power-up dan ledakkan lawan untuk meraih skor tertinggi!

---

## Mode

| `id` | Label | Sub | `players` |
|---|---|---|---|
| `1p` | 1 Player | Solo vs 3 AI Bots | 1 (dengan evaluasi 1–3 Bintang) |
| `2p` | 2 Player | Duel Ledak | 2 |
| `4p` | 4 Player | Pesta Berempat | 4 |

---

## Posisi Awal & Skema Warna Pemain (P1–P4)

Setiap pemain memiliki posisi spawn aman di 4 sudut arena dengan *safe zone* 3 petak bebas bata:
- **Player 1 (P1):** Merah (`#EF4444`) — Sudut Kiri-Atas `(c: 1, r: 1)`
- **Player 2 (P2):** Biru (`#3B82F6`) — Sudut Kanan-Bawah `(c: 15, r: 9)`
- **Player 3 (P3):** Hijau (`#22C55E`) — Sudut Kiri-Bawah `(c: 1, r: 9)`
- **Player 4 (P4):** Kuning (`#EAB308`) — Sudut Kanan-Atas `(c: 15, r: 1)`

---

## Spesifikasi Teknis

| Aspek | Nilai | Keterangan |
|---|---|---|
| **Canvas** | `1280 × 720 px` | Rasio standar 16:9 widescreen |
| **Grid Arena** | 17 kolom × 11 baris | Ukuran sel `56 × 56 px` (total $952 \times 616\text{ px}$) |
| **Offset Grid** | `OX = 164 px`, `OY = 72 px` | Terpusat dengan safe margin 164 px di sisi kiri-kanan dan 72 px di atas |
| **Corner Sliding Assist** | `14 px` | Auto-align halus saat menyerempet sudut pilar agar tidak tersangkut latensi BLE |
| **Kecepatan Dasar** | `160 px/dtk` | Kecepatan jalan awal pemain (maksimal `235 px/dtk` dengan sepatu) |
| **Waktu Bom Meledak** | `2.5 detik` | Animasi berdenyut sebelum meledak membentuk salib `+` |
| **Durasi Ledakan Api** | `0.6 detik` | Api membakar balok dan melukai karakter |
| **Jangkauan Api Awal** | `2 petak` | Perluas hingga maks 5 petak dengan power-up 🔥 |
| **Reaksi Berantai** | Aktif | Bom yang terkena lidah api seketika meledak |
| **Pass-through Awal** | Aktif | Pemain dapat keluar dari petak bom yang baru saja ditaruhnya |
| **Durasi Game** | `90 detik` | Hitung mundur waktu permainan |
| **Nyawa Awal** | `3 Nyawa` | Diwakili ikon ❤️ pada kartu HUD |
| **Durasi Respawn** | `1.0 detik` | Jeda sebelum muncul kembali di sudut awal |
| **Durasi Kebal** | `3.0 detik` | Animasi kedip transparan pasca-respawn |
| **Skor Balok Bata** | `+10 poin` | Balok hancur memiliki peluang drop power-up ~38% |
| **Skor Ledakkan Lawan** | `+100 poin` | Diberikan kepada penaruh bom saat ledakannya mengenai pemain lawan |

---

## Power-Up Item

Muncul secara acak di balik balok bata yang hancur:
1. **Extra Bomb (💣):** Menambah batas maksimal bom aktif bersamaan (+1, batas maks 4 bom).
2. **Fire Up (🔥):** Menambah radius panjang lidah api ledakan (+1 petak, batas maks 5 petak).
3. **Speed Up (👟):** Meningkatkan kelincahan jalan karakter (+25 px/dtk, batas maks 235 px/dtk).

---

## Kontrol

| Perintah | Aksi | Keterangan |
|---|---|---|
| `99#` | Mulai permainan | Dari P1 atau klik canvas / Spasi saat standby |
| `1#` | **Atas** | Bergerak ke atas |
| `2#` | **Bawah** | Bergerak ke bawah |
| `3#` | **Kiri** | Bergerak ke kiri |
| `4#` | **Kanan** | Bergerak ke kanan |
| `0#` | **Netral / Berhenti** | Berhenti di tempat (memudahkan penempatan bom) |
| `5#` | **Taruh Bom** | Menaruh bom di petak posisi karakter saat ini |

### Fallback Keyboard
- **P1:** `W` / `A` / `S` / `D` untuk bergerak, `Spasi` untuk taruh bom.
- **P2:** Tombol Panah (`↑`, `↓`, `←`, `→`) untuk bergerak, `Enter` untuk taruh bom.
- **Mode 1P:** Melawan 3 Bot AI yang aktif berpatroli, menghindari api ledakan, dan menaruh bom saat berada di dekat balok bata atau musuh.

---

## Format Hasil Akhir (`finish`)

Saat waktu 90 detik habis:
- **Mode 1P:** Menampilkan skor dan rating Bintang (⭐/⭐⭐/⭐⭐⭐) berdasarkan skor perolehan.
- **Mode 2P & 4P:** Menampilkan peringkat skor tertinggi pemain dan penetapan Juara 1 (`🏆 P1 Juara 1!`).
