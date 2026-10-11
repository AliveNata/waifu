# 03. Desktop companion: overlay, overlay tim, dan kantor AlyxLabs

Companion ini nampilin 2B dan timnya di tiga tempat:

- **Overlay 2B**: close-up 3D transparan di pojok kanan bawah layar, selalu di atas window lain. Kepala dan matanya ngikutin cursor lo.
- **Overlay tim**: close-up transparan di pojok kanan atas. Muncul cuma pas ada yang ngomong: 2B ngoper tugas, atau anggota tim mulai kerja, pakai tool, dan selesai. Ada gerak mulut, ekspresi, gesture, dan kotak dialog.
- **Kantor AlyxLabs**: window terpisah berisi kantor 3D dengan 2B dan tujuh anggota tim versi chibi (lihat [04-tim.md](04-tim.md)). Tiap anggota punya meja sesuai role-nya, mulai kerja pas subagent-nya dipanggil, dan pas lagi nggak ada tugas mereka istirahat dengan kegiatan masing-masing.

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
| `PreCompact` | thinking | sama kayak thinking | sama kayak thinking |
| `SessionEnd` | idle | santai | duduk di sofa |
| `SubagentStart` | (anggota) | nggak berubah | anggota yang dipanggil mulai kerja di mejanya |
| `SubagentStop` | (anggota) | nggak berubah | anggota itu selesai, ngulet atau senyum, lalu santai |

Greeting dan done balik ke idle sendiri setelah beberapa detik. Mood lain bertahan sampai event berikutnya, karena Claude Code nggak ngirim event "udah selesai mikir".

## Overlay tim

| Kejadian | Yang ngomong | Contoh (mode simulasi) | Gesture |
|---|---|---|---|
| 2B ngoper tugas | 2B | "Asuna, tolong bantu ya." | nunjuk |
| Subagent mulai | Anggota itu | "Oke, aku cek dulu ya." | ngangguk |
| Subagent pakai tool | Anggota itu | "Aku baca kodenya dulu." (maksimal sekali per 8 detik) | mikir atau ngetik |
| Subagent selesai | Anggota itu | "Review selesai. Hasilnya ada di laporan." | ngangguk atau sorak |

Kalimat simulasi cuma ngegambarin aktivitas, nggak pernah ngarang hasil. Tag "simulasi" muncul di pojok kotak dialog.

**Isi asli**: tombol **Isi asli** di overlay tim (samar, jadi jelas pas di-hover), atau **Menu > Tampilkan isi percakapan asli**. Kalau dinyalain, 2B nyebut judul tugas yang beneran, anggotanya jawab "oke, aku cek dulu", terus pas selesai dia ngejelasin laporan akhirnya kalimat per kalimat. Matiin lagi sebelum share screen.

Cara laporan dibacain:
- Diambil dari awal laporan akhir subagent, maksimal 1200 karakter. Format markdown dibuang, blok kode dilewatin, tiap poin atau kalimat jadi satu baris dialog.
- Maksimal 6 kalimat. Kalau laporannya lebih panjang, baris terakhirnya "Sisanya lengkap di laporan ke 2B ya."
- Ekspresi dan gesture ngikutin isi kalimatnya: kabar baik ("test lulus", "nggak ada error") senyum dan ngangguk, masalah ("gagal", "belum", "bug") alis khawatir dan geleng pelan, ragu ("belum bisa dipastikan", "kemungkinan", "nggak yakin") alis bingung, kepala miring, dan ngelirik ke atas, saran ("sebaiknya ...") nunjuk, pertanyaan alis naik dan mikir. Tebakannya dari kata kunci Indonesia dan Inggris, jadi kadang meleset, tapi yang meleset cuma ekspresinya, isi kalimatnya tetap persis dari laporan.

Wajah yang ngomong:
- Mulut ngikutin huruf yang lagi muncul di dialog, bukaannya beda dikit tiap vokal, dan nutup di spasi dan tanda baca.
- Kedip dengan jeda acak, kadang dua kali berturut-turut, dan selalu kedip abis selesai satu kalimat.
- Mata natap lo sambil ngelirik kecil. Pas mikir atau ragu ngelirik ke atas samping dulu, pas mau nyampein masalah nunduk sebentar.
- Di model VRoid, ekspresinya lewat alis dan mata secara terpisah, karena preset bawaan VRoid ("sad", "happy") ikut nutup mata. Model non-VRoid pakai preset biasa dengan bobot tipis.

Overlay tim sengaja lebih kecil dari overlay 2B (300 x 380).

**Di kantor**, wajah yang ngomong muncul kecil (150 x 180) di atas kotak dialog, bagian bawahnya nyelip di balik dialog. Isinya model lengkap anggota itu, sama kayak overlay tim, jadi ekspresi, kedipan, dan mulutnya ikut. Overlay tim di desktop tetap muncul juga. Kalau modelnya gagal dimuat, potretnya nggak muncul dan dialognya tetap jalan.

Overlay tim bisa digeser kayak overlay 2B.

Event yang terjadi di dalam subagent (misalnya Asuna ngejalanin `Edit`) cuma ngegerakin anggota itu, bukan 2B. Pas 2B ngoper kerjaan, chip status nampilin "Delegasi ke tim".

## Kantor AlyxLabs

Ruangannya terang dengan aksen ungu dari logo AlyxLabs: LED neon yang "lari" di atas dinding dan di sepanjang lis bawah, lampu di bawah meja, dan papan nama di dinding belakang. Semua furnitur diukur pakai tinggi chibi (sekitar 1,05 m), jadi meja setinggi pinggang, monitor sejajar mata pas duduk, dan papan tulis masih kejangkau tangan. Zonanya:

| Zona | Isi |
|---|---|
| Deretan meja belakang | Meja Asuna, Kobayashi, Erza, dan Yor, lemari printer, plus rak server di sebelah Yor |
| Tengah | Meja meeting empat kursi dengan laptop, meja pingpong, tanaman |
| Depan | Meja komando 2B dengan papan kanban dan printer di samping, dan pojok konten Ruby dengan backdrop logo, ring light, kamera, dan mic |
| Dinding kiri | Papan tulis (2B dan Rias), papan ide dan beanbag Chizuru, TV lounge |
| Lounge | Sofa menghadap TV, meja kopi, beanbag |
| Pantry | Mesin kopi, kulkas, meja bar dengan dua stool |
| Pojok game | Mesin arcade |

Setup meja sesuai role:

| Anggota | Setup | Pas kerja |
|---|---|---|
| Asuna | Monitor SQL, DAG pipeline, monitor vertikal job run, PC tower | Ngetik SQL, teks muncul per karakter dan tuts yang dipencet nyala |
| Kobayashi | Monitor ultrawide, monitor vertikal daftar PR, konsol handheld di dock, boneka naga, PC tower | Ngetik kode aplikasi |
| Erza | Monitor diff horizontal, checklist review di monitor vertikal, kue stroberi, PC tower | Ngetik catatan review |
| Yor | Terminal dan monitoring, stand headset, mawar, PC tower | Ngetik command read-only |
| 2B | Dua monitor dan kanban tim, PC tower | Ngetik plan, atau nulis di papan tulis pas mikir |
| Ruby | Laptop, mic, ring light | Ngetik draft post |
| Rias | Papan tulis | Gambar diagram, tangannya ngikutin ujung spidol |
| Chizuru | Papan ide | Nempel sticky note satu-satu |

**Pas nggak ada tugas**, tiap cast milih kegiatan sendiri dan jalan ke sana tanpa nembus furnitur atau cast lain: kerja santai di meja, bikin kopi, ngemil di kulkas, nonton TV, main game di sofa, main arcade, nyiram tanaman, rebahan di beanbag, baca, ngobrol di meja bar, meeting di meja tengah, atau main pingpong. Kira-kira setengah waktunya di meja, setengahnya istirahat. Biar nggak monoton:
- Kegiatan yang sama nggak dipilih dua kali berturut-turut, dan tiap kegiatan punya jeda sebelum bisa diulang.
- Tiap cast punya kesukaan sendiri. Kobayashi sering main arcade, Erza sering ngemil, Rias sering baca, Yor sering ngecek rak server, Ruby sering selfie di depan ring light.
- Satu tempat cuma dipakai satu orang. Kalau ada yang udah di bar atau meja meeting, yang lain lebih mungkin nyamperin.
- Pingpong selalu berdua. Yang mulai ngajak cast yang paling lama nganggur, dan nunggu di meja sambil pegang raket sampai lawannya dateng. Bolanya baru jalan pas dua-duanya udah di posisi, dan kalau satu pergi, yang lain ikut berhenti.
- Laptop di meja meeting ada empat, satu per kursi dan menghadap kursinya. Layarnya nyala dan bergerak cuma pas ada yang duduk di kursi itu.
- Pintu kulkas kebuka pas ada yang ngemil, terus ketutup lagi pas dia pergi.
- Yang punya meja bawa gelasnya ke pantry, bikin kopi, terus balik naruh gelasnya di samping keyboard. Rias dan Chizuru minum kopinya di tempat tujuan berikutnya.
- Barang di tangan ngikutin kegiatan: HP pas rebahan atau selfie, buku pas baca, stik pas main game, raket pas pingpong, penyiram pas nyiram tanaman.
- Abis kelar tugas, cast istirahat dulu, nggak langsung balik ke meja.
- Begitu dipanggil Claude Code, cast langsung ninggalin kegiatannya dan jalan ke mejanya.

Kursi, stool, dan beanbag nggak bisa dilewatin. Kursi kerja dan kursi meeting dimasukin dari samping, sofa dari depan lewat jalur antara sofa dan meja kopi, jadi nggak ada yang nembus sandaran. Yang duduk keluar lewat jalur yang sama waktu masuk, dan kursi yang baru ditinggal baru bisa dipakai orang lain setelah yang lama beneran pergi. Cast juga nggak saling tembus: yang lagi diam dihindari kayak furnitur, kalau papasan keduanya minggir ke kanan, dan kalau jalannya sempit salah satu nunggu atau minggir sebentar buat ngasih jalan.

TV nyala sendiri pas ada yang nonton atau main game, layar arcade makin rame pas dimainin, dan lampu rak server kedip cepat pas Yor ngecek.

Pose duduk diukur dari panjang kaki tiap model. Di kursi rendah lututnya naik dan telapak kakinya napak, di stool tinggi kakinya menggantung. Sandaran kursi dan sofa dibikin rendah, terus ujung atasnya, sandaran sofa, dudukan stool, punggung beanbag, dan lantai jadi penghalang buat physics rambut, jadi rambut panjang jatuh ke balik sandaran, bukan nembus. Langkah jalannya pendek dengan goyang pinggul kecil, biar rok dan dress panjang (misalnya dress hitam Yor) tetap jatuh natural.

**Mode malam** ngikutin jam PC. Mulai sekitar 17.30 lampu meredup pelan sampai gelap penuh jam 19.00, jendela berubah jadi pemandangan kota malam, dan LED neon jadi sumber cahaya utama. Pagi kebalikannya, terang lagi antara 05.00 dan 06.30. Di mode browser, tambahin `?clock=21:30` di URL kantor buat lihat jam lain tanpa nunggu malam.

**Kamera**: drag buat muter, scroll buat zoom, klik dua kali buat balik ke tampilan awal. Pakai keyboard: Tab ke ruangan, panah buat muter, `+` dan `-` buat zoom, `0` buat reset. Kalau lama nggak disentuh, kameranya goyang pelan sendiri.

Isi layar, papan tulis, dan sticky note semuanya **simulasi**, bukan kerjaan asli lo. Jadi aman pas lagi share screen.

Pas ada yang kerja, panel **close-up** muncul sendiri di kiri, nempel di atas panel chat dengan lebar yang sama (kalau chat ditutup, dia pindah ke kiri bawah), dan nampilin layar atau papan anggota yang terakhir aktif, lengkap dengan nama tool yang lagi dipakai. Setelah semua selesai, panelnya nunggu beberapa detik biar momen selesainya kelihatan, lalu hilang sendiri. Buat matiin sama sekali (misalnya pas share screen), hapus centang **Menu > Close-up kantor pas ada yang kerja**. Di mode browser, setting-nya ada di dialog **Model**.

Kalau 2B ngerjain tugas sendiri tanpa delegasi ke tim, dia tetap ngomong singkat di kotak obrolan: pas mulai, pas pakai tool (paling sering sekali tiap 8 detik), dan pas selesai.

Obrolan tim yang sama dengan overlay kanan atas juga tampil di kantor, nempel di atas panel close-up. Kalau close-up lagi nggak tampil, kotak obrolannya turun ke posisi close-up.

Tombol **Sembunyiin 2B** dan **Tampilin 2B** di kanan bawah kantor buat nyembunyiin atau nampilin 2B di desktop tanpa nutup aplikasinya. Bisa juga lewat **Menu > Tampilkan 2B di desktop**. Kalau 2B lagi disembunyiin dan kantor ketutup, jalanin `npm start` lagi buat munculin dia.

## Chat ke 2B dari kantor

Lo bisa ngasih tugas langsung dari kantor tanpa buka terminal. Panel **Chat ke 2B** ada di kiri bawah.

1. Klik **Pilih folder**, terus pilih folder project lo. 2B cuma kerja di folder itu.
2. Ketik tugasnya, tekan Enter (Shift+Enter buat baris baru).
3. Balasan 2B muncul sambil diketik. Tiap tool yang dipakai muncul sebagai baris kecil, misalnya `Bash: npm test`.
4. Kalau 2B butuh izin, muncul **kartu hijau** isinya nama tool dan command lengkapnya. Klik **Izinkan** atau **Tolak**. Pakai keyboard: kartunya langsung dapat fokus, Tab sekali ke Izinkan, dua kali ke Tolak.
5. **Stop** ngehentiin kerjaan yang lagi jalan. **Chat baru** mulai obrolan dari nol di folder yang sama.

Tombol **Tutup chat** dan **Buka chat** di kanan bawah buat nyembunyiin atau nampilin panelnya. Bisa juga lewat **Menu > Chat ke Claude di kantor**.

Cara kerjanya:
- Tiap pesan ngejalanin `claude -p` (Claude Code yang sudah ke-install di PC lo) di folder yang dipilih, lalu nyambung obrolan sebelumnya lewat `--resume`. Jadi pakai **login dan kuota Claude Code lo sendiri**, nggak ada API key atau tagihan terpisah.
- Mode izinnya dikunci ke `default`, jadi tiap tool yang biasanya nanya izin di terminal bakal muncul sebagai kartu. Allow rules di `settings.json` lo tetap berlaku, jadi command yang sudah lo izinkan permanen nggak nanya lagi.
- Kartu izin dikirim lewat hook `PermissionRequest` khusus sesi ini, ke server lokal companion, pakai token acak yang baru tiap companion jalan. Session Claude Code di terminal nggak kena hook ini.
- Hooks lo yang biasa tetap jalan, jadi 2B dan tim di kantor tetap gerak sesuai kerjaan.
- Kalau kantor ditutup, chat dimatiin, atau 2B nunggu izin lebih dari 10 menit, permintaan izin otomatis ditolak.

Batasannya:
- Cuma ada di aplikasi Electron (`npm start`). Mode browser nggak punya chat, soalnya chat ini ngejalanin Claude Code di PC lo, dan itu nggak aman dibuka lewat halaman web.
- Mode `-p` nggak nampilin dialog trust folder. Hooks dan `.mcp.json` di folder yang lo pilih langsung jalan, jadi **pilih folder project lo sendiri aja**, jangan folder hasil download orang.

## Kebutuhan

- Windows 10 atau 11.
- [Node.js](https://nodejs.org) versi 22 atau lebih baru.
- [Git](https://git-scm.com).
- Claude Code yang jalan **di PC lo** (CLI atau desktop app). Hooks dijalanin di mesin tempat Claude Code jalan, jadi session Claude Code di cloud (claude.ai/code) nggak bisa ngirim event ke PC lo.

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

Pertama kali jalan, overlay nampilin 2B versi model cadangan (rambut putih). Begitu lo punya `.vrm` aslinya, simpan jadi `models/2b.vrm` di root repo, lalu restart companion. Anggota lain sama, pakai nama masing-masing (`ruby.vrm`, `erza.vrm`, dst). Bisa juga dipilih lewat **Menu > Pilih model .vrm > 2B**. Path dari menu disimpan dan menang atas file di `models/`.

Menu ada di tombol **Menu** di pojok kanan bawah 2B (samar, jadi jelas pas di-hover atau difokus pakai Tab). **Klik kanan di 2B** juga ngebuka menu yang sama. Isinya:

- **Pilih model .vrm** dengan submenu per anggota tim. Model yang dipasang dipakai di semua tempat anggota itu muncul. Yang belum punya pakai model cadangan. Cara nyari model ada di [05-cari-model.md](05-cari-model.md).
- **Buka kantor / Tutup kantor**. Kantor kebuka sendiri pas `npm start` kalau terakhir kali dia masih kebuka.
- **Overlay selalu di atas** buat on/off always-on-top (berlaku buat dua overlay).
- **Tampilkan isi percakapan asli** buat nyalain atau matiin isi asli di overlay tim.
- **Keluar**.

Overlay bisa digeser dengan drag di area mana aja selain tombol.

## Sambungin ke Claude Code

1. Di folder `companion`, cek dulu apa yang bakal berubah:
   ```powershell
   npm run hooks:install -- --dry-run
   ```
   Perintah ini nampilin isi `%USERPROFILE%\.claude\settings.json` setelah diubah, tanpa nulis apa-apa.
2. Kalau udah oke, pasang:
   ```powershell
   npm run hooks:install
   ```
   Yang dilakuin installer:
   - File lama di-backup dulu jadi `settings.json.bak-<waktu>`.
   - Setting dan hook lo yang lain nggak disentuh. Yang diganti cuma entry `send-hook-event.js` punya companion, termasuk yang path-nya udah basi karena folder repo pindah.
   - Aman dijalanin ulang. Kalau udah kepasang, hasilnya `unchanged` dan nggak ada yang ditulis.
   - Kalau `settings.json` lo bukan JSON valid, installer berhenti tanpa ngubah apa-apa.
3. Restart Claude Code. Cek pakai command `/hooks`, harusnya ada entry `send-hook-event.js` di tiap event.

Mau masang manual? `npm run build`, lalu `npm run hooks:print` buat nge-print blok `hooks`, terus gabungin sendiri ke `settings.json`.

Buat nyopot hooks companion aja (hook lain tetap aman):
```powershell
npm run hooks:install -- --uninstall
```

Hook-nya jalan dengan `"async": true`, jadi Claude Code nggak nungguin companion. Kalau companion lagi ditutup, hook cuma nulis satu baris log ke stderr dan exit 0. Kerjaan lo di Claude Code nggak keganggu.

## Data apa yang dikirim

Bridge cuma nerusin field ini ke `127.0.0.1`: nama event, nama tool (misalnya `Bash`), pesan notifikasi, ID dan nama subagent, judul tugas pendek dari 2B (maksimal 120 karakter), dan awal laporan akhir subagent (maksimal 1200 karakter, baris barunya dipertahanin biar bisa dipecah per kalimat). Dua yang terakhir cuma ditampilin kalau **isi asli** dinyalain. Isi file, command, prompt lo, prompt lengkap ke subagent, dan path transcript dibuang di bridge sebelum dikirim. Server companion cuma dengerin di localhost dan nolak request yang bukan `application/json`, jadi website random di browser nggak bisa nembak endpoint-nya.

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

`WAIFU_MODEL_PATH` buat 2B, `WAIFU_MODEL_PATH_<NAMA>` buat anggota lain (`CHIZURU`, `RIAS`, `ASUNA`, `KOBAYASHI`, `YOR`, `ERZA`, `RUBY`). Semuanya opsional. Model juga bisa dipilih lewat tombol **Model** di halaman kantor.

Lalu buka `http://127.0.0.1:47823/overlay/`, `http://127.0.0.1:47823/team-overlay/`, dan `http://127.0.0.1:47823/office/`. Hooks tetap nyambung lewat port yang sama.

## Troubleshooting

| Gejala | Penyebab yang mungkin | Cek |
|---|---|---|
| Chip merah "Port ... sudah dipakai" | Ada aplikasi lain di port itu, atau companion kebuka dua kali lewat mode browser | Tutup yang lain, atau ganti port |
| 2B nggak bereaksi | Hooks belum kepasang, atau path di `settings.json` salah | `/hooks` di Claude Code, lalu jalanin command hook-nya manual di PowerShell |
| "Model gagal dimuat" | File bukan VRM, atau export-nya rusak | Export ulang dari VRoid, atau cek pakai `npm run inspect-vrm` |
| Anggota tim nggak gerak pas dipanggil | Agent belum di-install, atau hooks belum ada `SubagentStart` | `npm run team:install`, lalu `npm run hooks:install` |
| Pose aneh (tangan nembus badan, duduk melayang) | Proporsi model beda jauh dari default VRoid | Kasih tau gua, angka pose bisa diatur |
| Kantor masih kotak-kotak, ada chip "Model anime belum ada" | Model cadangan belum didownload | `npm run fetch-base-model`, lalu buka ulang companion |
| Overlay tim nggak pernah muncul | Nggak ada subagent yang dipanggil, atau hooks lama tanpa `SubagentStart` | Minta 2B delegasi, atau jalanin `npm run hooks:install` |
| Chat bilang "Claude Code nggak ketemu" | `claude` nggak ada di PATH | Jalanin `claude --version` di PowerShell. Kalau install-nya di tempat lain, set `WAIFU_CLAUDE_COMMAND` ke path lengkap `claude.exe` |
| Chat bilang "belum login" | Claude Code belum pernah login di PC ini | Jalanin `claude` sekali di terminal dan login |
| Semua izin langsung ditolak tanpa kartu | `allowedHttpHookUrls` di settings lo nggak masukin server companion | Tambahin `http://127.0.0.1:47823/*` (atau port lo) ke daftar itu |

## Buat developer

```powershell
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

Set `WAIFU_SAMPLE_VRM` ke path file `.vrm` kalau mau e2e ikut ngetes load model beneran. Tanpa itu, test tersebut di-skip.
