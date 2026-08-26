import { Link } from 'react-router-dom';

export default function SuccessView({
  ticketNo,
  roomCode,
  roomName,
  brand,
  duration,
}: {
  ticketNo: string;
  roomCode: string;
  roomName: string;
  brand: string;
  duration: number;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl">✅</div>
        <h1 className="mt-4 text-lg font-bold text-slate-900">Pengajuan Terkirim!</h1>
        <p className="mt-1 text-sm text-slate-600">Simpan nomor tiket berikut untuk memantau status pengajuan.</p>
        <div className="mt-4 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase text-emerald-700">Nomor Tiket</p>
          <p className="mt-1 select-all text-xl font-bold tracking-wide text-emerald-800">{ticketNo}</p>
        </div>
        <div className="mt-4 space-y-2 text-left text-sm text-slate-600">
          <p>
            <span className="font-semibold">Ruangan:</span> {roomCode} — {roomName}
          </p>
          <p>
            <span className="font-semibold">Brand:</span> {brand}
          </p>
          <p>
            <span className="font-semibold">Durasi:</span> {duration} bulan
          </p>
          <p>
            <span className="font-semibold">Status:</span>{' '}
            <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              Menunggu review admin
            </span>
          </p>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            to={`/tracking?t=${ticketNo}`}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-light"
          >
            Lacak Status Pengajuan
          </Link>
          <Link
            to="/"
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Kembali ke peta
          </Link>
        </div>
      </div>
    </div>
  );
}