import { useRef, useState, useCallback, useEffect } from 'react';
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

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Start pinch
      e.preventDefault();
      setIsPinching(true);
      setIsPanning(false);
      setPinchStartDist(getTouchDist(e.touches));
      setPinchStartVB({ ...viewBox });
    } else if (e.touches.length === 1) {
      // Start pan
      setIsPanning(true);
      setHasMoved(false);
      setPanStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      setLastViewBox({ x: viewBox.x, y: viewBox.y });
    }
  }, [viewBox]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isPinching && e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDist(e.touches);
      if (pinchStartDist === 0) return;
      const scale = pinchStartDist / dist;
      const newW = Math.max(MIN_W, Math.min(MAX_W, pinchStartVB.w * scale));
      const newH = Math.max(MIN_H, Math.min(MAX_H, pinchStartVB.h * scale));
      const dx = (pinchStartVB.w - newW) / 2;
      const dy = (pinchStartVB.h - newH) / 2;
      setViewBox({ x: pinchStartVB.x + dx, y: pinchStartVB.y + dy, w: newW, h: newH });
    } else if (isPanning && e.touches.length === 1) {
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
      className="w-full h-full select-none relative"
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <svg
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="w-full h-full"
        style={{ background: '#0a1628' }}
      >
        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#1e293b" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect x="-100" y="-100" width="1200" height="700" fill="url(#grid)" />

        {/* Sea zones */}
        {Object.values(game.seaZones).map(sea => (
          <g key={sea.id}>
            <path
              d={sea.svgPath}
              fill={getSeaColor(sea.id)}
              stroke={selectedSeaZone === sea.id ? '#60a5fa' : '#1e3a5f'}
              strokeWidth={selectedSeaZone === sea.id ? 2 : 0.5}
              opacity={0.6}
              onClick={(e) => handleSeaClick(sea.id, e)}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            />
            <text
              x={sea.labelPos.x}
              y={sea.labelPos.y}
              textAnchor="middle"
              className="pointer-events-none"
              style={{ fontSize: '6px', fill: '#64748b', fontFamily: 'var(--font-body)' }}
            >
              {sea.name}
            </text>
            {getNavyCount(sea.id) > 0 && (
              <g>
                <circle cx={sea.labelPos.x} cy={sea.labelPos.y + 10} r={6} fill="#1e293b" stroke="#60a5fa" strokeWidth={0.5} />
                <text
                  x={sea.labelPos.x}
                  y={sea.labelPos.y + 13}
                  textAnchor="middle"
                  style={{ fontSize: '7px', fill: '#60a5fa', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}
                  className="pointer-events-none"
                >
                  {getNavyCount(sea.id)}
                </text>
              </g>
            )}
          </g>
        ))}

        {/* Territories */}
        {Object.values(game.territories).map(territory => {
          const isSelected = selectedTerritory === territory.id;
          const color = getTerritoryColor(territory.id);
          const armyCount = getArmyCount(territory.id);

          return (
            <g key={territory.id}>
              <path
                d={territory.svgPath}
                fill={color}
                stroke={isSelected ? '#fbbf24' : '#0f172a'}
                strokeWidth={isSelected ? 2 : 1}
                opacity={territory.nuked ? 0.3 : 0.85}
                onClick={(e) => handleTerritoryClick(territory.id, e)}
                className="cursor-pointer hover:opacity-100 transition-opacity"
              />
              <text
                x={territory.labelPos.x}
                y={territory.labelPos.y - 5}
                textAnchor="middle"
                className="pointer-events-none"
                style={{ fontSize: '5.5px', fill: '#f8fafc', fontFamily: 'var(--font-display)', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
              >
                {territory.name}
              </text>
              {armyCount > 0 && !territory.nuked && (
                <g>
                  <circle cx={territory.labelPos.x} cy={territory.labelPos.y + 5} r={7} fill="#0f172a" stroke={color} strokeWidth={1} />
                  <text
                    x={territory.labelPos.x}
                    y={territory.labelPos.y + 8}
                    textAnchor="middle"
                    style={{ fontSize: '7px', fill: '#f8fafc', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}
                    className="pointer-events-none"
                  >
                    {armyCount}
                  </text>
                </g>
              )}
              {territory.nuked && (
                <text
                  x={territory.labelPos.x}
                  y={territory.labelPos.y + 5}
                  textAnchor="middle"
                  style={{ fontSize: '14px' }}
                  className="pointer-events-none"
                >
                  ☢
                </text>
              )}
              {territory.hasPort && !territory.nuked && (
                <circle
                  cx={territory.labelPos.x + 12}
                  cy={territory.labelPos.y - 5}
                  r={2}
                  fill="#f8fafc"
                  className="pointer-events-none"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Zoom controls - floating buttons */}
      <div className="absolute bottom-4 right-3 flex flex-col gap-1.5 z-10">
        <button
          onClick={() => zoomBy(0.7)}
          className="w-10 h-10 rounded-lg bg-card/90 backdrop-blur-sm border border-border flex items-center justify-center text-foreground hover:bg-card active:scale-[0.93] transition-all shadow-lg"
          aria-label="Zoom in"
        >
          <Plus size={20} />
        </button>
        <div className="text-center text-[10px] text-muted-foreground font-mono bg-card/70 rounded px-1 py-0.5">
          {zoomLevel}%
        </div>
        <button
          onClick={() => zoomBy(1.4)}
          className="w-10 h-10 rounded-lg bg-card/90 backdrop-blur-sm border border-border flex items-center justify-center text-foreground hover:bg-card active:scale-[0.93] transition-all shadow-lg"
          aria-label="Zoom out"
        >
          <Minus size={20} />
        </button>
        <button
          onClick={resetZoom}
          className="w-10 h-10 rounded-lg bg-card/90 backdrop-blur-sm border border-border flex items-center justify-center text-foreground hover:bg-card active:scale-[0.93] transition-all shadow-lg mt-1"
          aria-label="Reset zoom"
        >
          <Maximize2 size={16} />
        </button>
      </div>
    </div>
  );
}
