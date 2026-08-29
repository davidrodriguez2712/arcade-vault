"use client";
import type { PointerEvent } from "react";
import type { TouchAction } from "./engine";
interface TetrisTouchControlsProps {
  onInput: (action: TouchAction, pressed: boolean) => void;
}
const BUTTONS: { action: TouchAction; glyph: string; label: string }[] = [
  { action: "left", glyph: "◄", label: "Mover a la izquierda" },
  { action: "right", glyph: "►", label: "Mover a la derecha" },
  { action: "rotate", glyph: "⟳", label: "Rotar" },
  { action: "down", glyph: "▼", label: "Bajar (soft drop)" },
  { action: "drop", glyph: "⤓", label: "Caída instantánea" },
];
export default function TetrisTouchControls({
  onInput,
}: TetrisTouchControlsProps) {
  const press = (action: TouchAction, pressed: boolean) => {
    return (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onInput(action, pressed);
    };
  };
  return (
    <div className="tetris-touch">
      {BUTTONS.map(({ action, glyph, label }) => (
        <button
          key={action}
          type="button"
          className={`tetris-touch-btn ${action}`}
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
