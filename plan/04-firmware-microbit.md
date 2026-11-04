# Sektor 04: Firmware & Pemrograman micro:bit

Dokumen ini menyajikan panduan implementasi firmware micro:bit menggunakan Microsoft MakeCode, spesifikasi protokol komunikasi UART, serta penanganan feedback audio/haptic.

---

## 1. Persyaratan Perangkat Keras & Firmware

- **Perangkat**: BBC micro:bit v1 (dengan speaker eksternal) atau micro:bit v2 (onboard buzzer).
- **Environment**: [Microsoft MakeCode for micro:bit](https://makecode.microbit.org/).
- **Ekstensi Wajib**: Ekstensi `bluetooth` resmi (menggantikan ekstensi radio bawaan).
- **Mode Pairing**: Dikonfigurasi ke *"No Pairing Required: Anyone can connect via Bluetooth"* pada menu *Project Settings*.

---

## 2. Spesifikasi Protokol Komunikasi UART

Komunikasi berbasis teks ASCII melalui Nordic UART Service (NUS):

### 2.1 Arah Pengiriman: micro:bit $\rightarrow$ Web Browser (TX micro:bit / RX Web)
Format standar: `<ANGKA>#` (atau baris diakhiri baris baru, mis. `Mbit:<ANGKA>\n`).
- Delimiter `#` (tanda pagar) wajib ditambahkan di akhir agar buffer kernel web dapat mengekstraksi token secara instan tanpa menunggu jeda waktu.
- Daftar kode dasar:

| Kode Perintah | Fungsi Umum | Arti di Game Ping Pong |
|---|---|---|
| `99#` | Aba-aba Mulai / Start | Mulai permainan (hanya dipicu oleh Player 1) |
| `0#` | Netral / Berhenti | Paddle diam di tempat |
| `1#` | Aksi 1 / Kiri | Paddle bergerak ke kiri |
| `2#` | Aksi 2 / Kanan | Paddle bergerak ke kanan |
| `3#` | Aksi 3 / Kiri (Tilt) | Paddle bergerak ke kiri |
| `4#` | Aksi 4 / Kanan (Tilt) | Paddle bergerak ke kanan |
| `5#` s.d. `9#` | Aksi Khusus / Tambahan (`5#` juga bisa memulai) | Aksi game masa depan (Tembak, Lompat, Turbo) |

### 2.2 Arah Penerimaan: Web Browser $\rightarrow$ micro:bit (RX micro:bit / TX Web)
Format standar: `<KODE>#`
- Dikirim oleh web browser saat terjadi event khusus pada perangkat.
- **Pembaruan Efek Suara**: Seluruh efek suara (pukulan, pantulan dinding, gol, kemenangan) kini disintesis langsung di dalam browser menggunakan **Web Audio API** (`core/audio.js`).
- Oleh karena itu, micro:bit **tidak perlu lagi menerima atau memainkan kode audio** `!#`, sehingga kode MakeCode menjadi jauh lebih ringkas, polling input lebih lancar, dan baterai micro:bit lebih hemat.
- Saluran penerimaan RX micro:bit tetap dapat dipakai untuk keperluan kendali fisik lainnya di masa depan (misal: menampilkan angka skor di matriks LED 5x5 atau getaran motor haptic).

---

## 3. Implementasi MakeCode (TypeScript & Visual Logic)

### 3.1 Skema Kontrol Tombol A & B Sederhana

Skema ini memetakan:
- Tombol A ditekan $\rightarrow$ kirim `1#`
- Tombol B ditekan $\rightarrow$ kirim `2#`
- Kedua tombol dilepas $\rightarrow$ kirim `0#`

```typescript
let lastCmd = "0"

function sendCmd(cmd: string) {
    if (cmd != lastCmd) {
        bluetooth.uartWriteString(cmd + "#")
        lastCmd = cmd
    }
}

// Inisialisasi Layanan Bluetooth UART
bluetooth.startUartService()
basic.showIcon(IconNames.Heart)

// Loop pembacaan status tombol
basic.forever(function () {
    if (input.buttonIsPressed(Button.A)) {
        sendCmd("1")
    } else if (input.buttonIsPressed(Button.B)) {
        sendCmd("2")
    } else {
        sendCmd("0")
    }
    basic.pause(40) // Interval polling ~25Hz
})

// Catatan: Efek suara ditangani otomatis oleh browser via Web Audio API,
// sehingga blok onUartDataReceived tidak lagi diperlukan untuk audio.
```

---

### 3.2 Skema Kontrol Gerakan Kemiringan (Tilt / Accelerometer)

Menggunakan sensor akselerometer bawaan untuk kendali setir yang lebih interaktif:
- Miring ke kiri $\rightarrow$ kirim `3#`
- Miring ke kanan $\rightarrow$ kirim `4#`
- Posisi netral/datar $\rightarrow$ kirim `0#`

```typescript
let lastCmd = "0"

function sendCmd(cmd: string) {
    if (cmd != lastCmd) {
        bluetooth.uartWriteString(cmd + "#")
        lastCmd = cmd
    }
}

bluetooth.startUartService()
basic.showIcon(IconNames.Rollerskate)

basic.forever(function () {
    let pitch = input.rotation(Rotation.Roll) // Derajat kemiringan ke samping
    if (pitch < -18) {
        sendCmd("3") // Miring kiri
    } else if (pitch > 18) {
        sendCmd("4") // Miring kanan
    } else {
        sendCmd("0") // Datar
    }
    basic.pause(50) // Interval polling 20Hz (mencegah banjir paket BLE)
})

bluetooth.onUartDataReceived(serial.delimiters(Delimiters.Hash), function () {
    let data = bluetooth.uartReadUntil(serial.delimiters(Delimiters.Hash)).trim()
    if (data == "!") {
        music.playTone(587, 80) // Nada D5
    }
})
```

---

## 4. Konfigurasi Proyek MakeCode (*Project Settings*)

Untuk memastikan micro:bit dapat langsung disambungkan oleh Web Bluetooth tanpa perlu memasukkan PIN 6-digit:

1. Buka roda gigi (Settings) di pojok kanan atas MakeCode $\rightarrow$ pilih **Project Settings**.
2. Cari opsi **No Pairing Required: Anyone can connect via Bluetooth**.
3. Pastikan opsi tersebut dicentang (aktif).
4. Klik **Save**.
5. Unduh file `.hex` dan salin ke drive virtual micro:bit melalui kabel USB.

---

## 5. Checklist Diagnostik & Pemecahan Masalah

- [ ] **Layanan Bluetooth tidak muncul di browser?**
  Pastikan proyek MakeCode tidak menyertakan modul `radio`. micro:bit tidak dapat mengaktifkan antena Radio proprietary dan Bluetooth BLE secara bersamaan.
- [ ] **Data terkirim tapi tidak dibaca kernel?**
  Periksa apakah string yang dikirim diakhiri karakter `#`. Contoh benar: `bluetooth.uartWriteString("1#")`.
- [ ] **Micro:bit terputus tiba-tiba?**
  Periksa daya baterai. Modul transmisi BLE membutuhkan arus stabil. Baterai AAA yang lemah sering kali menyebabkan micro:bit restart (*brown-out*) saat pemancar radio bekerja.

