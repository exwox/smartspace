import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminFetchPublicContent, adminFetchStats, adminSavePublicContent } from '../../api.ts';
import { DEFAULT_PUBLIC_CONTENT, type PublicContentSettings, type Stats } from '../../types.ts';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<PublicContentSettings>(DEFAULT_PUBLIC_CONTENT);
  const [contentLoading, setContentLoading] = useState(true);
  const [contentSaving, setContentSaving] = useState(false);
  const [contentMessage, setContentMessage] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);

  useEffect(() => {
    adminFetchStats()
      .then((r) => setStats(r.stats))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    adminFetchPublicContent()
      .then((result) => setContent(result.settings))
      .catch((e) => setContentError(e.message))
      .finally(() => setContentLoading(false));
  }, []);

  const saveContent = async () => {
    setContentSaving(true);
    setContentMessage(null);
    setContentError(null);
    try {
      const result = await adminSavePublicContent(content);
      setContent(result.settings);
      setContentMessage(result.message);
    } catch (e: any) {
      setContentError(e.message ?? 'Gagal menyimpan konten publik');
    } finally {
      setContentSaving(false);
    }
  };

  if (error) return <ErrorBox message={error} />;
  if (!stats) return <div className="p-8 text-slate-500">Memuat statistik…</div>;

  const byStatus = stats.byStatus ?? { kosong: 0, terisi: 0, proses: 0 };
  const total = Math.max(1, stats.totalRooms);
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
      <p className="mt-0.5 text-sm text-slate-500">Ringkasan okupansi &amp; aktivitas penyewaan.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Ruangan" value={String(stats.totalRooms)} icon="🏢" />
        <StatCard label="Tingkat Okupansi" value={`${stats.occupancyRate}%`} icon="📈" />
        <StatCard label="Tenant / Brand" value={String(stats.totalTenants)} icon="🏷️" />
        <StatCard label="Pengajuan Pending" value={String(stats.pendingRequests)} icon="📨" accent />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* status breakdown */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-700">Status Ruangan</h2>
          <div className="mt-3 space-y-2">
            <Bar label="Kosong" value={byStatus.kosong ?? 0} pct={pct(byStatus.kosong ?? 0)} color="bg-emerald-500" />
            <Bar label="Terisi" value={byStatus.terisi ?? 0} pct={pct(byStatus.terisi ?? 0)} color="bg-red-500" />
            <Bar label="Dalam proses" value={byStatus.proses ?? 0} pct={pct(byStatus.proses ?? 0)} color="bg-amber-500" />
          </div>
        </div>

        {/* pengajuan */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-700">Sewa &amp; Pengajuan</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <MiniStat label="Disetujui" value={String(stats.approvedRequests)} cls="text-emerald-600" />
            <MiniStat label="Ditolak" value={String(stats.rejectedRequests)} cls="text-red-500" />
            <MiniStat label="Total Lease" value={String(stats.totalLeases)} cls="text-slate-700" />
            <MiniStat label="Lantai" value={String(stats.totalFloors)} cls="text-slate-700" />
          </div>
          <Link
            to="/admin/requests"
            className="mt-4 block rounded-lg bg-brand/5 px-3 py-2 text-center text-sm font-medium text-brand hover:bg-brand/10"
          >
            Buka daftar pengajuan →
          </Link>
        </div>

        {/* aksi cepat */}
        <div className="rounded-xl bg-white p-4 shadow-sm md:col-span-2 lg:col-span-1">
          <h2 className="text-sm font-bold text-slate-700">Aksi Cepat</h2>
          <div className="mt-3 space-y-2">
            <QuickLink to="/admin/rooms" title="Kelola ruangan" desc="Tambah/edit data & geometri" />
            <QuickLink to="/admin/floor" title="Upload denah / DXF" desc="Import otomatis polygon ruangan" />
            <QuickLink to="/" title="Lihat peta publik" desc="Buka tampilan calon penyewa" />
          </div>
        </div>
      </div>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-700">Public Dashboard CMS</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Atur konten halaman publik</h2>
            <p className="mt-1 text-sm text-slate-500">Sembunyikan bagian tertentu dan ubah teks utama tanpa membangun ulang aplikasi.</p>
          </div>
          <Link to="/" target="_blank" className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-100">
            Lihat halaman publik ↗
          </Link>
        </div>

        {contentLoading ? (
          <p className="mt-5 text-sm text-slate-500">Memuat pengaturan konten…</p>
        ) : (
          <div className="mt-5 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Bagian yang ditampilkan</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <VisibilityToggle label="Statistik hero" checked={content.showHeroStats} onChange={(value) => setContent({ ...content, showHeroStats: value })} />
                <VisibilityToggle label="Profil bandara" checked={content.showProfile} onChange={(value) => setContent({ ...content, showProfile: value })} />
                <VisibilityToggle label="Traffic & grafik" checked={content.showTraffic} onChange={(value) => setContent({ ...content, showTraffic: value })} />
                <VisibilityToggle label="Fasilitas" checked={content.showFacilities} onChange={(value) => setContent({ ...content, showFacilities: value })} />
                <VisibilityToggle label="Smart Space" checked={content.showSmartSpace} onChange={(value) => setContent({ ...content, showSmartSpace: value })} />
                <VisibilityToggle label="Ajakan terakhir" checked={content.showCta} onChange={(value) => setContent({ ...content, showCta: value })} />
                <VisibilityToggle label="Footer" checked={content.showFooter} onChange={(value) => setContent({ ...content, showFooter: value })} />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-800">Teks hero</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <ContentField label="Badge" value={content.heroBadge} onChange={(value) => setContent({ ...content, heroBadge: value })} />
                <ContentField label="Judul utama" value={content.heroTitle} onChange={(value) => setContent({ ...content, heroTitle: value })} />
                <ContentField label="Teks sorotan" value={content.heroHighlight} onChange={(value) => setContent({ ...content, heroHighlight: value })} />
                <ContentField label="Tombol utama" value={content.heroPrimaryButton} onChange={(value) => setContent({ ...content, heroPrimaryButton: value })} />
                <ContentField label="Tombol kedua" value={content.heroSecondaryButton} onChange={(value) => setContent({ ...content, heroSecondaryButton: value })} />
                <ContentField multiline label="Deskripsi hero" value={content.heroDescription} onChange={(value) => setContent({ ...content, heroDescription: value })} />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-800">Teks setiap bagian</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <ContentField label="Judul profil" value={content.profileTitle} onChange={(value) => setContent({ ...content, profileTitle: value })} />
                <ContentField multiline label="Deskripsi profil" value={content.profileDescription} onChange={(value) => setContent({ ...content, profileDescription: value })} />
                <ContentField label="Judul traffic" value={content.trafficTitle} onChange={(value) => setContent({ ...content, trafficTitle: value })} />
                <ContentField label="Judul fasilitas" value={content.facilitiesTitle} onChange={(value) => setContent({ ...content, facilitiesTitle: value })} />
                <ContentField label="Judul Smart Space" value={content.smartSpaceTitle} onChange={(value) => setContent({ ...content, smartSpaceTitle: value })} />
                <ContentField label="Judul ajakan terakhir" value={content.ctaTitle} onChange={(value) => setContent({ ...content, ctaTitle: value })} />
                <ContentField multiline label="Deskripsi ajakan terakhir" value={content.ctaDescription} onChange={(value) => setContent({ ...content, ctaDescription: value })} />
                <ContentField label="Teks footer" value={content.footerText} onChange={(value) => setContent({ ...content, footerText: value })} />
              </div>
            </div>

            {contentError && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{contentError}</p>}
            {contentMessage && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">✓ {contentMessage}</p>}
            <div className="flex justify-end">
              <button onClick={saveContent} disabled={contentSaving} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-light disabled:opacity-50">
                {contentSaving ? 'Menyimpan…' : 'Simpan Konten Publik'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function VisibilityToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
      <span className="font-medium">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-cyan-600" />
    </label>
  );
}

function ContentField({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  const className = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100';
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {multiline ? (
        <textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} className={className} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} className={className} />
      )}
    </label>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl bg-white p-4 shadow-sm ${accent ? 'ring-2 ring-amber-300' : ''}`}>
      <p className="text-xs font-medium text-slate-500">{icon} {label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Bar({ label, value, pct, color }: { label: string; value: number; pct: string; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span className="font-semibold">{value} ruangan ({pct})</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${color}`} style={{ width: pct }} />
      </div>
    </div>
  );
}

function QuickLink({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col rounded-lg border border-slate-200 px-3 py-2.5 text-sm hover:bg-slate-50"
    >
      <span className="font-semibold text-slate-800">{title}</span>
      <span className="text-xs text-slate-500">{desc}</span>
    </Link>
  );
}

function MiniStat({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2.5">
      <p className={`text-lg font-bold ${cls}`}>{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{message}</div>
  );
}
