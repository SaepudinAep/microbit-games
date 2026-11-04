# Game: Dino Jump

| Atribut | Nilai |
|---|---|
| **`id`** | `dinorush` |
| **Nama** | Dino Jump |
| **Ikon** | 🦖 |
| **File** | `games/dinorush.js` |
| **Dokumen induk** | [06-games-catalog.md](../06-games-catalog.md) |

Endless *runner* menyerupai dino saat kehilangan koneksi (Google Dino). Tiap pemain
berada di **lintasan sendiri** yang tersusun rapi dari atas ke bawah, sehingga hingga
**4 pemain** bisa bermain bersamaan tanpa saling bertabrakan.

## Mode

| `id` | Label | Sub | `players` |
|---|---|---|---|
| `1p` | 1 Player | Bertahan Sendiri | 1 |
| `2p` | 2 Player | Dua Lintasan Sejajar | 2 |
| `3p` | 3 Player | Tiga Lintasan | 3 |
| `4p` | 4 Player | Empat Lintasan | 4 |

## Spesifikasi Teknis

| Aspek | Nilai |
|---|---|
| **Canva** | 600 × 800 |
| **Lintasan** | Tinggi `L = H / jumlah pemain` (800, 400, 266, atau 200 px) |
| **Dino** | 44 × 50 px; posisi X tetap di `96` |
| **Fisika lompat** | `GRAV = 1500`, `JUMP_V = -620` |
| **Kecepatan** | Mulai `220 px/dtk`, akselerasi `9`, maks `640 px/dtk` |
| **Rintangan** | Kaktus (harus dilompati — hanya aksi lompat) |
| **Warna** | P1 biru, P2 oranye, P3 hijau, P4 ungu |

## Kontrol

| Perintah | Aksi |
|---|---|
| `99#` | Mulai permainan (Player 1 saja) |
| `1#`–`9#` (selain `99`) | Lompat — tombol micro:bit/keyboard apa pun |
| `0#` | Netral (tidak ada aksi) |

> Catatan keyboard: untuk pengujian dengan 2+ keyboard, kernel hanya memberi skema unik
> (panah vs WASD) untuk 2 slot; mode 3P/4P sebaiknya memakai micro:bit asli agar kontrol benar-benar terpisah.

## Aturan & Skor

- **Skor** = jarak tempuh (`dist`, meter) yang bertambah seiring kecepatan lintasan.
- Menabrak rintangan → dino pemain mati (lintasan berhenti).
- Permainan selesai saat **semua lintasan mati**; pemenang = pemain dengan jarak terjauh
  (bertahan paling lama). Seri bila selisih jarak < 5 m.
- Mode `1p` (solo): langsung tampil total jarak bertahan.
- Efek suara: `start`, `click` (lompat), `lose` (mati), `score` (pilihan).

## Lifecycle

- `create({canvas, kernel, players, mode, finish, audio})` → `{stop}`.
- Ready-state menunggu aba-aba `99#` dari Player 1.
- `finish()` dipanggil dengan **string** hasil (`"P1 Menang! (340.5 m)"` / `"Seri! Semua ..."` / `"Bertahan X meter! 🦖"`).