import type { ComponentType } from "react";
import AsteroidsPlayer from "./asteroids/asteroids-player";
import TetrisPlayer from "./tetris/tetris-player";
import ArkanoidPlayer from "./arkanoid/arkanoid-player";
// Juegos con motor real. Un id que no esté aquí cae en <PlayerScreen> (simulado).
// Para enchufar un juego nuevo: crear app/components/games/<juego>/ y registrarlo aquí.
export const REAL_GAME_PLAYERS: Record<
  string,
  ComponentType<{ title: string }>
> = {
  rocas: AsteroidsPlayer,
  caida: TetrisPlayer,
  "bloque-buster": ArkanoidPlayer,
};
