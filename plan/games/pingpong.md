# Game: Ping Pong

| Atribut | Nilai |
|---|---|
| **`id`** | `pingpong` |
| **Nama** | Ping Pong |
| **Ikon** | 🏓 |
| **File** | `games/pingpong.js` |
| **Dokumen induk** | [06-games-catalog.md](../06-games-catalog.md) |

Tenis meja klasik berorientasi vertikal (aspek 3:4, 600×800). Player 1 di bawah, Player 2 / komputer di atas.

## Mode

| `id` | Label | Sub | `players` |
|---|---|---|---|
| `1p` | 1 Player | Lawan komputer | 1 |
| `2p` | 2 Player | Dua pemain berhadapan | 2 |

## Opsi Permainan

| Opsi | Label | Pilihan Nilai | Default | Efek |
|---|---|---|---|---|
| `speed` | Kecepatan Bola | `slow` (Lambat), `normal` (Normal), `fast` (Cepat) | `normal` | Mengatur kecepatan awal bola (280 / 380 / 480 px/dtk), batas kecepatan pantulan maksimal, dan kecepatan paddle komputer pada mode 1P |

## Spesifikasi Teknis

| Aspek | Nilai |
|---|---|
| **Canva** | 600 × 800 |
| **Paddle** | Panjang 110 px, tebal 16 px, kecepatan gerak 420 px/dtk |
| **Bola** | Radius 9 px, kecepatan awal 280 / 380 / 480 px/dtk (sesuai opsi) |
| **Poin kemenangan** | `WIN = 5` |
| **Posisi Awal** | P1 (bawah): `y = H - EDGE - PH`; P2/AI (atas): `y = EDGE` |
| **Reset Setelah Skor** | Seluruh paddle otomatis kembali ke posisi tengah (`x = W/2 - PW/2`) setiap kali skor bertambah |

## Kontrol

| Perintah | Aksi |
|---|---|
| `99#` | Mulai permainan (Player 1 saja — mulai hanya lewat `99#` atau klik layar) |
| `1#` / `3#` | Paddle ke kiri |
| `2#` / `4#` | Paddle ke kanan |
| `0#` | Paddle berhenti |

## Fisika & Audio

- Pantulan paddle: `vy` dibalik dan dipercepat `* 1.06` (maks 760 px/dtk); `vx` dibelokkan sesuai titik tumbuk (maks 520 px/dtk).
- Mode 1P: paddle atas dikendalikan AI sederhana (mengejar posisi bola saat bola menuju ke atas).
- Efek suara: `start`, `bounce` (panning kiri/kanan), `hit` (dengan `pan`), `score`, `win`/`lose`.

## Lifecycle

- `create({canvas, kernel, players, mode, finish, audio})` → `{stop}`.
- Ready-state: menunggu aba-aba `99#`/`5#`/Enter/Spasi/klik dari Player 1.
- `finish()` dipanggil dengan **string** hasil saat salah satu pemain mencapai `WIN = 5`.