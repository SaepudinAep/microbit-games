# Game: Kejar Labirin (Pac-Man Multiplayer)

| Atribut | Nilai |
|---|---|
| **`id`** | `kejarlabirin` |
| **Nama** | Kejar Labirin |
| **Ikon** | 🟡 |
| **Kategori / Tag** | `Retro` |
| **File** | `games/kejarlabirin.js` |
| **Dokumen induk** | [06-games-catalog.md](../06-games-catalog.md) |

Permainan arkade labirin aksi retro multi-pemain (*competitive Pac-Man party*) di kanvas 1280×720 piksel. Pemain mengendalikan karakter pemakan titik (*Chomper*) di labirin simetris 4-sudut (31 kolom × 17 baris) untuk memakan titik energi, buah bonus, serta menelan pil kekuatan (*Power Pellet*) agar dapat memburu 4 hantu NPC AI secara bersamaan.

---

## Mode

| `id` | Label | Sub | `players` |
|---|---|---|---|
| `1p` | 1 Player | Solo | 1 (dengan evaluasi 1–3 Bintang) |
| `2p` | 2 Player | Duel Labirin | 2 |
| `4p` | 4 Player | Pesta Berempat | 4 |

---

## Posisi Awal & Skema Warna Pemain (P1–P4)

Setiap pemain ditempatkan secara simetris di 4 sudut labirin:
- **Player 1 (P1):** Merah (`#EF4444`) — Sudut Kiri-Atas `(c: 1, r: 1)`
- **Player 2 (P2):** Biru (`#3B82F6`) — Sudut Kanan-Bawah `(c: 29, r: 15)`
- **Player 3 (P3):** Hijau (`#22C55E`) — Sudut Kiri-Bawah `(c: 1, r: 15)`
- **Player 4 (P4):** Kuning (`#EAB308`) — Sudut Kanan-Atas `(c: 29, r: 1)`

---

## Spesifikasi Teknis

| Aspek | Nilai | Keterangan |
|---|---|---|
| **Canvas** | `1280 × 720 px` | Rasio standar 16:9 widescreen |
| **Grid Labirin** | 31 kolom × 17 baris | Ukuran sel `38 × 38 px` (total $1178 \times 646\text{ px}$) |
| **Offset Grid** | `OX = 51 px`, `OY = 66 px` | Posisi terpusat dengan safe area 66 px di atas untuk HUD |
| **Terowongan Tembus** | Baris `r = 8` (kiri-kanan) | *Wrap-around* seketika menghubungkan sisi barat dan timur arena |
| **Kecepatan Pemain** | `175 px/dtk` | Kecepatan lincah dan terkontrol untuk anak TK & SD |
| **Corner Snap Assist** | `12 px` | Membantu belokan mulus di persimpangan tanpa tersangkut dinding |
| **Pre-Turn Buffer** | Otomatis | Menyimpan perintah belokan sebelum tiba tepat di sel persimpangan |
| **Kecepatan Hantu Normal**| `115 px/dtk` | Lebih lambat dari pemain agar anak merasa aman dan adil |
| **Kecepatan Hantu Biru**  | `80 px/dtk` | Melambat saat ketakutan (*Frightened*) |
| **Kecepatan Hantu Eaten** | `280 px/dtk` | Mata meluncur cepat kembali ke sarang tengah |
| **Durasi Game** | `90 detik` | Hitung mundur waktu permainan |
| **Nyawa Awal** | `3 Nyawa` | Diwakili ikon ❤️ pada kartu HUD |
| **Durasi Kebal** | `3.0 detik` | Efek kedip saat respawn di sudut awal pasca-tabrakan |
| **Titik Energi (Dots)** | `+10 poin` | Tersebar di seluruh lorong labirin |
| **Pil Kekuatan (Pellet)**| `+30 poin` (4 buah) | Terletak di dekat 4 sudut; memicu 8 detik hantu biru ketakutan |
| **Hantu Termakan** | `+100 poin` | Hantu yang dimakan berubah menjadi mata yang kembali ke sarang |
| **Buah Bonus** | `+50 poin` | Muncul di tengah labirin setiap 20 detik (bertahan 10 detik) |
| **Wave Reset** | Otomatis | Titik dan pil terisi ulang bila seluruhnya habis sebelum waktu berakhir |

---

## 4 Hantu NPC AI

1. **Blinky (Merah - `#EF4444`):** Pemimpin patroli, bergerak agresif mencari pemain terdekat.
2. **Pinky (Merah Muda - `#F472B6`):** Pengintai lincah, menyergap jalur persimpangan.
3. **Inky (Biru Muda - `#38BDF8`):** Patroli tak terduga, kombinasi kejar dan keliling.
4. **Clyde (Oranye - `#F59E0B`):** Penjaga sarang, lebih santai dan suka memutar.

*Saat pemain memakan Pil Kekuatan, seluruh hantu berubah menjadi biru (`#2563EB`) dan berkedip putih di 2 detik terakhir.*

---

## Kontrol

| Perintah | Aksi | Keterangan |
|---|---|---|
| `99#` atau `5#` | Mulai permainan | Hanya dari `players[0]` atau klik canvas / Spasi |
| `1#` | **Atas** | Bergerak / berbelok ke atas |
| `2#` | **Bawah** | Bergerak / berbelok ke bawah |
| `3#` | **Kiri** | Bergerak / berbelok ke kiri |
| `4#` | **Kanan** | Bergerak / berbelok ke kanan |
| `0#` | **Netral** | Chomper terus bergerak mengikuti arah terakhir (*Pac-Man style*) |

*Skema Keyboard: P1 = W / A / S / D; P2 = Tombol Panah (Up/Down/Left/Right).*

---

## Format Teks Selesai (`finish()`)

- **Mode 1P**: `Waktu Habis! Skor P1: {skor} ({⭐⭐⭐})`
- **Mode 2P & 4P (Ada Pemenang)**: `{Warna} (P{winner}) menang! P1 {s1} poin, P2 {s2} poin...`
- **Mode 2P & 4P (Seri)**: `Seri! P1 {s1} poin, P2 {s2} poin...`
