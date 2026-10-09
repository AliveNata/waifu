# waifu

Xenovia (High School DxD, seragam Kuoh Academy) sebagai avatar 3D. Dipakai di dua tempat:

1. **Desktop companion** di Windows: close-up transparan di pojok layar plus kantor isometrik versi chibi. Dua-duanya bereaksi ke hooks Claude Code.
2. **Avatar VRChat**, upload private.

Ini fan project buat pemakaian pribadi. Xenovia milik pemegang hak ciptanya, jadi model dan avatar jangan dijual, didistribusikan, atau di-upload public.

## Progres

| Fase | Isi | Status |
|---|---|---|
| 1 | Base model di VRoid Studio | Guide: [docs/01-vroid-xenovia.md](docs/01-vroid-xenovia.md) |
| 2 | Texturing | Guide: [docs/02-texturing.md](docs/02-texturing.md) |
| 3 | Desktop companion (overlay + kantor chibi) | Jalan. Setup: [docs/03-companion.md](docs/03-companion.md) |
| 4 | Pipeline VRChat (script Blender + Unity SDK) | Belum |

## Struktur

```
companion/          Electron app: overlay, kantor, server hook, bridge hook
  src/shared/       Tipe event hook dan mapping event ke mood
  src/server/       Server HTTP lokal yang nerima hook
  src/bridge/       Script yang dipanggil Claude Code tiap event
  src/main/         Electron main process dan preload
  src/renderer/     Halaman overlay dan kantor (three.js + three-vrm)
  test/, e2e/       Unit test (vitest) dan e2e (Playwright)
docs/               Guide per fase
models/             Tempat file .vrm dan .vroid lo. Di-gitignore
```
