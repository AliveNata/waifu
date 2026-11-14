# 03. Desktop companion: overlay, overlay tim, dan kantor AlyxLabs

Companion ini nampilin 2B dan timnya di tiga tempat:

- **Overlay 2B**: close-up 3D transparan di pojok kanan bawah layar, selalu di atas window lain. Kepala dan matanya ngikutin cursor lo.
- **Overlay tim**: close-up transparan di pojok kanan atas. Muncul cuma pas ada yang ngomong: 2B ngoper tugas, atau anggota tim mulai kerja, pakai tool, dan selesai. Ada gerak mulut, ekspresi, gesture, dan kotak dialog.
- **AlyxLabs Office** (kantor): window terpisah berisi kantor 3D dengan 2B dan anggota tim berproporsi orang biasa (lihat [04-tim.md](04-tim.md)). Tiap anggota punya meja sesuai role-nya, mulai kerja pas subagent-nya dipanggil, dan pas lagi nggak ada tugas mereka istirahat dengan kegiatan masing-masing.

Ketiganya bereaksi ke event yang sama dari hooks Claude Code.

## Model karakter

Urutan model yang dipakai buat tiap anggota:
1. `.vrm` asli yang lo pasang lewat **Menu > Pilih model .vrm**.
2. Kalau belum ada: **model anime cadangan**, yaitu sample resmi VRM 1.0 yang diwarnai ulang pakai warna rambut, mata, dan baju tiap karakter, plus kacamata buat Kobayashi. Wajah dan model rambutnya sama buat semua anggota.
3. Kalau model cadangan belum didownload: figur kotak-kotak di kantor, dan tulisan "Belum ada model" di overlay 2B.

Model cadangan didownload sekali (sekitar 10 MB, versi di-pin dan dicek hash-nya):

```powershell
npm run fetch-base-model
```

File-nya disimpan di `models/base/` dan nggak ikut ke-commit.

## Reaksi per event

| Event Claude Code | Mood | Overlay | Kantor |
|---|---|---|---|
| `SessionStart` | greeting | senyum, kepala miring | jalan ke depan, melambai |
| `UserPromptSubmit` | thinking | kepala miring, mata ke atas | berdiri di papan tulis, nulis |
| `PreToolUse`, `PostToolUse` | working | nunduk kayak baca layar | duduk di meja laptop, ngetik |
| `Notification` | waiting | kaget, condong ke depan | jalan ke depan, melambai pelan |
| `Stop` | done | senyum lebar, ngangguk | lompat kecil di depan, lalu balik ke sofa |
| `PreCompact` | thinking | sama kayak thinking | sama kayak thinking |
| `SessionEnd` | idle | santai | duduk di sofa |
| `SubagentStart` | (anggota) | nggak berubah | anggota yang dipanggil mulai kerja di mejanya |
| `SubagentStop` | (anggota) | nggak berubah | anggota itu selesai, ngulet atau senyum, lalu santai |

Greeting dan done balik ke idle sendiri setelah beberapa detik. Mood lain bertahan sampai event berikutnya, karena Claude Code nggak ngirim event "udah selesai mikir".

Biar 2B nggak itu-itu aja, posisi kepala tiap mood ada beberapa versi dan dipilih acak tiap kali mood itu mulai. Misalnya pas mikir kadang miring ke kiri, kadang ke kanan, kadang nunduk, dan pas nyapa kadang sambil bungkuk kecil. Pas idle, nunggu, mikir, atau kerja, sesekali dia ngelakuin hal kecil sendiri: lihat sekitar, goyang pelan kayak lagi bersenandung, nunduk sebentar, nguap, senyum, muter bahu, miringin kepala, nyelipin rambut ke telinga, atau lihat ke atas. Gerakan kecil ini berhenti dulu kalau lo lagi nyentuh dia atau minta pose dari chat.

## Nyentuh 2B

Klik 2B buat nyentuh dia. Tahan lalu geser di badannya atau di area kosong sekitarnya buat mindahin window-nya. Kalau geser di kepala atau rambut, itu dihitung ngusap, bukan mindahin. Klik kanan tetap ngebuka menu.

Di atas badan 2B, kursornya berubah jadi tangan 3D yang ujung telunjuknya nempel di titik yang lo tunjuk. Tangannya digambar di depan 2B, jadi nggak pernah tenggelam ke muka atau rambutnya. Begitu diklik, tangannya nunjukin sentuhannya, terus balik santai lagi. Tiap bagian badan punya beberapa gerakan yang dipilih acak, jadi klik yang sama nggak selalu kelihatan sama:

| Zona | Gerakan tangan |
|---|---|
| Kepala, rambut | Usap kiri kanan dengan telapak di atas kepala, atau ngacak ngacak rambut. Rambut yang kena telapak kedorong, rambutnya ikut kegeser ke arah usapan, dan kepalanya ikut miring dikit. Selama lo ngelus sambil geser atau nahan klik, usapannya jalan terus |
| Dahi, poni | Nyentil dari atas: tangannya narik dikit sambil jari tengah ditahan bantalan jempol, terus jarinya lepas cepat, kena dahi, dan balik santai. Kepala 2B kedorong ke belakang pas jarinya kena. Kadang dua kali |
| Hidung | Boop pakai telunjuk, kadang dua kali |
| Pipi | Colek, colek dua kali, atau colek sambil diputer dikit |
| Bahu | Tepuk pakai dua jari, atau colek |
| Tangan | Tos |
| Badan | Colek, kadang dua kali |
| Dada | Tepuk ringan, terus tangannya ditepis 2B sampai kelempar ke samping dan balik pelan pelan |

Di luar badannya, kursor balik ke panah biasa. Kalau model tangannya gagal dimuat, kursor biasa tetap dipakai. Kalau setting sistem lo minta animasi dikurangi, jari jarinya tetap berubah tapi tangannya nggak geser.

Model tangannya "Free Pack - VR Hands (Rigged)" karya [PolyOne Studio](https://sketchfab.com/polyone), dari [Sketchfab](https://sketchfab.com/3d-models/free-pack-vr-hands-rigged-b3b8309e59c748e3956531c8f57dd233), lisensi [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/). Pointer companion pakai tangan kanannya, mode **Jadi Alyx** di kantor pakai dua-duanya. Dikemas jadi satu file GLB dengan tekstur yang dikecilin ke 1024 piksel.

Makanan dan minuman di meja bar, juga isi kulkas, pakai model dari [Food Kit 2.0](https://kenney.nl/assets/food-kit) karya [Kenney](https://www.kenney.nl), lisensi [CC0](http://creativecommons.org/publicdomain/zero/1.0/). Yang dipakai cuma model yang muncul di kantor, ada di `companion/src/renderer/office/assets/food/`, dan tekstur colormap kit-nya udah ditanam ke tiap GLB.

Furnitur dari [Furniture Kit 2.0](https://kenney.nl/assets/furniture-kit) karya [Kenney](https://www.kenney.nl), lisensi [CC0](http://creativecommons.org/publicdomain/zero/1.0/), warnanya diganti ke palet kantor:

- Rak buku: `bookcaseClosedWide` dua unit, diisi `books` dengan warna sampul per kumpulan.
- Lounge: sofa `loungeSofa`, meja `tableCoffee`, kabinet TV `cabinetTelevision`, standing lamp `lampRoundFloor`.
- Dapur: kulkas `kitchenFridgeLarge` (dua pintunya kebuka, di dalamnya rak kaca dan isi dari Food Kit), lemari `kitchenCabinet`, mesin kopi `kitchenCoffeeMachine`, `toaster`.
- Dinding depan: kursi baca `loungeChair` dan meja kecil `sideTable`, lemari pajangan dari tiga `bookcaseOpenLow` dengan boneka `bear` dan `radio` di atasnya.
- Lain-lain: rangka kursi bar `stoolBar` (dudukannya bulat buatan kode), tanaman `pottedPlant` dan `plantSmall1`, keset `rugDoormat`, gantungan jaket `coatRackStanding`.

File-nya ada di `companion/src/renderer/office/assets/furniture/`. Kalau ada yang gagal dimuat, versi buatan kode dipakai.

Mawar di meja Yor pakai model "Rose" karya M Smith Jonn dari [Poly Pizza](https://poly.pizza/m/3iKz2gyNhMr). Poly Pizza cuma nyediain model CC0 atau CC-BY, jadi kreditnya dicantumin di sini dan di `assets/furniture/rose.CREDIT.txt`.

Model dari Sketchfab, lisensi [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/), dikompres (jumlah segitiga dikurangi, tekstur dikecilin) dan warnanya disesuaikan ke palet kantor:

- Kursi kerja: "Office Chair" karya [PixelPlay](https://sketchfab.com/PixelPlay), [sumber](https://sketchfab.com/3d-models/office-chair-c677daf0cf074ff1aa0744880b9a63dd).
- Mouse: "Logitech M310 Mouse" karya [Nick Scott](https://sketchfab.com/Nickjjscott), [sumber](https://sketchfab.com/3d-models/logitech-m310-mouse-062b547dbd9a42ce94ff0c94ab9ce3af).
- Laptop (meja Rias dan Chizuru, laptop meeting): "Laptop" karya [senthil123](https://sketchfab.com/senthil123), [sumber](https://sketchfab.com/3d-models/laptop-426afac17c664f1a9e3224394024fb7e).
- Laptop gaming (meja Ruby): "Gaming Laptop" karya [Blue Lantern](https://sketchfab.com/genoris2), [sumber](https://sketchfab.com/3d-models/gaming-laptop-4e72a2078b3c4a75a821ab09830693fe).
- Beanbag di lounge: "Simple Bean Bag" karya [AleixoAlonso](https://sketchfab.com/AleixoAlonso), [sumber](https://sketchfab.com/3d-models/simple-bean-bag-64d111cec3d842f09cbb8c68b1e49c8d). Cuma tekstur warnanya yang dipakai, dikecilin ke 1024 piksel.
- Aquarium: "Room aquarium (Now Animated)" karya [NeoT1](https://sketchfab.com/Neot1), [sumber](https://sketchfab.com/3d-models/room-aquarium-now-animated-3d2177c3e90a4379b3484d811c013284). Rumput dasar, pakan, ikan dan gelembung bawaannya dibuang, ganggang dan karangnya dikurangi jadi sekitar 26 ribu segitiga. Yang berenang di dalamnya ikan-ikan di bawah.
- Mochi si kucing kantor: "Somali Cat Animated ver 1.2" karya [DreamNoms](https://sketchfab.com/DreamNoms), [sumber](https://sketchfab.com/3d-models/somali-cat-animated-ver-12-e185c3fd92b64c32b4515a32b29252fc). Animasi jalan, duduk dan duduk diam dari model. Rebahan dan tidur dibikin dari kode di atas pose duduk: dada turun ke lantai, kaki depan lurus ke depan, dan pas tidur dia milih acak: kepala rebah di atas kaki depan, atau meringkuk ke kiri atau ke kanan dengan kepala nyelip ke badan dan ekor melingkar. Matanya merem di dua-duanya. Makan, ngemis, jilat-jilat bulu dan mantengin ikan juga dibikin dari kode di atas pose duduk: pas makan badannya condong dan kepalanya masuk ke mangkok sambil ngunyah, pas jilat bulu kaki depan kanannya naik ke pipi kayak cuci muka, pas ngemis dia duduk tegak sambil dongak dan nepuk-nepuk pintu kulkas, dan pas mantengin akuarium ujung ekornya kedut-kedut. Kalau modelnya gagal dimuat, Mochi balik ke versi buatan kode.
- Ikan di aquarium: "Fish Animated" karya [Pia Krensel](https://sketchfab.com/Pidele) ([sumber](https://sketchfab.com/3d-models/fish-animated-665ab73155a44d91908519d84e5fd002)), "Koi Fish" karya [lesliestowe](https://sketchfab.com/lesliestowe) ([sumber](https://sketchfab.com/3d-models/koi-fish-f7e2e4858f2f438aa2832566220199f4)), "Fish" karya [Yimit](https://sketchfab.com/yimit) ([sumber](https://sketchfab.com/3d-models/fish-c4328d6c1ae445198abc1a3d4c1e2570)), "Fish" karya [mRiot](https://sketchfab.com/malgorzatariot) ([sumber](https://sketchfab.com/3d-models/fish-c34f2b96bd5140b3ac44b7266fd72b28)), "Small fish" karya [The SpezX](https://sketchfab.com/SpezX) ([sumber](https://sketchfab.com/3d-models/small-fish-8f5de32946f347a0b6c8e55c6a66d46d)).

- Arcade Pac-Man: "Pacman Arcade + animation" karya [Daniel Brück](https://sketchfab.com/daniel.brueck), [sumber](https://sketchfab.com/3d-models/pacman-arcade-animation-0b43f85af5384ea4bac5d6e2d3cbd008).
- Treadmill: "treadmill ProForm" karya [e-restrepo1114](https://sketchfab.com/EmanuelRestrepoVelez), [sumber](https://sketchfab.com/3d-models/treadmill-proform-03e4ff99ecc24e5f8ea49d4e8df876e8).
- Meja pingpong: "ping pong" karya [alixor22](https://sketchfab.com/alixor22), [sumber](https://sketchfab.com/3d-models/ping-pong-c954dcfaec2744e381a30d09afbb6e47).
- Printer: "Printer- Low Poly" karya [CG Buzz](https://sketchfab.com/Tapan_S), [sumber](https://sketchfab.com/3d-models/printer-low-poly-8a3a68f84f4d4a34973b527875a7314b).
- Server rack: "Server Rack" karya [Spellkaze](https://sketchfab.com/Spellkaze), [sumber](https://sketchfab.com/3d-models/server-rack-62f6779cb7e448b19aaf58544c3c7218).
- Ring light: "Ring Light" karya [ahmagh2e](https://sketchfab.com/ahmagh2e), [sumber](https://sketchfab.com/3d-models/ring-light-fe2d9eda3939484ea10c3ebc4887c28a).
- Kamera dan tripod: "Camera With Tripod" karya [FatWasHere](https://sketchfab.com/fathin880), [sumber](https://sketchfab.com/3d-models/camera-with-tripod-cc324baf6dc548de965c3a47b87f1e27).

- Monitor: "Basic PC Monitors" karya [Sousinho](https://sketchfab.com/sousinho), [sumber](https://sketchfab.com/3d-models/basic-pc-monitors-58a2dba70e4f4752962ee98a9d6827be). Panelnya lepas dari kakinya, jadi monitor vertikal (Asuna, Kobayashi, Erza, Miruku) pakai panel standar yang diputar di atas kaki yang sama. Layarnya tetap layar kantor yang hidup.
- Monitor curved (layar utama Miruku dan ultrawide Kobayashi): "Curved Monitor" karya [Arnau Rocher Alcayde](https://sketchfab.com/ArnauRocherAlcayde), [sumber](https://sketchfab.com/3d-models/curved-monitor-5aeacd0cc5f649a4b92ce90bca6917e7). Lengkungannya dibikin lebih landai dari modelnya (jari-jari sekitar 2,2 kali lebar layar), dan layar kantor yang hidup ikut melengkung ngikutin panel. Member lain tetap pakai monitor datar.
- PC tower: "(FREE) Gaming Pc" karya [Moonway 3D](https://sketchfab.com/moonway3d) ([sumber](https://sketchfab.com/3d-models/free-gaming-pc-62dbee9434e343a7851e7ec5d6fabd5d)) dan "Computer- PC futuristic" karya [Caio de Oliveira](https://sketchfab.com/caio17011) ([sumber](https://sketchfab.com/3d-models/computer-pc-futuristic-feab99daee9a4453a52b96b659d6db67)), selang-seling antar meja, dengan lampu warna role tetap di sampingnya.
- Makan siang di meja meeting: tiap member punya menu tetap, dan kotak di kursi ganti sesuai siapa yang duduk. Kebanyakan hasil foto 3D, jadi meja atau talenan yang ikut ke-scan dipotong, posisinya diluruskan, segitiganya dikurangi ke 10 sampai 28 ribu, dan teksturnya dikecilin ke 1024 piksel:
  - 2B: "Japanese set meal:日本の定食" karya [kazugoru](https://sketchfab.com/kazugoru), [sumber](https://sketchfab.com/3d-models/japanese-set-meal-d94ba23210b94af2b72124fc6fd62f41).
  - Chizuru: "FREE Sushi Platter – 3D Japanese Food Set" karya [Halabalo067](https://sketchfab.com/Halabalo067), [sumber](https://sketchfab.com/3d-models/free-sushi-platter-3d-japanese-food-set-40112dd476ae4d61b0324731dac6b1cd).
  - Rias: "叙々苑_焼肉弁当_品川キッチン" karya [takahiko](https://sketchfab.com/takahiko1969), [sumber](https://sketchfab.com/3d-models/1eedd9d405a14042a309623dbf62966b). Sumpit dan kertas di sebelah kotaknya dibuang.
  - Asuna: "FREE Japanese Bento Box – 3D Food Model" karya [Halabalo067](https://sketchfab.com/Halabalo067), [sumber](https://sketchfab.com/3d-models/free-japanese-bento-box-3d-food-model-519e3aeef157483bb9c4cc1652d6b70d).
  - Kobayashi: "牛丼弁当大盛り(Trnio)" karya [seirogan](https://sketchfab.com/seirogan), [sumber](https://sketchfab.com/3d-models/trnio-dcef0b555b1f40a4ba388aee47ad4e3e).
  - Yor: "浜勝ロースとチキンカツ弁当" karya [makoragi](https://sketchfab.com/makoragi), [sumber](https://sketchfab.com/3d-models/e9862ee5fcd14da98da0bc66dd2a6a07).
  - Erza: "Unaju" karya [seirogan](https://sketchfab.com/seirogan), [sumber](https://sketchfab.com/3d-models/unaju-3c5495d3416944a088cd42db2fc56ba4).
  - Ruby: "A Bento ( lunch combo)" karya [Jingbari](https://sketchfab.com/Jingbari), [sumber](https://sketchfab.com/3d-models/a-bento-lunch-combo-f5e97511eb0f4888b07596a53d95fad7).
  - Arisu: "A Jerk chicken Bento (lunch combo)" karya [Jingbari](https://sketchfab.com/Jingbari), [sumber](https://sketchfab.com/3d-models/a-jerk-chicken-bento-lunch-combo-015c94dae15b4821bde7baec394ecc56).
  - Komachi: "Unagyu-bento" karya [ddd](https://sketchfab.com/endonoriko), [sumber](https://sketchfab.com/3d-models/unagyu-bento-3dc49a977873417088384f5ae78c5a6c).
  - Miruku: "Unaju" karya [kobax_km7](https://sketchfab.com/kobax_km7), [sumber](https://sketchfab.com/3d-models/unaju-cd2658b044ff4f828628e552df885090). Cangkir dan nampan di sebelahnya dibuang. Dinding kotaknya nggak ke-scan lengkap, jadi kotak lacquer hitam dengan dalam merah dibikin dari kode di sekeliling isinya.
  - Huagua: "Food (Delicious Nasi lemak)" karya [Leonth](https://sketchfab.com/wishingwell360), [sumber](https://sketchfab.com/3d-models/food-delicious-nasi-lemak-4625dae3b0814c57bbc7ba24ce2bed95).

  Kalau model menu seseorang gagal dimuat, kotaknya balik ke bento buatan kode.

Dari Kenney Furniture Kit juga: TV `televisionModern` di atas kabinet TV, speaker `speakerSmall` di kedua ujung kabinet, dan bangku `benchCushionLow` di depan meja pingpong. Lampu meja Rias dan Huagua pakai `lampRoundTable`, diwarnain sesuai lampu mereka yang lama (kuningan dengan kap merah tua, kayu dengan kap hijau), dan kapnya yang menyala pas lampu dihidupin. Lampu meja member lain tetap buatan kode, karena bentuknya khas per orang dan nggak ada di kit. Tempat sampah juga `trashcan` dari kit, tutupnya dipotong dari badannya biar bisa kebuka di engsel belakang. Meja meeting dibikin dari 5 × 2 `table` yang disambung, dan sambungan kakinya jatuh di tengah antara kursi biar nggak kena lutut. Badan meja bar dari `kitchenBar`, dua baris saling membelakangi biar panelnya kelihatan dari dua sisi stool. Meja bundar di pojok kolaborasi pakai `tableRound`.

Laptop cuma diambil bentuk badan dan tutupnya. Keyboard yang nyala pas ngetik dan layarnya tetap buatan kode, jadi animasinya sama kayak sebelumnya.

Dua prop opsional yang lisensinya nggak boleh masuk repo, jadi file-nya disimpan sendiri di `models/` (nggak ikut ke-commit, sama kayak kurir):

- `models/arcade-elben.glb`: "Arcade Cabinet Elben Quest" karya [iceboxX708](https://sketchfab.com/iceboxX708), lisensi CC-BY-NC-4.0 (cuma buat non-komersial), [sumber](https://sketchfab.com/3d-models/arcade-cabinet-elben-quest-637f3a217d3e4fbbbeef8670381f2c53). Kalau ada, jadi arcade kedua. Kalau nggak ada, arcade kedua tetap buatan kode.
- `models/punching-bag.glb`: "Punch bag" karya [Hapk](https://sketchfab.com/neiltonanimacoes), lisensi Sketchfab Standard (nggak boleh disebar ulang), [sumber](https://sketchfab.com/3d-models/punch-bag-dc939aa468a74c9a814f72fef1cb5a15). Kalau ada, samsaknya pakai model ini dan tetap berayun waktu dipukul.

Download dari Sketchfab (format glTF, file `.glb`), ganti namanya kayak di atas, dan catat kreditnya di `models/CREDITS.md`.

Kurir pesanan opsional. Simpan model kurir sebagai `models/courier.vrm`, nanti tiap pesanan diantar sama kurirnya: jalan masuk lewat lorong bawa bungkus sesuai pesanan, nunggu di depan pintu sampai Alyx ambil paketnya, terus balik keluar. Kalau 45 detik nggak diambil, paketnya ditaruh di keset dan kurirnya pergi. Tanpa file itu, pesanan langsung muncul di keset kayak sebelumnya.

Model yang dipakai: "Chilly" karya Opinion di [VRoid Hub](https://hub.vroid.com/en/characters/8323797324053045907/models/5875511229924575628). Lisensinya bolehin dipakai siapa aja sebagai avatar, boleh dimodifikasi, wajib kredit, dan nggak boleh didistribusiin ulang. Jadi file-nya nggak ikut di repo: download sendiri (perlu login VRoid Hub) dan catat kreditnya di `models/CREDITS.md`.

| Disentuh | Reaksi pertama | Kalau diulang atau ditahan |
|---|---|---|
| Kepala (klik atau usap) | merem senang, nyender | ditahan: santai, matanya sayu |
| Rambut | rapihin rambut di samping kepala | diusap terus: ketawa kecil |
| Dahi atau poni | "Aduh!", kepala mundur | diulang: ngusap dahi, cemberut |
| Hidung | "Boop?", merem senang | |
| Pipi | kaget kecil, terus senyum | dicolek 3x: manyun, buang muka |
| Bahu | noleh, terus ngangguk | ditepuk 2x cepat: kepala miring, "Ada apa?" |
| Tangan | dadah kecil | ditahan: tangannya ngikutin kursor |
| Dada | "Heh! Jangan di situ!", malu sekaligus marah: pipinya merah, nepis tangan lo, nyilangin tangan nutupin dada, mundur, buang muka sambil nunduk | diulang: makin marah ("Ih! Udah dibilang jangan!"). Kalau masih juga: "Mesum. Aku ngambek dulu." dan ngambek 12 detik. Disentuh di situ pas lagi ngambek: nutup lagi dan ngambeknya diperpanjang |
| Badan bagian lain | "Eh?", mundur dikit | diulang: balik badan sebentar |

Colekan beruntun bikin dia makin sebel. Kalau kebanyakan, dia ngambek sekitar 5 detik dan nolak disentuh, terus balik normal sendiri. Sentuhan di dada diinget 20 detik, jadi yang berikutnya dalam waktu itu dihitung "diulang". Ngusap kepala atau rambut malah nurunin sebelnya. Zona sentuhannya diukur di model VRoid dan diskalakan ke ukuran kepala model lo, jadi model non-VRoid bisa agak meleset.

## Overlay tim

| Kejadian | Yang ngomong | Contoh (mode simulasi) | Gesture |
|---|---|---|---|
| 2B ngoper tugas | 2B | "Asuna, tolong bantu ya." | nunjuk |
| Subagent mulai | Anggota itu | "Oke, aku cek dulu ya." | ngangguk |
| Subagent pakai tool | Anggota itu | "Aku baca kodenya dulu." (maksimal sekali per 8 detik) | mikir atau ngetik |
| Subagent selesai | Anggota itu | "Review selesai. Hasilnya ada di laporan." | ngangguk atau sorak |

Kalimat simulasi cuma ngegambarin aktivitas, nggak pernah ngarang hasil. Tag "simulasi" muncul di pojok kotak dialog.

**Isi asli**: tombol **Isi asli** di overlay tim (samar, jadi jelas pas di-hover), atau **Menu > Tampilkan isi percakapan asli**. Kalau dinyalain, 2B nyebut judul tugas yang beneran, anggotanya jawab "oke, aku cek dulu", terus pas selesai dia ngejelasin laporan akhirnya kalimat per kalimat. Matiin lagi sebelum share screen.

Cara laporan dibacain:
- Diambil dari awal laporan akhir subagent, maksimal 1200 karakter. Format markdown dibuang, blok kode dilewatin, tiap poin atau kalimat jadi satu baris dialog.
- Maksimal 6 kalimat. Kalau laporannya lebih panjang, baris terakhirnya "Sisanya lengkap di laporan ke 2B ya."
- Ekspresi dan gesture ngikutin isi kalimatnya: kabar baik ("test lulus", "nggak ada error") senyum dan ngangguk, masalah ("gagal", "belum", "bug") alis khawatir dan geleng pelan, ragu ("belum bisa dipastikan", "kemungkinan", "nggak yakin") alis bingung, kepala miring, dan ngelirik ke atas, saran ("sebaiknya ...") nunjuk, pertanyaan alis naik dan mikir. Tebakannya dari kata kunci Indonesia dan Inggris, jadi kadang meleset, tapi yang meleset cuma ekspresinya, isi kalimatnya tetap persis dari laporan.

Wajah yang ngomong:
- Mulut ngikutin huruf yang lagi muncul di dialog, bukaannya beda dikit tiap vokal, dan nutup di spasi dan tanda baca.
- Kedip dengan jeda acak, kadang dua kali berturut-turut, dan selalu kedip abis selesai satu kalimat.
- Mata natap lo sambil ngelirik kecil. Pas mikir atau ragu ngelirik ke atas samping dulu, pas mau nyampein masalah nunduk sebentar.
- Di model VRoid, ekspresinya lewat alis dan mata secara terpisah, karena preset bawaan VRoid ("sad", "happy") ikut nutup mata. Model non-VRoid pakai preset biasa dengan bobot tipis.

Overlay tim sengaja lebih kecil dari overlay 2B (300 x 380).

**Di kantor**, percakapan tim ada di pojok kanan atas, jauh dari chat dan close-up yang di kiri. Wajah yang ngomong muncul kecil (150 x 180) di atas kotak dialog, bagian bawahnya nyelip di balik dialog. Isinya model lengkap anggota itu, sama kayak overlay tim, jadi ekspresi, kedipan, dan mulutnya ikut. Selama window kantor kebuka di layar (nggak di-minimize), overlay tim di desktop minggir dulu biar nggak nimpa percakapan di pojok yang sama, terus balik lagi pas kantor ditutup atau di-minimize. Kalau modelnya gagal dimuat, potretnya nggak muncul dan dialognya tetap jalan.

Overlay tim bisa digeser kayak overlay 2B.

Event yang terjadi di dalam subagent (misalnya Asuna ngejalanin `Edit`) cuma ngegerakin anggota itu, bukan 2B. Pas 2B ngoper kerjaan, chip status nampilin "Delegasi ke tim".

## AlyxLabs Office (kantor)

Ruangannya terang dengan aksen ungu dari logo AlyxLabs: LED neon yang "lari" di atas dinding dan di sepanjang lis bawah, lampu di bawah meja, dan papan nama di dinding belakang. Anggota tim pakai proporsi badan model aslinya (kepala, kaki, tangan nggak diubah), terus seluruh model dikecilin ke tinggi 1,2 m, dan kantornya diukur ke tinggi itu: meja di bawah pinggang, kursi setinggi lutut, monitor sejajar mata pas duduk, dan papan tulis kejangkau tangan. Jadi kelihatannya kayak kantor beneran, cuma skalanya disamain.

Tiap zona punya bentuk yang kebaca jelas dari kamera, dan meja meeting, meja 2B, serta logo ada di satu garis tengah. Zonanya:

| Zona | Isi |
|---|---|
| Pod planning | Empat meja lurus yang nempel saling hadap di depan kanan, di sebelah meja Miruku: Rias dan Arisu di sisi utara menghadap ruangan, Chizuru dan Komachi di seberangnya. Papan tulis tetap di dinding kiri |
| Deretan meja belakang | Meja L buat yang ngerjain: Kobayashi dan Huagua di kiri logo, Asuna dan Yor di kanan, lemari printer tepat di bawah logo, plus rak server di ujung sebelah Yor. Sayap meja L semuanya di kanan, jadi deretannya keliatan seragam |
| Tengah | Meja meeting dua belas kursi (lima di tiap sisi, satu di tiap ujung), di garis tengah ruangan |
| Pojok kolaborasi | Di antara meja meeting dan zona game, di atas karpet terang: meja tinggi bundar dengan tiga bar stool dan papan kaca berisi sticky note. Dipakai buat ngobrol singkat tanpa harus ke meja meeting |
| Depan | Meja L 2B di tengah, diapit meja L Erza (review dan QA) di kiri dan Miruku (security) di kanan, semua menghadap kamera. Sayap meja Erza ke kiri, punya 2B dan Miruku ke kanan, plus dua tanaman di depan meja 2B |
| Dinding kiri | Papan tulis (2B dan Rias) dan papan ide Chizuru, masing masing dengan panggung rendah di depannya, TV lounge |
| Lounge | Sofa menghadap TV, meja kopi, beanbag, dan akuarium di atas meja kayu nempel dinding depan, di antara lounge dan meja depan |
| Pantry | Jam digital besar di dinding (zona Asia/Jakarta). Counter bentuk L: wastafel dengan rak pengering gelas di sampingnya, mesin kopi, dan oven di counter belakang, lalu meja bar yang nyambung ke ujungnya dengan dua bar stool di tiap sisi, plus kulkas dan tempat sampah yang mepet dinding di samping kulkas. Makanan bareng ditaruh di ujung meja bar |
| Game dan fitness | Pojok kanan belakang di atas matras karet: dua mesin arcade, dua treadmill menghadap jendela, meja pingpong dengan bangku penonton di depannya, dan samsak |
| Layar status tim | Layar besar di dinding belakang di atas mesin arcade. Isinya tiap anggota: lagi kerja, nunggu kamu, selesai, atau idle, plus nama tool terakhir dan sudah berapa lama. Datanya dari hook Claude Code yang sama yang ngegerakin cast. Yang ditampilin cuma status dan nama tool, nggak pernah isi pesan atau isi file. Status selesai tetap kelihatan 15 menit setelah run berhenti Klik layarnya (atau tombol **Status tim** di bawah) buat buka versi besar, tutup pakai tombol X, Escape, atau klik di luar |
| Studio Ruby | Pojok kanan depan, menghadap kamera kayak set: backdrop logo di belakang kursinya, meja lurus, ring light, dan kamera di tripod |
| Sisi kanan | Pintu kaca otomatis dengan tanaman di sebelahnya, buat yang keluar beli makanan. Pas ketutup tulisannya kebaca AlyxLabs, pas kebuka kepisah jadi Alyx dan Labs |

**Interaksi:**
- Arahin kursor ke anggota buat lihat nama dan role-nya.
- Klik anggota buat buka preview close-up dan statusnya (lagi ngapain, kerja atau idle, tool terakhir). Kalau dia lagi jalan, kameranya ngikutin. Klik di tempat lain atau tekan Escape buat nutup.
- Pas 2B ngedelegasi tugas ke anggota, dia jalan bawa map ke meja anggota itu dan nyerahin. Pas run anggota selesai, anggotanya jalan ke meja 2B bawa laporan. Kalau yang selesai barengan, mereka antre di depan meja 2B (maksimal tiga).
- Cast lebih lama santai di meja, sekitar dua pertiga waktu luangnya, jadi jalan-jalannya nggak kebanyakan.
- **Kamera bebas**: klik tombol **Kamera bebas** di bawah. WASD atau panah buat jalan, Q dan E buat turun naik, Shift biar lebih cepat, drag mouse buat noleh. Kameranya nggak bisa keluar jauh dari ruangan. Esc atau klik tombolnya lagi buat balik ke tampilan awal.
- **Jadi Alyx**: klik tombol **Jadi Alyx** di bawah buat jalan di kantor sebagai Alyx, CEO-nya, dari mata dia sendiri. Klik sekali, mouse-nya dikunci ke kantor: gerakin mouse buat noleh, WASD atau panah buat jalan, Shift buat lari. Alyx nggak bisa nembus meja, tembok, atau anggota tim, dan anggota yang lagi jalan minggir ngelewatin dia. Dua tangannya kelihatan di bawah layar, pakai model VR Hands yang sama dengan pointer companion, dengan lengan jas dan manset kemeja. Arahin titik di tengah layar ke anggota yang deket (sekitar 1,8 m) sampai muncul **E Sapa nama**, terus pencet E: Alyx ngelambai, anggotanya noleh, senyum, ngelambai balik, dan bales satu kalimat sesuai karakternya. Titik di tengah layar juga dipakai buat barang di sekitar, labelnya muncul di bawah titik itu:

| Yang dibidik | E ngapain |
|---|---|
| Barang kecil di meja (stempel, bebek karet, HP testing, buku, gembok, jam pasir, dan lainnya) | Diambil ke tangan kanan Alyx. Selama dipegang, E naruh balik ke tempat asalnya, dan pemiliknya nggak make barang itu dulu |
| TV, arcade, kulkas | Nyalain atau matiin, buka atau tutup pintu kulkas |
| Kursi meeting yang kosong (bagian meja di depannya) | Buka laptop Alyx sendiri di situ, E lagi buat nutup |
| Lampu meja | Nyalain atau matiin, siang atau malam |
| Sofa, beanbag, stool bar, stool pojok kolaborasi, kursi meeting yang kosong | Duduk, kameranya turun. E atau tombol jalan buat berdiri. Selama Alyx duduk, kursi itu nggak dipakai anggota lain |
| Ujung meja pingpong | Main pingpong. Anggota yang paling lama nganggur dateng ke ujung satunya, terus bolanya jalan. Raket di tangan Alyx ngayun sendiri ngikutin bola. E atau tombol jalan buat udahan |

Keluar dari mode Alyx, semuanya balik kayak semula: barang yang dipegang balik ke meja, dan TV, arcade, kulkas, laptop, sama lampu balik ke keadaan otomatisnya. Esc pertama ngelepas mouse (kantor berhenti, klik lagi buat lanjut), Esc kedua keluar dari mode Alyx dan balik ke tampilan biasa. Mode ini dan Kamera bebas saling gantian, jadi nyalain satu bakal matiin yang lain.

Dari tampilan biasa kantornya kebuka kayak rumah boneka, cuma ada dinding belakang dan kiri biar bisa diintip dari depan atas. Di mode Alyx ruangannya ditutup: dinding kanan (bolong di pintu kaca, dengan lorong pendek di baliknya), dinding depan, dan langit-langit dengan panel lampu yang ikut redup pas kantor mulai kosong malam hari. Biar tetap enteng, mode Alyx jalan tanpa ambient occlusion. Dinding baru dan langit-langitnya juga punya neon berjalan (atas dinding, alas dinding, bingkai langit-langit, dan dua garis memanjang di langit-langit), plus empat quote neon: "Ship it. Then make it better." dan "GG. Next sprint." di dinding depan, "No bugs, only side quests." dan "Respawn. Retry. Release." di dinding kanan. Mata Alyx ada di 1.16 m, sedikit di atas mata anggota tim (1.12 m), jadi pas ngobrol dia ngelihat muka mereka, bukan ubun-ubunnya.

Tekan **H** di mode Alyx buat nyembunyiin chip FPS, baris petunjuk kontrol, dan tombol-tombol di bawah. Titik bidik dan label E tetap ada. Tekan H lagi buat munculin, atau keluar dari mode Alyx.

Pas Alyx diem, tangannya gerak sendiri tiap beberapa detik, dipilih acak dan nggak pernah sama dua kali berturut-turut: lihat jam tangan di pergelangan kiri, benerin manset, jari ngetuk-ngetuk, gosok tangan, kepal-buka, sama lihat telapak tangan. Begitu jalan, megang barang, main pingpong, ngelus Mochi, atau nyapa, tangannya langsung balik ke pose biasa.
- **FPS**: tekan F (atau centang **Tampilkan FPS kantor** di menu) buat nampilin chip di kiri atas: frame per detik, waktu per frame, waktu skrip per frame (`cpu`, dengan bagian buat gerakin tim dan fisika rambut di `tim`), jumlah draw call, dan di baris kedua nama GPU yang dipakai. Tekan F lagi buat nyembunyiin. Pilihannya tersimpan.
- **Resolusi dan batas FPS**: **Menu > Resolusi kantor** (100, 75, 50%) sama **Menu > Batas FPS kantor** (tanpa batas, 30, 60). Di mode browser, dua-duanya ada di dialog **Model**.
- **Efek suara**: default mati. Nyalain lewat **Menu > Efek suara kantor**, volumenya di **Menu > Volume efek suara** (25, 50, 75, 100%). Di mode browser, checkbox sama slider volumenya ada di dialog **Model**. Semua suara dibikin langsung pakai WebAudio, nggak ada file rekaman:

  | Suara | Kapan bunyi |
  |---|---|
  | Klik keyboard | Tiap huruf yang diketik anggota di mejanya |
  | Pintu otomatis | Pintu kaca kebuka dan ketutup |
  | Mesin kopi | Anggota mulai bikin kopi: gilingan dulu, terus desis uap |
  | Bola pingpong | Kena raket dan mantul di meja |
  | Mochi | Ngeong tiap dia "ngomong", dengkur pas dielus Alyx |
  | Gong | Standup pagi dimulai |

  Suaranya makin pelan makin jauh dari kamera (atau dari mata Alyx di mode Alyx), dan kedengeran dari kiri atau kanan sesuai posisinya. Klik keyboard cuma kedengeran dari meja terdekat, gong kedengeran sekantor. Di browser, suaranya baru mulai setelah lo klik atau pencet tombol di halaman (aturan autoplay browser).

**Kalau kantornya patah-patah**: yang paling berat jumlah draw call, bayangan matahari (shadow map-nya digambar sekali per frame, dan props di bawah 6 cm nggak ngelempar bayangan), fisika rambut 12 karakter, dan close-up yang ngegambar adegan sekali lagi. Yang bisa langsung dicoba: matiin **Grafis kantor tinggi** di menu (nonaktifin efek ambient occlusion), atau matiin close-up otomatis. Angka di chip FPS bisa dipakai buat bandingin sebelum dan sesudah.

Cara baca chip-nya: kalau `ms` (waktu per frame) jauh di atas `cpu`, yang nahan frame itu GPU. Turunin **Resolusi kantor** ke 75 atau 50% (jumlah piksel turun jadi sekitar 56 atau 25%). Kalau `cpu` hampir sama dengan `ms`, yang berat itu skripnya, dan resolusi nggak banyak ngaruh. Angka `tim` nunjukin berapa dari itu yang kepake buat pose dan fisika rambut 12 anggota. Fisika rambut tiap anggota cuma ngecek collider (sandaran kursi dan lantai) dalam radius 1.6 m dari dia, dan di frame yang lambat maksimal dua langkah simulasi, biar frame lambat nggak bikin frame berikutnya makin lambat. **Batas FPS** cuma ngebatesin ke atas, nggak bisa naikin FPS. Gunanya buat frame yang lebih stabil dan laptop yang lebih adem, kalau FPS-nya udah di atas batas itu. Di laptop yang punya dua GPU, app minta GPU yang lebih kuat. Kalau GPU-nya cuma integrated, nama di chip bakal nunjukin itu.

**Yang udah dioptimasi**: furnitur yang nggak pernah gerak digabung jadi satu mesh per jenis material pas kantor selesai dibangun. Barang yang masih hidup (layar, lampu, pintu, mug, laptop, keyboard, apa pun yang dipegang atau berubah warna) tetap terpisah. Tuts keyboard sekarang satu `InstancedMesh` per keyboard, bukan satu mesh per tuts. Diukur di kamera default: mesh yang kelihatan turun dari 1.759 jadi 718, dan draw call per frame (termasuk bayangan) dari sekitar 2.900 jadi sekitar 1.370. Log `[office] merged ... static meshes into ...` di console nunjukin berapa yang digabung.

Setup meja sesuai role:

| Anggota | Setup | Pas kerja |
|---|---|---|
| Asuna | Monitor SQL, DAG pipeline, monitor vertikal job run, bebek karet, PC tower | Ngetik SQL, teks muncul per karakter, jarinya mencet tuts yang sesuai dan tuts itu nyala |
| Kobayashi | Monitor ultrawide, monitor vertikal daftar PR, konsol handheld di dock, boneka naga, PC tower | Ngetik kode aplikasi |
| Erza | Monitor diff horizontal, checklist review di monitor vertikal, kue stroberi, PC tower | Ngetik catatan review |
| Yor | Terminal dan monitoring, stand headset, mawar, PC tower | Ngetik command read-only |
| 2B | Satu monitor, planner kertas, PC tower | Ngetik plan, atau nulis di papan tulis pas mikir |
| Ruby | Laptop, mic, ring light | Ngetik draft post |
| Rias | Papan tulis, plus meja sendiri: laptop, papan catur, cangkir teh di atas tatakan, tumpukan buku, gulungan blueprint | Gambar diagram, tangannya ngikutin ujung spidol, kepala dan badannya ngikutin tulisan |
| Chizuru | Papan ide, plus meja sendiri: laptop yang tutupnya ditempelin sticky note, tumpukan sticky note, gelas spidol, tanaman kecil | Nempel sticky note satu-satu |
| Arisu | Monitor rencana kerja, monitor kedua dengan papan sprint tim, clipboard checklist, jam pasir buat timebox, laci dengan laptop meeting | Ngetik rencana di `plans/` |
| Komachi | Monitor kontrak antar bagian, monitor kedua dengan diagram kontrak (siapa nyambung ke siapa), notebook terbuka dengan pena, tumpukan buku referensi, laci dengan laptop meeting | Ngetik kontrak dan langkah teknis |
| Miruku | Monitor checklist keamanan, monitor vertikal log scan, security key di hub USB, gembok, laci dengan laptop meeting | Ngetik catatan pemeriksaan keamanan |
| Huagua | Monitor `DESIGN.md`, tablet gambar dengan stylus, kipas swatch warna, sketchbook, laci dengan laptop meeting | Ngetik arah desain |

**Ngetik**: tiap karakter yang muncul di layar dipencet jari beneran. Telapak tangan ngambang di atas keyboard dengan jari ditekuk ke tuts, jadi tangan nggak tenggelam ke keyboard. Tangan kiri pegang separuh kiri keyboard (1 sampai 5, Q sampai T, A sampai G, Z sampai B), tangan kanan sisanya, spasi, dan Enter, kayak touch typing. Tiap meja juga punya mouse di kanan keyboard. Sesekali tangan kanan pindah ke mouse beberapa detik dengan telapak di atas mouse, mouse-nya geser geser dan tombolnya nyala pas diklik, dan teks di layar berhenti dulu sampai tangannya balik ke keyboard.

**Nulis di papan tulis**: spidolnya diangkat dari papan dan dibawa ke awal coretan berikutnya, nggak loncat. Kadang berhenti sebentar kayak mikir, kadang mundur selangkah buat ngelihat hasilnya dengan tangan turun. Kalau tulisannya makin ke samping, dia geser beberapa langkah kecil ngikutin. Papan tulis dan papan ide ukurannya kayak papan kantor biasa (tinggi 0,85 m, mulai 0,45 m dari lantai), dengan panggung rendah setinggi 18 cm di depannya. Yang nulis naik ke panggung pas mulai dan turun pas selesai. Tulisannya cuma di bagian yang kejangkau dari panggung, jadi bagian paling atas papan dibiarin kosong. Buat baris paling atas dia jinjit, buat baris paling bawah dia nekuk lutut. Abis diagram selesai dia mundur ngelihat seluruhnya, terus ngapus papan dengan gerakan nyapu.

**Barang di meja dipakai**, bukan pajangan. Pas lagi santai di mejanya, tiap beberapa detik cast ngapain sesuatu sama barangnya. Barang yang diambil beneran hilang dari meja selama dipegang, terus ditaruh balik ke tempatnya. Tangannya dijulurin ke barang itu (barang di kiri meja diambil tangan kiri), badannya condong ke arah barangnya.

| Anggota | Yang dilakuin |
|---|---|
| 2B | Buka planner dan baca, atau noleh ke kalender meja di sayap L, ngebalik halamannya lewat atas, terus ngetuk tanggal hari ini dua kali |
| Arisu | Condong ke papan sprint di monitor kanannya sambil megang dagu, ngangkat clipboard terus nyentang daftar satu-satu, atau ngebalik jam pasir terus ngelihatin pasirnya turun |
| Komachi | Nulis di notebook pakai pena, atau ngambil buku paling atas dari tumpukan terus baca |
| Miruku | Ngecek log di monitor vertikal, nekan security key di hub beberapa kali, mainin gembok di tangan, atau muter kunci kombinasi brankas kecil di sayap L, buka pintunya, ngintip isinya (dua batang emas dan security key cadangan), terus ditutup dan dialnya diputer lagi |
| Huagua | Gambar di tablet pakai stylus, ngangkat kipas swatch terus bandingin warnanya sama layar, tiba tiba dapet ide sambil ngacungin jari, atau mindahin satu kartu warna di easel mood board, nepuk-nepuk biar nempel, terus mundur ngelihatin sambil megang dagu |
| Asuna | Ngecek job run di monitor vertikal, ngajak ngomong bebek karetnya, atau ngambil kertas print grafik dari tumpukan di sayap L terus baca pakai dua tangan |
| Kobayashi | Ambil konsol dari dock terus main pakai dua tangan, meluk boneka naga sambil senyum, atau ngambil HP testing dari stand di sayap L, di-tap pakai tangan satunya, terus balikin ke stand |
| Erza | Makan kue pakai garpu suap demi suap, atau ngambil stempel di sayap L, nyelupin ke bantalan tinta dua kali, ngecap kertas paling atas sampai muncul cap merah APPROVED, terus ngelihatin hasilnya sambil senyum |
| Yor | Ambil mawar dari vas dan nyium wanginya, atau nyabut kabel jaringan salah satu node cluster Raspberry Pi di sayap L. Lampu node itu mati selama kabelnya lepas, kedip cepet pas dicolok lagi, terus balik normal |
| Ruby | Ngomong ke mic, atau selfie pakai HP |
| Rias | Nyeruput teh, atau mindahin bidak catur terus mikir sambil megang dagu |
| Chizuru | Nulis di sticky note pakai spidol, atau tiba tiba dapet ide sambil ngacungin jari |

Selain itu semua cast sesekali nyeruput kopi dari gelasnya sendiri, selama gelasnya ada di meja dan masih ada isinya.

Barang di sayap L ditaruh di samping pinggul yang duduk, jadi pas makenya badannya muter ke samping, bukan condong ke depan. Sayap L 2B dan Miruku ada di kiri mereka, jadi mereka pakai tangan kiri. Yang lain pakai tangan kanan. Lampu di cluster Pi Yor kedip terus kayak lagi ada trafik, walaupun nggak lagi dipegang.

**Kucing kantor**: Mochi, kucing oren belang yang tinggal di kantor. Dia jalan sendiri lewat lantai, nggak nembus furnitur, dan punya kegiatan sendiri:

| Di mana | Ngapain |
|---|---|
| Beanbag di lounge | Tidur melingkar. Siang sesekali, malam hampir terus, dan dia tetap di kantor walaupun semua udah pulang. Selama Mochi di situ, nggak ada yang duduk di beanbag |
| Depan akuarium | Duduk ngelihatin ikan, kepalanya ngikutin ikan, ujung ekornya kedut-kedut |
| Lantai di bawah jendela | Rebahan kayak roti (kaki dilipat) pas jam 09.00 sampai 15.00 |
| Depan kulkas | Minta makan sambil ngeong, duduk tegak, dongak, dan nepuk-nepuk pintu kulkas, apalagi kalau ada yang lagi ngemil |
| Karpet lounge | Jilat-jilat bulu: kaki depan kanan naik ke pipi kayak cuci muka |
| Karpet pojok kolaborasi, deket bangku game, keset pintu | Duduk atau rebahan |
| Di samping kursi anggota yang lagi di meja | Mampir, duduk, dan ngelihatin orangnya |
| Di atas keyboard anggota yang lagi di meja | Naik lewat sayap L mejanya, terus tidur di keyboard. Selama itu anggotanya nggak bisa ngetik. Abis beberapa detik anggotanya ngangkat Mochi pakai dua tangan, bilang semacam "Mochi, aku lagi kerja...", terus naruh dia di lantai sebelah kursi. Cuma ke meja yang ada sayap L-nya |
| Mangkok makanan di lantai, di celah antara ujung bar dan meja Kobayashi (nempel dinding belakang, nggak ngalangin jalan) | Makin siang makin lapar. Kalau mangkoknya ada isi, Mochi makan (sekali makan habis sepertiga). Kalau kosong, dia duduk di sebelah mangkok sambil ngeong. Anggota yang lagi ngemil di kulkas ngisi mangkok yang kosong |
| Samping meja pingpong | Pas ada yang main, Mochi duduk di pinggir meja dan kepalanya ngikutin bola kiri-kanan |

Anggota yang lewat deket Mochi kadang nyapa ("Halo, Mochi.", "Pus, pus."), terus Mochi noleh dan bales ngeong. Di mode Alyx, kalau mangkoknya belum penuh, arahin titik tengah ke mangkok buat **E Isi mangkok Mochi**. Arahin ke Mochi sampai muncul **E Elus Mochi**: Alyx ngelus dia, Mochi diem, merem, noleh ke Alyx, dan ngedengkur ("Prrr...").

**Ritual harian** (jam Jakarta, sama kayak jam dinding). Cuma cast yang lagi nganggur yang ikut. Yang lagi dijalanin Claude Code tetap kerja.

| Jam | Ritual |
|---|---|
| 09:30 sampai 09:36 | Standup di pojok kolaborasi. Arisu berdiri di samping glass board, yang lain melingkar di sekitar meja tinggi. Arisu buka, tiap orang gantian bilang apa yang udah beres dan apa yang dikerjain hari ini, Arisu nutup, terus sisanya ngobrol pelan sampai bubar |
| 12:00 sampai 13:00 | Makan siang bareng di meja meeting. Tiap orang dapet kursi sendiri, kotak bekal muncul di depannya, makan pakai sumpit, dan yang duduk berhadapan ngobrol. Sekali sehari per orang |
| Mulai 19:00 | Pulang satu-satu lewat pintu masuk, selang 5 menit. Ruby duluan, 2B paling akhir jam 19:55. Lampu meja yang orangnya udah pulang mati, dan lampu ruangan makin redup makin sepi kantornya |
| Mulai 07:30 | Dateng lagi lewat pintu, selang 4 menit, 2B paling pagi |

Kalau ada tugas masuk buat cast yang lagi di rumah, dia masuk lewat pintu dan langsung ke mejanya. Istirahat biasa (duduk di meja, nonton TV, dan sejenisnya) dipotong pas ritual mulai. Yang lagi bawa gelas atau laptop, atau lagi main pingpong, nyelesaiin itu dulu. Mau lihat tanpa nunggu jamnya? Buka `/office/?clock=09:30`, `?clock=12:00`, atau `?clock=21:00` di versi web.

**Pas nggak ada tugas**, tiap cast milih kegiatan sendiri dan jalan ke sana tanpa nembus furnitur atau cast lain: kerja santai di meja, bikin kopi, ngemil di kulkas, cuci tangan di wastafel, manasin makanan di oven, nonton TV, main game di sofa, main arcade, lari di treadmill, ninju samsak, ngelihatin ikan di akuarium, ngobrol di meja tinggi pojok kolaborasi, nyiram tanaman, rebahan di beanbag, baca, ngobrol di meja bar, meeting di meja tengah, atau main pingpong. Sebagian besar waktunya di meja: satu sesi di meja 2,5 sampai 5 menit dan bisa langsung disambung sesi berikutnya, jadi tiap orang rata-rata ninggalin meja sekitar 8 kali per jam. Abis istirahat, kemungkinan besar dia balik lagi ke meja. Biar nggak monoton:
- Kegiatan yang sama nggak dipilih dua kali berturut-turut, dan tiap kegiatan punya jeda sebelum bisa diulang.
- Tiap cast punya kesukaan sendiri. Kobayashi sering main arcade, Erza sering ngemil dan ninju samsak, Rias sering baca, Yor sering ngecek rak server dan latihan di samsak, Asuna dan 2B suka treadmill, Huagua sering ngelihatin akuarium, Ruby sering selfie di depan ring light. Treadmill lebih sering dipakai pagi, samsak dan treadmill juga rame sore.
- Pas lari, belt treadmill ikut jalan dan layarnya nyala. Pas ninju, samsaknya keayun mundur tiap pukulan kena.
- Satu tempat cuma dipakai satu orang. Kalau ada yang udah di bar atau meja meeting, yang lain lebih mungkin nyamperin.
- Pingpong selalu berdua. Yang mulai ngajak cast yang paling lama nganggur, dan nunggu di meja sambil pegang raket sampai lawannya dateng. Bolanya baru jalan pas dua-duanya udah di posisi, dan kalau satu pergi, yang lain ikut berhenti. Raket diayun pas bolanya nyampe ke pemain itu, bukan sebelum.
- Meja meeting kosong dari laptop. Yang mau meeting ambil laptopnya dulu di meja masing masing: yang punya laptop di meja (Ruby, Rias, Chizuru) nutup laptopnya terus bawa laptop itu, yang lain buka laci di bawah meja dan ngambil laptop dari situ. Di meja meeting laptopnya ditaruh, dibuka, terus dinyalain. Sebelum pergi laptopnya dimatiin, ditutup, dibawa balik, dan disimpan lagi ke laci atau ditaruh lagi di meja. Kalau di tengah jalan dipanggil kerja, laptopnya langsung balik ke tempatnya.
- Pintu kulkas kebuka pas ada yang ngemil, terus ketutup lagi pas dia pergi.
- Keran wastafel ngalir selama ada yang cuci tangan.
- Oven dipakai berurutan: pintunya dibuka sambil jongkok buat masukin piring, ditutup, lalu jendelanya nyala oranye selama masak. Abis itu dibuka lagi buat ngambil piringnya, dan piringnya dibawa.
- Di tiap sisi meja bar ada dua bar stool yang agak serong saling hadap, jadi yang duduk di situ bisa ngobrol tanpa muter badan. Gelas di meja bar dan meja meeting udah nggak ada, semua gelas punya masing masing cast.
- Di ujung meja bar ada makanan buat bareng: pizza (8 potong), mix platter (6), donat (6), atau sushi (8). Cast yang lagi istirahat kadang ambil satu potong terus makan sambil berdiri di situ, lebih sering pas jam makan siang. Yang ngambil potongan terakhir bawa kotak kosongnya ke tempat sampah.
- Setelah kotaknya dibuang, 3 sampai 10 menit kemudian (acak) ada satu cast yang keluar lewat pintu masuk, hilang sebentar, terus balik bawa kantong belanja dan naruh makanan baru di meja bar. Jenisnya nggak pernah sama dua kali berturut turut. Pintu kacanya geser kebuka sendiri pas ada yang deket, terus nutup lagi. Pas kantor dibuka, kadang udah ada makanan yang tinggal setengah, kadang belum ada dan sebentar lagi ada yang beli. Kalau cast dipanggil kerja di tengah jalan, kotak yang harus dibuang langsung kebuang dan makanan yang lagi dibawa langsung ada di meja bar.
- Tiap cast punya gelas sendiri dengan warna sendiri (Rias pakai cangkir teh). Isinya berkurang tiap kali diseruput, dan cast nggak bikin kopi baru selama gelasnya masih ada isinya.
- Kalau gelasnya udah kosong, cast milih: refill, yaitu bawa gelasnya ke mesin kopi, bikin baru, terus balik naruh di meja, atau bawa gelasnya ke wastafel, nyuci, terus naruh di rak pengering. Gelas yang lagi di rak nggak ada di meja. Kopi berikutnya diawali ambil gelas dari rak dulu, baru ke mesin kopi.
- Barang di tangan ngikutin kegiatan: HP pas rebahan atau selfie, buku pas baca, stik pas main game, raket pas pingpong, penyiram pas nyiram tanaman.
- Abis kelar tugas, cast istirahat dulu, nggak langsung balik ke meja.
- Jalannya nggak kaku: pinggul dan dada muter berlawanan, siku nekuk pas tangan ke depan, kaki napak dari tumit ke ujung, dan kepala tetap stabil. Tiap cast juga jalannya beda: Chizuru dan Ruby melompat lompat, Rias melenggang pelan, Erza kayak baris berbaris, Kobayashi agak bungkuk. Di jalan kadang nengok kiri kanan, ngecek HP, atau peregangan sebentar (HP dan peregangan nggak dilakuin kalau lagi bawa gelas).
- Kalau papasan sama teman yang lagi nggak kerja, mereka saling sapa: yang jalan melambai, dan dua duanya nyapa lewat balon kecil di atas kepala. Orang yang sama nggak nyapa terus terusan.
- Dua orang di meja bar, atau satu di mesin kopi dan satu di kulkas, ngobrol santai. Kalimatnya muncul di balon di atas kepala, gantian, ditulis per karakter dan per topik (kerjaan, makanan, santai, kantor). Yang dengerin ngangguk, atau ketawa kalau kalimatnya lucu. Obrolan ini cuma naskah, nggak pakai Claude, dan bukan isi kerjaan asli. Sebelum ngobrol mereka saling tatap dulu: yang mulai noleh duluan, yang satunya sadar terus noleh balik, lalu dua-duanya ngangguk kecil sambil senyum, baru kalimat pertama keluar. Di meja bar, tiap kalimat punya gestur sendiri sesuai topiknya, misalnya jelasin pakai tangan, nunjuk, ngitung pakai jari, megang dagu, angkat bahu, tangan di pinggang, nangkupin tangan, atau ngibasin tangan. Yang dengerin juga ganti-ganti posisi: santai, nyilangin tangan, miringin kepala, megang dagu, atau nutup mulut pas ketawa. Di sela kalimat badan mereka mindahin tumpuan pelan-pelan.
- Begitu dipanggil Claude Code, cast langsung ninggalin kegiatannya dan jalan ke mejanya.

Kursi, stool, dan beanbag nggak bisa dilewatin. Kursi kerja dan kursi meeting dimasukin dari samping, sofa dari depan lewat jalur antara sofa dan meja kopi, jadi nggak ada yang nembus sandaran. Yang duduk keluar lewat jalur yang sama waktu masuk, dan kursi yang baru ditinggal baru bisa dipakai orang lain setelah yang lama beneran pergi. Cast juga nggak saling tembus: yang lagi diam dihindari kayak furnitur, kalau papasan keduanya minggir ke kanan, dan kalau jalannya sempit salah satu nunggu atau minggir sebentar buat ngasih jalan.

TV nyala sendiri pas ada yang nonton atau main game, layar arcade makin rame pas dimainin, dan lampu rak server kedip cepat pas Yor ngecek.

Pose duduk diukur dari panjang kaki tiap model. Di kursi rendah lututnya naik dan telapak kakinya napak, di stool tinggi kakinya menggantung. Sandaran kursi dan sofa dibikin rendah, terus ujung atasnya, sandaran sofa, dudukan stool, punggung beanbag, dan lantai jadi penghalang buat physics rambut, jadi rambut panjang jatuh ke balik sandaran, bukan nembus. Langkah jalannya pendek dengan goyang pinggul kecil, biar rok dan dress panjang (misalnya dress hitam Yor) tetap jatuh natural.

**Grafis**: dengan **Menu > Grafis kantor tinggi** (default nyala), furnitur pakai sudut membulat, tekstur permukaan (serat kayu, anyaman kain, logam, plester dinding, dan alur papan lantai), dan ambient occlusion yang bikin sudut serta kolong meja lebih gelap. Bayangan lembut di bawah furnitur dan di pertemuan dinding dan lantai tetap ada di dua mode. Kalau laptop lo ngos ngosan, hapus centangnya: kantor dimuat ulang dengan grafis ringan. Di mode browser, tambahin `?quality=low` di URL kantor.

**Jam kantor** selalu pakai zona Asia/Jakarta, apa pun setelan jam PC. Jam digital di dinding pantry, siang dan malam, obrolan, dan kegiatan semuanya ngikutin jam yang sama.

**Siang dan malam**: mulai sekitar 17.30 cahaya matahari pelan pelan hilang sampai malam penuh jam 19.00, dan pagi kebalikannya antara 05.00 dan 06.30. Di tengah tengah transisi itu langit di jendela jadi oranye senja, terus berubah jadi pemandangan kota malam. Malam hari lampu kantor tetap nyala, jadi ruangan tetap terang, ditambah LED neon dan lampu meja di tiap meja kerja yang nyala pas mulai gelap. Lampu mejanya beda beda sesuai orangnya: lampu arsitek hitam buat 2B, lampu jamur peach berbintik buat Chizuru, lampu kuningan dengan kap merah tua buat Rias, lampu LED bar dengan tiang oranye buat Asuna, lampu leher angsa hijau buat Kobayashi, lampu lonceng merah gelap buat Yor, lentera baja dengan pita merah buat Erza, bola kaca pink buat Ruby, lampu putih rapi buat Arisu, light bar di tiang hitam buat Komachi, kubah kaca ungu buat Miruku, dan lampu kayu dengan kap hijau buat Huagua. Di mode browser, tambahin `?clock=21:30` di URL kantor buat lihat jam lain tanpa nunggu malam.

**Ikut jam juga**: sapaan dan obrolan disesuaikan sama waktu, jadi nggak ada "pagi" pas malam dan kalimat yang nyebut waktu tertentu (misalnya "makan siang") cuma keluar di jamnya. Kegiatan juga beda per waktu: pagi lebih sering ngopi, siang lebih sering makan di oven, kulkas, atau meja bar, sore lebih banyak santai dan main, malam lebih banyak nonton atau baca.

**Musik**: tombol **Musik** di kanan bawah kantor ngebuka panel musik. Isinya dua lagu bawaan, dan lo bisa nambah link YouTube sendiri (link watch, youtu.be, shorts, atau live), muter lagu tertentu, pindah ke lagu berikutnya, atau ngapus lagu dari daftar. Judul lagunya diambil dari YouTube, dan kalau nggak bisa diambil (misalnya lagi offline) yang tampil ID videonya. **Jeda** nge-pause lagu tanpa balik ke awal, **Lanjutin** nerusin dari situ. Tombol **Ulang** muter tiga mode: **lagu ini** (lagu yang sama diulang terus, ini bawaannya), **semua** (abis satu lagu lanjut ke lagu berikutnya, terus balik ke lagu pertama), dan **mati** (berhenti setelah lagu terakhir). Mode ulangnya ikut disimpan.

- Yang keluar cuma suaranya. Player YouTube-nya tetap jalan tapi disembunyiin. Aturan embed YouTube sebenarnya minta player-nya keliatan, jadi suatu saat YouTube bisa aja nolak cara ini. Kalau itu kejadian, musiknya berhenti bunyi.
- Nutup panel (tombol **Tutup** atau Escape) nggak matiin musik. Selama musik jalan, tombolnya bertulisan **Musik nyala**. Musik cuma berhenti kalau lo pencet **Matiin** atau kantornya ditutup.
- Slider **Volume** ngatur keras pelannya musik, dari 0 sampai 100 (awalnya 60). Bisa digeser pakai mouse atau tombol panah.
- Daftar lagu, lagu terakhir, volume, dan status nyala atau matinya disimpan. Kalau kantor ditutup pas musik nyala, musiknya nyala lagi pas kantor dibuka. Musik nggak pernah mulai sendiri sebelum lo pencet **Putar** pertama kali.
- Kalau pemilik video matiin fitur embed, YouTube nolak muter lagu itu. Panelnya bilang lagunya nggak bisa diputer di luar YouTube, terus lompat ke lagu berikutnya.

**Kamera**: drag buat muter, scroll buat zoom, klik dua kali buat balik ke tampilan awal. Pakai keyboard: Tab ke ruangan, panah buat muter, `+` dan `-` buat zoom, `0` buat reset. Kalau lama nggak disentuh, kameranya goyang pelan sendiri.

Isi layar, papan tulis, dan sticky note semuanya **simulasi**, bukan kerjaan asli lo. Jadi aman pas lagi share screen.

Pas ada yang kerja, panel **close-up** muncul sendiri di kiri, nempel di atas panel chat dengan lebar yang sama (kalau chat ditutup, dia pindah ke kiri bawah), dan nampilin layar atau papan anggota yang terakhir aktif, lengkap dengan nama tool yang lagi dipakai. Keterangannya pakai bahasa Inggris, contohnya `Ruby · Content + Portfolio · typing (Bash) · simulated screen`, sama kayak judul window (AlyxLabs Office, AlyxLabs Team). Setelah semua selesai, panelnya nunggu beberapa detik biar momen selesainya kelihatan, lalu hilang sendiri. Buat matiin sama sekali (misalnya pas share screen), hapus centang **Menu > Close-up kantor pas ada yang kerja**. Di mode browser, setting-nya ada di dialog **Model**.

**Gimmick pas kerja di meja**: selama anggota duduk ngetik di mejanya sendiri:

| Gimmick | Isinya |
|---|---|
| Panel di layar | Pojok kanan bawah monitor utama nampilin panel kecil yang gerak sesuai role: grafik naik (Asuna), test berubah hijau (Kobayashi, Komachi), tahap deploy nyala satu-satu (Yor), checklist kecentang (Erza), bentuk muncul di kanvas desain (Huagua), radar scan (Miruku), kartu tugas pindah kolom (yang lain). Isinya bentuk aja, tanpa angka |
| Gestur | Tiap 9 sampai 16 detik nyelipin satu gerakan, nggak sama dua kali berturut-turut: megang dagu mikir, condong ke layar, nengok monitor samping, atau stretching. Yang butuh tangan bikin ngetiknya berhenti sebentar |
| Ikon di atas kepala | Selama ada kerjaan beneran dari Claude Code: ikon tool yang lagi dipakai (`</>` edit, `>_` terminal, kaca pembesar buat cari, dokumen buat baca, globe buat web, dua orang buat delegasi, checklist buat rencana, titik tiga kalau belum ada tool) di dalem cincin ungu yang muter. Pas selesai jadi centang hijau yang ngembang |
| Efek di meja | Tiap 10 sampai 20 ketikan, potongan kode kecil (`{ }`, `</>`, `;`, `=>`) naik dari keyboard terus pudar. Pas kerjaan selesai ada percikan cahaya di atas meja, anggotanya ngepalin tangan dua kali, baru lanjut stretching atau sorak kayak biasa |

Kalau 2B ngerjain tugas sendiri tanpa delegasi ke tim, dia tetap ngomong singkat di kotak obrolan: pas mulai, pas pakai tool (paling sering sekali tiap 8 detik), dan pas selesai.

Obrolan tim yang sama dengan overlay tim juga tampil di kantor, di pojok kanan atas bareng potret yang ngomong.

Menu-nya bisa dibuka dari tombol **Pengaturan** di baris tombol kanan bawah kantor, dari tombol **Menu** di 2B, atau klik kanan 2B atau overlay tim.

Tombol **Sembunyiin 2B** dan **Tampilin 2B** di kanan bawah kantor buat nyembunyiin atau nampilin 2B di desktop tanpa nutup aplikasinya. Bisa juga lewat **Menu > Tampilkan 2B di desktop**. Kalau 2B lagi disembunyiin dan kantor ketutup, jalanin `npm start` lagi buat munculin dia.

## Chat ke 2B dari kantor

Lo bisa ngasih tugas langsung dari kantor tanpa buka terminal. Panel **Chat ke 2B** ada di kiri bawah.

1. Klik **Pilih folder**, terus pilih folder project lo. 2B cuma kerja di folder itu.
2. Ketik tugasnya, tekan Enter (Shift+Enter buat baris baru).
3. Balasan 2B muncul sambil diketik. Tiap tool yang dipakai muncul sebagai baris kecil, misalnya `Bash: npm test`.
4. Kalau 2B butuh izin, muncul **kartu hijau** isinya nama tool dan command lengkapnya. Klik **Izinkan** atau **Tolak**. Pakai keyboard: kartunya langsung dapat fokus, Tab sekali ke Izinkan, dua kali ke Tolak.
5. **Stop** ngehentiin kerjaan yang lagi jalan. Anggota tim yang lagi dikerjain ikut berhenti, close-up nutup, dan baru muncul lagi pas ada tugas baru. **Chat baru** mulai obrolan dari nol di folder yang sama.
6. **Sesi** ngebuka daftar sesi Claude Code yang tersimpan di komputer ini buat folder chat, paling baru di atas. Judulnya dari prompt pertama sesi itu. Pilih satu, potongan terakhir obrolannya muncul di chat, dan pesan berikutnya nerusin sesi itu (`claude --resume`).
   - Yang muncul cuma sesi lokal, dari `%USERPROFILE%\.claude\projects\<folder>` (atau `CLAUDE_CONFIG_DIR` kalau lo set). Sesi cloud (claude.ai/code) nggak ada di situ.
   - Jangan pilih sesi yang masih kebuka di Claude desktop atau terminal. Dua proses yang nulis ke sesi yang sama bikin riwayatnya kacau.

Tombol **Tutup chat** dan **Buka chat** di kanan bawah buat nyembunyiin atau nampilin panelnya. Bisa juga lewat **Menu > Chat ke Claude di kantor**.

Cara kerjanya:
- Tiap pesan ngejalanin `claude -p` (Claude Code yang sudah ke-install di PC lo) di folder yang dipilih, lalu nyambung obrolan sebelumnya lewat `--resume`. Jadi pakai **login dan kuota Claude Code lo sendiri**, nggak ada API key atau tagihan terpisah.
- Mode izinnya dikunci ke `default`, jadi tiap tool yang biasanya nanya izin di terminal bakal muncul sebagai kartu. Allow rules di `settings.json` lo tetap berlaku, jadi command yang sudah lo izinkan permanen nggak nanya lagi.
- Kartu izin dikirim lewat hook `PermissionRequest` khusus sesi ini, ke server lokal companion, pakai token acak yang baru tiap companion jalan. Session Claude Code di terminal nggak kena hook ini.
- Hooks lo yang biasa tetap jalan, jadi 2B dan tim di kantor tetap gerak sesuai kerjaan.
- Kalau kantor ditutup, chat dimatiin, atau 2B nunggu izin lebih dari 10 menit, permintaan izin otomatis ditolak.

Batasannya:
- Cuma ada di aplikasi Electron (`npm start`). Mode browser nggak punya chat, soalnya chat ini ngejalanin Claude Code di PC lo, dan itu nggak aman dibuka lewat halaman web.
- Mode `-p` nggak nampilin dialog trust folder. Hooks dan `.mcp.json` di folder yang lo pilih langsung jalan, jadi **pilih folder project lo sendiri aja**, jangan folder hasil download orang.

## Sesi 2B (ngobrol sama 2B, tanpa Claude)

Ketik **@2B** di chat kantor (2B ada paling atas di daftar @), lalu pesan lo. Chat masuk ke **Sesi 2B**: judulnya berubah, ada label **Tanpa Claude**, dan obrolannya pisah dari chat Claude. Selama Sesi 2B, nggak ada pesan yang lewat Claude Code, jadi kuota Claude lo nggak kepakai sama sekali. Klik **Akhiri sesi 2B** buat balik ke Claude, obrolannya langsung dihapus dan ada catatan "Pesan berikutnya ke Claude."

- **Curhat atau ngobrol**: dibales 2B lewat API Groq pakai key lo sendiri. Isi pesannya dikirim ke Groq, tapi nggak disimpan di disk dan hilang pas sesi diakhiri atau kantor ditutup. Ekspresi dan pose 2B di desktop ngikutin balasannya, dan kalimat pertamanya muncul di gelembung samping dia.
- **Pose**: pesan yang isinya cuma nama pose diproses langsung tanpa Groq: angkat tangan, merenung, dadah, peace, jempol, silang tangan, tepuk tangan, garuk kepala, ngulet, melet. Ekspresi juga bisa: senyum, cemberut, kaget, sedih, marah, ngantuk. Kata kayak "coba", "dong", atau "ya" boleh ikut ("coba melet dong").
- **Melet**: kalau model lo punya ekspresi atau morph lidah, itu yang dipakai. Kalau nggak ada, lidah kecil ditempel di mulut yang dicari dari bentuk mulut "A" model VRoid, jadi di model non-VRoid posisinya bisa meleset.
- **API key Groq**: diminta pas pertama kali mulai Sesi 2B, atau lewat **Menu > Groq API key (Sesi 2B)**. Key disimpan terenkripsi pakai penyimpanan aman sistem (DPAPI di Windows) di folder data aplikasi, nggak pernah masuk repo atau log. Bisa juga set variabel `GROQ_API_KEY` sebelum `npm start`.
- **Model**: default `openai/gpt-oss-120b`. Tombol **Model** nampilin model chat yang tersedia di akun Groq lo, jadi model yang udah dipensiunin nggak muncul.
- **Batas gratis**: kalau kena batas pemakaian gratis Groq, 2B bilang terus terang dan nyebut kapan bisa coba lagi kalau Groq ngasih tahu.
- **Tanda krisis**: kalau pesan lo nyebut pengen nyakitin diri atau bunuh diri, chat nampilin kartu bantuan dari aplikasi sendiri (bukan dari model): layanan kesehatan jiwa Kemenkes **119 ekstensi 8** (Healing119.id), atau orang yang lo percaya, dan **112** kalau dalam bahaya. 2B bukan psikolog dan nggak ngasih diagnosis.

## Kebutuhan

- Windows 10 atau 11.
- [Node.js](https://nodejs.org) versi 22 atau lebih baru.
- [Git](https://git-scm.com).
- Claude Code yang jalan **di PC lo** (CLI atau desktop app). Hooks dijalanin di mesin tempat Claude Code jalan, jadi session Claude Code di cloud (claude.ai/code) nggak bisa ngirim event ke PC lo.

## Install dan jalanin

Buka PowerShell:

```powershell
git clone https://github.com/AliveNata/waifu.git
cd waifu
git checkout claude/3d-waifu-modeling-rigging-pkwpy7
cd companion
npm ci
npm run fetch-base-model
npm start
```

`npm ci` ikut download Electron (sekitar 100 MB), jadi yang pertama agak lama.

Pertama kali jalan, overlay nampilin 2B versi model cadangan (rambut putih). Begitu lo punya `.vrm` aslinya, simpan jadi `models/2b.vrm` di root repo, lalu restart companion. Anggota lain sama, pakai nama masing-masing (`ruby.vrm`, `erza.vrm`, dst). Bisa juga dipilih lewat **Menu > Pilih model .vrm > 2B**. Path dari menu disimpan dan menang atas file di `models/`.

Menu ada di tombol **Menu** di pojok kanan bawah 2B (samar, jadi jelas pas di-hover atau difokus pakai Tab). **Klik kanan di 2B** juga ngebuka menu yang sama. Isinya:

- **Pilih model .vrm** dengan submenu per anggota tim. Model yang dipasang dipakai di semua tempat anggota itu muncul. Yang belum punya pakai model cadangan. Cara nyari model ada di [05-cari-model.md](05-cari-model.md).
- **Buka kantor / Tutup kantor**. Kantor kebuka sendiri pas `npm start` kalau terakhir kali dia masih kebuka.
- **Overlay selalu di atas** buat on/off always-on-top (berlaku buat dua overlay).
- **Tampilkan isi percakapan asli** buat nyalain atau matiin isi asli di overlay tim.
- **Keluar**.

Overlay bisa digeser dengan drag di area mana aja selain tombol.

## Sambungin ke Claude Code

1. Di folder `companion`, cek dulu apa yang bakal berubah:
   ```powershell
   npm run hooks:install -- --dry-run
   ```
   Perintah ini nampilin isi `%USERPROFILE%\.claude\settings.json` setelah diubah, tanpa nulis apa-apa.
2. Kalau udah oke, pasang:
   ```powershell
   npm run hooks:install
   ```
   Yang dilakuin installer:
   - File lama di-backup dulu jadi `settings.json.bak-<waktu>`.
   - Setting dan hook lo yang lain nggak disentuh. Yang diganti cuma entry `send-hook-event.js` punya companion, termasuk yang path-nya udah basi karena folder repo pindah.
   - Aman dijalanin ulang. Kalau udah kepasang, hasilnya `unchanged` dan nggak ada yang ditulis.
   - Kalau `settings.json` lo bukan JSON valid, installer berhenti tanpa ngubah apa-apa.
3. Restart Claude Code. Cek pakai command `/hooks`, harusnya ada entry `send-hook-event.js` di tiap event.

Mau masang manual? `npm run build`, lalu `npm run hooks:print` buat nge-print blok `hooks`, terus gabungin sendiri ke `settings.json`.

Buat nyopot hooks companion aja (hook lain tetap aman):
```powershell
npm run hooks:install -- --uninstall
```

Hook-nya jalan dengan `"async": true`, jadi Claude Code nggak nungguin companion. Kalau companion lagi ditutup, hook cuma nulis satu baris log ke stderr dan exit 0. Kerjaan lo di Claude Code nggak keganggu.

## Data apa yang dikirim

Bridge cuma nerusin field ini ke `127.0.0.1`: nama event, nama tool (misalnya `Bash`), pesan notifikasi, ID dan nama subagent, judul tugas pendek dari 2B (maksimal 120 karakter), dan awal laporan akhir subagent (maksimal 1200 karakter, baris barunya dipertahanin biar bisa dipecah per kalimat). Dua yang terakhir cuma ditampilin kalau **isi asli** dinyalain. Isi file, command, prompt lo, prompt lengkap ke subagent, dan path transcript dibuang di bridge sebelum dikirim. Server companion cuma dengerin di localhost dan nolak request yang bukan `application/json`, jadi website random di browser nggak bisa nembak endpoint-nya.

## Ganti port

Default port `47823`. Kalau bentrok, set environment variable `WAIFU_COMPANION_PORT` dengan nilai yang sama di dua tempat: buat companion, dan buat Claude Code (karena hook ikut baca variable itu).

```powershell
setx WAIFU_COMPANION_PORT 48123
```

Buka terminal baru setelah `setx` biar nilainya kebaca.

## Mode browser (tanpa Electron)

Buat ngetes atau kalau nggak mau window transparan:

```powershell
$env:WAIFU_MODEL_PATH = "C:\path\ke\twob-vrm1.vrm"
$env:WAIFU_MODEL_PATH_ASUNA = "C:\path\ke\asuna.vrm"
npm run web
```

`WAIFU_MODEL_PATH` buat 2B, `WAIFU_MODEL_PATH_<NAMA>` buat anggota lain (`CHIZURU`, `RIAS`, `ASUNA`, `KOBAYASHI`, `YOR`, `ERZA`, `RUBY`, `ARISU`, `KOMACHI`, `MIRUKU`, `HUAGUA`). Semuanya opsional. Model juga bisa dipilih lewat tombol **Model** di halaman kantor.

Lalu buka `http://127.0.0.1:47823/overlay/`, `http://127.0.0.1:47823/team-overlay/`, dan `http://127.0.0.1:47823/office/`. Hooks tetap nyambung lewat port yang sama.

## Troubleshooting

| Gejala | Penyebab yang mungkin | Cek |
|---|---|---|
| Chip merah "Port ... sudah dipakai" | Ada aplikasi lain di port itu, atau companion kebuka dua kali lewat mode browser | Tutup yang lain, atau ganti port |
| 2B makin gede tiap digeser (versi lama) | Bug Electron di Windows dengan scaling layar selain 100%: `setPosition` ikut ngubah ukuran window | Udah dibenerin, ukurannya dikunci. Geser 2B sekali, ukurannya balik normal |
| 2B nggak bereaksi | Hooks belum kepasang, atau path di `settings.json` salah | `/hooks` di Claude Code, lalu jalanin command hook-nya manual di PowerShell |
| "Model gagal dimuat" | File bukan VRM, atau export-nya rusak | Export ulang dari VRoid, atau cek pakai `npm run inspect-vrm` |
| Anggota tim nggak gerak pas dipanggil | Agent belum di-install, atau hooks belum ada `SubagentStart` | `npm run team:install`, lalu `npm run hooks:install` |
| Pose aneh (tangan nembus badan, duduk melayang) | Proporsi model beda jauh dari default VRoid | Kasih tau gua, angka pose bisa diatur |
| Kantor masih kotak-kotak, ada chip "Model anime belum ada" | Model cadangan belum didownload | `npm run fetch-base-model`, lalu buka ulang companion |
| Overlay tim nggak pernah muncul | Nggak ada subagent yang dipanggil, atau hooks lama tanpa `SubagentStart` | Minta 2B delegasi, atau jalanin `npm run hooks:install` |
| Chat bilang "Claude Code nggak ketemu" | `claude` nggak ada di PATH | Jalanin `claude --version` di PowerShell. Kalau install-nya di tempat lain, set `WAIFU_CLAUDE_COMMAND` ke path lengkap `claude.exe` |
| Chat bilang "belum login" | Claude Code belum pernah login di PC ini | Jalanin `claude` sekali di terminal dan login |
| Semua izin langsung ditolak tanpa kartu | `allowedHttpHookUrls` di settings lo nggak masukin server companion | Tambahin `http://127.0.0.1:47823/*` (atau port lo) ke daftar itu |

## Buat developer

```powershell
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

Set `WAIFU_SAMPLE_VRM` ke path file `.vrm` kalau mau e2e ikut ngetes load model beneran. Tanpa itu, test tersebut di-skip.
