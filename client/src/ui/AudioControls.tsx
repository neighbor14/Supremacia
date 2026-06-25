import { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Music, Zap, ZapOff } from 'lucide-react';
import { useAudioControls } from '../hooks/useAudio';
import { useT } from '../i18n/useI18n';

export default function AudioControls() {
  const t = useT();
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click/touch
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const anyDisabled = masterMuted || !musicEnabled || !sfxEnabled;

  return (
    // Container is a tiny anchor — button stays fixed at top-right, panel drops below
    <div ref={containerRef} className="absolute top-2 right-2 z-30" style={{ width: 32 }}>

      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-8 h-8 rounded-lg backdrop-blur-sm border flex items-center justify-center transition-all active:scale-90 ${
          anyDisabled
            ? 'bg-black/70 border-red-500/60 text-red-400'
            : open
            ? 'bg-black/90 border-white/40 text-white'
            : 'bg-black/60 border-white/20 text-white/80 hover:text-white hover:bg-black/80'
        }`}
        title={t('audio.title')}
      >
        {masterMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
      </button>

      {/* Panel — drops BELOW the button, right-aligned */}
      {open && (
        <div
          className="absolute right-0 mt-1.5 w-52 rounded-xl border border-white/20 shadow-2xl p-3 flex flex-col gap-3"
          style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)' }}
        >
          {/* Master mute */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-widest text-white/50 font-semibold">
              {t('audio.sound')}
            </span>
            <button
              onClick={toggleMasterMute}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wide transition-colors active:scale-95 ${
                masterMuted
                  ? 'bg-red-500/30 text-red-400 border border-red-500/40'
                  : 'bg-green-500/20 text-green-400 border border-green-500/30'
              }`}
            >
              {masterMuted ? <VolumeX size={11} /> : <Volume2 size={11} />}
              {masterMuted ? t('audio.muted') : t('audio.on')}
            </button>
          </div>

          <div className="h-px bg-white/10" />

          {/* Music */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] text-white/60">
                <Music size={11} />
                {t('audio.music')}
              </span>
              <button
                onClick={toggleMusic}
                disabled={masterMuted}
                className={`text-[10px] px-2 py-0.5 rounded font-bold tracking-widest transition-colors active:scale-95 disabled:opacity-30 ${
                  musicEnabled
                    ? 'bg-primary/30 text-primary border border-primary/40'
                    : 'bg-white/10 text-white/40 border border-white/10'
                }`}
              >
                {musicEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(musicVol * 100)}
                onChange={e => changeMusicVolume(parseInt(e.target.value) / 100)}
                disabled={masterMuted || !musicEnabled}
                className="flex-1 h-1 accent-primary cursor-pointer disabled:opacity-30"
              />
              <span className="text-[9px] font-mono text-white/40 w-7 text-right">
                {Math.round(musicVol * 100)}%
              </span>
            </div>
          </div>

          <div className="h-px bg-white/10" />

          {/* SFX */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] text-white/60">
                {sfxEnabled ? <Zap size={11} /> : <ZapOff size={11} />}
                {t('audio.effects')}
              </span>
              <button
                onClick={toggleSfx}
                disabled={masterMuted}
                className={`text-[10px] px-2 py-0.5 rounded font-bold tracking-widest transition-colors active:scale-95 disabled:opacity-30 ${
                  sfxEnabled
                    ? 'bg-primary/30 text-primary border border-primary/40'
                    : 'bg-white/10 text-white/40 border border-white/10'
                }`}
              >
                {sfxEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(sfxVol * 100)}
                onChange={e => changeSfxVolume(parseInt(e.target.value) / 100)}
                disabled={masterMuted || !sfxEnabled}
                className="flex-1 h-1 accent-primary cursor-pointer disabled:opacity-30"
              />
              <span className="text-[9px] font-mono text-white/40 w-7 text-right">
                {Math.round(sfxVol * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
