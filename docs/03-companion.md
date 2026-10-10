# 03. Desktop companion: overlay, overlay tim, dan kantor chibi

Companion ini nampilin 2B dan timnya di tiga tempat:

- **Overlay 2B**: close-up 3D transparan di pojok kanan bawah layar, selalu di atas window lain. Kepala dan matanya ngikutin cursor lo.
- **Overlay tim**: close-up transparan di pojok kanan atas. Muncul cuma pas ada yang ngomong: 2B ngoper tugas, atau anggota tim mulai kerja, pakai tool, dan selesai. Ada gerak mulut, ekspresi, gesture, dan kotak dialog.
- **Kantor**: window terpisah berisi ruangan isometrik dengan tujuh anggota tim versi chibi (lihat [04-tim.md](04-tim.md)). Tiap anggota punya meja atau papan sendiri dan mulai kerja pas subagent-nya dipanggil.

Ketiganya bereaksi ke event yang sama dari hooks Claude Code.

## Model karakter

Urutan model yang dipakai buat tiap anggota:
1. `.vrm` asli yang lo pasang lewat **Menu > Pilih model .vrm**.
2. Kalau belum ada: **model anime cadangan**, yaitu sample resmi VRM 1.0 yang diwarnai ulang pakai warna rambut, mata, dan baju tiap karakter, plus kacamata buat Kobayashi. Wajah dan model rambutnya sama buat semua anggota.
3. Kalau model cadangan belum didownload: chibi kotak-kotak di kantor, dan tulisan "Belum ada model" di overlay 2B.

Model cadangan didownload sekali (sekitar 10 MB, versi di-pin dan dicek hash-nya):

```powershell
npm run fetch-base-model
```

File-nya disimpan di `models/base/` dan nggak ikut ke-commit.

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

## Overlay tim

| Kejadian | Yang ngomong | Contoh (mode simulasi) | Gesture |
|---|---|---|---|
| 2B ngoper tugas | 2B | "Asuna, tolong bantu ya." | nunjuk |
| Subagent mulai | Anggota itu | "Oke, aku cek pipeline datanya." | ngangguk |
| Subagent pakai tool | Anggota itu | "Aku baca kodenya dulu." (maksimal sekali per 8 detik) | mikir atau ngetik |
| Subagent selesai | Anggota itu | "Review selesai. Hasilnya ada di laporan." | ngangguk atau sorak |

Kalimat simulasi cuma ngegambarin aktivitas, nggak pernah ngarang hasil. Tag "simulasi" muncul di pojok kotak dialog.

**Isi asli**: tombol **Isi asli** di overlay tim (muncul pas di-hover), atau **Menu > Tampilkan isi percakapan asli**. Kalau dinyalain, 2B nyebut judul tugas yang beneran, dan anggota tim nutup dengan ringkasan laporan akhirnya (maksimal 280 karakter). Matiin lagi sebelum share screen.

Overlay tim bisa digeser kayak overlay 2B.
| `PreCompact` | thinking | sama kayak thinking | sama kayak thinking |
| `SessionEnd` | idle | santai | duduk di sofa |

Greeting dan done balik ke idle sendiri setelah beberapa detik. Mood lain bertahan sampai event berikutnya, karena Claude Code nggak ngirim event "udah selesai mikir".

Event yang terjadi di dalam subagent (misalnya Asuna ngejalanin `Edit`) cuma ngegerakin anggota itu, bukan 2B. Pas 2B ngoper kerjaan, chip status nampilin "Delegasi ke tim".

## Animasi di kantor

| Anggota | Pas kerja | Pas santai |
|---|---|---|
| Asuna, Kobayashi, Yor, Erza | Ngetik. Teks muncul per karakter di monitor, tuts keyboard yang dipencet nyala | Nyender, nengok-nengok |
| Rias | Nulis diagram di papan tulis, tangannya ngikutin ujung spidol | Baca buku |
| Chizuru | Nempel sticky note satu-satu di papan ide | Mikir sambil pegang dagu |
| 2B | Ngetik di laptop, atau nulis plan di papan tulis pas mikir | Duduk di sofa |
| MEM-cho | Ngetik draft post di laptop, di meja dengan ring light | Nyender, nengok-nengok |

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
cd waifu
git checkout claude/3d-waifu-modeling-rigging-pkwpy7
cd companion
npm ci
npm run fetch-base-model
npm start
```

`npm ci` ikut download Electron (sekitar 100 MB), jadi yang pertama agak lama.

Pertama kali jalan, overlay nampilin 2B versi model cadangan (rambut biru). Begitu lo punya `.vrm` aslinya, pasang lewat **Menu > Pilih model .vrm > 2B**. Path-nya disimpan, jadi next time langsung kebuka.

Menu ada di tombol **Menu**. Di overlay, tombolnya cuma muncul pas cursor di atasnya, atau pas difokus pakai Tab. Isinya:

- **Pilih model .vrm** dengan submenu per anggota tim. Model yang dipasang dipakai di semua tempat anggota itu muncul. Yang belum punya pakai model cadangan. Cara nyari model ada di [05-cari-model.md](05-cari-model.md).
- **Buka kantor / Tutup kantor**.
- **Overlay selalu di atas** buat on/off always-on-top (berlaku buat dua overlay).
- **Tampilkan isi percakapan asli** buat nyalain atau matiin isi asli di overlay tim.
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

Bridge cuma nerusin field ini ke `127.0.0.1`: nama event, nama tool (misalnya `Bash`), pesan notifikasi, ID dan nama subagent, judul tugas pendek dari 2B (maksimal 120 karakter), dan awal laporan akhir subagent (maksimal 280 karakter). Dua yang terakhir cuma ditampilin kalau **isi asli** dinyalain. Isi file, command, prompt lo, prompt lengkap ke subagent, dan path transcript dibuang di bridge sebelum dikirim. Server companion cuma dengerin di localhost dan nolak request yang bukan `application/json`, jadi website random di browser nggak bisa nembak endpoint-nya.

## Ganti port

Default port `47823`. Kalau bentrok, set environment variable `WAIFU_COMPANION_PORT` dengan nilai yang sama di dua tempat: buat companion, dan buat Claude Code (karena hook ikut baca variable itu).

```powershell
setx WAIFU_COMPANION_PORT 48123
```

Buka terminal baru setelah `setx` biar nilainya kebaca.

## Mode browser (tanpa Electron)

Buat ngetes atau kalau nggak mau window transparan:

```powershell
$env:WAIFU_MODEL_PATH = "C:\path\ke\twob-vrm1.vrm"
$env:WAIFU_MODEL_PATH_ASUNA = "C:\path\ke\asuna.vrm"
npm run web
```

`WAIFU_MODEL_PATH` buat 2B, `WAIFU_MODEL_PATH_<NAMA>` buat anggota lain (`CHIZURU`, `RIAS`, `ASUNA`, `KOBAYASHI`, `YOR`, `ERZA`, `MEM`). Semuanya opsional. Model juga bisa dipilih lewat tombol **Model** di halaman kantor.

Lalu buka `http://127.0.0.1:47823/overlay/`, `http://127.0.0.1:47823/team-overlay/`, dan `http://127.0.0.1:47823/office/`. Hooks tetap nyambung lewat port yang sama.

## Troubleshooting

| Gejala | Penyebab yang mungkin | Cek |
|---|---|---|
| Chip merah "Port ... sudah dipakai" | Ada aplikasi lain di port itu, atau companion kebuka dua kali lewat mode browser | Tutup yang lain, atau ganti port |
| 2B nggak bereaksi | Hooks belum kepasang, atau path di `settings.json` salah | `/hooks` di Claude Code, lalu jalanin command hook-nya manual di PowerShell |
| "Model gagal dimuat" | File bukan VRM, atau export-nya rusak | Export ulang dari VRoid, atau cek pakai `npm run inspect-vrm` |
| Anggota tim nggak gerak pas dipanggil | Agent belum di-install, atau hooks belum ada `SubagentStart` | `npm run team:install`, lalu ulangi `hooks:print` |
| Pose aneh (tangan nembus badan, duduk melayang) | Proporsi model beda jauh dari default VRoid | Kasih tau gua, angka pose bisa diatur |
| Kantor masih kotak-kotak, ada chip "Model anime belum ada" | Model cadangan belum didownload | `npm run fetch-base-model`, lalu buka ulang companion |
| Overlay tim nggak pernah muncul | Nggak ada subagent yang dipanggil, atau hooks lama tanpa `SubagentStart` | Minta 2B delegasi, atau ulangi `hooks:print` |

## Buat developer

```powershell
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

Set `WAIFU_SAMPLE_VRM` ke path file `.vrm` kalau mau e2e ikut ngetes load model beneran. Tanpa itu, test tersebut di-skip.
