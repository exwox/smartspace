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
  rented_logo?: string | null;
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
  /** Path halaman tempat chat dimulai, mis. "/map". */
  page_url: string | null;
  status: 'open' | 'closed';
  /** AI agent aktif membalas otomatis untuk percakapan ini (false = admin ambil alih manual). */
  agent_active: boolean;
  /** Pesan visitor yang belum dibaca admin. */
  unread_for_admin: number;
  /** Balasan admin yang belum dibaca visitor. */
  unread_for_visitor: number;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

/** Pengaturan notifikasi email untuk tiket pengajuan sewa. */
export interface NotificationSettings {
  /** Aktifkan pengiriman email saat ada tiket baru masuk. */
  enabled: boolean;
  /** Daftar email tujuan (admin), dipisah koma/titik koma/spasi. */
  recipients: string;
  /** Juga kirim email ke pengaju (konfirmasi tiket & hasil review). */
  notify_applicant: boolean;
}

// ---------- AI Agent — balasan chat otomatis via gateway 9Router ----------
export interface AgentSettings {
  /** Mode Agent aktif: chat baru dibalas otomatis oleh AI. */
  enabled: boolean;
  /** Base URL gateway OpenAI-compatible, default 9Router lokal: http://localhost:20128/v1 */
  base_url: string;
  /** API key opsional (Bearer). Kosongkan untuk gateway lokal tanpa auth. */
  api_key: string;
  model: string;
  system_prompt: string;
}

/** Bentuk settings yang aman dikirim ke frontend — api_key tidak pernah diekspos. */
export interface AgentSettingsView {
  enabled: boolean;
  base_url: string;
  model: string;
  system_prompt: string;
  api_key_configured: boolean;
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
  chats: Record<string, ChatConversation>;
  publicContent?: PublicContentSettings;
  notifications?: NotificationSettings;
  agentSettings?: AgentSettings;
  counters: { room: number; request: number; ticket: number; tenant: number; lease: number; floor: number; chat: number };
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
