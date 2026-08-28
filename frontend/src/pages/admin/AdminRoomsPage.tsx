import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adminDeleteAllRooms,
  adminDeleteRoom,
  adminDownloadRoomsBackup,
  adminFetchRooms,
  adminRestoreRoomsBackup,
  adminSaveRoom,
} from '../../api.ts';
import type { Room } from '../../types.ts';
import { STATUS_COLOR, STATUS_LABEL, formatRupiah } from '../../types.ts';
import RoomFormModal from '../../components/RoomFormModal.tsx';

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Room | null | undefined>(undefined); // undefined = form tersembunyi
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const restoreInput = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    const r = await adminFetchRooms();
    setRooms(r.rooms);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, [reload]);

  const handleDelete = async (room: Room) => {
    if (!window.confirm(`Hapus ruangan ${room.room_code} (${room.name})?`)) return;
    await adminDeleteRoom(room.room_id);
    reload();
  };

  // Hapus seluruh data ruang komersial, termasuk tenant/brand yang tersimpan.
  const handleDeleteAll = async () => {
    const count = rooms.length;
    if (
      !window.confirm(
        `Hapus SEMUA ruangan (${count})?\n` +
          'Tindakan ini tidak bisa dibatalkan dan akan menghapus juga semua tenant/brand, ' +
          'dokumen tenant, denah/lantai, lease, serta permintaan sewa.',
      )
    )
      return;
    setDeleting(true);
    setActionError(null);
    try {
      await adminDeleteAllRooms();
      await reload();
    } catch (e: any) {
      setActionError(e.message ?? 'Gagal menghapus semua ruangan');
    } finally {
      setDeleting(false);
    }
  };

  const handleBackup = async () => {
    setBackingUp(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const { blob, filename } = await adminDownloadRoomsBackup();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setActionMessage(`${rooms.length} ruangan berhasil dibackup ke ${filename}`);
    } catch (e: any) {
      setActionError(e.message ?? 'Gagal membuat backup ruangan');
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestoreFile = async (file?: File) => {
    if (!file) return;
    if (!window.confirm('Restore akan mengganti seluruh data ruangan saat ini dengan isi backup JSON. Lanjutkan?')) {
      if (restoreInput.current) restoreInput.current.value = '';
      return;
    }
    setRestoring(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await adminRestoreRoomsBackup(file);
      await reload();
      setActionMessage(result.message);
    } catch (e: any) {
      setActionError(e.message ?? 'Gagal restore backup ruangan');
    } finally {
      setRestoring(false);
      if (restoreInput.current) restoreInput.current.value = '';
    }
  };

  if (loading) return <div className="p-8 text-slate-500">Memuat ruangan…</div>;
  if (error) return <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>;

  const counts = { kosong: 0, terisi: 0, proses: 0 };
  rooms.forEach((r) => (counts[r.status] += 1));

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Kelola Ruangan</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {rooms.length} ruangan · {counts.kosong} kosong · {counts.terisi} terisi · {counts.proses} proses
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleBackup}
            disabled={backingUp || restoring}
            className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {backingUp ? 'Membackup…' : '⬇️ Backup JSON'}
          </button>
          <input
            ref={restoreInput}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => handleRestoreFile(event.target.files?.[0])}
          />
          <button
            onClick={() => restoreInput.current?.click()}
            disabled={restoring || backingUp}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {restoring ? 'Merestore…' : '⬆️ Restore JSON'}
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={deleting}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Hapus semua ruangan, tenant/brand, denah/lantai, lease, dan permintaan terkait"
          >
            {deleting ? 'Menghapus…' : '🗑️ Hapus Semua'}
          </button>
          <button
            onClick={() => setEditing(null)}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-light"
          >
            + Tambah Ruangan
          </button>
        </div>
      </div>

      {actionError && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {actionError}
        </div>
      )}
      {actionMessage && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {actionMessage}
        </div>
      )}

      <p className="mt-3 text-xs text-slate-500">
        Backup JSON menyimpan data dan geometri ruangan. File foto tidak disalin ke JSON; referensinya dipulihkan hanya jika foto masih tersedia di perangkat ini.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rooms.map((room) => (
          <div key={room.room_id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-slate-900">{room.name}</h2>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: STATUS_COLOR[room.status] + '22', color: STATUS_COLOR[room.status] }}
                  >
                    {STATUS_LABEL[room.status]}
                  </span>
                  {(room.pending_requests ?? 0) > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      🎫 {room.pending_requests} tiket
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {room.room_code} · {room.floor} · {room.zone}
                </p>
              </div>
              <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                {room.size.luas_m2 === 0 ? 'N/A' : `${room.size.luas_m2} m²`}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
              <p>Ukuran: {room.size.panjang === 0 || room.size.lebar === 0 ? 'N/A' : `${room.size.panjang} × ${room.size.lebar} m`}</p>
              <p className="text-right">{formatRupiah(room.price)}</p>
            </div>
            {room.current_tenant && (
              <p className="mt-1 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
                👤 {room.current_tenant.brand_name}
              </p>
            )}

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setEditing(room)}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                ✏️ Edit
              </button>
              <button
                onClick={() => handleDelete(room)}
                className="flex-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                🗑️ Hapus
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing !== undefined && (
        <RoomFormModal
          room={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            reload();
          }}
        />
      )}
    </div>
  );
}
