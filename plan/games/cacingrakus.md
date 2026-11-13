# Game: Cacing Rakus (Multiplayer Snake)

| Atribut | Nilai |
|---|---|
| **`id`** | `cacingrakus` |
| **Nama** | Cacing Rakus |
| **Ikon** | 🪱 |
| **File** | `games/cacingrakus.js` |
| **Dokumen induk** | [06-games-catalog.md](../06-games-catalog.md) |

Permainan ular klasik arkade multipemain (*competitive multiplayer snake battle*). Seluruh cacing bertarung dan berebut makanan dalam satu arena grid bersama seluas $1280 \times 720\text{ px}$. Dilengkapi mekanisme tembus dinding (*Pac-Man wrap-around*), batas antrian input arah (*input buffer* 2 antrian), dan sistem 3 nyawa dengan pecahan makanan dari badan cacing yang gugur.

---

## Mode

| `id` | Label | Sub | `players` |
|---|---|---|---|
| `1p` | 1 Player | Solo Survival | 1 |
| `2p` | 2 Player | Duel Cacing | 2 |
| `4p` | 4 Player | Pesta Berempat | 4 |

---

## Spesifikasi Teknis

| Aspek | Nilai | Keterangan |
|---|---|---|
| **Canvas** | `1280 × 720 px` | Rasio standar 16:9 widescreen |
| **Sistem Grid** | `40 × 40 px` | $32 \times 18$ sel grid sempurna |
| **Durasi Waktu Game** | `90 detik` | Hitung mundur waktu pertandingan |
| **Kecepatan Gerak** | `0.125 detik/langkah` | 8 langkah sel grid per detik |
| **Panjang Awal** | `3 segmen` | Mulai di 4 sudut simetris menghadap tengah |
| **Nyawa Awal** | `3 Nyawa` | Diwakili ikon ❤️ pada HUD |
| **Jeda Respawn** | `1.0 detik` | Muncul kembali di posisi awal dengan 3 segmen |
| **Masa Kebal Respawn** | `2.0 detik` | Cacing transparan/kedip, kebal tabrakan, dan tidak membunuh cacing lain (*ghost phase*) |
| **Area Aman HUD** | Floating Glass Badges | Terletak di area aman minimal 75 px dari tepi agar tidak terhalang tombol platform |
| **Makanan Normal** | `(Pemain + 2) buah` | Memberi $+10\text{ poin}$ dan $+1\text{ panjang}$; tidak muncul di baris teratas ($y \ge 2$) |
| **Makanan Emas (Golden Food)**| Muncul tiap 15 detik | Bertahan 8 detik; memberi $+30\text{ poin}$ dan $+2\text{ panjang}$ |
| **Warna Khas Slot** | P1 Merah (`#ef4444`), P2 Biru (`#3b82f6`), P3 Hijau (`#22c55e`), P4 Kuning (`#eab308`) | Sesuai slot fisik controller |

---

## Kontrol

| Perintah | Aksi | Keterangan |
|---|---|---|
| `99#` atau `5#` | Mulai permainan | Hanya dari `players[0]` atau klik canvas / Spasi |
| `1#` | **ATAS (Up)** | Berbelok ke atas (diabaikan jika sedang ke bawah) |
| `2#` | **BAWAH (Down)** | Berbelok ke bawah (diabaikan jika sedang ke atas) |
| `3#` | **KIRI (Left)** | Berbelok ke kiri (diabaikan jika sedang ke kanan) |
| `4#` | **KANAN (Right)** | Berbelok ke kanan (diabaikan jika sedang ke kiri) |
| `0#` | Netral | Diabaikan (cacing tetap melaju ke arah terakhir) |

*Skema Keyboard: P1 = Panah Keyboard / WASD (Solo); P1 = Panah, P2 = WASD (2 Pemain).*

---

## Format Teks Selesai (`finish()`)

- **Mode 1P**: `Waktu Habis! Skor P1: {skor} ({⭐⭐⭐})`
- **Mode 2P & 4P (Ada Pemenang)**: `{Warna} (P{winner}) menang! P1 {s1} poin, P2 {s2} poin...`
- **Mode 2P & 4P (Seri)**: `Seri! P1 {s1} poin, P2 {s2} poin...`

