import { cache } from "react";
import { createPublicClient } from "./supabase/public";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: GameColor;
  best: number;
  plays: string;
  hasLeaderboard: boolean;
}
export const CATS = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"] as const;
// Slugs del catálogo. Respaldo para `getGames` / `generateStaticParams` cuando la
// consulta a Supabase falla o vuelve vacía en build (evita romper el build por un
// fallo de red). Deben coincidir con las filas sembradas en
// `supabase/migrations/06-tabla-juegos-y-leaderboard.sql`.
export const FALLBACK_GAME_IDS = [
  "bloque-buster",
  "caida",
  "serpentina",
  "gloton",
  "invasores",
  "rocas",
  "ranaria",
  "duelo-pixel",
] as const;
interface GameRow {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: string;
  best: number;
  plays: string;
  has_leaderboard: boolean;
}
function toGame(row: GameRow): Game {
  return {
    id: row.id,
    title: row.title,
    short: row.short,
    long: row.long,
    cat: row.cat,
    cover: row.cover,
    color: row.color as GameColor,
    best: row.best,
    plays: row.plays,
    hasLeaderboard: row.has_leaderboard,
  };
}
// Juego mínimo de respaldo: solo lo imprescindible para que las rutas existan si
// Supabase no responde en build. `rocas` es el único con leaderboard hoy.
function fallbackGame(id: string): Game {
  return {
    id,
    title: id.replace(/-/g, " ").toUpperCase(),
    short: "",
    long: "",
    cat: "ARCADE",
    cover: "",
    color: "cyan",
    best: 0,
    plays: "0",
    hasLeaderboard: id === "rocas",
  };
}
// Catálogo completo desde la tabla `games`, ordenado por `sort_order`.
// `cache()` deduplica la consulta dentro de un mismo render.
export const getGames = cache(async (): Promise<Game[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("games")
    .select(
      "id, title, short, long, cat, cover, color, best, plays, has_leaderboard",
    )
    .order("sort_order", { ascending: true });
  if (error || !data || data.length === 0) {
    if (error) console.error("getGames:", error.message);
    return FALLBACK_GAME_IDS.map(fallbackGame);
  }
  return data.map(toGame);
});
export async function getGame(id: string): Promise<Game | null> {
  const games = await getGames();
  return games.find((g) => g.id === id) ?? null;
}
