import { createPublicClient } from "./supabase/public";
export const PLAYERS: string[] = [
  "PX_KAI",
  "NEONFOX",
  "Z3R0COOL",
  "M00NRYU",
  "VAULT_07",
  "GLITCHA",
  "ATARI_KID",
  "CYBER_LU",
  "MAGENTA88",
  "SCANLINE",
  "BIT_LORD",
  "ARKADYA",
  "DROID_X",
  "RGB_QUEEN",
  "PIXEL_DAD",
  "RETROVIRA",
  "VECTORX",
  "JOY_STK",
];
export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}
// Generador determinista (mismo seed → mismas filas). Sin Math.random:
// seguro para render en servidor y sin hydration mismatch.
export function seededScores(seed: number, count = 12): ScoreRow[] {
  let s = seed;
  const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const used = new Set<string>();
  const rows: ScoreRow[] = [];
  for (let i = 0; i < count; i++) {
    let name: string;
    do {
      name = PLAYERS[Math.floor(rand() * PLAYERS.length)];
    } while (used.has(name) && used.size < PLAYERS.length);
    used.add(name);
    const base = Math.floor(50000 + rand() * 250000);
    const score = base - i * Math.floor(2000 + rand() * 4000);
    const day = String(1 + Math.floor(rand() * 28)).padStart(2, "0");
    const mon = String(1 + Math.floor(rand() * 12)).padStart(2, "0");
    rows.push({
      rank: i + 1,
      name,
      score: Math.max(score, 1000),
      date: `${day}/${mon}/2026`,
    });
  }
  return rows
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
// "2026-08-28T19:04:49.436Z" -> "28/08/2026"
export function formatScoreDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${mon}/${d.getFullYear()}`;
}
// Marcas reales de la tabla `scores` para un juego, ordenadas de mayor a menor.
// Solo tiene sentido para juegos con `has_leaderboard = true`. Devuelve [] si no
// hay filas o si la consulta falla.
export async function getTopScores(
  gameId: string,
  limit: number,
): Promise<ScoreRow[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("scores")
    .select("name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) {
    if (error) console.error("getTopScores:", error.message);
    return [];
  }
  return data.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    score: r.score,
    date: formatScoreDate(r.created_at),
  }));
}
