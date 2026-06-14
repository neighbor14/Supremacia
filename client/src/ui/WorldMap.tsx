import { useRef, useState, useCallback, useEffect } from 'react';
import { useGameStore } from '../game/store';
import { SUPERPOWERS } from '../data/initialPlayers';

export default function WorldMap() {
  const { game, selectedTerritory, selectedSeaZone, selectTerritory, selectSeaZone } = useGameStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1000, h: 500 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [lastViewBox, setLastViewBox] = useState({ x: 0, y: 0 });

  if (!game) return null;

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    setViewBox(prev => {
      const newW = Math.max(200, Math.min(1000, prev.w * factor));
      const newH = Math.max(100, Math.min(500, prev.h * factor));
      const dx = (prev.w - newW) / 2;
      const dy = (prev.h - newH) / 2;
      return { x: prev.x + dx, y: prev.y + dy, w: newW, h: newH };
    });
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch' || e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setLastViewBox({ x: viewBox.x, y: viewBox.y });
    }
  }, [viewBox]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const scaleX = viewBox.w / rect.width;
    const scaleY = viewBox.h / rect.height;
    const dx = (e.clientX - panStart.x) * scaleX;
    const dy = (e.clientY - panStart.y) * scaleY;
    setViewBox(prev => ({ ...prev, x: lastViewBox.x - dx, y: lastViewBox.y - dy }));
  }, [isPanning, panStart, lastViewBox, viewBox.w, viewBox.h]);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleTerritoryClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPanning) {
      selectTerritory(id === selectedTerritory ? null : id);
    }
  };

  const handleSeaClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPanning) {
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
    return '#475569'; // neutral
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
      className="w-full h-full touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
    >
      <svg
        ref={svgRef}
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

        {/* Sea zones (render first, behind territories) */}
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
            {/* Sea name */}
            <text
              x={sea.labelPos.x}
              y={sea.labelPos.y}
              textAnchor="middle"
              className="pointer-events-none"
              style={{ fontSize: '6px', fill: '#64748b', fontFamily: 'var(--font-body)' }}
            >
              {sea.name}
            </text>
            {/* Navy count */}
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
              {/* Territory name */}
              <text
                x={territory.labelPos.x}
                y={territory.labelPos.y - 5}
                textAnchor="middle"
                className="pointer-events-none"
                style={{ fontSize: '5.5px', fill: '#f8fafc', fontFamily: 'var(--font-display)', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
              >
                {territory.name}
              </text>
              {/* Army count badge */}
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
              {/* Nuke marker */}
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
              {/* Port indicator */}
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
    </div>
  );
}
