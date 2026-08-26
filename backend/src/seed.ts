import { resetDB, persist, nextId, nextTicket, now } from './db.js';
import type { FloorPlan, Room, RoomStatus, Tenant, Lease, RentalRequest } from './types.js';

// Seed data demo: denah terminal 2 lantai dengan 10 ruangan
export function seed() {
  const d = resetDB();
  const tNow = now();

  // ---- Floor plans ----
  const floor1: FloorPlan = {
    floor_id: nextId('FLR', 'floor'),
    floor: 'Lantai 1',
    source_type: 'manual',
    file_url: null,
    background_url: null,
    linework: [],
    texts: [],
    width: 1200,
    height: 420,
    version: 1,
    uploaded_by: 'admin',
    uploaded_at: tNow,
  };
  d.floorPlans[floor1.floor_id] = floor1;

  const floor2: FloorPlan = {
    floor_id: nextId('FLR', 'floor'),
    floor: 'Lantai 2',
    source_type: 'manual',
    file_url: null,
    background_url: null,
    linework: [],
    texts: [],
    width: 1200,
    height: 420,
    version: 1,
    uploaded_by: 'admin',
    uploaded_at: tNow,
  };
  d.floorPlans[floor2.floor_id] = floor2;

  // ---- helper buat ruangan persegi ----
  const mkRoom = (
    room_code: string,
    name: string,
    floor: string,
    zone: string,
    x: number,
    y: number,
    w: number,
    h: number,
    price: number,
    status: RoomStatus = 'kosong',
  ): Room => {
    const id = nextId('ROOM', 'room');
    return {
      room_id: id,
      room_code,
      name,
      floor,
      zone,
      geometry: { type: 'rectangle', points: [x, y, x + w, y, x + w, y + h, x, y + h] },
      size: { panjang: w, lebar: h, luas_m2: Math.round(w * h) },
      price,
      photos: [],
      status,
      current_tenant_id: null,
      current_lease_start: null,
      current_lease_end: null,
      notes: '',
      created_at: tNow,
      updated_at: tNow,
    };
  };

  const rooms: Room[] = [
    mkRoom('A-01', 'Booth A-01', 'Lantai 1', 'Zona A', 60, 60, 160, 120, 4500000),
    mkRoom('A-02', 'Booth A-02', 'Lantai 1', 'Zona A', 250, 60, 160, 120, 4500000, 'terisi'),
    mkRoom('A-03', 'Booth A-03', 'Lantai 1', 'Zona A', 440, 60, 160, 120, 4200000),
    mkRoom('B-01', 'Kios B-01', 'Lantai 1', 'Zona B', 660, 60, 200, 120, 6000000, 'proses'),
    mkRoom('B-02', 'Kios B-02', 'Lantai 1', 'Zona B', 890, 60, 200, 120, 6000000),
    mkRoom('C-01', 'Booth C-01', 'Lantai 2', 'Zona C', 60, 60, 180, 130, 3500000),
    mkRoom('C-02', 'Booth C-02', 'Lantai 2', 'Zona C', 270, 60, 180, 130, 3500000, 'terisi'),
    mkRoom('C-03', 'Booth C-03', 'Lantai 2', 'Zona C', 480, 60, 180, 130, 3200000),
    mkRoom('D-01', 'Kios D-01', 'Lantai 2', 'Zona D', 720, 60, 220, 130, 5500000),
    mkRoom('D-02', 'Kios D-02', 'Lantai 2', 'Zona D', 970, 60, 220, 130, 5500000),
  ];
  rooms.forEach((r) => (d.rooms[r.room_id] = r));
// ---- Tenant & lease aktif untuk ruangan terisi ----
  const tenant1: Tenant = {
    tenant_id: nextId('TEN', 'tenant'),
    brand_name: 'Kopi Nusantara',
    pic_name: 'Budi Santoso',
    contact_phone: '0812-3456-7890',
    contact_email: 'budi@kopinusantara.id',
    company_docs: [],
    created_at: tNow,
  };
  const tenant2: Tenant = {
    tenant_id: nextId('TEN', 'tenant'),
    brand_name: 'FashionHub',
    pic_name: 'Sari Dewi',
    contact_phone: '0813-2222-3333',
    contact_email: 'sari@fashionhub.id',
    company_docs: [],
    created_at: tNow,
  };
  d.tenants[tenant1.tenant_id] = tenant1;
  d.tenants[tenant2.tenant_id] = tenant2;

  const roomA02 = rooms[1]; // terisi
  const roomC02 = rooms[6]; // terisi
  const lease1: Lease = {
    lease_id: nextId('LSE', 'lease'),
    room_id: roomA02.room_id,
    tenant_id: tenant1.tenant_id,
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    status: 'aktif',
    created_at: tNow,
  };
  const lease2: Lease = {
    lease_id: nextId('LSE', 'lease'),
    room_id: roomC02.room_id,
    tenant_id: tenant2.tenant_id,
    start_date: '2024-03-01',
    end_date: '2025-02-28',
    status: 'aktif',
    created_at: tNow,
  };
  // histori: sebelumnya room A-02 disewa oleh tenant2
  const lease3: Lease = {
    lease_id: nextId('LSE', 'lease'),
    room_id: roomA02.room_id,
    tenant_id: tenant2.tenant_id,
    start_date: '2023-01-01',
    end_date: '2023-12-31',
    status: 'selesai',
    created_at: tNow,
  };
  d.leases[lease1.lease_id] = lease1;
  d.leases[lease2.lease_id] = lease2;
  d.leases[lease3.lease_id] = lease3;

  roomA02.current_tenant_id = tenant1.tenant_id;
  roomA02.current_lease_start = '2024-01-01';
  roomA02.current_lease_end = '2024-12-31';
  roomC02.current_tenant_id = tenant2.tenant_id;
  roomC02.current_lease_start = '2024-03-01';
  roomC02.current_lease_end = '2025-02-28';

  // ---- Contoh pengajuan pending ----
  const req1: RentalRequest = {
    request_id: nextId('REQ', 'request'),
    ticket_no: nextTicket(),
    room_id: rooms[3].room_id, // B-01 (status proses)
    brand_name: 'Warung Teknologi',
    pic_name: 'Andi Wijaya',
    contact_phone: '0811-111-2222',
    contact_email: 'andi@warungtek.id',
    duration_months: 6,
    start_date: '2024-09-01',
    budget: 'Rp 5-6 juta/bulan',
    notes: 'Berminat untuk kios gadget dan aksesoris.',
    attachments: [],
    status: 'pending',
    reject_reason: null,
    created_at: tNow,
    reviewed_by: null,
    reviewed_at: null,
  };
  const req2: RentalRequest = {
    request_id: nextId('REQ', 'request'),
    ticket_no: nextTicket(),
    room_id: rooms[2].room_id, // A-03 (kosong)
    brand_name: 'Snack Corner',
    pic_name: 'Melati',
    contact_phone: '0855-222-1111',
    contact_email: 'melati@snackcorner.id',
    duration_months: 3,
    start_date: '2024-08-15',
    budget: 'hubungi admin',
    notes: 'Butuh spot dekat pintu masuk.',
    attachments: [],
    status: 'pending',
    reject_reason: null,
    created_at: tNow,
    reviewed_by: null,
    reviewed_at: null,
  };
  d.requests[req1.request_id] = req1;
  d.requests[req2.request_id] = req2;

  persist();
  console.log('[seed] Data demo dibuat:', {
    rooms: rooms.length,
    tenants: 2,
    leases: 3,
    requests: 2,
    floors: 2,
  });
}

// auto-run saat dijalankan sebagai skrip: `npm run seed`
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seed();
}
