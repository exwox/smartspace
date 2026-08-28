import { useCallback, useEffect, useMemo, useState } from 'react';
import MapCanvas from '../../components/MapCanvas.tsx';
import { adminFetchRooms, adminSaveRoom, adminUploadFloor, adminUploadRoomPhotos, fetchFloors, adminDeleteFloor } from '../../api.ts';
import type { FloorPlan, Room } from '../../types.ts';
import { resizedRectanglePoints } from '../../types.ts';

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function AdminFloorPage() {
  // ---------- Upload denah ----------
  const [file, setFile] = useState<File | null>(null);
  const [floorName, setFloorName] = useState('Lantai 1');
  const [sourceType, setSourceType] = useState<'manual' | 'dxf'>('manual');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---------- Editor ruangan (gambar rectangle) ----------
  const [floors, setFloors] = useState<FloorPlan[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedFloor, setSelectedFloor] = useState('');
  const [drawMode, setDrawMode] = useState(false);
  const [drafts, setDrafts] = useState<Room[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [deletingFloor, setDeletingFloor] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorMessage, setEditorMessage] = useState<string | null>(null);

  // Form draft terpilih
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formZone, setFormZone] = useState('Zona A');
  const [formPrice, setFormPrice] = useState('0');
  const [formPanjang, setFormPanjang] = useState('');
  const [formLebar, setFormLebar] = useState('');
  const [formLuas, setFormLuas] = useState('');

  // Foto draft: file asli (untuk diupload setelah disimpan) + object URL (pratinjau di denah)
  const [draftPhotos, setDraftPhotos] = useState<Record<string, File[]>>({});
  const [draftPhotoUrls, setDraftPhotoUrls] = useState<Record<string, string[]>>({});

  const floorNames = useMemo(() => [...new Set(floors.map((f) => f.floor))], [floors]);

  // Draft digabung dengan foto lokal (blob URL) agar pratinjau fotonya tampil di denah
  const draftsForMap = useMemo(
    () => drafts.map((d) => ({ ...d, photos: draftPhotoUrls[d.room_id] ?? d.photos })),
    [drafts, draftPhotoUrls],
  );

  const loadEditorData = useCallback(async () => {
    try {
      const [floorRes, roomRes] = await Promise.all([fetchFloors(), adminFetchRooms()]);
      setFloors(floorRes.floors);
      setRooms(roomRes.rooms);
      setSelectedFloor((current) => current || floorRes.floors[0]?.floor || '');
    } catch {
      /* biarkan editor kosong bila gagal memuat */
    }
  }, []);

  useEffect(() => {
    loadEditorData();
  }, [loadEditorData]);

  // Jaga agar lantai terpilih selalu valid
  useEffect(() => {
    if (floorNames.length === 0) return;
    if (!selectedFloor || !floorNames.includes(selectedFloor)) setSelectedFloor(floorNames[0]);
  }, [floorNames, selectedFloor]);

  const selectedDraft = drafts.find((d) => d.room_id === selectedDraftId) ?? null;

  // Sinkronkan form saat pilihan draft berubah
  useEffect(() => {
    const draft = selectedDraft;
    if (draft) {
      setFormCode((prev) => prev !== draft.room_code ? draft.room_code : prev);
      setFormName((prev) => prev !== draft.name ? draft.name : prev);
      setFormZone((prev) => prev !== draft.zone ? draft.zone : prev);
      setFormPrice((prev) => Number(prev) !== draft.price ? String(draft.price) : prev);
      
      setFormPanjang((prev) => {
        const val = String(draft.size.panjang);
        return prev === '' || Math.abs(Number(prev) - draft.size.panjang) > 0.01 ? val : prev;
      });
      setFormLebar((prev) => {
        const val = String(draft.size.lebar);
        return prev === '' || Math.abs(Number(prev) - draft.size.lebar) > 0.01 ? val : prev;
      });
      setFormLuas((prev) => {
        const val = String(draft.size.luas_m2);
        return prev === '' || Math.abs(Number(prev) - draft.size.luas_m2) > 0.01 ? val : prev;
      });
    }
  }, [selectedDraftId, selectedDraft?.size?.panjang, selectedDraft?.size?.lebar, selectedDraft?.size?.luas_m2]);

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
      // Muat ulang denah & ruangan, lalu langsung pilih lantai yang baru diupload
      await loadEditorData();
      setSelectedFloor(floorName.trim());
    } catch (e: any) {
      setError(e.message ?? 'Upload gagal');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFloor = async () => {
    const floorPlan = floors.find((f) => f.floor === selectedFloor);
    if (!floorPlan) return;

    const confirmMsg = `Apakah Anda yakin ingin menghapus denah "${floorPlan.floor}"?\n` +
      `Semua ruangan, kontrak sewa, dan pengajuan sewa pada lantai/denah ini akan ikut dihapus secara permanen.`;

    if (!window.confirm(confirmMsg)) return;

    setDeletingFloor(true);
    setEditorError(null);
    setEditorMessage(null);
    try {
      const res = await adminDeleteFloor(floorPlan.floor_id);
      setEditorMessage(res.message);
      
      // Reset state draft / draft selection jika sedang berada di lantai ini
      setDrafts([]);
      setSelectedDraftId(null);

      // Muat ulang data
      setSelectedFloor('');
      await loadEditorData();
    } catch (e: any) {
      setEditorError(e.message ?? 'Gagal menghapus denah');
    } finally {
      setDeletingFloor(false);
    }
  };

  // ---------- Menggambar rectangle ----------
  const nextDraftCode = () => {
    const nums = drafts
      .map((d) => Number(d.room_code.replace(/[^0-9]/g, '')))
      .filter((n) => Number.isFinite(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `R-${String(next).padStart(2, '0')}`;
  };

  const handleDrawRectangle = (rect: { x: number; y: number; width: number; height: number }) => {
    const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const draft: Room = {
      room_id: id,
      room_code: nextDraftCode(),
      name: 'Ruangan Baru',
      floor: selectedFloor || 'Lantai 1',
      zone: 'Zona A',
      geometry: {
        type: 'rectangle',
        points: [
          rect.x,
          rect.y,
          rect.x + rect.width,
          rect.y,
          rect.x + rect.width,
          rect.y + rect.height,
          rect.x,
          rect.y + rect.height,
        ],
      },
      size: {
        panjang: round2(rect.width),
        lebar: round2(rect.height),
        luas_m2: round2(rect.width * rect.height),
      },
      price: 0,
      photos: [],
      status: 'kosong',
      current_tenant_id: null,
      current_lease_start: null,
      current_lease_end: null,
      notes: '',
      history: null,
    };
    setEditorMessage(null);
    setEditorError(null);
    setDrafts((ds) => [...ds, draft]);
    setSelectedDraftId(id);
  };

  const patchSelectedDraft = (patch: Partial<Room>) => {
    setDrafts((ds) => ds.map((d) => (d.room_id === selectedDraftId ? { ...d, ...patch } : d)));
  };

  /** Lepas foto draft & cabut object URL-nya. */
  const clearDraftPhotos = (id: string) => {
    setDraftPhotos((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setDraftPhotoUrls((current) => {
      current[id]?.forEach((url) => URL.revokeObjectURL(url));
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const handleDraftPhotosPicked = (id: string, files: File[]) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp'];
    const picked: File[] = [];
    const urls: string[] = [];
    for (const file of files) {
      if ((draftPhotos[id]?.length ?? 0) + picked.length >= 5) break;
      if (!allowedTypes.includes(file.type)) continue;
      picked.push(file);
      urls.push(URL.createObjectURL(file));
    }
    if (picked.length === 0) return;
    setDraftPhotos((c) => ({ ...c, [id]: [...(c[id] ?? []), ...picked] }));
    setDraftPhotoUrls((c) => ({ ...c, [id]: [...(c[id] ?? []), ...urls] }));
  };

  const removeDraftPhoto = (id: string, index: number) => {
    const url = draftPhotoUrls[id]?.[index];
    if (url) URL.revokeObjectURL(url);
    setDraftPhotos((c) => ({ ...c, [id]: (c[id] ?? []).filter((_, i) => i !== index) }));
    setDraftPhotoUrls((c) => ({ ...c, [id]: (c[id] ?? []).filter((_, i) => i !== index) }));
  };

  const removeDraft = (id: string) => {
    setDrafts((ds) => ds.filter((d) => d.room_id !== id));
    clearDraftPhotos(id);
    if (selectedDraftId === id) setSelectedDraftId(null);
  };

  // Ubah ukuran rectangle draft — geometry ikut di-resize, luas dihitung ulang otomatis
  const applyDraftSize = (panjang: number, lebar: number, luas?: number) => {
    const computedLuas = luas !== undefined ? luas : panjang * lebar;
    setFormLuas(String(round2(computedLuas)));
    setDrafts((ds) =>
      ds.map((d) => {
        if (d.room_id !== selectedDraftId || d.geometry.type !== 'rectangle') return d;
        const points = resizedRectanglePoints(d.geometry.points, panjang, lebar);
        return {
          ...d,
          geometry: { ...d.geometry, points },
          size: {
            panjang: round2(panjang),
            lebar: round2(lebar),
            luas_m2: round2(computedLuas),
          },
        };
      }),
    );
  };

  const handleDraftPanjang = (raw: string) => {
    setFormPanjang(raw);
    const p = Number(raw);
    const l = Number(formLebar);
    if (Number.isFinite(p) && p > 0 && l > 0) {
      applyDraftSize(p, l);
    }
  };

  const handleDraftLebar = (raw: string) => {
    setFormLebar(raw);
    const l = Number(raw);
    const p = Number(formPanjang);
    if (Number.isFinite(l) && l > 0 && p > 0) {
      applyDraftSize(p, l);
    }
  };

  const handleDraftLuas = (raw: string) => {
    setFormLuas(raw);
    const val = Number(raw);
    if (Number.isFinite(val) && val > 0) {
      setDrafts((ds) =>
        ds.map((d) => {
          if (d.room_id !== selectedDraftId) return d;
          return {
            ...d,
            size: {
              ...d.size,
              luas_m2: round2(val),
            },
          };
        }),
      );
    }
  };

  const saveSelectedDraft = async () => {
    if (!selectedDraft) return;
    setSavingDraft(true);
    setEditorError(null);
    setEditorMessage(null);
    try {
      const saved = await adminSaveRoom({
        room_code: formCode.trim() || selectedDraft.room_code,
        name: formName.trim() || formCode.trim() || selectedDraft.name,
        floor: selectedDraft.floor,
        zone: formZone.trim() || selectedDraft.zone,
        price: Number(formPrice) || 0,
        notes: '',
        status: 'kosong',
        geometry: selectedDraft.geometry,
        size: selectedDraft.size,
        photos: [],
      });
      // Upload foto lokasi draft ke ruangan yang baru tersimpan di server
      const files = draftPhotos[selectedDraft.room_id];
      if (files && files.length > 0) {
        await adminUploadRoomPhotos(saved.room.room_id, files);
      }
      clearDraftPhotos(selectedDraft.room_id);
      setDrafts((ds) => ds.filter((d) => d.room_id !== selectedDraft.room_id));
      setSelectedDraftId(null);
      await loadEditorData();
      setEditorMessage(`Ruangan ${formCode.trim() || selectedDraft.room_code} berhasil dibuat di ${selectedDraft.floor}`);
    } catch (e: any) {
      setEditorError(e.message ?? 'Gagal menyimpan ruangan');
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-bold text-slate-900">Denah &amp; Import DXF</h1>
      <p className="mt-0.5 text-sm text-slate-500">
        Upload gambar denah sebagai background, atau file DXF yang otomatis diparse di backend menjadi polygon ruangan.
        Setelah gambar denah diupload, buat ruangan dengan menggambar rectangle langsung di atas denah.
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
          <h2 className="font-bold text-slate-800">Cara Kerja</h2>
          <p className="mt-3 text-sm font-semibold text-slate-700">🖼️ Upload gambar denah (PNG/JPG)</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>Upload gambar denah sebagai background lantai.</li>
            <li>
              Di editor <span className="font-semibold">Buat Ruangan dengan Rectangle</span> di bawah, pilih lantai lalu
              aktifkan mode <span className="font-semibold">▭ Gambar Rectangle</span>.
            </li>
            <li>Klik &amp; tarik di atas denah untuk membentuk ruangan, isi kode/nama/zona/harga, tambahkan foto lokasi (opsional), lalu simpan.</li>
            <li>Ruangan langsung tampil di peta publik dengan status Kosong.</li>
          </ol>

          <p className="mt-4 text-sm font-semibold text-slate-700">📐 Import DXF (opsional)</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>Upload file <code className="font-mono text-xs">.dxf</code> (keluaran AutoCAD/software gambar lain).</li>
            <li>Parser menggambar LINE, polyline, rectangle, circle, arc, ellipse, serta TEXT/MTEXT sebagai denah vektor.</li>
            <li>LWPOLYLINE/POLYLINE tertutup yang valid otomatis menjadi ruangan draft yang bisa Anda lengkapi di menu Ruangan.</li>
          </ol>

          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            <p className="font-semibold text-slate-600">Konversi ukuran:</p>
            <p className="mt-1">
              Ukuran ruangan dihitung dari koordinat canvas (panjang × lebar), dan luas m² untuk rectangle dihitung dari
              bounding box-nya.
            </p>
          </div>
        </div>
      </div>

      {/* ---------- Editor: buat ruangan dengan rectangle ---------- */}
      <div className="mt-4 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-800">Buat Ruangan dengan Rectangle</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Pilih lantai, aktifkan mode gambar, lalu klik-tarik di atas denah untuk membuat ruangan baru.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
            >
              {floorNames.length === 0 && <option value="">Belum ada denah</option>}
              {floorNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            {selectedFloor && (
              <button
                type="button"
                onClick={handleDeleteFloor}
                disabled={deletingFloor}
                className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 hover:border-red-400 transition disabled:opacity-50"
                title="Hapus denah ini beserta semua ruangan di dalamnya"
              >
                {deletingFloor ? 'Menghapus...' : '🗑️ Hapus Denah'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setDrawMode((v) => !v)}
              disabled={floors.length === 0}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                drawMode
                  ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {drawMode ? '✕ Keluar Mode Gambar' : '▭ Gambar Rectangle'}
            </button>
          </div>
        </div>

        {floors.length === 0 ? (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
            Belum ada denah. Upload gambar PNG/JPG pada form <span className="font-semibold">Upload Denah</span> di atas terlebih dahulu.
          </p>
        ) : (
          <>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200" style={{ height: 480 }}>
              <MapCanvas
                rooms={rooms}
                floors={floors}
                selectedRoomId={null}
                onSelect={() => {}}
                editor
                activeFloorName={selectedFloor}
                drawMode={drawMode}
                onDrawRectangle={handleDrawRectangle}
                draftRooms={draftsForMap}
                selectedDraftId={selectedDraftId}
                onSelectDraft={(room) => setSelectedDraftId(room?.room_id ?? null)}
                onDraftsChange={setDrafts}
              />
            </div>

            {editorError && (
              <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-600">{editorError}</p>
            )}
            {editorMessage && (
              <p className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-sm text-emerald-700">✅ {editorMessage}</p>
            )}

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              {/* Daftar draft */}
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">
                    Ruangan belum disimpan ({drafts.length})
                  </p>
                  {drafts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        drafts.forEach((d) => clearDraftPhotos(d.room_id));
                        setDrafts([]);
                        setSelectedDraftId(null);
                      }}
                      className="text-xs font-semibold text-red-500 hover:text-red-600"
                    >
                      Buang semua
                    </button>
                  )}
                </div>
                {drafts.length === 0 ? (
                  <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                    Belum ada draft. Aktifkan <span className="font-semibold">▭ Gambar Rectangle</span> lalu klik-tarik
                    pada denah. Rectangle biru putus-putus adalah draft; geser untuk memperbaiki posisi, klik untuk
                    mengedit detailnya.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {drafts.map((draft) => (
                      <button
                        key={draft.room_id}
                        type="button"
                        onClick={() => setSelectedDraftId(draft.room_id)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                          selectedDraftId === draft.room_id
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>{draft.room_code}</span>
                        <span className="font-normal text-slate-400">
                          {draft.size.luas_m2 === 0 ? 'N/A' : `${draft.size.luas_m2} m²`}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Hapus ${draft.room_code}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeDraft(draft.room_id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              removeDraft(draft.room_id);
                            }
                          }}
                          className="ml-1 rounded-full px-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                        >
                          ✕
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Form draft terpilih */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-sm font-medium text-slate-700">Detail Ruangan</p>
                {!selectedDraft ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Pilih salah satu draft di kiri (atau klik rectangle di denah) untuk melengkapi datanya.
                  </p>
                ) : (
                  <>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600">Kode</label>
                        <input
                          value={formCode}
                          onChange={(e) => {
                            setFormCode(e.target.value);
                            patchSelectedDraft({ room_code: e.target.value });
                          }}
                          placeholder="R-01"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600">Nama</label>
                        <input
                          value={formName}
                          onChange={(e) => {
                            setFormName(e.target.value);
                            patchSelectedDraft({ name: e.target.value });
                          }}
                          placeholder="Kios Makanan"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600">Zona</label>
                        <input
                          value={formZone}
                          onChange={(e) => {
                            setFormZone(e.target.value);
                            patchSelectedDraft({ zone: e.target.value });
                          }}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600">Harga / bulan</label>
                        <input
                          value={formPrice}
                          onChange={(e) => {
                            setFormPrice(e.target.value);
                            patchSelectedDraft({ price: Number(e.target.value) || 0 });
                          }}
                          inputMode="numeric"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600">Panjang (m)</label>
                        <input
                          value={formPanjang}
                          onChange={(e) => handleDraftPanjang(e.target.value)}
                          inputMode="decimal"
                          min={0.1}
                          step="any"
                          aria-label="Panjang ruangan (m)"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600">Lebar (m)</label>
                        <input
                          value={formLebar}
                          onChange={(e) => handleDraftLebar(e.target.value)}
                          inputMode="decimal"
                          min={0.1}
                          step="any"
                          aria-label="Lebar ruangan (m)"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-slate-600">Luas Ruangan (m²)</label>
                        <input
                          value={formLuas}
                          onChange={(e) => handleDraftLuas(e.target.value)}
                          inputMode="decimal"
                          min={0.1}
                          step="any"
                          aria-label="Luas ruangan (m²)"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Lantai: {selectedDraft.floor} · Geser/ubah ukuran rectangle di denah untuk memindahkan/mengubah default.
                    </p>

                    <div className="mt-3">
                      <label className="block text-xs font-medium text-slate-600">
                        Foto lokasi ruangan (opsional · maks 5)
                      </label>
                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,.bmp"
                        multiple
                        disabled={(draftPhotos[selectedDraft.room_id]?.length ?? 0) >= 5}
                        onChange={(e) => {
                          handleDraftPhotosPicked(selectedDraft.room_id, Array.from(e.target.files ?? []));
                          e.target.value = '';
                        }}
                        className="mt-1 w-full rounded-lg border border-dashed border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-200 file:px-2 file:py-1 file:text-xs file:font-medium hover:file:bg-slate-300 disabled:opacity-50"
                      />
                      {(draftPhotoUrls[selectedDraft.room_id]?.length ?? 0) > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {draftPhotoUrls[selectedDraft.room_id]!.map((url, i) => (
                            <li key={url} className="flex items-center justify-between gap-2 rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                              <span className="truncate">📷 {draftPhotos[selectedDraft.room_id]?.[i]?.name ?? `Foto ${i + 1}`}</span>
                              <button
                                type="button"
                                aria-label={`Hapus foto ${i + 1}`}
                                onClick={() => removeDraftPhoto(selectedDraft.room_id, i)}
                                className="rounded px-1 font-semibold text-red-400 hover:bg-red-50 hover:text-red-600"
                              >
                                ✕
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-1 text-[11px] text-slate-400">
                        Foto tampil di galeri detail ruangan pada peta publik.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={saveSelectedDraft}
                      disabled={savingDraft || !formCode.trim()}
                      className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {savingDraft ? 'Menyimpan…' : `Simpan Ruangan ${formCode.trim() || selectedDraft.room_code}`}
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
