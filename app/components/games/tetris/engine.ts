// Motor de Tetris — portado de references/started-games/03-tetris/game.js
//
// Sin dependencias de React ni de Next: se instancia con un <canvas>, se arranca
// con start() y se apaga con stop() / destroy(). El motor dibuja siempre en un
// espacio interno fijo de 480x600 — el tablero 10x20 (a 30 px) ocupa 0..300 y el
// panel lateral (SCORE / LINES / LEVEL / NEXT) ocupa 300..480. El escalado
// responsive vive solo en resize().
const W = 480;
const H = 600;
const COLS = 10;
const ROWS = 20;
const BLOCK = 30; // COLS*BLOCK = 300 (tablero); el panel ocupa 300..480
const PANEL_X = COLS * BLOCK;
// Puntos por 0/1/2/3/4 líneas, multiplicado por el nivel (tabla clásica de game.js).
const LINE_SCORES = [0, 100, 300, 500, 800];
// Paleta neon de globals.css (el canvas no puede leer las CSS vars sin fricción).
// Índices 1..7 = I O T S Z J L. El 0 es "celda vacía".
const COLORS = [
  "",
  "#00f5ff", // I — cyan
  "#f5ff00", // O — yellow
  "#ff006e", // T — magenta
  "#00ff88", // S — green
  "#d97a3a", // Z — bronze
  "#c7d0e0", // J — silver
  "#ffcf3a", // L — gold
];
// Piezas como matrices cuadradas; el valor de celda es el índice de color.
// Sin la 8ª pieza "tuerca" del game.js de referencia (rompía el clearLines).
const PIECES: number[][][] = [
  [], // 0 — sin usar
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
];
const GRID_LINE = "rgba(0, 245, 255, 0.18)";
const PIXEL_FONT = '"Press Start 2P", monospace';
const MONO_FONT = '"JetBrains Mono", "Courier New", monospace';
// ¿El foco está en un campo de formulario? Para no capturar el teclado del juego
// mientras el jugador escribe sus iniciales en el overlay de fin de partida.
const isFormFieldFocused = (target: EventTarget | null): boolean => {
  const el = target instanceof HTMLElement ? target : null;
  const tag = el?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};
// Acciones de los botones táctiles (alternativa al teclado).
export type TouchAction = "left" | "right" | "down" | "rotate" | "drop";
export interface GameOverResult {
  score: number;
  level: number;
}
type GameState = "playing" | "gameover";
interface Piece {
  type: number;
  shape: number[][];
  x: number;
  y: number;
}
// Acción táctil de flanco → tecla sintética que consume el mismo pressed() del teclado.
const TOUCH_KEY: Record<Exclude<TouchAction, "down">, string> = {
  left: "ArrowLeft",
  right: "ArrowRight",
  rotate: "ArrowUp",
  drop: "Space",
};
export class TetrisGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rafId: number | null = null;
  private lastTime: number | null = null;
  private paused = false;
  // Estado de partida (antes globales en game.js). Se inicializa en initGame().
  private board: number[][] = [];
  private current!: Piece;
  private next!: Piece;
  private score = 0;
  private lines = 0;
  private level = 1;
  private state: GameState = "playing";
  private dropAccum = 0; // segundos acumulados desde la última bajada
  private dropInterval = 1; // segundos; max(0.1, 1 - (level-1)*0.09)
  // Aviso de fin de partida al envoltorio React (una sola vez por partida).
  private onGameOver: ((result: GameOverResult) => void) | null = null;
  private gameOverNotified = false;
  // Input de teclado.
  private keys: Record<string, boolean> = {};
  private justPressed: Record<string, boolean> = {};
  // Input táctil (botones en pantalla). Se combina con el teclado.
  private touch: Record<TouchAction, boolean> = {
    left: false,
    right: false,
    down: false,
    rotate: false,
    drop: false,
  };
  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas.");
    this.canvas = canvas;
    this.ctx = ctx;
  }
  // Inicializa el estado, engancha el teclado y arranca el game loop.
  // Idempotente: si ya está corriendo, no hace nada.
  start(): void {
    if (this.rafId !== null) return;
    this.initGame();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
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
    window.removeEventListener("keyup", this.onKeyUp);
  }
  // stop() + libera referencias. Idempotente.
  destroy(): void {
    this.stop();
    this.onGameOver = null;
  }
  // Registra el callback de fin de partida. Se dispara una vez, cuando una pieza
  // nueva ya colisiona al aparecer, con la puntuación y el nivel alcanzados.
  setOnGameOver(cb: (result: GameOverResult) => void): void {
    this.onGameOver = cb;
  }
  // Reinicia la partida desde cero (lo que hace `Espacio` en GAME OVER).
  restart(): void {
    this.initGame();
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
  // devicePixelRatio y deja una transform que mapea el espacio interno 480x600
  // sobre ese backing store (proporción 4:5, letterbox vía object-fit).
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
  // Entrada de los botones táctiles. Las acciones de flanco (todas menos 'down')
  // se traducen a una pulsación de tecla en el flanco de subida.
  setInput(action: TouchAction, pressed: boolean): void {
    if (action === "down") {
      this.touch.down = pressed;
      return;
    }
    if (pressed && !this.touch[action]) {
      this.justPressed[TOUCH_KEY[action]] = true;
    }
    this.touch[action] = pressed;
  }
  // ── Input ──────────────────────────────────────────────────────────────────
  private onKeyDown = (e: KeyboardEvent): void => {
    if (isFormFieldFocused(e.target)) return;
    if (!this.keys[e.code]) this.justPressed[e.code] = true;
    this.keys[e.code] = true;
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.code] = false;
  };
  // Consume la pulsación de un frame (una sola lectura).
  private pressed(code: string): boolean {
    const val = this.justPressed[code];
    this.justPressed[code] = false;
    return !!val;
  }
  // ── Piezas y tablero ───────────────────────────────────────────────────────
  private createBoard(): number[][] {
    return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
  }
  private randomPiece(): Piece {
    const type = Math.floor(Math.random() * 7) + 1; // 1..7 (sin la pieza "tuerca")
    const shape = PIECES[type].map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }
  private collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && this.board[ny][nx]) return true;
      }
    }
    return false;
  }
  private rotateCW(shape: number[][]): number[][] {
    const rows = shape.length;
    const cols = shape[0].length;
    const result = Array.from({ length: cols }, () =>
      new Array<number>(rows).fill(0),
    );
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        result[c][rows - 1 - r] = shape[r][c];
      }
    }
    return result;
  }
  private tryRotate(): void {
    const rotated = this.rotateCW(this.current.shape);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!this.collide(rotated, this.current.x + kick, this.current.y)) {
        this.current.shape = rotated;
        this.current.x += kick;
        return;
      }
    }
  }
  private merge(): void {
    const { shape, x, y } = this.current;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) this.board[y + r][x + c] = shape[r][c];
      }
    }
  }
  private clearLines(): void {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every((v) => v !== 0)) {
        this.board.splice(r, 1);
        this.board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      this.lines += cleared;
      this.score += (LINE_SCORES[cleared] || 0) * this.level;
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(0.1, 1 - (this.level - 1) * 0.09);
    }
  }
  private ghostY(): number {
    let gy = this.current.y;
    while (!this.collide(this.current.shape, this.current.x, gy + 1)) gy++;
    return gy;
  }
  private hardDrop(): void {
    const gy = this.ghostY();
    this.score += (gy - this.current.y) * 2;
    this.current.y = gy;
    this.lockPiece();
  }
  private softDrop(): void {
    if (!this.collide(this.current.shape, this.current.x, this.current.y + 1)) {
      this.current.y++;
      this.score += 1;
    } else {
      this.lockPiece();
    }
  }
  private lockPiece(): void {
    this.merge();
    this.clearLines();
    this.spawn();
  }
  private spawn(): void {
    this.current = this.next;
    this.next = this.randomPiece();
    if (this.collide(this.current.shape, this.current.x, this.current.y)) {
      this.endGame();
    }
  }
  private endGame(): void {
    this.state = "gameover";
    if (!this.gameOverNotified) {
      this.gameOverNotified = true;
      this.onGameOver?.({ score: this.score, level: this.level });
    }
  }
  // ── Ciclo de partida ───────────────────────────────────────────────────────
  private initGame(): void {
    this.board = this.createBoard();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.state = "playing";
    this.gameOverNotified = false;
    this.dropInterval = 1;
    this.dropAccum = 0;
    this.next = this.randomPiece();
    this.spawn();
  }
  // ── Update ─────────────────────────────────────────────────────────────────
  private update(dt: number): void {
    if (this.state === "gameover") {
      if (this.pressed("Space")) this.initGame();
      return;
    }
    // Movimiento / rotación / hard drop: flanco (una pulsación = un paso).
    if (
      this.pressed("ArrowLeft") &&
      !this.collide(this.current.shape, this.current.x - 1, this.current.y)
    ) {
      this.current.x--;
    }
    if (
      this.pressed("ArrowRight") &&
      !this.collide(this.current.shape, this.current.x + 1, this.current.y)
    ) {
      this.current.x++;
    }
    const rotUp = this.pressed("ArrowUp");
    const rotX = this.pressed("KeyX");
    if (rotUp || rotX) this.tryRotate();
    if (this.pressed("Space")) {
      this.hardDrop();
      return; // la pieza ya bajó del todo; el resto del frame no aplica
    }
    // Soft drop: acelera la caída mientras `↓` o el botón táctil estén pulsados.
    const softDropping = !!this.keys["ArrowDown"] || this.touch.down;
    const interval = softDropping
      ? Math.min(this.dropInterval, 0.05)
      : this.dropInterval;
    this.dropAccum += dt;
    if (this.dropAccum >= interval) {
      this.dropAccum = 0;
      if (softDropping) {
        this.softDrop();
      } else if (
        !this.collide(this.current.shape, this.current.x, this.current.y + 1)
      ) {
        this.current.y++;
      } else {
        this.lockPiece();
      }
    }
  }
  // ── Draw ───────────────────────────────────────────────────────────────────
  private paintCell(
    px: number,
    py: number,
    size: number,
    colorIndex: number,
    alpha = 1,
  ): void {
    if (!colorIndex) return;
    const { ctx } = this;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS[colorIndex];
    ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    ctx.fillRect(px + 1, py + 1, size - 2, 4);
    ctx.globalAlpha = 1;
  }
  private drawGrid(): void {
    const { ctx } = this;
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(COLS * BLOCK, r * BLOCK);
      ctx.stroke();
    }
  }
  private drawPiece(piece: Piece, alpha = 1): void {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          this.paintCell(
            (piece.x + c) * BLOCK,
            (piece.y + r) * BLOCK,
            BLOCK,
            piece.shape[r][c],
            alpha,
          );
        }
      }
    }
  }
  private drawPanel(): void {
    const { ctx } = this;
    // Separador tablero / panel.
    ctx.strokeStyle = "rgba(230, 233, 255, 0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PANEL_X + 0.5, 0);
    ctx.lineTo(PANEL_X + 0.5, H);
    ctx.stroke();
    const px = PANEL_X + 18;
    const stat = (label: string, value: string, y: number) => {
      ctx.textAlign = "left";
      ctx.fillStyle = "#8a8fb5";
      ctx.font = `9px ${PIXEL_FONT}`;
      ctx.fillText(label, px, y);
      ctx.fillStyle = "#e6e9ff";
      ctx.font = `20px ${MONO_FONT}`;
      ctx.fillText(value, px, y + 26);
    };
    stat("SCORE", this.score.toLocaleString("es-ES"), 40);
    stat("LINES", String(this.lines), 112);
    stat("LEVEL", String(this.level), 184);
    // NEXT
    ctx.textAlign = "left";
    ctx.fillStyle = "#8a8fb5";
    ctx.font = `9px ${PIXEL_FONT}`;
    ctx.fillText("NEXT", px, 268);
    const pv = 22;
    const boxX = px - 2;
    const boxY = 284;
    const s = this.next.shape;
    const offX = (4 - s[0].length) / 2;
    const offY = (4 - s.length) / 2;
    for (let r = 0; r < s.length; r++) {
      for (let c = 0; c < s[r].length; c++) {
        if (s[r][c]) {
          this.paintCell(
            boxX + (offX + c) * pv,
            boxY + (offY + r) * pv,
            pv,
            s[r][c],
          );
        }
      }
    }
  }
  private draw(): void {
    const { ctx } = this;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    this.drawGrid();
    // Tablero fijado.
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.paintCell(c * BLOCK, r * BLOCK, BLOCK, this.board[r][c]);
      }
    }
    if (this.state === "playing") {
      this.drawPiece({ ...this.current, y: this.ghostY() }, 0.18);
      this.drawPiece(this.current);
    }
    this.drawPanel();
    if (this.paused && this.state !== "gameover") {
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = `bold 30px ${MONO_FONT}`;
      ctx.fillText("EN PAUSA", W / 2, H / 2 - 12);
      ctx.font = `13px ${MONO_FONT}`;
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
