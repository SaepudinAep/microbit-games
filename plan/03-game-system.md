# Sektor 03: Game System & Standarisasi Game

Dokumen ini mendefinisikan spesifikasi kontrak game (*Game Contract API*), arsitektur implementasi game, dan panduan terstandarisasi untuk membuat modul game baru.

---

## 1. Spesifikasi Kontrak Game (*The Game Contract*)

Setiap game dalam platform ini diperlakukan sebagai modul independen dengan format ES Module (`export default`). Shell mengonsumsi modul game berdasarkan kontrak berikut:

```typescript
interface GameModule {
  id: string;                     // Identifier unik tanpa spasi (mis: 'dinorush')
  name: string;                   // Nama display game (mis: 'Dino Jump')
  icon?: string;                  // Emoji atau ikon display (mis: '🦖')
  description: string;            // Ringkasan panduan cara bermain
  modes: GameMode[];              // Daftar mode permainan yang didukung
  canvas: {
    width: number;                // Resolusi internal kanvas (STANDAR PLATFORM: 1280)
    height: number;               // Resolusi internal kanvas (STANDAR PLATFORM: 720)
  };
  create(context: GameContext): GameInstance;
}

interface GameMode {
  id: string;                     // ID mode (mis: '1p', '2p', '4p')
  label: string;                  // Label tombol (mis: '1 Player')
  sub: string;                    // Deskripsi singkat di bawah label tombol
  players: number;                // Jumlah pemain yang disyaratkan
  options?: Record<string, any>;  // Opsi default game (nyawa, aturan selesai)
}

interface GameContext {
  canvas: HTMLCanvasElement;      // Elemen DOM canvas yang disediakan shell
  kernel: KernelObject;           // Referensi ke objek Kernel
  players: number[];              // Array nomor slot pemain yang bermain, urut (contoh: [1, 2])
  mode: GameMode;                 // Mode aktif yang dipilih pengguna
  finish: (winnerText: string) => void; // Callback yang dipanggil saat game berakhir
  audio?: SoundObject;            // Layanan suara Web Audio API (singleton Sound)
  options?: Record<string, any>;  // Opsi konfigurasi dari shell/pengguna
}

interface GameInstance {
  stop: () => void;               // Fungsi wajib untuk membersihkan requestAnimationFrame, timers, & event listener
}
```

---

## 2. Aturan Standar Desain Game (Landscape-First)

Untuk menjamin kenyamanan maksimal saat dimainkan di **Panel Interaktif Digital (PID) sekolah**, laptop, dan tablet:

1. **Resolusi Kanvas Standar**:
   - `canvas: { width: 1280, height: 720 }` (Aspect ratio 16:9).
   - Game lama dengan resolusi berbeda (mis. 600×800) tetap didukung penuh oleh shell dengan tampilan *letterbox* dan pencatatan `console.warn` informatif satu kali.
2. **Prinsip Landscape-First**:
   - Alur pergerakan dan tata letak arena dirancang melebar horizontal.
   - Untuk game multi-lintasan (seperti Dino Jump), lintasan disusun memanjang dari kiri ke kanan.
3. **HUD di Dalam Kanvas & Area Aman (Safe Zone)**:
   - Seluruh teks status, skor, nyawa, dan label pemain digambar langsung di dalam kanvas oleh game.
   - **Batas Aman 40 px**: Jangan menempatkan teks atau indikator vital tepat di tepi atas dan pojok kanvas (khususnya pojok kiri atas dan kanan atas) agar tidak tertutupi oleh tombol kontrol overlay platform (`#quit`, `#mon`, `#snd`, `#fs`).
4. **Mandatory Start Protocol**:
   - Permainan dimulai saat menerima perintah `99#` dari micro:bit pemain mana pun ATAU saat layar/kanvas diklik.

---

## 3. Bedah Teknis Game Eksisting

### 3.1 Dino Jump (`games/dinorush.js` - Standar Landscape 16:9)
- Dimensi kanvas: $1280 \times 720\text{ px}$.
- Multi-lintasan (1–4 pemain) membentang horizontal penuh.
- Reaksi visual leluasa (~1.140 px dari spawn ke dino).

### 3.2 Game Klasik Ported (Ping Pong, Space Invaders, Tank Battle, Endless Racer)
- Berjalan pada resolusi $600 \times 800\text{ px}$.
- Shell secara otomatis merender kanvas di tengah panggung hitam (`object-fit: contain`) tanpa distorsi rasio, memastikan kompatibilitas mundur 100%.

---

## 4. Panduan Terstandarisasi Membuat Game Baru

Untuk menambahkan game baru (misalnya game bernama **"cyberdash"**):

1. **Buat file modul**: `games/cyberdash.js`.
2. **Definisikan metadata standar 1280×720**:
   ```javascript
   export default {
     id: 'cyberdash',
     name: 'Cyber Dash',
     icon: '⚡',
     description: 'Lari cepat melintasi rintangan di arena lebar!',
     modes: [
       { id: '1p', label: '1 Player', sub: 'Tantangan Solo', players: 1 },
       { id: '2p', label: '2 Player', sub: 'Balap Berdua', players: 2 }
     ],
     canvas: { width: 1280, height: 720 }, // Standar 16:9
     create({ canvas, kernel, players, mode, finish, audio }) {
       canvas.width = 1280;
       canvas.height = 720;
       const ctx = canvas.getContext('2d');
       let running = true;
       let rafId = 0;

       audio?.play('start');

       const unsubscribe = kernel.on('input', ({ player, cmd }) => {
         // Proses perintah game
       });

       function loop() {
         if (!running) return;
         // Update & render dengan safe zone 40px
         rafId = requestAnimationFrame(loop);
       }
       rafId = requestAnimationFrame(loop);

       return {
         stop() {
           running = false;
           cancelAnimationFrame(rafId);
           unsubscribe();
         }
       };
     }
   };
   ```
3. **Daftarkan di `games/index.js`**:
   ```javascript
   import cyberdash from './cyberdash.js';
   export const games = [..., cyberdash];
   ```
