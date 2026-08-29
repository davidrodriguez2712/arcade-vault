// Motor de Snake — escrito desde cero (no hay juego de referencia).
//
// Sin dependencias de React ni de Next: se instancia con un <canvas>, se arranca
// con start() y se apaga con stop() / destroy(). El motor dibuja siempre en un
// espacio interno fijo de 800x600 (igual que `rocas` y `bloque-buster`). El
// escalado responsive vive solo en resize().
const W = 800;
const H = 600;
const CELL = 25;
const HUD_H = 50; // banda superior de HUD
const COLS = W / CELL; // 32
const ROWS = (H - HUD_H) / CELL; // 22 (área de juego 800x550 desde y=50)
const START_LEN = 4;
const POINTS_PER_FRUIT = 10;
const FRUITS_PER_TIER = 4;
// Tramos de velocidad en celdas/s; interval = 1 / cps. Sube uno cada 4 frutas.
const TIER_CELLS_PER_S = [7, 9, 11, 13, 15, 18];
const PIXEL_FONT = '"Press Start 2P", monospace';
const SNAKE_BODY = "#00ff88";
const SNAKE_HEAD = "#b9ffdb";
const GRID_LINE = "rgba(0, 255, 136, 0.08)";
const HUD_RULE = "rgba(0, 255, 136, 0.32)";
// Spritesheet de frutas: fila pixel-art de public/games/serpentina/fruits.png.
// Coordenadas copiadas de references/source-assets/snake-assets/sprites.js
// (fila y=136, alto 160). Se rota por estas 22 solo por estética.
const SPRITE_SRC = "/games/serpentina/fruits.png";
interface FruitCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}
const FRUIT_CROPS: FruitCrop[] = [
  { x: 34, y: 136, w: 110, h: 160 }, // banana
  { x: 186, y: 136, w: 150, h: 160 }, // orange
  { x: 378, y: 136, w: 110, h: 160 }, // grape
  { x: 540, y: 136, w: 130, h: 160 }, // garlic
  { x: 712, y: 136, w: 130, h: 160 }, // eggplant
  { x: 894, y: 136, w: 110, h: 160 }, // strawberry
  { x: 1066, y: 136, w: 110, h: 160 }, // cherry
  { x: 1228, y: 136, w: 130, h: 160 }, // carrot
  { x: 1400, y: 136, w: 130, h: 160 }, // mushroom
  { x: 1582, y: 136, w: 110, h: 160 }, // broccoli
  { x: 1734, y: 136, w: 150, h: 160 }, // watermelon
  { x: 1906, y: 136, w: 150, h: 160 }, // pepper
  { x: 2068, y: 136, w: 170, h: 160 }, // kiwi
  { x: 2250, y: 136, w: 140, h: 160 }, // lemon
  { x: 2432, y: 136, w: 130, h: 160 }, // peach
  { x: 2604, y: 136, w: 130, h: 160 }, // peanut
  { x: 2786, y: 136, w: 110, h: 160 }, // apple
  { x: 2948, y: 136, w: 130, h: 160 }, // tomato
  { x: 3110, y: 136, w: 150, h: 160 }, // berries
  { x: 3302, y: 136, w: 110, h: 160 }, // grapes2
  { x: 3454, y: 136, w: 150, h: 160 }, // pineapple
  { x: 3637, y: 136, w: 130, h: 160 }, // melon
];
// ¿El foco está en un campo de formulario? Para no capturar el teclado del juego
// mientras el jugador escribe sus iniciales en el overlay de fin de partida.
const isFormFieldFocused = (target: EventTarget | null): boolean => {
  const el = target instanceof HTMLElement ? target : null;
  const tag = el?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};
// Acciones de los botones táctiles (alternativa al teclado). Fijan la dirección.
export type TouchAction = "up" | "down" | "left" | "right";
export interface GameOverResult {
  score: number;
  level: number; // tramo de velocidad alcanzado, 1..6
}
type GameState = "playing" | "gameover";
interface Cell {
  col: number;
  row: number;
}
export class SnakeGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rafId: number | null = null;
  private lastTime: number | null = null;
  private paused = false;
  // Estado de partida. Se inicializa en initGame().
  private snake: Cell[] = []; // cabeza en el índice 0
  private dir: Cell = { col: 1, row: 0 };
  private nextDir: Cell = { col: 1, row: 0 };
  private fruit: Cell = { col: 0, row: 0 };
  private fruitSprite = 0; // índice 0..21 en FRUIT_CROPS
  private score = 0;
  private fruitsEaten = 0;
  private tier = 1; // 1..6
  private state: GameState = "playing";
  private tickAccum = 0; // segundos acumulados hacia el siguiente paso
  // Aviso de fin de partida al envoltorio React (una sola vez por partida).
  private onGameOver: ((result: GameOverResult) => void) | null = null;
  private gameOverNotified = false;
  // Spritesheet de frutas.
  private sprites: HTMLImageElement | null = null;
  private spritesReady = false;
  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas.");
    this.canvas = canvas;
    this.ctx = ctx;
    // Carga del spritesheet. Si falla o tarda, draw() usa un rombo de respaldo.
    if (typeof Image !== "undefined") {
      const img = new Image();
      img.onload = () => {
        this.spritesReady = true;
      };
      img.src = SPRITE_SRC;
      this.sprites = img;
    }
  }
  // Inicializa el estado, engancha el teclado y arranca el game loop.
  // Idempotente: si ya está corriendo, no hace nada.
  start(): void {
    if (this.rafId !== null) return;
    this.initGame();
    window.addEventListener("keydown", this.onKeyDown);
    this.lastTime = null;
    this.rafId = requestAnimationFrame(this.loop);
  }
  // Detiene el game loop y quita los listeners; el estado se conserva.
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
  // Registra el callback de fin de partida. Se dispara una vez, al chocar con una
  // pared o con el propio cuerpo.
  setOnGameOver(cb: (result: GameOverResult) => void): void {
    this.onGameOver = cb;
  }
  // Pausa lógica: el loop sigue pintando, pero no actualiza.
  setPaused(paused: boolean): void {
    this.paused = paused;
  }
  togglePause(): void {
    if (this.state === "gameover") return;
    this.paused = !this.paused;
  }
  // Ajusta el backing store del canvas al tamaño CSS del contenedor por el
  // devicePixelRatio y deja una transform que mapea el espacio interno 800x600
  // sobre ese backing store (proporción 4:3, letterbox vía object-fit).
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
    // Asignar width/height resetea la transform: se reaplica siempre.
    this.ctx.setTransform(pxW / W, 0, 0, pxH / H, 0, 0);
  }
  // Entrada de los botones táctiles. Fija la dirección (no sostenida): solo se
  // actúa en el flanco de subida.
  setInput(action: TouchAction, pressed: boolean): void {
    if (!pressed) return;
    if (action === "up") this.queueDir(0, -1);
    else if (action === "down") this.queueDir(0, 1);
    else if (action === "left") this.queueDir(-1, 0);
    else if (action === "right") this.queueDir(1, 0);
  }
  // ── Input ──────────────────────────────────────────────────────────────────
  private onKeyDown = (e: KeyboardEvent): void => {
    if (isFormFieldFocused(e.target)) return;
    if (e.code === "ArrowUp") this.queueDir(0, -1);
    else if (e.code === "ArrowDown") this.queueDir(0, 1);
    else if (e.code === "ArrowLeft") this.queueDir(-1, 0);
    else if (e.code === "ArrowRight") this.queueDir(1, 0);
  };
  // Bufferiza un giro. Ignora el opuesto exacto a la dirección actual (no se
  // puede reversar sobre el cuello).
  private queueDir(col: number, row: number): void {
    if (col === -this.dir.col && row === -this.dir.row) return;
    this.nextDir = { col, row };
  }
  // ── Partida ────────────────────────────────────────────────────────────────
  private initGame(): void {
    const midRow = Math.floor(ROWS / 2);
    const startCol = Math.floor(COLS / 2);
    this.snake = [];
    for (let i = 0; i < START_LEN; i++) {
      this.snake.push({ col: startCol - i, row: midRow });
    }
    this.dir = { col: 1, row: 0 };
    this.nextDir = { col: 1, row: 0 };
    this.score = 0;
    this.fruitsEaten = 0;
    this.tier = 1;
    this.fruitSprite = 0;
    this.state = "playing";
    this.gameOverNotified = false;
    this.paused = false;
    this.tickAccum = 0;
    this.placeFruit();
  }
  private placeFruit(): void {
    const free: Cell[] = [];
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (!this.snake.some((s) => s.col === c && s.row === r)) {
          free.push({ col: c, row: r });
        }
      }
    }
    if (free.length === 0) return; // tablero lleno: la partida ya habría acabado
    this.fruit = free[Math.floor(Math.random() * free.length)];
  }
  private endGame(): void {
    this.state = "gameover";
    if (!this.gameOverNotified) {
      this.gameOverNotified = true;
      this.onGameOver?.({ score: this.score, level: this.tier });
    }
  }
  // Un paso de la serpiente (lo llama el acumulador de tick en update()).
  private step(): void {
    if (this.state === "gameover") return;
    // Aplicar el giro bufferizado, salvo que sea opuesto a la dirección actual.
    const opposite =
      this.nextDir.col === -this.dir.col && this.nextDir.row === -this.dir.row;
    if (!opposite) this.dir = { col: this.nextDir.col, row: this.nextDir.row };
    else this.nextDir = { col: this.dir.col, row: this.dir.row };
    const head = this.snake[0];
    const nx = head.col + this.dir.col;
    const ny = head.row + this.dir.row;
    // Choque con la pared.
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
      this.endGame();
      return;
    }
    // Choque con el cuerpo (la cola se va a mover, así que no cuenta salvo que se coma).
    const ate = nx === this.fruit.col && ny === this.fruit.row;
    const body = ate ? this.snake : this.snake.slice(0, -1);
    if (body.some((s) => s.col === nx && s.row === ny)) {
      this.endGame();
      return;
    }
    this.snake.unshift({ col: nx, row: ny });
    if (ate) {
      this.score += POINTS_PER_FRUIT;
      this.fruitsEaten += 1;
      this.fruitSprite = (this.fruitSprite + 1) % FRUIT_CROPS.length;
      if (this.fruitsEaten % FRUITS_PER_TIER === 0) {
        this.tier = Math.min(this.tier + 1, TIER_CELLS_PER_S.length);
      }
      this.placeFruit();
    } else {
      this.snake.pop();
    }
  }
  // ── Update ─────────────────────────────────────────────────────────────────
  private update(dt: number): void {
    if (this.state === "gameover") return;
    this.tickAccum += dt;
    const interval = 1 / TIER_CELLS_PER_S[this.tier - 1];
    // Un paso como máximo por frame (dt ya está capado a 50 ms en el loop).
    if (this.tickAccum >= interval) {
      this.tickAccum -= interval;
      this.step();
    }
  }
  // ── Draw ───────────────────────────────────────────────────────────────────
  private roundRectPath(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  private drawGrid(): void {
    const { ctx } = this;
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= COLS; c++) {
      ctx.moveTo(c * CELL, HUD_H);
      ctx.lineTo(c * CELL, H);
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.moveTo(0, HUD_H + r * CELL);
      ctx.lineTo(W, HUD_H + r * CELL);
    }
    ctx.stroke();
    // Regla separadora del HUD.
    ctx.strokeStyle = HUD_RULE;
    ctx.beginPath();
    ctx.moveTo(0, HUD_H);
    ctx.lineTo(W, HUD_H);
    ctx.stroke();
  }
  private drawFruit(): void {
    const { ctx } = this;
    const cx = this.fruit.col * CELL + CELL / 2;
    const cy = HUD_H + this.fruit.row * CELL + CELL / 2;
    if (this.spritesReady && this.sprites) {
      const crop = FRUIT_CROPS[this.fruitSprite];
      const box = CELL * 1.3;
      const scale = Math.min(box / crop.w, box / crop.h);
      const dw = crop.w * scale;
      const dh = crop.h * scale;
      ctx.drawImage(
        this.sprites,
        crop.x,
        crop.y,
        crop.w,
        crop.h,
        cx - dw / 2,
        cy - dh / 2,
        dw,
        dh,
      );
      return;
    }
    // Respaldo procedural mientras el sprite no ha cargado.
    const rad = CELL * 0.42;
    ctx.fillStyle = "#ff2fa8";
    ctx.beginPath();
    ctx.moveTo(cx, cy - rad);
    ctx.lineTo(cx + rad, cy);
    ctx.lineTo(cx, cy + rad);
    ctx.lineTo(cx - rad, cy);
    ctx.closePath();
    ctx.fill();
  }
  private drawSnake(): void {
    const { ctx } = this;
    this.snake.forEach((seg, i) => {
      const x = seg.col * CELL + 2;
      const y = HUD_H + seg.row * CELL + 2;
      const s = CELL - 4;
      ctx.fillStyle = i === 0 ? SNAKE_HEAD : SNAKE_BODY;
      this.roundRectPath(x, y, s, s, 6);
      ctx.fill();
    });
  }
  private drawHud(): void {
    const { ctx } = this;
    ctx.font = `13px ${PIXEL_FONT}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#e6e9ff";
    ctx.fillText(`SCORE ${this.score.toLocaleString("es-ES")}`, 12, HUD_H / 2);
    ctx.textAlign = "center";
    ctx.fillStyle = "#8a8fb5";
    ctx.fillText(`LONGITUD ${this.snake.length}`, W / 2, HUD_H / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = SNAKE_BODY;
    ctx.fillText(`VEL. x${this.tier}`, W - 12, HUD_H / 2);
  }
  private draw(): void {
    const { ctx } = this;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    this.drawGrid();
    this.drawFruit();
    this.drawSnake();
    this.drawHud();
    if (this.paused && this.state !== "gameover") {
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#fff";
      ctx.font = `bold 30px ${PIXEL_FONT}`;
      ctx.fillText("EN PAUSA", W / 2, H / 2 - 12);
      ctx.font = `12px ${PIXEL_FONT}`;
      ctx.fillStyle = "rgba(255,255,255,0.65)";
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
