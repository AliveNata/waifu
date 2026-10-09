# 05. Cari model VRM jadi dan cek lisensinya

Buat Xenovia dan anggota tim lain, lo bisa pakai model jadi daripada bikin dari nol di VRoid. Selama modelnya belum ada, kantor virtual nampilin chibi placeholder dengan warna dan model rambut tiap karakter.

## Tempat nyari

| Tempat | Isi | Catatan |
|---|---|---|
| [VRoid Hub](https://hub.vroid.com) | Model VRM gratis dari creator | Cuma bisa di-download kalau creator-nya ngaktifin. Syarat pemakaian ada di halaman tiap model |
| [BOOTH](https://booth.pm) | Model VRM, preset rambut, outfit VRoid, gratis dan berbayar | Baca deskripsi dan syarat pemakaian di halaman produknya |

Tips nyari:
- Pakai nama karakter dalam huruf Jepang juga, misalnya ゼノヴィア buat Xenovia. Banyak creator nulis judulnya pakai bahasa Jepang.
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
- **VRChat**: convert ke VRChat ngedit model di Blender, dan itu dihitung modifikasi. Hasilnya nggak pernah "BOLEH" polos, karena izin upload ke platform lain biasanya ditulis di halaman toko, bukan di file. Selalu cek halaman modelnya.

Dua hal yang tetap berlaku apa pun hasil script-nya:
- Syarat di halaman VRoid Hub atau BOOTH yang dipakai, bukan metadata file.
- Creator fan model nggak bisa ngasih hak atas karakternya. Pakai buat pribadi, jangan dijual, jangan di-upload public.

## Pasang model ke companion

1. Simpan `.vrm` di folder `models/` di root repo. Folder itu udah di-gitignore.
2. Di companion, buka **Menu > Pilih model .vrm**, lalu pilih anggota tim yang mau dipasangin model.
3. Overlay pakai model Xenovia. Kantor pakai model semua anggota, dan yang belum punya tetap tampil sebagai placeholder.

Kalau model gagal dimuat, kantor nampilin pesan di chip status dan anggota itu balik ke placeholder.
