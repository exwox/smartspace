# 🧭 Smart Space — Peta Sewa Ruangan Terminal

Aplikasi berbasis peta (denah) interaktif untuk menampilkan dan menyewakan ruangan/space di
terminal (booth, kios, iklan, stan brand). Dibangun berdasarkan **`plan.md`**.

> Responsive web app — satu codebase yang nyaman di **desktop** (side panel, multi-kolom) maupun
> **mobile** (bottom sheet, bottom navigation).

---

## ✨ Fitur (sesuai milestone plan.md)

| # | Fitur | Status |
|---|-------|--------|
| 1 | **MVP Peta Publik** — peta interaktif (zoom/pan/touch), warna status, klik ruangan → detail (side panel / bottom sheet), filter & search, responsive | ✅ |
| 2 | **Modul Admin — Manajemen Ruangan** — CRUD, edit geometri via drag di peta | ✅ |
| 3 | **Modul Admin — Import DXF** — file `.dxf` diparse di backend → polygon ruangan otomatis | ✅ |
| 4 | **Modul Pengajuan Sewa** — form tanpa login + nomor tiket + tracking status + **multi-tiket per ruangan** | ✅ |
| 5 | **Modul Approval Admin** — approve/reject: tiket terpilih ⇒ ruangan terisi & tiket lain otomatis ditolak, riwayat penyewa | ✅ |
| 6 | **Riwayat Brand per Ruangan** — historis lease di detail panel publik | ✅ |
| 7 | **Notifikasi** — tracking status publik via nomor tiket (in-app) | 🟡 (email dapat ditambahkan) |
| 8 | **Dashboard & Laporan** — statistik okupansi, pending requests | ✅ |

---

## 🚀 Cara Menjalankan

### Opsi A — Docker (paling mudah)

```bash
docker compose up --build -d
# buka http://localhost:3001
```

Data & upload tersimpan di volume Docker (`smart-space-data`, `smart-space-uploads`).

### Opsi B — Development (backend + frontend)

```bash
# 1) Backend (API di :3001)
cd backend
npm install
npm run seed        # isi data demo (10 ruangan, 2 lantai, dll)
npm run dev

# 2) Frontend (Vite di :5173, proxy ke :3001) — terminal lain
cd frontend
npm install
npm run dev
# buka http://localhost:5173
```

### Opsi C — Production (statik, satu port)

```bash
cd frontend && npm run build      # build Vite -> frontend/dist
cd ../backend && npm run build    # compile TS -> backend/dist
npm start                         # Express menyajikan API + frontend statik
# buka http://localhost:3001
```

---

## 🔑 Akun Admin

| Role | Login | Password |
|------|-------|----------|
| Admin | `admin` | `admin123` |

Ubah di production melalui env: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`.

---

## 🗺️ Alur Penggunaan

1. **Publik** membuka halaman utama → peta terminal: 🟢 hijau = kosong, 🔴 merah = terisi, 🟡 kuning = proses.
2. Klik ruangan → detail (ukuran, harga, lokasi, brand saat ini, **riwayat penyewa**).
3. Klik **Ajukan Sewa** (ruangan belum terisi — beberapa brand boleh mengajukan ruangan yang sama) → isi form tanpa login + upload dokumen (opsional).
4. Sistem memberi **nomor tiket** untuk tracking (`/tracking`).
5. **Admin** login → menu **Pengajuan** → *Approve* / *Tolak* (dengan alasan).
   - Approve ⇒ otomatis buat tenant & lease, ruangan di peta jadi **terisi**, dan semua tiket pending lain pada ruangan yang sama otomatis ditolak.
   - Tolak ⇒ hanya tiket itu yang ditolak; ruangan dan tiket lain tetap bisa diproses.
6. Admin dapat upload `.dxf`/gambar denah di menu **Denah/DXF**, atau tambah/edit ruangan manual di **Ruangan**.

---

## 🛠️ Arsitektur

```
smart space/
├── backend/                 # Express + TypeScript API (:3001)
│   ├── src/
│   │   ├── index.ts         # routes API (publik + admin, JWT)
│   │   ├── db.ts            # persistence JSON (data/db.json), atomic write
│   │   ├── seed.ts          # data demo
│   │   ├── dxf.ts           # parser DXF (LINE/LWPOLYLINE/POLYLINE)
│   │   ├── auth.ts          # login & JWT middleware
│   │   └── types.ts         # model data (Room, Tenant, Lease, Request, FloorPlan)
│   ├── samples/sample.dxf   # contoh file DXF 2 ruangan
│   ├── data/db.json         # database (git-ignored)
│   └── uploads/             # file upload (dokumen, DXF, gambar)
└── frontend/                # React + Vite + TypeScript + Tailwind + Konva.js
    └── src/
        ├── components/MapCanvas.tsx       # peta Konva: zoom/pan/touch, editor drag
        ├── components/RoomDetailPanel.tsx # side panel / bottom sheet
        ├── components/RoomFormModal.tsx   # CRUD ruangan
        └── pages/   # publik & admin (dashboard, rooms, floor, requests)
```

### API singkat

| Method | Endpoint | Akses | Fungsi |
|--------|----------|-------|--------|
| GET | `/api/rooms` | publik | daftar ruangan + tenant aktif + histori |
| GET | `/api/rooms/:id` | publik | detail ruangan |
| POST | `/api/requests` | publik | submit pengajuan (multipart, upload opsional) → tiket |
| GET | `/api/requests/:ticket` | publik | tracking status |
| POST | `/api/auth/login` | - | login admin → JWT |
| GET `/api/admin/rooms` · POST · PUT/:id · DELETE/:id | admin | CRUD ruangan |
| POST | `/api/admin/floor` | admin | upload denah / DXF (auto-parsing) |
| GET | `/api/admin/requests` | admin | daftar pengajuan |
| PATCH | `/api/admin/requests/:id` | admin | approve/reject + update peta otomatis |
| GET | `/api/admin/stats` | admin | statistik dashboard |

---

## 📐 Format DXF yang didukung

- Entitas **LINE**, **LWPOLYLINE**, **POLYLINE+VERTEX**, **RECTANGLE**, **CIRCLE**, **ARC**, **ELLIPSE**,
  **TEXT**, dan **MTEXT**
  dikonversi menjadi linework vektor dan tetap digambar sebagai denah.
- Satu entitas **LWPOLYLINE**, **POLYLINE tertutup**, atau **RECTANGLE tertutup** dihitung sebagai ruangan bila
  membentuk polygon dengan luas yang valid. Khusus LWPOLYLINE, group code `70 = 0` selalu dibaca seperti `70 = 1`.
  Empat entitas LINE yang tersambung membentuk persegi panjang tetap hanya digambar sebagai denah.
- Hasil parsing dikonversi menjadi **koordinat vektor JSON ringan** di backend (bukan file DXF mentah) —
  editor peta tetap cepat di browser.
- Luas ruangan dihitung dengan rumus shoelace (1 unit DXF = 1 m).
- Contoh file uji: [`backend/samples/sample.dxf`](backend/samples/sample.dxf) — 1 ruangan; kotak dari empat LINE bukan ruangan.

---

## 🧪 Testing

```bash
cd backend && npx tsc --noEmit    # typecheck backend
cd frontend && npm run build      # typecheck + build frontend
```

---

## ⚠️ Catatan Produksi

- **Database**: default file JSON (`backend/data/db.json`) — cocok untuk MVP/skala kecil. Untuk produksi,
  migrasikan `db.ts` ke PostgreSQL/MySQL (model di `types.ts` sudah siap).
- **Storage**: upload di `backend/uploads`; untuk produksi gunakan S3-compatible.
- **Auth**: JWT via env `JWT_SECRET`. Tambahkan password-hash untuk multi-admin.
- **Notifikasi**: tambahkan SMTP/email adapter pada milestone 7.

---

Dibangun dari `plan.md` — Smart Space © 2026.
