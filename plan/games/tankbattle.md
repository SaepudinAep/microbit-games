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
| `1p` | 1 Player | Lawan Komputer | 1 (vs AI Bot) |
| `1v1` | 1 vs 1 | Duel Satu Lawan Satu | 2 |
| `2v2` | 2 vs 2 | Duel Tim Merah vs Biru | 4 |
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
| **Warna** | 1v1/FFA: P1 biru, P2 oranye, P3 hijau, P4 ungu; **2v2**: Tim Merah `#f5484d` (P1+P2) vs Tim Biru `#3c9eff` (P3+P4) |
| **Skor** | `SCORE_TARGET = 5` poin untuk menang |

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

## Sistem Tim & Skor

- **Sisi**: `1v1` = 2 pemain (masing-masing sisi sendiri); `2v2` = Tim Merah (P1+P2) vs Tim Biru (P3+P4); `ffa` = 4 pemain (masing-masing sisi sendiri).
- **Poin:** tiap tank **lawan** yang dihancurkan memberi **1 poin** ke tim penembak.
- **Menang:** sisi pertama mencapai `SCORE_TARGET` (5) poin **atau** mengeliminasi semua tank lawan (nyawa habis); seri bila semua tank habis bersamaan.
- **Friendly fire:** peluru tidak mengenai kawan setim (berlaku di 2v2; di 1v1/FFA peluru hanya kena lawan).
- HUD menampilkan **papan skor** (atas) dan **ikon nyawa hati** per tank (bawah).

## Mekanik & Audio

- *Sliding collision*: tank tidak dapat menembus dinding/tank lain, dengan pemisahan sumbu X/Y.
- Peluru mengenai dinding → ledakan kecil & hilang; mengenai tank lawan → kurangi nyawa + invulnerable; respawn bila masih punya nyawa.
- Pergerakan dihentikan saat `st.over`.
- **Efek suara:** `start`, `shoot`, `hit`, `score`, `bounce`, `lose`, `explode` (ledakan partikel).

## Lifecycle

- `create({canvas, kernel, players, mode, finish, audio})` → `{stop}`.
- Ready-state menunggu aba-aba `99#` dari Player 1.
- `finish()` dipanggil dengan **string** hasil (`"Tim Merah Menang! 🏆 (5 poin)"` / `"Seri! Semua habis."`).