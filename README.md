# waifu

2B (NieR:Automata) dan timnya sebagai avatar 3D. Isinya:

1. **Desktop companion** di Windows: close-up 2B di kanan bawah, overlay **AlyxLabs Team** yang ngobrol di kanan atas, dan **AlyxLabs Office**, kantor 3D berisi tim chibi yang kerja dan istirahat sendiri. Semuanya bereaksi ke hooks Claude Code.
2. **Tim agent Claude Code**: 2B sebagai PA + PM, dibantu tujuh subagent dengan karakter masing-masing.
3. **Avatar VRChat** buat upload private. Ini masih rencana, lihat fase 6.

Ini fan project buat pemakaian pribadi. Semua karakter milik pemegang hak cipta masing-masing, jadi model dan avatar jangan dijual, didistribusikan, atau di-upload public. Sebagian model wajib kredit ke creator-nya: catat di `models/CREDITS.md` dan cantumin tiap kali avatarnya ditampilin ke orang lain. Syarat tiap model ada di [docs/05-cari-model.md](docs/05-cari-model.md).

## Fitur

- **2B di desktop**: kepala dan matanya ngikutin cursor, ekspresinya ngikutin event Claude Code. Klik buat nyentuh dia (kepala, rambut, dahi, hidung, pipi, bahu, tangan), masing-masing ada reaksinya sendiri. Tahan dan geser buat mindahin window-nya.
- **AlyxLabs Team**: anggota yang lagi dipanggil Claude Code ngomong di overlay kanan atas. Laporannya dibacain kalimat per kalimat, dengan ekspresi, kedipan, dan gerak mulut yang ngikutin isi kalimatnya.
- **AlyxLabs Office**: tiap anggota punya meja sesuai role-nya. Pas lagi nggak ada tugas, mereka istirahat sendiri: ngopi, ngemil di kulkas, meeting, main pingpong berdua, dan lain-lain. Close-up nampilin siapa yang lagi kerja, dan potret kecil yang ngomong muncul di atas dialog tim. Jari mereka mencet tuts yang sesuai pas ngetik, nulis di papan tulis kayak orang beneran, saling sapa pas papasan, dan ngobrol santai lewat balon di atas kepala. Ada setting grafis tinggi atau ringan di Menu.
- **Chat ke Claude dari kantor**: kirim tugas ke Claude Code di folder project lo, izinin atau tolak tiap tool dari kartu izin, panggil anggota tim pakai `@Nama`, dan lanjutin sesi Claude Code lokal yang tersimpan.
- **Sesi 2B**: ketik `@2B` di chat kantor buat ngobrol atau curhat sama 2B lewat API Groq pakai key lo sendiri. Nggak lewat Claude Code, jadi nggak motong kuota Claude. Pesan yang isinya nama pose (angkat tangan, merenung, melet, dan lain-lain) langsung dijalanin 2B di desktop tanpa Groq.

## Mulai cepat

Butuh Windows 10/11, [Node.js](https://nodejs.org) 22+, [Git](https://git-scm.com), dan Claude Code yang jalan di PC yang sama. Semua command dijalanin di PowerShell. Aplikasinya ada di folder `companion/`, bukan di root.

```powershell
git clone https://github.com/AliveNata/waifu.git
cd waifu
cd companion
npm ci
npm run fetch-base-model
npm run team:install
npm run hooks:install
npm start
```

- `fetch-base-model` ngambil model cadangan, dipakai selama anggota tim belum punya `.vrm` sendiri.
- `team:install` masang tujuh subagent dan blok 2B ke `%USERPROFILE%\.claude`.
- `hooks:install` nyambungin Claude Code ke companion. Tanpa ini companion tetap nyala, tapi nggak pernah bereaksi.
- Dua installer itu bikin backup dulu dan punya `--dry-run` buat lihat perubahannya tanpa nulis.
- Sesi 2B opsional dan butuh API key [Groq](https://console.groq.com). Key-nya diminta pas pertama kali lo ketik `@2B` di chat kantor, terus disimpan terenkripsi di komputer lo. Bisa juga lewat variabel `GROQ_API_KEY`.

Restart Claude Code setelah install. Model karakter: bikin folder `models/` di root repo (nggak ada di clone baru karena di-gitignore), lalu simpan file dengan nama anggota: `2b.vrm`, `chizuru.vrm`, `rias.vrm`, `asuna.vrm`, `kobayashi.vrm`, `yor.vrm`, `erza.vrm`, `ruby.vrm`. Companion makai file itu otomatis. Nama lain, misalnya `2B-final.vrm`, nggak kebaca dan harus dipilih lewat **Menu > Pilih model .vrm**.

Detail dan troubleshooting: [docs/03-companion.md](docs/03-companion.md) dan [docs/04-tim.md](docs/04-tim.md).

## Progres

| Fase | Isi | Status |
|---|---|---|
| 1 | Base model di VRoid Studio | Guide: [docs/01-vroid-xenovia.md](docs/01-vroid-xenovia.md), contohnya masih Xenovia |
| 2 | Texturing | Guide: [docs/02-texturing.md](docs/02-texturing.md) |
| 3 | Desktop companion (overlay, overlay tim, kantor AlyxLabs) | Jalan. Setup: [docs/03-companion.md](docs/03-companion.md) |
| 4 | Tim agent (2B + 7) | Jalan. Setup: [docs/04-tim.md](docs/04-tim.md) |
| 5 | Model jadi dari VRoid Hub/BOOTH + cek lisensi | Model tiap anggota udah dipilih. Daftar, link, dan syaratnya: [docs/05-cari-model.md](docs/05-cari-model.md) |
| 6 | Pipeline VRChat (script Blender + Unity SDK) | Belum dikerjain. Cek dulu izin modifikasi model yang mau dibawa pakai `npm run inspect-vrm` |

## Struktur

```
companion/          Electron app: overlay, kantor, server hook, bridge hook
  src/shared/       Tipe event hook, roster tim, mapping event ke mood
  src/server/       Server HTTP lokal yang nerima hook
  src/bridge/       Script yang dipanggil Claude Code tiap event, plus installer hooks
  src/main/         Electron main process dan preload
  src/main/chat/    Chat kantor ke Claude Code (claude -p), kartu izin, dan sesi Claude Code lokal
  src/main/twob/    Sesi 2B: klien Groq, penyimpanan key terenkripsi, dan persona 2B
  src/renderer/     Halaman overlay 2B (sentuhan dan pose), overlay tim, dan kantor (three.js + three-vrm)
  src/team/         Installer tim agent ke %USERPROFILE%\.claude
  src/tools/        inspect-vrm (cek lisensi .vrm), fetch-base-model, dan pencari model per anggota di models/
  test/, e2e/       Unit test (vitest) dan e2e (Playwright)
team/               Definisi subagent dan blok 2B buat CLAUDE.md
docs/               Guide per fase
models/             File .vrm per anggota (2b.vrm, ruby.vrm, ...), CREDITS.md, dan base/ buat model cadangan. Di-gitignore
```
