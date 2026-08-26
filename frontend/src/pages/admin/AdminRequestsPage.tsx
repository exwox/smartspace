import { useCallback, useEffect, useState } from 'react';
import { adminFetchRequests, adminReviewRequest } from '../../api.ts';
import type { RentalRequest } from '../../types.ts';
import { formatDate } from '../../types.ts';

const STATUS_STYLE = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
} as const;

const STATUS_TEXT = { pending: 'Pending', approved: 'Disetujui', rejected: 'Ditolak' } as const;

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<RentalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const r = await adminFetchRequests();
    setRequests(r.requests);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, [reload]);

  const review = async (req: RentalRequest, action: 'approve' | 'reject', reason = '') => {
    setBusyId(req.request_id);
    setError(null);
    try {
      await adminReviewRequest(req.request_id, action, reason);
      setRejecting(null);
      setRejectReason('');
      await reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="p-8 text-slate-500">Memuat pengajuan…</div>;

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-bold text-slate-900">Pengajuan Sewa</h1>
      <p className="mt-0.5 text-sm text-slate-500">
        {requests.filter((r) => r.status === 'pending').length} pengajuan menunggu review ·{' '}
        {requests.filter((r) => r.status !== 'pending').length} sudah diproses
      </p>

      {error && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          <span>{error}</span>
          <button onClick={() => { setError(null); reload(); }} className="rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold">
            Coba lagi
          </button>
        </div>
      )}

      {requests.length === 0 && !loading && (
        <div className="mt-10 text-center text-slate-400">
          <p className="text-4xl">📭</p>
          <p className="mt-2 text-sm">Belum ada pengajuan masuk.</p>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {requests.map((req) => (
          <div
            key={req.request_id}
            className={`rounded-xl bg-white p-4 shadow-sm ${req.status === 'pending' ? 'ring-2 ring-amber-200' : ''}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[req.status]}`}>
                    {STATUS_TEXT[req.status]}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">{req.ticket_no}</span>
                  <span className="text-xs text-slate-400">{formatDate(req.created_at)}</span>
                </div>
                <h2 className="mt-1.5 font-bold text-slate-900">{req.brand_name}</h2>
                <p className="text-sm text-slate-600">
                  {req.pic_name} · {req.contact_phone} · {req.contact_email}
                </p>
              </div>
              {req.room && (
                <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {req.room.room_code} — {req.room.name}
                </span>
              )}
            </div>

            <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
              <p><span className="text-slate-400">Durasi:</span> {req.duration_months} bulan (mulai {formatDate(req.start_date)})</p>
              <p><span className="text-slate-400">Budget:</span> {req.budget || '-'}</p>
              <p><span className="text-slate-400">Diajukan:</span> {formatDate(req.created_at)}</p>
            </div>

            {req.notes && <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-sm text-slate-600">💬 {req.notes}</p>}

            {req.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {req.attachments.map((a) => (
                  <a key={a} href={a} target="_blank" rel="noreferrer"
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-brand hover:bg-slate-50">
                    📎 Lihat dokumen
                  </a>
                ))}
              </div>
            )}

            {req.reject_reason && (
              <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">Alasan: {req.reject_reason}</p>
            )}

            {req.status === 'pending' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => review(req, 'approve')}
                  disabled={busyId === req.request_id}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  ✓ Approve &amp; tandai terisi
                </button>
                <button
                  onClick={() => setRejecting(req)}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  ✕ Tolak
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {rejecting && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="font-bold text-slate-900">Tolak pengajuan {rejecting.ticket_no}</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Alasan penolakan (akan tampil di tracking publik)…"
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setRejecting(null)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Batal
              </button>
              <button
                onClick={() => review(rejecting, 'reject', rejectReason)}
                disabled={busyId === rejecting.request_id}
                className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Tolak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
