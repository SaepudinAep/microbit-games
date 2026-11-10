# Game: Endless Racer

| Atribut | Nilai |
|---|---|
| **`id`** | `endlessracer` |
| **Nama** | Endless Racer |
| **Ikon** | 🚗 |
| **File** | `games/endlessracer.js` |
| **Dokumen induk** | [06-games-catalog.md](../06-games-catalog.md) |

Balap *endless scroller* *top-down*: pemain menyusuri jalan 4 jalur dan menghindari kendaraan yang datang dari atas. Mendukung 1P hingga 4P.

## Mode

| `id` | Label | Sub | `players` |
|---|---|---|---|
| `1p` | 1 Player | Bertahan Sendirian | 1 |
| `2p` | 2 Player | Siapa Bertahan Lama? | 2 |
| `3p` | 3 Player | Adu Gesit Ber-3 | 3 |
| `4p` | 4 Player | Balapan Berempat | 4 |

## Spesifikasi Teknis

| Aspek | Nilai |
|---|---|
| **Canva** | 600 × 800 |
| **Jalan** | Kiri `80`, kanan `520` (lebar 440), 4 jalur, marka putus-putus |
| **Mobil pemain** | 36×60 px, kecepatan geser `320 px/dtk`, warna & label mengikuti slot fisik (P1 #4b83ff, P2 #ff9a2e, P3 #3ccf8e, P4 #b98cff) |
| **Halangan** | 36×60 px, 6 warna, kecepatan relatif acak (0.65–1.1×) |
| **Scroll** | Mulai `220 px/dtk`, naik `14 px/dtk` tiap detik, maks `600 px/dtk` |
| **Spawn** | Interval mulai 1.4 dtk, memendek ke min 0.6 dtk seiring waktu |
| **Posisi mulai** | Tersebar merata di jalan: $x = \text{ROAD\_LEFT} + (i + 0.5) \times \frac{\text{ROAD\_W}}{N} - \frac{\text{CAR\_W}}{2}$ (1P di tengah, 4P tepat di tiap 4 lajur) |

## Kontrol

| Perintah | Aksi |
|---|---|
| `99#` | Mulai permainan (pemain pertama `players[0]` atau klik kanvas) |
| `1#` / `3#` | Geser ke kiri |
| `2#` / `4#` | Geser ke kanan |
| `0#` | Berhenti geser (diam) |

## Mekanik & Audio

- Tabrakan dengan halangan → mobil hancur (tanda 💥 di lokasi crash), catat waktu `survived`.
- 1P: berakhir saat mobil hancur → tampil durasi bertahan.
- Multipemain (2P, 3P, 4P): berakhir saat **semua** mobil hancur → tampil pemenang dengan durasi bertahan terlama (atau seri bila waktu selisih < 80 ms).
- Mobil hanya bisa berpindah antar lajur dalam batas jalan (diclamp ke `ROAD_LEFT..ROAD_RIGHT-CAR_W`).
- **Efek suara:** `start`, `lose` (saat tabrakan).

## Lifecycle

- `create({canvas, kernel, players, mode, finish, audio})` → `{stop}`.
- Ready-state menunggu aba-aba `99#` dari pemain pertama (`players[0]`) atau klik kanvas.
- `finish()` dipanggil dengan **string** hasil (durasi bertahan / pemenang terlama / seri).
