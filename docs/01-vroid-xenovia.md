# 01. Bikin base model Xenovia di VRoid Studio

Target fase ini: satu file `.vrm` Xenovia pakai seragam Kuoh Academy. File ini dipakai companion desktop dan nanti jadi bahan avatar VRChat.

VRoid dipilih karena rig humanoid, ekspresi wajah (blink, happy, surprised, dll), dan bone rambut langsung jadi otomatis. Buat yang belum pernah 3D, ini jalur paling realistis.

> Nama menu di bawah ditulis sesuai VRoid Studio versi 2.x. Kalau versi lo beda, label persisnya bisa sedikit lain, tapi letak tab-nya sama.

## Persiapan

1. Install VRoid Studio (gratis) dari [vroid.com/en/studio](https://vroid.com/en/studio) atau Steam.
2. Siapin 2 sampai 3 screenshot Xenovia pakai seragam dari anime: tampak depan, samping, dan close-up wajah. Simpan di luar repo.
3. Pakai screenshot itu buat ambil warna pakai eyedropper. Jangan ngandelin hex dari internet.

## Ciri Xenovia: mana yang aman, mana yang harus lo cek

Gua udah riset, dan sumber yang ada (fan wiki dan tag fan-made) nggak semuanya konsisten. Jadi dibagi dua:

| Bagian | Status | Catatan |
|---|---|---|
| Rambut biru, pendek sebatas leher | Konsisten di beberapa sumber | |
| Streak hijau di poni | Konsisten | Satu fan profile bilang di sisi kanan. Cocokin ke screenshot |
| Warna mata | **Cek sendiri** | Ada sumber bilang kuning, ada yang bilang coklat |
| Kemeja putih lengan panjang, pita leher | Dari tag fan-made | Cocokin bentuk pitanya |
| Capelet hitam di bahu | Dari tag fan-made | Cek ada atau nggak di screenshot lo |
| Warna rok | **Cek sendiri** | Sumber beda-beda: merah, pink, hitam |
| Kaos kaki hitam selutut | **Cek sendiri** | Fan wiki nyebut ini buat Akeno, belum tentu sama di Xenovia |

## Langkah

### 1. Model baru
- **Create New** lalu pilih base perempuan.
- Langsung **Save** sebagai `xenovia.vroid`. Save rutin tiap selesai satu tab, VRoid kadang crash.

### 2. Face
- **Eyes**: bentuk mata agak tajam dan tegas, sesuai karakter Xenovia yang serius.
- Warna iris: ganti di bagian iris sesuai hasil cek screenshot.
- Jangan utak-atik preset ekspresi bawaan. Companion pakai ekspresi `blink`, `happy`, `relaxed`, dan `surprised` yang udah otomatis ada di export VRoid.

### 3. Hairstyle
- Mulai dari preset rambut pendek (bob) yang paling mirip, lalu rapihin panjangnya sampai sebatas leher.
- Set warna rambut utama biru sesuai screenshot.
- Buat **hair group terpisah** buat streak hijau: bikin group baru di Hair Editor, gambar beberapa helai di poni sisi yang bener, lalu kasih warna hijau. Group terpisah bikin warnanya gampang diganti tanpa ganggu rambut utama.
- Biarin setting physics rambut default dulu. Bone rambut ini yang bikin rambut goyang di companion.

### 4. Body
- Tinggi sedikit di atas default. Xenovia pendekar, jadi postur tegap lebih cocok daripada proporsi mungil.
- Hindari slider ekstrem. Proporsi yang terlalu jauh dari default bikin pose prosedural companion (duduk, ngetik, melambai) keliatan aneh.

### 5. Outfit (seragam Kuoh)
- **Tops**: kemeja atau blouse lengan panjang putih.
- **Bottoms**: rok lipit, warna sesuai hasil cek.
- **Socks**: kaos kaki selutut hitam.
- **Shoes**: loafer.
- **Pita leher dan capelet**: kalau nggak ada item yang pas, cat di texture kemeja (lihat [02-texturing.md](02-texturing.md)) atau tunda dulu. Bisa ditambah belakangan di Blender.

### 6. Export ke VRM
- Buka menu export (ikon kamera atau **Export as VRM**).
- Versi: **VRM 1.0** (default VRoid sekarang). Companion support 1.0 dan 0.0.
- Metadata: isi title `Xenovia`, author nama lo. Set izin pemakaian ke personal use dan larang redistribusi, karena ini fan art karakter berhak cipta.
- **Reduce polygons**: matiin dulu. Optimasi buat VRChat dikerjain di fase Blender.
- Kasih nama file yang jelas versinya, misalnya `xenovia-vrm1.vrm`.

## Simpan di mana

Taruh `.vrm` dan `.vroid` di folder `models/` di root repo, atau di luar repo. Folder itu udah di-gitignore, jadi model nggak ke-push ke GitHub.

## Cek hasil

Buka companion (lihat [03-companion.md](03-companion.md)), lalu **Menu > Pilih model .vrm**. Hal yang perlu diperhatiin:

- Wajah keliatan di close-up overlay, nggak kepotong.
- Kedip jalan, dan ekspresi berubah pas lo kirim prompt ke Claude Code.
- Di kantor, rambut nggak tembus badan waktu jalan atau duduk.

Kalau ada yang aneh, catat apa yang lo liat dan kasih tau gua. Proporsi chibi dan sudut pose bisa diatur di kode.
