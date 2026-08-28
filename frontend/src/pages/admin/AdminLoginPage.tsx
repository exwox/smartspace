import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminLogin } from '../../api.ts';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await adminLogin(username, password);
      localStorage.setItem('ss_token', res.token);
      localStorage.setItem('ss_admin', res.username);
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Gagal login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white">
            <img src="/brand/logo.svg" alt="Logo Smart Space" className="h-8 w-8" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Admin Smart Space</h1>
            <p className="text-xs text-slate-500">Masuk untuk mengelola peta &amp; pengajuan</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
              placeholder="admin"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-light disabled:opacity-60"
          >
            {loading ? 'Masuk…' : 'Masuk'}
          </button>
        </form>

        <Link to="/" className="mt-4 block text-center text-sm text-slate-500 hover:text-slate-700">
          ← Kembali ke peta publik
        </Link>
      </div>
    </div>
  );
}