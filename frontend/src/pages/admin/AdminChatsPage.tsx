import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adminDeleteChat,
  adminFetchChat,
  adminFetchChats,
  adminReplyChat,
  adminSetChatAgentMode,
  adminSetChatStatus,
} from '../../api.ts';
import type { ChatConversation } from '../../types.ts';
import MessageText from '../../components/MessageText.tsx';

function formatChatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function initials(name: string): string {
  const t = name.trim() || 'Pengunjung';
  return t
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export default function AdminChatsPage() {
  const [chats, setChats] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [active, setActive] = useState<ChatConversation | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);

  const reloadList = useCallback(async () => {
    try {
      const r = await adminFetchChats(filter === 'all' ? undefined : filter);
      setChats(r.chats);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memuat percakapan');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Daftar percakapan — refresh tiap 5 detik
  useEffect(() => {
    let alive = true;
    void reloadList();
    const id = window.setInterval(() => {
      if (alive) void reloadList();
    }, 5000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [reloadList]);

  // Thread aktif — refresh tiap 4 detik (sekaligus menandai pesan dibaca di server)
  useEffect(() => {
    let alive = true;
    if (!selectedId) {
      setActive(null);
      return;
    }
    const tick = async () => {
      try {
        const r = await adminFetchChat(selectedId);
        if (!alive) return;
        setActive(r.conversation);
        setError(null);
      } catch (e: any) {
        if (alive) setError(e?.message ?? 'Gagal memuat percakapan');
      }
    };
    void tick();
    const id = window.setInterval(tick, 4000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [selectedId]);

  // Auto-scroll bawah saat pesan baru tampil
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active?.messages.length, selectedId]);

  const sendReply = async () => {
    const text = draft.trim();
    if (!text || !selectedId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await adminReplyChat(selectedId, text);
      setActive(r.conversation);
      setDraft('');
      await reloadList();
    } catch (e: any) {
      setError(e?.message ?? 'Gagal mengirim balasan');
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const next = active.status === 'open' ? 'closed' : 'open';
      const r = await adminSetChatStatus(active.conversation_id, next);
      setActive(r.conversation);
      await reloadList();
    } catch (e: any) {
      setError(e?.message ?? 'Gagal mengubah status percakapan');
    } finally {
      setBusy(false);
    }
  };

  /** Switch mode Manual ↔ AI Agent untuk percakapan aktif. */
  const toggleAgent = async () => {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      const r = await adminSetChatAgentMode(active.conversation_id, active.agent_active === false);
      setActive(r.conversation);
      await reloadList();
    } catch (e: any) {
      setError(e?.message ?? 'Gagal mengubah mode percakapan');
    } finally {
      setBusy(false);
    }
  };

  const removeChat = async () => {
    if (!active || !window.confirm(`Hapus percakapan dengan ${active.visitor_name || 'pengunjung'}?`)) return;
    setBusy(true);
    try {
      await adminDeleteChat(active.conversation_id);
      setSelectedId(null);
      setActive(null);
      await reloadList();
    } catch (e: any) {
      setError(e?.message ?? 'Gagal menghapus percakapan');
    } finally {
      setBusy(false);
    }
  };

  const openCount = chats.filter((c) => c.status === 'open').length;
  const unreadMessages = chats.reduce((sum, c) => sum + (c.unread_for_admin ?? 0), 0);

  if (loading) return <div className="p-8 text-slate-500">Memuat percakapan…</div>;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Pesan Chat</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {openCount} percakapan terbuka · {unreadMessages} pesan belum dibaca
            </p>
          </div>
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs font-medium">
            {(['all', 'open', 'closed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 transition ${
                  filter === f ? 'bg-brand text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {f === 'all' ? 'Semua' : f === 'open' ? 'Terbuka' : 'Ditutup'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 md:mx-6">{error}</p>}

      {/* Isi: daftar kiri + thread kanan */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Daftar percakapan */}
        <aside
          className={`w-full shrink-0 overflow-y-auto border-r border-slate-200 bg-white md:block md:w-80 ${
            selectedId ? 'hidden' : ''
          }`}
        >
          {chats.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-400">
              Belum ada percakapan.
              <br />
              Chat dari widget pojok kanan bawah situs publik akan muncul di sini.
            </p>
          )}
          {chats.map((c) => {
            const selected = c.conversation_id === selectedId;
            return (
              <button
                key={c.conversation_id}
                onClick={() => setSelectedId(c.conversation_id)}
                className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${
                  selected ? 'bg-blue-50/60' : ''
                }`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">
                  {initials(c.visitor_name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">
                      {c.visitor_name || 'Pengunjung'}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400">{formatChatTime(c.updated_at)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {c.last_message
                      ? `${c.last_message.sender === 'admin' ? 'Anda: ' : ''}${c.last_message.body}`
                      : '—'}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5">
                    {(c.agent_active ?? true) && c.status === 'open' && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        🤖 Agent
                      </span>
                    )}
                    {c.status === 'closed' && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        Ditutup
                      </span>
                    )}
                    {(c.unread_for_admin ?? 0) > 0 && (
                      <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                        {c.unread_for_admin}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </aside>

        {/* Thread percakapan */}
        <section
          className={`min-w-0 flex-1 flex-col overflow-hidden bg-slate-50 md:flex ${
            selectedId ? 'flex' : 'hidden'
          }`}
        >
          {!active ? (
            <div className="grid flex-1 place-items-center p-8 text-center text-sm text-slate-400">
              Pilih percakapan di kiri untuk melihat &amp; membalas pesan.
            </div>
          ) : (
            <>
              {/* Info pengunjung + aksi */}
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">
                    {initials(active.visitor_name)}
                  </span>
                  <div className="leading-tight">
                    <p className="text-sm font-bold text-slate-900">{active.visitor_name || 'Pengunjung'}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {active.visitor_email || 'Tanpa email'} · halaman {active.page_url ?? '-'}
                    </p>
                    <p className="text-[11px] text-slate-400">Mulai {formatChatTime(active.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Switch mode Manual ↔ AI Agent */}
                  <span
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                      (active.agent_active ?? true) ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {(active.agent_active ?? true) ? '🤖 Mode Agent' : '🙋 Mode Manual'}
                  </span>
                  <button
                    onClick={() => void toggleAgent()}
                    disabled={busy}
                    className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
                  >
                    {(active.agent_active ?? true) ? 'Ambil Alih Manual' : 'Serahkan ke Agent'}
                  </button>
                  <button
                    onClick={() => void toggleStatus()}
                    disabled={busy}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-50 ${
                      active.status === 'open'
                        ? 'bg-slate-500 hover:bg-slate-600'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {active.status === 'open' ? 'Tandai Selesai' : 'Buka Kembali'}
                  </button>
                  <button
                    onClick={() => void removeChat()}
                    disabled={busy}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    Hapus
                  </button>
                  {/* Tombol kembali ke daftar di mobile */}
                  <button
                    onClick={() => setSelectedId(null)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 md:hidden"
                  >
                    ← Daftar
                  </button>
                </div>
              </div>

              {/* Pesan */}
              <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 md:px-6">
                {active.messages.map((m) => {
                  if (m.sender === 'system') {
                    return (
                      <p key={m.message_id} className="text-center text-[11px] italic leading-relaxed text-slate-400">
                        {m.body}
                      </p>
                    );
                  }
                  const mine = m.sender === 'admin';
                  return (
                    <div key={m.message_id} className={`flex items-end gap-2 ${mine ? 'justify-end' : ''}`}>
                      {!mine && (
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">
                          {initials(active.visitor_name)}
                        </span>
                      )}
                      {mine && (
                        <span
                          title="Admin Smart Space"
                          className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-white ring-1 ring-slate-200"
                        >
                          <img src="/brand/logo.svg" alt="Admin" className="h-7 w-7" />
                        </span>
                      )}
                      <div
                        className={`max-w-[70%] px-3.5 py-2 shadow-sm ${
                          mine
                            ? 'rounded-2xl rounded-br-md bg-brand'
                            : 'rounded-2xl rounded-bl-md border border-slate-200 bg-white'
                        }`}
                      >
                        <p
                          className={`whitespace-pre-wrap break-words text-sm ${mine ? 'text-white' : 'text-slate-800'}`}
                        >
                          <MessageText text={m.body} />
                        </p>
                        <p className="mt-0.5 text-right text-[10px] text-slate-400">
                          {mine ? 'Anda · ' : ''}
                          {formatChatTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Kotak balasan */}
              <div className="border-t border-slate-200 bg-white px-4 py-3 md:px-6">
                {active.status === 'closed' && (
                  <p className="mb-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                    Percakapan ditutup — buka kembali untuk membalas.
                  </p>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    rows={2}
                    disabled={active.status === 'closed' || busy}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void sendReply();
                      }
                    }}
                    placeholder="Tulis balasan… (Enter kirim)"
                    className="max-h-32 flex-1 resize-none rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                  />
                  <button
                    onClick={() => void sendReply()}
                    disabled={!draft.trim() || busy || active.status === 'closed'}
                    className="h-10 shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-light disabled:opacity-40"
                  >
                    Kirim
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}