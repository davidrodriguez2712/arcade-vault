"use client";
import type { PointerEvent } from "react";
export type PadControl = "up" | "down" | "left" | "right" | "a" | "b";
interface MobileGamepadProps<A extends string> {
  /** Clave ausente ⇒ botón atenuado (`.is-idle`), sin handlers. */
  map: Partial<Record<PadControl, A>>;
  onInput: (action: A, pressed: boolean) => void;
  /** Acento del D-pad y de `B`. Por defecto "cyan". */
  accent?: "cyan" | "green";
  label?: string;
}
const GLYPHS: Record<PadControl, string> = {
  up: "▲",
  down: "▼",
  left: "◄",
  right: "►",
  a: "A",
  b: "B",
};
const ARIA: Record<PadControl, string> = {
  up: "Arriba",
  down: "Abajo",
  left: "Izquierda",
  right: "Derecha",
  a: "Botón A",
  b: "Botón B",
};
export default function MobileGamepad<A extends string>({
  map,
  onInput,
  accent = "cyan",
  label,
}: MobileGamepadProps<A>) {
  const button = (control: PadControl) => {
    const action = map[control];
    const idle = action === undefined;
    const press =
      (pressed: boolean) => (e: PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (action !== undefined) onInput(action, pressed);
      };
    return (
      <button
        key={control}
        type="button"
        className={`pad-btn${idle ? " is-idle" : ""}`}
        data-control={control}
        aria-label={ARIA[control]}
        aria-disabled={idle || undefined}
        onPointerDown={idle ? undefined : press(true)}
        onPointerUp={idle ? undefined : press(false)}
        onPointerCancel={idle ? undefined : press(false)}
        onPointerLeave={idle ? undefined : press(false)}
      >
        {GLYPHS[control]}
      </button>
    );
  };
  return (
    <div
      className="mobile-gamepad"
      data-accent={accent === "green" ? "green" : undefined}
      role="group"
      aria-label={label ? `Mando ${label}` : "Mando en pantalla"}
    >
      <div className="pad-dpad">
        {button("up")}
        {button("left")}
        {button("right")}
        {button("down")}
      </div>
      <div className="pad-actions">
        {button("a")}
        {button("b")}
      </div>
    </div>
  );
}
