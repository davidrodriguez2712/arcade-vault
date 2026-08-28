import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FALLBACK_GAME_IDS, getGame, getGames } from "@/app/lib/games";
import PlayerScreen from "@/app/components/player-screen";
import { REAL_GAME_PLAYERS } from "@/app/components/games/registry";
export async function generateStaticParams() {
  const games = await getGames();
  const ids = games.length ? games.map((g) => g.id) : [...FALLBACK_GAME_IDS];
  return ids.map((id) => ({ id }));
}
export async function generateMetadata({
  params,
}: PageProps<"/juego/[id]/jugar">): Promise<Metadata> {
  const { id } = await params;
  const game = await getGame(id);
  return {
    title: game
      ? `Jugando: ${game.title} · Arcade Vault`
      : "Juego no encontrado",
  };
}
export default async function PlayPage({
  params,
}: PageProps<"/juego/[id]/jugar">) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();
  const RealPlayer = REAL_GAME_PLAYERS[game.id];
  if (RealPlayer) return <RealPlayer title={game.title} />;
  return <PlayerScreen gameId={game.id} title={game.title} />;
}
