# Game: Petualang Koin (Super Bros Platformer)

| Atribut | Nilai |
|---|---|
| **`id`** | `petualangkoin` |
| **Nama** | Petualang Koin |
| **Ikon** | 🪙 |
| **Kategori / Tag** | `Retro` |
| **File** | `games/petualangkoin.js` |
| **Dokumen induk** | [06-games-catalog.md](../06-games-catalog.md) |

Permainan petualangan platformer aksi retro multi-pemain (*Super Bros side-scroller*) di kanvas 1280×720 piksel. Pemain mengendalikan karakter petualang bertopi dalam lintasan horizontal menuju tiang bendera finis. Dirancang khusus ramah anak (TK hingga SMP) dengan lompatan responsif, *air momentum lock*, *coyote time*, musuh klasik, power-up Jamur & Bintang, serta sistem Gelembung Penyelamat (*Catch-Up Bubble*) anti-tertinggal.

---

## Mode

| `id` | Label | Sub | `players` |
|---|---|---|---|
| `1p` | 1 Player | Solo Petualang | 1 (dengan evaluasi 1–3 Bintang) |
| `2p` | 2 Player | Petualang Berdua | 2 (Co-op & adu skor) |
| `4p` | 4 Player | Pesta Berempat | 4 (Co-op & adu skor) |

---

## Posisi Awal & Skema Warna Pemain (P1–P4)

Setiap pemain memiliki karakter petualang bertopi dengan warna slot standar platform:
- **Player 1 (P1):** Merah (`#EF4444`)
- **Player 2 (P2):** Biru (`#3B82F6`)
- **Player 3 (P3):** Hijau (`#22C55E`)
- **Player 4 (P4):** Kuning (`#EAB308`)

---

## Spesifikasi Teknis

| Aspek | Nilai | Keterangan |
|---|---|---|
| **Canvas** | `1280 × 720 px` | Rasio standar 16:9 widescreen |
| **Panjang Level** | `5200 px` | Panggung bergulir horizontal side-scrolling |
| **Garis Tanah (Ground)** | `Y = 620 px` | Pijakan utama dengan jurang-jurang pendek ramah anak |
| **Kecepatan Lari Normal** | `265 px/dtk` | Kecepatan lari responsif dan mudah dikendalikan |
| **Kecepatan Lari Bintang** | `340 px/dtk` | Peningkatan kecepatan saat memiliki Bintang Kebal ⭐ |
| **Kekuatan Lompat** | `-590 px/dtk` | Lompatan lengkung alami dengan gravitasi `1250 px/dtk²` |
| **Air Momentum Lock** | Aktif | Mengunci momentum horizontal saat melompat miring dari micro:bit |
| **Coyote Time** | `0.12 detik` | Memberi toleransi lompat sesaat setelah melangkah keluar tepi jurang |
| **Jump Buffer** | `0.12 detik` | Mengeksekusi lompatan jika tombol ditekan sesaat sebelum mendarat |
| **Durasi Game** | `90 detik` | Hitung mundur waktu permainan menuju tiang bendera finis |
| **Nyawa Awal** | `3 Nyawa` | Diwakili ikon ❤️ pada kartu HUD |
| **Koin Melayang** | `+10 poin` | Koin emas pemandu lompatan di atas rintangan |
| **Balok '?' Koin** | `+20 poin` | Disundul dari bawah |
| **Balok Bata** | `+10 poin` | Disundul dari bawah dengan animasi pantulan |
| **Menginjak Musuh** | `+50 poin` | Injak Goomba/Koopa dari atas, karakter memantul kembali |
| **Musuh via Bintang** | `+100 poin` | Menabrak musuh saat status Bintang Kebal aktif |
| **Bonus Pipa Rahasia** | `+100 poin` | Menunduk di atas pipa warp berkode BONUS (`+5 Koin`) |
| **Bonus Tiang Bendera** | `+200 - +450 poin`| Bonus finis pertama sesuai ketinggian kontak tiang bendera |

---

## Mekanika Khusus

### 1. Air Momentum Lock (Optimasi Input micro:bit)
Saat pemain miring ke kanan (`4`) lalu miring ke atas (`1`) untuk melompat, karakter otomatis mempertahankan kecepatan laju horizontal ke kanan selama di udara sehingga tercipta lompatan melengkung ke depan tanpa mengharuskan anak memiringkan dua arah sekaligus.

### 2. Gelembung Penyelamat (Catch-Up Bubble)
Jika seorang pemain tertinggal di belakang tepi kiri layar atau jatuh ke dalam jurang, pemain tidak langsung tereliminasi:
- Pemain terbungkus dalam Gelembung Penyelamat bercahaya.
- Nilai berkurang sedikit (`-15 poin` atau `-1 Nyawa`).
- Gelembung melayang secara otomatis mengejar posisi pemain terdepan selama 2 detik.
- Pemain dapat menekan tombol lompat atau menunggu gelembung pecah otomatis dan mendarat kembali dengan status kebal (berkedip) selama 2.2 detik.

### 3. Power-Up Jamur & Bintang
- **Jamur Super (🍄):** Memperbesar ukuran karakter. Saat terkena musuh dari samping, karakter hanya menyusut kembali ke ukuran normal tanpa kehilangan nyawa.
- **Bintang Kebal (⭐):** Memberikan efek kilau pelangi, kecepatan ekstra, dan kekebalan menabrak seluruh musuh selama 8 detik.

---

## Kontrol

| Perintah | Aksi | Keterangan |
|---|---|---|
| `99#` atau `5#` | Mulai permainan | Dari P1 atau klik canvas / Spasi saat standby |
| `3#` | **Miring Kiri** | Berlari ke kiri |
| `4#` | **Miring Kanan** | Berlari ke kanan |
| `0#` | **Datar / Netral** | Berhenti berlari di tanah (deselerasi halus) |
| `1#` atau `5#` | **Lompat** | Melompat dengan Air Momentum Lock / pecahkan gelembung |
| `2#` | **Menunduk / Warp**| Menunduk atau masuk ke Pipa Bonus |

### Fallback Keyboard
- **P1:** `A` (Kiri), `D` (Kanan), `W` atau `Spasi` (Lompat), `S` (Bawah/Menunduk).
- **P2:** Panah Kiri (Kiri), Panah Kanan (Kanan), Panah Atas / Enter (Lompat), Panah Bawah (Bawah/Menunduk).
