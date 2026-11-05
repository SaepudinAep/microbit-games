# Game: Dino Jump

| Atribut | Nilai |
|---|---|
| **`id`** | `dinorush` |
| **Nama** | Dino Jump |
| **Ikon** | 🦖 |
| **File** | `games/dinorush.js` |
| **Dokumen induk** | [06-games-catalog.md](../06-games-catalog.md) |

Endless *runner* menyerupai game dino legendaris dengan orientasi **Landscape 16:9 (1280 × 720 px)**.
Dioptimalkan secara khusus untuk **Panel Interaktif Digital (PID) sekolah / Smart Board**, **laptop**, dan **tablet**. Tiap pemain berada di **lintasan horizontalnya sendiri** yang tersusun dari atas ke bawah, sehingga hingga **4 pemain** dapat bertanding berdampingan secara lapang tanpa saling bertubrukan.

Game ini mengusung desain **antarmuka bersih tanpa menu opsi**: peraturan paten **3 nyawa** dan permainan berlangsung penuh sampai **seluruh pemain gugur** (pemain yang bertahan terus berlari mengumpulkan jarak terjauh).

---

## Mode

| `id` | Label | Sub | `players` |
|---|---|---|---|
| `1p` | 1 Player | Bertahan Sendiri | 1 |
| `2p` | 2 Player | Dua Lintasan Sejajar | 2 |
| `3p` | 3 Player | Tiga Lintasan | 3 |
| `4p` | 4 Player | Empat Lintasan | 4 |

---

## Spesifikasi Teknis (Rasio Horizontal 16:9)

| Aspek | Nilai | Keterangan |
|---|---|---|
| **Canvas** | **1280 × 720 px (16:9)** | Standar layar lebar HD, native fit di Fullscreen PID/Laptop tanpa bilah hitam samping |
| **Nyawa** | `3 Nyawa` | Tabrakan memberi kebal 1.5 detik (berkedip @ 8Hz) dan rintangan dihapus |
| **Aturan Selesai** | Sampai semua mati (`all`) | Pemain yang tersisa terus berlari menambah jarak terjauh |
| **Lintasan (2–4P)** | Tinggi `LH = 720 / jumlah pemain` | 2P: 360 px, 3P: 240 px, 4P: 180 px |
| **Lintasan (1P)** | Tinggi `SOLO_LH = 280 px` | Di tengah vertikal (`Y = 220 px`) |
| **Skala Fisika** | `s = Math.min(1, LH / 240)` | Ukuran dino, kaktus, gravitasi, & jump velocity diskalakan otomatis |
| **Dino** | `46 × 52 px` pada `s = 1` | Posisi X tetap di `140 px` (jarak pandang reaksi ~1140 px) |
| **Hitbox** | 85 % dari ukuran gambar | Memberikan toleransi tabrakan yang adil |
| **Gravitasi** | `GRAV = 1550 × s` px/dtk² | Puncak lompatan selalu terjaga di dalam batas atas lintasan |
| **Lompat** | `JUMP_V = -640 × s` px/dtk | Respon lompat tajam & terukur |
| **Kecepatan** | Mulai `240 px/dtk`, akselerasi `10 px/dtk²`, maks `680 px/dtk` | Bertambah seiring durasi bertahan |
| **Satuan Jarak** | `METER = 70 px` | Konstanta bernama untuk konversi skor |
| **Rintangan** | Kaktus tunggal & ganda ber-seed RNG | Identik di semua lintasan |
| **Gap Minimum** | `kecepatan × 1.25 dtk` | Menjamin rintangan selalu mungkin dilewati secara teoritis |
| **Warna Slot** | P1 `#4b83ff`, P2 `#ff9a2e`, P3 `#3ccf8e`, P4 `#b98cff` | Mengikuti nomor slot fisik controller |

---

## Kontrol

| Perintah | Aksi |
|---|---|
| `99#` (dari micro:bit pemain mana pun) | Mulai permainan (memicu hitung mundur 3-2-1) |
| Klik layar | Mulai permainan (setara dengan `99#`) |
| Perintah apa pun **selain `0`** (saat bermain) | Lompat |
| `0#` | Netral / dilepas (tidak ada aksi) |

### Mekanisme Lompat Lanjut

| Fitur | Nilai | Keterangan |
|---|---|---|
| **Jump buffer** | 100 ms | Input lompat yang ditekan sesaat sebelum mendarat akan langsung dieksekusi saat menyentuh tanah |
| **Coyote time** | 80 ms | Pemain masih dapat melompat sesaat setelah mulai jatuh |

---

## Alur Memulai Permainan

1. **Fase `waiting`**: Menampilkan dialog instruksi pembuka *"Kirim 99# dari micro:bit pemain mana pun atau klik layar untuk memulai"*.
2. **`99#` atau Klik Layar**: Memulai fase hitung mundur **3 → 2 → 1** (1 detik/angka, audio `click` tiap angka).
3. **Mulai Lari (`playing`)**: Audio `start` berbunyi, rintangan mulai meluncur dari kanan layar.

---

## Format Hasil Akhir (`finish`)

- **Solo**: `"Bertahan 340.5 meter! 🦖"`
- **Multiplayer (Menang)**: `"P2 menang! P2 512.0 m, P1 340.5 m, P3 210.0 m"`
- **Multiplayer (Seri)**: `"Seri! Jarak sama-sama 340 m — P1 340.1 m, P2 340.4 m"` (bila selisih < 5 meter).
