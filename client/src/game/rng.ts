// ============================================================
// SUPREMACIA DIGITAL — Random Number Generator utilities
// Seeded RNG for reproducibility in multiplayer future
// ============================================================

export function rollDice(count: number): number[] {
  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    results.push(Math.floor(Math.random() * 6) + 1);
  }
  return results;
}

export function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function sumDice(dice: number[]): number {
  return dice.reduce((a, b) => a + b, 0);
}

export function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
