# Membuat Smart Space TNJ menjadi .EXE

## Cara paling aman: build di Windows 10/11

1. Install Node.js LTS.
2. Extract project ini.
3. Buka PowerShell di folder project.
4. Jalankan:

```powershell
npm install
npm --prefix frontend install
npm --prefix backend install
npm run dist:win
```

Hasil berada di folder `release/`:

- `Smart Space TNJ-1.0.0-x64-nsis.exe` → installer Windows.
- `Smart Space TNJ-1.0.0-x64-portable.exe` → versi portable tanpa instalasi.

## Menjalankan versi desktop untuk tes

```powershell
npm run desktop
```

## Penyimpanan data

Saat menjadi aplikasi desktop, database dan upload tidak ditulis ke folder instalasi. Data disimpan di folder Electron `userData`, biasanya:

```text
C:\Users\NAMA_USER\AppData\Roaming\Smart Space TNJ\
├── data\db.json
└── uploads\
```

Dengan demikian data tetap ada ketika aplikasi di-update atau di-install ulang ke folder yang sama.

## Login admin default

- Username: `admin`
- Password: `admin123`

Sebelum penggunaan produksi, ubah credential dan `JWT_SECRET` melalui environment/configuration yang aman.

## Catatan build dari Linux

`electron-builder` dapat membuat sebagian target Windows dari Linux, tetapi NSIS/Wine dapat menjadi dependency tambahan. Untuk hasil paling konsisten, build `.exe` langsung pada Windows.

## Build Windows EXE langsung dari Ubuntu/Linux

Project ini juga menyertakan `build-exe.sh` untuk cross-build Windows dari Linux.

Pastikan Node.js 20+ dan Wine tersedia, lalu jalankan dari root project:

```bash
chmod +x build-exe.sh
./build-exe.sh
```

Secara default script akan:

1. Memeriksa Node.js, npm, dan Wine.
2. Menginstall dependency desktop, frontend, dan backend.
3. Build React dan Express.
4. Membuat Windows x64 Portable EXE.
5. Menaruh hasil di folder `release/`.

Portable dijadikan default karena target NSIS membutuhkan implementasi Wine/RPC yang lengkap dan
tidak selalu bekerja pada Linux headless. Jika Wine pada mesin sudah berfungsi penuh, installer juga
dapat dicoba dengan:

```bash
SMARTSPACE_BUILD_NSIS=1 ./build-exe.sh
```

Untuk installer NSIS yang paling konsisten, gunakan `BUILD_EXE.bat` langsung di Windows.

Jika Wine belum tersedia pada Ubuntu:

```bash
sudo apt update
sudo apt install -y wine64
```

PC Windows yang menjalankan file hasil build tidak memerlukan Node.js/npm/Wine.
