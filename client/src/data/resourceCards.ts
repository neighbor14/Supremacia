import { ResourceCard, SuperpowerId, ResourceType } from '../game/types';

// Each superpower starts with 6 companies: 2 grain, 2 oil, 2 mineral
// Generic company names to avoid copyright issues

interface CardTemplate {
  type: ResourceType;
  companyName: string;
  territoryId: string;
  production: number;
  originSuperpower: SuperpowerId;
}

const CARD_TEMPLATES: CardTemplate[] = [
  // SOUTH AMERICA
  { type: 'grain', companyName: 'Pampa Agrícola', territoryId: 'argentina', production: 3, originSuperpower: 'south_america' },
  { type: 'grain', companyName: 'Cerrado Grãos', territoryId: 'brazil', production: 3, originSuperpower: 'south_america' },
  { type: 'oil', companyName: 'Petro Orinoco', territoryId: 'venezuela', production: 3, originSuperpower: 'south_america' },
  { type: 'oil', companyName: 'Andes Petróleo', territoryId: 'peru', production: 2, originSuperpower: 'south_america' },
  { type: 'mineral', companyName: 'Minas do Sul', territoryId: 'brazil', production: 3, originSuperpower: 'south_america' },
  { type: 'mineral', companyName: 'Atacama Minerais', territoryId: 'argentina', production: 2, originSuperpower: 'south_america' },

  // AFRICA
  { type: 'grain', companyName: 'Sahel Cereais', territoryId: 'west_africa', production: 2, originSuperpower: 'africa' },
  { type: 'grain', companyName: 'Nilo Agrícola', territoryId: 'east_africa', production: 3, originSuperpower: 'africa' },
  { type: 'oil', companyName: 'Delta Petróleo', territoryId: 'west_africa', production: 3, originSuperpower: 'africa' },
  { type: 'oil', companyName: 'Cabo Energia', territoryId: 'south_africa', production: 2, originSuperpower: 'africa' },
  { type: 'mineral', companyName: 'Rand Mineração', territoryId: 'south_africa', production: 3, originSuperpower: 'africa' },
  { type: 'mineral', companyName: 'Congo Metais', territoryId: 'central_africa', production: 3, originSuperpower: 'africa' },

  // EUROPE
  { type: 'grain', companyName: 'Loire Agrícola', territoryId: 'western_europe', production: 3, originSuperpower: 'europe' },
  { type: 'grain', companyName: 'Danúbio Cereais', territoryId: 'eastern_europe', production: 3, originSuperpower: 'europe' },
  { type: 'oil', companyName: 'Mar Norte Petro', territoryId: 'british_isles', production: 3, originSuperpower: 'europe' },
  { type: 'oil', companyName: 'Ibéria Energia', territoryId: 'iberia', production: 2, originSuperpower: 'europe' },
  { type: 'mineral', companyName: 'Ruhr Metais', territoryId: 'western_europe', production: 3, originSuperpower: 'europe' },
  { type: 'mineral', companyName: 'Nórdica Mineração', territoryId: 'scandinavia', production: 2, originSuperpower: 'europe' },

  // CHINA
  { type: 'grain', companyName: 'Arroz Yangtze', territoryId: 'nanling', production: 3, originSuperpower: 'china' },
  { type: 'grain', companyName: 'Planície Norte', territoryId: 'shantung', production: 3, originSuperpower: 'china' },
  { type: 'oil', companyName: 'Daqing Petróleo', territoryId: 'manchuria', production: 3, originSuperpower: 'china' },
  { type: 'oil', companyName: 'Tarim Energia', territoryId: 'tibet', production: 2, originSuperpower: 'china' },
  { type: 'mineral', companyName: 'Mongólia Metais', territoryId: 'mongolia', production: 2, originSuperpower: 'china' },
  { type: 'mineral', companyName: 'Shantung Minerais', territoryId: 'shantung', production: 3, originSuperpower: 'china' },

  // USA — total inicial: 17 (vs 16 dos demais blocos). TODO: confirmar regra original se é intencional ou erro de design
  { type: 'grain', companyName: 'Great Plains Co.', territoryId: 'midwest_usa', production: 3, originSuperpower: 'usa' },
  { type: 'grain', companyName: 'California Farms', territoryId: 'western_usa', production: 3, originSuperpower: 'usa' },
  { type: 'oil', companyName: 'Texas Energy', territoryId: 'midwest_usa', production: 3, originSuperpower: 'usa' },
  { type: 'oil', companyName: 'Alaska Petroleum', territoryId: 'alaska', production: 3, originSuperpower: 'usa' },
  { type: 'mineral', companyName: 'Rockies Mining', territoryId: 'western_usa', production: 2, originSuperpower: 'usa' },
  { type: 'mineral', companyName: 'Appalachian Ore', territoryId: 'eastern_usa', production: 3, originSuperpower: 'usa' },

  // USSR — total inicial: 17 (vs 16 dos demais blocos). TODO: confirmar regra original se é intencional ou erro de design
  { type: 'grain', companyName: 'Estepe Cereais', territoryId: 'kazakh', production: 3, originSuperpower: 'ussr' },
  { type: 'grain', companyName: 'Volga Agrícola', territoryId: 'russia', production: 3, originSuperpower: 'ussr' },
  { type: 'oil', companyName: 'Sibéria Petro', territoryId: 'siberia', production: 3, originSuperpower: 'ussr' },
  { type: 'oil', companyName: 'Cáspio Energia', territoryId: 'kazakh', production: 3, originSuperpower: 'ussr' },
  { type: 'mineral', companyName: 'Urais Mineração', territoryId: 'russia', production: 3, originSuperpower: 'ussr' },
  { type: 'mineral', companyName: 'Kola Metais', territoryId: 'kola', production: 2, originSuperpower: 'ussr' },

  // NEUTRAL resource cards (remaining to fill 60 resource cards total)
  { type: 'grain', companyName: 'Pampas Neutras', territoryId: 'chile', production: 2, originSuperpower: 'south_america' },
  { type: 'grain', companyName: 'Mekong Rice', territoryId: 'indochina', production: 3, originSuperpower: 'china' },
  { type: 'grain', companyName: 'Punjab Wheat', territoryId: 'india', production: 3, originSuperpower: 'china' },
  { type: 'grain', companyName: 'Outback Farms', territoryId: 'australia', production: 2, originSuperpower: 'usa' },
  { type: 'grain', companyName: 'Sahara Oasis', territoryId: 'north_africa', production: 2, originSuperpower: 'africa' },
  { type: 'grain', companyName: 'Mesoamerica Maiz', territoryId: 'central_america', production: 2, originSuperpower: 'south_america' },
  { type: 'grain', companyName: 'Hokkaido Farms', territoryId: 'japan', production: 2, originSuperpower: 'china' },
  { type: 'grain', companyName: 'Java Rice', territoryId: 'indonesia', production: 2, originSuperpower: 'china' },

  // TODO: confirmar regra original — produção 4 não existe no deck físico Grow (máx. 3); criada digitalmente para representar o Oriente Médio
  { type: 'oil', companyName: 'Golfo Persa', territoryId: 'middle_east', production: 4, originSuperpower: 'ussr' },
  { type: 'oil', companyName: 'Líbia Petro', territoryId: 'north_africa', production: 3, originSuperpower: 'africa' },
  { type: 'oil', companyName: 'México Petróleo', territoryId: 'mexico', production: 3, originSuperpower: 'usa' },
  { type: 'oil', companyName: 'Borneo Oil', territoryId: 'indonesia', production: 3, originSuperpower: 'china' },
  { type: 'oil', companyName: 'India Petro', territoryId: 'india', production: 2, originSuperpower: 'china' },
  { type: 'oil', companyName: 'Korea Petro', territoryId: 'korea', production: 2, originSuperpower: 'china' },
  { type: 'oil', companyName: 'Greenland Arctic', territoryId: 'greenland', production: 1, originSuperpower: 'usa' },
  { type: 'oil', companyName: 'Caribe Petro', territoryId: 'central_america', production: 2, originSuperpower: 'south_america' },

  { type: 'mineral', companyName: 'Andes Copper', territoryId: 'chile', production: 3, originSuperpower: 'south_america' },
  { type: 'mineral', companyName: 'Outback Mining', territoryId: 'australia', production: 3, originSuperpower: 'usa' },
  { type: 'mineral', companyName: 'India Iron', territoryId: 'india', production: 2, originSuperpower: 'china' },
  { type: 'mineral', companyName: 'Japan Steel', territoryId: 'japan', production: 2, originSuperpower: 'china' },
  { type: 'mineral', companyName: 'Sahara Fosfato', territoryId: 'north_africa', production: 2, originSuperpower: 'africa' },
  { type: 'mineral', companyName: 'Mexico Silver', territoryId: 'mexico', production: 2, originSuperpower: 'usa' },
  { type: 'mineral', companyName: 'Korea Minerals', territoryId: 'korea', production: 2, originSuperpower: 'china' },
  { type: 'mineral', companyName: 'Indonesia Tin', territoryId: 'indonesia', production: 2, originSuperpower: 'china' },
];

export function generateResourceCards(): ResourceCard[] {
  return CARD_TEMPLATES.map((t, i) => ({
    id: `rc_${i}`,
    type: t.type,
    companyName: t.companyName,
    territoryId: t.territoryId,
    production: t.production,
    originSuperpower: t.originSuperpower,
    ownerId: null,
    revealed: false,
  }));
}

export const TOTAL_GRAIN_CARDS = 20;
export const TOTAL_OIL_CARDS = 20;
export const TOTAL_MINERAL_CARDS = 20;
export const TOTAL_NUKE_CARDS = 3;
export const TOTAL_LASER_STAR_CARDS = 2;

// IDs for tech cards mixed into the unified game deck
export const NUKE_CARD_IDS = ['nuke_0', 'nuke_1', 'nuke_2'] as const;
export const LASER_CARD_IDS = ['laser_0', 'laser_1'] as const;
