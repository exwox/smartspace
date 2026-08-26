import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchRoom, submitRequest } from '../api.ts';
import SuccessView from '../components/SuccessView.tsx';
import FormView from '../components/FormView.tsx';
import type { Room, RentalRequest } from '../types.ts';

export default function RequestFormPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [result, setResult] = useState<RentalRequest | null>(null);

  useEffect(() => {
    if (!roomId) return;
    fetchRoom(roomId)
      .then((r) => setRoom(r.room))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [roomId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!room) return;
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('room_id', room.room_id);
    attachments.forEach((f) => fd.append('attachments', f));
    try {
      const res = await submitRequest(fd);
      setResult(res.request);
    } catch (err: any) {
      setError(err.message ?? 'Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Memuat…</div>;
  }

  if (error && !room) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-slate-600">{error}</p>
        <Link to="/map" className="rounded-lg bg-brand px-4 py-2 text-sm text-white hover:bg-brand-light">
          ← Kembali ke peta
        </Link>
      </div>
    );
  }

  if (!room) return null;

  if (result) {
    return (
      <SuccessView
        ticketNo={result.ticket_no}
        roomCode={room.room_code}
        roomName={room.name}
        brand={result.brand_name}
        duration={result.duration_months}
      />
    );
  }

  return (
    <FormView
      room={room}
      error={error}
      submitting={submitting}
      attachments={attachments}
      setAttachments={setAttachments}
      onSubmit={handleSubmit}
    />
  );
}