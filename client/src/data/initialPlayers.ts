import { Superpower, SuperpowerId } from '../game/types';

export const SUPERPOWERS: Record<SuperpowerId, Superpower> = {
  south_america: {
    id: 'south_america',
    name: 'Confederação Sul-Americana',
    shortName: 'CSA',
    color: '#10b981',
    territories: ['argentina', 'brazil', 'peru', 'venezuela'],
  },
  africa: {
    id: 'africa',
    name: 'Federação Africana',
    shortName: 'FA',
    color: '#f59e0b',
    territories: ['west_africa', 'central_africa', 'east_africa', 'south_africa'],
  },
  europe: {
    id: 'europe',
    name: 'Liga Europeia',
    shortName: 'LE',
    color: '#3b82f6',
    territories: ['british_isles', 'western_europe', 'eastern_europe', 'iberia', 'scandinavia'],
  },
  china: {
    id: 'china',
    name: 'República Popular',
    shortName: 'RPC',
    color: '#ef4444',
    territories: ['manchuria', 'mongolia', 'nanling', 'shantung', 'tibet'],
  },
  usa: {
    id: 'usa',
    name: 'Estados Unidos',
    shortName: 'EUA',
    color: '#e2e8f0',
    territories: ['western_usa', 'midwest_usa', 'eastern_usa', 'alaska'],
  },
  ussr: {
    id: 'ussr',
    name: 'União Soviética',
    shortName: 'URSS',
    color: '#dc2626',
    territories: ['russia', 'kola', 'kazakh', 'siberia', 'buryatsk', 'yakutsk'],
  },
};

export const SUPERPOWER_IDS: SuperpowerId[] = ['south_america', 'africa', 'europe', 'china', 'usa', 'ussr'];
export const STARTING_MONEY = 70000;
export const STARTING_SUPPLIES = 3; // 3 of each resource
export const MAX_SUPPLY = 12;
