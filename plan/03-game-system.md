# Sektor 03: Game System & Standarisasi Game

Dokumen ini mendefinisikan spesifikasi kontrak game (*Game Contract API*), arsitektur implementasi game yang ada saat ini (`games/pingpong.js`), dan panduan terstandarisasi untuk membuat modul game baru.

---

## 1. Spesifikasi Kontrak Game (*The Game Contract*)

Setiap game dalam platform ini diperlakukan sebagai modul independen dengan format ES Module (`export default`). Shell mengonsumsi modul game berdasarkan kontrak berikut:

```typescript
interface GameModule {
  id: string;                     // Identifier unik tanpa spasi (mis: 'pingpong')
  name: string;                   // Nama display game (mis: 'Ping Pong')
  description: string;            // Ringkasan panduan cara bermain
  modes: GameMode[];              // Daftar mode permainan yang didukung
  canvas: {
    width: number;                // Resolusi internal kanvas (lebar)
    height: number;               // Resolusi internal kanvas (tinggi)
  };
  create(context: GameContext): GameInstance;
}

interface GameMode {
  id: string;                     // ID mode (mis: '1p', '2p', '2v2')
  label: string;                  // Label tombol (mis: '1 Player')
  sub: string;                    // Deskripsi singkat di bawah label tombol
  players: number;                // Jumlah minimum pemain yang disyaratkan
}

interface GameContext {
  canvas: HTMLCanvasElement;      // Elemen DOM canvas yang disediakan shell
  kernel: KernelObject;           // Referensi ke objek Kernel
  players: number[];              // Array nomor slot pemain yang bermain, urut (contoh: [1, 2])
  mode: GameMode;                 // Mode aktif yang dipilih pengguna
  finish: (winnerText: string) => void; // Callback yang dipanggil saat game berakhir
}

interface GameInstance {
  stop: () => void;               // Fungsi wajib untuk membersihkan requestAnimationFrame & event listener
}
```

---

## 2. Bedah Teknis Game Eksisting: Ping Pong (`games/pingpong.js`)

Game Ping Pong mengimplementasikan permainan tenis meja klasik berorientasi vertikal (aspek rasio 3:4, resolusi $600 \times 800$ piksel).

### 2.1 Komponen & Parameter Fisika
- **Arena**: Lebar $W = 600$, Tinggi $H = 800$.
- **Paddle**: Panjang $110\text{ px}$, Tebal $16\text{ px}$, Kecepatan gerak $420\text{ px/detik}$.
- **Bola**: Radius $9\text{ px}$, Kecepatan awal $380\text{ px/detik}$.
- **Poin Kemenangan**: $5$ poin (`WIN = 5`).
- **Target Posisi**:
  - Player 1 (Bawah): Y konstan di $H - \text{EDGE} - \text{PH}$.
  - Player 2 / Komputer (Atas): Y konstan di $\text{EDGE}$.

### 2.2 Dynamic Delta Time Game Loop
Animasi menggunakan `requestAnimationFrame` dengan penghitungan waktu delta (`dt`):
```javascript
function loop(t) {
  const dt = Math.min(0.05, (t - t0) / 1000);
  t0 = t;
  step(dt);
  draw();
  raf = requestAnimationFrame(loop);
}
```
- `Math.min(0.05, ...)` berfungsi sebagai penjaga (*delta clamping*) untuk menghindari glitch tabrakan ketika tab browser diminimalkan atau mengalami lonjakan frame (*lag spike*).

### 2.3 Logika Pantulan & Feedback Suara Haptic
Ketika bola mengenai paddle:
- Kecepatan vertikal (`vy`) dibalik dan dipercepat $6\%$ (`* 1.06`) hingga batas maksimal $760\text{ px/detik}$.
- Kecepatan horizontal (`vx`) dibelokkan sesuai jarak benturan dari titik tengah paddle, memberikan pemain kontrol taktis atas arah bola.
- **Koneksi Balik (TX)**: Memanggil `kernel.send(players[i], '!')`. Micro:bit milik pemain yang memukul bola akan menerima kode `!#` untuk mengaktifkan bunyi 'beep' pada buzzer onboard micro:bit.

### 2.4 Logika AI Komputer (Mode 1 Player)
Pada mode 1 pemain, paddle atas dikendalikan secara otomatis:
- Hanya bergerak jika bola sedang meluncur ke arahnya (`vy < 0`).
- Memiliki *deadzone* $12\text{ px}$ agar gerakan paddle tidak bergetar (*jittering*).
- Kecepatan komputer dibatasi pada $250\text{ px/detik}$ (lebih lambat dari kecepatan pemain manusia $420\text{ px/detik}$) untuk memastikan permainan berimbang dan dapat dimenangkan.

---

## 3. Registrasi Game (`games/index.js`)

Pendaftaran game ke dalam platform dilakukan melalui satu titik entri:
```javascript
import pingpong from './pingpong.js';
// import tankbattle from './tankbattle.js';

export const games = [
  pingpong,
  // tankbattle
];
```
Shell membaca array `games` ini secara otomatis untuk mengalkulasi slot dan menampilkan kartu pemilihan game.

---

## 4. Panduan Terstandarisasi Membuat Game Baru

Untuk menambahkan game baru (misalnya game bernama **"dodge"**):

1. **Buat file modul**: `games/dodge.js`.
2. **Definisikan metadata dan mode**:
   ```javascript
   export default {
     id: 'dodge',
     name: 'Dodge Asteroid',
     description: 'Hindari rintangan yang berjatuhan selama mungkin!',
     modes: [
       { id: '1p', label: '1 Player', sub: 'Tantangan Solo', players: 1 },
       { id: '2p', label: '2 Player', sub: 'Bertahan Bersama', players: 2 }
     ],
     canvas: { width: 600, height: 800 },
     create({ canvas, kernel, players, mode, finish }) {
       // Setup state game & canvas context
       let running = true;
       let rafId = 0;

       // 1. Langganan input kernel
       const unsubscribe = kernel.on('input', ({ player, cmd }) => {
         // Proses perintah: 1/3 = kiri, 2/4 = kanan, 0 = berhenti
       });

       // 2. Loop game
       function loop() {
         if (!running) return;
         // Update & render
         rafId = requestAnimationFrame(loop);
       }
       rafId = requestAnimationFrame(loop);

       // 3. Wajib: kembalikan objek pembersihan (cleanup)
       return {
         stop() {
           running = false;
           cancelAnimationFrame(rafId);
           unsubscribe(); // Lepas listener agar tidak terjadi memory leak
         }
       };
     }
   };
   ```
3. **Daftarkan di `games/index.js`**:
   ```javascript
   import pingpong from './pingpong.js';
   import dodge from './dodge.js';

   export const games = [pingpong, dodge];
   ```

---

## 5. Rencana Peningkatan Sektor Game System

1. **Sistem Skala Kanvas Adaptif (High-DPI / Retina Screen)**:
   - Menyesuaikan resolusi kanvas dengan `window.devicePixelRatio` agar rendering teks dan grafis terlihat tajam di layar resolusi tinggi.
2. **Menu Jeda Game (Pause Overlay)**:
   - Menyediakan fungsi pause saat tombol darurat atau salah satu koneksi controller mengalami degradasi sinyal.
3. **Modul Particle & Visual Effects**:
   - Pustaka partikel mini untuk efek ledakan, percikan bola, dan bintang kemenangan tanpa dependensi eksternal.

