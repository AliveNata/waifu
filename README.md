# waifu

Xenovia (High School DxD, seragam Kuoh Academy) dan timnya sebagai avatar 3D. Isinya:

1. **Desktop companion** di Windows: close-up Xenovia di kanan bawah, overlay tim yang ngobrol di kanan atas, dan kantor isometrik berisi tim chibi. Semuanya bereaksi ke hooks Claude Code.
2. **Tim agent Claude Code**: Xenovia sebagai PA + PM, dibantu enam subagent dengan karakter masing-masing.
3. **Avatar VRChat**, upload private.

Ini fan project buat pemakaian pribadi. Semua karakter milik pemegang hak cipta masing-masing, jadi model dan avatar jangan dijual, didistribusikan, atau di-upload public.

## Progres

| Fase | Isi | Status |
|---|---|---|
| 1 | Base model di VRoid Studio | Guide: [docs/01-vroid-xenovia.md](docs/01-vroid-xenovia.md) |
| 2 | Texturing | Guide: [docs/02-texturing.md](docs/02-texturing.md) |
| 3 | Desktop companion (overlay, overlay tim, kantor chibi) | Jalan. Setup: [docs/03-companion.md](docs/03-companion.md) |
| 4 | Tim agent (Xenovia + 6) | Jalan. Setup: [docs/04-tim.md](docs/04-tim.md) |
| 5 | Model jadi dari VRoid Hub/BOOTH + cek lisensi | Guide dan kandidat: [docs/05-cari-model.md](docs/05-cari-model.md) |
| 6 | Pipeline VRChat (script Blender + Unity SDK) | Belum, nunggu `.vrm` Xenovia |

## Struktur

```
companion/          Electron app: overlay, kantor, server hook, bridge hook
  src/shared/       Tipe event hook, roster tim, mapping event ke mood
  src/server/       Server HTTP lokal yang nerima hook
  src/bridge/       Script yang dipanggil Claude Code tiap event
  src/main/         Electron main process dan preload
  src/renderer/     Halaman overlay, overlay tim, dan kantor (three.js + three-vrm)
  src/team/         Installer tim agent ke ~/.claude
  src/tools/        inspect-vrm (cek lisensi .vrm) dan fetch-base-model
  test/, e2e/       Unit test (vitest) dan e2e (Playwright)
team/               Definisi subagent dan blok Xenovia buat CLAUDE.md
docs/               Guide per fase
models/             Tempat file .vrm dan .vroid lo, plus base/ buat model cadangan. Di-gitignore
```
