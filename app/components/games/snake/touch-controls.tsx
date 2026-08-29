"use client";
import type { PointerEvent } from "react";
import type { TouchAction } from "./engine";
interface SnakeTouchControlsProps {
  onInput: (action: TouchAction, pressed: boolean) => void;
}
const BUTTONS: { action: TouchAction; glyph: string; label: string }[] = [
  { action: "up", glyph: "▲", label: "Girar hacia arriba" },
  { action: "left", glyph: "◄", label: "Girar hacia la izquierda" },
  { action: "right", glyph: "►", label: "Girar hacia la derecha" },
  { action: "down", glyph: "▼", label: "Girar hacia abajo" },
];
export default function SnakeTouchControls({
  onInput,
}: SnakeTouchControlsProps) {
  const press = (action: TouchAction, pressed: boolean) => {
    return (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onInput(action, pressed);
    };
  };
  return (
    <div className="snake-touch">
      {BUTTONS.map(({ action, glyph, label }) => (
        <button
          key={action}
          type="button"
          className={`snake-touch-btn ${action}`}
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
