import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { adminFetchUnreadChatCount } from '../../api.ts';

const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/admin/rooms', label: 'Ruangan', icon: '🏢' },
  { to: '/admin/floor', label: 'Denah / DXF', icon: '🗺️' },
  { to: '/admin/requests', label: 'Pengajuan', icon: '📨' },
  { to: '/admin/chats', label: 'Pesan Chat', icon: '💬' },
  { to: '/admin/settings', label: 'Pengaturan', icon: '⚙️' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const token = localStorage.getItem('ss_token');
  const admin = localStorage.getItem('ss_admin') ?? 'admin';
  // Badge jumlah percakapan chat yang belum dibaca (diperbarui tiap 20 detik)
  const [unreadChats, setUnreadChats] = useState(0);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await adminFetchUnreadChatCount();
        if (alive) setUnreadChats(r.conversations);
      } catch {
        /* abaikan */
      }
    };
    void tick();
    const id = window.setInterval(tick, 20000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [token]);

  if (!token) return <Navigate to="/admin/login" replace />;

  const logout = () => {
    localStorage.removeItem('ss_token');
    localStorage.removeItem('ss_admin');
    navigate('/admin/login');
  };

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* sidebar (desktop) */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-brand text-white md:flex">
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
            <img src="/brand/logo.svg" alt="Logo Smart Space" className="h-7 w-7" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold">Smart Space</p>
            <p className="text-[11px] text-slate-300">Admin Panel</p>
          </div>
        </div>
        <nav className="mt-2 flex-1 space-y-1 px-2">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <span>{n.icon}</span> {n.label}
              {n.to === '/admin/chats' && unreadChats > 0 && (
                <span className="ml-auto grid h-5 min-w-[20px] place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                  {unreadChats}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <p className="flex items-center gap-2 text-xs text-slate-300">
            <img src="/brand/logo.svg" alt="" className="h-5 w-5" /> {admin}
          </p>
          <button onClick={logout} className="mt-2 w-full rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20">
            Keluar
          </button>
        </div>
      </aside>

      {/* top bar + bottom nav (mobile) */}
      <header className="flex items-center justify-between bg-brand px-4 py-3 text-white md:hidden">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
            <img src="/brand/logo.svg" alt="Logo Smart Space" className="h-6 w-6" />
          </span>
          <p className="text-sm font-bold">Admin Smart Space</p>
        </div>
        <button onClick={logout} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium">
          Keluar
        </button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto bg-slate-100">
        <Outlet />
      </main>

      {/* bottom nav mobile */}
      <nav className="flex border-t border-slate-200 bg-white md:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                isActive ? 'text-brand' : 'text-slate-400'
              }`
            }
          >
            <span className="text-base">{n.icon}</span>
            {n.label}
            {n.to === '/admin/chats' && unreadChats > 0 && (
              <span className="absolute right-[22%] top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {unreadChats}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}