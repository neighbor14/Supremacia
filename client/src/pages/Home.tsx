import { useLocation } from 'wouter';
import { useGameStore } from '../game/store';
import { SuperpowerId } from '../game/types';
import { SUPERPOWERS } from '../data/initialPlayers';
import { useState } from 'react';
import { GameState } from '../game/types';

export default function Home() {
  const [, setLocation] = useLocation();
  const { startGame, loadGame } = useGameStore();
  const [showSuperpowerSelect, setShowSuperpowerSelect] = useState(false);

  const hasSave = !!localStorage.getItem('supremacia_save');

  const handleNewGame = () => setShowSuperpowerSelect(true);

  const handleSelectSuperpower = (id: SuperpowerId) => {
    startGame(id);
    setLocation('/setup');
  };

  const handleContinue = () => {
    const save = localStorage.getItem('supremacia_save');
    if (save) {
      const state = JSON.parse(save) as GameState;
      loadGame(state);
      setLocation('/game');
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      {/* Logo / Title */}
      <div className="text-center mb-12">
        <div className="w-20 h-20 mx-auto mb-6 relative">
          <svg viewBox="0 0 80 80" className="w-full h-full">
            <polygon points="40,4 72,22 72,58 40,76 8,58 8,22" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" />
            <polygon points="40,12 64,26 64,54 40,68 16,54 16,26" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground" />
            <line x1="40" y1="4" x2="40" y2="76" stroke="currentColor" strokeWidth="0.5" className="text-border" />
            <line x1="8" y1="40" x2="72" y2="40" stroke="currentColor" strokeWidth="0.5" className="text-border" />
            <line x1="8" y1="22" x2="72" y2="58" stroke="currentColor" strokeWidth="0.5" className="text-border" />
            <line x1="72" y1="22" x2="8" y2="58" stroke="currentColor" strokeWidth="0.5" className="text-border" />
          </svg>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
          SUPREMACIA
        </h1>
        <p className="text-sm text-muted-foreground mt-2 tracking-widest uppercase" style={{ fontFamily: 'var(--font-display)' }}>
          Simulador Geopolítico Digital
        </p>
      </div>

      {/* Menu */}
      {!showSuperpowerSelect ? (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={handleNewGame}
            className="w-full py-4 px-6 bg-primary text-primary-foreground font-semibold uppercase tracking-wider text-sm rounded-md hover:opacity-90 transition-opacity active:scale-[0.97]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Nova Partida
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
      ) : (
        <div className="w-full max-w-sm">
          <h2 className="text-lg font-semibold text-center mb-4 uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
            Escolha sua Superpotência
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {Object.values(SUPERPOWERS).map((sp) => (
              <button
                key={sp.id}
                onClick={() => handleSelectSuperpower(sp.id)}
                className="p-4 rounded-md border border-border hover:border-primary/50 transition-all active:scale-[0.97] text-left"
                style={{ borderLeftColor: sp.color, borderLeftWidth: '4px' }}
              >
                <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: sp.color, fontFamily: 'var(--font-display)' }}>
                  {sp.shortName}
                </span>
                <span className="text-xs text-muted-foreground mt-1 block">
                  {sp.name}
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowSuperpowerSelect(false)}
            className="mt-4 w-full py-2 text-xs text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Voltar
          </button>
        </div>
      )}

      {/* Footer */}
      <p className="mt-12 text-xs text-muted-foreground/50 text-center">
        Protótipo interno — 1 humano vs 5 CPUs
      </p>
    </div>
  );
}
