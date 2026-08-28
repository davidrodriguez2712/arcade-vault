"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { submitScore } from "@/app/lib/scores-actions";
import { AsteroidsGame, type GameOverResult, type TouchAction } from "./engine";
import AsteroidsTouchControls from "./touch-controls";
interface AsteroidsPlayerProps {
  title: string;
}
const GAME_ID = "rocas";
const SCROLL_KEYS = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
];
type SavePhase = "idle" | "saving" | "saved" | "error";
export default function AsteroidsPlayer({ title }: AsteroidsPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<AsteroidsGame | null>(null);
  const [over, setOver] = useState<GameOverResult | null>(null);
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<SavePhase>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    // StrictMode monta el efecto dos veces en dev: si quedó un motor vivo, se cierra.
    gameRef.current?.destroy();
    const game = new AsteroidsGame(canvas);
    gameRef.current = game;
    game.setOnGameOver((result) => {
      setOver(result);
      setName("");
      setPhase("idle");
      setErrorMsg("");
    });
    const applySize = () => {
      const rect = stage.getBoundingClientRect();
      game.resize(rect.width, rect.height, window.devicePixelRatio || 1);
    };
    applySize();
    game.start();
    const ro = new ResizeObserver(applySize);
    ro.observe(stage);
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT";
      if (typing) return;
      if (SCROLL_KEYS.includes(e.code)) e.preventDefault();
      if (e.code === "Escape" || e.code === "KeyP") game.togglePause();
      // El motor reinicia con Espacio; aquí solo se cierra el overlay para no
      // dejarlo colgado por encima de la partida nueva.
      if (e.code === "Space") setOver(null);
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
  const handleRestart = () => {
    gameRef.current?.restart();
    setOver(null);
  };
  const handleSave = async () => {
    if (!over || phase === "saving") return;
    setPhase("saving");
    setErrorMsg("");
    const res = await submitScore({
      gameId: GAME_ID,
      name,
      score: over.score,
      level: over.level,
    });
    if (res.ok) {
      setPhase("saved");
    } else {
      setPhase("error");
      setErrorMsg(res.error);
    }
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
      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{over.score.toLocaleString("es-ES")}</div>
            {phase === "saved" ? (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            ) : (
              <>
                <div className="input-row" style={{ flexWrap: "wrap" }}>
                  <input
                    value={name}
                    onChange={(e) =>
                      setName(
                        e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9_]/g, "")
                          .slice(0, 12),
                      )
                    }
                    placeholder="TUS INICIALES"
                    aria-label="Tus iniciales"
                    style={{ flex: "1 1 140px", minWidth: 0 }}
                  />
                  <button
                    className="btn yellow"
                    onClick={handleSave}
                    disabled={phase === "saving" || name.length === 0}
                    style={{ flex: "1 1 auto" }}
                  >
                    {phase === "saving" ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                  </button>
                </div>
                {phase === "error" && (
                  <div
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: "var(--magenta)",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {errorMsg}
                  </div>
                )}
              </>
            )}
            <div className="actions">
              <button className="btn" onClick={handleRestart}>
                JUGAR DE NUEVO
              </button>
              <Link className="btn magenta" href="/juego/rocas">
                VOLVER
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
