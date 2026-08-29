"use client";
import type { PointerEvent } from "react";
import type { TouchAction } from "./engine";
interface ArkanoidTouchControlsProps {
  onInput: (action: TouchAction, pressed: boolean) => void;
}
const BUTTONS: { action: TouchAction; glyph: string; label: string }[] = [
  { action: "left", glyph: "◄", label: "Mover la paleta a la izquierda" },
  { action: "right", glyph: "►", label: "Mover la paleta a la derecha" },
];
export default function ArkanoidTouchControls({
  onInput,
}: ArkanoidTouchControlsProps) {
  const press = (action: TouchAction, pressed: boolean) => {
    return (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onInput(action, pressed);
    };
  };
  return (
    <div className="arkanoid-touch">
      {BUTTONS.map(({ action, glyph, label }) => (
        <button
          key={action}
          type="button"
          className={`arkanoid-touch-btn ${action}`}
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
