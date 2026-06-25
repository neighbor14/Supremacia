import { useState } from 'react';
import { useGameStore, computeSalaryDue } from '../game/store';
import { SUPERPOWERS } from '../data/initialPlayers';
import { RULES } from '../game/rulesConfig';
import { ChevronLeft, ChevronRight, GripVertical, AlertTriangle } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';
import { useT } from '../i18n/useI18n';
import { TranslationKey } from '../i18n';

const RESOURCE_CONFIG = [
  { key: 'grain' as const,   icon: '🌾', color: '#eab308', bg: '#eab30840' },
  { key: 'oil' as const,     icon: '🛢',  color: '#ef4444', bg: '#ef444440' },
  { key: 'mineral' as const, icon: '⛏',  color: '#a855f7', bg: '#a855f740' },
];

const MAX = RULES.MAX_SUPPLY; // 12

export default function PlayerStatusBar() {
  const { game } = useGameStore();
  const t = useT();
  const [expanded, setExpanded] = useState(true);
  const { containerRef, dragHandleProps, containerStyle } = useDraggable(() => ({
    x: 8,
    y: Math.max(60, window.innerHeight * 0.33 - 80),
  }));

  if (!game) return null;

  const humanPlayer = Object.values(game.players).find(p => p.isHuman);
  if (!humanPlayer) return null;

  const sp = SUPERPOWERS[humanPlayer.id];

  // Auto-collapse when a phase panel is open and the viewport is short/landscape,
  // to prevent the draggable panel from covering the bottom build/sell/buy HUD.
  const currentTurnPlayer = game.players[game.turn.currentPlayer];
  const phasePanelOpen = !!currentTurnPlayer?.isHuman && game.turn.stage >= 3 && game.turn.stage <= 7;
  const isSmallViewport = window.innerHeight < 600 || window.innerWidth > window.innerHeight;
  const isExpanded = expanded && !(phasePanelOpen && isSmallViewport);

  return (
    <div ref={containerRef} style={{ ...containerStyle, zIndex: 20 }} className="flex items-start gap-0">
      {/* Main panel */}
      <div
        className="bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl overflow-hidden transition-all duration-200"
        style={{ width: isExpanded ? 160 : 42 }}
      >
        {isExpanded ? (
          <div className="p-2.5">
            {/* Drag handle */}
            <div
              {...dragHandleProps}
              className="flex items-center justify-center -mt-1 mb-1.5 opacity-40 hover:opacity-70 transition-opacity"
              title={t('status.dragPanel')}
            >
              <GripVertical size={10} className="text-muted-foreground rotate-90" />
            </div>
            {/* Money */}
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">$</span>
              <span className="text-sm font-bold font-mono leading-none" style={{ color: sp.color }}>
                {humanPlayer.money >= 1000
                  ? `${Math.floor(humanPlayer.money / 1000)}k`
                  : humanPlayer.money.toLocaleString()}
              </span>
              {humanPlayer.loans > 0 && (
                <span className="text-[10px] text-destructive font-mono ml-auto">-{(humanPlayer.loans / 1000).toFixed(0)}k {t('status.debtShort')}</span>
              )}
            </div>

            {/* Supply tracks */}
            <div className="space-y-1.5">
              {RESOURCE_CONFIG.map(({ key, icon, color, bg }) => {
                const val = humanPlayer.supplies[key];
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-0.5">
                        {icon} {t(`resource.${key}` as TranslationKey)}
                      </span>
                      <span className="text-[10px] font-bold font-mono" style={{ color }}>
                        {val}/{MAX}
                      </span>
                    </div>
                    {/* Track cells */}
                    <div className="flex gap-[2px]">
                      {Array.from({ length: MAX }).map((_, i) => (
                        <div
                          key={i}
                          className="flex-1 h-2.5 rounded-[2px] transition-colors"
                          style={{
                            backgroundColor: i < val ? color : bg,
                            opacity: i < val ? 1 : 0.35,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Salary provision — forecast next upkeep using the real engine rule */}
            {(() => {
              const due = computeSalaryDue(humanPlayer);
              const after = humanPlayer.money - due.total;
              const short = after < 0;
              return (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      💰 {t('status.salaryProvision')}
                    </span>
                    {short && <AlertTriangle size={10} className="text-destructive" />}
                  </div>
                  <div className="space-y-0.5 font-mono text-[10px]">
                    <div className="flex justify-between" title={`${due.unitCount} unidades × $${RULES.SALARY_PER_UNIT} + ${due.companyCount} companhias × $${RULES.SALARY_PER_COMPANY}${due.loanInterest ? ` + juros` : ''}`}>
                      <span className="text-muted-foreground">{t('status.estimated')}</span>
                      <span className="text-foreground font-bold">-${due.total.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('status.youHave')}</span>
                      <span className="text-foreground">${humanPlayer.money.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('status.afterPaying')}</span>
                      <span className={short ? 'text-destructive font-bold' : 'text-emerald-400'}>
                        ${after.toLocaleString()}
                      </span>
                    </div>
                    {short && (
                      <div className="flex justify-between pt-0.5">
                        <span className="text-destructive">{t('status.missing')}</span>
                        <span className="text-destructive font-bold">${Math.abs(after).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  {short && (
                    <p className="text-[8px] text-destructive/80 mt-1 leading-tight">
                      {t('status.noFundsWarn')}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Weapons row */}
            {(humanPlayer.nukes > 0 || humanPlayer.laserStars > 0) && (
              <div className="flex gap-2 mt-2 pt-2 border-t border-border/50">
                {humanPlayer.nukes > 0 && (
                  <span className="text-[10px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded font-mono font-bold">
                    ☢ {humanPlayer.nukes}
                  </span>
                )}
                {humanPlayer.laserStars > 0 && (
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono font-bold">
                    ★ {humanPlayer.laserStars}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Collapsed: vertical stack of resource dots + money */
          <div className="py-2.5 px-1 flex flex-col items-center gap-1.5">
            {/* Drag handle */}
            <div
              {...dragHandleProps}
              className="opacity-40 hover:opacity-70 transition-opacity"
              title={t('status.dragPanel')}
            >
              <GripVertical size={10} className="text-muted-foreground rotate-90" />
            </div>
            <span className="text-[9px] font-bold font-mono" style={{ color: sp.color }}>
              {humanPlayer.money >= 1000 ? `${Math.floor(humanPlayer.money / 1000)}k` : humanPlayer.money}
            </span>
            {RESOURCE_CONFIG.map(({ key, icon, color }) => (
              <div key={key} className="flex flex-col items-center gap-0.5">
                <span className="text-[10px]">{icon}</span>
                <span className="text-[9px] font-mono font-bold" style={{ color }}>
                  {humanPlayer.supplies[key]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toggle tab */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="mt-3 w-5 h-8 bg-card/95 border border-border rounded-r-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors shadow-lg"
      >
        {expanded ? <ChevronLeft size={10} /> : <ChevronRight size={10} />}
      </button>
    </div>
  );
}
