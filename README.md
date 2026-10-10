# waifu

2B (NieR:Automata) dan timnya sebagai avatar 3D. Isinya:

1. **Desktop companion** di Windows: close-up 2B di kanan bawah, overlay tim yang ngobrol di kanan atas, dan kantor isometrik berisi tim chibi. Semuanya bereaksi ke hooks Claude Code.
2. **Tim agent Claude Code**: 2B sebagai PA + PM, dibantu tujuh subagent dengan karakter masing-masing.
3. **Avatar VRChat** buat upload private. Ini masih rencana, lihat fase 6.

Ini fan project buat pemakaian pribadi. Semua karakter milik pemegang hak cipta masing-masing, jadi model dan avatar jangan dijual, didistribusikan, atau di-upload public. Sebagian model wajib kredit ke creator-nya: catat di `models/CREDITS.md` dan cantumin tiap kali avatarnya ditampilin ke orang lain. Syarat tiap model ada di [docs/05-cari-model.md](docs/05-cari-model.md).

## Mulai cepat

Butuh Windows 10/11, [Node.js](https://nodejs.org) 22+, [Git](https://git-scm.com), dan Claude Code yang jalan di PC yang sama. Semua command dijalanin di PowerShell. Aplikasinya ada di folder `companion/`, bukan di root.

```powershell
git clone https://github.com/AliveNata/waifu.git
cd waifu
git checkout claude/3d-waifu-modeling-rigging-pkwpy7
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

Restart Claude Code setelah install. Model karakter: bikin folder `models/` di root repo (nggak ada di clone baru karena di-gitignore), lalu simpan file dengan nama anggota: `2b.vrm`, `chizuru.vrm`, `rias.vrm`, `asuna.vrm`, `kobayashi.vrm`, `yor.vrm`, `erza.vrm`, `ruby.vrm`. Companion makai file itu otomatis. Nama lain, misalnya `2B-final.vrm`, nggak kebaca dan harus dipilih lewat **Menu > Pilih model .vrm**.

Detail dan troubleshooting: [docs/03-companion.md](docs/03-companion.md) dan [docs/04-tim.md](docs/04-tim.md).

## Progres

| Fase | Isi | Status |
|---|---|---|
| 1 | Base model di VRoid Studio | Guide: [docs/01-vroid-xenovia.md](docs/01-vroid-xenovia.md), contohnya masih Xenovia |
| 2 | Texturing | Guide: [docs/02-texturing.md](docs/02-texturing.md) |
| 3 | Desktop companion (overlay, overlay tim, kantor chibi) | Jalan. Setup: [docs/03-companion.md](docs/03-companion.md) |
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
  src/renderer/     Halaman overlay, overlay tim, dan kantor (three.js + three-vrm)
  src/team/         Installer tim agent ke %USERPROFILE%\.claude
  src/tools/        inspect-vrm (cek lisensi .vrm), fetch-base-model, dan pencari model per anggota di models/
  test/, e2e/       Unit test (vitest) dan e2e (Playwright)
team/               Definisi subagent dan blok 2B buat CLAUDE.md
docs/               Guide per fase
models/             File .vrm per anggota (2b.vrm, ruby.vrm, ...), CREDITS.md, dan base/ buat model cadangan. Di-gitignore
```
