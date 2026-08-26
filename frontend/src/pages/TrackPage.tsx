import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { trackRequest } from '../api.ts';
import type { RentalRequest } from '../types.ts';
import { formatDate } from '../types.ts';

const STEP_LABEL = {
  pending: 'Menunggu review admin',
  approved: 'Disetujui',
  rejected: 'Ditolak',
} as const;

const STEP_COLOR = {
  pending: 'bg-amber-100 text-amber-700 border-amber-300',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  rejected: 'bg-red-100 text-red-700 border-red-300',
} as const;

export default function TrackPage() {
  const [params] = useSearchParams();
  const [ticket, setTicket] = useState(params.get('t') ?? '');
  const [result, setResult] = useState<RentalRequest | null>(null);
  const [roomInfo, setRoomInfo] = useState<{ room_id: string; room_code: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async (t: string) => {
    if (!t.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setRoomInfo(null);
    try {
      const r = await trackRequest(t.trim());
      setResult(r.request);
      setRoomInfo(r.room);
    } catch (e: any) {
      setError(e.message ?? 'Tiket tidak ditemukan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = params.get('t');
    if (t) {
      setTicket(t);
      search(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-brand px-4 py-4 text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link to="/map" className="flex items-center gap-2 text-sm hover:opacity-80">← Kembali ke peta</Link>
          <span className="text-sm font-semibold">Tracking Pengajuan</span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">Cek Status Pengajuan</h1>
          <p className="mt-1 text-sm text-slate-500">Masukkan nomor tiket yang Anda terima saat mengajukan sewa.</p>
          <div className="mt-4 flex gap-2">
            <input
              value={ticket}
              onChange={(e) => setTicket(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search(ticket)}
              placeholder="contoh: SS-20240101-0003"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
            />
            <button
              onClick={() => search(ticket)}
              disabled={loading}
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-light disabled:opacity-60"
            >
              {loading ? 'Mencari…' : 'Cek'}
            </button>
          </div>
          {error && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-600">❌ {error}</p>}
        </div>
        {result && (
          <div className="mt-4 rounded-xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nomor Tiket</p>
                <p className="text-lg font-bold text-slate-900">{result.ticket_no}</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${STEP_COLOR[result.status]}`}>
                {STEP_LABEL[result.status]}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Info label="Ruangan" value={roomInfo ? `${roomInfo.room_code} — ${roomInfo.name}` : '-'} />
              <Info label="Brand" value={result.brand_name} />
              <Info label="PIC" value={result.pic_name} />
              <Info label="Durasi" value={`${result.duration_months} bulan`} />
              <Info label="Rencana mulai" value={formatDate(result.start_date)} />
              <Info label="Diajukan pada" value={formatDate(result.created_at)} />
            </div>

            {result.reject_reason && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p className="font-semibold">Alasan penolakan:</p>
                <p className="mt-1">{result.reject_reason}</p>
              </div>
            )}

            {result.status === 'approved' && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                ✅ Pengajuan Anda disetujui. Admin akan menghubungi Anda untuk proses selanjutnya
                (pembayaran dihubungi langsung oleh admin).
              </div>
            )}

            <p className="mt-4 text-xs text-slate-400">
              Diajukan {formatDate(result.created_at)}
              {result.reviewed_at && ` · Direview ${formatDateTime(result.reviewed_at)} oleh ${result.reviewed_by}`}
            </p>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-slate-200 bg-white/60 p-4 text-xs text-slate-400">
          <p className="font-semibold text-slate-500">Alur pengajuan</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>Kirim pengajuan dari peta → dapatkan nomor tiket</li>
            <li>Admin mereview data pengajuan Anda</li>
            <li>Disetujui → peta otomatis menampilkan ruangan "Terisi"</li>
            <li>Ditolak → status ruangan kembali "Kosong"</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-slate-800">{value}</p>
    </div>
  );
}

function formatDateTime(s: string): string {
  try {
    return new Date(s).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return s;
  }
}
