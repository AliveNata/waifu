# 04. Tim agent 2B

2B jadi PA dan PM di session utama Claude Code. Dia dibantu tujuh subagent, masing-masing punya karakter dan meja sendiri di kantor virtual.

| Agent | Karakter | Anime | Tugas | Boleh ngedit? |
|---|---|---|---|---|
| (session utama) | 2B | NieR:Automata (game) | PA + PM: triage, plan, delegasi, brief | Ya |
| `chizuru` | Chizuru | Rent-a-Girlfriend | Ide dan alternatif sebelum ada keputusan | Tidak |
| `rias` | Rias | High School DxD | Bandingin opsi teknis, kritik plan | Tidak |
| `asuna` | Asuna | Sword Art Online | dbt, Airflow, SQL, Spark, Kafka | Ya |
| `kobayashi` | Kobayashi | Miss Kobayashi's Dragon Maid | UI, API, tools internal | Ya |
| `yor` | Yor | Spy x Family | Kubernetes, Helm, Linode + GCP, CI/CD, insiden | Ya, tapi nggak boleh ngubah cluster |
| `erza` | Erza | Fairy Tail | Review, test, security sebelum commit atau deploy | Tidak |
| `ruby` | Ruby | Oshi no Ko | Draft LinkedIn, Notion, GitHub dari kerjaan lo yang udah selesai, plus coaching portfolio | Cuma nulis draft di `portfolio/drafts/` |

Definisinya ada di `team/agents/*.md`, dan aturan delegasi 2B ada di `team/2b.md`. Nama agent sengaja disamain dengan nama karakternya, biar manggilnya kayak manggil orang. Dulu namanya nama role (`reviewer`, `architect`, dst). Hooks companion masih ngenalin nama lama itu, dan `npm run team:install` nyimpen file agent lama sebagai backup (`reviewer.md.bak-...`) biar nggak muncul dobel.

## Alur kerja yang dirancang

Fitur baru biasanya jalan begini: **Chizuru** ngelempar ide (opsional), lalu **Rias** bandingin opsi, lalu engineer sesuai area ngerjain, lalu **Erza** review, lalu **Ruby** bikin draft portfolio-nya (opsional). 2B yang ngatur urutannya dan minta approval lo di titik-titik penting.

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
- Nyalin 7 file agent ke `%USERPROFILE%\.claude\agents\`.
- Nambahin blok 2B ke `%USERPROFILE%\.claude\CLAUDE.md`, di antara penanda `<!-- waifu-team:start -->` dan `<!-- waifu-team:end -->`. Isi file di luar penanda itu nggak disentuh.
- File yang udah ada dengan isi berbeda di-backup dulu jadi `<nama>.bak-<waktu>`.
- Aman dijalanin ulang. Kalau nggak ada yang berubah, nggak ada yang ditulis.

Kalau lo pakai `CLAUDE_CONFIG_DIR`, installer ikut pakai folder itu.

Restart Claude Code setelah install. Command `/agents` udah dihapus dari Claude Code versi baru, jadi ceknya pakai salah satu cara ini:
- Jalanin lagi `npm run team:install -- --dry-run`. Kalau ketujuh agent dan `CLAUDE.md` statusnya `unchanged`, berarti udah kepasang.
- Atau tanya langsung ke Claude Code: "subagent apa aja yang tersedia?".

## Cara pakai

Cukup ngobrol biasa ke Claude Code. 2B yang mutusin kapan perlu delegasi. Kalau mau manggil anggota tertentu, mention namanya:

- **Di chat kantor:** ketik `@`, terus muncul daftar tim lengkap dengan role-nya. Saring pakai nama atau role (`@er` atau `@rev` nemu Erza, `@data` nemu Asuna), pilih pakai panah lalu Enter atau Tab, atau klik. Contoh: `@Erza tolong cek diff ini`. Bisa manggil beberapa sekaligus: `@Rias sama @Erza cek plan ini`.
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

Hapus ketujuh file agent di `%USERPROFILE%\.claude\agents\`, lalu hapus blok di antara penanda `waifu-team` di `CLAUDE.md`.
