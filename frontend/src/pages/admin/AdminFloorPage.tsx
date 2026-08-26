import { useState } from 'react';
import { adminUploadFloor } from '../../api.ts';

export default function AdminFloorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [floorName, setFloorName] = useState('Lantai 1');
  const [sourceType, setSourceType] = useState<'manual' | 'dxf'>('manual');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('floor', floorName);
    fd.append('source_type', sourceType);
    try {
      const res = await adminUploadFloor(fd);
      setMessage(res.message);
      setFile(null);
      const input = document.getElementById('floor-file') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch (e: any) {
      setError(e.message ?? 'Upload gagal');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-bold text-slate-900">Denah &amp; Import DXF</h1>
      <p className="mt-0.5 text-sm text-slate-500">
        Upload gambar denah sebagai background, atau file DXF yang otomatis diparse di backend menjadi polygon ruangan.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-800">Upload Denah</h2>
          <div className="mt-3">
            <label className="block text-sm font-medium text-slate-700">Nama lantai / denah</label>
            <input
              value={floorName}
              onChange={(e) => setFloorName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
            />
          </div>

          <div className="mt-3">
            <label className="block text-sm font-medium text-slate-700">Tipe sumber</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSourceType('manual')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  sourceType === 'manual' ? 'border-brand bg-brand text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                🖼️ Gambar manual
              </button>
              <button
                type="button"
                onClick={() => setSourceType('dxf')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  sourceType === 'dxf' ? 'border-brand bg-brand text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                📐 File DXF
              </button>
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-sm font-medium text-slate-700">
              File {sourceType === 'dxf' ? '.dxf (parsing otomatis polygon ruangan)' : '(png/jpg) sebagai gambar dasar denah'}
            </label>
            <input
              id="floor-file"
              type="file"
              accept={sourceType === 'dxf' ? '.dxf' : '.png,.jpg,.jpeg,.webp,.svg,.bmp'}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-300"
            />
            {file && <p className="mt-1 text-xs text-slate-500">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
          </div>

          {error && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-600">{error}</p>}
          {message && <p className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-sm text-emerald-700">✅ {message}</p>}

          <button
            onClick={handleUpload}
            disabled={uploading || !file}
            className="mt-4 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-light disabled:opacity-50"
          >
            {uploading ? 'Mengupload & memproses…' : 'Upload Denah'}
          </button>
        </div>
<div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-800">Cara Kerja Import DXF</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
            <li>
              Upload file <code className="font-mono text-xs">.dxf</code> (keluaran AutoCAD/software gambar lain).
            </li>
            <li>
              Parser DXF menggambar LINE, polyline, rectangle, circle, arc, ellipse, serta TEXT/MTEXT sebagai denah vektor.
            </li>
            <li>
              Hasilnya dikonversi ke <span className="font-semibold">JSON koordinat polygon ringan</span> — bukan file
              DXF mentah — sehingga editor peta tetap cepat di browser.
            </li>
            <li>
              Hanya satu entitas LWPOLYLINE/POLYLINE atau rectangle yang tertutup dan menyatu yang otomatis menjadi <span className="font-semibold">ruangan draft</span> yang bisa Anda beri
              nama, kode, dan harga di menu <span className="font-semibold">Ruangan</span>.
            </li>
            <li>Setelah disimpan, ruangan langsung tampil di peta publik dengan status Kosong.</li>
          </ol>

          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            <p className="font-semibold text-slate-600">Format DXF yang didukung:</p>
            <p className="mt-1">
              LINE, LWPOLYLINE, POLYLINE, RECTANGLE, CIRCLE, ARC, ELLIPSE, TEXT, dan MTEXT akan digambar. Semua LWPOLYLINE diperlakukan tertutup (70=0 dibaca seperti 70=1) dan menjadi ruangan bila polygon serta luasnya valid; beberapa LINE yang membentuk kotak tetap hanya denah. Konversi satuan: 1 unit = 1 meter (luas via rumus shoelace).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
