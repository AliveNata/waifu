# 04. Tim agent 2B

2B jadi PA dan PM di session utama Claude Code. Dia dibantu tujuh subagent, masing-masing punya karakter dan meja sendiri di kantor virtual.

| Agent | Karakter | Anime | Tugas | Boleh ngedit? |
|---|---|---|---|---|
| (session utama) | 2B | NieR:Automata (game) | PA + PM: triage, plan, delegasi, brief | Ya |
| `brainstormer` | Chizuru | Rent-a-Girlfriend | Ide dan alternatif sebelum ada keputusan | Tidak |
| `architect` | Rias | High School DxD | Bandingin opsi teknis, kritik plan | Tidak |
| `data-engineer` | Asuna | Sword Art Online | dbt, Airflow, SQL, Spark, Kafka | Ya |
| `fullstack-engineer` | Kobayashi | Miss Kobayashi's Dragon Maid | UI, API, tools internal | Ya |
| `platform-sre` | Yor | Spy x Family | Kubernetes, Helm, Linode + GCP, CI/CD, insiden | Ya, tapi nggak boleh ngubah cluster |
| `reviewer` | Erza | Fairy Tail | Review, test, security sebelum commit atau deploy | Tidak |
| `content-creator` | MEM-cho | Oshi no Ko | Draft LinkedIn, Notion, GitHub dari kerjaan lo yang udah selesai, plus coaching portfolio | Cuma nulis draft di `portfolio/drafts/` |

Definisinya ada di `team/agents/*.md`, dan aturan delegasi 2B ada di `team/2b.md`.

## Alur kerja yang dirancang

Fitur baru biasanya jalan begini: **Chizuru** ngelempar ide (opsional), lalu **Rias** bandingin opsi, lalu engineer sesuai area ngerjain, lalu **Erza** review, lalu **MEM-cho** bikin draft portfolio-nya (opsional). 2B yang ngatur urutannya dan minta approval lo di titik-titik penting.

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

Restart Claude Code setelah install. Cek pakai command `/agents`, harusnya ketujuh agent muncul.

## Cara pakai

Cukup ngobrol biasa ke Claude Code. 2B yang mutusin kapan perlu delegasi. Kalau mau manggil anggota tertentu, sebut namanya, misalnya "minta reviewer cek diff ini", atau pakai `@reviewer`.

Kalau companion lagi jalan dan hooks udah kepasang (lihat [03-companion.md](03-companion.md)), anggota yang dipanggil bakal mulai kerja di mejanya di kantor virtual.

## Draft portfolio dari MEM-cho

Abis kerjaan penting selesai dan lolos review, 2B bakal nawarin sekali buat bikin draft portfolio. Bisa juga lo minta langsung, misalnya "minta content-creator bikin post LinkedIn dari migrasi Airflow kemarin".

- Draft ditulis ke `portfolio/drafts/` di root project yang lagi lo kerjain, satu file per channel (LinkedIn, Notion, GitHub).
- MEM-cho cuma pakai fakta dari kode, git log, dan brief. Angka yang dia nggak punya ditulis sebagai placeholder `[angka asli: ...]`, jadi lo yang ngisi.
- Nggak ada yang di-posting otomatis. Copy-paste sendiri ke LinkedIn, Notion, atau GitHub.
- Tambahin `portfolio/drafts/` ke `.gitignore` project lo kalau draft-nya nggak mau ikut ke-commit. MEM-cho bakal ngingetin kalau belum.

## Ngubah atau nambah anggota

1. Edit atau tambah file di `team/agents/`. Field `name` di frontmatter harus sama dengan nama file.
2. Kalau anggotanya baru, tambahin juga ke `companion/src/shared/team.ts` (roster) dan ke layout kantor, biar dia dapet meja dan karakter.
3. Jalanin `npm run team:install` lagi.

## Uninstall

Hapus ketujuh file agent di `%USERPROFILE%\.claude\agents\`, lalu hapus blok di antara penanda `waifu-team` di `CLAUDE.md`.
