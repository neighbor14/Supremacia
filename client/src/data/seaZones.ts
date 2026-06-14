import { SeaZone } from '../game/types';

export const SEA_ZONES: Record<string, SeaZone> = {
  // === COASTAL SEAS ===
  caribbean: {
    id: 'caribbean', name: 'Caribe', type: 'coastal',
    adjacentTerritories: ['venezuela', 'eastern_usa', 'central_america', 'brazil'],
    adjacentSeas: ['north_atlantic', 'gulf_of_mexico'],
    svgPath: 'M 150 230 L 200 225 L 210 245 L 195 265 L 160 260 L 145 245 Z',
    labelPos: { x: 178, y: 248 }
  },
  gulf_of_mexico: {
    id: 'gulf_of_mexico', name: 'Golfo do México', type: 'coastal',
    adjacentTerritories: ['eastern_usa', 'midwest_usa', 'mexico'],
    adjacentSeas: ['caribbean', 'east_pacific'],
    svgPath: 'M 110 210 L 155 205 L 160 225 L 145 240 L 115 238 L 105 225 Z',
    labelPos: { x: 132, y: 222 }
  },
  north_sea: {
    id: 'north_sea', name: 'Mar do Norte', type: 'coastal',
    adjacentTerritories: ['british_isles', 'scandinavia', 'western_europe', 'kola'],
    adjacentSeas: ['north_atlantic', 'arctic_atlantic'],
    svgPath: 'M 355 100 L 385 92 L 400 108 L 395 135 L 370 140 L 352 125 Z',
    labelPos: { x: 375, y: 118 }
  },
  mediterranean: {
    id: 'mediterranean', name: 'Mediterrâneo', type: 'coastal',
    adjacentTerritories: ['iberia', 'western_europe', 'eastern_europe', 'north_africa', 'middle_east'],
    adjacentSeas: ['north_atlantic', 'black_sea', 'red_sea'],
    svgPath: 'M 370 200 L 450 195 L 460 215 L 445 235 L 380 238 L 365 220 Z',
    labelPos: { x: 412, y: 218 }
  },
  black_sea: {
    id: 'black_sea', name: 'Mar Negro', type: 'coastal',
    adjacentTerritories: ['eastern_europe', 'russia', 'middle_east'],
    adjacentSeas: ['mediterranean'],
    svgPath: 'M 440 165 L 475 160 L 485 175 L 478 195 L 455 198 L 438 185 Z',
    labelPos: { x: 460, y: 180 }
  },
  red_sea: {
    id: 'red_sea', name: 'Mar Vermelho', type: 'coastal',
    adjacentTerritories: ['east_africa', 'middle_east'],
    adjacentSeas: ['indian_ocean', 'mediterranean'],
    svgPath: 'M 450 245 L 470 240 L 478 258 L 472 280 L 455 282 L 445 265 Z',
    labelPos: { x: 460, y: 262 }
  },
  gulf_of_guinea: {
    id: 'gulf_of_guinea', name: 'Golfo da Guiné', type: 'coastal',
    adjacentTerritories: ['west_africa', 'central_africa'],
    adjacentSeas: ['south_atlantic'],
    svgPath: 'M 345 295 L 375 290 L 385 310 L 375 335 L 350 338 L 340 318 Z',
    labelPos: { x: 360, y: 315 }
  },
  yellow_sea: {
    id: 'yellow_sea', name: 'Mar Amarelo', type: 'coastal',
    adjacentTerritories: ['shantung', 'korea', 'manchuria'],
    adjacentSeas: ['sea_of_japan', 'south_china_sea'],
    svgPath: 'M 718 180 L 745 175 L 752 195 L 745 215 L 725 218 L 715 200 Z',
    labelPos: { x: 732, y: 198 }
  },
  sea_of_japan: {
    id: 'sea_of_japan', name: 'Mar do Japão', type: 'coastal',
    adjacentTerritories: ['japan', 'korea', 'manchuria', 'buryatsk'],
    adjacentSeas: ['north_pacific', 'yellow_sea'],
    svgPath: 'M 730 130 L 760 125 L 770 145 L 762 168 L 740 172 L 728 155 Z',
    labelPos: { x: 748, y: 150 }
  },
  south_china_sea: {
    id: 'south_china_sea', name: 'Mar da China', type: 'coastal',
    adjacentTerritories: ['nanling', 'shantung', 'indochina', 'indonesia'],
    adjacentSeas: ['yellow_sea', 'indian_ocean', 'south_pacific'],
    svgPath: 'M 660 260 L 700 252 L 715 272 L 708 298 L 680 302 L 658 285 Z',
    labelPos: { x: 685, y: 278 }
  },

  // === DEEP SEAS ===
  north_atlantic: {
    id: 'north_atlantic', name: 'Atlântico Norte', type: 'deep',
    adjacentTerritories: ['eastern_usa', 'british_isles', 'iberia', 'greenland'],
    adjacentSeas: ['caribbean', 'north_sea', 'mediterranean', 'arctic_atlantic', 'south_atlantic'],
    svgPath: 'M 220 130 L 340 120 L 350 165 L 335 210 L 250 220 L 210 190 Z',
    labelPos: { x: 280, y: 170 }
  },
  south_atlantic: {
    id: 'south_atlantic', name: 'Atlântico Sul', type: 'deep',
    adjacentTerritories: ['brazil', 'argentina', 'west_africa', 'south_africa', 'north_africa'],
    adjacentSeas: ['north_atlantic', 'caribbean', 'gulf_of_guinea', 'indian_ocean'],
    svgPath: 'M 250 290 L 340 280 L 355 330 L 345 390 L 280 400 L 240 360 Z',
    labelPos: { x: 295, y: 340 }
  },
  north_pacific: {
    id: 'north_pacific', name: 'Pacífico Norte', type: 'deep',
    adjacentTerritories: ['western_usa', 'alaska', 'japan'],
    adjacentSeas: ['east_pacific', 'arctic_pacific', 'sea_of_japan', 'south_pacific'],
    svgPath: 'M 780 100 L 850 90 L 870 130 L 860 180 L 810 190 L 780 160 Z',
    labelPos: { x: 822, y: 140 }
  },
  south_pacific: {
    id: 'south_pacific', name: 'Pacífico Sul', type: 'deep',
    adjacentTerritories: ['chile', 'peru', 'indonesia', 'australia'],
    adjacentSeas: ['east_pacific', 'north_pacific', 'south_china_sea', 'indian_ocean'],
    svgPath: 'M 780 280 L 870 270 L 890 320 L 880 380 L 810 390 L 775 340 Z',
    labelPos: { x: 830, y: 330 }
  },
  east_pacific: {
    id: 'east_pacific', name: 'Pacífico Leste', type: 'deep',
    adjacentTerritories: ['western_usa', 'mexico', 'central_america', 'chile', 'peru'],
    adjacentSeas: ['north_pacific', 'south_pacific', 'gulf_of_mexico'],
    svgPath: 'M 30 220 L 85 215 L 95 270 L 85 340 L 45 350 L 25 300 Z',
    labelPos: { x: 58, y: 280 }
  },
  indian_ocean: {
    id: 'indian_ocean', name: 'Oceano Índico', type: 'deep',
    adjacentTerritories: ['east_africa', 'south_africa', 'india', 'indochina', 'indonesia', 'australia'],
    adjacentSeas: ['red_sea', 'south_atlantic', 'south_china_sea', 'south_pacific'],
    svgPath: 'M 490 300 L 600 290 L 630 330 L 620 390 L 540 400 L 480 360 Z',
    labelPos: { x: 555, y: 345 }
  },
  arctic_atlantic: {
    id: 'arctic_atlantic', name: 'Ártico Atlântico', type: 'deep',
    adjacentTerritories: ['greenland', 'scandinavia', 'kola', 'russia'],
    adjacentSeas: ['north_atlantic', 'north_sea', 'arctic_pacific'],
    svgPath: 'M 300 30 L 450 20 L 470 50 L 460 80 L 350 85 L 295 60 Z',
    labelPos: { x: 380, y: 52 }
  },
  arctic_pacific: {
    id: 'arctic_pacific', name: 'Ártico Pacífico', type: 'deep',
    adjacentTerritories: ['alaska', 'yakutsk', 'siberia'],
    adjacentSeas: ['arctic_atlantic', 'north_pacific'],
    svgPath: 'M 500 20 L 700 10 L 730 35 L 720 60 L 550 65 L 495 45 Z',
    labelPos: { x: 610, y: 38 }
  },
};

export const SEA_ZONE_IDS = Object.keys(SEA_ZONES);
