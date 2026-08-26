// ---------- Shared domain types (sesuai Section 5 plan.md) ----------

export type RoomStatus = 'kosong' | 'terisi' | 'proses';

export interface Room {
  room_id: string;
  room_code: string; // contoh: A-01
  name: string;
  floor: string;
  zone: string;
  geometry: Geometry; // koordinat polygon dari DXF/manual drawing
  size: { panjang: number; lebar: number; luas_m2: number };
  price: number; // per bulan, 0 = "hubungi admin"
  photos: string[]; // url path
  status: RoomStatus;
  current_tenant_id: string | null;
  current_lease_start: string | null;
  current_lease_end: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Geometry {
  // path (polygon) dalam koordinat canvas. floors sama karena 2D denah.
  points: number[]; // [x1,y1, x2,y2, ...]
  type: 'rectangle' | 'polygon';
}

export interface Tenant {
  tenant_id: string;
  brand_name: string;
  pic_name: string;
  contact_phone: string;
  contact_email: string;
  company_docs: string[];
  created_at: string;
}

export type LeaseStatus = 'aktif' | 'selesai' | 'dibatalkan';

export interface Lease {
  lease_id: string;
  room_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  status: LeaseStatus;
  created_at: string;
}

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface RentalRequest {
  request_id: string;
  ticket_no: string; // contoh SS-20240820-XXXX
  room_id: string;
  brand_name: string;
  pic_name: string;
  contact_phone: string;
  contact_email: string;
  duration_months: number;
  start_date: string; // kapan ingin mulai
  budget: string; // teks, mis. "Rp 5-10 juta/bulan"
  notes: string;
  attachments: string[]; // url file
  status: RequestStatus;
  reject_reason: string | null;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface FloorPlan {
  floor_id: string;
  floor: string;
  source_type: 'dxf' | 'manual';
  file_url: string | null; // file asli yang diupload
  background_url: string | null; // gambar denah dasar (opsional)
  linework?: FloorLinework[]; // entitas vektor DXF untuk digambar di bawah ruangan
  texts?: FloorText[]; // TEXT/MTEXT DXF untuk label denah
  width: number;
  height: number;
  version: number;
  uploaded_by: string;
  uploaded_at: string;
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

export type Attachment = {
  fieldname: string;
  originalname: string;
  filename: string;
  path: string;
  size: number;
};

export interface DBShape {
  rooms: Record<string, Room>;
  tenants: Record<string, Tenant>;
  leases: Record<string, Lease>;
  requests: Record<string, RentalRequest>;
  floorPlans: Record<string, FloorPlan>;
  publicContent?: PublicContentSettings;
  counters: { room: number; request: number; ticket: number; tenant: number; lease: number; floor: number };
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
