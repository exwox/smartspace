import { useEffect, useState } from 'react';
import {
  adminFetchNotificationSettings,
  adminSaveNotificationSettings,
  adminSendTestNotificationEmail,
} from '../../api.ts';
import type { NotificationSettings } from '../../types.ts';

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

  useEffect(() => {
    adminFetchNotificationSettings()
      .then((r) => {
        setSettings(r.settings);
        setSmtp(r.smtp);
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
    </div>
  );
}