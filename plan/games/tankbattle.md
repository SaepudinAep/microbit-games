# Game: Tank Battle

| Atribut | Nilai |
|---|---|
| **`id`** | `tankbattle` |
| **Nama** | Tank Battle |
| **Ikon** | 🪖 |
| **File** | `games/tankbattle.js` |
| **Dokumen induk** | [06-games-catalog.md](../06-games-catalog.md) |

Pertempuran tank *top-down* dalam arena berpagar 600×800, dengan 11 dinding penghalang dan 4 sudut spawn.

## Mode

| `id` | Label | Sub | `players` |
|---|---|---|---|
| `1v1` | 1 vs 1 | Duel Satu Lawan Satu | 2 |
| `ffa` | 4 Player FFA | Semua Lawan Semua | 4 |

## Spesifikasi Teknis

| Aspek | Nilai |
|---|---|
| **Canva** | 600 × 800 |
| **Tank** | 30×30 px, nyawa `LIVES = 3`, kecepatan `175 px/dtk` |
| **Peluru** | Radius 7 px, kecepatan `440 px/dtk`, cooldown `SHOOT_CD = 0.4 dtk` |
| **Invulnerability** | `INVULN = 2.2 dtk` setelah respawn (dengan efek kedip) |
| **Respawn** | Melalui `RESPAWN_DELAY = 1000 ms` di posisi awal masing-masing |
| **Arena** | Border 10 px + 11 dinding simetris (kotak tengah, lengan, penutup, penghalang) |
| **Warna** | P1 biru, P2 oranye, P3 hijau, P4 ungu |

## Kontrol (skema 4 arah, konsisten dgn mapping keyboard kernel)

| Perintah | Aksi |
|---|---|
| `99#` | Mulai permainan (Player 1 saja) |
| `5#` / `6#` | Tembak peluru (saat bermain) |
| `1#` | Maju (atas) |
| `2#` | Mundur (bawah) |
| `3#` | Belok ke kiri |
| `4#` | Belok ke kanan |
| `0#` | Berhenti |

> Berbeda dari Ping Pong/Space Invaders yang "menggeser" pemain, di sini `1` = maju & `2` = mundur
> karena tank adalah objek 4 arah. Arah laras tank mengikuti arah gerak terakhir.

## Mekanik & Audio

- *Sliding collision*: tank tidak dapat menembus dinding/tank lain, dengan pemisahan sumbu X/Y.
- Peluru mengenai dinding → ledakan kecil & hilang; mengenai tank lawan → kurangi nyawa + invulnerable.
- Kemenangan: tank dengan nyawa tersisa terakhir; seri jika semua habis.
- Pergerakan dihentikan saat `st.over`.
- **Efek suara:** `start`, `shoot`, `hit`, `bounce`, `lose`, `explode` (ledakan partikel).

## Lifecycle

- `create({canvas, kernel, players, mode, finish, audio})` → `{stop}`.
- Ready-state menunggu aba-aba `99#` dari Player 1.
- `finish()` dipanggil dengan **string** hasil (`"PN Menang! 🏆"` / `"Seri! Semua habis."`).