import { Territory, SuperpowerId } from '../game/types';

// ============================================================
// World map territories — coherent continental masses.
// Map viewport: 1000 x 500 (viewBox in WorldMap.tsx).
//
// IMPORTANT (see CLAUDE.md): only `svgPath` + `labelPos` define the
// VISUAL shape/position of each territory. Every other field (id, owner,
// adjacencies, ports, …) is the protected game graph and must not change.
// Neighbouring territories share edge coordinates so each continent reads
// as one solid landmass instead of floating tiles.
// ============================================================

export const TERRITORIES: Record<string, Territory> = {
  // === SOUTH AMERICA (Confederação) ===
  argentina: {
    id: 'argentina', name: 'Argentina', owner: 'south_america', isHomeland: true,
    superpowerId: 'south_america', adjacentTerritories: ['brazil', 'peru', 'chile'],
    adjacentSeas: ['south_atlantic'], hasPort: true, nuked: false,
    svgPath: 'M 228 432 L 262 440 L 282 462 L 270 492 L 240 496 L 222 468 Z',
    labelPos: { x: 252, y: 464 }
  },
  brazil: {
    id: 'brazil', name: 'Brasil', owner: 'south_america', isHomeland: true,
    superpowerId: 'south_america', adjacentTerritories: ['argentina', 'peru', 'venezuela', 'west_africa'],
    adjacentSeas: ['south_atlantic', 'caribbean'], hasPort: true, nuked: false,
    svgPath: 'M 278 398 L 298 382 L 322 400 Q 336 432 314 452 L 282 462 L 262 440 L 270 415 Z',
    labelPos: { x: 296, y: 420 }
  },
  peru: {
    id: 'peru', name: 'Peru', owner: 'south_america', isHomeland: true,
    superpowerId: 'south_america', adjacentTerritories: ['brazil', 'argentina', 'venezuela', 'chile'],
    adjacentSeas: ['south_pacific'], hasPort: true, nuked: false,
    svgPath: 'M 218 376 L 236 396 L 270 415 L 262 440 L 228 432 L 205 438 L 200 404 Z',
    labelPos: { x: 232, y: 410 }
  },
  venezuela: {
    id: 'venezuela', name: 'Venezuela', owner: 'south_america', isHomeland: true,
    superpowerId: 'south_america', adjacentTerritories: ['brazil', 'peru', 'central_america'],
    adjacentSeas: ['caribbean'], hasPort: true, nuked: false,
    svgPath: 'M 225 356 L 288 358 L 298 382 L 278 398 L 236 396 L 218 376 Z',
    labelPos: { x: 260, y: 378 }
  },

  // === AFRICA (Federação) ===
  west_africa: {
    id: 'west_africa', name: 'África Ocidental', owner: 'africa', isHomeland: true,
    superpowerId: 'africa', adjacentTerritories: ['north_africa', 'central_africa', 'brazil'],
    adjacentSeas: ['south_atlantic', 'gulf_of_guinea'], hasPort: true, nuked: false,
    svgPath: 'M 405 288 L 430 310 L 448 355 L 425 372 L 400 350 L 398 312 Z',
    labelPos: { x: 422, y: 332 }
  },
  central_africa: {
    id: 'central_africa', name: 'África Central', owner: 'africa', isHomeland: true,
    superpowerId: 'africa', adjacentTerritories: ['west_africa', 'east_africa', 'south_africa'],
    adjacentSeas: ['gulf_of_guinea'], hasPort: false, nuked: false,
    svgPath: 'M 448 310 L 495 308 L 508 345 L 490 372 L 455 368 L 448 335 Z',
    labelPos: { x: 478, y: 340 }
  },
  east_africa: {
    id: 'east_africa', name: 'África Oriental', owner: 'africa', isHomeland: true,
    superpowerId: 'africa', adjacentTerritories: ['central_africa', 'south_africa', 'middle_east'],
    adjacentSeas: ['indian_ocean', 'red_sea'], hasPort: true, nuked: false,
    svgPath: 'M 508 288 L 540 295 L 548 330 L 535 362 L 508 345 L 495 308 Z',
    labelPos: { x: 522, y: 326 }
  },
  south_africa: {
    id: 'south_africa', name: 'África do Sul', owner: 'africa', isHomeland: true,
    superpowerId: 'africa', adjacentTerritories: ['central_africa', 'east_africa'],
    adjacentSeas: ['indian_ocean', 'south_atlantic'], hasPort: true, nuked: false,
    svgPath: 'M 425 372 L 490 372 L 508 400 L 488 432 L 450 438 L 420 412 Z',
    labelPos: { x: 462, y: 404 }
  },

  // === EUROPE (Liga) ===
  british_isles: {
    id: 'british_isles', name: 'Ilhas Britânicas', owner: 'europe', isHomeland: true,
    superpowerId: 'europe', adjacentTerritories: ['western_europe', 'scandinavia'],
    adjacentSeas: ['north_atlantic', 'north_sea'], hasPort: true, nuked: false,
    svgPath: 'M 398 150 Q 392 139 405 138 L 419 149 L 416 173 L 403 181 Q 393 167 398 150 Z',
    labelPos: { x: 407, y: 160 }
  },
  western_europe: {
    id: 'western_europe', name: 'Europa Ocidental', owner: 'europe', isHomeland: true,
    superpowerId: 'europe', adjacentTerritories: ['british_isles', 'eastern_europe', 'iberia', 'scandinavia'],
    adjacentSeas: ['north_atlantic', 'mediterranean', 'north_sea'], hasPort: true, nuked: false,
    svgPath: 'M 430 178 L 470 175 L 478 200 L 462 222 L 432 220 L 425 198 Z',
    labelPos: { x: 450, y: 199 }
  },
  eastern_europe: {
    id: 'eastern_europe', name: 'Europa Oriental', owner: 'europe', isHomeland: true,
    superpowerId: 'europe', adjacentTerritories: ['western_europe', 'scandinavia', 'russia', 'middle_east'],
    adjacentSeas: ['mediterranean', 'black_sea'], hasPort: true, nuked: false,
    svgPath: 'M 478 165 L 520 162 L 532 190 L 520 220 L 490 222 L 478 200 L 470 175 Z',
    labelPos: { x: 500, y: 192 }
  },
  iberia: {
    id: 'iberia', name: 'Ibéria', owner: 'europe', isHomeland: true,
    superpowerId: 'europe', adjacentTerritories: ['western_europe', 'north_africa'],
    adjacentSeas: ['north_atlantic', 'mediterranean'], hasPort: true, nuked: false,
    svgPath: 'M 408 212 L 445 210 L 450 232 L 432 250 L 410 245 L 402 228 Z',
    labelPos: { x: 428, y: 230 }
  },
  scandinavia: {
    id: 'scandinavia', name: 'Escandinávia', owner: 'europe', isHomeland: true,
    superpowerId: 'europe', adjacentTerritories: ['british_isles', 'western_europe', 'eastern_europe', 'kola'],
    adjacentSeas: ['north_sea', 'arctic_atlantic'], hasPort: true, nuked: false,
    svgPath: 'M 448 92 Q 470 78 492 90 L 500 120 L 478 140 L 452 135 L 444 112 Z',
    labelPos: { x: 472, y: 112 }
  },

  // === CHINA (República Popular) ===
  manchuria: {
    id: 'manchuria', name: 'Manchúria', owner: 'china', isHomeland: true,
    superpowerId: 'china', adjacentTerritories: ['shantung', 'mongolia', 'siberia'],
    adjacentSeas: ['sea_of_japan', 'yellow_sea'], hasPort: true, nuked: false,
    svgPath: 'M 700 160 L 758 155 L 770 185 L 752 210 L 712 208 L 700 185 Z',
    labelPos: { x: 732, y: 184 }
  },
  mongolia: {
    id: 'mongolia', name: 'Mongólia', owner: 'china', isHomeland: true,
    superpowerId: 'china', adjacentTerritories: ['manchuria', 'nanling', 'tibet', 'siberia', 'buryatsk'],
    adjacentSeas: [], hasPort: false, nuked: false,
    svgPath: 'M 620 182 L 692 180 L 700 210 L 680 232 L 640 230 L 620 205 Z',
    labelPos: { x: 658, y: 206 }
  },
  nanling: {
    id: 'nanling', name: 'Nanling', owner: 'china', isHomeland: true,
    superpowerId: 'china', adjacentTerritories: ['shantung', 'mongolia', 'tibet', 'indochina'],
    adjacentSeas: ['south_china_sea'], hasPort: true, nuked: false,
    svgPath: 'M 650 255 L 700 252 L 715 282 L 698 308 L 662 305 L 648 278 Z',
    labelPos: { x: 680, y: 280 }
  },
  shantung: {
    id: 'shantung', name: 'Shantung', owner: 'china', isHomeland: true,
    superpowerId: 'china', adjacentTerritories: ['manchuria', 'nanling', 'korea'],
    adjacentSeas: ['yellow_sea', 'south_china_sea'], hasPort: true, nuked: false,
    svgPath: 'M 695 210 L 752 210 L 760 238 L 742 260 L 708 258 L 695 235 Z',
    labelPos: { x: 726, y: 235 }
  },
  tibet: {
    id: 'tibet', name: 'Tibete', owner: 'china', isHomeland: true,
    superpowerId: 'china', adjacentTerritories: ['mongolia', 'nanling', 'india', 'kazakh'],
    adjacentSeas: [], hasPort: false, nuked: false,
    svgPath: 'M 600 228 L 655 225 L 668 255 L 650 282 L 612 280 L 598 252 Z',
    labelPos: { x: 632, y: 254 }
  },

  // === USA (Estados Unidos) ===
  western_usa: {
    id: 'western_usa', name: 'EUA Ocidental', owner: 'usa', isHomeland: true,
    superpowerId: 'usa', adjacentTerritories: ['midwest_usa', 'alaska', 'mexico'],
    adjacentSeas: ['north_pacific', 'east_pacific'], hasPort: true, nuked: false,
    svgPath: 'M 120 205 Q 125 180 150 182 L 195 180 L 195 288 L 150 290 Q 122 265 120 205 Z',
    labelPos: { x: 158, y: 235 }
  },
  midwest_usa: {
    id: 'midwest_usa', name: 'EUA Central', owner: 'usa', isHomeland: true,
    superpowerId: 'usa', adjacentTerritories: ['western_usa', 'eastern_usa', 'mexico'],
    adjacentSeas: ['gulf_of_mexico'], hasPort: false, nuked: false,
    svgPath: 'M 195 180 L 240 176 L 282 178 L 282 290 L 240 292 L 195 288 Z',
    labelPos: { x: 238, y: 233 }
  },
  eastern_usa: {
    id: 'eastern_usa', name: 'EUA Oriental', owner: 'usa', isHomeland: true,
    superpowerId: 'usa', adjacentTerritories: ['midwest_usa', 'central_america'],
    adjacentSeas: ['north_atlantic', 'caribbean', 'gulf_of_mexico'], hasPort: true, nuked: false,
    svgPath: 'M 282 178 L 320 180 Q 360 185 358 225 L 350 275 L 300 285 L 282 290 Z',
    labelPos: { x: 318, y: 230 }
  },
  alaska: {
    id: 'alaska', name: 'Alasca', owner: 'usa', isHomeland: true,
    superpowerId: 'usa', adjacentTerritories: ['western_usa', 'yakutsk'],
    adjacentSeas: ['arctic_pacific', 'north_pacific'], hasPort: true, nuked: false,
    svgPath: 'M 70 150 Q 60 120 95 118 L 140 128 L 150 160 L 120 175 L 120 205 L 100 200 Q 72 185 70 150 Z',
    labelPos: { x: 104, y: 158 }
  },

  // === USSR (União Soviética) ===
  russia: {
    id: 'russia', name: 'Rússia', owner: 'ussr', isHomeland: true,
    superpowerId: 'ussr', adjacentTerritories: ['kola', 'kazakh', 'siberia', 'eastern_europe'],
    adjacentSeas: ['black_sea', 'arctic_atlantic'], hasPort: true, nuked: false,
    svgPath: 'M 540 118 L 610 112 L 622 150 L 600 182 L 548 180 L 532 150 Z',
    labelPos: { x: 578, y: 148 }
  },
  kola: {
    id: 'kola', name: 'Kola', owner: 'ussr', isHomeland: true,
    superpowerId: 'ussr', adjacentTerritories: ['russia', 'scandinavia'],
    adjacentSeas: ['arctic_atlantic', 'north_sea'], hasPort: true, nuked: false,
    svgPath: 'M 500 98 L 540 95 L 548 122 L 528 140 L 502 135 L 495 115 Z',
    labelPos: { x: 522, y: 116 }
  },
  kazakh: {
    id: 'kazakh', name: 'Cazaquistão', owner: 'ussr', isHomeland: true,
    superpowerId: 'ussr', adjacentTerritories: ['russia', 'siberia', 'tibet', 'middle_east'],
    adjacentSeas: [], hasPort: false, nuked: false,
    svgPath: 'M 600 182 L 660 178 L 675 208 L 655 232 L 612 228 L 600 200 Z',
    labelPos: { x: 635, y: 205 }
  },
  siberia: {
    id: 'siberia', name: 'Sibéria', owner: 'ussr', isHomeland: true,
    superpowerId: 'ussr', adjacentTerritories: ['russia', 'kazakh', 'buryatsk', 'yakutsk'],
    adjacentSeas: ['arctic_pacific'], hasPort: false, nuked: false,
    svgPath: 'M 610 80 L 700 72 L 712 108 L 692 140 L 622 150 L 610 112 Z',
    labelPos: { x: 660, y: 110 }
  },
  buryatsk: {
    id: 'buryatsk', name: 'Buriácia', owner: 'ussr', isHomeland: true,
    superpowerId: 'ussr', adjacentTerritories: ['siberia', 'yakutsk', 'mongolia', 'manchuria'],
    adjacentSeas: ['sea_of_japan'], hasPort: true, nuked: false,
    svgPath: 'M 692 140 L 760 132 L 772 168 L 752 192 L 700 188 L 690 160 Z',
    labelPos: { x: 728, y: 162 }
  },
  yakutsk: {
    id: 'yakutsk', name: 'Iacútia', owner: 'ussr', isHomeland: true,
    superpowerId: 'ussr', adjacentTerritories: ['siberia', 'buryatsk', 'alaska'],
    adjacentSeas: ['arctic_pacific'], hasPort: true, nuked: false,
    svgPath: 'M 700 72 L 788 66 L 800 100 L 780 132 L 712 128 L 700 108 Z',
    labelPos: { x: 748, y: 98 }
  },

  // === NEUTRAL TERRITORIES ===
  mexico: {
    id: 'mexico', name: 'México', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: ['western_usa', 'midwest_usa', 'central_america'],
    adjacentSeas: ['east_pacific', 'gulf_of_mexico'], hasPort: true, nuked: false,
    svgPath: 'M 150 290 L 240 292 L 235 330 Q 220 355 195 352 L 165 340 L 150 310 Z',
    labelPos: { x: 196, y: 318 }
  },
  central_america: {
    id: 'central_america', name: 'América Central', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: ['mexico', 'eastern_usa', 'venezuela'],
    adjacentSeas: ['caribbean', 'east_pacific'], hasPort: true, nuked: false,
    svgPath: 'M 210 345 L 240 345 L 255 370 L 250 392 L 228 392 L 212 372 Z',
    labelPos: { x: 233, y: 368 }
  },
  chile: {
    id: 'chile', name: 'Chile', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: ['peru', 'argentina'],
    adjacentSeas: ['south_pacific'], hasPort: true, nuked: false,
    svgPath: 'M 205 438 L 222 468 L 240 496 L 228 498 L 210 470 L 198 442 Z',
    labelPos: { x: 217, y: 470 }
  },
  north_africa: {
    id: 'north_africa', name: 'Norte da África', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: ['iberia', 'west_africa', 'middle_east'],
    adjacentSeas: ['mediterranean', 'south_atlantic'], hasPort: true, nuked: false,
    svgPath: 'M 408 258 L 508 255 L 515 288 L 495 308 L 430 310 L 405 288 Z',
    labelPos: { x: 458, y: 283 }
  },
  middle_east: {
    id: 'middle_east', name: 'Oriente Médio', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: ['eastern_europe', 'north_africa', 'east_africa', 'kazakh', 'india'],
    adjacentSeas: ['red_sea', 'indian_ocean', 'mediterranean'], hasPort: true, nuked: false,
    svgPath: 'M 520 235 L 575 232 L 588 262 L 572 292 L 540 295 L 520 268 Z',
    labelPos: { x: 552, y: 262 }
  },
  india: {
    id: 'india', name: 'Índia', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: ['middle_east', 'tibet', 'indochina'],
    adjacentSeas: ['indian_ocean'], hasPort: true, nuked: false,
    svgPath: 'M 600 282 L 650 280 L 662 318 L 642 345 L 608 340 L 596 308 Z',
    labelPos: { x: 628, y: 312 }
  },
  indochina: {
    id: 'indochina', name: 'Indochina', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: ['india', 'nanling'],
    adjacentSeas: ['south_china_sea', 'indian_ocean'], hasPort: true, nuked: false,
    svgPath: 'M 662 288 L 702 285 L 716 315 L 700 340 L 668 335 L 660 312 Z',
    labelPos: { x: 686, y: 312 }
  },
  korea: {
    id: 'korea', name: 'Coreia', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: ['shantung', 'manchuria'],
    adjacentSeas: ['sea_of_japan', 'yellow_sea'], hasPort: true, nuked: false,
    svgPath: 'M 752 205 L 778 202 L 786 222 L 776 240 L 758 238 L 750 222 Z',
    labelPos: { x: 766, y: 222 }
  },
  japan: {
    id: 'japan', name: 'Japão', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: [],
    adjacentSeas: ['sea_of_japan', 'north_pacific'], hasPort: true, nuked: false,
    svgPath: 'M 795 190 Q 812 182 822 198 L 826 222 L 812 242 L 798 234 Q 788 212 795 190 Z',
    labelPos: { x: 810, y: 214 }
  },
  indonesia: {
    id: 'indonesia', name: 'Indonésia', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: ['australia'],
    adjacentSeas: ['south_china_sea', 'indian_ocean', 'south_pacific'], hasPort: true, nuked: false,
    svgPath: 'M 672 352 L 745 348 L 760 372 L 742 392 L 695 390 L 672 372 Z',
    labelPos: { x: 712, y: 370 }
  },
  australia: {
    id: 'australia', name: 'Austrália', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: ['indonesia'],
    adjacentSeas: ['south_pacific', 'indian_ocean'], hasPort: true, nuked: false,
    svgPath: 'M 735 398 L 815 392 L 838 420 L 820 452 L 760 458 L 730 428 Z',
    labelPos: { x: 780, y: 425 }
  },
  greenland: {
    id: 'greenland', name: 'Groenlândia', owner: null, isHomeland: false,
    superpowerId: null, adjacentTerritories: [],
    adjacentSeas: ['arctic_atlantic', 'north_atlantic'], hasPort: false, nuked: false,
    svgPath: 'M 360 80 Q 380 55 420 62 L 455 80 L 450 120 Q 430 140 400 132 L 368 118 Q 352 100 360 80 Z',
    labelPos: { x: 405, y: 95 }
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
