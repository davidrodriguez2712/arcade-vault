// Sistema de skins compartido de Arcade Vault.
//
// Sin imports de React ni de Next: solo tipos, constantes y helpers de
// localStorage. Cada motor define su propia paleta (`<NOMBRE>_SKINS`) indexada
// por `SkinName`; el envoltorio "use client" persiste la preferencia con
// loadSkin/saveSkin y se la pasa al motor con setSkin().
export type SkinName = "clasico" | "neon" | "retro";
export const SKIN_NAMES: readonly SkinName[] = ["clasico", "neon", "retro"];
export const DEFAULT_SKIN: SkinName = "clasico";
export const SKIN_LABELS: Record<SkinName, string> = {
  clasico: "Clásico",
  neon: "Neón",
  retro: "Retro",
};
const KEY_PREFIX = "arcade-vault:skin:";
const isSkinName = (value: unknown): value is SkinName =>
  typeof value === "string" &&
  (SKIN_NAMES as readonly string[]).includes(value);
// Lee la skin guardada para un juego. Devuelve DEFAULT_SKIN si no hay valor
// válido o si localStorage no está disponible (SSR, modo privado, etc.).
export function loadSkin(gameId: string): SkinName {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + gameId);
    return isSkinName(raw) ? raw : DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}
// Guarda la skin elegida para un juego. Silencioso si localStorage falla.
export function saveSkin(gameId: string, skin: SkinName): void {
  try {
    window.localStorage.setItem(KEY_PREFIX + gameId, skin);
  } catch {
    // sin persistencia disponible: no pasa nada, se usa la default al recargar
  }
}
