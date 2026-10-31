# 03. Desktop companion: overlay, overlay tim, dan kantor AlyxLabs

Companion ini nampilin 2B dan timnya di tiga tempat:

- **Overlay 2B**: close-up 3D transparan di pojok kanan bawah layar, selalu di atas window lain. Kepala dan matanya ngikutin cursor lo.
- **Overlay tim**: close-up transparan di pojok kanan atas. Muncul cuma pas ada yang ngomong: 2B ngoper tugas, atau anggota tim mulai kerja, pakai tool, dan selesai. Ada gerak mulut, ekspresi, gesture, dan kotak dialog.
- **AlyxLabs Office** (kantor): window terpisah berisi kantor 3D dengan 2B dan tujuh anggota tim versi chibi (lihat [04-tim.md](04-tim.md)). Tiap anggota punya meja sesuai role-nya, mulai kerja pas subagent-nya dipanggil, dan pas lagi nggak ada tugas mereka istirahat dengan kegiatan masing-masing.

Ketiganya bereaksi ke event yang sama dari hooks Claude Code.

## Model karakter

Urutan model yang dipakai buat tiap anggota:
1. `.vrm` asli yang lo pasang lewat **Menu > Pilih model .vrm**.
2. Kalau belum ada: **model anime cadangan**, yaitu sample resmi VRM 1.0 yang diwarnai ulang pakai warna rambut, mata, dan baju tiap karakter, plus kacamata buat Kobayashi. Wajah dan model rambutnya sama buat semua anggota.
3. Kalau model cadangan belum didownload: chibi kotak-kotak di kantor, dan tulisan "Belum ada model" di overlay 2B.

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

Model tangannya "Free Pack - VR Hands (Rigged)" karya [PolyOne Studio](https://sketchfab.com/polyone), dari [Sketchfab](https://sketchfab.com/3d-models/free-pack-vr-hands-rigged-b3b8309e59c748e3956531c8f57dd233), lisensi [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/). Yang dipakai cuma tangan kanannya, dikemas jadi satu file GLB dengan tekstur yang dikecilin ke 1024 piksel.

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

Ruangannya terang dengan aksen ungu dari logo AlyxLabs: LED neon yang "lari" di atas dinding dan di sepanjang lis bawah, lampu di bawah meja, dan papan nama di dinding belakang. Semua furnitur diukur pakai tinggi chibi (sekitar 1,05 m), jadi meja setinggi pinggang, monitor sejajar mata pas duduk, dan papan tulis masih kejangkau tangan. Zonanya:

| Zona | Isi |
|---|---|
| Deretan meja belakang | Meja Asuna, Kobayashi, Erza, dan Yor, lemari printer, plus rak server di sebelah Yor |
| Tengah | Meja meeting enam kursi, meja pingpong |
| Depan | Meja komando 2B dengan papan kanban dan printer di samping, pojok konten Ruby dengan backdrop logo, ring light, kamera, dan mic, plus meja Rias dan Chizuru di sebelah kanan 2B |
| Dinding kiri | Papan tulis (2B dan Rias) dan papan ide Chizuru, masing masing dengan panggung rendah di depannya, beanbag, TV lounge |
| Lounge | Sofa menghadap TV, meja kopi, beanbag |
| Pantry | Jam digital besar di dinding (zona Asia/Jakarta). Counter bentuk L: wastafel dengan rak pengering gelas di sampingnya, mesin kopi, dan oven di counter belakang, lalu meja bar yang nyambung ke ujungnya dengan dua bar stool di tiap sisi, plus kulkas dan tempat sampah yang mepet dinding di samping kulkas. Makanan bareng ditaruh di ujung meja bar |
| Sayap timur | Pod empat meja yang saling hadap: Arisu dan Komachi di sisi utara menghadap ruangan, Miruku dan Huagua di sisi selatan dengan layar menghadap ruangan. Satu jendela lagi di dinding belakang |
| Sisi kanan | Pintu kaca otomatis di ujung sayap timur, buat yang keluar beli makanan. Pas ketutup tulisannya kebaca AlyxLabs, pas kebuka kepisah jadi Alyx dan Labs |
| Pojok game | Mesin arcade |

Setup meja sesuai role:

| Anggota | Setup | Pas kerja |
|---|---|---|
| Asuna | Monitor SQL, DAG pipeline, monitor vertikal job run, bebek karet, PC tower | Ngetik SQL, teks muncul per karakter, jarinya mencet tuts yang sesuai dan tuts itu nyala |
| Kobayashi | Monitor ultrawide, monitor vertikal daftar PR, konsol handheld di dock, boneka naga, PC tower | Ngetik kode aplikasi |
| Erza | Monitor diff horizontal, checklist review di monitor vertikal, kue stroberi, PC tower | Ngetik catatan review |
| Yor | Terminal dan monitoring, stand headset, mawar, PC tower | Ngetik command read-only |
| 2B | Dua monitor dan kanban tim, planner kertas, PC tower | Ngetik plan, atau nulis di papan tulis pas mikir |
| Ruby | Laptop, mic, ring light | Ngetik draft post |
| Rias | Papan tulis, plus meja sendiri: laptop, papan catur, cangkir teh di atas tatakan, tumpukan buku, gulungan blueprint | Gambar diagram, tangannya ngikutin ujung spidol, kepala dan badannya ngikutin tulisan |
| Chizuru | Papan ide, plus meja sendiri: laptop yang tutupnya ditempelin sticky note, tumpukan sticky note, gelas spidol, tanaman kecil | Nempel sticky note satu-satu |
| Arisu | Monitor rencana kerja, laci dengan laptop meeting | Ngetik rencana di `plans/` |
| Komachi | Monitor kontrak antar bagian, laci dengan laptop meeting | Ngetik kontrak dan langkah teknis |
| Miruku | Monitor checklist keamanan, laci dengan laptop meeting | Ngetik catatan pemeriksaan keamanan |
| Huagua | Monitor `DESIGN.md`, laci dengan laptop meeting | Ngetik arah desain |

Setup meja Arisu, Komachi, Miruku, dan Huagua masih dasar. Barang khas masing-masing di meja, kebiasaan kecil di meja, dan kegiatan favorit pas istirahat nyusul di update berikutnya.

**Ngetik**: tiap karakter yang muncul di layar dipencet jari beneran. Telapak tangan ngambang di atas keyboard dengan jari ditekuk ke tuts, jadi tangan nggak tenggelam ke keyboard. Tangan kiri pegang separuh kiri keyboard (1 sampai 5, Q sampai T, A sampai G, Z sampai B), tangan kanan sisanya, spasi, dan Enter, kayak touch typing. Tiap meja juga punya mouse di kanan keyboard. Sesekali tangan kanan pindah ke mouse beberapa detik dengan telapak di atas mouse, mouse-nya geser geser dan tombolnya nyala pas diklik, dan teks di layar berhenti dulu sampai tangannya balik ke keyboard.

**Nulis di papan tulis**: spidolnya diangkat dari papan dan dibawa ke awal coretan berikutnya, nggak loncat. Kadang berhenti sebentar kayak mikir, kadang mundur selangkah buat ngelihat hasilnya dengan tangan turun. Kalau tulisannya makin ke samping, dia geser beberapa langkah kecil ngikutin. Papan tulis dan papan ide ukurannya kayak papan kantor biasa (tinggi 0,85 m, mulai 0,45 m dari lantai), dengan panggung rendah setinggi 18 cm di depannya. Yang nulis naik ke panggung pas mulai dan turun pas selesai. Tulisannya cuma di bagian yang kejangkau dari panggung, jadi bagian paling atas papan dibiarin kosong. Buat baris paling atas dia jinjit, buat baris paling bawah dia nekuk lutut. Abis diagram selesai dia mundur ngelihat seluruhnya, terus ngapus papan dengan gerakan nyapu.

**Barang di meja dipakai**, bukan pajangan. Pas lagi santai di mejanya, tiap beberapa detik cast ngapain sesuatu sama barangnya. Barang yang diambil beneran hilang dari meja selama dipegang, terus ditaruh balik ke tempatnya. Tangannya dijulurin ke barang itu (barang di kiri meja diambil tangan kiri), badannya condong ke arah barangnya.

| Anggota | Yang dilakuin |
|---|---|
| 2B | Condong ke kanban sambil megang dagu, atau buka planner dan baca |
| Asuna | Ngecek job run di monitor vertikal, atau ngajak ngomong bebek karetnya |
| Kobayashi | Ambil konsol dari dock terus main pakai dua tangan, atau meluk boneka naga sambil senyum |
| Erza | Makan kue pakai garpu, suap demi suap |
| Yor | Ambil mawar dari vas dan nyium wanginya |
| Ruby | Ngomong ke mic, atau selfie pakai HP |
| Rias | Nyeruput teh, atau mindahin bidak catur terus mikir sambil megang dagu |
| Chizuru | Nulis di sticky note pakai spidol, atau tiba tiba dapet ide sambil ngacungin jari |

Selain itu semua cast sesekali nyeruput kopi dari gelasnya sendiri, selama gelasnya ada di meja dan masih ada isinya.

**Pas nggak ada tugas**, tiap cast milih kegiatan sendiri dan jalan ke sana tanpa nembus furnitur atau cast lain: kerja santai di meja, bikin kopi, ngemil di kulkas, cuci tangan di wastafel, manasin makanan di oven, nonton TV, main game di sofa, main arcade, nyiram tanaman, rebahan di beanbag, baca, ngobrol di meja bar, meeting di meja tengah, atau main pingpong. Kira-kira setengah waktunya di meja, setengahnya istirahat. Biar nggak monoton:
- Kegiatan yang sama nggak dipilih dua kali berturut-turut, dan tiap kegiatan punya jeda sebelum bisa diulang.
- Tiap cast punya kesukaan sendiri. Kobayashi sering main arcade, Erza sering ngemil, Rias sering baca, Yor sering ngecek rak server, Ruby sering selfie di depan ring light.
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

**Musik**: tombol **Musik** di kanan bawah kantor ngebuka panel musik. Isinya dua lagu bawaan, dan lo bisa nambah link YouTube sendiri (link watch, youtu.be, shorts, atau live), muter lagu tertentu, pindah ke lagu berikutnya, atau ngapus lagu dari daftar. Judul lagunya diambil dari YouTube, dan kalau nggak bisa diambil (misalnya lagi offline) yang tampil ID videonya. Lagu yang lagi diputer diulang terus sampai lo pencet **Lagu berikutnya**.

- Yang keluar cuma suaranya. Player YouTube-nya tetap jalan tapi disembunyiin. Aturan embed YouTube sebenarnya minta player-nya keliatan, jadi suatu saat YouTube bisa aja nolak cara ini. Kalau itu kejadian, musiknya berhenti bunyi.
- Nutup panel (tombol **Tutup** atau Escape) nggak matiin musik. Selama musik jalan, tombolnya bertulisan **Musik nyala**. Musik cuma berhenti kalau lo pencet **Matiin** atau kantornya ditutup.
- Slider **Volume** ngatur keras pelannya musik, dari 0 sampai 100 (awalnya 60). Bisa digeser pakai mouse atau tombol panah.
- Daftar lagu, lagu terakhir, volume, dan status nyala atau matinya disimpan. Kalau kantor ditutup pas musik nyala, musiknya nyala lagi pas kantor dibuka. Musik nggak pernah mulai sendiri sebelum lo pencet **Putar** pertama kali.
- Kalau pemilik video matiin fitur embed, YouTube nolak muter lagu itu. Panelnya bilang lagunya nggak bisa diputer di luar YouTube, terus lompat ke lagu berikutnya.

**Kamera**: drag buat muter, scroll buat zoom, klik dua kali buat balik ke tampilan awal. Pakai keyboard: Tab ke ruangan, panah buat muter, `+` dan `-` buat zoom, `0` buat reset. Kalau lama nggak disentuh, kameranya goyang pelan sendiri.

Isi layar, papan tulis, dan sticky note semuanya **simulasi**, bukan kerjaan asli lo. Jadi aman pas lagi share screen.

Pas ada yang kerja, panel **close-up** muncul sendiri di kiri, nempel di atas panel chat dengan lebar yang sama (kalau chat ditutup, dia pindah ke kiri bawah), dan nampilin layar atau papan anggota yang terakhir aktif, lengkap dengan nama tool yang lagi dipakai. Keterangannya pakai bahasa Inggris, contohnya `Ruby · Content + Portfolio · typing (Bash) · simulated screen`, sama kayak judul window (AlyxLabs Office, AlyxLabs Team). Setelah semua selesai, panelnya nunggu beberapa detik biar momen selesainya kelihatan, lalu hilang sendiri. Buat matiin sama sekali (misalnya pas share screen), hapus centang **Menu > Close-up kantor pas ada yang kerja**. Di mode browser, setting-nya ada di dialog **Model**.

Kalau 2B ngerjain tugas sendiri tanpa delegasi ke tim, dia tetap ngomong singkat di kotak obrolan: pas mulai, pas pakai tool (paling sering sekali tiap 8 detik), dan pas selesai.

Obrolan tim yang sama dengan overlay tim juga tampil di kantor, di pojok kanan atas bareng potret yang ngomong.

Kantor nggak punya tombol Menu sendiri: pakai tombol **Menu** di 2B, atau **klik kanan** di mana aja di kantor.

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
