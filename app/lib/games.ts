export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;
  title: string;
  short: string;
  cat: string;
  cover: string;
  color: GameColor;
  best: number;
}

export const CATS = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"] as const;

export const GAMES: Game[] = [
  {
    id: "bloque-buster",
    title: "BLOQUE BUSTER",
    short: "Rebota la pelota y destruye muros de neón.",
    cat: "ARCADE",
    cover: "cover-bricks",
    color: "cyan",
    best: 28450,
  },
  {
    id: "caida",
    title: "CAÍDA",
    short: "Encaja las piezas antes de que el techo te aplaste.",
    cat: "PUZZLE",
    cover: "cover-tetro",
    color: "magenta",
    best: 184220,
  },
  {
    id: "serpentina",
    title: "SERPENTINA",
    short: "Crece sin morder tu propia cola.",
    cat: "ARCADE",
    cover: "cover-snake",
    color: "green",
    best: 7820,
  },
  {
    id: "gloton",
    title: "GLOTÓN",
    short: "Devora puntos y escapa de los fantasmas.",
    cat: "ARCADE",
    cover: "cover-glot",
    color: "yellow",
    best: 96400,
  },
  {
    id: "invasores",
    title: "INVASORES",
    short: "Defiende el planeta de filas alienígenas.",
    cat: "SHOOTER",
    cover: "cover-invaders",
    color: "green",
    best: 54190,
  },
  {
    id: "rocas",
    title: "ROCAS",
    short: "Pulveriza asteroides en gravedad cero.",
    cat: "SHOOTER",
    cover: "cover-rocas",
    color: "yellow",
    best: 41200,
  },
  {
    id: "ranaria",
    title: "RANARIA",
    short: "Cruza la autopista de pixeles.",
    cat: "ARCADE",
    cover: "cover-rana",
    color: "green",
    best: 18900,
  },
  {
    id: "duelo-pixel",
    title: "DUELO PIXEL",
    short: "Dos paletas. Una pelota. Reflejos máximos.",
    cat: "VERSUS",
    cover: "cover-duelo",
    color: "cyan",
    best: 24,
  },
];
