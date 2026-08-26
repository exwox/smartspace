import express, { type Request, type Response } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { loginHandler, requireAdmin } from './auth.js';
import { DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_PUBLIC_CONTENT, loadDB, nextId, nextTicket, now, persist, values } from './db.js';
import { parseDXF, polygonArea } from './dxf.js';
import {
  newTicketAdminMail,
  parseRecipients,
  sendMail,
  smtpSummary,
  ticketStatusMail,
} from './mailer.js';
import type {
  Attachment,
  DBShape,
  FloorPlan,
  Lease,
  NotificationSettings,
  RentalRequest,
  Room,
  RoomStatus,
  Tenant,
} from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.SMARTSPACE_UPLOAD_DIR
  ? path.resolve(process.env.SMARTSPACE_UPLOAD_DIR)
  : path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

// ------------------------------------------------------------------
// FILE UPLOAD (multer)
// ------------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${randomUUID()}-${safe}`);
  },
});
const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  '.dxf', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.bmp',
  '.pdf', '.doc', '.docx',
]);

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) {
      return cb(new Error(`Tipe file tidak didukung: ${ext || 'tanpa ekstensi'}`));
    }
    cb(null, true);
  },
});

const ROOM_PHOTO_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp']);
const ROOM_PHOTO_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/x-ms-bmp']);
const roomPhotoUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ROOM_PHOTO_EXTENSIONS.has(ext) || !ROOM_PHOTO_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      return cb(new Error('Foto ruangan harus berupa PNG, JPG, WEBP, atau BMP.'));
    }
    cb(null, true);
  },
});

const toAttachment = (f: Express.Multer.File): Attachment => ({
  fieldname: f.fieldname,
  originalname: f.originalname,
  filename: f.filename,
  path: `/uploads/${f.filename}`,
  size: f.size,
});

function deleteUploadedFiles(urls: string[]): void {
  for (const url of urls) {
    if (!url.startsWith('/uploads/')) continue;
    const filePath = path.join(UPLOAD_DIR, path.basename(url));
    fs.rmSync(filePath, { force: true });
  }
}

function hasValidRoomPhotoSignature(file: Express.Multer.File): boolean {
  const header = fs.readFileSync(file.path).subarray(0, 12);
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.png') return header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (ext === '.jpg' || ext === '.jpeg') return header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  if (ext === '.webp') return header.length >= 12 && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
  if (ext === '.bmp') return header.length >= 2 && header.toString('ascii', 0, 2) === 'BM';
  return false;
}

// ------------------------------------------------------------------
// helpers
// ------------------------------------------------------------------
function boundingBox(points: number[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (points.length < 2) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    minX = Math.min(minX, points[i]);
    maxX = Math.max(maxX, points[i]);
    minY = Math.min(minY, points[i + 1]);
    maxY = Math.max(maxY, points[i + 1]);
  }
  return { minX, minY, maxX, maxY };
}

function round2(n: number): number {
  n = Math.max(0, n);
  return Math.round(n * 100) / 100;
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function activeLeaseFor(d: DBShape, roomId: string): Lease | null {
  const leases = Object.values(d.leases).filter(
    (l) => l.room_id === roomId && l.status === 'aktif',
  );
  if (leases.length === 0) return null;
  return leases.sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
}

function syncExpiredLeases(d: DBShape): boolean {
  const today = now().slice(0, 10);
  let changed = false;
  for (const lease of Object.values(d.leases)) {
    if (lease.status !== 'aktif' || lease.end_date >= today) continue;
    lease.status = 'selesai';
    const room = d.rooms[lease.room_id];
    if (room && room.current_tenant_id === lease.tenant_id) {
      room.status = 'kosong';
      room.current_tenant_id = null;
      room.current_lease_start = null;
      room.current_lease_end = null;
      room.updated_at = now();
    }
    changed = true;
  }
  if (changed) persist();
  return changed;
}

// DTO ruangan: embed tenant aktif, lease aktif, histori sewa, dan jumlah tiket pending.
// Multi-tiket: satu ruangan boleh memiliki beberapa pengajuan pending sekaligus;
// status 'terisi' baru berlaku saat admin menyetujui salah satu tiket.
function roomDto(d: DBShape, room: Room) {
  const lease = activeLeaseFor(d, room.room_id);
  const tenant = room.current_tenant_id ? (d.tenants[room.current_tenant_id] ?? null) : null;
  const history = Object.values(d.leases)
    .filter((l) => l.room_id === room.room_id)
    .sort((a, b) => b.start_date.localeCompare(a.start_date))
    .map((l) => ({ ...l, tenant: l.tenant_id ? (d.tenants[l.tenant_id] ?? null) : null }));
  const pending_requests = Object.values(d.requests).filter(
    (r) => r.room_id === room.room_id && r.status === 'pending',
  ).length;
  return { ...room, current_tenant: tenant, active_lease: lease, history, pending_requests };
}

// ------------------------------------------------------------------
// AUTH
// ------------------------------------------------------------------
app.post('/api/auth/login', loginHandler);
app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'smart-space-api', time: now() }));
// ------------------------------------------------------------------
// PUBLIC: peta & detail ruangan
// ------------------------------------------------------------------
app.get('/api/rooms', (_req: Request, res: Response) => {
  const d = loadDB();
  syncExpiredLeases(d);
  res.json({ rooms: values(d.rooms).map((r) => roomDto(d, r)) });
});

app.get('/api/rooms/:id', (req: Request, res: Response) => {
  const d = loadDB();
  syncExpiredLeases(d);
  const room = d.rooms[String(req.params.id)];
  if (!room) return res.status(404).json({ error: 'Ruangan tidak ditemukan' });
  res.json({ room: roomDto(d, room) });
});

// Floor plans (untuk denah dasar di peta)
app.get('/api/floors', (_req: Request, res: Response) => {
  const d = loadDB();
  res.json({ floors: values(d.floorPlans) });
});

app.get('/api/public-content', (_req: Request, res: Response) => {
  const d = loadDB();
  res.json({ settings: { ...DEFAULT_PUBLIC_CONTENT, ...(d.publicContent ?? {}) } });
});

// ------------------------------------------------------------------
// Notifikasi email tiket (SMTP dikonfigurasi via environment variable)
// ------------------------------------------------------------------
function getNotificationSettings(d: DBShape): NotificationSettings {
  return { ...DEFAULT_NOTIFICATION_SETTINGS, ...(d.notifications ?? {}) };
}

/** Notifikasi tiket baru ke email admin + konfirmasi ke pengaju (fire-and-forget). */
function notifyNewTicket(d: DBShape, request: RentalRequest): void {
  try {
    const settings = getNotificationSettings(d);
    if (!settings.enabled) return;
    const room = d.rooms[request.room_id] ?? null;
    const admins = parseRecipients(settings.recipients);
    if (admins.length > 0) {
      const adminMail = newTicketAdminMail(request, room);
      void sendMail({ ...adminMail, to: admins });
    }
    if (settings.notify_applicant && request.contact_email) {
      void sendMail(ticketStatusMail(request, room, 'pending'));
    }
  } catch (e: any) {
    console.error(`[smart-space][mail] Gagal menyiapkan notifikasi tiket: ${e?.message ?? e}`);
  }
}

/** Email hasil review (disetujui/ditolak) ke pengaju (fire-and-forget). */
function notifyTicketReviewed(
  d: DBShape,
  request: RentalRequest,
  status: 'approved' | 'rejected',
): void {
  try {
    const settings = getNotificationSettings(d);
    if (!settings.enabled || !settings.notify_applicant || !request.contact_email) return;
    const room = d.rooms[request.room_id] ?? null;
    void sendMail(ticketStatusMail(request, room, status));
  } catch (e: any) {
    console.error(`[smart-space][mail] Gagal menyiapkan notifikasi review: ${e?.message ?? e}`);
  }
}

// ------------------------------------------------------------------
// PUBLIK: pengajuan sewa (tidak perlu login per Section 11 plan.md)
// ------------------------------------------------------------------
app.post('/api/requests', upload.array('attachments', 5), (req, res) => {
  const d = loadDB();
  const roomId = String(req.body.room_id ?? '');
  const room = d.rooms[roomId];
  if (!room) return res.status(404).json({ error: 'Ruangan tidak ditemukan' });
  // Multi-tiket: selama ruangan belum disetujui untuk penyewa lain ('terisi'),
  // pengajuan baru tetap diterima walau sudah ada tiket pending sebelumnya.
  if (room.status === 'terisi') {
    return res.status(400).json({ error: 'Ruangan sudah terisi dan tidak menerima pengajuan baru' });
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const reqId = nextId('REQ', 'request');
  const ticket = nextTicket();
  const created = now();

  const request: RentalRequest = {
    request_id: reqId,
    ticket_no: ticket,
    room_id: roomId,
    brand_name: String(req.body.brand_name ?? '').trim(),
    pic_name: String(req.body.pic_name ?? '').trim(),
    contact_phone: String(req.body.contact_phone ?? '').trim(),
    contact_email: String(req.body.contact_email ?? '').trim(),
    duration_months: Math.max(1, Number(req.body.duration_months ?? 1)),
    start_date: String(req.body.start_date ?? ''),
    budget: String(req.body.budget ?? '').trim(),
    notes: String(req.body.notes ?? '').trim(),
    attachments: files.map((f) => toAttachment(f).path),
    status: 'pending',
    reject_reason: null,
    created_at: created,
    reviewed_by: null,
    reviewed_at: null,
  };
  d.requests[reqId] = request;

  // Multi-tiket: status ruangan TIDAK diubah saat pengajuan masuk.
  // Ruangan menjadi 'terisi' hanya setelah admin menyetujui salah satu tiket.
  persist();

  // Kirim notifikasi email tiket baru bila diaktifkan (tidak memblokir response)
  notifyNewTicket(d, request);

  res.status(201).json({
    request,
    message: 'Pengajuan berhasil dikirim. Simpan nomor tiket untuk tracking.',
  });
});

// Tracking status pengajuan via nomor tiket (publik)
app.get('/api/requests/:ticket', (req: Request, res: Response) => {
  const d = loadDB();
  const found = Object.values(d.requests).find((r) => r.ticket_no === req.params.ticket);
  if (!found) return res.status(404).json({ error: 'Tiket tidak ditemukan' });
  const room = d.rooms[found.room_id];
  res.json({
    request: found,
    room: room ? { room_id: room.room_id, room_code: room.room_code, name: room.name } : null,
  });
});
// ------------------------------------------------------------------
// ADMIN: semua rute di bawah membutuhkan JWT
// ------------------------------------------------------------------
app.use('/api/admin', requireAdmin);

app.get('/api/admin/public-content', (_req: Request, res: Response) => {
  const d = loadDB();
  res.json({ settings: { ...DEFAULT_PUBLIC_CONTENT, ...(d.publicContent ?? {}) } });
});

app.put('/api/admin/public-content', (req: Request, res: Response) => {
  const d = loadDB();
  const current = { ...DEFAULT_PUBLIC_CONTENT, ...(d.publicContent ?? {}) };
  const next = { ...current };
  for (const key of Object.keys(DEFAULT_PUBLIC_CONTENT) as Array<keyof typeof DEFAULT_PUBLIC_CONTENT>) {
    const defaultValue = DEFAULT_PUBLIC_CONTENT[key];
    const supplied = req.body?.[key];
    if (typeof defaultValue === 'boolean' && typeof supplied === 'boolean') {
      (next as any)[key] = supplied;
    } else if (typeof defaultValue === 'string' && typeof supplied === 'string') {
      (next as any)[key] = supplied.trim().slice(0, 1000) || defaultValue;
    }
  }
  d.publicContent = next;
  persist();
  res.json({ settings: next, message: 'Konten dashboard publik berhasil diperbarui' });
});

// ---------- Pengaturan notifikasi email tiket ----------
app.get('/api/admin/notification-settings', (_req: Request, res: Response) => {
  const d = loadDB();
  res.json({ settings: getNotificationSettings(d), smtp: smtpSummary() });
});

app.put('/api/admin/notification-settings', (req: Request, res: Response) => {
  const d = loadDB();
  const current = getNotificationSettings(d);
  const next: NotificationSettings = {
    enabled: typeof req.body?.enabled === 'boolean' ? req.body.enabled : current.enabled,
    recipients:
      typeof req.body?.recipients === 'string'
        ? parseRecipients(req.body.recipients).join(', ')
        : current.recipients,
    notify_applicant:
      typeof req.body?.notify_applicant === 'boolean'
        ? req.body.notify_applicant
        : current.notify_applicant,
  };
  d.notifications = next;
  persist();
  res.json({ settings: next, smtp: smtpSummary(), message: 'Pengaturan notifikasi tersimpan' });
});

// Kirim email tes untuk memverifikasi konfigurasi SMTP
app.post('/api/admin/notification-settings/test', async (req: Request, res: Response) => {
  const d = loadDB();
  const settings = getNotificationSettings(d);
  const override = typeof req.body?.email === 'string' ? parseRecipients(req.body.email) : [];
  const to = override.length > 0 ? override : parseRecipients(settings.recipients);
  if (to.length === 0) {
    return res.status(400).json({ error: 'Isi alamat email tujuan terlebih dahulu' });
  }
  const result = await sendMail({
    to,
    subject: '[Smart Space] Tes notifikasi email',
    text: 'Ini adalah email tes dari Smart Space. Bila Anda menerima email ini, konfigurasi SMTP sudah benar.',
    html:
      '<p>✅ Ini adalah <strong>email tes</strong> dari Smart Space. Bila Anda menerima email ini, konfigurasi SMTP sudah benar.</p>',
  });
  res.json(result);
});

const normalizeRoomInput = (body: any, roomId: string) => {
  const geometry = body.geometry ?? { type: 'rectangle' as const, points: [] as number[] };
  const bb = boundingBox(geometry.points);
  const luas = geometry.type === 'polygon'
    ? polygonArea(geometry.points)
    : (bb.maxX - bb.minX) * (bb.maxY - bb.minY);
  return {
    room_code: String(body.room_code ?? roomId).trim(),
    name: String(body.name ?? 'Ruangan Baru').trim(),
    floor: String(body.floor ?? 'Lantai 1').trim(),
    zone: String(body.zone ?? 'Zona A').trim(),
    geometry,
    size: {
      panjang: round2(Math.abs(bb.maxX - bb.minX)),
      lebar: round2(Math.abs(bb.maxY - bb.minY)),
      luas_m2: round2(luas),
    },
    price: Number(body.price ?? 0),
    photos: Array.isArray(body.photos) ? body.photos : [],
    notes: String(body.notes ?? ''),
  };
};

const ROOM_BACKUP_FORMAT = 'smart-space-room-backup';
const ROOM_BACKUP_VERSION = 1;

function restoreRoomFromJson(raw: any, index: number, d: DBShape): Room {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Data ruangan ke-${index + 1} bukan object`);
  }
  const roomId = typeof raw.room_id === 'string' ? raw.room_id.trim() : '';
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(roomId) || ['__proto__', 'prototype', 'constructor'].includes(roomId)) {
    throw new Error(`room_id ruangan ke-${index + 1} tidak valid`);
  }
  const geometryType = raw.geometry?.type;
  const points = raw.geometry?.points;
  if (!['rectangle', 'polygon'].includes(geometryType) || !Array.isArray(points)) {
    throw new Error(`Geometri ruangan ${roomId} tidak valid`);
  }
  if (points.length < 6 || points.length > 20_000 || points.length % 2 !== 0 || !points.every(Number.isFinite)) {
    throw new Error(`Koordinat ruangan ${roomId} harus berupa pasangan angka polygon yang valid`);
  }
  const area = polygonArea(points);
  if (!Number.isFinite(area) || area <= 0) throw new Error(`Luas ruangan ${roomId} tidak valid`);

  const requiredText = (value: unknown, field: string, fallback: string, max = 200) => {
    const text = typeof value === 'string' ? value.trim() : fallback;
    if (!text) throw new Error(`${field} ruangan ${roomId} tidak boleh kosong`);
    return text.slice(0, max);
  };
  const nullableText = (value: unknown) => typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 100)
    : null;
  const price = Number(raw.price ?? 0);
  if (!Number.isFinite(price) || price < 0) throw new Error(`Harga ruangan ${roomId} tidak valid`);
  const status: RoomStatus = ['kosong', 'terisi', 'proses'].includes(raw.status) ? raw.status : 'kosong';
  const tenantId = nullableText(raw.current_tenant_id);
  const photos = Array.isArray(raw.photos)
    ? raw.photos.filter((photo: unknown): photo is string => {
        if (typeof photo !== 'string' || !photo.startsWith('/uploads/')) return false;
        const filename = path.basename(photo);
        return photo === `/uploads/${filename}` && fs.existsSync(path.join(UPLOAD_DIR, filename));
      }).slice(0, 5)
    : [];
  const geometry = { type: geometryType as Room['geometry']['type'], points: [...points] };
  const bb = boundingBox(points);

  return {
    room_id: roomId,
    room_code: requiredText(raw.room_code, 'Kode', roomId, 100),
    name: requiredText(raw.name, 'Nama', 'Ruangan', 200),
    floor: requiredText(raw.floor, 'Lantai', 'Lantai 1', 100),
    zone: requiredText(raw.zone, 'Zona', 'Zona A', 100),
    geometry,
    size: {
      panjang: round2(Math.abs(bb.maxX - bb.minX)),
      lebar: round2(Math.abs(bb.maxY - bb.minY)),
      luas_m2: round2(geometryType === 'polygon'
        ? area
        : Math.abs((bb.maxX - bb.minX) * (bb.maxY - bb.minY))),
    },
    price,
    photos,
    status,
    current_tenant_id: tenantId && d.tenants[tenantId] ? tenantId : null,
    current_lease_start: nullableText(raw.current_lease_start),
    current_lease_end: nullableText(raw.current_lease_end),
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 5000) : '',
    created_at: typeof raw.created_at === 'string' ? raw.created_at.slice(0, 100) : now(),
    updated_at: now(),
  };
}

app.get('/api/admin/rooms/backup', (_req: Request, res: Response) => {
  const d = loadDB();
  const date = new Date().toISOString().replace(/[:.]/g, '-');
  const payload = {
    format: ROOM_BACKUP_FORMAT,
    version: ROOM_BACKUP_VERSION,
    exported_at: now(),
    room_count: Object.keys(d.rooms).length,
    note: 'Foto disimpan sebagai referensi URL dan tidak disertakan sebagai data biner.',
    rooms: values(d.rooms),
  };
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="smart-space-rooms-${date}.json"`);
  res.send(JSON.stringify(payload, null, 2));
});

app.post('/api/admin/rooms/restore', (req: Request, res: Response) => {
  const payload = req.body?.backup ?? req.body;
  if (payload?.format !== ROOM_BACKUP_FORMAT || payload?.version !== ROOM_BACKUP_VERSION || !Array.isArray(payload?.rooms)) {
    return res.status(400).json({ error: 'Format backup JSON ruangan tidak dikenali atau versinya tidak didukung' });
  }
  if (payload.rooms.length > 10_000) return res.status(400).json({ error: 'Backup berisi terlalu banyak ruangan' });

  const d = loadDB();
  try {
    const restoredRooms: Record<string, Room> = Object.create(null);
    payload.rooms.forEach((raw: unknown, index: number) => {
      const room = restoreRoomFromJson(raw, index, d);
      if (restoredRooms[room.room_id]) throw new Error(`room_id duplikat: ${room.room_id}`);
      restoredRooms[room.room_id] = room;
    });

    const oldRoomCount = Object.keys(d.rooms).length;
    d.rooms = restoredRooms;
    const oldLeaseCount = Object.keys(d.leases).length;
    const oldRequestCount = Object.keys(d.requests).length;
    d.leases = Object.fromEntries(Object.entries(d.leases).filter(([, lease]) => Boolean(d.rooms[lease.room_id])));
    d.requests = Object.fromEntries(Object.entries(d.requests).filter(([, request]) => Boolean(d.rooms[request.room_id])));
    const maxRoomCounter = Object.keys(d.rooms).reduce((max, id) => {
      const suffix = Number(id.match(/(\d+)$/)?.[1] ?? 0);
      return Number.isFinite(suffix) ? Math.max(max, suffix) : max;
    }, 0);
    d.counters.room = Math.max(d.counters.room, maxRoomCounter);
    persist();

    return res.json({
      ok: true,
      restored: Object.keys(d.rooms).length,
      replaced: oldRoomCount,
      removedOrphanLeases: oldLeaseCount - Object.keys(d.leases).length,
      removedOrphanRequests: oldRequestCount - Object.keys(d.requests).length,
      message: `${Object.keys(d.rooms).length} ruangan berhasil dipulihkan dari backup JSON`,
    });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Isi backup JSON tidak valid' });
  }
});

app.get('/api/admin/rooms', (_req: Request, res: Response) => {
  const d = loadDB();
  res.json({ rooms: values(d.rooms).map((r) => roomDto(d, r)) });
});

app.post('/api/admin/rooms', (req, res) => {
  const d = loadDB();
  const id = nextId('ROOM', 'room');
  const input = normalizeRoomInput(req.body, id);
  const room: Room = {
    room_id: id,
    ...input,
    status: (req.body.status as RoomStatus) ?? 'kosong',
    current_tenant_id: null,
    current_lease_start: null,
    current_lease_end: null,
    created_at: now(),
    updated_at: now(),
  };
  d.rooms[id] = room;
  persist();
  res.status(201).json({ room });
});
app.put('/api/admin/rooms/:id', (req, res) => {
  const d = loadDB();
  const room = d.rooms[req.params.id];
  if (!room) return res.status(404).json({ error: 'Ruangan tidak ditemukan' });
  const input = normalizeRoomInput(req.body, room.room_id);
  const newStatus = (req.body.status as RoomStatus | undefined) ?? room.status;
  const previousPhotos = room.photos ?? [];
  room.room_code = input.room_code;
  room.name = input.name;
  room.floor = input.floor;
  room.zone = input.zone;
  room.geometry = input.geometry;
  room.size = input.size;
  room.price = input.price;
  room.photos = input.photos;
  room.notes = input.notes;
  room.status = newStatus;
  room.updated_at = now();
  persist();
  deleteUploadedFiles(previousPhotos.filter((photo) => !room.photos.includes(photo)));
  res.json({ room: roomDto(d, room) });
});

app.post('/api/admin/rooms/:id/photos', roomPhotoUpload.array('photos', 5), (req, res) => {
  const d = loadDB();
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const room = d.rooms[String(req.params.id)];
  if (!room) {
    deleteUploadedFiles(files.map((file) => `/uploads/${file.filename}`));
    return res.status(404).json({ error: 'Ruangan tidak ditemukan' });
  }
  if (files.length === 0) return res.status(400).json({ error: 'Pilih minimal satu foto ruangan' });
  if (files.some((file) => !hasValidRoomPhotoSignature(file))) {
    deleteUploadedFiles(files.map((file) => `/uploads/${file.filename}`));
    return res.status(400).json({ error: 'Isi file tidak cocok dengan format foto yang didukung' });
  }

  const currentPhotos = room.photos ?? [];
  if (currentPhotos.length + files.length > 5) {
    deleteUploadedFiles(files.map((file) => `/uploads/${file.filename}`));
    return res.status(400).json({ error: 'Maksimal 5 foto untuk setiap ruangan' });
  }

  room.photos = [...currentPhotos, ...files.map((file) => `/uploads/${file.filename}`)];
  room.updated_at = now();
  persist();
  res.status(201).json({ room: roomDto(d, room) });
});

app.patch('/api/admin/rooms/:id/status', (req, res) => {
  const d = loadDB();
  const room = d.rooms[req.params.id];
  if (!room) return res.status(404).json({ error: 'Ruangan tidak ditemukan' });
  const status = req.body.status as RoomStatus;
  if (!['kosong', 'terisi', 'proses'].includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid' });
  }
  room.status = status;
  room.updated_at = now();
  persist();
  res.json({ room: roomDto(d, room) });
});

app.delete('/api/admin/rooms/:id', (req, res) => {
  const d = loadDB();
  const room = d.rooms[req.params.id];
  if (!room) return res.status(404).json({ error: 'Ruangan tidak ditemukan' });
  delete d.rooms[req.params.id];
  persist();
  deleteUploadedFiles(room.photos ?? []);
  res.json({ ok: true });
});

// Hapus SEMUA data ruang komersial: ruangan, tenant/brand, lease,
// permintaan sewa, dan denah/lantai agar tidak ada referensi yatim.
app.delete('/api/admin/rooms', (_req: Request, res: Response) => {
  const d = loadDB();
  const roomPhotos = Object.values(d.rooms).flatMap((room) => room.photos ?? []);
  const tenantDocuments = Object.values(d.tenants).flatMap((tenant) => tenant.company_docs ?? []);
  const requestAttachments = Object.values(d.requests).flatMap((request) => request.attachments ?? []);
  const deleted = {
    rooms: Object.keys(d.rooms).length,
    tenants: Object.keys(d.tenants).length,
    leases: Object.keys(d.leases).length,
    requests: Object.keys(d.requests).length,
    floors: Object.keys(d.floorPlans).length,
  };
  d.rooms = {};
  d.tenants = {};
  d.leases = {};
  d.requests = {};
  d.floorPlans = {};
  d.counters.room = 0;
  d.counters.tenant = 0;
  d.counters.lease = 0;
  d.counters.request = 0;
  d.counters.ticket = 0;
  d.counters.floor = 0;
  persist();
  deleteUploadedFiles([...new Set([...roomPhotos, ...tenantDocuments, ...requestAttachments])]);
  res.json({
    ok: true,
    deleted,
    message: `Semua data dihapus (${deleted.rooms} ruangan, ${deleted.tenants} tenant/brand, ${deleted.floors} lantai, ${deleted.leases} lease, ${deleted.requests} permintaan)`,
  });
});

// Upload denah: gambar background ATAU file DXF (di-parse di backend)
app.post('/api/admin/floor', upload.fields([{ name: 'file', maxCount: 1 }]), (req, res) => {
  const d = loadDB();
  const file = (req.files as any)?.['file']?.[0] as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: 'File wajib diisi' });

  const dID = nextId('FLR', 'floor');
  const version = (d.floorPlans ? Object.keys(d.floorPlans).length : 0) + 1;
  const ext = path.extname(file.originalname).toLowerCase();
  const requestedSource = req.body.source_type === 'dxf' ? 'dxf' : 'manual';
  if (requestedSource === 'dxf' && ext !== '.dxf') {
    fs.rmSync(file.path, { force: true });
    return res.status(400).json({ error: 'Import CAD saat ini hanya mendukung file .dxf. Konversi DWG ke DXF terlebih dahulu.' });
  }
  if (requestedSource === 'manual' && !['.png', '.jpg', '.jpeg', '.webp', '.svg', '.bmp'].includes(ext)) {
    fs.rmSync(file.path, { force: true });
    return res.status(400).json({ error: 'Background denah harus berupa PNG/JPG/WEBP/SVG/BMP.' });
  }

  let parsedRooms: Array<{ points: number[] }> = [];
  let parsedLinework: FloorPlan['linework'] = [];
  let parsedTexts: FloorPlan['texts'] = [];
  if (ext === '.dxf') {
    const text = fs.readFileSync(file.path, 'utf-8');
    const parsed = parseDXF(text);
    parsedRooms = parsed.rooms;
    parsedLinework = parsed.linework;
    parsedTexts = parsed.texts;
  }

  let width = Number(req.body.width) || 1200;
  let height = Number(req.body.height) || 800;
  if (parsedLinework.length > 0 || parsedRooms.length > 0 || parsedTexts.length > 0) {
    const allX: number[] = [];
    const allY: number[] = [];
    const paths = parsedLinework.length > 0 ? parsedLinework : parsedRooms;
    paths.forEach((p) => {
      for (let i = 0; i < p.points.length; i += 2) {
        allX.push(p.points[i]);
        allY.push(p.points[i + 1]);
      }
    });
    parsedTexts.forEach((label) => {
      allX.push(label.x, label.x + (label.width ?? label.text.length * label.height * 0.6));
      allY.push(label.y, label.y + label.height);
    });
    if (allX.length) {
      const minX = Math.min(...allX);
      const maxX = Math.max(...allX);
      const minY = Math.min(...allY);
      const maxY = Math.max(...allY);
      const margin = 50;
      const transform = (points: number[]) => points.flatMap((value, index) => (
        index % 2 === 0 ? value - minX + margin : maxY - value + margin
      ));
      parsedRooms = parsedRooms.map((room) => ({ points: transform(room.points) }));
      parsedLinework = parsedLinework.map((path) => ({ ...path, points: transform(path.points) }));
      parsedTexts = parsedTexts.map((label) => ({
        ...label,
        x: label.x - minX + margin,
        y: maxY - label.y + margin,
        rotation: -label.rotation,
      }));
      width = Math.max(100, Math.ceil(maxX - minX) + margin * 2);
      height = Math.max(100, Math.ceil(maxY - minY) + margin * 2);
    }
  }

  const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(file.originalname);
  const floorPlan: FloorPlan = {
    floor_id: dID,
    floor: String(req.body.floor || 'Lantai 1').trim(),
    source_type: requestedSource,
    file_url: `/uploads/${file.filename}`,
    background_url: isImage ? `/uploads/${file.filename}` : null,
    linework: parsedLinework,
    texts: parsedTexts,
    width: Math.round(width),
    height: Math.round(height),
    version,
    uploaded_by: (req as any).admin?.username ?? 'admin',
    uploaded_at: now(),
  };
  d.floorPlans[dID] = floorPlan;

  // Auto-create draft rooms untuk polygon dari hasil parse DXF
  const created: Room[] = [];
  parsedRooms.forEach((poly, i) => {
    const id = nextId('ROOM', 'room');
    const bb = boundingBox(poly.points);
    const room: Room = {
      room_id: id,
      room_code: `DXF-${String(i + 1).padStart(3, '0')}`,
      name: `Ruangan DXF ${i + 1}`,
      floor: floorPlan.floor,
      zone: 'Zona DXF',
      geometry: { type: 'polygon', points: poly.points },
      size: {
        panjang: round2(Math.abs(bb.maxX - bb.minX)),
        lebar: round2(Math.abs(bb.maxY - bb.minY)),
        luas_m2: round2(polygonArea(poly.points)),
      },
      price: 0,
      photos: [],
      status: 'kosong',
      current_tenant_id: null,
      current_lease_start: null,
      current_lease_end: null,
      notes: 'Draft hasil import DXF',
      created_at: now(),
      updated_at: now(),
    };
    d.rooms[id] = room;
    created.push(room);
  });

  persist();
  res.status(201).json({
    floorPlan,
    createdRooms: created.length,
    drawnEntities: parsedLinework.length,
    drawnTexts: parsedTexts.length,
    message: created.length
      ? `DXF tersimpan: ${parsedLinework.length} entitas dan ${parsedTexts.length} teks digambar; ${created.length} polyline/rectangle tertutup menjadi ruangan draft`
      : ext === '.dxf'
        ? `DXF tersimpan: ${parsedLinework.length} entitas dan ${parsedTexts.length} teks digambar; tidak ada polyline/rectangle tertutup untuk dijadikan ruangan`
        : 'Denah tersimpan (manual / gambar)',
  });
});
// Daftar pengajuan (admin)
app.get('/api/admin/requests', (_req: Request, res: Response) => {
  const d = loadDB();
  const list = values(d.requests).map((r) => ({
    ...r,
    room: d.rooms[r.room_id]
      ? {
          room_id: d.rooms[r.room_id].room_id,
          room_code: d.rooms[r.room_id].room_code,
          name: d.rooms[r.room_id].name,
        }
      : null,
  }));
  res.json({ requests: list });
});

// Approve / reject pengajuan -> update status peta otomatis (plan.md 4.2)
app.patch('/api/admin/requests/:id', (req, res) => {
  const d = loadDB();
  const request = d.requests[req.params.id];
  if (!request) return res.status(404).json({ error: 'Pengajuan tidak ditemukan' });
  if (request.status !== 'pending') {
    return res.status(409).json({ error: 'Pengajuan sudah diproses dan tidak dapat direview ulang' });
  }
  const action = String(req.body.action ?? '');
  // Counter tiket pending lain yang otomatis ditolak karena ruangan sudah dipilih untuk tiket tertentu
  let supersededTickets = 0;
  const supersededRequests: RentalRequest[] = [];

  if (action === 'approve') {
    const room = d.rooms[request.room_id];
    if (!room) return res.status(409).json({ error: 'Ruangan pada pengajuan sudah tidak tersedia' });
    if (room.status === 'terisi') {
      return res.status(409).json({ error: 'Ruangan sudah terisi dan tidak dapat disetujui lagi' });
    }
    const tenantId = nextId('TEN', 'tenant');
    const tenant: Tenant = {
      tenant_id: tenantId,
      brand_name: request.brand_name,
      pic_name: request.pic_name,
      contact_phone: request.contact_phone,
      contact_email: request.contact_email,
      company_docs: request.attachments,
      created_at: now(),
    };
    d.tenants[tenantId] = tenant;

    const leaseId = nextId('LSE', 'lease');
    const start = request.start_date || now().slice(0, 10);
    const end = addMonths(start, request.duration_months || 1);
    d.leases[leaseId] = {
      lease_id: leaseId,
      room_id: request.room_id,
      tenant_id: tenantId,
      start_date: start,
      end_date: end,
      status: 'aktif',
      created_at: now(),
    };

    if (room) {
      room.status = 'terisi';
      room.current_tenant_id = tenantId;
      room.current_lease_start = start;
      room.current_lease_end = end;
      room.updated_at = now();
    }
    request.status = 'approved';

    // Multi-tiket: tolak otomatis semua tiket pending lain pada ruangan yang sama,
    // karena ruangan kini telah disetujui untuk pemenang tiket ini.
    for (const other of Object.values(d.requests)) {
      if (
        other.request_id !== request.request_id &&
        other.room_id === request.room_id &&
        other.status === 'pending'
      ) {
        other.status = 'rejected';
        other.reject_reason = `Ruangan ${room.room_code} telah disetujui untuk tiket ${request.ticket_no}`;
        other.reviewed_by = (req as any).admin?.username ?? 'admin';
        other.reviewed_at = now();
        supersededTickets += 1;
        supersededRequests.push(other);
      }
    }
  } else if (action === 'reject') {
    // Penolakan satu tiket TIDAK mengubah status ruangan —
    // tiket pending lain pada ruangan yang sama tetap bisa diproses admin.
    request.status = 'rejected';
    request.reject_reason = String(req.body.reason ?? 'Tidak ada alasan').trim();
  } else {
    return res.status(400).json({ error: "Action harus 'approve' atau 'reject'" });
  }
  request.reviewed_by = (req as any).admin?.username ?? 'admin';
  request.reviewed_at = now();
  persist();

  // Notifikasi email hasil review ke pengaju (bila fitur diaktifkan)
  notifyTicketReviewed(d, request, action === 'approve' ? 'approved' : 'rejected');
  for (const sup of supersededRequests) {
    notifyTicketReviewed(d, sup, 'rejected');
  }

  res.json({ request, superseded_tickets: supersededTickets });
});

// Statistik dashboard admin (perkiraan milestone 8)
app.get('/api/admin/stats', (_req: Request, res: Response) => {
  const d = loadDB();
  syncExpiredLeases(d);
  const rooms = Object.values(d.rooms);
  const requests = Object.values(d.requests);
  const byStatus: Record<string, number> = { kosong: 0, terisi: 0, proses: 0 };
  rooms.forEach((r) => (byStatus[r.status] = (byStatus[r.status] ?? 0) + 1));
  const okupansi = rooms.length ? Math.round((byStatus['terisi'] / rooms.length) * 100) : 0;
  res.json({
    stats: {
      totalRooms: rooms.length,
      totalFloors: Object.keys(d.floorPlans).length,
      occupancyRate: okupansi,
      byStatus,
      totalTenants: Object.keys(d.tenants).length,
      totalLeases: Object.keys(d.leases).length,
      pendingRequests: requests.filter((r) => r.status === 'pending').length,
      approvedRequests: requests.filter((r) => r.status === 'approved').length,
      rejectedRequests: requests.filter((r) => r.status === 'rejected').length,
    },
  });
});

// Reset data demo (opsional, untuk development)
app.post('/api/admin/reset', async (_req: Request, res: Response) => {
  const { seed } = await import('./seed.js');
  seed();
  res.json({ ok: true, message: 'Data direset ke seed awal' });
});

// ------------------------------------------------------------------
// Server
// ------------------------------------------------------------------
const PORT = Number(process.env.PORT || 3001);

// Sajikan build frontend (production) jika sudah di-build
const FRONT_DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(path.join(FRONT_DIST, 'index.html'))) {
  app.use(express.static(FRONT_DIST));
  // Fallback SPA (Express 4): route non-API dikembalikan ke index.html
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(FRONT_DIST, 'index.html'));
  });
}

app.listen(PORT, () => {
  loadDB(); // pastikan file data dibuat saat server start
  console.log(`[smart-space] API berjalan di http://localhost:${PORT}`);
  console.log('[smart-space] Admin default: admin / admin123 (ubah melalui env)');
  console.log(`[smart-space] Data: ${process.env.SMARTSPACE_DATA_DIR || 'backend/data'} | Upload: ${UPLOAD_DIR}`);
});
