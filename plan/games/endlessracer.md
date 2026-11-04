# Game: Endless Racer

| Atribut | Nilai |
|---|---|
| **`id`** | `endlessracer` |
| **Nama** | Endless Racer |
| **Ikon** | 🚗 |
| **File** | `games/endlessracer.js` |
| **Dokumen induk** | [06-games-catalog.md](../06-games-catalog.md) |

Balap *endless scroller* *top-down*: pemain menyusuri jalan 4 jalur dan menghindari kendaraan yang datang dari atas.

## Mode

| `id` | Label | Sub | `players` |
|---|---|---|---|
| `1p` | 1 Player | Bertahan Sendirian | 1 |
| `2p` | 2 Player | Siapa Bertahan Lama? | 2 |

## Spesifikasi Teknis

| Aspek | Nilai |
|---|---|
| **Canva** | 600 × 800 |
| **Jalan** | Kiri `80`, kanan `520` (lebar 440), 4 jalur, marka putus-putus |
| **Mobil pemain** | 36×60 px, kecepatan geser `320 px/dtk` |
| **Halangan** | 36×60 px, 6 warna, kecepatan relatif acak (0.6–1.1×) |
| **Scroll** | Mulai `220 px/dtk`, naik `14 px/dtk` tiap detik, maks `600 px/dtk` |
| **Spawn** | Interval mulai 1.4 dtk, memendek ke min 0.6 dtk seiring waktu |
| **Posisi mulai** | 1P di tengah; 2P di jalur kiri & kanan |

## Kontrol

| Perintah | Aksi |
|---|---|
| `99#` | Mulai permainan (Player 1 saja) |
| `1#` / `3#` | Geser ke kiri |
| `2#` / `4#` | Geser ke kanan |
| `0#` | Berhenti geser (diam) |

## Mekanik & Audio

- Tabrakan dengan halangan → mobil hancur, catat waktu `survived`.
- 1P: berakhir saat mobil hancur → tampil durasi bertahan. 2P: berakhir saat **semua** mobil hancur
  → tampil pemenang dengan durasi bertahan terlama (atau seri bila selisih < 50 ms).
- Mobil hanya bisa berpindah antar lajur dalam batas jalan (diclamp ke `ROAD_LEFT..ROAD_RIGHT-CAR_W`).
- **Efek suara:** `start`, `lose` (saat tabrakan).

## Lifecycle

- `create({canvas, kernel, players, mode, finish, audio})` → `{stop}`.
- Ready-state menunggu aba-aba `99#` dari Player 1.
- `finish()` dipanggil dengan **string** hasil (durasi bertahan / pemenang terlama / seri).