import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useAudioControls } from '../hooks/useAudio';

export default function AudioControls() {
  const { volume, muted, changeVolume, toggleMute } = useAudioControls();
  const [showSlider, setShowSlider] = useState(false);

  return (
    <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
      {showSlider && (
        <div className="bg-card/90 backdrop-blur-sm border border-border rounded-md px-2 py-1 flex items-center gap-2 animate-in slide-in-from-right-2 duration-200">
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(volume * 100)}
            onChange={(e) => changeVolume(parseInt(e.target.value) / 100)}
            className="w-16 h-1 accent-primary cursor-pointer"
          />
          <span className="text-[9px] font-mono-num text-muted-foreground w-6">
            {Math.round(volume * 100)}%
          </span>
        </div>
      )}
      <button
        onClick={toggleMute}
        onDoubleClick={() => setShowSlider(!showSlider)}
        className="w-7 h-7 rounded-md bg-card/80 backdrop-blur-sm border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors active:scale-95"
        title={muted ? 'Ativar som' : 'Silenciar (duplo-clique para volume)'}
      >
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
    </div>
  );
}
