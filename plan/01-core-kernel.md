# Sektor 01: Core Kernel (`core/kernel.js`)

Dokumen ini menjelaskan arsitektur teknis inti dari lapisan kernel yang bertindak sebagai jembatan perangkat keras (*Hardware Abstraction Layer*) antara micro:bit, keyboard, dan logika permainan.

---

## 1. Peran & Tanggung Jawab Kernel

Kernel dirancang dengan prinsip **keterpisahan logika (*separation of concerns*)**:
- Mengelola koneksi BLE nirkabel secara eksklusif menggunakan Web Bluetooth API.
- Menyediakan slot pemain terstruktur (maksimum 4 pemain).
- Memetakan keyboard komputer menjadi input virtual yang seragam dengan controller micro:bit.
- Melakukan buffering dan sanitasi paket data UART mentah menjadi format perintah standar.
- Menyediakan *Pub-Sub Event Bus* yang bersih untuk dikonsumsi oleh Shell dan Game.
- **Batasan Tegas**: Kernel tidak mengetahui visual game, aturan poin, maupun status tampilan UI browser.

---

## 2. Arsitektur Komunikasi Web Bluetooth (BLE UART)

### 2.1 Profil Layanan & Karakteristik (Nordic UART Service)
Kernel berinteraksi dengan micro:bit menggunakan **Nordic UART Service (NUS)**:
- **Service UUID**: `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
- **Anomali Karakteristik micro:bit**:
  Pada firmware MakeCode micro:bit tertentu, UUID karakteristik TX dan RX dapat tertukar posisinya dibanding spesifikasi resmi Nordic.
  *Solusi Kernel*: Kernel tidak bergantung pada UUID karakteristik spesifik, melainkan mendeteksi kapabilitas GATT secara dinamis:
  - Karakteristik penerima (RX dari micro:bit): dicari berdasarkan properti `notify` atau `indicate`.
  - Karakteristik pengirim (TX ke micro:bit): dicari berdasarkan properti `write` atau `writeWithoutResponse`.

### 2.2 Penanganan Fragmentasi Paket (Packet Chunking & Buffer)
Koneksi BLE UART memiliki batas transmisi payload (MTU default 20 byte). String teks yang dikirim oleh micro:bit (misalnya karena jeda pengiriman atau data panjang) sering kali terpotong menjadi beberapa paket kecil.

**Mekanisme `feed(slot, text)`**:
```javascript
function feed(s, text) {
  s.rx += text;
  let m;
  while ((m = /[#\n]/.exec(s.rx))) {
    const tok = s.rx.slice(0, m.index);
    s.rx = s.rx.slice(m.index + 1);
    const d = /(\d+)\s*$/.exec(tok);
    if (d) input(s, d[1]);
  }
}
```
1. Paket teks baru digabungkan ke buffer akumulator per-slot (`s.rx`).
2. Regex mencari pembatas delimitasi token: tanda pagar (`#`) atau baris baru (`\n`).
3. Angka yang berada di ujung token diekstraksi sebagai perintah (`cmd`), memvalidasi sintaks standar `N#` atau `Mbit:N`.
4. String sisa dipertahankan untuk kedatangan paket berikutnya.

---

## 3. Manajemen Slot Pemain (Player Slots)

Kernel mendefinisikan array statis 4 slot:
```javascript
{
  n: 1,                    // Nomor pemain (1..4)
  type: null,             // null | 'microbit' | 'keyboard'
  name: '',               // Nama perangkat BLE atau 'Keyboard'
  link: null,             // Objek koneksi { dev, wr, q }
  scheme: null,           // Skema tombol ('both' | 'arrows' | 'wasd')
  last: '',               // Perintah terakhir yang diterima
  rx: ''                  // Buffer sisa stream UART
}
```

### 3.1 Skema Keyboard Dinamis (Input Multiplexing)
Ketika pemain menggunakan keyboard untuk testing/cadangan:
- **Jika hanya 1 slot keyboard aktif**: Pemain tersebut bebas menggunakan tombol Panah ATAU WASD (`scheme = 'both'`).
- **Jika 2 slot keyboard aktif**:
  - Slot keyboard pertama otomatis diatur ke Panah (`scheme = 'arrows'`).
  - Slot keyboard kedua otomatis diatur ke WASD (`scheme = 'wasd'`).
- **Penanganan Input Simultan & Blur**:
  Kernel melacak antrean tombol yang sedang ditekan (`held map`). Jika tombol dilepas, perintah kembali ke status tombol sebelumnya atau netral `0`. Jika jendela browser kehilangan fokus (`blur`), semua status tombol di-reset otomatis ke `0` untuk mencegah karakter "tersangkut" (*ghost input*).

---

## 4. Transmisi Data ke Perangkat (TX ke micro:bit)

Kernel mendukung komunikasi 2 arah melalui metode `send(playerNumber, text)`:
- Menambahkan karakter `#` di akhir pesan secara otomatis.
- Mengantrekan paket pengiriman via `Promise chaining` (`link.q`) agar paket tidak bertabrakan pada lapisan GATT.
- Memotong payload menjadi blok maksimal 20 byte sesuai batas MTU BLE.
- *Catatan Arsitektur*: Efek audio game telah dialihkan sepenuhnya ke modul `core/audio.js` (Web Audio API di browser), sehingga transmisi kode suara `!#` tidak lagi dikirimkan ke micro:bit. Jalur `Kernel.send()` dipertahankan murni untuk kendali perangkat fisik di masa depan (misal: getaran motor/haptic feedback atau display LED matriks).

---

## 5. Event Bus API

Kernel mengekspor antarmuka event observer:
- `Kernel.on('input', ({player, cmd, source}) => {})`: Diterbitkan ketika perintah angka valid diterima. Mengembalikan fungsi *unsubscribe*.
- `Kernel.on('players', () => {})`: Diterbitkan ketika slot terisi, terputus, atau skema berubah.
- `Kernel.on('raw', ({player, text, bytes}) => {})`: Data mentah untuk keperluan monitoring/debugging.
- `Kernel.on('tx', ({player, text}) => {})`: Log transmisi data keluar ke micro:bit.
- `Kernel.on('warn', (msg) => {})`: Peringatan kegagalan Web Bluetooth atau error transmisi.

---

## 6. Rencana Peningkatan Sektor Core Kernel

1. **Auto-Reconnect GATT Server**:
   - Menambahkan event listener `gattserverdisconnected` dengan opsi percobaan rekoneksi otomatis 3 kali sebelum mengosongkan slot.
2. **Monitoring Status Baterai (Battery Service)**:
   - Menambahkan opsional service BLE standard Battery Service (`0x180F`) untuk menampilkan persentase baterai micro:bit di UI lobi.
3. **Penyaringan Perangkat Duplikat yang Lebih Halus**:
   - Deteksi dini `deviceId` sebelum pairing untuk mencegah pengguna memilih perangkat micro:bit yang sama pada dua slot berbeda.
4. **Optimasi Buffer Flush**:
   - Pembersihan otomatis buffer sisa `s.rx` jika tidak ada karakter delimitasi dalam rentang waktu tertentu (mis. 2000ms) untuk mencegah penumpukan sampah memori jika micro:bit mengirim data corrupt.

