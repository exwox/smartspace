import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DBShape, NotificationSettings, PublicContentSettings } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.SMARTSPACE_DATA_DIR
  ? path.resolve(process.env.SMARTSPACE_DATA_DIR)
  : path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export const DEFAULT_PUBLIC_CONTENT: PublicContentSettings = {
  showHeroStats: true,
  showProfile: true,
  showTraffic: true,
  showFacilities: true,
  showSmartSpace: true,
  showCta: true,
  showFooter: true,
  heroBadge: 'Airport Commercial Opportunity · Tanjungpinang',
  heroTitle: 'Hadirkan bisnis Anda di tengah',
  heroHighlight: 'arus perjalanan TNJ.',
  heroDescription: 'Bandar Udara Raja Haji Fisabilillah adalah gerbang udara domestik Kota Tanjungpinang. Smart Space membantu calon tenant memahami potensi lokasi, melihat ruang secara visual, lalu mengajukan sewa dari satu platform.',
  heroPrimaryButton: 'Lihat ruang tersedia',
  heroSecondaryButton: 'Jelajahi profil bandara',
  profileTitle: 'Raja Haji Fisabilillah Airport [TNJ]',
  profileDescription: 'Perkembangan bandara memberi pengaruh pada perkembangan fisik Kota Tanjungpinang, dengan kecenderungan pertumbuhan kota bergerak ke arah timur—area tempat bandara berada.',
  trafficTitle: 'Pergerakan yang membentuk peluang.',
  facilitiesTitle: 'Ekosistem terminal untuk mendukung aktivitas komersial.',
  smartSpaceTitle: 'Dari melihat lokasi sampai mengirim pengajuan, semuanya lebih jelas.',
  ctaTitle: 'Sudah mengenal TNJ. Sekarang pilih lokasi bisnis Anda.',
  ctaDescription: 'Buka peta terminal, lihat status ruang secara visual, pilih space yang sesuai, lalu mulai pengajuan sewa.',
  footerText: '© 2026 Smart Space — Raja Haji Fisabilillah Airport [TNJ]',
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false,
  recipients: '',
  notify_applicant: true,
};

function emptyDB(): DBShape {
  return {
    rooms: {},
    tenants: {},
    leases: {},
    requests: {},
    floorPlans: {},
    publicContent: { ...DEFAULT_PUBLIC_CONTENT },
    notifications: { ...DEFAULT_NOTIFICATION_SETTINGS },
    counters: { room: 0, request: 0, ticket: 0, tenant: 0, lease: 0, floor: 0 },
  };
}

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let cache: DBShape | null = null;

export function loadDB(): DBShape {
  if (cache) return cache;
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    cache = emptyDB();
    persist();
  } else {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      cache = JSON.parse(raw) as DBShape;
      cache.publicContent = { ...DEFAULT_PUBLIC_CONTENT, ...(cache.publicContent ?? {}) };
      cache.notifications = { ...DEFAULT_NOTIFICATION_SETTINGS, ...(cache.notifications ?? {}) };
    } catch {
      cache = emptyDB();
    }
  }
  return cache;
}

// Atomic write: tulis ke file temp lalu rename
export function persist(): void {
  ensureDir();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cache ?? emptyDB(), null, 2), 'utf-8');
  fs.renameSync(tmp, DB_FILE);
}

export function resetDB(): DBShape {
  cache = emptyDB();
  persist();
  return cache!;
}

export const db = (): DBShape => loadDB();

// ---- helper list/CRUD ----
export const values = <T>(obj: Record<string, T>): T[] =>
  Object.values(obj).sort((a: any, b: any) =>
    (b.created_at ?? '').localeCompare(a.created_at ?? '')); // paling baru dulu

export function nextId(prefix: string, counterKey: keyof DBShape['counters']): string {
  const d = loadDB();
  d.counters[counterKey] += 1;
  const n = d.counters[counterKey];
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const padded = String(n).padStart(4, '0');
  return `${prefix}-${date}-${padded}`;
}

export function nextTicket(): string {
  const d = loadDB();
  d.counters.ticket += 1;
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `SS-${date}-${String(d.counters.ticket).padStart(4, '0')}`;
}

export function now(): string {
  return new Date().toISOString();
}

export function roomGeometryPoints(roomId: string): number[] {
  const d = loadDB();
  const room = d.rooms[roomId];
  if (!room) return [];
  return room.geometry?.points ?? [];
}

export const ADMIN_DEFAULT = {
  username: 'admin',
  password: 'admin123',
};

export function authConfig() {
  return {
    USERNAME: process.env.ADMIN_USERNAME || ADMIN_DEFAULT.username,
    PASSWORD: process.env.ADMIN_PASSWORD || ADMIN_DEFAULT.password,
    JWT_SECRET: process.env.JWT_SECRET || 'smart-space-secret-change-me-in-production',
  };
}
