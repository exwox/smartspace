import { useEffect, useRef, useState } from 'react';
import { fetchChatConversation, markChatRead, sendChatMessage } from '../api.ts';
import type { ChatConversation, ChatMessage } from '../types.ts';
import MessageText from './MessageText.tsx';

const LS_TOKEN = 'ss_chat_token';
const LS_NAME = 'ss_chat_name';
const LS_EMAIL = 'ss_chat_email';
const LS_SOUND = 'ss_chat_sound';

function newVisitorToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Widget chat ala CRM (Intercom/Zendesk style) melayang di pojok kanan bawah.
 * Tanpa login — pengunjung diidentifikasi lewat token acak di localStorage.
 * Data dikirim/diambil lewat REST polling (panel terbuka tiap 4 detik, tertutup tiap 15 detik).
 */
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [name, setName] = useState(() => localStorage.getItem(LS_NAME) ?? '');
  const [email, setEmail] = useState(() => localStorage.getItem(LS_EMAIL) ?? '');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(localStorage.getItem(LS_TOKEN));
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // ---- efek ketik & suara ----
  const convRef = useRef<ChatConversation | null>(null);
  const knownIdsRef = useRef<Set<string> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundOnRef = useRef(localStorage.getItem(LS_SOUND) !== 'off');
  const [soundOn, setSoundOn] = useState(soundOnRef.current);
  const [typed, setTyped] = useState<{ id: string; full: string; shown: number } | null>(null);

  /** Bangunkan AudioContext lewat interaksi pengguna (kebijakan autoplay browser). */
  const primeAudio = () => {
    try {
      const AC = window.AudioContext ?? (window as any).webkitAudioContext;
      if (AC && !audioCtxRef.current) audioCtxRef.current = new AC();
      void audioCtxRef.current?.resume().catch(() => {});
    } catch {
      /* WebAudio tidak tersedia */
    }
  };

  /** Bunyi "ting" lembut dua nada saat bot/admin membalas. */
  const playReplySound = () => {
    if (!soundOnRef.current) return;
    try {
      const AC = window.AudioContext ?? (window as any).webkitAudioContext;
      const ctx: AudioContext | null = audioCtxRef.current ?? (AC ? new AC() : null);
      if (!ctx) return;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      const t0 = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, t0);
      master.gain.exponentialRampToValueAtTime(0.16, t0 + 0.03);
      master.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
      master.connect(ctx.destination);
      ([[880, 0], [1318.51, 0.12]] as Array<[number, number]>).forEach(([freq, at]) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t0 + at);
        osc.connect(master);
        osc.start(t0 + at);
        osc.stop(t0 + at + 0.45);
      });
      window.setTimeout(() => {
        try {
          void ctx.close();
          if (audioCtxRef.current === ctx) audioCtxRef.current = null;
        } catch {
          /* noop */
        }
      }, 1000);
    } catch {
      /* abaikan */
    }
  };

  const toggleSound = () =>
    setSoundOn((v) => {
      soundOnRef.current = !v;
      localStorage.setItem(LS_SOUND, !v ? 'on' : 'off');
      return !v;
    });

  /** Mulai animasi ketik untuk pesan AI. */
  const startTyping = (msg: ChatMessage) => {
    setTyped({ id: msg.message_id, full: msg.body, shown: 0 });
  };

  // Mesin ketik natural: satu karakter per langkah dengan jeda acak,
  // berhenti sejenak setelah titik/koma — seperti orang mengetik sungguhan.
  useEffect(() => {
    if (!typed || typed.shown >= typed.full.length) return;
    const { id, full } = typed;
    let shown = typed.shown;
    let cancelled = false;
    let timer = 0;
    const stepOnce = () => {
      if (cancelled) return;
      shown += 1;
      const ch = full[shown - 1] ?? '';
      setTyped({ id, full, shown });
      if (shown >= full.length) return;
      // Basis lambat (~14 karakter/detik) + sedikit variasi acak biar hidup
      let delay = 52 + Math.random() * 38;
      if ('.!?'.includes(ch)) delay += 330; // jeda akhir kalimat
      else if (',;:'.includes(ch)) delay += 170; // jeda koma
      else if (ch === ' ') delay += 20; // sedikit napas antar kata
      timer = window.setTimeout(stepOnce, delay);
    };
    // "berpikir" sebentar sebelum mulai mengetik
    timer = window.setTimeout(stepOnce, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [typed?.id]);

  /**
   * Terima versi percakapan terbaru dari server.
   * baseline=true berarti muatan awal halaman (riwayat) — tanpa animasi/suara.
   * Pesan AI yang baru terdeteksi dianimasikan karakter demi karakter + bunyi.
   */
  const absorb = (next: ChatConversation, baseline = false) => {
    const prev = convRef.current;
    if (prev && prev.updated_at === next.updated_at && prev.messages.length === next.messages.length) return;
    convRef.current = next;
    setConversation(next);
    tokenRef.current = next.visitor_token;
    localStorage.setItem(LS_TOKEN, next.visitor_token);
    if (next.visitor_name) localStorage.setItem(LS_NAME, next.visitor_name);
    if (next.visitor_email) localStorage.setItem(LS_EMAIL, next.visitor_email);
    if (baseline) {
      knownIdsRef.current = new Set(next.messages.map((m) => m.message_id));
      return;
    }
    const known = knownIdsRef.current ?? new Set<string>();
    knownIdsRef.current = known;
    const fresh = next.messages.filter((m) => !known.has(m.message_id));
    if (fresh.length === 0) return;
    fresh.forEach((m) => known.add(m.message_id));
    if (fresh.some((m) => m.sender === 'ai' || m.sender === 'admin')) playReplySound();
    const aiMsg = [...fresh].reverse().find((m) => m.sender === 'ai');
    if (aiMsg) startTyping(aiMsg);
  };

  // ---- Polling percakapan (tanpa menandai dibaca): isi thread + badge ----
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (!tokenRef.current) return;
      try {
        const { conversation: conv } = await fetchChatConversation(tokenRef.current);
        if (!alive || !conv) return;
        absorb(conv, true);
      } catch {
        /* abaikan kegagalan polling sementara */
      }
    };
    void tick();
    const id = window.setInterval(tick, open ? 4000 : 15000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [open]);

  // ---- Panel terbuka & ada balasan belum dibaca → tandai dibaca ----
  useEffect(() => {
    if (!open) return;
    const token = tokenRef.current;
    if (!token || !conversation?.unread_for_visitor) return;
    markChatRead(token)
      .then((r) => setConversation(r.conversation))
      .catch(() => {});
  }, [open, conversation?.unread_for_visitor]);

  // ---- Auto-scroll ke bawah saat pesan bertambah ----
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation?.messages.length, open, sending, typed?.shown]);

  const submitMessage = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    primeAudio();
    setError(null);
    setSending(true);
    try {
      const res = await sendChatMessage({
        visitor_token: tokenRef.current ?? newVisitorToken(),
        name: name.trim(),
        email: email.trim(),
        text,
        page: window.location.pathname,
      });
      absorb(res.conversation);
      setDraft('');
    } catch (e: any) {
      setError(e?.message ?? 'Gagal mengirim pesan');
    } finally {
      setSending(false);
    }
  };

  const onDraftKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submitMessage();
    }
  };

  const unread = conversation?.unread_for_visitor ?? 0;

  return (
    <>
      {/* Panel popup chat */}
      {open && (
        <div className="fixed inset-x-3 bottom-3 z-50 flex h-[72vh] max-h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-24 sm:right-6 sm:w-[380px]">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 px-4 py-3 text-white">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15">
                  <img src="/brand/logo.svg" alt="Logo Smart Space" className="h-7 w-7" />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-bold">Smart Space Support</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Online — balasan pada jam kerja
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleSound}
                  aria-label={soundOn ? 'Matikan suara notifikasi' : 'Nyalakan suara notifikasi'}
                  title={soundOn ? 'Suara aktif' : 'Suara mati'}
                  className="grid h-8 w-8 place-items-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  {soundOn ? '🔊' : '🔇'}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Tutup chat"
                  className="-mr-1 -mt-1 grid h-8 w-8 place-items-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          {/* Daftar pesan */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
            {/* Sapaan + pra-form identitas (belum pernah chat) */}
            {(!conversation || conversation.messages.length === 0) && (
              <>
                <div className="mx-auto max-w-[85%] rounded-2xl rounded-bl-md border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Halo! 👋 Ada yang bisa kami bantu?</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    Tanyakan ketersediaan ruangan, harga sewa, atau hal lain seputar Smart Space. Isi nama Anda agar
                    tim kami tahu harus membalas ke siapa.
                  </p>
                </div>
                <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <label className="block text-[11px] font-medium text-slate-500" htmlFor="chat-name">
                    Nama
                  </label>
                  <input
                    id="chat-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama brand / Anda"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  />
                  <label className="block text-[11px] font-medium text-slate-500" htmlFor="chat-email">
                    Email (opsional)
                  </label>
                  <input
                    id="chat-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@brand.co.id"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  />
                </div>
              </>
            )}

            {/* Bubble pesan */}
            {conversation?.messages.map((m) => {
              if (m.sender === 'system') {
                return (
                  <p key={m.message_id} className="text-center text-[11px] italic leading-relaxed text-slate-400">
                    {m.body}
                  </p>
                );
              }
              const mine = m.sender === 'visitor';
              const isAi = m.sender === 'ai';
              return (
                <div key={m.message_id} className={`flex items-end gap-2 ${mine ? 'justify-end' : ''}`}>
                  {!mine && (
                    <span
                      title={isAi ? 'Dibalas otomatis oleh AI' : 'Tim Smart Space'}
                      className={`grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full text-xs ${
                        isAi ? 'bg-blue-600' : 'bg-white ring-1 ring-slate-200'
                      }`}
                    >
                      {isAi ? '🤖' : <img src="/brand/logo.svg" alt="Tim Smart Space" className="h-7 w-7" />}
                    </span>
                  )}
                  <div
                    className={`max-w-[78%] px-3.5 py-2 shadow-sm ${
                      mine ? 'rounded-2xl rounded-br-md bg-brand' : 'rounded-2xl rounded-bl-md border border-slate-200 bg-white'
                    }`}
                  >
                    {typed && typed.id === m.message_id && typed.shown < typed.full.length ? (
                      <p
                        className={`whitespace-pre-wrap break-words text-sm ${mine ? 'text-white' : 'text-slate-800'}`}
                      >
                        <MessageText text={typed.full.slice(0, typed.shown)} />
                        <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-[2px] animate-pulse bg-current" />
                      </p>
                    ) : (
                      <p
                        className={`whitespace-pre-wrap break-words text-sm ${mine ? 'text-white' : 'text-slate-800'}`}
                      >
                        <MessageText text={m.body} />
                      </p>
                    )}
                    <p className={`mt-0.5 text-right text-[10px] ${mine ? 'text-slate-400' : 'text-slate-400'}`}>
                      {formatTime(m.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}

            {sending && <p className="animate-pulse pl-1 text-[11px] italic text-slate-400">Mengirim…</p>}
          </div>

          {/* Kotak tulis */}
          <div className="border-t border-slate-200 bg-white p-3">
            {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600">{error}</p>}
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                rows={1}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onDraftKeyDown}
                placeholder={
                  conversation?.status === 'closed'
                    ? 'Tulis pesan untuk membuka kembali percakapan…'
                    : 'Tulis pesan… (Enter kirim)'
                }
                className="max-h-24 min-h-[42px] flex-1 resize-none rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-slate-500 focus:outline-none"
              />
              <button
                onClick={() => void submitMessage()}
                disabled={!draft.trim() || sending}
                aria-label="Kirim pesan"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white transition hover:bg-brand-light disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
                  <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.99.99 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
                </svg>
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-slate-400">Ditenagai oleh Smart Space</p>
          </div>
        </div>
      )}

      {/* Tombol melayang pojok kanan bawah */}
      {!open && (
        <button
          onClick={() => {
            primeAudio();
            setOpen(true);
          }}
          aria-label="Buka chat dukungan"
          className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-brand text-2xl text-white shadow-xl transition hover:scale-105 active:scale-95"
        >
          💬
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>
      )}
    </>
  );
}