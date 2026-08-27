import type { Metadata } from "next";
import HomeLanding from "@/app/components/home-landing";
import { GAMES } from "@/app/lib/games";
import { HOME_STATS, tickerRows, topPlayers } from "@/app/lib/home";

export const metadata: Metadata = {
  title: "Arcade Vault · Inicio",
};

export default function Home() {
  return (
    <HomeLanding
      previewGames={GAMES.slice(0, 6)}
      stats={HOME_STATS}
      ticker={tickerRows()}
      top={topPlayers()}
    />
  );
}
