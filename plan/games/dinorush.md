# Game: Dino Jump

| Atribut | Nilai |
|---|---|
| **`id`** | `dinorush` |
| **Nama** | Dino Jump |
| **Ikon** | 🦖 |
| **File** | `games/dinorush.js` |
| **Dokumen induk** | [06-games-catalog.md](../06-games-catalog.md) |

Endless *runner* menyerupai dino saat kehilangan koneksi (Google Dino). Tiap pemain
berada di **lintasan sendiri** yang tersusun dari atas ke bawah, sehingga hingga
**4 pemain** bisa bermain bersamaan tanpa saling bertabrakan.

---

## Mode

| `id` | Label | Sub | `players` | `options` default |
|---|---|---|---|---|
| `1p` | 1 Player | Bertahan Sendiri | 1 | `{ lives: 3, end: 'all' }` |
| `2p` | 2 Player | Dua Lintasan Sejajar | 2 | `{ lives: 3, end: 'all' }` |
| `3p` | 3 Player | Tiga Lintasan | 3 | `{ lives: 3, end: 'all' }` |
| `4p` | 4 Player | Empat Lintasan | 4 | `{ lives: 3, end: 'all' }` |

---

## Spesifikasi Teknis

| Aspek | Nilai |
|---|---|
| **Canvas** | 600 × 800 px |
| **Lintasan (2–4P)** | Tinggi `LH = 800 / jumlah pemain`, tersusun atas ke bawah |
| **Lintasan (1P)** | Tinggi `SOLO_LH = 300 px` di tengah vertikal (Y atas = 250 px) |
| **Skala fisika** | `s = Math.min(1, LH / 260)` — ukuran dino, kaktus, GRAV, JUMP_V dikali `s` |
| **Dino** | `44 × 50 px` pada `s = 1`; posisi X tetap di `96` |
| **Hitbox** | 85 % dari ukuran sprite |
| **Gravitasi** | `GRAV = 1500 × s` px/dtk² |
| **Lompat** | `JUMP_V = -620 × s` px/dtk |
| **Kecepatan** | Mulai `220 px/dtk`, akselerasi `9 px/dtk` per detik, maks `640 px/dtk` |
| **Satuan jarak** | `METER = 60 px` (konstanta bernama) |
| **Rintangan** | Kaktus tunggal & ganda; urutan dari RNG ber-seed — **sama untuk semua lintasan** |
| **Gap minimum** | `kecepatan_saat_ini × 1.2 dtk` (selalu bisa dilewati) |
| **Warna** | P1 `#4b83ff`, P2 `#ff9a2e`, P3 `#3ccf8e`, P4 `#b98cff` (berdasarkan **nomor slot**, bukan indeks) |

---

## Kontrol

| Perintah | Aksi |
|---|---|
| `99#` (dari pemain mana pun) | Mulai permainan (hitung mundur 3-2-1) |
| Klik layar | Mulai permainan (setara `99#`) |
| Perintah apa pun **selain `0`** (saat bermain) | Lompat |
| `0#` | Netral — tidak ada aksi |

> **Catatan keyboard:** Tombol yang dipetakan ke perintah `1`–`9` (misalnya ArrowUp atau W) berfungsi sebagai lompat saat bermain. Tombol apapun yang menghasilkan `99` tidak dipetakan dari keyboard secara default — gunakan klik layar atau micro:bit untuk memulai.

### Mekanisme Lompat Lanjut

| Fitur | Nilai | Keterangan |
|---|---|---|
| **Jump buffer** | 100 ms | Lompat yang ditekan sesaat *sebelum* mendarat tetap dieksekusi |
| **Coyote time** | 80 ms | Masih bisa lompat sesaat *setelah* jatuh dari tepi |

---

## Alur Memulai Permainan

1. **Fase `waiting`** — layar menampilkan panel instruksi dengan teks: *"Kirim 99# dari micro:bit mana pun atau klik layar"*.
2. **`99#` dari pemain mana pun** ATAU **klik layar** → game masuk fase **hitung mundur** `3 → 2 → 1` (1 detik/angka; audio `click` tiap angka).
3. Setelah `1`, fase berubah ke **`playing`** dan audio `start` diputar.

> **Standar platform:** Semua game di platform ini dimulai dengan `99#` atau klik layar — konsisten di seluruh game.

---

## Options (Nyawa & Aturan Selesai)

| `options` key | Nilai valid | Default | Keterangan |
|---|---|---|---|
| `lives` | `1` atau `3` | `3` | Jumlah nyawa tiap pemain |
| `end` | `'all'` atau `'last'` | `'all'` | Kapan permainan berakhir |

### `options.lives`

- **`3`** — Menabrak rintangan mengurangi nyawa; dino kebal **1,5 dtk** (berkedip); rintangan yang ditabrak dihapus; audio `hurt`. Mati saat nyawa = 0.
- **`1`** — Satu tabrakan langsung mati; audio `lose`.

### `options.end`

| Mode | Perilaku |
|---|---|
| `'all'` | Permainan berakhir saat **semua** lintasan mati. Pemain yang masih hidup terus berlari dan menambah jarak. |
| `'last'` | Permainan berakhir saat **tersisa 1** lintasan hidup. |
| *(solo)* | Selalu berakhir saat satu-satunya lintasan mati, tidak peduli nilai `end`. |

---

## Aturan & Skor

- **Skor** = jarak tempuh (`dist`, meter), dihitung dari `distPx / 60`.
- Pemenang = pemain dengan **jarak terpanjang** saat game berakhir.
- **Seri** bila selisih jarak pertama dan kedua **< 5 meter**.

### Teks Finish

| Kondisi | Contoh teks `finish()` |
|---|---|
| Solo | `"Bertahan 340.5 meter! 🦖"` |
| Menang jelas | `"P2 menang! P2 512.0 m, P1 340.5 m, P3 210.0 m"` |
| Seri | `"Seri! Jarak sama-sama 340 m — P1 340.1 m, P2 340.4 m"` |

---

## HUD (per lintasan)

- **Label pemain** (`P1`, `P2`, dst.) — warna mengikuti slot.
- **Jarak** dalam meter (`x.x m`) — kiri atas lintasan.
- **Nyawa** sebagai simbol `♥` / `♡` — kanan atas lintasan.
- Lintasan mati: overlay gelap + teks `Pn 💀 — x.x m`.

---

## Suara

| Event | Audio key | Keterangan |
|---|---|---|
| Hitung mundur | `click` | Tiap langkah 3-2-1 |
| Mulai | `start` | Saat fase playing dimulai |
| Lompat | `click` | Pan sesuai indeks lintasan (-1 … +1) |
| Tabrakan (masih hidup) | `hurt` | Nyawa berkurang |
| Mati (nyawa habis) | `lose` | Lintasan berhenti |
| Game berakhir (solo) | `lose` | — |
| Game berakhir (multi) | `win` | — |

> Jika `audio` tidak tersedia, game tetap berjalan normal.

---

## Urutan Rintangan Bersama

Semua lintasan memakai **satu RNG ber-seed** (LCG sederhana, seed acak per sesi).
Rintangan dibuat ke antrian bersama (`obsQueue`) dan didistribusikan ke semua lintasan
yang masih hidup di koordinat Y masing-masing. Ini menjamin:

- Urutan dan tipe rintangan **identik** di semua lintasan.
- Gap minimum = `kecepatan_saat_itu × 1.2 dtk` → rintangan **selalu mungkin** dilompati.

---

## Lifecycle

```
create({canvas, kernel, players, mode, finish, audio, options}) → {stop()}
```

- `stop()` membatalkan `requestAnimationFrame`, semua `setTimeout`, melepas listener kernel (`kernel.on`), dan listener klik canvas.
- Tidak ada kebocoran jika game dimulai ulang berkali-kali dari lobi.

---

## Registrasi

Game sudah terdaftar di `games/index.js`:

```js
import dinorush from './dinorush.js';
export const games = [..., dinorush];
```
