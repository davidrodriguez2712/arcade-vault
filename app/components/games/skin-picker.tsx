"use client";
// Selector de skin compartido. No persiste nada por su cuenta: el envoltorio de
// cada juego lleva el estado y llama a loadSkin/saveSkin.
import { SKIN_LABELS, SKIN_NAMES, type SkinName } from "./skins";
interface SkinPickerProps {
  gameId: string;
  value: SkinName;
  onChange: (skin: SkinName) => void;
}
export default function SkinPicker({
  gameId,
  value,
  onChange,
}: SkinPickerProps) {
  return (
    <div className="skin-picker" role="group" aria-label="Skin del juego">
      {SKIN_NAMES.map((skin) => (
        <button
          key={skin}
          type="button"
          className={"skin-picker-btn" + (skin === value ? " is-active" : "")}
          aria-pressed={skin === value}
          onClick={() => onChange(skin)}
          data-game={gameId}
        >
          {SKIN_LABELS[skin]}
        </button>
      ))}
    </div>
  );
}
