import { Territory, SuperpowerId } from '../game/types';

// Simplified world map territories with SVG polygon paths
// Map viewport: 1000 x 500
// Each territory has a simplified polygon for the SVG map

export const TERRITORIES: Record<string, Territory> = {
  // === SOUTH AMERICA (Confederação) ===
  argentina: {
    id: 'argentina', name: 'Argentina', owner: 'south_america', isHomeland: true,
    superpowerId: 'south_america', adjacentTerritories: ['brazil', 'peru', 'chile'],
    adjacentSeas: ['south_atlantic'], hasPort: true, nuked: false,
    svgPath: 'M 175 380 L 185 350 L 200 360 L 210 390 L 200 430 L 185 440 L 170 420 Z',
    labelPos: { x: 188, y: 400 }
  },
  brazil: {
    id: 'brazil', name: 'Brasil', owner: 'south_america', isHomeland: true,
    superpowerId: 'south_america', adjacentTerritories: ['argentina', 'peru', 'venezuela', 'west_africa'],
    adjacentSeas: ['south_atlantic', 'caribbean'], hasPort: true, nuked: false,
    svgPath: 'M 195 290 L 230 280 L 250 300 L 240 340 L 220 360 L 200 360 L 185 340 L 185 310 Z',
    labelPos: { x: 215, y: 320 }
  },
  peru: {
    id: 'peru', name: 'Peru', owner: 'south_america', isHomeland: true,
    superpowerId: 'south_america', adjacentTerritories: ['brazil', 'argentina', 'venezuela', 'chile'],
    adjacentSeas: ['south_pacific'], hasPort: true, nuked: false,
    svgPath: 'M 155 310 L 175 290 L 195 290 L 185 340 L 175 360 L 155 350 Z',
    labelPos: { x: 172, y: 325 }
  },
  venezuela: {
    id: 'venezuela', name: 'Venezuela', owner: 'south_america', isHomeland: true,
    superpowerId: 'south_america', adjacentTerritories: ['brazil', 'peru', 'central_america'],
    adjacentSeas: ['caribbean'], hasPort: true, nuked: false,
    svgPath: 'M 165 260 L 195 250 L 210 265 L 195 290 L 175 290 L 160 275 Z',
    labelPos: { x: 182, y: 272 }
  },

  // === AFRICA (Federação) ===
  west_africa: {
    id: 'west_africa', name: 'África Ocidental', owner: 'africa', isHomeland: true,
    superpowerId: 'africa', adjacentTerritories: ['north_africa', 'central_africa', 'brazil'],
    adjacentSeas: ['south_atlantic', 'gulf_of_guinea'], hasPort: true, nuked: false,
    svgPath: 'M 370 290 L 400 280 L 415 300 L 405 330 L 380 340 L 365 320 Z',
    labelPos: { x: 388, y: 310 }
  },
  central_africa: {
    id: 'central_africa', name: 'África Central', owner: 'africa', isHomeland: true,
    superpowerId: 'africa', adjacentTerritories: ['west_africa', 'east_africa', 'south_africa'],
    adjacentSeas: ['gulf_of_guinea'], hasPort: false, nuked: false,
    svgPath: 'M 405 330 L 430 320 L 445 340 L 440 370 L 420 380 L 400 365 Z',
    labelPos: { x: 420, y: 350 }
  },
  east_africa: {
    id: 'east_africa', name: 'África Oriental', owner: 'africa', isHomeland: true,
    superpowerId: 'africa', adjacentTerritories: ['central_africa', 'south_africa', 'middle_east'],
    adjacentSeas: ['indian_ocean', 'red_sea'], hasPort: true, nuked: false,
    svgPath: 'M 445 310 L 470 300 L 480 320 L 475 350 L 455 360 L 440 340 Z',
    labelPos: { x: 458, y: 330 }
  },
  south_africa: {
    id: 'south_africa', name: 'África do Sul', owner: 'africa', isHomeland: true,
    superpowerId: 'africa', adjacentTerritories: ['central_africa', 'east_africa'],
    adjacentSeas: ['indian_ocean', 'south_atlantic'], hasPort: true, nuked: false,
    svgPath: 'M 400 380 L 440 370 L 455 390 L 445 420 L 420 430 L 395 415 Z',
    labelPos: { x: 425, y: 400 }
  },

  // === EUROPE (Liga) ===
  british_isles: {
    id: 'british_isles', name: 'Ilhas Britânicas', owner: 'europe', isHomeland: true,
    superpowerId: 'europe', adjacentTerritories: ['western_europe', 'scandinavia'],
    adjacentSeas: ['north_atlantic', 'north_sea'], hasPort: true, nuked: false,
    svgPath: 'M 355 140 L 370 130 L 380 140 L 375 160 L 360 165 L 350 155 Z',
    labelPos: { x: 365, y: 148 }
  },
  western_europe: {
    id: 'western_europe', name: 'Europa Ocidental', owner: 'europe', isHomeland: true,
    superpowerId: 'europe', adjacentTerritories: ['british_isles', 'eastern_europe', 'iberia', 'scandinavia'],
    adjacentSeas: ['north_atlantic', 'mediterranean', 'north_sea'], hasPort: true, nuked: false,
    svgPath: 'M 370 165 L 395 155 L 410 170 L 405 195 L 385 200 L 370 190 Z',
    labelPos: { x: 388, y: 178 }
  },
  eastern_europe: {
    id: 'eastern_europe', name: 'Europa Oriental', owner: 'europe', isHomeland: true,
    superpowerId: 'europe', adjacentTerritories: ['western_europe', 'scandinavia', 'russia', 'middle_east'],
    adjacentSeas: ['mediterranean', 'black_sea'], hasPort: true, nuked: false,
    svgPath: 'M 410 155 L 440 145 L 455 165 L 450 190 L 430 200 L 410 190 Z',
    labelPos: { x: 430, y: 172 }
  },
  iberia: {
    id: 'iberia', name: 'Ibéria', owner: 'europe', isHomeland: true,
    superpowerId: 'europe', adjacentTerritories: ['western_europe', 'north_africa'],
    adjacentSeas: ['north_atlantic', 'mediterranean'], hasPort: true, nuked: false,
    svgPath: 'M 350 195 L 375 190 L 385 205 L 378 225 L 358 228 L 348 215 Z',
    labelPos: { x: 365, y: 210 }
  },
  scandinavia: {
    id: 'scandinavia', name: 'Escandinávia', owner: 'europe', isHomeland: true,
    superpowerId: 'europe', adjacentTerritories: ['british_isles', 'western_europe', 'eastern_europe', 'kola'],
    adjacentSeas: ['north_sea', 'arctic_atlantic'], hasPort: true, nuked: false,
    svgPath: 'M 380 100 L 405 90 L 420 105 L 415 135 L 395 145 L 378 130 Z',
    labelPos: { x: 398, y: 118 }
  },

  // === CHINA (República Popular) ===
  manchuria: {
    id: 'manchuria', name: 'Manchúria', owner: 'china', isHomeland: true,
    superpowerId: 'china', adjacentTerritories: ['shantung', 'mongolia', 'siberia'],
    adjacentSeas: ['sea_of_japan', 'yellow_sea'], hasPort: true, nuked: false,
    svgPath: 'M 680 145 L 710 135 L 725 150 L 720 175 L 700 180 L 680 170 Z',
    labelPos: { x: 700, y: 158 }
  },
  mongolia: {
    id: 'mongolia', name: 'Mongólia', owner: 'china', isHomeland: true,
    superpowerId: 'china', adjacentTerritories: ['manchuria', 'nanling', 'tibet', 'siberia', 'buryatsk'],
    adjacentSeas: [], hasPort: false, nuked: false,
    svgPath: 'M 635 145 L 670 135 L 680 150 L 675 175 L 655 180 L 635 170 Z',
    labelPos: { x: 655, y: 160 }
  },
  nanling: {
    id: 'nanling', name: 'Nanling', owner: 'china', isHomeland: true,
    superpowerId: 'china', adjacentTerritories: ['shantung', 'mongolia', 'tibet', 'indochina'],
    adjacentSeas: ['south_china_sea'], hasPort: true, nuked: false,
    svgPath: 'M 650 200 L 680 190 L 700 205 L 695 230 L 670 235 L 650 225 Z',
    labelPos: { x: 672, y: 215 }
  },
  shantung: {
    id: 'shantung', name: 'Shantung', owner: 'china', isHomeland: true,
    superpowerId: 'china', adjacentTerritories: ['manchuria', 'nanling', 'korea'],
    adjacentSeas: ['yellow_sea', 'south_china_sea'], hasPort: true, nuked: false,
    svgPath: 'M 680 175 L 710 170 L 720 185 L 710 210 L 690 215 L 675 200 Z',
    labelPos: { x: 695, y: 192 }
  },
  tibet: {
    id: 'tibet', name: 'Tibete', owner: 'china', isHomeland: true,
    superpowerId: 'china', adjacentTerritories: ['mongolia', 'nanling', 'india', 'kazakh'],
    adjacentSeas: [], hasPort: false, nuked: false,
    svgPath: 'M 600 195 L 635 185 L 650 200 L 645 225 L 620 230 L 600 220 Z',
    labelPos: { x: 625, y: 210 }
  },

  // === USA (Estados Unidos) ===
  western_usa: {
    id: 'western_usa', name: 'EUA Ocidental', owner: 'usa', isHomeland: true,
    superpowerId: 'usa', adjacentTerritories: ['midwest_usa', 'alaska', 'mexico'],
    adjacentSeas: ['north_pacific', 'east_pacific'], hasPort: true, nuked: false,
    svgPath: 'M 80 170 L 110 160 L 125 175 L 120 200 L 100 210 L 80 200 Z',
    labelPos: { x: 100, y: 185 }
  },
  midwest_usa: {
    id: 'midwest_usa', name: 'EUA Central', owner: 'usa', isHomeland: true,
    superpowerId: 'usa', adjacentTerritories: ['western_usa', 'eastern_usa', 'mexico'],
    adjacentSeas: ['gulf_of_mexico'], hasPort: false, nuked: false,
    svgPath: 'M 120 165 L 150 158 L 165 175 L 160 200 L 140 208 L 120 198 Z',
    labelPos: { x: 140, y: 182 }
  },
  eastern_usa: {
    id: 'eastern_usa', name: 'EUA Oriental', owner: 'usa', isHomeland: true,
    superpowerId: 'usa', adjacentTerritories: ['midwest_usa', 'central_america'],
    adjacentSeas: ['north_atlantic', 'caribbean', 'gulf_of_mexico'], hasPort: true, nuked: false,
    svgPath: 'M 155 165 L 185 158 L 200 175 L 195 200 L 175 210 L 155 198 Z',
    labelPos: { x: 175, y: 182 }
  },
  alaska: {
    id: 'alaska', name: 'Alasca', owner: 'usa', isHomeland: true,
    superpowerId: 'usa', adjacentTerritories: ['western_usa', 'yakutsk'],
    adjacentSeas: ['arctic_pacific', 'north_pacific'], hasPort: true, nuked: false,
    svgPath: 'M 50 100 L 80 90 L 95 105 L 90 130 L 70 135 L 50 125 Z',
    labelPos: { x: 70, y: 112 }
  },

  // === USSR (União Soviética) ===
  russia: {
    id: 'russia', name: 'Rússia', owner: 'ussr', isHomeland: true,
    superpowerId: 'ussr', adjacentTerritories: ['kola', 'kazakh', 'siberia', 'eastern_europe'],
    adjacentSeas: ['black_sea', 'arctic_atlantic'], hasPort: true, nuked: false,
    svgPath: 'M 460 110 L 510 100 L 530 120 L 525 150 L 500 160 L 460 145 Z',
    labelPos: { x: 492, y: 130 }
  },
  kola: {
    id: 'kola', name: 'Kola', owner: 'ussr', isHomeland: true,
    superpowerId: 'ussr', adjacentTerritories: ['russia', 'scandinavia'],
    adjacentSeas: ['arctic_atlantic', 'north_sea'], hasPort: true, nuked: false,
    svgPath: 'M 425 80 L 455 70 L 470 85 L 465 110 L 445 115 L 425 105 Z',
    labelPos: { x: 445, y: 92 }
  },
  kazakh: {
    id: 'kazakh', name: 'Cazaquistão', owner: 'ussr', isHomeland: true,
    superpowerId: 'ussr', adjacentTerritories: ['russia', 'siberia', 'tibet', 'middle_east'],
    adjacentSeas: [], hasPort: false, nuked: false,
    svgPath: 'M 530 140 L 575 130 L 595 150 L 590 180 L 560 185 L 530 170 Z',
    labelPos: { x: 560, y: 158 }
  },
  siberia: {
    id: 'siberia', name: 'Sibéria', owner: 'ussr', isHomeland: true,
    superpowerId: 'ussr', adjacentTerritories: ['russia', 'kazakh', 'buryatsk', 'yakutsk'],
    adjacentSeas: ['arctic_pacific'], hasPort: false, nuked: false,
    svgPath: 'M 545 80 L 600 70 L 620 90 L 615 120 L 585 130 L 545 115 Z',
    labelPos: { x: 580, y: 100 }
  },
  buryatsk: {
    id: 'buryatsk', name: 'Buriácia', owner: 'ussr', isHomeland: true,
    superpowerId: 'ussr', adjacentTerritories: ['siberia', 'yakutsk', 'mongolia', 'manchuria'],
    adjacentSeas: ['sea_of_japan'], hasPort: true, nuked: false,
    svgPath: 'M 620 90 L 660 80 L 680 100 L 675 130 L 650 135 L 620 120 Z',
    labelPos: { x: 648, y: 108 }
  },
  yakutsk: {
    id: 'yakutsk', name: 'Iacútia', owner: 'ussr', isHomeland: true,
    superpowerId: 'ussr', adjacentTerritories: ['siberia', 'buryatsk', 'alaska'],
    adjacentSeas: ['arctic_pacific'], hasPort: true, nuked: false,
    svgPath: 'M 660 50 L 710 40 L 730 60 L 725 85 L 695 95 L 660 80 Z',
    labelPos: { x: 692, y: 68 }
  },

  // === NEUTRAL TERRITORIES ===
  mexico: {
    id: 'mexico', name: 'México', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: ['western_usa', 'midwest_usa', 'central_america'],
    adjacentSeas: ['east_pacific', 'gulf_of_mexico'], hasPort: true, nuked: false,
    svgPath: 'M 95 215 L 130 210 L 145 225 L 140 250 L 115 255 L 95 240 Z',
    labelPos: { x: 118, y: 232 }
  },
  central_america: {
    id: 'central_america', name: 'América Central', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: ['mexico', 'eastern_usa', 'venezuela'],
    adjacentSeas: ['caribbean', 'east_pacific'], hasPort: true, nuked: false,
    svgPath: 'M 135 250 L 160 245 L 170 260 L 165 280 L 145 285 L 130 270 Z',
    labelPos: { x: 150, y: 265 }
  },
  chile: {
    id: 'chile', name: 'Chile', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: ['peru', 'argentina'],
    adjacentSeas: ['south_pacific'], hasPort: true, nuked: false,
    svgPath: 'M 145 360 L 160 355 L 165 380 L 160 420 L 150 435 L 140 410 Z',
    labelPos: { x: 153, y: 390 }
  },
  north_africa: {
    id: 'north_africa', name: 'Norte da África', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: ['iberia', 'west_africa', 'middle_east'],
    adjacentSeas: ['mediterranean', 'south_atlantic'], hasPort: true, nuked: false,
    svgPath: 'M 350 235 L 410 225 L 425 245 L 420 275 L 380 285 L 345 270 Z',
    labelPos: { x: 385, y: 255 }
  },
  middle_east: {
    id: 'middle_east', name: 'Oriente Médio', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: ['eastern_europe', 'north_africa', 'east_africa', 'kazakh', 'india'],
    adjacentSeas: ['red_sea', 'indian_ocean', 'mediterranean'], hasPort: true, nuked: false,
    svgPath: 'M 455 200 L 500 190 L 520 210 L 515 240 L 490 250 L 460 235 Z',
    labelPos: { x: 485, y: 220 }
  },
  india: {
    id: 'india', name: 'Índia', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: ['middle_east', 'tibet', 'indochina'],
    adjacentSeas: ['indian_ocean'], hasPort: true, nuked: false,
    svgPath: 'M 545 225 L 580 215 L 600 235 L 595 265 L 570 275 L 545 260 Z',
    labelPos: { x: 570, y: 248 }
  },
  indochina: {
    id: 'indochina', name: 'Indochina', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: ['india', 'nanling'],
    adjacentSeas: ['south_china_sea', 'indian_ocean'], hasPort: true, nuked: false,
    svgPath: 'M 620 250 L 650 240 L 665 258 L 660 285 L 640 290 L 620 278 Z',
    labelPos: { x: 640, y: 265 }
  },
  korea: {
    id: 'korea', name: 'Coreia', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: ['shantung', 'manchuria'],
    adjacentSeas: ['sea_of_japan', 'yellow_sea'], hasPort: true, nuked: false,
    svgPath: 'M 720 170 L 740 165 L 748 180 L 742 200 L 728 205 L 718 192 Z',
    labelPos: { x: 732, y: 185 }
  },
  japan: {
    id: 'japan', name: 'Japão', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: [],
    adjacentSeas: ['sea_of_japan', 'north_pacific'], hasPort: true, nuked: false,
    svgPath: 'M 750 155 L 770 148 L 778 165 L 772 190 L 758 195 L 748 178 Z',
    labelPos: { x: 762, y: 172 }
  },
  indonesia: {
    id: 'indonesia', name: 'Indonésia', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: ['australia'],
    adjacentSeas: ['south_china_sea', 'indian_ocean', 'south_pacific'], hasPort: true, nuked: false,
    svgPath: 'M 670 310 L 720 300 L 740 318 L 730 340 L 695 345 L 670 335 Z',
    labelPos: { x: 700, y: 322 }
  },
  australia: {
    id: 'australia', name: 'Austrália', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: ['indonesia'],
    adjacentSeas: ['south_pacific', 'indian_ocean'], hasPort: true, nuked: false,
    svgPath: 'M 700 370 L 760 360 L 785 385 L 775 420 L 730 430 L 695 410 Z',
    labelPos: { x: 740, y: 395 }
  },
  greenland: {
    id: 'greenland', name: 'Groenlândia', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: [],
    adjacentSeas: ['arctic_atlantic', 'north_atlantic'], hasPort: false, nuked: false,
    svgPath: 'M 250 50 L 295 40 L 310 60 L 300 90 L 270 95 L 248 78 Z',
    labelPos: { x: 278, y: 68 }
  },
};

export const TERRITORY_IDS = Object.keys(TERRITORIES);
export const HOME_TERRITORIES: Record<SuperpowerId, string[]> = {
  south_america: ['argentina', 'brazil', 'peru', 'venezuela'],
  africa: ['west_africa', 'central_africa', 'east_africa', 'south_africa'],
  europe: ['british_isles', 'western_europe', 'eastern_europe', 'iberia', 'scandinavia'],
  china: ['manchuria', 'mongolia', 'nanling', 'shantung', 'tibet'],
  usa: ['western_usa', 'midwest_usa', 'eastern_usa', 'alaska'],
  ussr: ['russia', 'kola', 'kazakh', 'siberia', 'buryatsk', 'yakutsk'],
};
