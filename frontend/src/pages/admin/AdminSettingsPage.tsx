import { useEffect, useState } from 'react';
import {
  adminFetchAgentSettings,
  adminFetchNotificationSettings,
  adminSaveAgentSettings,
  adminSaveNotificationSettings,
  adminSendTestNotificationEmail,
  adminTestAgentSettings,
  type SaveAgentSettingsPayload,
} from '../../api.ts';
import type { AgentSettingsView, NotificationSettings } from '../../types.ts';

const inputCls =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 bg-white';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: false,
    recipients: '',
    notify_applicant: true,
  });
  const [smtp, setSmtp] = useState<{ configured: boolean; host?: string; port?: string; secure: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // ---- AI Agent (9Router) ----
  const [agent, setAgent] = useState<AgentSettingsView | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingAgent, setSavingAgent] = useState(false);
  const [testingAgent, setTestingAgent] = useState(false);
  const [agentMessage, setAgentMessage] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([adminFetchNotificationSettings(), adminFetchAgentSettings()])
      .then(([notif, agentRes]) => {
        setSettings(notif.settings);
        setSmtp(notif.smtp);
        setAgent(agentRes.settings);
      })
      .catch((e: any) => setError(e.message ?? 'Gagal memuat pengaturan'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const r = await adminSaveNotificationSettings(settings);
      setSettings(r.settings);
      setMessage(r.message);
    } catch (e: any) {
      setError(e.message ?? 'Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    setMessage(null);
    setError(null);
    try {
      const target = testEmail.trim() || settings.recipients;
      const r = await adminSendTestNotificationEmail(target);
      if (r.sent) setMessage(`Email tes berhasil dikirim ke ${target}`);
      else setError(r.error ?? 'Email tes gagal dikirim — periksa konfigurasi SMTP di server');
    } catch (e: any) {
      setError(e.message ?? 'Gagal mengirim email tes');
    } finally {
      setTesting(false);
    }
  };

  /** Simpan pengaturan AI Agent — API key hanya dikirim bila user mengetik yang baru. */
  const saveAgent = async () => {
    if (!agent) return;
    setSavingAgent(true);
    setAgentMessage(null);
    setAgentError(null);
    try {
      const newApiKey = apiKeyInput.trim();
      const payload: SaveAgentSettingsPayload = {
        enabled: agent.enabled,
        base_url: agent.base_url.trim() || 'http://141.11.25.174:20128/v1',
        model: agent.model.trim(),
        system_prompt: agent.system_prompt,
        ...(newApiKey ? { api_key: newApiKey } : {}),
      };
      const r = await adminSaveAgentSettings(payload);
      setAgent(r.settings);
      setApiKeyInput('');
      setAgentMessage(r.message);
    } catch (e: any) {
      setAgentError(e.message ?? 'Gagal menyimpan pengaturan AI Agent');
    } finally {
      setSavingAgent(false);
    }
  };

  /** Uji koneksi gateway 9Router dengan satu prompt pendek. */
  const testAgent = async () => {
    setTestingAgent(true);
    setAgentMessage(null);
    setAgentError(null);
    try {
      const r = await adminTestAgentSettings();
      if (r.ok) setAgentMessage(`✅ Gateway merespons: “${r.reply}”`);
      else setAgentError([r.error, r.detail].filter(Boolean).join(' — ') || 'Gateway tidak merespons');
    } catch (e: any) {
      setAgentError(e.message ?? 'Gagal menguji koneksi gateway');
    } finally {
      setTestingAgent(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-bold text-slate-900">Pengaturan</h1>
      <p className="mt-0.5 text-sm text-slate-500">
        Konfigurasi notifikasi email tiket pengajuan sewa dan preferensi panel admin.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-800">📧 Notifikasi Email Tiket</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Saat calon penyewa mengirim tiket pengajuan, email notifikasi dikirim otomatis ke alamat di bawah.
          </p>

          {loading ? (
            <p className="mt-4 text-sm text-slate-400">Memuat…</p>
          ) : (
            <>
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 accent-emerald-600"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-700">Aktifkan notifikasi email</span>
                  <span className="block text-xs text-slate-500">
                    Kirim email ke admin setiap ada tiket pengajuan baru masuk.
                  </span>
                </span>
              </label>

              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700">
                  Email tujuan (pisahkan dengan koma)
                </label>
                <input
                  value={settings.recipients}
                  onChange={(e) => setSettings((s) => ({ ...s, recipients: e.target.value }))}
                  placeholder="admin@contoh.com, operasional@contoh.com"
                  className={inputCls}
                />
                <p className="mt-1 text-xs text-slate-400">
                  Alamat email admin/petugas yang menerima notifikasi tiket baru.
                </p>
              </div>

              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={settings.notify_applicant}
                  onChange={(e) => setSettings((s) => ({ ...s, notify_applicant: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 accent-emerald-600"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-700">
                    Kirim email juga ke pengaju
                  </span>
                  <span className="block text-xs text-slate-500">
                    Konfirmasi tiket saat masuk, serta pemberitahuan saat pengajuan disetujui/ditolak.
                  </span>
                </span>
              </label>

              {smtp && (
                <div
                  className={`mt-4 rounded-lg p-3 text-xs ${
                    smtp.configured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {smtp.configured ? (
                    <>
                      ✅ SMTP terkonfigurasi: <strong>{smtp.host}:{smtp.port}</strong>{' '}
                      ({smtp.secure ? 'SSL/TLS' : 'STARTTLS'})
                    </>
                  ) : (
                    <>
                      ⚠️ SMTP belum dikonfigurasi di server — email belum benar-benar terkirim (isi tiket hanya dicatat
                      di log server). Set environment variable berikut lalu jalankan ulang backend:{' '}
                      <code className="font-mono">SMTP_HOST</code>, <code className="font-mono">SMTP_PORT</code>,{' '}
                      <code className="font-mono">SMTP_USER</code>, <code className="font-mono">SMTP_PASS</code>,{' '}
                      <code className="font-mono">SMTP_SECURE</code>, <code className="font-mono">MAIL_FROM</code>.
                    </>
                  )}
                </div>
              )}

              {error && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-600">{error}</p>}
              {message && <p className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-sm text-emerald-700">✅ {message}</p>}

              <button
                onClick={save}
                disabled={saving || loading}
                className="mt-4 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-light disabled:opacity-50"
              >
                {saving ? 'Menyimpan…' : 'Simpan Pengaturan'}
              </button>
            </>
          )}
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-800">🧪 Uji Kirim Email</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Kirim email percobaan untuk memastikan konfigurasi SMTP benar sebelum dipakai produksi.
          </p>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700">
              Email tujuan tes <span className="text-slate-400">(kosongkan untuk pakai daftar di kiri)</span>
            </label>
            <input
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="nama@contoh.com"
              className={inputCls}
            />
          </div>
          <button
            onClick={sendTest}
            disabled={testing || loading || (!testEmail.trim() && !settings.recipients.trim())}
            className="mt-3 w-full rounded-xl border border-brand px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand/5 disabled:opacity-50"
          >
            {testing ? 'Mengirim…' : 'Kirim Email Tes'}
          </button>

          <div className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            <p className="font-semibold text-slate-600">Ringkasan perilaku:</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>Tiket baru masuk → email detail tiket ke daftar email tujuan (bila aktif).</li>
              <li>Tiket baru masuk → konfirmasi ke email pengaju (bila opsi pengaju aktif).</li>
              <li>Pengajuan disetujui/ditolak → pemberitahuan ke email pengaju (bila opsi pengaju aktif).</li>
              <li>Pengiriman berjalan di latar belakang — tidak memperlambat proses simpan tiket.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ---------- AI AGENT — balasan chat otomatis via 9Router ---------- */}
      {agent && (
        <div className="mt-4 rounded-xl bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-800">🤖 AI Agent — Balasan Chat Otomatis</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Widget chat di balas otomatis oleh AI melalui gateway{' '}
                <strong>9Router</strong> (endpoint OpenAI-compatible). Admin tetap bisa mengambil alih kapan saja dari
                halaman Pesan Chat.
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={agent.enabled}
                onChange={(e) => setAgent({ ...agent, enabled: e.target.checked })}
                className="h-4 w-4 accent-blue-600"
              />
              Mode Agent aktif
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Base URL Gateway</label>
              <input
                value={agent.base_url}
                onChange={(e) => setAgent({ ...agent, base_url: e.target.value })}
                placeholder="http://localhost:20128/v1"
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-slate-400">Default 9Router lokal; boleh diganti gateway lain yang OpenAI-compatible.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Model</label>
              <input
                value={agent.model}
                onChange={(e) => setAgent({ ...agent, model: e.target.value })}
                placeholder="mis. claude-sonnet-4 / gpt-4o-mini / qwen-max"
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-slate-400">Nama model sesuai provider yang terhubung di 9Router.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">API Key {agent.api_key_configured && <span className="text-[11px] font-normal text-emerald-600">(tersimpan)</span>}</label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={agent.api_key_configured ? '•••••••• (kosongkan = tetap)' : 'opsional untuk gateway lokal'}
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-slate-400">Ketik ulang hanya bila ingin mengganti key.</p>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700">System Prompt (karakter & batasan AI)</label>
            <textarea
              value={agent.system_prompt}
              rows={4}
              onChange={(e) => setAgent({ ...agent, system_prompt: e.target.value })}
              className={`${inputCls} mt-1 resize-y`}
            />
          </div>

          {agentError && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-600">{agentError}</p>}
          {agentMessage && <p className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-sm text-emerald-700">{agentMessage}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={saveAgent}
              disabled={savingAgent}
              className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-light disabled:opacity-50"
            >
              {savingAgent ? 'Menyimpan…' : 'Simpan Pengaturan Agent'}
            </button>
            <button
              onClick={testAgent}
              disabled={testingAgent || !agent.base_url.trim() || !agent.model.trim()}
              className="rounded-xl border border-brand px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand/5 disabled:opacity-50"
            >
              {testingAgent ? 'Menguji…' : '🔌 Test Koneksi Gateway'}
            </button>
          </div>

          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            <p className="font-semibold text-slate-600">Cara kerja mode Agent:</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>Saat aktif, pesan pengunjung dibalas otomatis oleh AI dalam beberapa detik.</li>
              <li>Begitu admin membalas manual, percakapan itu berpindah ke Mode Manual — AI berhenti membalasnya.</li>
              <li>Dari halaman Pesan Chat, tiap percakapan bisa dialihkan Manual ↔ Agent lewat tombol switch.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}