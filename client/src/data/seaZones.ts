import { SeaZone } from '../game/types';

// ============================================================
// Sea zones — 10 coastal seas hug their adjacent coasts, 8 deep
// oceans fill the open water between continents (anchor icons drawn
// in WorldMap.tsx). Only `svgPath` + `labelPos` are visual; type and
// adjacencies are the protected game graph (see CLAUDE.md).
// ============================================================

export const SEA_ZONES: Record<string, SeaZone> = {
  // === COASTAL SEAS ===
  caribbean: {
    id: 'caribbean', name: 'Caribe', type: 'coastal',
    adjacentTerritories: ['venezuela', 'eastern_usa', 'central_america', 'brazil'],
    adjacentSeas: ['north_atlantic', 'gulf_of_mexico'],
    svgPath: 'M 308 306 L 360 304 L 366 332 L 340 352 L 308 345 L 300 324 Z',
    labelPos: { x: 332, y: 327 }
  },
  gulf_of_mexico: {
    id: 'gulf_of_mexico', name: 'Golfo do México', type: 'coastal',
    adjacentTerritories: ['eastern_usa', 'midwest_usa', 'mexico'],
    adjacentSeas: ['caribbean', 'east_pacific'],
    svgPath: 'M 248 292 L 305 292 L 305 320 L 280 334 L 252 330 L 244 310 Z',
    labelPos: { x: 276, y: 311 }
  },
  north_sea: {
    id: 'north_sea', name: 'Mar do Norte', type: 'coastal',
    adjacentTerritories: ['british_isles', 'scandinavia', 'western_europe', 'kola'],
    adjacentSeas: ['north_atlantic', 'arctic_atlantic'],
    svgPath: 'M 420 128 L 450 122 L 460 150 L 448 172 L 424 170 L 416 148 Z',
    labelPos: { x: 438, y: 148 }
  },
  mediterranean: {
    id: 'mediterranean', name: 'Mediterrâneo', type: 'coastal',
    adjacentTerritories: ['iberia', 'western_europe', 'eastern_europe', 'north_africa', 'middle_east'],
    adjacentSeas: ['north_atlantic', 'black_sea', 'red_sea'],
    svgPath: 'M 410 250 L 512 246 L 520 264 L 500 280 L 420 282 L 405 266 Z',
    labelPos: { x: 460, y: 264 }
  },
  black_sea: {
    id: 'black_sea', name: 'Mar Negro', type: 'coastal',
    adjacentTerritories: ['eastern_europe', 'russia', 'middle_east'],
    adjacentSeas: ['mediterranean'],
    svgPath: 'M 522 198 L 558 195 L 566 215 L 552 232 L 528 228 L 518 212 Z',
    labelPos: { x: 542, y: 213 }
  },
  red_sea: {
    id: 'red_sea', name: 'Mar Vermelho', type: 'coastal',
    adjacentTerritories: ['east_africa', 'middle_east'],
    adjacentSeas: ['indian_ocean', 'mediterranean'],
    svgPath: 'M 508 300 L 540 296 L 552 320 L 540 346 L 516 340 L 506 318 Z',
    labelPos: { x: 528, y: 320 }
  },
  gulf_of_guinea: {
    id: 'gulf_of_guinea', name: 'Golfo da Guiné', type: 'coastal',
    adjacentTerritories: ['west_africa', 'central_africa'],
    adjacentSeas: ['south_atlantic'],
    svgPath: 'M 362 350 L 404 348 L 412 372 L 398 392 L 368 388 L 356 366 Z',
    labelPos: { x: 384, y: 368 }
  },
  yellow_sea: {
    id: 'yellow_sea', name: 'Mar Amarelo', type: 'coastal',
    adjacentTerritories: ['shantung', 'korea', 'manchuria'],
    adjacentSeas: ['sea_of_japan', 'south_china_sea'],
    svgPath: 'M 756 240 L 788 238 L 796 258 L 782 278 L 760 274 L 750 256 Z',
    labelPos: { x: 772, y: 257 }
  },
  sea_of_japan: {
    id: 'sea_of_japan', name: 'Mar do Japão', type: 'coastal',
    adjacentTerritories: ['japan', 'korea', 'manchuria', 'buryatsk'],
    adjacentSeas: ['north_pacific', 'yellow_sea'],
    svgPath: 'M 772 155 L 798 150 L 808 175 L 796 200 L 776 196 L 766 172 Z',
    labelPos: { x: 786, y: 175 }
  },
  south_china_sea: {
    id: 'south_china_sea', name: 'Mar da China', type: 'coastal',
    adjacentTerritories: ['nanling', 'shantung', 'indochina', 'indonesia'],
    adjacentSeas: ['yellow_sea', 'indian_ocean', 'south_pacific'],
    svgPath: 'M 702 312 L 758 308 L 770 332 L 752 352 L 712 348 L 698 328 Z',
    labelPos: { x: 732, y: 330 }
  },

  // === DEEP SEAS ===
  north_atlantic: {
    id: 'north_atlantic', name: 'Atlântico Norte', type: 'deep',
    adjacentTerritories: ['eastern_usa', 'british_isles', 'iberia', 'greenland'],
    adjacentSeas: ['caribbean', 'north_sea', 'mediterranean', 'arctic_atlantic', 'south_atlantic'],
    svgPath: 'M 345 160 L 398 155 L 400 210 L 390 255 L 350 260 L 338 205 Z',
    labelPos: { x: 368, y: 205 }
  },
  south_atlantic: {
    id: 'south_atlantic', name: 'Atlântico Sul', type: 'deep',
    adjacentTerritories: ['brazil', 'argentina', 'west_africa', 'south_africa', 'north_africa'],
    adjacentSeas: ['north_atlantic', 'caribbean', 'gulf_of_guinea', 'indian_ocean'],
    svgPath: 'M 322 340 L 398 335 L 405 400 L 390 452 L 335 460 L 318 400 Z',
    labelPos: { x: 360, y: 400 }
  },
  north_pacific: {
    id: 'north_pacific', name: 'Pacífico Norte', type: 'deep',
    adjacentTerritories: ['western_usa', 'alaska', 'japan'],
    adjacentSeas: ['east_pacific', 'arctic_pacific', 'sea_of_japan', 'south_pacific'],
    svgPath: 'M 838 110 L 915 102 L 928 150 L 915 200 L 850 205 L 835 160 Z',
    labelPos: { x: 880, y: 150 }
  },
  south_pacific: {
    id: 'south_pacific', name: 'Pacífico Sul', type: 'deep',
    adjacentTerritories: ['chile', 'peru', 'indonesia', 'australia'],
    adjacentSeas: ['east_pacific', 'north_pacific', 'south_china_sea', 'indian_ocean'],
    svgPath: 'M 848 300 L 925 292 L 938 340 L 922 398 L 858 402 L 845 350 Z',
    labelPos: { x: 890, y: 348 }
  },
  east_pacific: {
    id: 'east_pacific', name: 'Pacífico Leste', type: 'deep',
    adjacentTerritories: ['western_usa', 'mexico', 'central_america', 'chile', 'peru'],
    adjacentSeas: ['north_pacific', 'south_pacific', 'gulf_of_mexico'],
    svgPath: 'M 32 220 L 108 212 L 118 300 L 108 392 L 45 398 L 28 310 Z',
    labelPos: { x: 72, y: 305 }
  },
  indian_ocean: {
    id: 'indian_ocean', name: 'Oceano Índico', type: 'deep',
    adjacentTerritories: ['east_africa', 'south_africa', 'india', 'indochina', 'indonesia', 'australia'],
    adjacentSeas: ['red_sea', 'south_atlantic', 'south_china_sea', 'south_pacific'],
    svgPath: 'M 552 355 L 645 348 L 658 400 L 642 450 L 560 452 L 545 400 Z',
    labelPos: { x: 600, y: 400 }
  },
  arctic_atlantic: {
    id: 'arctic_atlantic', name: 'Ártico Atlântico', type: 'deep',
    adjacentTerritories: ['greenland', 'scandinavia', 'kola', 'russia'],
    adjacentSeas: ['north_atlantic', 'north_sea', 'arctic_pacific'],
    svgPath: 'M 305 48 L 465 40 L 478 68 L 462 92 L 320 90 L 298 68 Z',
    labelPos: { x: 388, y: 66 }
  },
  arctic_pacific: {
    id: 'arctic_pacific', name: 'Ártico Pacífico', type: 'deep',
    adjacentTerritories: ['alaska', 'yakutsk', 'siberia'],
    adjacentSeas: ['arctic_atlantic', 'north_pacific'],
    svgPath: 'M 495 38 L 725 30 L 740 55 L 724 72 L 510 70 L 490 55 Z',
    labelPos: { x: 610, y: 52 }
  },
};

export const SEA_ZONE_IDS = Object.keys(SEA_ZONES);
