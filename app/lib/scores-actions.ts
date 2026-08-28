"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
// Mismos límites que los CHECK de la tabla `scores`
// (supabase/migrations/06-tabla-juegos-y-leaderboard.sql).
const NAME_RE = /^[A-Za-z0-9_]{1,12}$/;
const MAX_SCORE = 100_000_000;
const MAX_LEVEL = 10_000;
export interface SubmitScoreInput {
  gameId: string;
  name: string;
  score: number;
  level: number;
}
export type SubmitScoreResult = { ok: true } | { ok: false; error: string };
// Inserción anónima de una marca en el leaderboard. Valida en servidor antes de
// tocar la DB; la política RLS solo admite juegos con `has_leaderboard = true`.
export async function submitScore(
  input: SubmitScoreInput,
): Promise<SubmitScoreResult> {
  const gameId = String(input?.gameId ?? "").trim();
  const name = String(input?.name ?? "")
    .trim()
    .toUpperCase();
  const score = Math.floor(Number(input?.score));
  const level = Math.floor(Number(input?.level));
  if (!gameId) {
    return { ok: false, error: "Juego no válido." };
  }
  if (!NAME_RE.test(name)) {
    return {
      ok: false,
      error: "El nombre admite de 1 a 12 letras, números o guion bajo.",
    };
  }
  if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) {
    return { ok: false, error: "Puntuación fuera de rango." };
  }
  if (!Number.isFinite(level) || level < 1 || level > MAX_LEVEL) {
    return { ok: false, error: "Nivel fuera de rango." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("scores")
    .insert({ game_id: gameId, name, score, level });
  if (error) {
    console.error("submitScore:", error.message);
    return {
      ok: false,
      error: "No se pudo guardar la puntuación. Inténtalo de nuevo.",
    };
  }
  revalidatePath("/salon");
  revalidatePath(`/juego/${gameId}`);
  return { ok: true };
}
