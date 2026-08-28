import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GAMES } from "@/app/lib/games";
import PlayerScreen from "@/app/components/player-screen";
import { REAL_GAME_PLAYERS } from "@/app/components/games/registry";
export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}
export async function generateMetadata({
  params,
}: PageProps<"/juego/[id]/jugar">): Promise<Metadata> {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
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
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();
  const RealPlayer = REAL_GAME_PLAYERS[game.id];
  if (RealPlayer) return <RealPlayer title={game.title} />;
  return <PlayerScreen gameId={game.id} title={game.title} />;
}
