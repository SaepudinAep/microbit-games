# Game: Space Invaders

| Atribut | Nilai |
|---|---|
| **`id`** | `spaceinvaders` |
| **Nama** | Space Invaders |
| **Ikon** | 👾 |
| **File** | `games/spaceinvaders.js` |
| **Dokumen induk** | [06-games-catalog.md](../06-games-catalog.md) |

Pemain di bawah menembak pasukan alien yang bergerak turun. Mendukung 1P (Solo) dan 2P (Co-op).

## Mode

| `id` | Label | Sub | `players` |
|---|---|---|---|
| `1p` | 1 Player | Misi Tempur Solo | 1 |
| `2p` | 2 Player | Co-op Tempur Berdua | 2 |

## Spesifikasi Teknis

| Aspek | Nilai |
|---|---|
| **Canva** | 600 × 800 |
| **Pesawat** | 38 × 22 px, nyawa 3, warna per pemain (P1 biru, P2 oranye) |
| **Grid alien** | 6 kolom × 4 baris (36×24 px), harga poin rekor `[30, 20, 10, 10]` per baris |
| **Bunker** | 4 blok pelindung (54×34 px, HP 12) di atas pemain |
| **Latar** | Starfield 45 bintang bergerak |
| **Ekstra** | Proyektil pemain & alien, partikel ledakan, efek kedip saat invulnerable |

## Kontrol

| Perintah | Aksi |
|---|---|
| `99#` | Mulai permainan (Player 1 saja) |
| `5#` | Alternatif mulai (juga menembak saat bermain) |
| `1#` / `3#` | Pesawat ke kiri |
| `2#` / `4#` | Pesawat ke kanan |
| `0#` | Pesawat berhenti |

## Mekanik & Audio

- **Kemenangan:** seluruh alien tersingkir; kekalahan jika satu (solo) atau semua (ko-op) pemain kehabisan nyawa.
- **Efek suara:** `start`, `shoot`, `explode`, `hurt`, `win`, `lose`.

## Lifecycle

- `create({canvas, kernel, players, mode, finish, audio})` → `{stop}`.
- Ready-state menunggu aba-aba `99#`/`5#`/Enter/Spasi/klik dari Player 1.
- `finish()` dipanggil dengan string hasil saat kemenangan kekalahan.