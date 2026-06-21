import { GameState, SuperpowerId } from './types';

export type CompanyOpportunity = 'own' | 'neutral' | 'foreign';

function priority(opp: CompanyOpportunity): number {
  return opp === 'own' ? 3 : opp === 'neutral' ? 2 : 1;
}

/**
 * Returns a map from territoryId → opportunity tier for the given player,
 * derived solely from their resource cards + the public map state.
 *
 * 'own'     — player controls the territory AND has a company card there
 * 'neutral' — territory is uncontrolled; player has a company card there
 * 'foreign' — an opponent controls the territory; player has a company card there
 *
 * When a player holds multiple cards for the same territory the highest tier wins.
 * This function must NEVER be called with another player's id in a multiplayer
 * context — pass only the current human player's own id.
 */
export function getCompanyOpportunities(
  game: GameState,
  playerId: SuperpowerId,
): Map<string, CompanyOpportunity> {
  const player = game.players[playerId];
  const result = new Map<string, CompanyOpportunity>();

  for (const cardId of player.resourceCards) {
    const card = game.resourceCards[cardId];
    if (!card?.territoryId) continue;
    const territory = game.territories[card.territoryId];
    if (!territory) continue;

    const opp: CompanyOpportunity =
      territory.owner === playerId ? 'own'
      : territory.owner === null   ? 'neutral'
      : 'foreign';

    const existing = result.get(card.territoryId);
    if (!existing || priority(opp) > priority(existing)) {
      result.set(card.territoryId, opp);
    }
  }

  return result;
}
