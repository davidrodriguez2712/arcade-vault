"use client";
import type { PointerEvent } from "react";
import type { TouchAction } from "./engine";
interface AsteroidsTouchControlsProps {
  onInput: (action: TouchAction, pressed: boolean) => void;
}
const BUTTONS: { action: TouchAction; glyph: string; label: string }[] = [
  { action: "left", glyph: "◄", label: "Rotar a la izquierda" },
  { action: "right", glyph: "►", label: "Rotar a la derecha" },
  { action: "thrust", glyph: "▲", label: "Propulsar" },
  { action: "fire", glyph: "●", label: "Disparar" },
];
export default function AsteroidsTouchControls({
  onInput,
}: AsteroidsTouchControlsProps) {
  const press = (action: TouchAction, pressed: boolean) => {
    return (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onInput(action, pressed);
    };
  };
  return (
    <div className="asteroids-touch">
      {BUTTONS.map(({ action, glyph, label }) => (
        <button
          key={action}
          type="button"
          className={`asteroids-touch-btn ${action}`}
          aria-label={label}
          onPointerDown={press(action, true)}
          onPointerUp={press(action, false)}
          onPointerCancel={press(action, false)}
          onPointerLeave={press(action, false)}
        >
          {glyph}
        </button>
      ))}
    </div>
  );
}
