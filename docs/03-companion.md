# 03. Desktop companion: overlay close-up + kantor chibi

Companion ini nampilin Xenovia dan timnya di dua tempat:

- **Overlay**: close-up 3D Xenovia, transparan, di pojok kanan bawah layar, selalu di atas window lain. Kepala dan matanya ngikutin cursor lo.
- **Kantor**: window terpisah berisi ruangan isometrik low-poly dengan tujuh anggota tim versi chibi (lihat [04-tim.md](04-tim.md)). Tiap anggota punya meja atau papan sendiri dan mulai kerja pas subagent-nya dipanggil.

Dua-duanya bereaksi ke event yang sama dari hooks Claude Code.

## Reaksi per event

| Event Claude Code | Mood | Overlay | Kantor |
|---|---|---|---|
| `SessionStart` | greeting | senyum, kepala miring | jalan ke depan, melambai |
| `UserPromptSubmit` | thinking | kepala miring, mata ke atas | berdiri di papan tulis, nulis |
| `PreToolUse`, `PostToolUse` | working | nunduk kayak baca layar | duduk di meja laptop, ngetik |
| `Notification` | waiting | kaget, condong ke depan | jalan ke depan, melambai pelan |
| `Stop` | done | senyum lebar, ngangguk | lompat kecil di depan, lalu balik ke sofa |
| `SubagentStart` | (anggota) | nggak berubah | anggota yang dipanggil mulai kerja di mejanya |
| `SubagentStop` | (anggota) | nggak berubah | anggota itu selesai, ngulet atau senyum, lalu santai |
| `PreCompact` | thinking | sama kayak thinking | sama kayak thinking |
| `SessionEnd` | idle | santai | duduk di sofa |

Greeting dan done balik ke idle sendiri setelah beberapa detik. Mood lain bertahan sampai event berikutnya, karena Claude Code nggak ngirim event "udah selesai mikir".

Event yang terjadi di dalam subagent (misalnya Asuna ngejalanin `Edit`) cuma ngegerakin anggota itu, bukan Xenovia. Pas Xenovia ngoper kerjaan, chip status nampilin "Delegasi ke tim".

## Animasi di kantor

| Anggota | Pas kerja | Pas santai |
|---|---|---|
| Asuna, Kobayashi, Fubuki, Erza | Ngetik. Teks muncul per karakter di monitor, tuts keyboard yang dipencet nyala | Nyender, nengok-nengok |
| Robin | Nulis diagram di papan tulis, tangannya ngikutin ujung spidol | Baca buku |
| Chizuru | Nempel sticky note satu-satu di papan ide | Mikir sambil pegang dagu |
| Xenovia | Ngetik di laptop, atau nulis plan di papan tulis pas mikir | Duduk di sofa |

Isi layar, papan tulis, dan sticky note semuanya **simulasi**, bukan kerjaan asli lo. Jadi aman pas lagi share screen.

Pas ada yang kerja, panel **close-up** muncul di pojok kanan bawah dan nampilin layar atau papan anggota yang terakhir aktif, lengkap dengan nama tool yang lagi dipakai. Tombol **Sembunyikan close-up** buat matiin panelnya.

## Kebutuhan

- Windows 10 atau 11.
- [Node.js](https://nodejs.org) versi 22 atau lebih baru.
- [Git](https://git-scm.com).
- Claude Code yang jalan **di PC lo** (CLI atau desktop app). Hooks dijalanin di mesin tempat Claude Code jalan. Session cloud kayak yang lagi kita pakai sekarang nggak bisa ngirim event ke PC lo.

## Install dan jalanin

Buka PowerShell:

```powershell
git clone https://github.com/AliveNata/waifu.git
cd waifu/companion
npm ci
npm start
```

`npm ci` ikut download Electron (sekitar 100 MB), jadi yang pertama agak lama.

Pertama kali jalan, overlay nampilin "Belum ada model". Klik **Pilih file .vrm**, lalu pilih hasil export dari VRoid. Path-nya disimpan, jadi next time langsung kebuka.

Menu ada di tombol **Menu**. Di overlay, tombolnya cuma muncul pas cursor di atasnya, atau pas difokus pakai Tab. Isinya:

- **Pilih model .vrm** dengan submenu per anggota tim. Model Xenovia dipakai di overlay dan kantor. Model anggota lain dipakai di kantor. Yang belum punya model tampil sebagai placeholder. Cara nyari model ada di [05-cari-model.md](05-cari-model.md).
- **Buka kantor / Tutup kantor**.
- **Overlay selalu di atas** buat on/off always-on-top.
- **Keluar**.

Overlay bisa digeser dengan drag di area mana aja selain tombol.

## Sambungin ke Claude Code

1. Di folder `companion`, jalanin:
   ```powershell
   npm run build
   npm run hooks:print
   ```
   Perintah kedua nge-print blok `hooks` lengkap dengan path absolut ke script bridge di PC lo. Kalau sebelumnya lo udah pasang hooks dari versi lama, ulangi langkah ini, karena sekarang ada event `SubagentStart` dan `SubagentStop`.
2. Buka `%USERPROFILE%\.claude\settings.json`. Kalau belum ada, bikin file baru isinya `{}`.
3. Gabungin blok `hooks` dari langkah 1 ke file itu.
   - Kalau file lo **belum punya** key `hooks`: tempel aja.
   - Kalau **udah punya**: tambahin entry per event ke array yang udah ada. Jangan timpa hook lo yang lain.
4. Restart Claude Code. Cek pakai command `/hooks`, harusnya ada entry `send-hook-event.js` di tiap event.

Hook-nya jalan dengan `"async": true`, jadi Claude Code nggak nungguin companion. Kalau companion lagi ditutup, hook cuma nulis satu baris log ke stderr dan exit 0. Kerjaan gua nggak keganggu.

## Data apa yang dikirim

Bridge cuma nerusin field ini ke `127.0.0.1`: nama event, nama tool (misalnya `Bash`), pesan notifikasi, plus ID dan nama subagent. Isi file, command, prompt lo, path transcript, dan laporan akhir subagent dibuang di bridge sebelum dikirim. Server companion cuma dengerin di localhost dan nolak request yang bukan `application/json`, jadi website random di browser nggak bisa nembak endpoint-nya.

## Ganti port

Default port `47823`. Kalau bentrok, set environment variable `WAIFU_COMPANION_PORT` dengan nilai yang sama di dua tempat: buat companion, dan buat Claude Code (karena hook ikut baca variable itu).

```powershell
setx WAIFU_COMPANION_PORT 48123
```

Buka terminal baru setelah `setx` biar nilainya kebaca.

## Mode browser (tanpa Electron)

Buat ngetes atau kalau nggak mau window transparan:

```powershell
$env:WAIFU_MODEL_PATH = "C:\path\ke\xenovia-vrm1.vrm"
$env:WAIFU_MODEL_PATH_ASUNA = "C:\path\ke\asuna.vrm"
npm run web
```

`WAIFU_MODEL_PATH` buat Xenovia, `WAIFU_MODEL_PATH_<NAMA>` buat anggota lain (`CHIZURU`, `ROBIN`, `ASUNA`, `KOBAYASHI`, `FUBUKI`, `ERZA`). Semuanya opsional. Model juga bisa dipilih lewat tombol **Model** di halaman kantor.

Lalu buka `http://127.0.0.1:47823/overlay/` dan `http://127.0.0.1:47823/office/`. Hooks tetap nyambung lewat port yang sama.

## Troubleshooting

| Gejala | Penyebab yang mungkin | Cek |
|---|---|---|
| Chip merah "Port ... sudah dipakai" | Ada aplikasi lain di port itu, atau companion kebuka dua kali lewat mode browser | Tutup yang lain, atau ganti port |
| Xenovia nggak bereaksi | Hooks belum kepasang, atau path di `settings.json` salah | `/hooks` di Claude Code, lalu jalanin command hook-nya manual di PowerShell |
| "Model gagal dimuat" | File bukan VRM, atau export-nya rusak | Export ulang dari VRoid, atau cek pakai `npm run inspect-vrm` |
| Anggota tim nggak gerak pas dipanggil | Agent belum di-install, atau hooks belum ada `SubagentStart` | `npm run team:install`, lalu ulangi `hooks:print` |
| Pose aneh (tangan nembus badan, duduk melayang) | Proporsi model beda jauh dari default VRoid | Kasih tau gua, angka pose bisa diatur |

## Buat developer

```powershell
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

Set `WAIFU_SAMPLE_VRM` ke path file `.vrm` kalau mau e2e ikut ngetes load model beneran. Tanpa itu, test tersebut di-skip.
