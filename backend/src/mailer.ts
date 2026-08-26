import nodemailer from 'nodemailer';
import type { RentalRequest, Room } from './types.js';

export interface MailInput {
  to: string[];
  subject: string;
  text: string;
  html: string;
}

export interface MailResult {
  sent: boolean;
  error?: string;
}

/** SMTP dianggap siap bila SMTP_HOST & SMTP_PORT tersedia di environment. */
export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT);
}

export function smtpSummary(): { configured: boolean; host?: string; port?: string; secure: boolean } {
  const port = process.env.SMTP_PORT;
  return {
    configured: smtpConfigured(),
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === '465',
  };
}

function transporter() {
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
}

/** Pecah string penerima "a@b.com, c@d.com" menjadi daftar email valid. */
export function parseRecipients(raw: string): string[] {
  return Array.from(
    new Set(
      String(raw ?? '')
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)),
    ),
  );
}

/**
 * Kirim email via SMTP. Bila SMTP belum dikonfigurasi, isi email dicatat ke log
 * server sehingga fitur tetap berjalan (degrade) tanpa pengiriman nyata.
 * Tidak pernah melempar exception — selalu mengembalikan status.
 */
export async function sendMail(input: MailInput): Promise<MailResult> {
  if (!smtpConfigured()) {
    console.log(
      `[smart-space][mail] SMTP belum dikonfigurasi — email tidak terkirim.\n` +
        `  To: ${input.to.join(', ')}\n  Subject: ${input.subject}\n` +
        `  (set env SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS untuk mengaktifkan)`,
    );
    return { sent: false, error: 'SMTP belum dikonfigurasi (SMTP_HOST / SMTP_PORT)' };
  }
  try {
    const info = await transporter().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER || 'Smart Space <no-reply@smartspace.local>',
      to: input.to.join(', '),
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    console.log(`[smart-space][mail] Terkirim (${info.messageId}) ke ${input.to.join(', ')}`);
    return { sent: true };
  } catch (e: any) {
    const message = e?.message ?? 'Gagal mengirim email';
    console.error(`[smart-space][mail] Gagal mengirim email: ${message}`);
    return { sent: false, error: message };
  }
}

// ------------------------------------------------------------------
// Template email tiket (didefinisikan setelah blok ini)
// ------------------------------------------------------------------

const BRAND = 'Smart Space — Raja Haji Fisabilillah Airport [TNJ]';

const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function row(label: string, value: string): string {
  return `<tr><td style="padding:4px 12px 4px 0;color:#64748b;white-space:nowrap">${label}</td><td style="padding:4px 0;color:#0f172a"><strong>${value || '-'}</strong></td></tr>`;
}

function wrap(titleHtml: string, bodyRows: string, footerHtml: string): string {
  return `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
<div style="border-bottom:2px solid #0ea5e9;padding-bottom:10px;margin-bottom:14px;font-size:18px;font-weight:700;color:#0f172a">🧭 ${BRAND}</div>
<p style="margin:0 0 12px;color:#334155">${titleHtml}</p>
<table style="border-collapse:collapse;font-size:14px;margin-bottom:16px">${bodyRows}</table>
<p style="margin:0;color:#94a3b8;font-size:12px">${footerHtml}</p>
</div>`;
}

/** Email notifikasi tiket baru (untuk admin). `to` diisi pemanggil. */
export function newTicketAdminMail(request: RentalRequest, room: Room | null): MailInput {
  const rows =
    row('No. Tiket', esc(request.ticket_no)) +
    row('Ruangan', esc(room ? `${room.room_code} — ${room.name}` : request.room_id)) +
    row('Lantai', esc(room?.floor ?? '')) +
    row('Brand', esc(request.brand_name)) +
    row('PIC', esc(request.pic_name)) +
    row('Telepon', esc(request.contact_phone)) +
    row('Email', esc(request.contact_email)) +
    row('Durasi', `${esc(String(request.duration_months))} bulan`) +
    row('Mulai', esc(request.start_date)) +
    row('Budget', esc(request.budget)) +
    row('Catatan', esc(request.notes)) +
    row('Lampiran', `${request.attachments.length} file`);
  const title = 'Pengajuan sewa baru masuk melalui peta Smart Space.';
  const footer = 'Buka menu Pengajuan di panel admin Smart Space untuk mereview tiket ini.';
  return {
    to: [],
    subject: `[Smart Space] Tiket baru ${request.ticket_no} dari ${request.brand_name}`,
    text: `${title}\n${request.ticket_no} · ${room?.room_code ?? ''} ${room?.name ?? ''}\nBrand: ${request.brand_name}\nPIC: ${request.pic_name} (${request.contact_phone}, ${request.contact_email})\nDurasi: ${request.duration_months} bulan mulai ${request.start_date}\nBudget: ${request.budget}`,
    html: wrap(title, rows, footer),
  };
}

/** Email konfirmasi / hasil review untuk pengaju. */
export function ticketStatusMail(
  request: RentalRequest,
  room: Room | null,
  status: 'pending' | 'approved' | 'rejected',
): MailInput {
  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';
  const headline = isApproved
    ? 'Selamat! Pengajuan Anda telah <strong>DISETUJUI</strong>.'
    : isRejected
      ? `Mohon maaf, pengajuan Anda <strong>DITOLAK</strong>${request.reject_reason ? ` dengan alasan: ${esc(request.reject_reason)}` : '.'}`
      : 'Konfirmasi penerimaan pengajuan sewa Anda.';
  const rows =
    row('No. Tiket', esc(request.ticket_no)) +
    row('Ruangan', esc(room ? `${room.room_code} — ${room.name}` : request.room_id)) +
    row('Lantai', esc(room?.floor ?? '')) +
    row('Status', isApproved ? 'Disetujui' : isRejected ? 'Ditolak' : 'Diterima & menunggu review') +
    row('Durasi', `${esc(String(request.duration_months))} bulan`) +
    row('Mulai', esc(request.start_date));
  const footer = isApproved
    ? 'Tim kami akan menghubungi Anda untuk proses administrasi selanjutnya.'
    : isRejected
      ? 'Anda tetap dapat mengajukan sewa pada ruangan lain yang masih tersedia.'
      : `Simpan nomor tiket <strong>${esc(request.ticket_no)}</strong> untuk memantau status melalui halaman Cek Tiket.`;
  const plainStatus = isApproved ? 'DISETUJUI' : isRejected ? 'DITOLAK' : 'DITERIMA';
  return {
    to: [request.contact_email],
    subject: `[Smart Space] Tiket ${request.ticket_no} — ${plainStatus}`,
    text: `Tiket ${request.ticket_no}: ${plainStatus}. Ruangan: ${room?.room_code ?? request.room_id}.`,
    html: wrap(headline, rows, footer),
  };
}
