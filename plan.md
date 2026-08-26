# Plan.md — Aplikasi Smart Space (Peta Sewa Ruangan Terminal)

## 1. Latar Belakang & Tujuan
Smart Space adalah aplikasi berbasis peta (denah) yang menampilkan seluruh ruangan/space di sebuah terminal yang bisa disewakan (misal untuk booth, kios, iklan, stan brand, dsb). Tujuan utama:
- Memberi visibilitas real-time ke publik/calon penyewa tentang ruangan mana yang kosong dan mana yang sudah terisi.
- Mempermudah proses pengajuan sewa langsung dari peta.
- Memberi admin kontrol penuh atas denah (upload DXF atau gambar manual) dan proses approval penyewaan.

## 2. Dukungan Platform: Desktop & Mobile View
Aplikasi harus responsive dan dapat diakses dengan baik baik dari desktop (browser di komputer/laptop) maupun mobile (smartphone/tablet), untuk kedua role (admin & publik), dengan penyesuaian sebagai berikut:

### 2.1 Desktop View
- Layout peta lebih luas (canvas besar) untuk kenyamanan navigasi zoom/pan.
- Cocok untuk admin melakukan drawing manual ruangan (lebih presisi dengan mouse) dan upload/parsing file DXF.
- Detail ruangan bisa tampil sebagai side panel di samping peta (peta & detail terlihat bersamaan).
- Dashboard admin (statistik, laporan) ditampilkan dalam layout multi-kolom.

### 2.2 Mobile View
- Peta tetap bisa di-zoom/pan dengan gesture touch (pinch to zoom, drag).
- Detail ruangan tampil sebagai bottom sheet/modal (bukan side panel) agar tidak menutup peta sepenuhnya.
- Navigasi disederhanakan (hamburger menu / bottom navigation bar).
- Form pengajuan sewa dioptimalkan untuk input di layar kecil (field per baris, tombol besar, mudah disentuh).
- Untuk role admin: drawing manual ruangan di mobile tetap didukung namun dengan tool yang disederhanakan (mengingat presisi terbatas di layar sentuh); upload file DXF tetap bisa dilakukan dari mobile (pilih file dari storage/cloud).
- Approval pengajuan sewa oleh admin bisa dilakukan langsung dari mobile (list pengajuan + tombol approve/reject) agar proses lebih cepat/mobile-friendly.

### 2.3 Pendekatan Teknis
- Menggunakan pendekatan **responsive web app** (satu codebase, layout menyesuaikan breakpoint layar) sebagai dasar, sehingga desktop & mobile diakses lewat browser yang sama.
- Opsional pengembangan lanjutan: PWA (Progressive Web App) agar bisa "diinstall" di HP dan mendukung notifikasi push, atau native mobile app (jika dibutuhkan performa/fitur device lebih dalam seperti kamera untuk upload foto ruangan).

## 3. Role & Hak Akses

### 2.1 Admin
- Login dengan akun admin (autentikasi terpisah dari publik).
- Upload file DXF untuk membuat/memperbarui denah ruangan secara otomatis (parsing layout, extract room boundary, ukuran, nama ruangan).
- Menggambar/mengedit denah secara manual di aplikasi (drawing tool: rectangle/polygon room, resize, label).
- Mengelola data setiap ruangan: kode ruangan, ukuran (p x l / m²), lokasi/lantai, foto, harga sewa, status (kosong/terisi/dalam proses).
- Menerima & meninjau pengajuan sewa dari publik (data calon penyewa, dokumen, durasi sewa, dsb).
- Approve / reject pengajuan sewa.
- Setelah approve, sistem otomatis meng-update status ruangan di peta menjadi "Terisi" dan menampilkan brand yang menyewa.
- Melihat riwayat penyewa sebelumnya per ruangan (histori brand & periode sewa).
- Mengatur masa berlaku sewa (tanggal mulai - selesai), termasuk notifikasi saat sewa akan berakhir (agar ruangan otomatis kembali "Kosong" atau admin melakukan perpanjangan).
- Melihat dashboard laporan: okupansi, pendapatan, ruangan yang sering kosong, dsb.

### 2.2 Publik (Calon Penyewa / Brand)
- Tidak perlu login untuk sekadar melihat peta (opsional: login/register saat mau submit pengajuan).
- Melihat peta interaktif terminal dengan indikator warna status ruangan (misal: hijau = kosong, merah = terisi, kuning = proses pengajuan).
- Klik ruangan → melihat detail:
  - Ukuran ruangan (p x l, m²)
  - Foto/kondisi ruangan
  - Lokasi (lantai, zona, dekat pintu masuk/gate berapa)
  - Harga sewa (per hari/bulan, jika ditampilkan)
  - Brand yang sedang mengisi (jika terisi) + periode sewa saat ini
  - Riwayat brand-brand sebelumnya yang pernah menyewa ruangan tsb beserta periode sewanya
- Jika tertarik & ruangan berstatus kosong → tombol "Ajukan Sewa" mengarahkan ke landing page/form pengajuan.
- Mengisi form pengajuan: data brand/perusahaan, PIC, kontak, kebutuhan durasi sewa, upload dokumen pendukung (opsional), catatan tambahan.
- Submit → status pengajuan masuk ke admin, publik mendapat notifikasi/nomor tiket untuk tracking status pengajuan (pending/approved/rejected).

## 4. Alur Utama (User Flow)

### 4.1 Alur Publik
1. Buka aplikasi → tampil peta terminal dengan status ruangan (kosong/terisi/proses).
2. Klik salah satu ruangan → muncul detail ruangan (ukuran, foto, harga, brand saat ini, histori brand sebelumnya).
3. Jika ruangan kosong dan tertarik → klik "Ajukan Sewa".
4. Diarahkan ke landing page pengisian data pengajuan sewa.
5. Isi form → submit.
6. Sistem menampilkan konfirmasi & (opsional) nomor tiket pengajuan.
7. Status ruangan di peta berubah sementara menjadi "Proses Pengajuan" (opsional, agar brand lain tahu sedang diajukan).

### 4.2 Alur Admin
1. Login ke dashboard admin.
2. (Setup awal) Upload file DXF terminal ATAU gambar manual denah ruangan di canvas drawing.
3. Lengkapi/edit metadata tiap ruangan (nama, ukuran, harga, foto, dsb).
4. Menerima notifikasi pengajuan sewa baru dari publik.
5. Review data pengajuan (detail brand, dokumen, durasi).
6. Approve atau Reject.
   - Jika Approve → sistem otomatis update status ruangan menjadi "Terisi", simpan data brand & periode sewa, update tampilan peta publik.
   - Jika Reject → status ruangan kembali "Kosong", pengaju mendapat notifikasi alasan penolakan (opsional).
7. Saat periode sewa berakhir → sistem mengingatkan admin, ruangan bisa direset ke "Kosong" atau diperpanjang.

## 5. Struktur Data (Konsep Awal)

### Room
- room_id
- room_code (contoh: A-01)
- name
- floor / zone
- geometry (koordinat polygon dari DXF/manual drawing)
- size (panjang, lebar, luas m²)
- price (opsional, per hari/bulan)
- photos[]
- status (kosong / terisi / proses_pengajuan)
- current_tenant_id (nullable)
- current_lease_start / current_lease_end

### Tenant / Brand
- tenant_id
- brand_name
- pic_name
- contact (phone/email)
- company_docs[] (opsional)

### Lease History (riwayat sewa per ruangan)
- lease_id
- room_id
- tenant_id
- start_date
- end_date
- status (aktif / selesai / dibatalkan)

### Rental Request (pengajuan sewa)
- request_id
- room_id
- tenant_data (nama brand, PIC, kontak, kebutuhan durasi, catatan)
- attachments[]
- status (pending / approved / rejected)
- created_at
- reviewed_by (admin_id)
- reviewed_at

### Map/Floor Plan
- floor_plan_id
- source_type (dxf / manual)
- file_url (jika dari DXF)
- version
- uploaded_by
- uploaded_at

## 6. Fitur Peta & Drawing

### Import DXF
- Admin upload file .dxf.
- **Parsing dilakukan sekali di backend** (bukan di browser) menggunakan `dxf-parser` (Node) atau `ezdxf` (Python) untuk mengenali layer/polyline sebagai batas ruangan (room boundary) secara otomatis.
- Hasil parsing dikonversi jadi **format ringan** (JSON koordinat polygon per ruangan), lalu dikirim ke frontend — sehingga editor tidak perlu memuat/mengurai file DXF mentah yang berat.
- Hasil konversi ditampilkan sebagai draft di canvas editor → admin bisa mengoreksi/menandai mana yang merupakan ruangan sewa, memberi nama/kode, dan mengisi metadata.

### Gambar Manual & Editor Ruangan
- Canvas drawing tool berbasis **Konva.js** (rendering Canvas 2D, ringan & responsif, punya built-in transformer untuk resize/rotate) untuk membuat polygon/rectangle yang merepresentasikan ruangan — baik untuk gambar manual dari nol maupun mengedit hasil import DXF.
- Bisa resize, drag, ubah bentuk, hapus — mendukung interaksi mouse (desktop) maupun touch/gesture (mobile).
- Bisa menempel di atas gambar denah dasar (image background) sebagai referensi.
- Simpan sebagai layer ruangan (data JSON koordinat) yang terhubung ke data Room — bukan menyimpan/mengedit file DXF asli, agar performa editor tetap cepat & ringan.

### Tampilan Peta Publik
- Peta interaktif (zoom/pan).
- Warna status: hijau (kosong), merah (terisi), kuning (proses pengajuan).
- Klik ruangan → popup/detail panel.
- Filter (opsional): lantai, ukuran, harga, status.
- Search ruangan by kode/nama (opsional).

## 7. Notifikasi
- Publik: notifikasi status pengajuan (pending/approved/rejected) via email atau tampilan tracking di app.
- Admin: notifikasi pengajuan baru masuk, notifikasi sewa akan berakhir (H-7/H-1, dsb).

## 8. Dashboard Admin (Opsional Tahap Lanjut)
- Statistik okupansi (jumlah ruangan kosong vs terisi).
- Riwayat pendapatan sewa.
- Ruangan dengan histori penyewa terbanyak/paling laku.
- Export laporan (Excel/PDF).

## 9. Rekomendasi Teknologi (Opsional, Bisa Disesuaikan)
- Frontend: React / Next.js dengan **Konva.js** (via `react-konva`) sebagai engine peta & drawing tool — dipilih karena ringan, rendering Canvas 2D cepat, punya built-in transformer (resize/drag) siap pakai, dan mendukung gesture touch untuk mobile.
- Alur DXF: file DXF **tidak diedit langsung di browser**. Parsing dilakukan sekali di backend (`dxf-parser`/Node atau `ezdxf`/Python), hasilnya dikonversi ke JSON koordinat polygon ringan, baru dikirim ke frontend untuk dirender & diedit via Konva.js. Pendekatan ini menjaga editor tetap cepat & responsif walau file DXF sumber besar/kompleks.
- Responsive layout: CSS breakpoint (desktop/tablet/mobile) atau utility framework seperti Tailwind CSS untuk mempercepat adaptasi tampilan antar ukuran layar.
- Backend: Node.js/Express atau NestJS (satu bahasa dengan frontend — TypeScript), REST/GraphQL API. Alternatif: Laravel/Django jika tim lebih familiar, dengan catatan service parsing DXF tetap disarankan di Node/Python.
- Database: PostgreSQL (mendukung data geometris via PostGIS jika perlu query spasial) atau MySQL dengan penyimpanan koordinat JSON.
- Storage file (DXF, foto, dokumen): S3-compatible storage.
- Auth: role-based access control (admin vs publik/user).

## 10. Tahapan Pengembangan (Milestone)
1. **MVP Peta Publik**: tampilan peta statis dengan status ruangan (data diinput manual admin lewat form, belum ada drawing tool), sudah responsive untuk desktop & mobile view.
2. **Modul Admin - Manual Drawing**: tool gambar ruangan manual di atas gambar denah.
3. **Modul Admin - Import DXF**: parsing otomatis dari file DXF.
4. **Modul Pengajuan Sewa**: landing page form, submit, tracking status.
5. **Modul Approval Admin**: review, approve/reject, update status peta otomatis.
6. **Riwayat & Histori Brand**: tampilkan histori penyewa per ruangan di detail panel publik.
7. **Notifikasi**: email/inapp notification untuk publik & admin.
8. **Dashboard & Laporan**: statistik okupansi, pendapatan, export laporan.

## 11. Hal yang Perlu Didiskusikan Lebih Lanjut
- Apakah publik wajib login/register untuk submit pengajuan, atau cukup isi data di form tanpa akun? answer : (untuk sementara cukup isi data di form tanpa login/register)
- Apakah harga sewa ditampilkan terbuka ke publik atau hanya "hubungi admin"? answer :(hubungi admin)
- Apakah dibutuhkan multi-level approval (misal admin area + admin pusat)? answer :(cukup role admin saja)
- Apakah perlu integrasi pembayaran online setelah approval? answer :(tidak perlu, karena pembayaran nanti dihubungi langsung oleh admin)
- Format file DXF yang akan diupload — dari software apa (AutoCAD, dsb) agar parsing sesuai. answer :(support dwg dan dxf)
