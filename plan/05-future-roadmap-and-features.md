# Sektor 05: Roadmap Fitur & Rencana Pengembangan Masa Depan

Dokumen ini memetakan visi evolusi platform game micro:bit, mencakup perancangan game baru (termasuk game Tank 2v2), peningkatan kapabilitas platform, serta strategi penerapan di ruang kelas.

---

## 1. Rencana Game Baru

Sesuai filosofi arsitektur "Satu Kernel, Banyak Game", penambahan game baru dapat dilakukan tanpa mengubah kode inti Bluetooth. Berikut adalah rencana judul game yang akan ditambahkan ke dalam katalog `games/`:

### 1.1 Game: Tank Battle 2 vs 2 (atau 4-Player FFA)
*Telah disebutkan dalam batas pengembangan README awal.*

- **Konsep**: Dua tim (P1+P2 vs P3+P4) atau 4 pemain bertarung dalam arena labirin 2D berpandangan atas (*top-down*).
- **Kebutuhan Slot**: 4 Pemain (`players: 4`).
- **Skema Kontrol micro:bit**:
  - `1#`: Belok Kiri
  - `2#`: Belok Kanan
  - `3#`: Maju
  - `5#`: Tembak Peluru
- **Feedback Haptic/Audio (TX)**:
  - Kirim `*#` saat peluru ditembakkan.
  - Kirim `X#` ke micro:bit pemain yang terkena ledakan/hancur.
- **Poin & Durasi**: Tim dengan jumlah tank tersisa atau poin kehancuran terbanyak dalam 2 menit menang.

---

### 1.2 Game: Tug of War (Tarik Tambang - Shake Battle)
- **Konsep**: Permainan pesta berenergi tinggi. Pemain mengocok/menggoyang micro:bit secepat mungkin untuk menarik tambang ke sisi timnya.
- **Kebutuhan Slot**: 2 hingga 4 Pemain.
- **Skema Kontrol micro:bit**:
  - micro:bit mendeteksi `on shake` dan mengirim pulsa `1#`.
  - Kernel menghitung akumulasi frekuensi getaran per detik (RPM).
- **Fitur Khusus**: Sangat cocok untuk demonstrasi cepat di kelas karena tidak memerlukan pemahaman koordinasi tombol rumit.

---

### 1.3 Game: Space Dodge / Meteor Survival
- **Konsep**: Pemain mengendalikan pesawat luar angkasa menggunakan tilt/kemiringan untuk menghindari hujan asteroid yang kecepatannya bertambah seiring waktu.
- **Kebutuhan Slot**: 1 Player (Solo Highscore) atau 2 Player (Co-op bertahan bersama).
- **Skema Kontrol micro:bit**:
  - Kemiringan kiri/kanan (`3#` / `4#`) dan tombol booster kecepatan (`1#`).

---

## 2. Peningkatan Fitur Platform & Shell

```mermaid
timeline
    title Peta Jalan Pengembangan Platform (Milestones)
    Fase 1 (Selesai) : Arsitektur Single Kernel : Stabilisasi Buffer BLE : Pengujian Multi-device : Perapian Monitor Log
    Fase 2 (Selesai) : Audio Engine Web Audio API (audio.js) : Kontrol Mute dan Persistensi : Layar Penuh Fullscreen API (.stage)
    Fase 3 (Aktif) : Countdown Overlay 3-2-1 : Game Tank Battle 2v2 : Mekanisme Auto-Reconnect GATT
    Fase 4 (Mendatang) : Game Tug of War : Penyimpanan Skor Lokal (Leaderboard) : Deployment Statis HTTPS (GitHub Pages)
```

### 2.1 Web Audio FX di Tingkat Browser (Telah Terimplementasi)
Efek audio telah diintegrasikan sepenuhnya menggunakan sintesis `Web Audio API` melalui modul `core/audio.js` (bebas aset file eksternal) dengan kontrol volume/mute `#snd` dan persistensi `localStorage`:
- [x] Suara *bip* pantulan dinding (`bounce`) dan pukulan paddle (`hit`) dengan panning spasial stereo.
- [x] Efek suara skor bertambah (`score`) serta kemenangan/kekalahan (`win` / `lose`).
- [x] Resep efek deklaratif untuk game masa depan (`shoot`, `explode`, `hurt`, `powerup`, `start`, `click`).

### 2.2 Mode Layar Penuh / Fullscreen API (Telah Terimplementasi)
- [x] Tombol `#fs` pada panggung `.stage` yang mempertahankan aspek rasio $3:4$ dengan `object-fit: contain` dan menyertakan overlay pemenang `#result`.

### 2.2 Mekanisme Auto-Reconnect GATT yang Cerdas
- Mengimplementasikan pendengar event `gattserverdisconnected`.
- Jika micro:bit terputus saat pertandingan berlangsung, game otomatis berada dalam status **Jeda Darurat** (*Emergency Pause*), dan browser mencoba menyambung ulang perangkat selama 15 detik sebelum membatalkan pertandingan.

### 2.3 Sistem Penyimpanan Skor & Statistik (LocalStorage)
- Menyimpan rekor kemenangan terbanyak (Win Streaks) atau skor tertinggi per sesi tanpa membutuhkan backend/database server.
- Menyediakan tombol reset riwayat di layar lobi.

---

## 3. Strategi Pengujian & Penggunaan di Kelas (Deployment Guide)

### 3.1 Protokol Keamanan Web Bluetooth
- Web Bluetooth mewajibkan konteks aman (**HTTPS** atau `http://localhost`).
- **Rekomendasi Hosting**: Deploy repositori ini secara otomatis menggunakan **GitHub Pages**, Cloudflare Pages, atau Vercel. Pengajar cukup membuka URL statis tersebut di proyektor kelas tanpa instalasi server lokal.

### 3.2 Matriks Kompatibilitas Browser & Perangkat

| Perangkat & Sistem Operasi | Peramban (Browser) | Status Dukungan |
|---|---|---|
| Windows 10/11 | Google Chrome / Microsoft Edge | **Didukung Penuh** (Direkomendasikan) |
| macOS | Google Chrome / Microsoft Edge | **Didukung Penuh** |
| ChromeOS (Chromebook) | Chrome bawaan | **Didukung Penuh** (Sangat ideal untuk sekolah) |
| Android Tablet / Smartphone | Chrome for Android | Didukung (Kebutuhan HTTPS aktif) |
| iOS / iPadOS | Safari / Semua browser | *Tidak Didukung* (Apple membatasi Web Bluetooth) |

### 3.3 Checklist Uji Stabilitas 4 micro:bit Sekaligus
Sebelum menggelar turnamen 4 pemain (Tank Battle):
1. Pastikan adaptor Bluetooth komputer host minimal mendukung **Bluetooth 4.2 / 5.0** (BLE Multi-connection).
2. Hindari tumpukan gelombang radio 2.4GHz yang terlalu padat (misal hotspot Wi-Fi berjarak sangat dekat dengan micro:bit).
3. Beri label nomor stiker fisik pada setiap micro:bit (P1, P2, P3, P4) agar tidak tertukar saat siswa mengambil perangkat.

