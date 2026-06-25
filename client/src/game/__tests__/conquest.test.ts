import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, getMoveBlockReason, companiesInTerritory } from '../store';
import { createInitialGameState } from '../setup';
import { TERRITORIES } from '../../data/territories';
import { SEA_ZONES } from '../../data/seaZones';
import { generateResourceCards } from '../../data/resourceCards';
import type { GameState, SuperpowerId } from '../types';
import { useI18nStore } from '../../i18n/useI18n';

const ALL: SuperpowerId[] = ['south_america', 'africa', 'europe', 'china', 'usa', 'ussr'];

/** Build a game where `human` is the active player at the given stage, then load it. */
function setupGame(human: SuperpowerId = 'usa', stage = 5): GameState {
  const ais = ALL.filter(id => id !== human);
  const game = createInitialGameState(human, ais);
  // Force the human to be the current player so dispatch acts on them.
  game.turn.currentPlayer = human;
  game.turn.currentPlayerIndex = game.turn.playerOrder.indexOf(human);
  game.turn.stage = stage as GameState['turn']['stage'];
  game.turn.isFirstTurn = false;
  return game;
}

function load(game: GameState) {
  useGameStore.setState({ game, selectedTerritory: null, selectedSeaZone: null, uiMode: 'map' });
}
const g = () => useGameStore.getState().game!;
const dispatch = (a: Parameters<ReturnType<typeof useGameStore.getState>['dispatch']>[0]) =>
  useGameStore.getState().dispatch(a);

beforeEach(() => {
  useGameStore.setState({ game: null });
});

// ============================================================
// Dataset audit (Parte 3 / Parte 7)
// ============================================================
describe('dataset audit', () => {
  it('every territory has a unique id matching its key', () => {
    const ids = new Set<string>();
    for (const [key, t] of Object.entries(TERRITORIES)) {
      expect(t.id).toBe(key);
      expect(t.name?.length).toBeGreaterThan(0);
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
    }
    expect(ids.size).toBe(40);
  });

  it('central_america is a land territory and caribbean is a separate sea zone', () => {
    expect(TERRITORIES['central_america']).toBeTruthy();
    expect(TERRITORIES['central_america'].adjacentSeas).toContain('caribbean');
    // Caribbean must NOT be a territory and central_america must NOT be a sea zone.
    expect((SEA_ZONES as Record<string, unknown>)['central_america']).toBeUndefined();
    expect((TERRITORIES as Record<string, unknown>)['caribbean']).toBeUndefined();
    expect(SEA_ZONES['caribbean']).toBeTruthy();
  });

  it('key conquerable territories exist (central_america, central_africa, south_africa)', () => {
    for (const id of ['central_america', 'central_africa', 'south_africa', 'north_africa', 'chile']) {
      expect(TERRITORIES[id]).toBeTruthy();
    }
  });

  it('every company card references an existing territory and a valid resource', () => {
    const valid = new Set(['grain', 'oil', 'mineral']);
    for (const c of generateResourceCards()) {
      expect(TERRITORIES[c.territoryId], `card ${c.id} → ${c.territoryId}`).toBeTruthy();
      expect(valid.has(c.type)).toBe(true);
      expect(c.production).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// Conquest by move — neutral territory (Parte 4 / Parte 5)
// ============================================================
describe('conquering a neutral territory by moving in', () => {
  it('central_america changes owner & color-source when a USA army moves in', () => {
    const game = setupGame('usa');
    const usa = game.players.usa;
    usa.armies = { eastern_usa: 2 };
    usa.supplies.grain = 5;
    expect(game.territories.central_america.owner).toBeNull();
    load(game);

    dispatch({ type: 'MOVE_ARMY', from: 'eastern_usa', to: 'central_america', count: 1 });

    // ownerId is the single source the map colour derives from.
    expect(g().territories.central_america.owner).toBe('usa');
    expect(g().players.usa.armies.central_america).toBe(1);
    // grain consumed
    expect(g().players.usa.supplies.grain).toBe(4);
  });

  it('central_africa behaves the same as central_america (no land/sea confusion)', () => {
    const game = setupGame('africa');
    // africa already owns central_africa; test claiming a neutral neighbour the
    // same way América Central is claimed — north_africa from west_africa.
    const af = game.players.africa;
    af.armies = { west_africa: 2 };
    af.supplies.grain = 5;
    expect(game.territories.north_africa.owner).toBeNull();
    load(game);

    dispatch({ type: 'MOVE_ARMY', from: 'west_africa', to: 'north_africa', count: 1 });
    expect(g().territories.north_africa.owner).toBe('africa');
  });

  it('does not grant a company just for controlling the territory', () => {
    const game = setupGame('usa');
    game.players.usa.armies = { eastern_usa: 2 };
    game.players.usa.supplies.grain = 5;
    const before = game.players.usa.resourceCards.length;
    load(game);
    dispatch({ type: 'MOVE_ARMY', from: 'eastern_usa', to: 'central_america', count: 1 });
    expect(g().players.usa.resourceCards.length).toBe(before); // no auto company
  });
});

// ============================================================
// Movement cost / blocking (Parte 6)
// ============================================================
describe('movement consumes cereal and blocks with a reason', () => {
  it('getMoveBlockReason returns no_grain at 0 cereal, null when affordable', () => {
    const game = setupGame('usa');
    game.players.usa.armies = { eastern_usa: 2 };
    game.players.usa.supplies.grain = 0;
    load(game);
    expect(getMoveBlockReason(g(), 'eastern_usa', 'central_america')).toBe('no_grain');

    g().players.usa.supplies.grain = 1;
    expect(getMoveBlockReason(g(), 'eastern_usa', 'central_america')).toBeNull();
  });

  it('a 0-cereal move is rejected (owner unchanged) and logged', () => {
    // As mensagens do motor são i18n; fixa pt para asserir o texto de forma determinística.
    useI18nStore.setState({ lang: 'pt' });
    const game = setupGame('usa');
    game.players.usa.armies = { eastern_usa: 2 };
    game.players.usa.supplies.grain = 0;
    load(game);
    dispatch({ type: 'MOVE_ARMY', from: 'eastern_usa', to: 'central_america', count: 1 });
    expect(g().territories.central_america.owner).toBeNull();
    expect(g().players.usa.armies.central_america).toBeUndefined();
    const log = g().eventLog.map(e => e.message).join(' | ');
    expect(log.toLowerCase()).toContain('cereal');
  });

  it('enemy-held territory cannot be entered by a plain move', () => {
    const game = setupGame('usa');
    game.players.usa.armies = { eastern_usa: 2 };
    game.players.usa.supplies.grain = 5;
    // Pretend central_america is held by africa with a garrison.
    game.territories.central_america.owner = 'africa';
    game.players.africa.armies = { ...game.players.africa.armies, central_america: 1 };
    load(game);
    expect(getMoveBlockReason(g(), 'eastern_usa', 'central_america')).toBe('enemy_held');
  });
});

// ============================================================
// Production comes from companies, not territories (Parte 2)
// ============================================================
describe('production derives from owned companies only', () => {
  it('transfer adds exactly the sum of owned revealed card production', () => {
    const game = setupGame('usa', 2);
    const usa = game.players.usa;
    usa.supplies = { grain: 0, oil: 0, mineral: 0 };
    // Keep only one known grain company (+3).
    const grainCard = Object.values(game.resourceCards).find(
      c => c.ownerId === 'usa' && c.type === 'grain'
    )!;
    usa.resourceCards = [grainCard.id];
    // Owning an extra company-less territory must NOT add production.
    game.territories.central_america.owner = 'usa';
    load(game);

    dispatch({ type: 'TRANSFER_PRODUCTION' });
    expect(g().players.usa.supplies.grain).toBe(grainCard.production);
    expect(g().players.usa.supplies.oil).toBe(0);
    expect(g().players.usa.supplies.mineral).toBe(0);
  });
});

// ============================================================
// Prospecting reveals real cards from the deck (Parte 2 / Parte 3)
// ============================================================
describe('prospecting', () => {
  it('untargeted prospect acquires the top resource card of the deck', () => {
    const game = setupGame('usa', 7);
    const topId = game.resourceDeck.find(id => game.resourceCards[id]); // first real card
    // Move it to the very top.
    game.resourceDeck = [topId!, ...game.resourceDeck.filter(id => id !== topId)];
    game.players.usa.money = 50000;
    const before = g => g.players.usa.resourceCards.length;
    load(game);
    const n0 = before(g());

    dispatch({ type: 'PROSPECT', cardId: '' });
    expect(g().players.usa.resourceCards.length).toBe(n0 + 1);
    expect(g().resourceCards[topId!].ownerId).toBe('usa');
    expect(g().players.usa.resourceCards).toContain(topId);
  });

  it('targeted prospect by resource type returns a company of that type', () => {
    const game = setupGame('usa', 7);
    game.players.usa.money = 80000;
    // Ensure at least one mineral company is in the deck.
    const mineralInDeck = game.resourceDeck.find(id => game.resourceCards[id]?.type === 'mineral');
    expect(mineralInDeck).toBeTruthy();
    load(game);

    dispatch({ type: 'PROSPECT', cardId: '', resourceType: 'mineral' });
    const drawn = g().drawnCard;
    expect(drawn?.active).toBe(true);
    if (drawn?.success) {
      const newCardId = g().players.usa.resourceCards.find(id => g().resourceCards[id]?.type === 'mineral' && g().resourceCards[id]?.ownerId === 'usa');
      expect(newCardId).toBeTruthy();
      expect(g().resourceCards[newCardId!].type).toBe('mineral');
    }
  });

  it('rejects an untargeted card whose territory is enemy-occupied (returns to deck, refunds)', () => {
    const game = setupGame('usa', 7);
    game.players.usa.money = 50000;
    // Pick a real company card and put it on top; give its territory to an enemy.
    const card = Object.values(game.resourceCards).find(c => game.resourceDeck.includes(c.id))!;
    game.territories[card.territoryId].owner = 'china';
    game.resourceDeck = [card.id, ...game.resourceDeck.filter(id => id !== card.id)];
    const moneyBefore = game.players.usa.money;
    const handBefore = game.players.usa.resourceCards.length;
    load(game);

    dispatch({ type: 'PROSPECT', cardId: '' });
    // Not acquired, money refunded, card back in the deck.
    expect(g().players.usa.resourceCards.length).toBe(handBefore);
    expect(g().resourceCards[card.id].ownerId).toBeNull();
    expect(g().players.usa.money).toBe(moneyBefore);
    expect(g().resourceDeck).toContain(card.id);
  });

  it('targeted prospect skips a matching card in enemy territory and keeps a valid one', () => {
    const game = setupGame('usa', 7);
    game.players.usa.money = 200000;
    const grainCards = Object.values(game.resourceCards).filter(
      c => c.type === 'grain' && game.resourceDeck.includes(c.id)
    );
    expect(grainCards.length).toBeGreaterThanOrEqual(2);
    // First grain company sits in enemy land; it must NOT be the one acquired.
    const enemyGrain = grainCards[0];
    game.territories[enemyGrain.territoryId].owner = 'ussr';
    load(game);

    dispatch({ type: 'PROSPECT', cardId: '', resourceType: 'grain' });
    const acquired = g().players.usa.resourceCards
      .map(id => g().resourceCards[id])
      .find(c => c?.type === 'grain' && c.ownerId === 'usa');
    if (acquired) {
      // Whatever grain company was acquired must not be one in enemy-held land.
      expect(g().territories[acquired.territoryId].owner === 'ussr').toBe(false);
    }
    // The enemy-held grain company stays unowned in the deck.
    expect(g().resourceCards[enemyGrain.id].ownerId).toBeNull();
  });

  it('no card is duplicated between deck and a player hand', () => {
    const game = setupGame('usa', 7);
    load(game);
    const deck = new Set(g().resourceDeck);
    for (const p of Object.values(g().players)) {
      for (const cid of p.resourceCards) {
        expect(deck.has(cid), `card ${cid} in both deck and ${p.id} hand`).toBe(false);
      }
    }
  });
});

// ============================================================
// Salary gating: unpaid companies go dormant (manual Grow)
// ============================================================
describe('salary gating', () => {
  it('pays best producers first; underfunded companies do not produce that turn', () => {
    const game = setupGame('usa', 1);
    const usa = game.players.usa;
    usa.armies = {}; usa.navies = {}; usa.embarked = {}; usa.loans = 0;
    // Three owned companies with distinct productions/types.
    const owned = Object.values(game.resourceCards).filter(c => c.ownerId === 'usa' && c.revealed).slice(0, 3);
    expect(owned.length).toBe(3);
    owned[0].production = 3; owned[0].type = 'grain';
    owned[1].production = 2; owned[1].type = 'oil';
    owned[2].production = 1; owned[2].type = 'mineral';
    usa.resourceCards = owned.map(c => c.id);
    usa.supplies = { grain: 0, oil: 0, mineral: 0 };
    usa.money = 1000; // pays exactly 2 of 3 companies (500 each), no units/interest
    load(game);

    dispatch({ type: 'PAY_SALARIES' });
    // The lowest producer (mineral, +1) is the one left dormant.
    expect(g().turn.unpaidCompanies).toEqual([owned[2].id]);
    expect(g().players.usa.money).toBe(0);

    dispatch({ type: 'TRANSFER_PRODUCTION' });
    expect(g().players.usa.supplies.grain).toBe(3); // paid
    expect(g().players.usa.supplies.oil).toBe(2);   // paid
    expect(g().players.usa.supplies.mineral).toBe(0); // dormant → no production
  });

  it('with enough money no company is dormant and all produce', () => {
    const game = setupGame('usa', 1);
    const usa = game.players.usa;
    usa.armies = {}; usa.navies = {}; usa.embarked = {}; usa.loans = 0;
    usa.supplies = { grain: 0, oil: 0, mineral: 0 };
    usa.money = 100000;
    load(game);

    dispatch({ type: 'PAY_SALARIES' });
    expect(g().turn.unpaidCompanies).toEqual([]);
    dispatch({ type: 'TRANSFER_PRODUCTION' });
    const total = g().players.usa.supplies.grain + g().players.usa.supplies.oil + g().players.usa.supplies.mineral;
    expect(total).toBeGreaterThan(0);
  });
});

// ============================================================
// Company capture on conquest (Parte 2 / Parte 3)
// ============================================================
describe('company capture on combat conquest', () => {
  it('capturing a territory transfers its company to the attacker', () => {
    const game = setupGame('usa', 4);
    // USA holds a beachhead in west_africa; africa holds central_africa with a company.
    game.territories.west_africa.owner = 'usa';
    game.players.usa.armies = { west_africa: 6 };
    game.players.usa.supplies = { grain: 3, oil: 3, mineral: 3 };
    // Defender has no garrison and no supplies → defends weakly, attacker survives.
    game.players.africa.armies = {};
    game.players.africa.supplies = { grain: 0, oil: 0, mineral: 0 };
    const congo = Object.values(game.resourceCards).find(
      c => c.territoryId === 'central_africa' && c.ownerId === 'africa'
    )!;
    expect(congo).toBeTruthy();
    load(game);

    dispatch({ type: 'ATTACK_TERRITORY', from: 'west_africa', target: 'central_africa' });
    expect(g().combat.active).toBe(true);
    dispatch({ type: 'ROLL_COMBAT' });
    // With 6 vs 0 the attacker always survives → occupy phase is reachable.
    expect(g().combat.phase).toBe('occupy');
    dispatch({ type: 'OCCUPY_TERRITORY', count: 1 });

    expect(g().territories.central_africa.owner).toBe('usa');
    expect(g().resourceCards[congo.id].ownerId).toBe('usa');
    expect(g().players.usa.resourceCards).toContain(congo.id);
    expect(g().players.africa.resourceCards).not.toContain(congo.id);
  });
});
