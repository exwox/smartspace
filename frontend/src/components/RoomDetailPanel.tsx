import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Room } from '../types.ts';
import { STATUS_LABEL, STATUS_COLOR, formatRupiah, formatDate, displayStatus, canApplyRoom } from '../types.ts';

interface Props {
  room: Room | null;
  onClose: () => void;
}

export default function RoomDetailPanel({ room, onClose }: Props) {
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    setActivePhoto(0);
  }, [room?.room_id]);

  if (!room) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-slate-400">
        <span className="text-4xl">🗺️</span>
        <p className="text-sm">Klik sebuah ruangan di peta<br />untuk melihat detailnya</p>
        <p className="mt-2 text-xs text-slate-300">Hijau = kosong · Merah = terisi · Kuning = proses</p>
      </div>
    );
  }

  const effectiveStatus = displayStatus(room);
  const pendingCount = room.pending_requests ?? 0;
  const statusBadge = (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: STATUS_COLOR[effectiveStatus] + '22', color: STATUS_COLOR[effectiveStatus] }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[effectiveStatus] }} />
      {STATUS_LABEL[effectiveStatus]}
    </span>
  );

  const available = canApplyRoom(room);

  return (
    <div className="thin-scroll flex h-full flex-col overflow-y-auto p-4">
      {/* judul */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">{room.name}</h2>
            {statusBadge}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {room.room_code} · {room.floor} · {room.zone}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          aria-label="Tutup"
        >
          ✕
        </button>
      </div>

      {/* galeri foto ruangan */}
      {room.photos && room.photos.length > 0 && (
        <div className="mt-4">
          <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            <img
              src={room.photos[activePhoto] ?? room.photos[0]}
              alt={`Foto ${room.name}`}
              className="h-full w-full object-cover"
            />
          </div>
          {room.photos.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {room.photos.map((photo, index) => (
                <button
                  key={photo}
                  type="button"
                  onClick={() => setActivePhoto(index)}
                  className={`h-14 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${
                    activePhoto === index ? 'border-brand' : 'border-transparent'
                  }`}
                  aria-label={`Lihat foto ${index + 1}`}
                >
                  <img src={photo} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ukuran */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-[11px] text-slate-500">Ukuran (m)</p>
          <p className="text-sm font-semibold text-slate-800">
            {room.size.panjang} × {room.size.lebar}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-[11px] text-slate-500">Luas</p>
          <p className="text-sm font-semibold text-slate-800">{room.size.luas_m2} m²</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-[11px] text-slate-500">Harga</p>
          <p className="text-sm font-semibold text-slate-800">{formatRupiah(room.price)}</p>
        </div>
      </div>

      {/* tenant aktif */}
      {room.current_tenant && room.active_lease && (
        <div className="mt-4 rounded-lg border border-red-100 bg-red-50/60 p-3">
          <p className="text-xs font-semibold text-red-700">Sedang terisi oleh</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-800">{room.current_tenant.brand_name}</p>
          <p className="mt-0.5 text-xs text-slate-600">
            {formatDate(room.active_lease.start_date)} – {formatDate(room.active_lease.end_date)}
          </p>
          {room.active_lease.tenant && (
            <p className="mt-1 text-xs text-slate-500">PIC: {room.active_lease.tenant.pic_name}</p>
          )}
        </div>
      )}

      {/* info antrean tiket (multi-pengajuan per ruangan) */}
      {!available && pendingCount > 0 && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          🎫 {pendingCount} pengajuan sedang ditinjau admin untuk ruangan ini. Anda tetap dapat mengirim
          pengajuan — admin yang memilih tiket mana yang disetujui.
        </p>
      )}

      {/* tombol ajukan sewa — aktif selama ruangan belum terisi */}
      {available && (
        <Link
          to={`/sewa/${room.room_id}`}
          className="mt-4 block rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-bold text-white shadow hover:bg-emerald-700"
        >
          {pendingCount > 0 ? 'Ikut Mengajukan Sewa →' : 'Ajukan Sewa →'}
        </Link>
      )}
      {!available && (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          Ruangan ini sudah terisi. Hubungi admin untuk informasi ruangan serupa.
        </p>
      )}

      {/* catatan */}
      {room.notes && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-500">Catatan</p>
          <p className="mt-1 text-sm text-slate-700">{room.notes}</p>
        </div>
      )}

      {/* histori sewa */}
      {room.history && room.history.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-500">Riwayat Penyewa</p>
          <ul className="mt-1 space-y-2">
            {room.history.map((h) => (
              <li key={h.lease_id} className="rounded-lg border border-slate-100 bg-white p-2.5 text-sm shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">
                    {h.tenant?.brand_name ?? 'Tenant'}
                    {h.status === 'selesai' && <span className="ml-1 text-xs font-normal text-slate-400">(selesai)</span>}
                    {h.status === 'dibatalkan' && <span className="ml-1 text-xs font-normal text-slate-400">(dibatalkan)</span>}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatDate(h.start_date)} – {formatDate(h.end_date)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
