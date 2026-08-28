import { Link } from 'react-router-dom';
import type { Room } from '../types.ts';
import { formatRupiah } from '../types.ts';

export default function FormView({
  room,
  error,
  submitting,
  attachments,
  setAttachments,
  onSubmit,
}: {
  room: Room;
  error: string | null;
  submitting: boolean;
  attachments: File[];
  setAttachments: (f: File[]) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="bg-brand px-4 py-4 text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm hover:opacity-80">
            ← Kembali ke peta
          </Link>
          <span className="text-sm font-semibold">Form Pengajuan Sewa</span>
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4">
        <div className="mt-5 rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ruangan yang dipilih</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{room.name}</h1>
              <p className="text-sm text-slate-500">
                {room.room_code} · {room.floor} · {room.zone} · {room.size.luas_m2 === 0 ? 'N/A' : `${room.size.luas_m2} m²`}
              </p>
            </div>
            <p className="text-sm font-semibold text-emerald-600">{formatRupiah(room.price)}</p>
          </div>
          {room.status === 'terisi' && (
            <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-600">
              ⚠️ Ruangan ini sudah terisi dan tidak menerima pengajuan baru.
            </p>
          )}
          {room.status !== 'terisi' && (room.pending_requests ?? 0) > 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
              ℹ️ Sudah ada {room.pending_requests} pengajuan untuk ruangan ini. Pengajuan Anda tetap
              diproses — admin akan menyetujui salah satu tiket.
            </p>
          )}
        </div>

        <form onSubmit={onSubmit} className="mt-4 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-700">Data Calon Penyewa</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Nama Brand / Perusahaan *" name="brand_name" required placeholder="contoh: Kopi Nusantara" />
            <Field label="Nama PIC *" name="pic_name" required placeholder="Nama lengkap PIC" />
            <Field label="No. HP / WhatsApp *" name="contact_phone" required type="tel" placeholder="08xx-xxxx-xxxx" />
            <Field label="Email" name="contact_email" type="email" placeholder="nama@perusahaan.id" />
          </div>

          <h2 className="mt-5 text-sm font-bold text-slate-700">Kebutuhan Sewa</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Durasi (bulan)" name="duration_months" type="number" min={1} defaultValue={3} required />
            <Field label="Rencana mulai sewa" name="start_date" type="date" required />
            <Field label="Perkiraan budget (opsional)" name="budget" placeholder="contoh: 4-6 juta/bulan" />
          </div>

          <div className="mt-3">
            <label className="block text-sm font-medium text-slate-700">Catatan tambahan (opsional)</label>
            <textarea
              name="notes"
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Ceritakan kebutuhan Anda, mis. lokasi dekat pintu masuk gate 2…"
            />
          </div>

          <div className="mt-3">
            <label className="block text-sm font-medium text-slate-700">
              Dokumen pendukung (opsional, maks 5 file · 8MB/file)
            </label>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(e) => setAttachments(Array.from(e.target.files ?? []))}
              className="mt-1 w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-300"
            />
            {attachments.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">{attachments.map((f) => f.name).join(', ')}</p>
            )}
          </div>

          {error && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? 'Mengirim…' : 'Kirim Pengajuan'}
          </button>
          <p className="mt-2 text-center text-xs text-slate-400">
            Tanpa login — cukup isi data &amp; dapatkan nomor tiket untuk tracking.
          </p>
        </form>
      </div>
    </div>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input
        {...rest}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />
    </div>
  );
}