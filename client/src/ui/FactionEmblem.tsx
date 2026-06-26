import { useState } from 'react';
import type { SuperpowerId } from '../game/types';
import { SUPERPOWERS } from '../data/initialPlayers';

/**
 * FactionEmblem — brasão circular da superpotência.
 *
 * Camada puramente visual: a arte (PNG gerada via OpenRouter/Gemini, ver CLAUDE.md)
 * vive em /art/emblems/<id>.png. Se o arquivo faltar ou falhar ao carregar, cai
 * graciosamente para um disco na cor da facção — nunca quebra a UI nem inventa
 * mecânica. Identidade/cor vêm sempre de SUPERPOWERS (fonte de verdade).
 */
export default function FactionEmblem({
  id,
  size = 48,
  className = '',
  ring = true,
}: {
  id: SuperpowerId;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const color = SUPERPOWERS[id]?.color ?? '#64748b';

  const ringStyle = ring
    ? { boxShadow: `0 0 0 1.5px ${color}55, 0 2px 8px rgba(0,0,0,0.45)` }
    : undefined;

  if (failed) {
    // Fallback: disco na cor da facção (comportamento antigo, garante que nada some).
    return (
      <span
        className={`inline-block rounded-full shrink-0 ${className}`}
        style={{ width: size, height: size, backgroundColor: color, ...ringStyle }}
        aria-hidden
      />
    );
  }

  return (
    <img
      src={`/art/emblems/${id}.png`}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`inline-block rounded-full shrink-0 object-cover ${className}`}
      style={{ width: size, height: size, ...ringStyle }}
      draggable={false}
    />
  );
}
