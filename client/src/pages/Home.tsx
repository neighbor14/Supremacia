import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Volume2 } from 'lucide-react';
import { useGameStore } from '../game/store';
import { SuperpowerId, AIDifficulty, MarketMode } from '../game/types';
import { AI_DIFFICULTY_LABELS, DEFAULT_AI_DIFFICULTY } from '../game/ai';
import { RULES } from '../game/rulesConfig';
import { SUPERPOWERS, SUPERPOWER_IDS } from '../data/initialPlayers';
import { GameState } from '../game/types';

const MARKET_MODES: { id: MarketMode; label: string; hint: string }[] = [
  { id: 'balanced', label: 'Digital Balanceado', hint: 'Venda simultânea no início da rodada — reduz a vantagem econômica do 1º jogador.' },
  { id: 'classic', label: 'Clássico Grow', hint: 'Fiel ao modo básico da Grow. Mercado em $5.000 e venda na ordem do turno.' },
];
import { useAudioInit, useMusicPlayer } from '../hooks/useAudio';

type Step = 'menu' | 'superpower' | 'ai_count';

export default function Home() {
  const [, setLocation] = useLocation();
  const { startGame, loadGame } = useGameStore();
  const [step, setStep] = useState<Step>('menu');
  const [selectedSuperpower, setSelectedSuperpower] = useState<SuperpowerId | null>(null);
  const [aiCount, setAiCount] = useState(3);
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>(DEFAULT_AI_DIFFICULTY);
  const [marketMode, setMarketMode] = useState<MarketMode>(RULES.DEFAULT_MARKET_MODE);

  const { initialized, activate } = useAudioInit();
  const { play } = useMusicPlayer();

  const hasSave = !!localStorage.getItem('supremacia_save');
  const maxAi = SUPERPOWER_IDS.length - 1;

  // Start menu music as soon as audio is available
  useEffect(() => {
    if (initialized) {
      play('menu');
    }
  }, [initialized, play]);

  const handleActivateSound = () => {
    activate();
    play('menu');
  };

  const handleSelectSuperpower = (id: SuperpowerId) => {
    setSelectedSuperpower(id);
    setStep('ai_count');
  };

  const handleStartGame = () => {
    if (!selectedSuperpower) return;
    startGame(selectedSuperpower, aiCount, aiDifficulty, marketMode);
    setLocation('/setup');
  };

  const handleContinue = () => {
    const save = localStorage.getItem('supremacia_save');
    if (save) {
      try {
        const state = JSON.parse(save) as GameState;
        loadGame(state);
        setLocation('/game');
      } catch { alert('Arquivo de save corrompido.'); }
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const state = JSON.parse(ev.target?.result as string) as GameState;
          loadGame(state);
          setLocation('/game');
        } catch { alert('Arquivo inválido.'); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const sp = selectedSuperpower ? SUPERPOWERS[selectedSuperpower] : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      {/* Logo / Title */}
      <div className="text-center mb-12">
        <img
          src="/logo.png"
          alt="Command the Map"
          className="w-56 h-auto mx-auto mb-2 drop-shadow-lg"
          draggable={false}
        />
        <p className="text-sm text-muted-foreground mt-2 tracking-widest uppercase" style={{ fontFamily: 'var(--font-display)' }}>
          Simulador Geopolítico Digital
        </p>
      </div>

      {/* "Ativar som" — shown before first interaction */}
      {!initialized && (
        <button
          onClick={handleActivateSound}
          className="flex items-center gap-2 mb-6 px-4 py-2 rounded-md border border-primary/40 text-primary/80 text-xs uppercase tracking-widest hover:bg-primary/10 transition-colors active:scale-[0.97] animate-pulse"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <Volume2 size={14} />
          Ativar som
        </button>
      )}

      {/* Step: main menu */}
      {step === 'menu' && (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => setStep('superpower')}
            className="w-full py-4 px-6 bg-primary text-primary-foreground font-semibold uppercase tracking-wider text-sm rounded-md hover:opacity-90 transition-opacity active:scale-[0.97]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Nova Partida
          </button>
          <button
            onClick={() => setLocation('/lobby')}
            className="w-full py-4 px-6 bg-secondary text-secondary-foreground font-semibold uppercase tracking-wider text-sm rounded-md hover:opacity-90 transition-opacity active:scale-[0.97]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Jogar Online
          </button>
          {hasSave && (
            <button
              onClick={handleContinue}
              className="w-full py-4 px-6 bg-secondary text-secondary-foreground font-semibold uppercase tracking-wider text-sm rounded-md hover:opacity-90 transition-opacity active:scale-[0.97]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Continuar
            </button>
          )}
          <button
            onClick={handleImport}
            className="w-full py-3 px-6 border border-border text-muted-foreground font-medium uppercase tracking-wider text-xs rounded-md hover:bg-secondary transition-colors active:scale-[0.97]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Importar Jogo
          </button>
        </div>
      )}

      {/* Step: choose superpower */}
      {step === 'superpower' && (
        <div className="w-full max-w-sm">
          <h2 className="text-lg font-semibold text-center mb-4 uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
            Escolha sua Superpotência
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {Object.values(SUPERPOWERS).map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelectSuperpower(s.id)}
                className="p-4 rounded-md border border-border hover:border-primary/50 transition-all active:scale-[0.97] text-left"
                style={{ borderLeftColor: s.color, borderLeftWidth: '4px' }}
              >
                <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: s.color, fontFamily: 'var(--font-display)' }}>
                  {s.shortName}
                </span>
                <span className="text-xs text-muted-foreground mt-1 block">
                  {s.name}
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setStep('menu')}
            className="mt-4 w-full py-2 text-xs text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Voltar
          </button>
        </div>
      )}

      {/* Step: choose AI count */}
      {step === 'ai_count' && sp && (
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sp.color }} />
            <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: sp.color, fontFamily: 'var(--font-display)' }}>
              {sp.shortName} — {sp.name}
            </span>
          </div>

          <h2 className="text-lg font-semibold text-center mb-2 uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
            Quantos oponentes IA?
          </h2>
          <p className="text-xs text-muted-foreground text-center mb-6">
            Mínimo 1 — Máximo {maxAi}
          </p>

          <div className="flex justify-center gap-2 mb-6">
            {Array.from({ length: maxAi }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => setAiCount(n)}
                className={`w-11 h-11 rounded-md text-sm font-bold transition-all active:scale-[0.9] ${
                  aiCount === n
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="bg-secondary/50 rounded-lg p-4 mb-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Jogadores ativos</span>
              <span className="font-semibold text-foreground">
                {1 + aiCount} de {SUPERPOWER_IDS.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Superpotências neutras</span>
              <span className="font-semibold text-foreground">
                {SUPERPOWER_IDS.length - 1 - aiCount}
              </span>
            </div>
            <div className="border-t border-border pt-2 text-xs text-muted-foreground">
              Territórios de superpotências inativas ficam virgens — conquistáveis durante a partida.
            </div>
          </div>

          {/* Dificuldade da IA — aplicada a todas as IAs da partida */}
          <h2 className="text-lg font-semibold text-center mb-1 uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
            Dificuldade da IA
          </h2>
          <p className="text-xs text-muted-foreground text-center mb-3">
            A IA joga com as mesmas regras — muda só a qualidade das decisões.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {(Object.keys(AI_DIFFICULTY_LABELS) as AIDifficulty[]).map(level => {
              const info = AI_DIFFICULTY_LABELS[level];
              const active = aiDifficulty === level;
              return (
                <button
                  key={level}
                  onClick={() => setAiDifficulty(level)}
                  className={`p-3 rounded-md border text-left transition-all active:scale-[0.97] ${
                    active ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'
                  }`}
                >
                  <span className={`text-xs font-bold uppercase tracking-wider block ${active ? 'text-primary' : 'text-foreground'}`} style={{ fontFamily: 'var(--font-display)' }}>
                    {info.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-1 block leading-tight">
                    {info.hint}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Modo de mercado */}
          <h2 className="text-lg font-semibold text-center mb-1 uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
            Modo de Mercado
          </h2>
          <p className="text-xs text-muted-foreground text-center mb-3">
            Como funcionam preços e vendas na partida.
          </p>
          <div className="grid grid-cols-1 gap-2 mb-6">
            {MARKET_MODES.map(mode => {
              const active = marketMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setMarketMode(mode.id)}
                  className={`p-3 rounded-md border text-left transition-all active:scale-[0.98] ${
                    active ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'
                  }`}
                >
                  <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${active ? 'text-primary' : 'text-foreground'}`} style={{ fontFamily: 'var(--font-display)' }}>
                    {mode.label}
                    {mode.id === RULES.DEFAULT_MARKET_MODE && (
                      <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded normal-case tracking-normal">Padrão</span>
                    )}
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-1 block leading-tight">
                    {mode.hint}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleStartGame}
            className="w-full py-4 px-6 bg-primary text-primary-foreground font-semibold uppercase tracking-wider text-sm rounded-md hover:opacity-90 transition-opacity active:scale-[0.97] mb-3"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Iniciar Partida
          </button>
          <button
            onClick={() => setStep('superpower')}
            className="w-full py-2 text-xs text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Voltar
          </button>
        </div>
      )}

      {/* Footer */}
      <p className="mt-12 text-xs text-muted-foreground/50 text-center">
        Protótipo interno — 1 humano vs 1–{maxAi} CPUs
      </p>
    </div>
  );
}
