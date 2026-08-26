// Parser DXF ringan untuk denah 2D.
// Semua entitas garis yang didukung dikembalikan sebagai linework untuk digambar.
// Hanya LWPOLYLINE/POLYLINE tertutup yang dianggap sebagai kandidat ruangan.

export interface DxfPolygon {
  points: number[];
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number };
}

export type DxfEntityType = 'LINE' | 'LWPOLYLINE' | 'POLYLINE' | 'RECTANGLE' | 'CIRCLE' | 'ARC' | 'ELLIPSE';

export interface DxfPath {
  points: number[];
  closed: boolean;
  entity: DxfEntityType;
}

export interface DxfParseResult {
  rooms: DxfPolygon[];
  linework: DxfPath[];
  texts: DxfText[];
}

export interface DxfText {
  text: string;
  x: number;
  y: number;
  height: number;
  width?: number;
  rotation: number;
  entity: 'TEXT' | 'MTEXT';
}

type Token = { code: number; value: string };
type ParsedPolyline = { points: number[]; closed: boolean };
type Point = [number, number];

const EPSILON = 1e-5;
const MAX_INFERRED_CLOSE_TOLERANCE = 0.05;

export function parseDXF(text: string): DxfParseResult {
  const lines = text.split(/\r?\n/);
  const tokens: Token[] = [];
  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    if (!Number.isNaN(code)) tokens.push({ code, value: lines[i + 1].trim() });
  }

  const rooms: DxfPolygon[] = [];
  const linework: DxfPath[] = [];
  const texts: DxfText[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.code !== 0) continue;

    if (token.value === 'LWPOLYLINE') {
      const parsed = parseLwPolyline(i, tokens);
      if (!parsed) continue;
      linework.push({ ...parsed, entity: 'LWPOLYLINE' });
      if (parsed.closed) {
        const room = toPolygon(parsed.points);
        if (room) rooms.push(room);
      }
    } else if (token.value === 'POLYLINE') {
      const parsed = parsePolylineEntity(i, tokens);
      if (!parsed) continue;
      linework.push({ ...parsed, entity: 'POLYLINE' });
      if (parsed.closed) {
        const room = toPolygon(parsed.points);
        if (room) rooms.push(room);
      }
    } else if (token.value === 'LINE') {
      const points = parseLineEntity(i, tokens);
      if (points) linework.push({ points, closed: false, entity: 'LINE' });
    } else if (token.value === 'RECTANGLE') {
      const points = parseRectangleEntity(i, tokens);
      if (!points) continue;
      linework.push({ points, closed: true, entity: 'RECTANGLE' });
      const room = toPolygon(points);
      if (room) rooms.push(room);
    } else if (token.value === 'CIRCLE') {
      const points = parseCircleEntity(i, tokens);
      if (points) linework.push({ points, closed: true, entity: 'CIRCLE' });
    } else if (token.value === 'ARC') {
      const points = parseArcEntity(i, tokens);
      if (points) linework.push({ points, closed: false, entity: 'ARC' });
    } else if (token.value === 'ELLIPSE') {
      const parsed = parseEllipseEntity(i, tokens);
      if (parsed) linework.push({ ...parsed, entity: 'ELLIPSE' });
    } else if (token.value === 'TEXT' || token.value === 'MTEXT') {
      const parsed = parseTextEntity(i, tokens, token.value);
      if (parsed) texts.push(parsed);
    }
  }

  return { rooms: dedupePolygons(rooms), linework, texts };
}

function entityTokens(idx: number, tokens: Token[]): Token[] {
  const result: Token[] = [];
  for (let i = idx + 1; i < tokens.length && tokens[i].code !== 0; i += 1) result.push(tokens[i]);
  return result;
}

function numberValue(tokens: Token[], code: number): number | null {
  const token = tokens.find((item) => item.code === code);
  if (!token) return null;
  const value = Number(token.value);
  return Number.isFinite(value) ? value : null;
}

function parseLwPolyline(idx: number, tokens: Token[]): ParsedPolyline | null {
  const values = entityTokens(idx, tokens);
  const points: number[] = [];
  let pendingX: number | null = null;
  for (const token of values) {
    if (token.code === 10) pendingX = Number(token.value);
    if (token.code === 20 && pendingX !== null) {
      const y = Number(token.value);
      if (Number.isFinite(pendingX) && Number.isFinite(y)) points.push(pendingX, y);
      pendingX = null;
    }
  }
  if (points.length < 4) return null;
  // Sesuai aturan import aplikasi, seluruh LWPOLYLINE diperlakukan tertutup.
  // Dengan demikian group code 70 = 0 dibaca seperti 70 = 1 tanpa mengubah
  // file DXF asli. Validasi polygon/luas tetap dilakukan oleh toPolygon().
  return { points, closed: true };
}

function parseLineEntity(idx: number, tokens: Token[]): number[] | null {
  const values = entityTokens(idx, tokens);
  const x1 = numberValue(values, 10);
  const y1 = numberValue(values, 20);
  const x2 = numberValue(values, 11);
  const y2 = numberValue(values, 21);
  if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
  return [x1, y1, x2, y2];
}

function parseRectangleEntity(idx: number, tokens: Token[]): number[] | null {
  const values = entityTokens(idx, tokens);
  const points: number[] = [];
  let pendingX: number | null = null;
  for (const token of values) {
    if (token.code === 10 || token.code === 11) pendingX = Number(token.value);
    if ((token.code === 20 || token.code === 21) && pendingX !== null) {
      const y = Number(token.value);
      if (Number.isFinite(pendingX) && Number.isFinite(y)) points.push(pendingX, y);
      pendingX = null;
    }
  }
  if (points.length >= 8) return points.slice(0, 8);
  if (points.length !== 4) return null;
  const [x1, y1, x2, y2] = points;
  if (Math.abs(x1 - x2) <= EPSILON || Math.abs(y1 - y2) <= EPSILON) return null;
  return [x1, y1, x2, y1, x2, y2, x1, y2];
}

function parseTextEntity(idx: number, tokens: Token[], entity: 'TEXT' | 'MTEXT'): DxfText | null {
  const values = entityTokens(idx, tokens);
  const x = numberValue(values, 10);
  const y = numberValue(values, 20);
  if (x === null || y === null) return null;
  const rawText = entity === 'MTEXT'
    ? values.filter((token) => token.code === 3 || token.code === 1).map((token) => token.value).join('')
    : values.find((token) => token.code === 1)?.value ?? '';
  const text = cleanDxfText(rawText);
  if (!text) return null;

  let rotation = numberValue(values, 50) ?? 0;
  if (entity === 'MTEXT' && !values.some((token) => token.code === 50)) {
    const directionX = numberValue(values, 11);
    const directionY = numberValue(values, 21);
    if (directionX !== null && directionY !== null) rotation = Math.atan2(directionY, directionX) * 180 / Math.PI;
  }
  return {
    text,
    x,
    y,
    height: Math.max(numberValue(values, 40) ?? 12, EPSILON),
    width: numberValue(values, 41) ?? undefined,
    rotation,
    entity,
  };
}

function cleanDxfText(value: string): string {
  return value
    .replace(/\\U\+([0-9a-fA-F]{4})/g, (_match, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/%%d/gi, '°')
    .replace(/%%p/gi, '±')
    .replace(/%%c/gi, 'Ø')
    .replace(/\\P/g, '\n')
    .replace(/\\~/g, ' ')
    .replace(/\\S([^;]*);/g, '$1')
    .replace(/\\[A-Za-z][^;]*;/g, '')
    .replace(/[{}]/g, '')
    .trim();
}

function parsePolylineEntity(idx: number, tokens: Token[]): ParsedPolyline | null {
  const header = entityTokens(idx, tokens);
  const flags = numberValue(header, 70) ?? 0;
  const points: number[] = [];

  for (let i = idx + 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.code === 0 && token.value === 'SEQEND') break;
    if (token.code !== 0 || token.value !== 'VERTEX') continue;
    const vertex = entityTokens(i, tokens);
    const x = numberValue(vertex, 10);
    const y = numberValue(vertex, 20);
    if (x !== null && y !== null) points.push(x, y);
  }

  if (points.length < 4) return null;
  return resolvePolylineClosure(points, flags);
}

// Sebagian eksportir CAD menulis polyline yang secara geometris sudah tertutup
// tetapi tetap memberi group code 70 = 0. Terima kondisi tersebut hanya bila
// titik terakhir benar-benar berimpit/dekat dengan titik pertama. Ini tidak
// pernah menggabungkan beberapa entitas LINE menjadi sebuah ruangan.
function resolvePolylineClosure(points: number[], flags: number): ParsedPolyline {
  if ((flags & 1) === 1 || points.length < 6) return { points, closed: (flags & 1) === 1 };

  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    xs.push(points[i]);
    ys.push(points[i + 1]);
  }
  const diagonal = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const tolerance = Math.min(MAX_INFERRED_CLOSE_TOLERANCE, Math.max(EPSILON, diagonal * 1e-6));
  const last = points.length - 2;
  const geometricallyClosed = Math.hypot(points[last] - points[0], points[last + 1] - points[1]) <= tolerance;
  if (!geometricallyClosed) return { points, closed: false };

  const normalized = [...points];
  normalized[last] = normalized[0];
  normalized[last + 1] = normalized[1];
  return { points: normalized, closed: true };
}

function parseCircleEntity(idx: number, tokens: Token[]): number[] | null {
  const values = entityTokens(idx, tokens);
  const cx = numberValue(values, 10);
  const cy = numberValue(values, 20);
  const radius = numberValue(values, 40);
  if (cx === null || cy === null || radius === null || radius <= 0) return null;
  return sampleEllipse(cx, cy, radius, 0, 1, 0, Math.PI * 2, 64);
}

function parseArcEntity(idx: number, tokens: Token[]): number[] | null {
  const values = entityTokens(idx, tokens);
  const cx = numberValue(values, 10);
  const cy = numberValue(values, 20);
  const radius = numberValue(values, 40);
  const startDegrees = numberValue(values, 50);
  const endDegrees = numberValue(values, 51);
  if (cx === null || cy === null || radius === null || radius <= 0 || startDegrees === null || endDegrees === null) return null;
  const start = startDegrees * Math.PI / 180;
  let end = endDegrees * Math.PI / 180;
  while (end <= start) end += Math.PI * 2;
  const segments = Math.max(8, Math.ceil((end - start) / (Math.PI / 24)));
  return sampleEllipse(cx, cy, radius, 0, 1, start, end, segments);
}

function parseEllipseEntity(idx: number, tokens: Token[]): ParsedPolyline | null {
  const values = entityTokens(idx, tokens);
  const cx = numberValue(values, 10);
  const cy = numberValue(values, 20);
  const majorX = numberValue(values, 11);
  const majorY = numberValue(values, 21);
  const ratio = numberValue(values, 40);
  if (cx === null || cy === null || majorX === null || majorY === null || ratio === null || ratio <= 0) return null;

  const start = numberValue(values, 41) ?? 0;
  let end = numberValue(values, 42) ?? Math.PI * 2;
  while (end <= start) end += Math.PI * 2;
  const closed = Math.abs((end - start) - Math.PI * 2) <= EPSILON;
  const segments = Math.max(16, Math.ceil((end - start) / (Math.PI / 32)));
  const points: number[] = [];
  const minorX = -majorY * ratio;
  const minorY = majorX * ratio;
  for (let i = 0; i <= segments; i += 1) {
    const angle = start + ((end - start) * i) / segments;
    points.push(
      cx + majorX * Math.cos(angle) + minorX * Math.sin(angle),
      cy + majorY * Math.cos(angle) + minorY * Math.sin(angle),
    );
  }
  return { points, closed };
}

function sampleEllipse(
  cx: number,
  cy: number,
  majorX: number,
  majorY: number,
  ratio: number,
  start: number,
  end: number,
  segments: number,
): number[] {
  const points: number[] = [];
  const minorX = -majorY * ratio;
  const minorY = majorX * ratio;
  for (let i = 0; i <= segments; i += 1) {
    const angle = start + ((end - start) * i) / segments;
    points.push(
      cx + majorX * Math.cos(angle) + minorX * Math.sin(angle),
      cy + majorY * Math.cos(angle) + minorY * Math.sin(angle),
    );
  }
  return points;
}

function pointKey(point: Point): string {
  return `${Math.round(point[0] / EPSILON)},${Math.round(point[1] / EPSILON)}`;
}

function closePoints(points: number[]): number[] {
  if (points.length < 4) return points;
  const firstX = points[0];
  const firstY = points[1];
  const lastX = points[points.length - 2];
  const lastY = points[points.length - 1];
  return Math.abs(firstX - lastX) <= EPSILON && Math.abs(firstY - lastY) <= EPSILON
    ? points
    : [...points, firstX, firstY];
}

function toPolygon(points: number[]): DxfPolygon | null {
  const closed = closePoints(points);
  if (closed.length < 8 || polygonArea(closed) <= EPSILON) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < closed.length; i += 2) {
    minX = Math.min(minX, closed[i]);
    minY = Math.min(minY, closed[i + 1]);
    maxX = Math.max(maxX, closed[i]);
    maxY = Math.max(maxY, closed[i + 1]);
  }
  return { points: closed, boundingBox: { minX, minY, maxX, maxY } };
}

function dedupePolygons(polygons: DxfPolygon[]): DxfPolygon[] {
  const seen = new Set<string>();
  return polygons.filter((polygon) => {
    const vertices: string[] = [];
    for (let i = 0; i < polygon.points.length; i += 2) {
      vertices.push(pointKey([polygon.points[i], polygon.points[i + 1]]));
    }
    const key = [...new Set(vertices)].sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Shoelace; otomatis menutup edge titik terakhir -> titik pertama.
export function polygonArea(points: number[]): number {
  if (points.length < 6) return 0;
  const count = Math.floor(points.length / 2);
  let area = 0;
  for (let i = 0; i < count; i += 1) {
    const next = (i + 1) % count;
    area += points[i * 2] * points[next * 2 + 1] - points[next * 2] * points[i * 2 + 1];
  }
  return Math.abs(area) / 2;
}
