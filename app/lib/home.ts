import { getGames, type GameColor } from "./games";
import { PLAYERS, seededScores } from "./scores";
export interface StatBlock {
  n: string;
  u: string;
  s: string;
}
export interface TickRow {
  player: string;
  game: string;
  score: number;
  ago: string;
  color: GameColor;
}
export interface TopRow {
  rank: number;
  player: string;
  score: number;
}
// "12.4K" -> 12400, "31.8K" -> 31800, "980" -> 980
function parsePlays(plays: string): number {
  const m = plays.trim().match(/^([\d.]+)\s*([KkMm]?)$/);
  if (!m) return 0;
  const value = parseFloat(m[1]);
  const mult =
    m[2].toUpperCase() === "M"
      ? 1_000_000
      : m[2].toUpperCase() === "K"
        ? 1_000
        : 1;
  return Math.round(value * mult);
}
// STATS: 3 bloques derivados del catálogo (tabla `games`) y de los mocks de
// jugadores. Sin Math.random ni Date.now.
export async function homeStats(): Promise<StatBlock[]> {
  const games = await getGames();
  const totalPlays = games.reduce((sum, g) => sum + parsePlays(g.plays), 0);
  return [
    { n: String(games.length), u: "JUEGOS", s: "EN LA BÓVEDA" },
    {
      n: totalPlays.toLocaleString("es-ES"),
      u: "PARTIDAS",
      s: "JUGADAS EN TOTAL",
    },
    { n: String(PLAYERS.length), u: "JUGADORES", s: "COMPITEN POR EL TOP" },
  ];
}
// TICKER: 7 filas. Fila top (sembrada) de cada uno de los primeros 7 juegos.
export async function tickerRows(): Promise<TickRow[]> {
  const games = await getGames();
  return games.slice(0, 7).map((game, i) => {
    const top = seededScores(game.id.length * 17 + 3, 7)[0];
    return {
      player: top.name,
      game: game.title,
      score: top.score,
      ago: `hace ${(i + 1) * 3} min`,
      color: game.color,
    };
  });
}
// TOP JUGADORES: 5 filas, seed dedicado, determinista.
export function topPlayers(): TopRow[] {
  return seededScores(PLAYERS.length * 29 + 5, 5).map((r) => ({
    rank: r.rank,
    player: r.name,
    score: r.score,
  }));
}
