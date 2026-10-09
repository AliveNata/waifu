# 02. Texturing

VRoid udah ngasih texture dasar buat tiap bagian (kulit, mata, rambut, baju). Yang perlu lo kerjain cuma ngubah warna dan nambah detail yang belum ada di preset, misalnya pita leher, garis capelet, atau lipatan rok.

## Alat

- **VRoid texture editor** buat warna dasar dan coretan sederhana. Sistemnya layer, mirip aplikasi gambar.
- **Krita** ([krita.org](https://krita.org), gratis) buat detail yang butuh presisi.

## Alur kerja

1. Di VRoid, buka bagian yang mau diubah (misalnya Tops), lalu buka texture editor-nya.
2. Ganti warna dasar langsung di VRoid kalau cuma perlu satu warna rata.
3. Buat detail yang rumit:
   1. Export layer texture ke PNG dari menu layer.
   2. Buka PNG itu di Krita. **Jangan ubah ukuran kanvas.** Ukuran harus sama persis, biar posisinya pas lagi di model.
   3. Bikin layer baru di atas, gambar detailnya di situ. Layer asli jangan disentuh.
   4. Export hasilnya ke PNG baru dengan background transparan, cuma isi layer detail.
   5. Balik ke VRoid, import PNG itu sebagai layer baru di atas layer dasar.
4. Cek di viewport VRoid dari depan, samping, dan belakang. Garis yang lurus di PNG bisa melengkung di model karena mengikuti UV.

Kenapa detail dibikin layer terpisah: kalau posisinya meleset, lo tinggal hapus satu layer itu tanpa ngulang warna dasar.

## Tabel warna

Isi tabel ini pakai eyedropper dari screenshot anime lo. Gua sengaja nggak ngisi hex di sini karena gua nggak punya sumber resmi.

| Bagian | Hex | Diambil dari |
|---|---|---|
| Rambut utama | | |
| Streak poni | | |
| Iris | | |
| Kemeja | | |
| Pita leher | | |
| Capelet | | |
| Rok | | |
| Kaos kaki | | |

Simpan tabel yang udah keisi di repo. Nanti kalau bikin ulang atau benerin warna di Blender, tinggal lihat ke sini.

## Tips

- Warna anime biasanya flat. Shading udah diurus shader MToon di VRoid dan companion, jadi nggak perlu gambar bayangan manual di texture.
- Pakai warna yang sedikit lebih gelap dari screenshot. Layar anime biasanya lebih terang dibanding hasil render MToon.
- Backup `.vroid` sebelum eksperimen besar, misalnya `xenovia-before-texture.vroid`.
