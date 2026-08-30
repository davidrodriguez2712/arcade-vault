// Motor de Frogger ("ranaria") — escrito desde cero, canvas puro, sin sprites.
//
// Sin dependencias de React ni de Next: se instancia con un <canvas>, se arranca
// con start() y se apaga con stop() / destroy(). El motor dibuja siempre en un
// espacio interno fijo de 640x560 (16x14 celdas de 40 px); el escalado
// responsive vive solo en resize(). Mismo patrón que `rocas`, `caida`,
// `bloque-buster` y `serpentina`: HUD dentro del canvas + overlay React de fin
// de partida en el envoltorio (el canvas ya no pinta su propio GAME OVER).
import type { SkinName } from "../skins";
// ── Geometría de la cuadrícula ───────────────────────────────────────────────
const COLS = 16;
const ROWS = 14;
const CELL = 40; // px
const W = COLS * CELL; // 640
const H = ROWS * CELL; // 560
// Filas por zona (0 = arriba). El jugador avanza hacia arriba desde ROW_START.
// (La spec menciona de pasada "480 × 640"; el plan y las Decisions fijan
// 640 × 560 con 16 × 14 celdas de 40 px, que es lo que se implementa.)
const ROW_GOALS = 0; // fila de las 5 bocas destino
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6; // río: filas 1..6 (6 carriles)
const ROW_SAFE_MID = 7; // franja segura intermedia
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12; // carretera: filas 8..12 (5 carriles)
const ROW_START = 13; // base de salida
// ── Reglas ───────────────────────────────────────────────────────────────────
const START_LIVES = 3;
const HOP_MS = 120; // duración de la animación de salto de una celda
const GOAL_COUNT = 5;
const GOAL_WIDTH = 2; // columnas que ocupa cada boca
const GOAL_GAP = 1; // columnas de muro entre bocas y en los extremos
const ROUND_TIME_BASE = 15; // s de temporizador al nivel 1
const ROUND_TIME_MIN = 6; // s (suelo del temporizador en niveles altos)
const ROUND_TIME_STEP = 1.5; // s menos por nivel
const LEVEL_SPEED_MUL = 1.15; // +15 % de velocidad de entidades por nivel
// Ciclo de inmersión de las tortugas, en segundos: 3 s visibles + 1.5 s bajo el agua.
const TURTLE_CYCLE = 4.5;
const TURTLE_VISIBLE = 3;
// Puntuación.
const PTS_FORWARD = 10; // por cada fila nueva alcanzada hacia arriba en la ronda
const PTS_GOAL = 50; // por ocupar una boca destino
const PTS_ROUND = 200; // por completar la ronda (las 5 bocas)
const PTS_TIME_BONUS = 10; // × segundos restantes al ocupar una boca
const PIXEL_FONT = '"Press Start 2P", monospace';
// Columna izquierda de cada boca: [1, 4, 7, 10, 13] con GOAL_WIDTH=2, GOAL_GAP=1.
const GOAL_COLS: readonly number[] = Array.from(
  { length: GOAL_COUNT },
  (_, i) => GOAL_GAP + i * (GOAL_WIDTH + GOAL_GAP),
);
// ── Tipos locales ────────────────────────────────────────────────────────────
type Direction = "up" | "down" | "left" | "right";
type LaneKind = "road" | "river";
type EntityType = "car" | "truck" | "log" | "turtle";
interface Entity {
  col: number; // borde izquierdo en celdas (float; puede ser < 0 o > COLS)
  width: number; // ancho en celdas
  type: EntityType;
  colorIdx: number; // índice de color estable (coches) o veta (troncos)
  submerged?: boolean; // solo tortugas: bajo el agua ⇒ no dan apoyo
  phase?: number; // solo tortugas: desfase del ciclo de inmersión, en s
}
interface Lane {
  row: number;
  kind: LaneKind;
  speed: number; // celdas/segundo (ya escalado por nivel)
  dir: 1 | -1;
  span: number; // periodo de repetición para el wrap uniforme, en celdas
  entities: Entity[];
}
// `fromCol/fromRow` (no están en la spec) se guardan para interpolar el dibujo
// del salto; la lógica de celda sigue siendo discreta.
interface Frog {
  col: number; // float mientras la rana viaja sobre un tronco
  row: number;
  animating: boolean;
  animT: number; // ms transcurridos de la animación de salto
  fromCol: number;
  fromRow: number;
  targetCol: number;
  targetRow: number;
}
// ── Skins ────────────────────────────────────────────────────────────────────
// Un rol de color por uso real del canvas; ningún literal de color suelto en los
// draw(). `clasico` copia la paleta arcade original; `neon` y `retro` son el
// andamiaje para que `skin-designer` los afine después.
export interface FroggerPalette {
  roadBg: string;
  riverBg: string;
  safeBg: string;
  goalZoneBg: string;
  goalBay: string; // hueco de boca libre
  goalBorder: string; // borde dorado de la fila de metas
  grid: string;
  cars: string[]; // colores de coche (colorIdx % length)
  truckBody: string;
  truckCab: string;
  log: string;
  logLine: string; // veta del tronco
  turtle: string;
  turtleShell: string;
  turtleSubmerged: string; // contorno de tortuga sumergida
  frog: string;
  frogLeg: string;
  frogEye: string;
  frogPupil: string;
  goalFrog: string; // silueta de rana en boca ocupada
  hudText: string;
  hudAccent: string;
  hudDim: string;
  timeOk: string; // barra de tiempo llena
  timeWarn: string;
  timeDanger: string;
  overlayTitle: string;
  overlayDim: string;
  glow: number; // shadowBlur (0 = sin brillo)
}
export const FROGGER_SKINS: Record<SkinName, FroggerPalette> = {
  clasico: {
    roadBg: "#111318",
    riverBg: "#0b2f6b",
    safeBg: "#123d1e",
    goalZoneBg: "#0d2a14",
    goalBay: "#1c7a3a",
    goalBorder: "#e8b23a",
    grid: "rgba(255,255,255,0.05)",
    cars: ["#e8443b", "#f2c53d", "#3d7cf2", "#c94fd6"],
    truckBody: "#c9ccd6",
    truckCab: "#8a8f9e",
    log: "#7a4a26",
    logLine: "rgba(0,0,0,0.28)",
    turtle: "#2fae5f",
    turtleShell: "#1c6b3a",
    turtleSubmerged: "rgba(120,220,160,0.35)",
    frog: "#4dff5a",
    frogLeg: "#2fae3a",
    frogEye: "#ffffff",
    frogPupil: "#0a0a0a",
    goalFrog: "rgba(120,220,140,0.5)",
    hudText: "#e6e9ff",
    hudAccent: "#4dff5a",
    hudDim: "#8a8fb5",
    timeOk: "#4dff5a",
    timeWarn: "#f2c53d",
    timeDanger: "#e8443b",
    overlayTitle: "#ffffff",
    overlayDim: "rgba(255,255,255,0.65)",
    glow: 0,
  },
  neon: {
    roadBg: "#05040c",
    riverBg: "#04123a",
    safeBg: "#04221a",
    goalZoneBg: "#031a12",
    goalBay: "#00ff88",
    goalBorder: "#f5ff00",
    grid: "rgba(0,245,255,0.08)",
    cars: ["#ff006e", "#f5ff00", "#00f5ff", "#b14dff"],
    truckBody: "#00f5ff",
    truckCab: "#0096a8",
    log: "#8a5a2c",
    logLine: "rgba(0,0,0,0.35)",
    turtle: "#00ff88",
    turtleShell: "#00a85a",
    turtleSubmerged: "rgba(0,255,136,0.3)",
    frog: "#7dff00",
    frogLeg: "#00b84a",
    frogEye: "#ffffff",
    frogPupil: "#04123a",
    goalFrog: "rgba(0,255,136,0.5)",
    hudText: "#00f5ff",
    hudAccent: "#ff006e",
    hudDim: "rgba(0,245,255,0.6)",
    timeOk: "#00ff88",
    timeWarn: "#f5ff00",
    timeDanger: "#ff006e",
    overlayTitle: "#ff006e",
    overlayDim: "rgba(0,245,255,0.6)",
    glow: 12,
  },
  retro: {
    roadBg: "#0a0600",
    riverBg: "#0d0a02",
    safeBg: "#0d0900",
    goalZoneBg: "#0a0700",
    goalBay: "#ffb000",
    goalBorder: "#ffd98a",
    grid: "rgba(255,176,0,0.08)",
    cars: ["#ffb000", "#ffd98a", "#d98e2a", "#ffe4b0"],
    truckBody: "#ffd98a",
    truckCab: "#b3771d",
    log: "#7a5a2c",
    logLine: "rgba(0,0,0,0.3)",
    turtle: "#ffb000",
    turtleShell: "#b3771d",
    turtleSubmerged: "rgba(255,176,0,0.3)",
    frog: "#ffb000",
    frogLeg: "#b3771d",
    frogEye: "#ffe4b0",
    frogPupil: "#0a0600",
    goalFrog: "rgba(255,176,0,0.5)",
    hudText: "#ffb000",
    hudAccent: "#ffd98a",
    hudDim: "rgba(255,176,0,0.55)",
    timeOk: "#ffb000",
    timeWarn: "#ffd98a",
    timeDanger: "#d98e2a",
    overlayTitle: "#ffb000",
    overlayDim: "rgba(255,176,0,0.55)",
    glow: 0,
  },
};
// ── Construcción del mapa de carriles ────────────────────────────────────────
interface LaneConfig {
  speed: number; // celdas/s base (nivel 1)
  type: EntityType;
  width: number;
  count: number;
}
// Carretera: 5 carriles (filas 8..12), sentidos alternos, huecos atravesables.
const ROAD_LANES: readonly LaneConfig[] = [
  { speed: 2.2, type: "car", width: 1, count: 3 },
  { speed: 3.6, type: "truck", width: 2, count: 2 },
  { speed: 2.8, type: "car", width: 1, count: 4 },
  { speed: 4.4, type: "truck", width: 3, count: 2 },
  { speed: 3.0, type: "car", width: 1, count: 3 },
];
// Río: 6 carriles (filas 1..6), alterna troncos y grupos de tortugas.
const RIVER_LANES: readonly LaneConfig[] = [
  { speed: 1.6, type: "log", width: 3, count: 3 },
  { speed: 1.2, type: "turtle", width: 2, count: 3 },
  { speed: 2.2, type: "log", width: 2, count: 4 },
  { speed: 1.4, type: "turtle", width: 3, count: 3 },
  { speed: 1.8, type: "log", width: 4, count: 2 },
  { speed: 1.0, type: "turtle", width: 2, count: 3 },
];
function makeLane(
  row: number,
  kind: LaneKind,
  cfg: LaneConfig,
  dir: 1 | -1,
  mul: number,
  seed: number,
): Lane {
  // Hueco mínimo entre entidades, en celdas: siempre deja pasar a la rana.
  const gap = kind === "road" ? 3 : 2;
  const stride = cfg.width + gap;
  const span = stride * cfg.count; // periodo de repetición del carril
  const entities: Entity[] = [];
  for (let k = 0; k < cfg.count; k++) {
    const e: Entity = {
      col: k * stride - (seed % 2), // pequeño desfase por carril
      width: cfg.width,
      type: cfg.type,
      colorIdx: (seed + k) % 4,
    };
    if (cfg.type === "turtle") {
      e.phase = (k * 1.5 + seed * 0.75) % TURTLE_CYCLE;
      e.submerged = false;
    }
    entities.push(e);
  }
  return { row, kind, speed: cfg.speed * mul, dir, span, entities };
}
// Reconstruye todos los carriles para un nivel dado (velocidades escaladas).
function buildLanes(level: number): Lane[] {
  const mul = Math.pow(LEVEL_SPEED_MUL, level - 1);
  const lanes: Lane[] = [];
  ROAD_LANES.forEach((cfg, i) => {
    lanes.push(
      makeLane(ROW_ROAD_TOP + i, "road", cfg, i % 2 === 0 ? -1 : 1, mul, i),
    );
  });
  RIVER_LANES.forEach((cfg, i) => {
    lanes.push(
      makeLane(ROW_RIVER_TOP + i, "river", cfg, i % 2 === 0 ? 1 : -1, mul, i),
    );
  });
  return lanes;
}
// ── Utilidades ───────────────────────────────────────────────────────────────
const isFormFieldFocused = (target: EventTarget | null): boolean => {
  const el = target instanceof HTMLElement ? target : null;
  const tag = el?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};
export type TouchAction = Direction;
export interface GameOverResult {
  score: number;
  level: number;
}
type GameState = "playing" | "gameover";
export class FroggerGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rafId: number | null = null;
  private lastTime: number | null = null;
  private paused = false;
  private skin: SkinName = "clasico";
  // Estado de partida (se inicializa en initGame()).
  private lanes: Lane[] = [];
  private frog: Frog = FroggerGame.freshFrog();
  private goals: boolean[] = new Array(GOAL_COUNT).fill(false);
  private topRowReached = ROW_START; // fila más alta pisada en la ronda actual
  private score = 0;
  private lives = START_LIVES;
  private level = 1;
  private timeLeft = ROUND_TIME_BASE;
  private clock = 0; // segundos totales, alimenta el ciclo de las tortugas
  private state: GameState = "playing";
  private pendingDir: Direction | null = null;
  private onGameOver: ((result: GameOverResult) => void) | null = null;
  private gameOverNotified = false;
  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas.");
    this.canvas = canvas;
    this.ctx = ctx;
  }
  private static freshFrog(): Frog {
    const startCol = Math.floor(COLS / 2);
    return {
      col: startCol,
      row: ROW_START,
      animating: false,
      animT: 0,
      fromCol: startCol,
      fromRow: ROW_START,
      targetCol: startCol,
      targetRow: ROW_START,
    };
  }
  // Arranca el estado, engancha el teclado y lanza el game loop. Idempotente.
  start(): void {
    if (this.rafId !== null) return;
    this.initGame();
    window.addEventListener("keydown", this.onKeyDown);
    this.lastTime = null;
    this.rafId = requestAnimationFrame(this.loop);
  }
  // Detiene el loop y quita los listeners; el estado se conserva.
  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener("keydown", this.onKeyDown);
  }
  // stop() + libera referencias. Idempotente.
  destroy(): void {
    this.stop();
    this.onGameOver = null;
  }
  // Reinicia la partida desde cero.
  restart(): void {
    this.initGame();
  }
  setOnGameOver(cb: (result: GameOverResult) => void): void {
    this.onGameOver = cb;
  }
  // Cambia la skin al vuelo: no reinicia la partida ni toca la puntuación.
  setSkin(name: SkinName): void {
    this.skin = name;
  }
  setPaused(paused: boolean): void {
    this.paused = paused;
  }
  togglePause(): void {
    if (this.state === "gameover") return;
    this.paused = !this.paused;
  }
  // Entrada de los botones táctiles / teclado: encola una dirección de salto.
  setInput(action: TouchAction, pressed: boolean): void {
    if (!pressed) return;
    this.pendingDir = action;
  }
  // Ajusta el backing store al tamaño CSS del contenedor por el devicePixelRatio
  // y deja una transform que mapea el espacio interno 640x560 (letterbox 8:7).
  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    const targetAspect = W / H;
    let cw = cssWidth;
    let ch = cssWidth / targetAspect;
    if (ch > cssHeight) {
      ch = cssHeight;
      cw = cssHeight * targetAspect;
    }
    const pxW = Math.max(1, Math.round(cw * dpr));
    const pxH = Math.max(1, Math.round(ch * dpr));
    if (this.canvas.width !== pxW) this.canvas.width = pxW;
    if (this.canvas.height !== pxH) this.canvas.height = pxH;
    this.ctx.setTransform(pxW / W, 0, 0, pxH / H, 0, 0);
  }
  // ── Input ──────────────────────────────────────────────────────────────────
  private onKeyDown = (e: KeyboardEvent): void => {
    if (isFormFieldFocused(e.target)) return;
    if (e.code === "ArrowUp") this.pendingDir = "up";
    else if (e.code === "ArrowDown") this.pendingDir = "down";
    else if (e.code === "ArrowLeft") this.pendingDir = "left";
    else if (e.code === "ArrowRight") this.pendingDir = "right";
  };
  // ── Partida ────────────────────────────────────────────────────────────────
  private initGame(): void {
    this.level = 1;
    this.score = 0;
    this.lives = START_LIVES;
    this.state = "playing";
    this.gameOverNotified = false;
    this.paused = false;
    this.pendingDir = null;
    this.clock = 0;
    this.lanes = buildLanes(this.level);
    this.startRound(true);
  }
  // Prepara una ronda: rana a la salida, bocas vacías (si `reset`), temporizador.
  private startRound(reset: boolean): void {
    this.frog = FroggerGame.freshFrog();
    this.topRowReached = ROW_START;
    this.pendingDir = null;
    if (reset) this.goals = new Array(GOAL_COUNT).fill(false);
    this.timeLeft = this.roundTime();
  }
  private roundTime(): number {
    return Math.max(
      ROUND_TIME_MIN,
      ROUND_TIME_BASE - (this.level - 1) * ROUND_TIME_STEP,
    );
  }
  // Carril cuya fila coincide con `row` (o undefined en zonas seguras / metas).
  private laneAt(row: number): Lane | undefined {
    return this.lanes.find((l) => l.row === row);
  }
  // Entidad de río sobre la que descansa la rana, o null si está sobre agua.
  // Una tortuga sumergida no cuenta como soporte.
  private getSupport(): Entity | null {
    const lane = this.laneAt(this.frog.row);
    if (!lane || lane.kind !== "river") return null;
    const c = this.frog.col + 0.5; // centro de la rana, en celdas
    for (const e of lane.entities) {
      for (const off of [0, -lane.span, lane.span]) {
        const left = e.col + off;
        if (c >= left && c <= left + e.width) {
          return e.type === "turtle" && e.submerged ? null : e;
        }
      }
    }
    return null;
  }
  // Inicia la animación de salto de una celda si el destino es válido.
  private startHop(dir: Direction): void {
    const f = this.frog;
    const baseCol = Math.round(f.col);
    let tc = baseCol;
    let tr = f.row;
    if (dir === "left") tc -= 1;
    else if (dir === "right") tc += 1;
    else if (dir === "up") tr -= 1;
    else tr += 1;
    // Límites laterales: la rana no puede salir por los bordes.
    if (tc < 0 || tc > COLS - 1) return;
    tr = Math.max(ROW_GOALS, Math.min(ROW_START, tr));
    if (tc === baseCol && tr === f.row) return; // el salto no movería nada
    f.fromCol = f.col;
    f.fromRow = f.row;
    f.targetCol = tc;
    f.targetRow = tr;
    f.animating = true;
    f.animT = 0;
  }
  // Resuelve la celda a la que acaba de saltar la rana: puntos por avance, meta,
  // o muerte inmediata si aterriza sobre un coche o sobre agua.
  private resolveLanding(): void {
    const f = this.frog;
    if (f.row < this.topRowReached) {
      this.score += PTS_FORWARD * (this.topRowReached - f.row);
      this.topRowReached = f.row;
    }
    if (f.row === ROW_GOALS) {
      this.checkGoal();
      return;
    }
    const lane = this.laneAt(f.row);
    if (lane?.kind === "road") {
      if (this.checkRoadCollision()) this.killFrog();
    } else if (lane?.kind === "river") {
      if (!this.getSupport()) this.killFrog();
    }
  }
  // ¿Hay un vehículo de carretera sobre la columna de la rana en su fila?
  private checkRoadCollision(): boolean {
    const lane = this.laneAt(this.frog.row);
    if (!lane || lane.kind !== "road") return false;
    const c = this.frog.col + 0.5;
    for (const e of lane.entities) {
      for (const off of [0, -lane.span, lane.span]) {
        const left = e.col + off;
        if (c >= left && c <= left + e.width) return true;
      }
    }
    return false;
  }
  // La rana está en la fila de metas: ocupa una boca libre o muere.
  private checkGoal(): void {
    const c = this.frog.col;
    const idx = GOAL_COLS.findIndex(
      (left) => c >= left && c < left + GOAL_WIDTH,
    );
    if (idx === -1 || this.goals[idx]) {
      this.killFrog(); // muro entre bocas o boca ya ocupada
      return;
    }
    this.goals[idx] = true;
    this.score += PTS_GOAL + Math.floor(this.timeLeft) * PTS_TIME_BONUS;
    if (this.goals.every(Boolean)) this.completeRound();
    else this.startRound(false);
  }
  // Las 5 bocas están llenas: sube de nivel y reconstruye los carriles.
  private completeRound(): void {
    this.score += PTS_ROUND;
    this.level += 1;
    this.lanes = buildLanes(this.level);
    this.startRound(true);
  }
  // Resta una vida. A 0 vidas dispara onGameOver una sola vez; si no, revive.
  private killFrog(): void {
    if (this.state === "gameover") return;
    this.lives -= 1;
    if (this.lives <= 0) {
      this.lives = 0;
      this.state = "gameover";
      if (!this.gameOverNotified) {
        this.gameOverNotified = true;
        this.onGameOver?.({ score: this.score, level: this.level });
      }
      return;
    }
    this.startRound(false);
  }
  // ── Update ─────────────────────────────────────────────────────────────────
  private update(dt: number): void {
    if (this.state === "gameover") return;
    this.clock += dt;
    // Avance de las entidades de cada carril, con wrap uniforme por `span`.
    for (const lane of this.lanes) {
      const move = lane.speed * lane.dir * dt;
      for (const e of lane.entities) {
        e.col += move;
        if (e.col > COLS) e.col -= lane.span;
        else if (e.col + e.width < 0) e.col += lane.span;
        if (e.type === "turtle") {
          const t = (this.clock + (e.phase ?? 0)) % TURTLE_CYCLE;
          e.submerged = t >= TURTLE_VISIBLE;
        }
      }
    }
    // ── Temporizador de ronda ──────────────────────────────────────────────
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.killFrog();
      return;
    }
    // ── Rana ────────────────────────────────────────────────────────────────
    const f = this.frog;
    if (f.animating) {
      f.animT += dt * 1000;
      if (f.animT >= HOP_MS) {
        f.col = f.targetCol;
        f.row = f.targetRow;
        f.animating = false;
        f.animT = 0;
        this.resolveLanding();
      }
      return;
    }
    if (this.pendingDir) {
      this.startHop(this.pendingDir);
      this.pendingDir = null;
      return;
    }
    // Reposo: deriva sobre el río y peligros continuos (coche que embiste,
    // tortuga que se sumerge, arrastre fuera del río).
    const lane = this.laneAt(f.row);
    if (lane?.kind === "river") {
      if (!this.getSupport()) {
        this.killFrog();
        return;
      }
      f.col += lane.speed * lane.dir * dt;
      if (f.col < 0 || f.col > COLS - 1) {
        this.killFrog();
        return;
      }
    } else if (lane?.kind === "road") {
      if (this.checkRoadCollision()) {
        this.killFrog();
        return;
      }
    }
  }
  // ── Draw ───────────────────────────────────────────────────────────────────
  private rowY(row: number): number {
    return row * CELL;
  }
  private drawZones(): void {
    const { ctx } = this;
    const pal = FROGGER_SKINS[this.skin];
    ctx.fillStyle = pal.goalZoneBg;
    ctx.fillRect(0, this.rowY(ROW_GOALS), W, CELL);
    ctx.fillStyle = pal.riverBg;
    ctx.fillRect(
      0,
      this.rowY(ROW_RIVER_TOP),
      W,
      CELL * (ROW_RIVER_BOT - ROW_RIVER_TOP + 1),
    );
    ctx.fillStyle = pal.safeBg;
    ctx.fillRect(0, this.rowY(ROW_SAFE_MID), W, CELL);
    ctx.fillStyle = pal.roadBg;
    ctx.fillRect(
      0,
      this.rowY(ROW_ROAD_TOP),
      W,
      CELL * (ROW_ROAD_BOT - ROW_ROAD_TOP + 1),
    );
    ctx.fillStyle = pal.safeBg;
    ctx.fillRect(0, this.rowY(ROW_START), W, CELL);
    // Bocas destino: hueco verde para las libres, borde dorado de la fila.
    const y = this.rowY(ROW_GOALS);
    ctx.fillStyle = pal.goalBay;
    GOAL_COLS.forEach((c, i) => {
      if (!this.goals[i]) ctx.fillRect(c * CELL, y, GOAL_WIDTH * CELL, CELL);
    });
    ctx.strokeStyle = pal.goalBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, y + 1, W - 2, CELL - 2);
  }
  private drawEntities(): void {
    const { ctx } = this;
    const pal = FROGGER_SKINS[this.skin];
    ctx.save();
    ctx.shadowBlur = pal.glow;
    for (const lane of this.lanes) {
      const y = this.rowY(lane.row);
      for (const e of lane.entities) {
        // Dibuja la entidad y su copia envuelta, para que cruce el borde limpio.
        this.drawEntity(e, e.col * CELL, y, pal);
        this.drawEntity(e, (e.col - lane.span) * CELL, y, pal);
        this.drawEntity(e, (e.col + lane.span) * CELL, y, pal);
      }
    }
    ctx.restore();
  }
  private drawEntity(
    e: Entity,
    x: number,
    y: number,
    pal: FroggerPalette,
  ): void {
    const { ctx } = this;
    const w = e.width * CELL;
    const pad = 4;
    if (e.type === "car") {
      const color = pal.cars[e.colorIdx % pal.cars.length];
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      this.roundRect(x + pad, y + pad + 4, w - pad * 2, CELL - pad * 2 - 8, 6);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 0;
      const r = 4;
      ctx.beginPath();
      ctx.arc(x + pad + 8, y + CELL - pad - 6, r, 0, Math.PI * 2);
      ctx.arc(x + w - pad - 8, y + CELL - pad - 6, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = pal.glow;
    } else if (e.type === "truck") {
      ctx.fillStyle = pal.truckBody;
      ctx.shadowColor = pal.truckBody;
      this.roundRect(x + pad, y + pad + 3, w - pad * 2, CELL - pad * 2 - 6, 4);
      ctx.fill();
      ctx.fillStyle = pal.truckCab;
      ctx.shadowBlur = 0;
      const cabW = CELL * 0.6;
      ctx.fillRect(x + pad, y + pad + 3, cabW, CELL - pad * 2 - 6);
      ctx.shadowBlur = pal.glow;
    } else if (e.type === "log") {
      ctx.fillStyle = pal.log;
      ctx.shadowColor = pal.log;
      this.roundRect(x + 1, y + pad, w - 2, CELL - pad * 2, 8);
      ctx.fill();
      ctx.strokeStyle = pal.logLine;
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      for (let i = 1; i < e.width; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * CELL, y + pad + 2);
        ctx.lineTo(x + i * CELL, y + CELL - pad - 2);
        ctx.stroke();
      }
      ctx.shadowBlur = pal.glow;
    } else {
      // Tortugas: un círculo por celda del grupo.
      for (let i = 0; i < e.width; i++) {
        const cx = x + i * CELL + CELL / 2;
        const cy = y + CELL / 2;
        const rad = CELL * 0.4;
        if (e.submerged) {
          ctx.strokeStyle = pal.turtleSubmerged;
          ctx.lineWidth = 2;
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(cx, cy, rad, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = pal.glow;
        } else {
          ctx.fillStyle = pal.turtle;
          ctx.shadowColor = pal.turtle;
          ctx.beginPath();
          ctx.arc(cx, cy, rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = pal.turtleShell;
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(cx, cy, rad * 0.55, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = pal.glow;
        }
      }
    }
  }
  private drawFrog(): void {
    const { ctx } = this;
    const pal = FROGGER_SKINS[this.skin];
    // Posición interpolada durante el salto.
    let cx: number;
    let cy: number;
    if (this.frog.animating) {
      const k = Math.min(1, this.frog.animT / HOP_MS);
      cx =
        (this.frog.fromCol + (this.frog.targetCol - this.frog.fromCol) * k) *
        CELL;
      cy =
        (this.frog.fromRow + (this.frog.targetRow - this.frog.fromRow) * k) *
        CELL;
    } else {
      cx = this.frog.col * CELL;
      cy = this.frog.row * CELL;
    }
    const midX = cx + CELL / 2;
    const midY = cy + CELL / 2;
    ctx.save();
    ctx.shadowBlur = pal.glow;
    ctx.shadowColor = pal.frog;
    // Patas: extendidas en diagonal durante el salto, recogidas en reposo.
    const legOut = this.frog.animating ? 13 : 8;
    ctx.strokeStyle = pal.frogLeg;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const sx of [-1, 1]) {
      ctx.moveTo(midX + sx * 6, midY - 3);
      ctx.lineTo(midX + sx * legOut, midY - legOut + 4);
      ctx.moveTo(midX + sx * 6, midY + 3);
      ctx.lineTo(midX + sx * legOut, midY + legOut - 4);
    }
    ctx.stroke();
    ctx.fillStyle = pal.frog;
    ctx.beginPath();
    ctx.ellipse(midX, midY, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Ojos.
    ctx.fillStyle = pal.frogEye;
    ctx.beginPath();
    ctx.arc(midX - 5, midY - 6, 3.5, 0, Math.PI * 2);
    ctx.arc(midX + 5, midY - 6, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.frogPupil;
    ctx.beginPath();
    ctx.arc(midX - 5, midY - 6, 1.6, 0, Math.PI * 2);
    ctx.arc(midX + 5, midY - 6, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  private drawHud(): void {
    const { ctx } = this;
    const pal = FROGGER_SKINS[this.skin];
    ctx.font = `11px ${PIXEL_FONT}`;
    ctx.textBaseline = "middle";
    const midY = this.rowY(ROW_GOALS) + CELL / 2;
    ctx.textAlign = "left";
    ctx.fillStyle = pal.hudText;
    ctx.fillText(`${this.score.toLocaleString("es-ES")}`, 10, midY);
    ctx.textAlign = "center";
    ctx.fillStyle = pal.hudDim;
    ctx.fillText(`NIVEL ${this.level}`, W / 2, midY);
    ctx.textAlign = "right";
    ctx.fillStyle = pal.hudAccent;
    ctx.fillText("●".repeat(Math.max(0, this.lives)), W - 10, midY);
    // Barra de tiempo restante en el borde inferior de la fila 0.
    const frac = Math.max(0, Math.min(1, this.timeLeft / this.roundTime()));
    const barH = 5;
    ctx.fillStyle =
      frac > 0.5 ? pal.timeOk : frac > 0.25 ? pal.timeWarn : pal.timeDanger;
    ctx.fillRect(0, this.rowY(ROW_GOALS) + CELL - barH, W * frac, barH);
  }
  private roundRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    const { ctx } = this;
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
  private draw(): void {
    const { ctx } = this;
    const pal = FROGGER_SKINS[this.skin];
    ctx.fillStyle = pal.roadBg;
    ctx.fillRect(0, 0, W, H);
    this.drawZones();
    this.drawEntities();
    this.drawFrog();
    this.drawHud();
    if (this.paused && this.state !== "gameover") {
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = pal.overlayTitle;
      ctx.font = `bold 26px ${PIXEL_FONT}`;
      ctx.fillText("EN PAUSA", W / 2, H / 2 - 10);
      ctx.font = `10px ${PIXEL_FONT}`;
      ctx.fillStyle = pal.overlayDim;
      ctx.fillText("ESC / P PARA CONTINUAR", W / 2, H / 2 + 16);
    }
    // El texto de GAME OVER lo pinta el overlay React del envoltorio.
  }
  // ── Loop ───────────────────────────────────────────────────────────────────
  private loop = (ts: number): void => {
    const dt =
      this.lastTime === null ? 0 : Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    if (!this.paused) this.update(dt);
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };
}
