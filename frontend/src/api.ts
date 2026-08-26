import type { FloorPlan, PublicContentSettings, RentalRequest, Room, Stats } from './types.ts';

const BASE = import.meta.env.VITE_API_URL ?? '';

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('ss_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
export async function fetchRooms() {
  const res = await fetch(`${BASE}/api/rooms`);
  return handle<{ rooms: Room[] }>(res);
}

export async function fetchRoom(id: string) {
  const res = await fetch(`${BASE}/api/rooms/${id}`);
  return handle<{ room: Room }>(res);
}

export async function fetchFloors() {
  const res = await fetch(`${BASE}/api/floors`);
  return handle<{ floors: FloorPlan[] }>(res);
}

export async function fetchPublicContent() {
  const res = await fetch(`${BASE}/api/public-content`);
  return handle<{ settings: PublicContentSettings }>(res);
}

export async function submitRequest(form: FormData) {
  const res = await fetch(`${BASE}/api/requests`, { method: 'POST', body: form });
  return handle<{ request: RentalRequest; message: string }>(res);
}

export async function trackRequest(ticket: string) {
  const res = await fetch(`${BASE}/api/requests/${encodeURIComponent(ticket)}`);
  return handle<{ request: RentalRequest; room: { room_id: string; room_code: string; name: string } | null }>(res);
}

// ---------- AUTH ----------
export async function adminLogin(username: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return handle<{ token: string; username: string }>(res);
}

// ---------- ADMIN ----------
export async function adminFetchRooms() {
  const res = await fetch(`${BASE}/api/admin/rooms`, { headers: getAuthHeaders() });
  return handle<{ rooms: Room[] }>(res);
}

export async function adminDownloadRoomsBackup() {
  const res = await fetch(`${BASE}/api/admin/rooms/backup`, { headers: getAuthHeaders() });
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try { message = (await res.json())?.error ?? message; } catch { /* ignore */ }
    throw new Error(message);
  }
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? 'smart-space-rooms-backup.json';
  return { blob: await res.blob(), filename };
}

export async function adminRestoreRoomsBackup(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error('Ukuran backup JSON maksimal 10 MB');
  let backup: unknown;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    throw new Error('File yang dipilih bukan JSON yang valid');
  }
  const res = await fetch(`${BASE}/api/admin/rooms/restore`, {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ backup }),
  });
  return handle<{
    ok: boolean;
    restored: number;
    replaced: number;
    removedOrphanLeases: number;
    removedOrphanRequests: number;
    message: string;
  }>(res);
}

export async function adminSaveRoom(room: Partial<Room>, id?: string) {
  const res = await fetch(`${BASE}/api/admin/rooms${id ? `/${id}` : ''}`, {
    method: id ? 'PUT' : 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(room),
  });
  return handle<{ room: Room }>(res);
}

export async function adminUploadRoomPhotos(id: string, photos: File[]) {
  const form = new FormData();
  photos.forEach((photo) => form.append('photos', photo));
  const res = await fetch(`${BASE}/api/admin/rooms/${id}/photos`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: form,
  });
  return handle<{ room: Room }>(res);
}

export async function adminUpdateRoomStatus(id: string, status: string) {
  const res = await fetch(`${BASE}/api/admin/rooms/${id}/status`, {
    method: 'PATCH',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return handle<{ room: Room }>(res);
}

export async function adminDeleteRoom(id: string) {
  const res = await fetch(`${BASE}/api/admin/rooms/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handle<{ ok: boolean }>(res);
}

// Hapus seluruh ruangan, tenant/brand, denah/lantai, lease, dan permintaan terkait
export async function adminDeleteAllRooms() {
  const res = await fetch(`${BASE}/api/admin/rooms`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handle<{
    ok: boolean;
    deleted: { rooms: number; tenants: number; floors: number; leases: number; requests: number };
    message: string;
  }>(res);
}

export async function adminUploadFloor(formData: FormData) {
  const res = await fetch(`${BASE}/api/admin/floor`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  return handle<{ floorPlan: FloorPlan; createdRooms: number; drawnEntities: number; drawnTexts: number; message: string }>(res);
}

export async function adminFetchRequests() {
  const res = await fetch(`${BASE}/api/admin/requests`, { headers: getAuthHeaders() });
  return handle<{ requests: RentalRequest[] }>(res);
}

export async function adminReviewRequest(id: string, action: 'approve' | 'reject', reason = '') {
  const res = await fetch(`${BASE}/api/admin/requests/${id}`, {
    method: 'PATCH',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, reason }),
  });
  return handle<{ request: RentalRequest }>(res);
}

export async function adminFetchStats() {
  const res = await fetch(`${BASE}/api/admin/stats`, { headers: getAuthHeaders() });
  return handle<{ stats: Stats }>(res);
}

export async function adminFetchPublicContent() {
  const res = await fetch(`${BASE}/api/admin/public-content`, { headers: getAuthHeaders() });
  return handle<{ settings: PublicContentSettings }>(res);
}

export async function adminSavePublicContent(settings: PublicContentSettings) {
  const res = await fetch(`${BASE}/api/admin/public-content`, {
    method: 'PUT',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  return handle<{ settings: PublicContentSettings; message: string }>(res);
}

export async function adminResetData() {
  const res = await fetch(`${BASE}/api/admin/reset`, { method: 'POST', headers: getAuthHeaders() });
  return handle<{ ok: boolean; message: string }>(res);
}
