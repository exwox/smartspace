import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Line, Rect, Text, Group, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import type { Room, FloorPlan, RoomStatus } from '../types.ts';
import { STATUS_LABEL, displayStatus } from '../types.ts';

interface MapCanvasProps {
  rooms: Room[];
  floors: FloorPlan[];
  selectedRoomId: string | null;
  onSelect: (room: Room | null) => void;
  interactive?: boolean;
  editor?: boolean;
  onRoomsChange?: (rooms: Room[]) => void;
  highlight?: string | null;
  activeFloorName?: string | null;
}

const STATUS_FILL: Record<RoomStatus, string> = {
  kosong: '#dcfce7',
  terisi: '#fee2e2',
  proses: '#fef3c7',
};

function roomBounds(points: number[]) {
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
  if (!Number.isFinite(minX)) return { x: 0, y: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, minX, minY, maxX, maxY };
}

function useHtmlImage(src?: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = src;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);
  return image;
}

export default function MapCanvas({
  rooms,
  floors,
  selectedRoomId,
  onSelect,
  interactive = true,
  editor = false,
  onRoomsChange,
  highlight = null,
  activeFloorName = null,
}: MapCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const mapRootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 400 });
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const floorCandidates = useMemo(() => {
    if (activeFloorName) return floors.filter((f) => f.floor === activeFloorName);
    if (rooms.length > 0) {
      const roomFloor = rooms[0].floor;
      const matched = floors.filter((f) => f.floor === roomFloor);
      if (matched.length) return matched;
    }
    return floors;
  }, [activeFloorName, floors, rooms]);

  // Pakai versi denah terbaru untuk lantai aktif.
  const activeFloor = useMemo(
    () => [...floorCandidates].sort((a, b) => b.version - a.version)[0] ?? null,
    [floorCandidates],
  );
  const backgroundImage = useHtmlImage(activeFloor?.background_url ?? null);

  const visibleRooms = useMemo(() => {
    if (!activeFloorName) return rooms;
    return rooms.filter((room) => room.floor === activeFloorName);
  }, [rooms, activeFloorName]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoom = useCallback((factor: number) => {
    const st = stageRef.current;
    if (!st) return;
    const oldScale = st.scaleX();
    const pointer = st.getPointerPosition();
    const newScale = Math.min(3, Math.max(0.3, oldScale * factor));
    if (!pointer) {
      setScale(newScale);
      return;
    }
    const mousePointTo = {
      x: (pointer.x - st.x()) / oldScale,
      y: (pointer.y - st.y()) / oldScale,
    };
    setPos({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
    setScale(newScale);
  }, []);

  const fitToContent = useCallback(() => {
    const pts: number[] = [];
    visibleRooms.forEach((r) => pts.push(...r.geometry.points));
    activeFloor?.linework?.forEach((path) => pts.push(...path.points));
    activeFloor?.texts?.forEach((label) => pts.push(label.x, label.y));
    if (activeFloor) pts.push(0, 0, activeFloor.width, 0, activeFloor.width, activeFloor.height, 0, activeFloor.height);
    if (pts.length < 2 || size.w === 0 || size.h === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      minX = Math.min(minX, pts[i]);
      maxX = Math.max(maxX, pts[i]);
      minY = Math.min(minY, pts[i + 1]);
      maxY = Math.max(maxY, pts[i + 1]);
    }
    const bw = maxX - minX || 1;
    const bh = maxY - minY || 1;
    // Isi viewport semaksimal mungkin dengan margin kecil.
    // Tidak lagi dibatasi max 1.5x agar denah berukuran kecil ikut membesar.
    const padding = Math.max(12, Math.min(28, Math.min(size.w, size.h) * 0.03));
    const availableW = Math.max(1, size.w - padding * 2);
    const availableH = Math.max(1, size.h - padding * 2);
    const s = Math.min(availableW / bw, availableH / bh);
    const fittedScale = Math.min(10, Math.max(0.05, s));
    setScale(fittedScale);
    setPos({
      x: size.w / 2 - ((minX + maxX) / 2) * fittedScale,
      y: size.h / 2 - ((minY + maxY) / 2) * fittedScale,
    });
  }, [activeFloor, size.h, size.w, visibleRooms]);

  useEffect(() => {
    const t = setTimeout(fitToContent, 50);
    return () => clearTimeout(t);
  }, [activeFloorName, activeFloor?.floor_id, size.w, size.h, fitToContent]);


  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === mapRootRef.current);
      // ResizeObserver akan memperbarui canvas; fit ulang sesudah layout fullscreen selesai.
      window.setTimeout(fitToContent, 80);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [fitToContent]);

  const toggleFullscreen = useCallback(async () => {
    const root = mapRootRef.current;
    if (!root) return;
    if (document.fullscreenElement === root) {
      await document.exitFullscreen();
    } else {
      await root.requestFullscreen();
    }
  }, []);

  const dragRef = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handlePanMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!interactive || editor) return;
    const st = stageRef.current;
    if (!st) return;
    const p = st.getPointerPosition();
    if (!p) return;
    if (!dragRef.current) {
      dragRef.current = true;
      dragStart.current = { x: p.x - st.x(), y: p.y - st.y() };
    }
    setPos({ x: p.x - dragStart.current.x, y: p.y - dragStart.current.y });
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    if (!interactive) return;
    e.evt.preventDefault();
    const st = stageRef.current;
    if (!st) return;
    const oldScale = st.scaleX();
    const pointer = st.getPointerPosition();
    if (!pointer) return;
    const newScale = Math.min(3, Math.max(0.3, oldScale * (e.evt.deltaY > 0 ? 0.9 : 1.1)));
    const mousePointTo = { x: (pointer.x - st.x()) / oldScale, y: (pointer.y - st.y()) / oldScale };
    setPos({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
    setScale(newScale);
  };

  const handleRoomDragged = (room: Room, e: Konva.KonvaEventObject<DragEvent>) => {
    if (!onRoomsChange) return;
    const node = e.target as Konva.Group;
    const dx = node.x() ?? 0;
    const dy = node.y() ?? 0;
    const pts = [...room.geometry.points];
    for (let i = 0; i < pts.length; i += 2) {
      pts[i] += dx;
      pts[i + 1] += dy;
    }
    const next = rooms.map((r) =>
      r.room_id === room.room_id ? { ...r, geometry: { ...r.geometry, points: pts } } : r,
    );
    onRoomsChange(next);
    node.position({ x: 0, y: 0 });
    node.getLayer()?.batchDraw();
  };

  const renderRoomShape = (room: Room) => {
    const b = roomBounds(room.geometry.points);
    const roomWidth = Math.max(0, b.maxX - b.minX);
    const roomHeight = Math.max(0, b.maxY - b.minY);
    const selected = selectedRoomId === room.room_id;
    const hl = highlight === room.room_id;
    const effectiveStatus = displayStatus(room);
    const fill = STATUS_FILL[effectiveStatus] ?? '#dcfce7';
    const isRect = room.geometry.type === 'rectangle';
    const statusText = STATUS_LABEL[effectiveStatus];
    // Ukuran teks mengikuti ruang yang tersedia, bukan angka font tetap.
    // Batas maksimum menjaga label tetap kecil pada denah berukuran besar.
    const codeFontSize = Math.max(1.5, Math.min(
      9,
      roomHeight * 0.18,
      roomWidth / Math.max(4, room.room_code.length * 0.72),
    ));
    const statusFontSize = Math.max(1.2, Math.min(
      6.5,
      roomHeight * 0.12,
      roomWidth / Math.max(5, statusText.length * 0.65),
    ));
    const labelGap = Math.max(0.5, Math.min(2, roomHeight * 0.025));
    const labelHeight = codeFontSize + statusFontSize + labelGap;
    const labelTop = b.y - labelHeight / 2;
    return (
      <Group
        key={room.room_id}
        draggable={editor && !!onRoomsChange}
        onDragEnd={(e) => handleRoomDragged(room, e)}
        onClick={(e) => {
          if (!editor && interactive) {
            e.cancelBubble = true;
            onSelect(selected ? null : room);
          }
        }}
        onTap={(e) => {
          if (!editor && interactive) {
            e.cancelBubble = true;
            onSelect(selected ? null : room);
          }
        }}
      >
        {isRect ? (
          <Rect x={b.minX} y={b.minY} width={b.maxX - b.minX} height={b.maxY - b.minY} fill={fill}
            stroke={hl || selected ? '#2563eb' : '#475569'} strokeWidth={selected || hl ? 3 : 1.5}
            shadowColor={hl ? '#2563eb' : undefined} shadowBlur={hl ? 12 : 0} cornerRadius={2} opacity={0.82} />
        ) : (
          <Line points={room.geometry.points} closed fill={fill} stroke={hl || selected ? '#2563eb' : '#475569'}
            strokeWidth={selected || hl ? 3 : 1.5} shadowColor={hl ? '#2563eb' : undefined} shadowBlur={hl ? 12 : 0}
            lineJoin="round" opacity={0.82} />
        )}
        <Group listening={false}>
          <Text x={b.minX} y={labelTop} width={roomWidth} height={codeFontSize}
            text={room.room_code} fontSize={codeFontSize} fontStyle="bold" fill="#1e293b"
            align="center" verticalAlign="middle" ellipsis wrap="none" />
          <Text x={b.minX} y={labelTop + codeFontSize + labelGap} width={roomWidth} height={statusFontSize}
            text={statusText} fontSize={statusFontSize} fill="#334155"
            align="center" verticalAlign="middle" ellipsis wrap="none" />
        </Group>
      </Group>
    );
  };

  return (
    <div ref={mapRootRef} className="relative h-full w-full overflow-hidden bg-slate-100 fullscreen:bg-slate-100">
      <div ref={containerRef} className="map-container h-full w-full">
        <Stage ref={stageRef} width={size.w} height={size.h} scaleX={scale} scaleY={scale} x={pos.x} y={pos.y}
          onMouseDown={handlePanMove} onMouseMove={(e) => dragRef.current && handlePanMove(e)}
          onMouseUp={() => (dragRef.current = false)} onMouseLeave={() => (dragRef.current = false)}
          onTouchStart={handlePanMove} onTouchMove={(e) => dragRef.current && handlePanMove(e)}
          onTouchEnd={() => (dragRef.current = false)} onWheel={handleWheel}>
          <Layer>
            {activeFloor && (
              <Group listening={false}>
                <Rect x={0} y={0} width={activeFloor.width} height={activeFloor.height} fill="#f8fafc" stroke="#94a3b8" strokeWidth={2} cornerRadius={6} />
                {backgroundImage && (
                  <KonvaImage image={backgroundImage} x={0} y={0} width={activeFloor.width} height={activeFloor.height} opacity={0.72} />
                )}
                {activeFloor.linework?.map((path, index) => (
                  <Line
                    key={`${path.entity}-${index}`}
                    points={path.points}
                    closed={path.closed}
                    stroke="#64748b"
                    strokeWidth={1.25}
                    lineCap="round"
                    lineJoin="round"
                    perfectDrawEnabled={false}
                  />
                ))}
                <Text x={14} y={12} text={activeFloor.floor} fontSize={16} fontStyle="bold" fill="#64748b" />
              </Group>
            )}
            {visibleRooms.map(renderRoomShape)}
            {activeFloor?.texts?.map((label, index) => (
              <Text
                key={`${label.entity}-${index}-${label.text}`}
                x={label.x}
                y={label.y - label.height}
                text={label.text}
                fontSize={Math.max(1, label.height)}
                width={label.width}
                rotation={label.rotation}
                fill="#0f172a"
                shadowColor="#f8fafc"
                shadowBlur={2}
                shadowOpacity={0.9}
                listening={false}
              />
            ))}
          </Layer>
        </Stage>
      </div>

      {interactive && (
        <div className="absolute right-3 top-3 flex flex-col gap-1 rounded-lg bg-white/90 p-1 shadow-md">
          <button onClick={() => zoom(1.25)} className="h-8 w-8 rounded text-lg text-slate-700 hover:bg-slate-100">+</button>
          <button onClick={() => zoom(0.8)} className="h-8 w-8 rounded text-lg text-slate-700 hover:bg-slate-100">−</button>
          <button onClick={fitToContent} title="Paskan denah ke layar" className="h-8 w-8 rounded text-xs font-bold text-slate-700 hover:bg-slate-100">⌗</button>
          <button onClick={toggleFullscreen} title={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'} className="h-8 w-8 rounded text-sm font-bold text-slate-700 hover:bg-slate-100">{isFullscreen ? '↙' : '⛶'}</button>
        </div>
      )}

      <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] shadow-sm">
        {(['kosong', 'proses', 'terisi'] as RoomStatus[]).map((status) => (
          <span key={status} className="flex items-center gap-1 text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm border border-slate-300" style={{ backgroundColor: STATUS_FILL[status] }} />
            {STATUS_LABEL[status]}
          </span>
        ))}
      </div>
    </div>
  );
}
