import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MapCanvas from '../components/MapCanvas.tsx';
import RoomDetailPanel from '../components/RoomDetailPanel.tsx';
import { fetchRooms, fetchFloors } from '../api.ts';
import type { Room, FloorPlan } from '../types.ts';

export default function PublicMapPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [floors, setFloors] = useState<FloorPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Room | null>(null);
  const [floorFilter, setFloorFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [mobileSheet, setMobileSheet] = useState(false);

  const reload = useCallback(async () => {
    const [r, f] = await Promise.all([fetchRooms(), fetchFloors()]);
    setRooms(r.rooms);
    setFloors(f.floors);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const shownRooms = useMemo(() => {
    return rooms.filter((room) => {
      if (floorFilter && room.floor !== floorFilter) return false;
      if (statusFilter !== 'all' && room.status !== statusFilter) return false;
      if (search && !`${room.room_code} ${room.name}`.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [rooms, floorFilter, statusFilter, search]);

  const selectRoom = (room: Room | null) => {
    if ('ontouchstart' in window) {
      setSelected(room);
      setMobileSheet(!!room);
    } else {
      setSelected(room);
    }
  };

  const floorsList = useMemo(() => {
    const s = new Set([...rooms.map((r) => r.floor), ...floors.map((f) => f.floor)]);
    return Array.from(s).filter(Boolean).sort();
  }, [rooms, floors]);

  useEffect(() => {
    if (!floorFilter && floorsList.length > 0) setFloorFilter(floorsList[0]);
    if (floorFilter && floorsList.length > 0 && !floorsList.includes(floorFilter)) setFloorFilter(floorsList[0]);
  }, [floorFilter, floorsList]);
return (
    <div className="flex h-full flex-col">
      {/* header */}
      <header className="z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-lg text-white">🧭</span>
          <div className="leading-tight">
            <h1 className="text-base font-bold text-slate-900 sm:text-lg">Smart Space</h1>
            <p className="hidden text-xs text-slate-500 sm:block">Peta Sewa Ruangan Terminal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="hidden rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:inline-flex"
          >
            Beranda
          </Link>
          <Link
            to="/tracking"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cek Tiket
          </Link>
          <Link
            to="/admin/login"
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-light"
          >
            Admin
          </Link>
        </div>
      </header>

      {/* konten: peta + panel */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* peta */}
        <div className="relative min-h-[52vh] flex-1 md:min-h-0">
          {loading ? (
            <div className="flex h-full items-center justify-center text-slate-500">Memuat peta…</div>
          ) : (
            <MapCanvas
              rooms={shownRooms}
              floors={floors}
              selectedRoomId={selected?.room_id ?? null}
              onSelect={selectRoom}
              interactive
              highlight={selected?.room_id ?? null}
              activeFloorName={floorFilter || null}
            />
          )}

          {/* filter */}
          <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2 rounded-lg bg-white/95 p-2 shadow-md">
            <select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none"
            >
                            {floorsList.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none"
            >
              <option value="all">Semua status</option>
              <option value="kosong">Kosong</option>
              <option value="terisi">Terisi</option>
              <option value="proses">Dalam proses</option>
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode/nama…"
              className="w-28 rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none sm:w-36"
            />
          </div>
        </div>

        {/* desktop: side panel */}
        <aside className="hidden w-80 shrink-0 border-l border-slate-200 bg-white md:block lg:w-96">
          <RoomDetailPanel room={selected} onClose={() => setSelected(null)} />
        </aside>
      </div>

      {/* mobile: bottom sheet */}
      {mobileSheet && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileSheet(false)} />
          <div className="thin-scroll absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300" />
            <RoomDetailPanel room={selected} onClose={() => setMobileSheet(false)} />
          </div>
        </div>
      )}
    </div>
  );
}