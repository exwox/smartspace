import { useEffect, useMemo, useState } from 'react';
import MapCanvas from './MapCanvas.tsx';
import { adminSaveRoom, adminUploadRoomPhotos, fetchFloors } from '../api.ts';
import type { Room, FloorPlan } from '../types.ts';
import { resizedRectanglePoints } from '../types.ts';

interface Props {
  room: Room | null;
  onClose: () => void;
  onSaved: () => void;
}

const inputCls =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 bg-white';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

export default function RoomFormModal({ room, onClose, onSaved }: Props) {
  const isEdit = !!room;
  const [name, setName] = useState(room?.name ?? '');
  const [code, setCode] = useState(room?.room_code ?? '');
  const [floor, setFloor] = useState(room?.floor ?? 'Lantai 1');
  const [zone, setZone] = useState(room?.zone ?? 'Zona A');
  const [price, setPrice] = useState(String(room?.price ?? 0));
  const [notes, setNotes] = useState(room?.notes ?? '');
  const [status, setStatus] = useState(room?.status ?? 'kosong');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [floors, setFloors] = useState<FloorPlan[]>([]);
  const [previewRoom, setPreviewRoom] = useState<Room | null>(room);
  const [existingPhotos, setExistingPhotos] = useState<string[]>(room?.photos ?? []);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);

  // Ukuran bisa diedit langsung (geometry rectangle): mengubah panjang/lebar me-resize geometri
  const [sizePanjang, setSizePanjang] = useState(room ? String(room.size.panjang) : '');
  const [sizeLebar, setSizeLebar] = useState(room ? String(room.size.lebar) : '');

  const isRectGeometry =
    previewRoom?.geometry.type === 'rectangle' && (previewRoom.geometry.points?.length ?? 0) >= 8;

  const applyRoomSize = (panjang: number, lebar: number) => {
    setPreviewRoom((current) => {
      if (!current || current.geometry.type !== 'rectangle') return current;
      const points = resizedRectanglePoints(current.geometry.points, panjang, lebar);
      const p = Math.round(panjang * 100) / 100;
      const l = Math.round(lebar * 100) / 100;
      return {
        ...current,
        geometry: { ...current.geometry, points },
        size: { panjang: p, lebar: l, luas_m2: Math.round(p * l * 100) / 100 },
      };
    });
  };

  const handleSizeInput = (raw: string, otherRaw: string, setSelf: (value: string) => void) => {
    setSelf(raw);
    const p = Number(raw);
    const l = Number(otherRaw);
    if (!Number.isFinite(p) || !Number.isFinite(l) || p <= 0 || l <= 0) return;
    applyRoomSize(p, l);
  };

  const newPhotoPreviews = useMemo(
    () => newPhotos.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [newPhotos],
  );

  useEffect(() => {
    return () => newPhotoPreviews.forEach(({ url }) => URL.revokeObjectURL(url));
  }, [newPhotoPreviews]);

  useEffect(() => {
    fetchFloors().then((r) => setFloors(r.floors)).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const geometry = previewRoom?.geometry ?? { type: 'rectangle' as const, points: [] as number[] };
      const saved = await adminSaveRoom(
        { room_code: code, name, floor, zone, price: Number(price) || 0, notes, status, geometry, photos: existingPhotos },
        room?.room_id,
      );
      if (newPhotos.length > 0) {
        await adminUploadRoomPhotos(saved.room.room_id, newPhotos);
      }
      onSaved();
    } catch (e: any) {
      setSaveError(e.message ?? 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-3">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-bold text-slate-900">
            {isEdit ? `Edit Ruangan ${room?.room_code ?? ''}` : 'Tambah Ruangan Baru'}
          </h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
            ✕
          </button>
        </div>
        <div className="thin-scroll flex-1 overflow-y-auto p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <Field label="Nama Ruangan">
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="contoh: Booth A-01" />
              </Field>
              <Field label="Kode Ruangan">
                <input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} placeholder="contoh: A-01" />
              </Field>
              <Field label="Lokasi / Lantai">
                <input value={floor} onChange={(e) => setFloor(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Zona">
                <input value={zone} onChange={(e) => setZone(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Harga Sewa / bulan (0 = hubungi admin)">
                <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min={0} className={inputCls} />
              </Field>
              {isEdit && (
                <Field label="Status">
                  <select value={status} onChange={(e) => setStatus(e.target.value as 'kosong' | 'terisi' | 'proses')} className={inputCls}>
                    <option value="kosong">Kosong</option>
                    <option value="proses">Dalam proses</option>
                    <option value="terisi">Terisi</option>
                  </select>
                </Field>
              )}
              <Field label={isRectGeometry ? 'Ukuran Panjang × Lebar (m)' : 'Ukuran (terhitung otomatis)'}>
                {previewRoom && isRectGeometry ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      value={sizePanjang}
                      onChange={(e) => handleSizeInput(e.target.value, sizeLebar, setSizePanjang)}
                      type="number"
                      min={1}
                      step="any"
                      aria-label="Panjang ruangan (m)"
                      className={`${inputCls} mt-0`}
                    />
                    <span className="text-slate-400">×</span>
                    <input
                      value={sizeLebar}
                      onChange={(e) => handleSizeInput(sizePanjang, e.target.value, setSizeLebar)}
                      type="number"
                      min={1}
                      step="any"
                      aria-label="Lebar ruangan (m)"
                      className={`${inputCls} mt-0`}
                    />
                    <span className="whitespace-nowrap text-xs text-slate-500">
                      = {previewRoom.size.luas_m2} m²
                    </span>
                  </div>
                ) : (
                  <p className={`${inputCls} text-slate-500`}>
                    {previewRoom?.size
                      ? `${previewRoom.size.panjang} × ${previewRoom.size.lebar} m · ${previewRoom.size.luas_m2} m² (otomatis dari polygon)`
                      : 'Belum ada denah'}
                  </p>
                )}
              </Field>
              <Field label="Catatan">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} />
              </Field>
              <Field label="Foto Ruangan (maksimal 5)">
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.bmp"
                  multiple
                  disabled={existingPhotos.length + newPhotos.length >= 5}
                  onChange={(e) => {
                    const selected = Array.from(e.target.files ?? []);
                    const available = Math.max(0, 5 - existingPhotos.length - newPhotos.length);
                    setNewPhotos((current) => [...current, ...selected.slice(0, available)]);
                    e.target.value = '';
                  }}
                  className="mt-1 w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-200 file:px-2 file:py-1 file:text-xs file:font-medium"
                />
                <p className="mt-1 text-xs text-slate-400">PNG, JPG, WEBP, atau BMP · maksimal 5 MB per foto.</p>
              </Field>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">Denah / Geometri</p>
              <div className="overflow-hidden rounded-xl border border-slate-200" style={{ height: 320 }}>
                <MapCanvas
                  rooms={previewRoom ? [previewRoom] : []}
                  floors={floors}
                  selectedRoomId={previewRoom?.room_id ?? null}
                  onSelect={() => {}}
                  activeFloorName={previewRoom?.floor ?? floor}
                  editor
                  onRoomsChange={(updated) => {
                    if (updated.length > 0) setPreviewRoom(updated[0]);
                  }}
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Geser ruangan untuk mengubah posisi di denah, atau edit ukurannya lewat input Panjang × Lebar.
              </p>
              {(existingPhotos.length > 0 || newPhotoPreviews.length > 0) && (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-medium text-slate-700">
                    Foto terpilih ({existingPhotos.length + newPhotos.length}/5)
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {existingPhotos.map((photo) => (
                      <PhotoPreview key={photo} src={photo} onRemove={() => setExistingPhotos((items) => items.filter((item) => item !== photo))} />
                    ))}
                    {newPhotoPreviews.map(({ file, url }) => (
                      <PhotoPreview key={`${file.name}-${file.lastModified}`} src={url} onRemove={() => setNewPhotos((items) => items.filter((item) => item !== file))} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {saveError && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-600">{saveError}</p>}
        </div>
        <div className="flex gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Batal
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim() || !code.trim()}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Buat Ruangan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PhotoPreview({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      <img src={src} alt="Foto ruangan" className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Hapus foto"
        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-xs text-white hover:bg-red-600"
      >
        ✕
      </button>
    </div>
  );
}
