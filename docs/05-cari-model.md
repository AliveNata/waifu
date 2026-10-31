# 05. Cari model VRM jadi dan cek lisensinya

Buat 2B dan anggota tim lain, lo bisa pakai model jadi daripada bikin dari nol di VRoid. Selama modelnya belum ada, companion pakai model anime cadangan yang diwarnai sesuai tiap karakter (lihat [03-companion.md](03-companion.md#model-karakter)).

## Kandidat yang ketemu (Oktober 2026)

Dicari lewat mesin pencari, karena halaman BOOTH dan VRoid Hub nggak bisa dibuka dari environment tempat guide ini ditulis. Syarat dan ketersediaannya bisa berubah, jadi selalu cek halamannya langsung.

| Cast | Kandidat | Harga | Catatan dari hasil pencarian |
|---|---|---|---|
| 2B | [2B](https://hub.vroid.com/en/characters/9028367550145558339/models/5043829834690475225) | Gratis | Bob putih. Boleh jadi avatar, dimodifikasi, dibagikan ulang. Wajib kredit, nggak boleh komersial |
| Chizuru | [Mizuhara Chizuru](https://hub.vroid.com/en/characters/8332583862388126345/models/1972881642102544984) | Gratis | Boleh jadi avatar, dimodifikasi, dibagikan ulang. Nggak boleh komersial |
| Rias | [Rias Gremory](https://hub.vroid.com/en/characters/1177311427432217/models/1259843191784755922) | Gratis | Syaratnya longgar menurut hasil pencarian, cek ulang di halamannya |
| Rias | [VRoid Rias Gremory Outfit](https://booth.pm/en/items/2875224) | ¥500 | Cuma outfit buat VRoid, bukan model utuh |
| Asuna | [Yuuki Asuna (School uniform)](https://hub.vroid.com/en/characters/5852999539721442220/models/1410570872446877209) | Gratis | Boleh jadi avatar, wajib kredit |
| Asuna | [Asuna Yuuki](https://hub.vroid.com/en/characters/2424049014825747728/models/431547713285463029) | Gratis | Boleh jadi avatar, nggak boleh dimodifikasi (nggak bisa buat VRChat) |
| Kobayashi | [Kobayashi-san working clothes](https://hub.vroid.com/en/characters/36311182371133330/models/7406901078278076562) | Gratis | Boleh jadi avatar, dimodifikasi, dibagikan ulang. Wajib kredit |
| Yor | [Yor Forger](https://hub.vroid.com/en/characters/4239190736811894538/models/8098810625864014076) | Gratis | Boleh jadi avatar, dimodifikasi, dibagikan ulang. Wajib kredit |
| Ruby | [Ruby Hoshino Oshi no Ko Idol](https://hub.vroid.com/en/characters/7409098126196422180/models/6681199807464527208) | Gratis | Boleh jadi avatar, dimodifikasi, dibagikan ulang. Wajib kredit, konten seksual dilarang |
| Erza | [Erza Scarlet Japanese Cloth Armor](https://hub.vroid.com/en/characters/3527892052199245319/models/8906292335027557197) | Gratis | Izin download perlu dicek di halamannya |
| Arisu (PM) | [波覇ありす](https://hub.vroid.com/en/characters/8836663414327647205/models/4798016391042827897) oleh keiichiisozaki | Gratis | Dicek lewat API VRoid Hub: bisa di-download, boleh jadi avatar, dimodifikasi, dibagikan ulang. Tanpa kredit |
| Komachi (Tech Lead) | [小倉小町](https://hub.vroid.com/en/characters/1828519956768663511/models/6844487232620998932) oleh keiichiisozaki | Gratis | Dicek lewat API VRoid Hub: bisa di-download, boleh jadi avatar, dimodifikasi, dibagikan ulang. Tanpa kredit |
| Miruku (Security) | [八咫みるく](https://hub.vroid.com/en/characters/7477070059866436889/models/3790713535037537835) oleh keiichiisozaki | Gratis | Dicek lewat API VRoid Hub: bisa di-download, boleh jadi avatar, dimodifikasi, dibagikan ulang. Tanpa kredit |
| Huagua (UI/UX) | [花瓜](https://hub.vroid.com/en/characters/4889343230124514305/models/2222187312426601055) oleh asus.eric | Gratis | Dicek lewat API VRoid Hub: bisa di-download, boleh jadi avatar, dimodifikasi, dibagikan ulang. **Wajib kredit** ke asus.eric, konten seksual dilarang |

## Download dari VRoid Hub, langkah demi langkah

1. **Login.** Buka [hub.vroid.com](https://hub.vroid.com), klik login, dan masuk pakai akun pixiv. Kalau belum punya, daftar di sana, gratis.
2. **Buka link model** dari tabel di atas.
3. **Baca syarat pemakaian** di halaman model, bagian *Conditions of use*. Yang penting:
   - *Avatar use*: harus **Allow**, kalau nggak, model nggak boleh dipakai di companion.
   - *Alterations*: harus **Allow** kalau nanti mau di-convert ke VRChat.
   - *Attribution*: kalau **Required**, catat nama creator dan link modelnya (lihat langkah 7).
4. **Download.** Klik tombol download di halaman model, lalu setujui syaratnya. Kalau tombolnya nggak ada, berarti creator-nya nggak ngizinin download. Pakai kandidat lain atau biarin pakai model cadangan.
5. **Simpan** file `.vrm`-nya ke folder `models/` di root repo, dengan nama yang jelas, misalnya `models/2b.vrm` atau `models/ruby.vrm`. Folder ini udah di-gitignore, jadi model nggak ikut ke-commit.
6. **Cek lisensi di file-nya:**
   ```powershell
   cd companion
   npm run inspect-vrm -- ..\models\2b.vrm
   ```
   Kalau hasil script beda sama halaman VRoid Hub, ikutin halamannya.
7. **Catat kredit** buat model yang wajib kredit di `models/CREDITS.md`: nama karakter, nama creator, dan link model. Kredit ini perlu ditampilin kalau lo nunjukin avatarnya ke orang lain, misalnya di screenshot atau video.
8. **Pasang ke companion:** cukup restart companion. File di `models/` yang namanya sesuai anggota (`2b.vrm`, `chizuru.vrm`, `rias.vrm`, `asuna.vrm`, `kobayashi.vrm`, `yor.vrm`, `erza.vrm`, `ruby.vrm`, `arisu.vrm`, `komachi.vrm`, `miruku.vrm`, `huagua.vrm`) langsung kepakai. Kalau mau pakai file dengan nama atau lokasi lain, pilih lewat **Menu > Pilih model .vrm > nama anggota**, dan pilihan dari menu ini yang dipakai.

Urutan yang disaranin: 2B dulu, karena dia yang muncul di overlay utama. Abis itu Ruby dan anggota yang paling sering lo panggil.

## Tempat nyari

| Tempat | Isi | Catatan |
|---|---|---|
| [VRoid Hub](https://hub.vroid.com) | Model VRM gratis dari creator | Cuma bisa di-download kalau creator-nya ngaktifin. Syarat pemakaian ada di halaman tiap model |
| [BOOTH](https://booth.pm) | Model VRM, preset rambut, outfit VRoid, gratis dan berbayar | Baca deskripsi dan syarat pemakaian di halaman produknya |

Tips nyari:
- Pakai nama karakter dalam huruf Jepang juga, misalnya ヨルハ二号B型 buat 2B atau 星野ルビー buat Ruby. Banyak creator nulis judulnya pakai bahasa Jepang.
- Pilih yang formatnya `.vrm`. File `.vroid` cuma bisa dibuka di VRoid Studio, jadi harus di-export dulu.
- Model yang kepakai buat semua anggota tim sebaiknya gaya visualnya mirip, biar kantornya nggak keliatan campur aduk.

## Cek lisensi sebelum dipakai

Tiap file `.vrm` nyimpen lisensi yang diisi creator-nya. Cek pakai:

```powershell
cd companion
npm run inspect-vrm -- "C:\path\ke\model.vrm"
```

Contoh output dari sample model resmi VRM:

```
Model       : VRM1_Constraint_Twist_Sample
Creator     : pixiv Inc.
Format      : VRM 1.0
Dipakai oleh: semua orang
Komersial   : boleh juga dipakai perusahaan
Modifikasi  : boleh dimodifikasi dan hasil modifikasinya boleh dibagikan
Redistribusi: boleh
Kredit      : tidak wajib
URL lisensi : https://vrm.dev/licenses/1.0/

Companion (pribadi)      : BOLEH
Convert + upload VRChat  : CEK DULU
```

Cara baca kesimpulannya:
- **Companion**: companion cuma ngubah ukuran bone pas jalan (buat chibi), file aslinya nggak diubah. Jadi yang penting model boleh dipakai sebagai avatar oleh orang lain.
- **VRChat**: convert ke VRChat ngedit model di Blender, dan itu dihitung modifikasi. Hasilnya cuma "BOLEH" kalau syaratnya kebaca dari URL lisensi VRoid Hub (baris `Sumber` muncul) dan modifikasinya diizinin, karena URL itu isinya sama dengan syarat di halaman modelnya. Model dari BOOTH atau tempat lain tetap "CEK DULU", karena izin upload ke platform lain biasanya ditulis di halaman toko, bukan di file.

Dua hal yang tetap berlaku apa pun hasil script-nya:
- Syarat di halaman VRoid Hub atau BOOTH yang dipakai, bukan metadata file.
- Creator fan model nggak bisa ngasih hak atas karakternya. Pakai buat pribadi, jangan dijual, jangan di-upload public.

## Pasang model ke companion

1. Simpan `.vrm` di folder `models/` di root repo dengan nama anggota, misalnya `models/2b.vrm`. Folder itu udah di-gitignore. Companion otomatis makai file itu pas dibuka.
2. Kalau file-nya di tempat lain, buka **Menu > Pilih model .vrm**, lalu pilih anggota tim yang mau dipasangin model. Pilihan dari menu menang atas file di `models/`.
3. Overlay pakai model 2B. Kantor pakai model semua anggota, dan yang belum punya tetap tampil sebagai placeholder.

Kalau model gagal dimuat, kantor nampilin pesan di chip status dan anggota itu balik ke placeholder.
