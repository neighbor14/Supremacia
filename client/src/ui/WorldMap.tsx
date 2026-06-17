import { useRef, useState, useCallback, useEffect } from 'react';
import { useGameStore } from '../game/store';
import { SUPERPOWERS } from '../data/initialPlayers';
import { Plus, Minus, Maximize2 } from 'lucide-react';

/**
 * WorldMap uses CSS transform (scale + translate) for zoom/pan.
 * Fixed: pan direction matches finger/mouse direction exactly.
 * The SVG fills the container completely using "xMidYMid slice" to avoid blank areas.
 */

const MIN_SCALE = 0.8;
const MAX_SCALE = 6;
const PAN_THRESHOLD = 6; // pixels before considering it a drag

export default function WorldMap() {
  const { game, selectedTerritory, selectedSeaZone, selectTerritory, selectSeaZone } = useGameStore();
  const containerRef = useRef<HTMLDivElement>(null);

  // Transform state
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  // Interaction refs (avoid stale closures)
  const interactionRef = useRef({
    isPanning: false,
    isPinching: false,
    hasMoved: false,
    startX: 0,
    startY: 0,
    startTx: 0,
    startTy: 0,
    pinchDist0: 0,
    pinchScale0: 1,
    pinchMidX: 0,
    pinchMidY: 0,
  });

  if (!game) return null;

  // --- Zoom helpers ---
  const zoomIn = () => setScale(s => Math.min(MAX_SCALE, s * 1.4));
  const zoomOut = () => setScale(s => Math.max(MIN_SCALE, s / 1.4));
  const resetZoom = () => { setScale(1); setTx(0); setTy(0); };

  // --- Touch distance ---
  const dist2 = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // --- Touch handlers ---
  const onTouchStart = (e: React.TouchEvent) => {
    const ir = interactionRef.current;
    if (e.touches.length === 2) {
      e.preventDefault();
      ir.isPinching = true;
      ir.isPanning = false;
      ir.pinchDist0 = dist2(e.touches[0], e.touches[1]);
      ir.pinchScale0 = scale;
      ir.pinchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      ir.pinchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      ir.startTx = tx;
      ir.startTy = ty;
    } else if (e.touches.length === 1 && !ir.isPinching) {
      ir.isPanning = true;
      ir.hasMoved = false;
      ir.startX = e.touches[0].clientX;
      ir.startY = e.touches[0].clientY;
      ir.startTx = tx;
      ir.startTy = ty;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const ir = interactionRef.current;
    if (ir.isPinching && e.touches.length >= 2) {
      e.preventDefault();
      const newDist = dist2(e.touches[0], e.touches[1]);
      const ratio = newDist / (ir.pinchDist0 || 1);
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, ir.pinchScale0 * ratio));
      setScale(newScale);
      // Also pan to follow pinch center
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      setTx(ir.startTx + (midX - ir.pinchMidX));
      setTy(ir.startTy + (midY - ir.pinchMidY));
    } else if (ir.isPanning && e.touches.length === 1 && !ir.isPinching) {
      const dx = e.touches[0].clientX - ir.startX;
      const dy = e.touches[0].clientY - ir.startY;
      if (Math.abs(dx) + Math.abs(dy) > PAN_THRESHOLD) {
        ir.hasMoved = true;
      }
      setTx(ir.startTx + dx);
      setTy(ir.startTy + dy);
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const ir = interactionRef.current;
    if (e.touches.length < 2) ir.isPinching = false;
    if (e.touches.length === 0) ir.isPanning = false;
  };

  // --- Mouse/pointer pan ---
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    if (e.button !== 0) return;
    const ir = interactionRef.current;
    ir.isPanning = true;
    ir.hasMoved = false;
    ir.startX = e.clientX;
    ir.startY = e.clientY;
    ir.startTx = tx;
    ir.startTy = ty;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const ir = interactionRef.current;
    if (!ir.isPanning) return;
    const dx = e.clientX - ir.startX;
    const dy = e.clientY - ir.startY;
    if (Math.abs(dx) + Math.abs(dy) > PAN_THRESHOLD) ir.hasMoved = true;
    setTx(ir.startTx + dx);
    setTy(ir.startTy + dy);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    interactionRef.current.isPanning = false;
  };

  // --- Wheel zoom ---
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.88 : 1.14;
    setScale(s => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s * factor)));
  };

  // --- Click handlers (only if no pan) ---
  const handleTerritoryClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!interactionRef.current.hasMoved) {
      selectTerritory(id === selectedTerritory ? null : id);
    }
  };

  const handleSeaClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!interactionRef.current.hasMoved) {
      selectSeaZone(id === selectedSeaZone ? null : id);
    }
  };

  // --- Rendering helpers ---
  const getTerritoryColor = (territoryId: string): string => {
    const territory = game.territories[territoryId];
    if (!territory) return '#334155';
    if (territory.nuked) return '#1e1b4b';
    if (territory.owner) return SUPERPOWERS[territory.owner].color;
    return '#475569';
  };

  const getSeaColor = (seaId: string): string => {
    const sea = game.seaZones[seaId];
    if (!sea) return '#1e3a5f';
    return sea.type === 'coastal' ? '#1e3a5f' : '#0f2942';
  };

  const getArmyCount = (territoryId: string): number => {
    let total = 0;
    for (const player of Object.values(game.players)) {
      total += player.armies[territoryId] || 0;
    }
    return total;
  };

  const getNavyCount = (seaId: string): number => {
    let total = 0;
    for (const player of Object.values(game.players)) {
      total += player.navies[seaId] || 0;
    }
    return total;
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full select-none relative bg-slate-950 overflow-hidden"
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
    >
      {/* SVG Map - shows entire map without cutting off edges */}
      <svg
        viewBox="0 0 1000 500"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        style={{
          cursor: interactionRef.current.isPanning ? 'grabbing' : 'grab',
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transformOrigin: 'center center',
          willChange: 'transform',
          transition: interactionRef.current.isPanning || interactionRef.current.isPinching ? 'none' : 'transform 0.1s ease-out',
        }}
      >
        {/* Background ocean */}
        <rect x="0" y="0" width="1000" height="500" fill="#0a1628" />

        {/* Sea zones */}
        {Object.entries(game.seaZones).map(([seaId, sea]) => (
          <path
            key={seaId}
            d={sea.svgPath}
            fill={getSeaColor(seaId)}
            stroke={selectedSeaZone === seaId ? '#fbbf24' : '#1e40af'}
            strokeWidth={selectedSeaZone === seaId ? 2.5 : 0.5}
            opacity={0.7}
            onClick={(e) => handleSeaClick(seaId, e as any)}
            style={{ cursor: 'pointer' }}
          />
        ))}

        {/* Territories */}
        {Object.entries(game.territories).map(([territoryId, territory]) => (
          <g key={territoryId}>
            <path
              d={territory.svgPath}
              fill={getTerritoryColor(territoryId)}
              stroke={selectedTerritory === territoryId ? '#fbbf24' : '#64748b'}
              strokeWidth={selectedTerritory === territoryId ? 2 : 0.5}
              onClick={(e) => handleTerritoryClick(territoryId, e as any)}
              style={{ cursor: 'pointer' }}
            />
            {/* Army count */}
            {getArmyCount(territoryId) > 0 && (
              <text
                x={territory.labelPos.x}
                y={territory.labelPos.y}
                fill="#fef3c7"
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="central"
                pointerEvents="none"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
              >
                {getArmyCount(territoryId)}
              </text>
            )}
          </g>
        ))}

        {/* Navy count labels */}
        {Object.entries(game.seaZones).map(([seaId, sea]) => {
          const count = getNavyCount(seaId);
          if (count === 0) return null;
          return (
            <text
              key={`navy-${seaId}`}
              x={sea.labelPos.x}
              y={sea.labelPos.y}
              fill="#93c5fd"
              fontSize="10"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
              pointerEvents="none"
            >
              ⚓{count}
            </text>
          );
        })}
      </svg>

      {/* Zoom Controls - Bottom Right */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-30">
        <button
          onClick={zoomIn}
          className="w-10 h-10 rounded-lg bg-slate-800/90 backdrop-blur-sm hover:bg-slate-700 text-white flex items-center justify-center active:scale-[0.9] transition-all shadow-lg border border-slate-600/50"
        >
          <Plus size={18} />
        </button>
        <button
          onClick={zoomOut}
          className="w-10 h-10 rounded-lg bg-slate-800/90 backdrop-blur-sm hover:bg-slate-700 text-white flex items-center justify-center active:scale-[0.9] transition-all shadow-lg border border-slate-600/50"
        >
          <Minus size={18} />
        </button>
        <button
          onClick={resetZoom}
          className="w-10 h-10 rounded-lg bg-slate-800/90 backdrop-blur-sm hover:bg-slate-700 text-white flex items-center justify-center active:scale-[0.9] transition-all shadow-lg border border-slate-600/50"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* Zoom Level */}
      <div className="absolute bottom-4 left-4 px-2.5 py-1 rounded-md bg-slate-800/80 backdrop-blur-sm text-[11px] font-mono text-slate-300 z-30 border border-slate-600/30">
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
}
