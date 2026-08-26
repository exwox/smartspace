// ---- Shared types selaras dengan backend/src/types.ts ----
export type RoomStatus = 'kosong' | 'terisi' | 'proses';

export interface Geometry {
  points: number[];
  type: 'rectangle' | 'polygon';
}

export interface Lease {
  lease_id: string;
  room_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  status: 'aktif' | 'selesai' | 'dibatalkan';
  tenant?: Tenant | null;
}

export interface Tenant {
  tenant_id: string;
  brand_name: string;
  pic_name: string;
  contact_phone: string;
  contact_email: string;
  company_docs: string[];
}

export interface Room {
  room_id: string;
  room_code: string;
  name: string;
  floor: string;
  zone: string;
  geometry: Geometry;
  size: { panjang: number; lebar: number; luas_m2: number };
  price: number;
  photos: string[];
  status: RoomStatus;
  current_tenant_id: string | null;
  current_lease_start: string | null;
  current_lease_end: string | null;
  notes: string;
  history: Lease[] | null;
  current_tenant?: { tenant_id: string; brand_name: string } | null;
  active_lease?: Lease | null;
  /** Jumlah tiket pengajuan berstatus pending untuk ruangan ini (multi-tiket per ruangan) */
  pending_requests?: number;
}

export interface RentalRequest {
  request_id: string;
  ticket_no: string;
  room_id: string;
  brand_name: string;
  pic_name: string;
  contact_phone: string;
  contact_email: string;
  duration_months: number;
  start_date: string;
  budget: string;
  notes: string;
  attachments: string[];
  status: 'pending' | 'approved' | 'rejected';
  reject_reason: string | null;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  room?: { room_id: string; room_code: string; name: string } | null;
}

export interface FloorPlan {
  floor_id: string;
  floor: string;
  source_type: 'dxf' | 'manual';
  file_url: string | null;
  background_url: string | null;
  linework?: FloorLinework[];
  texts?: FloorText[];
  width: number;
  height: number;
  version: number;
}

export interface FloorLinework {
  points: number[];
  closed: boolean;
  entity: 'LINE' | 'LWPOLYLINE' | 'POLYLINE' | 'RECTANGLE' | 'CIRCLE' | 'ARC' | 'ELLIPSE';
}

export interface FloorText {
  text: string;
  x: number;
  y: number;
  height: number;
  width?: number;
  rotation: number;
  entity: 'TEXT' | 'MTEXT';
}

export interface Stats {
  totalRooms: number;
  totalFloors: number;
  occupancyRate: number;
  byStatus: Record<string, number>;
  totalTenants: number;
  totalLeases: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
}

export interface PublicContentSettings {
  showHeroStats: boolean;
  showProfile: boolean;
  showTraffic: boolean;
  showFacilities: boolean;
  showSmartSpace: boolean;
  showCta: boolean;
  showFooter: boolean;
  heroBadge: string;
  heroTitle: string;
  heroHighlight: string;
  heroDescription: string;
  heroPrimaryButton: string;
  heroSecondaryButton: string;
  profileTitle: string;
  profileDescription: string;
  trafficTitle: string;
  facilitiesTitle: string;
  smartSpaceTitle: string;
  ctaTitle: string;
  ctaDescription: string;
  footerText: string;
}

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

export const STATUS_LABEL: Record<RoomStatus, string> = {
  kosong: 'Kosong',
  terisi: 'Terisi',
  proses: 'Dalam Proses',
};

export const STATUS_COLOR: Record<RoomStatus, string> = {
  kosong: '#10b981', // hijau
  terisi: '#ef4444', // merah
  proses: '#f59e0b', // kuning
};

/**
 * Status efektif untuk tampilan publik: ruangan kosong yang memiliki tiket
 * pending ditampilkan kuning ("Dalam Proses"), namun tetap menerima tiket baru.
 * Status berubah menjadi "Terisi" hanya setelah admin menyetujui salah satu tiket.
 */
export function displayStatus(room: Pick<Room, 'status' | 'pending_requests'>): RoomStatus {
  if (room.status === 'kosong' && (room.pending_requests ?? 0) > 0) return 'proses';
  return room.status;
}

/** Ruangan masih menerima pengajuan selama belum disetujui untuk penyewa lain. */
export function canApplyRoom(room: Pick<Room, 'status'>): boolean {
  return room.status !== 'terisi';
}

export function formatRupiah(n: number): string {
  if (!n) return 'Hubungi Admin';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

export function formatDate(s: string | null | undefined): string {
  if (!s) return '-';
  const d = new Date(s.length <= 10 ? s + 'T00:00:00' : s);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---------- Notifikasi email tiket ----------
export interface NotificationSettings {
  /** Aktifkan pengiriman email saat ada tiket baru masuk. */
  enabled: boolean;
  /** Daftar email tujuan (admin), dipisah koma/titik koma/spasi. */
  recipients: string;
  /** Juga kirim email ke pengaju (konfirmasi tiket & hasil review). */
  notify_applicant: boolean;
}

export interface SmtpSummary {
  configured: boolean;
  host?: string;
  port?: string;
  secure: boolean;
}

/** Pengaturan AI Agent via gateway 9Router (OpenAI-compatible) — bentuk aman tanpa api_key. */
export interface AgentSettingsView {
  enabled: boolean;
  base_url: string;
  model: string;
  system_prompt: string;
  api_key_configured: boolean;
}

// ---------- Chat CRM (widget popup pojok kanan bawah) ----------
export type ChatSender = 'visitor' | 'admin' | 'ai' | 'system';

export interface ChatMessage {
  message_id: string;
  sender: ChatSender;
  body: string;
  created_at: string;
}

export interface ChatConversation {
  conversation_id: string;
  /** Token acak milik browser pengunjung (localStorage) — identitas tanpa login. */
  visitor_token: string;
  visitor_name: string;
  visitor_email: string;
  page_url: string | null;
  status: 'open' | 'closed';
  /** AI agent aktif membalas otomatis (false = admin ambil alih manual). */
  agent_active?: boolean;
  unread_for_admin: number;
  unread_for_visitor: number;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
  last_message?: ChatMessage | null;
}

// ---------- Helper geometri ruangan ----------
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Bounding box dari daftar titik polygon [x1,y1,x2,y2,...]. */
export function boundsOf(points: number[]): Bounds {
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
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

/**
 * Ubah ukuran rectangle dengan mempertahankan sudut kiri-atas.
 * Menghasilkan titik [kiri-atas, kanan-atas, kanan-bawah, kiri-bawah].
 * Ukuran minimal dibatasi 1 unit agar rectangle tidak hilang.
 */
export function resizedRectanglePoints(points: number[], panjang: number, lebar: number): number[] {
  const b = boundsOf(points);
  const w = Math.max(1, panjang);
  const h = Math.max(1, lebar);
  return [
    b.minX,
    b.minY,
    b.minX + w,
    b.minY,
    b.minX + w,
    b.minY + h,
    b.minX,
    b.minY + h,
  ];
}

export const roundGeometry = (n: number): number => Math.round(n * 100) / 100;
