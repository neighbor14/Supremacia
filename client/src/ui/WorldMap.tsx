import { useRef, useState, useCallback } from 'react';
import { useGameStore } from '../game/store';
import { SUPERPOWERS } from '../data/initialPlayers';
import { Plus, Minus, Maximize2 } from 'lucide-react';

const INITIAL_VB = { x: 0, y: 0, w: 1000, h: 500 };
const MIN_W = 120;
const MAX_W = 1000;
const MIN_H = 60;
const MAX_H = 500;

export default function WorldMap() {
  const { game, selectedTerritory, selectedSeaZone, selectTerritory, selectSeaZone } = useGameStore();
  const containerRef = useRef<HTMLDivElement>(null);

  const [viewBox, setViewBox] = useState(INITIAL_VB);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [lastViewBox, setLastViewBox] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);

  // Pinch-to-zoom state
  const [pinchStartDist, setPinchStartDist] = useState(0);
  const [pinchStartVB, setPinchStartVB] = useState(INITIAL_VB);
  const [isPinching, setIsPinching] = useState(false);

  if (!game) return null;

  // --- Zoom helpers ---
  const zoomBy = useCallback((factor: number, centerX?: number, centerY?: number) => {
    setViewBox(prev => {
      const newW = Math.max(MIN_W, Math.min(MAX_W, prev.w * factor));
      const newH = Math.max(MIN_H, Math.min(MAX_H, prev.h * factor));
      // Zoom toward center of viewBox (or custom center)
      const cx = centerX ?? (prev.x + prev.w / 2);
      const cy = centerY ?? (prev.y + prev.h / 2);
      const newX = cx - (newW / prev.w) * (cx - prev.x);
      const newY = cy - (newH / prev.h) * (cy - prev.y);
      return { x: newX, y: newY, w: newW, h: newH };
    });
  }, []);

  const resetZoom = useCallback(() => {
    setViewBox(INITIAL_VB);
  }, []);

  // --- Mouse wheel zoom ---
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.15 : 0.87;
    zoomBy(factor);
  }, [zoomBy]);

  // --- Touch handling for pinch-to-zoom + pan ---
  const getTouchDist = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length < 2) return { x: 0, y: 0 };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Start pinch
      e.preventDefault();
      setIsPinching(true);
      setIsPanning(false);
      setPinchStartDist(getTouchDist(e.touches));
      setPinchStartVB({ ...viewBox });
    } else if (e.touches.length === 1 && !isPinching) {
      // Start pan only if not already pinching
      setIsPanning(true);
      setHasMoved(false);
      setPanStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      setLastViewBox({ x: viewBox.x, y: viewBox.y });
    }
  }, [viewBox, isPinching]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isPinching && e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDist(e.touches);
      if (pinchStartDist === 0) return;
      
      // Calculate zoom factor
      const scale = dist / pinchStartDist;
      const newW = Math.max(MIN_W, Math.min(MAX_W, pinchStartVB.w / scale));
      const newH = Math.max(MIN_H, Math.min(MAX_H, pinchStartVB.h / scale));
      
      // Keep center fixed during pinch zoom
      const centerX = pinchStartVB.x + pinchStartVB.w / 2;
      const centerY = pinchStartVB.y + pinchStartVB.h / 2;
      const newX = centerX - newW / 2;
      const newY = centerY - newH / 2;
      
      setViewBox({ x: newX, y: newY, w: newW, h: newH });
    } else if (isPanning && e.touches.length === 1 && !isPinching) {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const scaleX = viewBox.w / rect.width;
      const scaleY = viewBox.h / rect.height;
      const dx = (e.touches[0].clientX - panStart.x) * scaleX;
      const dy = (e.touches[0].clientY - panStart.y) * scaleY;
      const totalMove = Math.abs(e.touches[0].clientX - panStart.x) + Math.abs(e.touches[0].clientY - panStart.y);
      if (totalMove > 8) setHasMoved(true);
      setViewBox(prev => ({ ...prev, x: lastViewBox.x - dx, y: lastViewBox.y - dy }));
    }
  }, [isPinching, isPanning, pinchStartDist, pinchStartVB, panStart, lastViewBox, viewBox.w, viewBox.h]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setIsPinching(false);
    }
    if (e.touches.length === 0) {
      setIsPanning(false);
    }
  }, []);

  // --- Mouse/pointer pan (desktop) ---
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return; // handled by touch events
    if (e.button === 0) {
      setIsPanning(true);
      setHasMoved(false);
      setPanStart({ x: e.clientX, y: e.clientY });
      setLastViewBox({ x: viewBox.x, y: viewBox.y });
    }
  }, [viewBox]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    if (!isPanning) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const scaleX = viewBox.w / rect.width;
    const scaleY = viewBox.h / rect.height;
    const dx = (e.clientX - panStart.x) * scaleX;
    const dy = (e.clientY - panStart.y) * scaleY;
    const totalMove = Math.abs(e.clientX - panStart.x) + Math.abs(e.clientY - panStart.y);
    if (totalMove > 5) setHasMoved(true);
    setViewBox(prev => ({ ...prev, x: lastViewBox.x - dx, y: lastViewBox.y - dy }));
  }, [isPanning, panStart, lastViewBox, viewBox.w, viewBox.h]);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // --- Click handlers (only fire if not panning) ---
  const handleTerritoryClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasMoved) {
      selectTerritory(id === selectedTerritory ? null : id);
    }
  };

  const handleSeaClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasMoved) {
      selectSeaZone(id === selectedSeaZone ? null : id);
    }
  };

  const getTerritoryColor = (territoryId: string): string => {
    const territory = game.territories[territoryId];
    if (!territory) return '#334155';
    if (territory.nuked) return '#1e1b4b';
    if (territory.owner) {
      return SUPERPOWERS[territory.owner].color;
    }
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

  // Zoom level indicator
  const zoomLevel = Math.round((1000 / viewBox.w) * 100);

  return (
    <div
      ref={containerRef}
      className="w-full h-full select-none relative bg-slate-950"
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* SVG Map */}
      <svg
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="w-full h-full"
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      >
        {/* Sea zones */}
        {Object.entries(game.seaZones).map(([seaId, sea]) => (
          <path
            key={seaId}
            d={sea.path}
            fill={getSeaColor(seaId)}
            stroke={selectedSeaZone === seaId ? '#fbbf24' : '#1e40af'}
            strokeWidth={selectedSeaZone === seaId ? 3 : 1}
            opacity={0.6}
            onClick={(e) => handleSeaClick(seaId, e as any)}
            style={{ cursor: 'pointer' }}
          />
        ))}

        {/* Territories */}
        {Object.entries(game.territories).map(([territoryId, territory]) => (
          <g key={territoryId}>
            <path
              d={territory.path}
              fill={getTerritoryColor(territoryId)}
              stroke={selectedTerritory === territoryId ? '#fbbf24' : '#475569'}
              strokeWidth={selectedTerritory === territoryId ? 2 : 0.5}
              onClick={(e) => handleTerritoryClick(territoryId, e as any)}
              style={{ cursor: 'pointer' }}
            />
            {/* Army count label */}
            {getArmyCount(territoryId) > 0 && (
              <text
                x={territory.labelX}
                y={territory.labelY}
                fill="#fef3c7"
                fontSize="12"
                fontWeight="bold"
                textAnchor="middle"
                pointerEvents="none"
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
              x={sea.labelX}
              y={sea.labelY}
              fill="#93c5fd"
              fontSize="10"
              fontWeight="bold"
              textAnchor="middle"
              pointerEvents="none"
            >
              ⚓ {count}
            </text>
          );
        })}
      </svg>

      {/* Zoom Controls - Bottom Right */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => zoomBy(0.87)}
          className="w-10 h-10 rounded bg-primary/80 hover:bg-primary text-primary-foreground flex items-center justify-center active:scale-[0.9] transition-all"
          title="Zoom out"
        >
          <Minus size={18} />
        </button>
        <button
          onClick={() => zoomBy(1.15)}
          className="w-10 h-10 rounded bg-primary/80 hover:bg-primary text-primary-foreground flex items-center justify-center active:scale-[0.9] transition-all"
          title="Zoom in"
        >
          <Plus size={18} />
        </button>
        <button
          onClick={resetZoom}
          className="w-10 h-10 rounded bg-secondary/80 hover:bg-secondary text-secondary-foreground flex items-center justify-center active:scale-[0.9] transition-all"
          title="Reset zoom"
        >
          <Maximize2 size={18} />
        </button>
      </div>

      {/* Zoom Level Indicator */}
      <div className="absolute bottom-4 left-4 px-3 py-2 rounded bg-background/80 backdrop-blur-sm border border-border text-xs font-mono text-muted-foreground">
        {zoomLevel}%
      </div>
    </div>
  );
}
