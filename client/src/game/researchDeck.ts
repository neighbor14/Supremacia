// ============================================================
// SUPREMACIA DIGITAL — Research Deck Service
// Single source of truth for tech card identity and odds
// ============================================================

export function isNukeCard(id: string): boolean {
  return id.startsWith('nuke_');
}

export function isLaserCard(id: string): boolean {
  return id.startsWith('laser_');
}

export function isTechCard(id: string): boolean {
  return isNukeCard(id) || isLaserCard(id);
}

export interface TechCounts {
  nukeCount: number;
  laserCount: number;
  total: number;
}

export function getTechCounts(deck: string[]): TechCounts {
  let nukeCount = 0;
  let laserCount = 0;
  for (const id of deck) {
    if (isNukeCard(id)) nukeCount++;
    else if (isLaserCard(id)) laserCount++;
  }
  return { nukeCount, laserCount, total: deck.length };
}

// Returns probability [0,1] of drawing the target tech card next
export function getResearchOdds(deck: string[], target: 'nuke' | 'laser'): number {
  if (deck.length === 0) return 0;
  const { nukeCount, laserCount } = getTechCounts(deck);
  const count = target === 'nuke' ? nukeCount : laserCount;
  return count / deck.length;
}

export function formatOdds(probability: number): string {
  if (probability <= 0) return '0,00%';
  return (probability * 100).toFixed(2).replace('.', ',') + '%';
}
