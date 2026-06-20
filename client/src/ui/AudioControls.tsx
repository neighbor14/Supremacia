import { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Music, Zap, ZapOff } from 'lucide-react';
import { useAudioControls } from '../hooks/useAudio';

export default function AudioControls() {
  const {
    masterMuted,
    musicEnabled,
    sfxEnabled,
    musicVol,
    sfxVol,
    toggleMasterMute,
    toggleMusic,
    toggleSfx,
    changeMusicVolume,
    changeSfxVolume,
  } = useAudioControls();

  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click/touch
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const anyDisabled = masterMuted || !musicEnabled || !sfxEnabled;

  return (
    <div ref={panelRef} className="absolute top-2 right-2 z-20 flex flex-col items-end gap-1">

      {/* Expanded panel */}
      {open && (
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 flex flex-col gap-3 shadow-lg animate-in slide-in-from-right-2 duration-200 w-44">

          {/* Master mute row */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              {masterMuted ? 'Mudo' : 'Ativo'}
            </span>
            <button
              onClick={toggleMasterMute}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors active:scale-95 ${
                masterMuted
                  ? 'bg-destructive/20 text-destructive'
                  : 'bg-primary/20 text-primary'
              }`}
            >
              {masterMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              {masterMuted ? 'Ligar' : 'Mutar'}
            </button>
          </div>

          <div className="border-t border-border/50" />

          {/* Music row */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Music size={10} />
                Música
              </span>
              <button
                onClick={toggleMusic}
                disabled={masterMuted}
                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold transition-colors active:scale-95 disabled:opacity-40 ${
                  musicEnabled
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {musicEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(musicVol * 100)}
              onChange={(e) => changeMusicVolume(parseInt(e.target.value) / 100)}
              disabled={masterMuted || !musicEnabled}
              className="w-full h-1 accent-primary cursor-pointer disabled:opacity-40"
            />
            <span className="text-[9px] font-mono text-muted-foreground text-right">
              {Math.round(musicVol * 100)}%
            </span>
          </div>

          <div className="border-t border-border/50" />

          {/* SFX row */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {sfxEnabled ? <Zap size={10} /> : <ZapOff size={10} />}
                Efeitos
              </span>
              <button
                onClick={toggleSfx}
                disabled={masterMuted}
                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold transition-colors active:scale-95 disabled:opacity-40 ${
                  sfxEnabled
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {sfxEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(sfxVol * 100)}
              onChange={(e) => changeSfxVolume(parseInt(e.target.value) / 100)}
              disabled={masterMuted || !sfxEnabled}
              className="w-full h-1 accent-primary cursor-pointer disabled:opacity-40"
            />
            <span className="text-[9px] font-mono text-muted-foreground text-right">
              {Math.round(sfxVol * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-7 h-7 rounded-md backdrop-blur-sm border flex items-center justify-center transition-colors active:scale-95 ${
          anyDisabled
            ? 'bg-card/80 border-destructive/50 text-destructive/70 hover:text-destructive'
            : 'bg-card/80 border-border text-muted-foreground hover:text-foreground'
        }`}
        title="Controles de áudio"
      >
        {masterMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
    </div>
  );
}
