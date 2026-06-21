// ============================================================
// SUPREMACIA DIGITAL — Rules Configuration
// All numeric constants and tunable parameters in one place
// ============================================================

export const RULES = {
  // Economy
  STARTING_MONEY: 70000,
  STARTING_SUPPLIES: 3,
  MAX_SUPPLY: 12,
  MARKET_START_PRICE: 5000,
  MARKET_MIN_PRICE: 10,        // manual Grow: piso $10
  MARKET_MAX_PRICE: 10000,     // manual Grow: teto $10.000
  MARKET_PRICE_STEP: 1000,

  // Salaries (Stage 1)
  SALARY_PER_UNIT: 100,        // per army or navy
  SALARY_PER_COMPANY: 500,     // per resource card

  // Construction (Stage 6)
  UNIT_COST: 1000,             // per army or navy
  UNITS_PER_SUPPLY_SET: 3,     // 3 units per 1 grain + 1 oil + 1 mineral
  NUKE_COST: 5000,
  NUKE_MINERAL_COST: 1,
  LASER_STAR_COST: 10000,
  LASER_STAR_MINERAL_COST: 2,
  RESEARCH_COST_PER_CARD: 2000,
  MAX_NUKES: 12,
  MAX_LASER_STARS: 12,

  // Movement (Stage 5)
  LAND_MOVE_GRAIN_COST: 1,     // 1 grain per territory
  AIRLIFT_OIL_COST: 2,        // 2 oil for airlift
  SEA_MOVE_OIL_COST: 1,       // 1 oil per sea zone
  NAVY_TRANSPORT_CAPACITY: 4,  // armies per navy

  // Combat (Stage 4)
  COMBAT_SUPPLY_COST: 1,       // 1 of each resource per battle
  ATTACKER_BASE_DICE: 1,
  DEFENDER_BASE_DICE: 2,
  BONUS_DICE_MAJORITY: 1,
  BONUS_DICE_LASER_STAR: 1,
  MAX_DICE: 4,
  CASUALTIES_PER_POINTS: 3,   // every 3 points = 1 casualty
  DEFENDER_NO_SUPPLY_DICE: 1,

  // Nuclear
  LASER_STAR_INTERCEPT_FAIL: 6, // only 6 fails, 1-5 intercepts
  HOLOCAUST_THRESHOLD: 12,      // nuked territories to trigger holocaust

  // Loans — manual Grow: múltiplos de $10.000, juros $500/turno por unidade (5%)
  LOAN_MULTIPLE: 10000,
  LOAN_INTEREST_RATE: 0.05,    // 5% per turn

  // Turn structure
  MANDATORY_STAGES: [1, 2] as const,
  OPTIONAL_STAGES: [3, 4, 5, 6, 7] as const,
  MAX_OPTIONAL_STAGES: 3,
  // D3 fidelidade: manual Grow permite até 3 tentativas de prospecção no Estágio 7
  MAX_PROSPECT_ATTEMPTS: 3,

  // Victory - Detente wealth calculation
  WEALTH_COMPANY_VALUE: 1000,
  WEALTH_UNIT_VALUE: 500,
  WEALTH_NUKE_VALUE: 2500,
  WEALTH_LASER_STAR_VALUE: 5000,
} as const;
