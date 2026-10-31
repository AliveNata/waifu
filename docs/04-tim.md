# 04. Tim agent 2B

2B jadi PA di session utama Claude Code: ngobrol sama lo, ngurus brief harian, kalender, dan catatan, terus ngejalanin rencana kerja dari Arisu. Dia dibantu sepuluh subagent, masing-masing punya karakter dan meja sendiri di kantor virtual.

| Agent | Karakter | Anime | Tugas | Boleh ngedit? |
|---|---|---|---|---|
| (session utama) | 2B | NieR:Automata (game) | PA: triage, brief harian, ngejalanin rencana Arisu, minta konfirmasi lo | Ya |
| `arisu` | Arisu | Karakter original (keiichiisozaki) | PM: spec, acceptance criteria, breakdown task dengan pemiliknya, status, postmortem | Cuma nulis rencana di `plans/` |
| `chizuru` | Chizuru | Rent-a-Girlfriend | Ide dan alternatif sebelum ada keputusan | Tidak |
| `rias` | Rias | High School DxD | Architect: keputusan teknis besar (tool atau layanan baru, model data, migrasi) | Tidak |
| `komachi` | Komachi | Karakter original (keiichiisozaki) | Tech Lead: langkah teknis per engineer, kontrak integrasi, standar, sign-off teknis | Tidak |
| `huagua` | Huagua | Model VRoid (asus.eric) | UI/UX Designer: user flow, layout, arah desain, aksesibilitas, review desain | Cuma nulis `DESIGN.md` |
| `asuna` | Asuna | Sword Art Online | dbt, Airflow, SQL, Spark, Kafka | Ya |
| `kobayashi` | Kobayashi | Miss Kobayashi's Dragon Maid | UI, API, tools internal | Ya |
| `yor` | Yor | Spy x Family | Kubernetes, Helm, Linode + GCP, CI/CD, insiden | Ya, tapi nggak boleh ngubah cluster |
| `miruku` | Miruku | Karakter original (keiichiisozaki) | Security: secret, auth, input, dependency, RBAC, IAM, hardening | Tidak |
| `erza` | Erza | Fairy Tail | Review kode dan QA terhadap acceptance criteria dari Arisu | Tidak |
| `ruby` | Ruby | Oshi no Ko | Draft LinkedIn, Notion, GitHub dari kerjaan lo yang udah selesai, plus coaching portfolio | Cuma nulis draft di `portfolio/drafts/` |

Definisinya ada di `team/agents/*.md`, dan aturan delegasi 2B ada di `team/2b.md`. Nama agent sengaja disamain dengan nama karakternya, biar manggilnya kayak manggil orang. Dulu namanya nama role (`reviewer`, `architect`, dst). Hooks companion masih ngenalin nama lama itu, dan `npm run team:install` nyimpen file agent lama sebagai backup (`reviewer.md.bak-...`) biar nggak muncul dobel.

## Alur kerja yang dirancang

Subagent nggak bisa manggil subagent lain, jadi 2B yang bawa rencana dari satu anggota ke anggota berikutnya. Langkah yang nggak dibutuhin dilewatin, dan anggota di langkah yang sama bisa jalan paralel.

| Jenis kerjaan | Urutan |
|---|---|
| Fitur aplikasi | Arisu (rencana), Chizuru (opsional), Rias (kalau ada keputusan besar), Komachi (langkah dan kontrak), Huagua (kalau ada UI), Kobayashi, lalu Erza dan Miruku, lalu Komachi (sign-off), lalu lo konfirmasi push atau deploy dan Yor yang nyiapin, lalu Ruby (opsional) |
| Pipeline data | Arisu, Rias (tool atau model data baru), Komachi, Asuna, lalu Erza dan Miruku (Miruku wajib kalau ada credential atau data pribadi), lalu lo konfirmasi dan Yor nyiapin deploy, lalu Ruby (opsional) |
| Perubahan infra | Arisu, Rias (milih tool atau layanan), Komachi, Yor (manifest dan dry-run), lalu Miruku dan Erza, lalu lo konfirmasi dan jalanin sendiri |
| Insiden | Yor (triage), lalu Asuna atau Kobayashi (fix di area masing-masing), lalu Erza (plus Miruku kalau soal kebocoran atau akses), lalu lo konfirmasi, lalu Arisu (postmortem dan follow-up) |
| Urusan pribadi | Cukup 2B |

Task kecil yang jelas dikerjain 2B langsung tanpa lewat Arisu, biar nggak boros token.

## Skill per anggota

Anggota yang punya tool `Skill` bisa manggil skill yang ke-install di Claude Code lo. Kalau skill-nya belum ada, anggotanya tetap jalan tanpa skill itu.

| Anggota | Skill |
|---|---|
| 2B | `morning` (brief harian) |
| Arisu | `docs` |
| Komachi | `code-review` |
| Huagua | `design-direction`, `antislop`, `antislop-ui`, `antislop-human`, `antislop-layoutmobile`, `ui-ux-pro-max`, `design-system`, `ui-styling`, `dataviz` |
| Kobayashi | antislop, `frontend-orchestrator`, `backend-orchestrator`, `ui-styling`, `dataviz`, `run` |
| Asuna | `etl-discord-alerting`, `dataviz` |
| Yor | `vps-hardening`, `etl-discord-alerting` |
| Miruku | `security-gate`, `vps-hardening`, `security-review` |
| Erza | `code-review`, `qa-check` |
| Ruby | `antislop`, `antislop-copywriting`, `document-design`, `pptx` |

Subagent nggak bisa nanya langsung ke lo di tengah kerja. Jadi aksi berisiko, misalnya `kubectl apply`, ngubah data prod, atau push, dibalikin ke 2B dalam bentuk usulan lengkap dengan diff atau hasil dry-run. 2B yang minta konfirmasi lo.

## Install di PC lo

Di folder `companion`:

```powershell
npm run team:install -- --dry-run
```

Perintah ini cuma nampilin apa yang bakal berubah, belum nulis apa-apa. Kalau udah oke:

```powershell
npm run team:install
```

Yang dilakuin installer:
- Nyalin 10 file agent ke `%USERPROFILE%\.claude\agents\`.
- Nambahin blok 2B ke `%USERPROFILE%\.claude\CLAUDE.md`, di antara penanda `<!-- waifu-team:start -->` dan `<!-- waifu-team:end -->`. Isi file di luar penanda itu nggak disentuh.
- File yang udah ada dengan isi berbeda di-backup dulu jadi `<nama>.bak-<waktu>`.
- Aman dijalanin ulang. Kalau nggak ada yang berubah, nggak ada yang ditulis.

Kalau lo pakai `CLAUDE_CONFIG_DIR`, installer ikut pakai folder itu.

Restart Claude Code setelah install. Command `/agents` udah dihapus dari Claude Code versi baru, jadi ceknya pakai salah satu cara ini:
- Jalanin lagi `npm run team:install -- --dry-run`. Kalau kesepuluh agent dan `CLAUDE.md` statusnya `unchanged`, berarti udah kepasang.
- Atau tanya langsung ke Claude Code: "subagent apa aja yang tersedia?".

## Cara pakai

Cukup ngobrol biasa ke Claude Code. 2B yang mutusin kapan perlu delegasi. Kalau mau manggil anggota tertentu, mention namanya:

- **Di chat kantor:** ketik `@`, terus muncul daftar tim lengkap dengan role-nya. Saring pakai nama atau role (`@er` atau `@rev` nemu Erza, `@data` nemu Asuna, `@pm` nemu Arisu, `@sec` nemu Miruku), pilih pakai panah lalu Enter atau Tab, atau klik. Contoh: `@Erza tolong cek diff ini`. Bisa manggil beberapa sekaligus: `@Rias sama @Erza cek plan ini`.
- **Di terminal:** ketik `@` lalu pilih `erza (agent)` dari daftar Claude Code. Ngetik `@Erza ...` biasa juga jalan, soalnya 2B sudah dikasih tahu bahwa `@Nama` artinya delegasi ke anggota itu.

Kalau companion lagi jalan dan hooks udah kepasang (lihat [03-companion.md](03-companion.md)), anggota yang dipanggil bakal mulai kerja di mejanya di kantor virtual.

## Draft portfolio dari Ruby

Abis kerjaan penting selesai dan lolos review, 2B bakal nawarin sekali buat bikin draft portfolio. Bisa juga lo minta langsung, misalnya "@Ruby bikin post LinkedIn dari migrasi Airflow kemarin".

- Draft ditulis ke `portfolio/drafts/` di root project yang lagi lo kerjain, satu file per channel (LinkedIn, Notion, GitHub).
- Ruby cuma pakai fakta dari kode, git log, dan brief. Angka yang dia nggak punya ditulis sebagai placeholder `[angka asli: ...]`, jadi lo yang ngisi.
- Nggak ada yang di-posting otomatis. Copy-paste sendiri ke LinkedIn, Notion, atau GitHub.
- Tambahin `portfolio/drafts/` ke `.gitignore` project lo kalau draft-nya nggak mau ikut ke-commit. Ruby bakal ngingetin kalau belum.

## Ngubah atau nambah anggota

1. Edit atau tambah file di `team/agents/`. Field `name` di frontmatter harus sama dengan nama file.
2. Kalau anggotanya baru, tambahin juga ke `companion/src/shared/team.ts` (roster) dan ke layout kantor, biar dia dapet meja dan karakter.
3. Jalanin `npm run team:install` lagi.

## Uninstall

Hapus kesepuluh file agent di `%USERPROFILE%\.claude\agents\`, lalu hapus blok di antara penanda `waifu-team` di `CLAUDE.md`.
