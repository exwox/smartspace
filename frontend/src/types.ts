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

export function formatRupiah(n: number): string {
  if (!n) return 'Hubungi Admin';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

export function formatDate(s: string | null | undefined): string {
  if (!s) return '-';
  const d = new Date(s.length <= 10 ? s + 'T00:00:00' : s);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
