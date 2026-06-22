import { useRef, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useGameStore, getBuildTargets } from '../game/store';
import { SUPERPOWERS, SUPERPOWER_IDS } from '../data/initialPlayers';
import { playSound } from '../game/audio';
import { Plus, Minus, Maximize2 } from 'lucide-react';
import { getCompanyOpportunities } from '../game/companyMap';

/**
 * WorldMap uses CSS transform (scale + translate) for zoom/pan.
 * Fixed: pan direction matches finger/mouse direction exactly.
 * The SVG fills the container completely using "xMidYMid slice" to avoid blank areas.
 *
 * Rendering is fully data-driven: every shape, hitbox and label reads
 * svgPath / labelPos from game.territories / game.seaZones (keyed by id),
 * so the game graph stays untouched — only the visual layer changed.
 */

const MIN_SCALE = 0.8;
const MAX_SCALE = 6;
const PAN_THRESHOLD = 6; // pixels before considering it a drag

const NEUTRAL_COLOR = '#5b6c84';
const NUKED_COLOR = '#3a2f63';

// Mix a hex colour toward white (amt > 0) or black (amt < 0). Used to build
// the top-light / bottom-dark gradient + side wall that give each landmass depth.
function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt;
  } else {
    const k = 1 + amt; r *= k; g *= k; b *= k;
  }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

// Visual fill key for a territory: nuked / owner faction / neutral.
const BASE_COLORS: Record<string, string> = (() => {
  const m: Record<string, string> = { neutral: NEUTRAL_COLOR, nuked: NUKED_COLOR };
  SUPERPOWER_IDS.forEach(id => { m[id] = SUPERPOWERS[id].color; });
  return m;
})();

// In portrait the 2:1 viewBox letterboxes heavily. Start zoomed so the map fills
// the container height instead, letting the user pan to navigate.
function getInitialScale(): number {
  if (typeof window === 'undefined') return 1;
  const cw = window.innerWidth;
  // Approximate map area height (minus TurnPhaseBar ~56px)
  const mapH = window.innerHeight * 0.75;
  // With "meet" and 2:1 viewBox, map renders at cw × cw/2 (width-constrained)
  if (mapH > cw * 0.65) {
    return Math.min(mapH / (cw / 2), MAX_SCALE);
  }
  return 1;
}

export default function WorldMap() {
  const { game, selectedTerritory, selectedSeaZone, selectTerritory, selectSeaZone, buildAction, dispatch, companyMapVisible } = useGameStore();
  const containerRef = useRef<HTMLDivElement>(null);

  // Transform state
  const [scale, setScale] = useState(getInitialScale);
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

  // Territories/seas the player may build on right now (drives both the pulsing
  // highlight and the click routing below). Empty unless a build action is pending.
  const buildTargetSet = new Set(getBuildTargets(game, buildAction));
  const armyMode = buildAction === 'army';
  const navyMode = buildAction === 'navy';

  // A bottom phase panel (Vender/Atacar/Mover/Construir/Comprar) overlays the
  // lower part of the map. Lift the zoom controls above it so they never sit on
  // top of the panel's buttons. Build menu is the tallest of these (~32vh).
  const human = game.players[game.turn.currentPlayer]?.isHuman;
  const phasePanelOpen = !!human && game.turn.stage >= 3 && game.turn.stage <= 7;

  // Move / Attack highlight sources (only when the stage is active, not in "choosing" mode)
  const currentPlayer = game.players[game.turn.currentPlayer];
  const stageActive = !game.turn.stageComplete;
  const moveMode = !!human && game.turn.stage === 5 && stageActive && !buildAction;
  const attackMode = !!human && game.turn.stage === 4 && stageActive && !buildAction;
  const moveArmySets = moveMode && currentPlayer
    ? new Set(Object.entries(currentPlayer.armies).filter(([, c]) => c > 0).map(([id]) => id))
    : new Set<string>();
  const moveNavySets = moveMode && currentPlayer
    ? new Set(Object.entries(currentPlayer.navies).filter(([, c]) => c > 0).map(([id]) => id))
    : new Set<string>();
  const attackLandSets = attackMode && currentPlayer
    ? new Set(Object.entries(currentPlayer.armies).filter(([, c]) => c >= 2).map(([id]) => id))
    : new Set<string>();
  const attackSeaSets = attackMode && currentPlayer
    ? new Set(Object.entries(currentPlayer.navies).filter(([, c]) => c >= 1).map(([id]) => id))
    : new Set<string>();

  // Company map: private opportunity overlay for the current human player.
  // Computed only when the toggle is on to avoid unnecessary iteration.
  const companyOpportunities = (companyMapVisible && human)
    ? getCompanyOpportunities(game, game.turn.currentPlayer)
    : new Map<string, import('../game/companyMap').CompanyOpportunity>();

  // Territory to briefly highlight when the drawn-card modal reveals a resource card.
  const drawnCardTerritoryId =
    game.drawnCard?.active && game.drawnCard.type === 'resource' && game.drawnCard.cardId
      ? (game.resourceCards[game.drawnCard.cardId]?.territoryId ?? null)
      : null;

  // --- Zoom helpers ---
  const zoomIn = () => setScale(s => Math.min(MAX_SCALE, s * 1.4));
  const zoomOut = () => setScale(s => Math.max(MIN_SCALE, s / 1.4));
  const resetZoom = () => { setScale(getInitialScale()); setTx(0); setTy(0); };

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
    if (interactionRef.current.hasMoved) return;

    // Build-selection mode: a territory click means "place an army here".
    if (armyMode) {
      if (buildTargetSet.has(id)) {
        playSound('button-click', 0.5);
        dispatch({ type: 'BUILD_UNITS', units: [{ type: 'army', locationId: id }] });
      } else {
        playSound('error', 0.4);
        toast.error('Você só pode construir exército em território seu (controlado e não destruído).');
      }
      return;
    }
    if (navyMode) {
      playSound('error', 0.4);
      toast.error('Esquadras são construídas no mar. Toque numa zona marítima destacada (adjacente a um porto seu).');
      return;
    }

    if (id !== selectedTerritory) playSound('button-click', 0.35);
    selectTerritory(id === selectedTerritory ? null : id);
  };

  const handleSeaClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (interactionRef.current.hasMoved) return;

    // Build-selection mode: a sea click means "build a fleet here".
    if (navyMode) {
      if (buildTargetSet.has(id)) {
        playSound('button-click', 0.5);
        dispatch({ type: 'BUILD_UNITS', units: [{ type: 'navy', locationId: id }] });
      } else {
        playSound('error', 0.4);
        toast.error('Esquadra só pode ser construída em mar adjacente a um porto que você controla.');
      }
      return;
    }
    if (armyMode) {
      playSound('error', 0.4);
      toast.error('Exércitos vão em terra. Toque num território destacado.');
      return;
    }

    if (id !== selectedSeaZone) playSound('button-click', 0.35);
    selectSeaZone(id === selectedSeaZone ? null : id);
  };

  // --- Rendering helpers ---
  // Returns the visual fill key for a territory (drives its gradient + wall).
  const getTerritoryKey = (territoryId: string): string => {
    const territory = game.territories[territoryId];
    if (!territory) return 'neutral';
    if (territory.nuked) return 'nuked';
    if (territory.owner) return territory.owner;
    return 'neutral';
  };

  const getArmyCount = (territoryId: string): number => {
    let total = 0;
    for (const player of Object.values(game.players)) {
      total += player.armies[territoryId] || 0;
    }
    return total;
  };

  // Per-owner naval presence in a sea zone: fleet count + embarked armies.
  const getSeaForces = (seaId: string) => {
    const forces: { id: string; color: string; navies: number; embarked: number }[] = [];
    for (const player of Object.values(game.players)) {
      const navies = player.navies[seaId] || 0;
      const embarked = player.embarked[seaId] || 0;
      if (navies > 0 || embarked > 0) {
        forces.push({ id: player.id, color: SUPERPOWERS[player.id].color, navies, embarked });
      }
    }
    return forces;
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
        <defs>
          {/* Deep ocean backdrop */}
          <radialGradient id="ocean-grad" cx="50%" cy="42%" r="75%">
            <stop offset="0%" stopColor="#16344f" />
            <stop offset="55%" stopColor="#0c2138" />
            <stop offset="100%" stopColor="#060f1d" />
          </radialGradient>
          {/* Per-faction landmass gradient: lit top, shaded bottom */}
          {Object.entries(BASE_COLORS).map(([key, color]) => (
            <linearGradient key={key} id={`terr-${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={shade(color, 0.30)} />
              <stop offset="52%" stopColor={color} />
              <stop offset="100%" stopColor={shade(color, -0.26)} />
            </linearGradient>
          ))}
          {/* Sea fills */}
          <linearGradient id="sea-coastal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f4d77" />
            <stop offset="100%" stopColor="#123a5c" />
          </linearGradient>
          <linearGradient id="sea-deep" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#102d4a" />
            <stop offset="100%" stopColor="#0a1d33" />
          </linearGradient>
          {/* Extruded-plateau drop shadow under each landmass */}
          <filter id="land-depth" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="2.4" stdDeviation="2.6" floodColor="#020912" floodOpacity="0.6" />
          </filter>
          {/* Amber glow for the selected shape */}
          <filter id="sel-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="3.2" floodColor="#fbbf24" floodOpacity="0.95" />
          </filter>
          {/* Emerald/blue glow for valid build targets (army / navy) */}
          <filter id="build-glow-army" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="3.4" floodColor="#34d399" floodOpacity="1" />
          </filter>
          <filter id="build-glow-navy" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="3.4" floodColor="#60a5fa" floodOpacity="1" />
          </filter>
          {/* Move-phase and Attack-phase source glows */}
          <filter id="move-glow-land" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="3.4" floodColor="#4ade80" floodOpacity="0.9" />
          </filter>
          <filter id="move-glow-sea" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="3.4" floodColor="#38bdf8" floodOpacity="0.9" />
          </filter>
          <filter id="attack-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="3.4" floodColor="#f87171" floodOpacity="0.9" />
          </filter>
          {/* Company-map opportunity glows (three tiers: own / neutral / foreign + drawn-card) */}
          <filter id="opp-glow-own" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f59e0b" floodOpacity="1" />
          </filter>
          <filter id="opp-glow-neutral" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#06b6d4" floodOpacity="0.9" />
          </filter>
          <filter id="opp-glow-foreign" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#f43f5e" floodOpacity="0.75" />
          </filter>
          <filter id="opp-glow-drawn" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#fbbf24" floodOpacity="1" />
          </filter>
        </defs>

        {/* Background ocean */}
        <rect x="0" y="0" width="1000" height="500" fill="url(#ocean-grad)" />

        {/* Faint graticule for an atlas feel */}
        <g stroke="#21527d" strokeWidth="0.4" opacity="0.18" pointerEvents="none">
          {[125, 250, 375].map(y => <line key={`h${y}`} x1="0" y1={y} x2="1000" y2={y} />)}
          {[200, 400, 600, 800].map(x => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="500" />)}
        </g>

        {/* Sea zones */}
        {Object.entries(game.seaZones).map(([seaId, sea]) => {
          const selected = selectedSeaZone === seaId;
          return (
            <path
              key={seaId}
              d={sea.svgPath}
              fill={sea.type === 'coastal' ? 'url(#sea-coastal)' : 'url(#sea-deep)'}
              stroke={selected ? '#fbbf24' : '#2a5e8c'}
              strokeWidth={selected ? 2.2 : 0.8}
              opacity={selected ? 0.95 : 0.78}
              filter={selected ? 'url(#sel-glow)' : undefined}
              onClick={(e) => handleSeaClick(seaId, e as any)}
              style={{ cursor: 'pointer' }}
            />
          );
        })}

        {/* Deep-ocean anchor glyphs (skipped where fleets are shown) */}
        {Object.entries(game.seaZones).map(([seaId, sea]) => {
          if (sea.type !== 'deep' || getSeaForces(seaId).length > 0) return null;
          return (
            <text
              key={`anchor-${seaId}`}
              x={sea.labelPos.x} y={sea.labelPos.y}
              fill="#7ea7cc" fillOpacity={0.42} fontSize="13"
              textAnchor="middle" dominantBaseline="central" pointerEvents="none"
            >
              ⚓
            </text>
          );
        })}

        {/* Landmass side walls (drawn first → 3D extrusion under the top faces) */}
        {Object.entries(game.territories).map(([territoryId, territory]) => (
          <path
            key={`wall-${territoryId}`}
            d={territory.svgPath}
            transform="translate(0, 4)"
            fill={shade(BASE_COLORS[getTerritoryKey(territoryId)], -0.55)}
            pointerEvents="none"
          />
        ))}

        {/* Territories (top faces + labels) */}
        {Object.entries(game.territories).map(([territoryId, territory]) => {
          const key = getTerritoryKey(territoryId);
          const baseColor = BASE_COLORS[key];
          const selected = selectedTerritory === territoryId;
          const armies = getArmyCount(territoryId);
          const lp = territory.labelPos;
          const nameY = armies > 0 ? lp.y - 6.5 : lp.y;
          return (
            <g key={territoryId}>
              <path
                d={territory.svgPath}
                fill={`url(#terr-${key})`}
                stroke={selected ? '#fde68a' : shade(baseColor, 0.18)}
                strokeWidth={selected ? 1.8 : 0.7}
                strokeLinejoin="round"
                filter={selected ? 'url(#sel-glow)' : 'url(#land-depth)'}
                onClick={(e) => handleTerritoryClick(territoryId, e as any)}
                style={{ cursor: 'pointer' }}
              />
              {/* Territory name */}
              <text
                x={lp.x} y={nameY}
                fill="#eef4fc" fontSize="7" fontWeight="600"
                textAnchor="middle" dominantBaseline="central" pointerEvents="none"
                style={{ paintOrder: 'stroke', stroke: 'rgba(3,9,18,0.7)', strokeWidth: 1.8, strokeLinejoin: 'round' }}
              >
                {territory.name}
              </text>
              {/* Army count badge */}
              {armies > 0 && (
                <g pointerEvents="none">
                  <circle
                    cx={lp.x} cy={lp.y + 7} r={6.6}
                    fill="rgba(7,14,26,0.86)" stroke={shade(baseColor, 0.32)} strokeWidth={0.9}
                  />
                  <text
                    x={lp.x} y={lp.y + 7.4} fill="#fef3c7" fontSize="8.5" fontWeight="bold"
                    textAnchor="middle" dominantBaseline="central"
                  >
                    {armies}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Naval presence badges — one per owner: ⚓ fleet + 🪖 embarked armies */}
        {Object.entries(game.seaZones).map(([seaId, sea]) => {
          const forces = getSeaForces(seaId);
          if (forces.length === 0) return null;
          const rowH = 11;
          const startY = sea.labelPos.y - ((forces.length - 1) * rowH) / 2;
          return (
            <g key={`navy-${seaId}`} pointerEvents="none">
              {forces.map((f, i) => {
                const y = startY + i * rowH;
                // Width scales with content so the pill stays readable when zoomed out.
                const label = `⚓${f.navies}${f.embarked > 0 ? `  🪖${f.embarked}` : ''}`;
                const w = 16 + label.length * 4.2;
                return (
                  <g key={f.id} transform={`translate(${sea.labelPos.x}, ${y})`}>
                    <rect
                      x={-w / 2} y={-5} width={w} height={10} rx={5}
                      fill="rgba(8,18,34,0.82)" stroke={f.color} strokeWidth={0.6}
                    />
                    <circle cx={-w / 2 + 5} cy={0} r={2} fill={f.color} />
                    <text
                      x={3} y={0.5} fill="#dbeafe" fontSize="7" fontWeight="bold"
                      textAnchor="middle" dominantBaseline="central"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Build-target highlight overlay — pulsing outline over every valid
            placement so the player sees exactly where a tap will build. Sits on
            top, non-interactive (clicks fall through to the shapes underneath). */}
        {buildAction && (
          <g pointerEvents="none" className="animate-pulse">
            {armyMode && Object.entries(game.territories).map(([tid, t]) =>
              buildTargetSet.has(tid) ? (
                <path
                  key={`bt-${tid}`}
                  d={t.svgPath}
                  fill="#34d39922"
                  stroke="#6ee7b7"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  filter="url(#build-glow-army)"
                />
              ) : null
            )}
            {navyMode && Object.entries(game.seaZones).map(([sid, s]) =>
              buildTargetSet.has(sid) ? (
                <path
                  key={`bs-${sid}`}
                  d={s.svgPath}
                  fill="#60a5fa22"
                  stroke="#93c5fd"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  filter="url(#build-glow-navy)"
                />
              ) : null
            )}
          </g>
        )}

        {/* Move-phase source highlights: territories/seas with your units, pulsing green/blue */}
        {moveMode && (
          <g pointerEvents="none" className="animate-pulse">
            {Array.from(moveArmySets).map(tid => {
              const t = game.territories[tid];
              return t ? (
                <path key={`mv-${tid}`} d={t.svgPath}
                  fill="#4ade8015" stroke="#86efac" strokeWidth={2} strokeLinejoin="round"
                  filter="url(#move-glow-land)"
                />
              ) : null;
            })}
            {Array.from(moveNavySets).map(sid => {
              const s = game.seaZones[sid];
              return s ? (
                <path key={`mv-${sid}`} d={s.svgPath}
                  fill="#38bdf815" stroke="#7dd3fc" strokeWidth={2} strokeLinejoin="round"
                  filter="url(#move-glow-sea)"
                />
              ) : null;
            })}
          </g>
        )}

        {/* Attack-phase source highlights: territories with 2+ armies / seas with navies, pulsing red */}
        {attackMode && (
          <g pointerEvents="none" className="animate-pulse">
            {Array.from(attackLandSets).map(tid => {
              const t = game.territories[tid];
              return t ? (
                <path key={`atk-${tid}`} d={t.svgPath}
                  fill="#f8717115" stroke="#fca5a5" strokeWidth={2} strokeLinejoin="round"
                  filter="url(#attack-glow)"
                />
              ) : null;
            })}
            {Array.from(attackSeaSets).map(sid => {
              const s = game.seaZones[sid];
              return s ? (
                <path key={`atk-${sid}`} d={s.svgPath}
                  fill="#f8717112" stroke="#fca5a5" strokeWidth={2} strokeLinejoin="round"
                  filter="url(#attack-glow)"
                />
              ) : null;
            })}
          </g>
        )}

        {/* Company-map opportunity overlay — private view, non-interactive.
            Only visible when the human player enables the toggle.
            Three visual tiers: own territory (amber/pulse) > neutral (cyan) > foreign (rose/dashed). */}
        {companyOpportunities.size > 0 && (
          <g pointerEvents="none">
            {Array.from(companyOpportunities.entries()).map(([tid, opp]) => {
              const t = game.territories[tid];
              if (!t) return null;
              const isOwn = opp === 'own';
              const isNeutral = opp === 'neutral';
              return (
                <path
                  key={`opp-${tid}`}
                  d={t.svgPath}
                  fill={isOwn ? '#f59e0b2a' : isNeutral ? '#06b6d42a' : '#f43f5e1a'}
                  stroke={isOwn ? '#fcd34d' : isNeutral ? '#22d3ee' : '#fb7185'}
                  strokeWidth={isOwn ? 2.5 : 1.5}
                  strokeLinejoin="round"
                  strokeDasharray={opp === 'foreign' ? '4 3' : undefined}
                  filter={isOwn ? 'url(#opp-glow-own)' : isNeutral ? 'url(#opp-glow-neutral)' : 'url(#opp-glow-foreign)'}
                  className={isOwn ? 'animate-pulse' : undefined}
                />
              );
            })}
          </g>
        )}

        {/* Drawn-card territory pulse — appears when DrawnCardModal reveals a resource card,
            letting the player immediately locate the company on the map. */}
        {drawnCardTerritoryId && game.territories[drawnCardTerritoryId] && (
          <g pointerEvents="none" className="animate-pulse">
            <path
              d={game.territories[drawnCardTerritoryId].svgPath}
              fill="#fbbf2440"
              stroke="#fbbf24"
              strokeWidth={3}
              strokeLinejoin="round"
              filter="url(#opp-glow-drawn)"
            />
          </g>
        )}
      </svg>

      {/* Zoom Controls - above ticker; lifted clear of any open bottom panel */}
      <div
        className="absolute right-4 flex flex-col gap-2 z-30 items-center transition-[bottom] duration-200"
        style={{ bottom: phasePanelOpen ? 'calc(32vh + 0.75rem)' : '2.25rem' }}
      >
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
        <div className="px-1.5 py-0.5 rounded bg-slate-800/80 text-[10px] font-mono text-slate-400 border border-slate-600/30 w-10 text-center">
          {Math.round(scale * 100)}%
        </div>
      </div>
    </div>
  );
}
