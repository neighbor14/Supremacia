import { useState, useEffect } from 'react';
import { useGameStore } from '../game/store';
import { HelpCircle, X, ChevronDown, ChevronUp } from 'lucide-react';

interface TutorialEntry {
  title: string;
  icon: string;
  description: string;
  action: string;
  tip: string;
}

const TUTORIALS: Record<number, TutorialEntry> = {
  1: {
    title: 'Fase de Salários',
    icon: '💰',
    description: 'Pague os salários das suas tropas. Cada exército custa $1.000 por turno. Se não tiver dinheiro suficiente, tropas desertam.',
    action: 'Toque no botão "Salários" na barra de fases para pagar automaticamente.',
    tip: 'Mantenha sempre uma reserva de dinheiro para não perder tropas!',
  },
  2: {
    title: 'Fase de Produção',
    icon: '⚙️',
    description: 'Seus territórios produzem recursos automaticamente. Cada território produz 1 unidade do recurso que possui (cereal, petróleo ou minério).',
    action: 'Toque no botão "Produção" para coletar os recursos.',
    tip: 'Territórios destruídos por bomba nuclear não produzem nada.',
  },
  3: {
    title: 'Fase de Vender (Opcional)',
    icon: '📈',
    description: 'Venda recursos no mercado por dinheiro. Os preços flutuam conforme oferta e demanda.',
    action: 'Use o painel do mercado na parte inferior para vender recursos.',
    tip: 'Venda quando os preços estão altos! Observe as tendências do mercado.',
  },
  4: {
    title: 'Fase de Ataque (Opcional)',
    icon: '⚔️',
    description: 'Ataque territórios inimigos adjacentes. Precisa de pelo menos 2 exércitos no território de origem (1 fica para defender).',
    action: 'Toque em um território seu com 2+ exércitos, depois escolha o alvo.',
    tip: 'Cada batalha consome 1 de cada suprimento. Atacar custa recursos!',
  },
  5: {
    title: 'Fase de Movimento (Opcional)',
    icon: '🚀',
    description: 'Mova exércitos entre territórios adjacentes que você controla. Cada movimento custa 1 cereal.',
    action: 'Toque em um território com exércitos e escolha o destino adjacente.',
    tip: 'Posicione tropas estrategicamente perto de fronteiras inimigas.',
  },
  6: {
    title: 'Fase de Construção (Opcional)',
    icon: '🏗️',
    description: 'Construa novos exércitos, pesquise bombas nucleares ou Laser-Stars. Custo: $1.000 + 1 set de suprimentos por 3 unidades.',
    action: 'Use o painel de construção para criar unidades nos seus territórios.',
    tip: 'Pesquisar tecnologia nuclear custa $2.000 mas dá poder de destruição massiva.',
  },
  7: {
    title: 'Fase de Comprar (Opcional)',
    icon: '🛒',
    description: 'Compre recursos no mercado. Útil quando precisa de suprimentos para mover, atacar ou construir.',
    action: 'Use o painel do mercado na parte inferior para comprar recursos.',
    tip: 'Compre quando os preços estão baixos para economizar dinheiro.',
  },
};

const GENERAL_RULES = [
  'Você tem 2 fases obrigatórias (Salários + Produção) e pode usar até 3 das 5 fases opcionais.',
  'Condição de vitória: controlar 12+ territórios, OU ter mais riqueza total quando Détente é declarado.',
  'Se muitos territórios forem destruídos por bombas nucleares, ocorre Holocausto Nuclear e todos perdem.',
  'Laser-Stars podem interceptar bombas nucleares (50% de chance por estrela).',
  'O mercado é compartilhado — quando alguém vende muito, o preço cai para todos.',
];

export default function TurnTutorial() {
  const { game } = useGameStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [lastStage, setLastStage] = useState(0);
  const [pulse, setPulse] = useState(false);

  // Pulse animation when stage changes
  useEffect(() => {
    if (game && game.turn.stage !== lastStage) {
      setLastStage(game.turn.stage);
      const currentPlayer = game.players[game.turn.currentPlayer];
      if (currentPlayer.isHuman) {
        setPulse(true);
        const timer = setTimeout(() => setPulse(false), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [game?.turn.stage, game?.turn.currentPlayer]);

  if (!game) return null;

  const currentPlayer = game.players[game.turn.currentPlayer];
  if (!currentPlayer.isHuman) return null;

  const tutorial = TUTORIALS[game.turn.stage];
  if (!tutorial) return null;

  return (
    <>
      {/* Floating help button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          absolute top-2 left-3 z-20 w-9 h-9 rounded-full flex items-center justify-center
          bg-card/90 backdrop-blur-sm border border-border shadow-lg
          hover:bg-card active:scale-[0.93] transition-all
          ${pulse ? 'animate-pulse ring-2 ring-primary/60' : ''}
        `}
        aria-label="Ajuda do turno"
      >
        <HelpCircle size={18} className="text-primary" />
      </button>

      {/* Tutorial panel */}
      {isOpen && (
        <div className="absolute top-12 left-3 right-14 z-20 max-w-sm animate-in slide-in-from-top-2 duration-200">
          <div className="bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-primary/10">
              <div className="flex items-center gap-2">
                <span className="text-lg">{tutorial.icon}</span>
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
                  {tutorial.title}
                </h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="px-3 py-2.5 space-y-2">
              <p className="text-xs text-foreground leading-relaxed">
                {tutorial.description}
              </p>
              <div className="bg-primary/5 border border-primary/20 rounded px-2 py-1.5">
                <p className="text-[11px] text-primary font-medium">
                  ▶ {tutorial.action}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                💡 {tutorial.tip}
              </p>
            </div>

            {/* General rules toggle */}
            <div className="border-t border-border">
              <button
                onClick={() => setShowRules(!showRules)}
                className="w-full flex items-center justify-between px-3 py-2 text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-wider"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <span>Regras Gerais</span>
                {showRules ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showRules && (
                <div className="px-3 pb-3 space-y-1.5">
                  {GENERAL_RULES.map((rule, i) => (
                    <p key={i} className="text-[10px] text-muted-foreground leading-relaxed flex gap-1.5">
                      <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                      <span>{rule}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
