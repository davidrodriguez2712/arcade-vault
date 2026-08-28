"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { AsteroidsGame, type TouchAction } from "./engine";
import AsteroidsTouchControls from "./touch-controls";
interface AsteroidsPlayerProps {
  title: string;
}
const SCROLL_KEYS = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
];
export default function AsteroidsPlayer({ title }: AsteroidsPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<AsteroidsGame | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    // StrictMode monta el efecto dos veces en dev: si quedó un motor vivo, se cierra.
    gameRef.current?.destroy();
    const game = new AsteroidsGame(canvas);
    gameRef.current = game;
    const applySize = () => {
      const rect = stage.getBoundingClientRect();
      game.resize(rect.width, rect.height, window.devicePixelRatio || 1);
    };
    applySize();
    game.start();
    const ro = new ResizeObserver(applySize);
    ro.observe(stage);
    const onKeyDown = (e: KeyboardEvent) => {
      if (SCROLL_KEYS.includes(e.code)) e.preventDefault();
      if (e.code === "Escape" || e.code === "KeyP") game.togglePause();
    };
    const onVisibility = () => game.setPaused(document.hidden);
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibility);
      game.destroy();
      gameRef.current = null;
    };
  }, []);
  const handleInput = (action: TouchAction, pressed: boolean) => {
    gameRef.current?.setInput(action, pressed);
  };
  return (
    <div className="av-player fade-in">
      <div className="crt">
        <div className="crt-screen">
          <div className="asteroids-stage" ref={stageRef}>
            <canvas
              ref={canvasRef}
              className="asteroids-canvas"
              width={800}
              height={600}
            />
          </div>
          <AsteroidsTouchControls onInput={handleInput} />
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{title} · CRT-83 · 60 HZ</span>
          <span>ASTEROIDES</span>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <Link className="btn ghost" href="/juego/rocas">
          VOLVER
        </Link>
      </div>
    </div>
  );
}
