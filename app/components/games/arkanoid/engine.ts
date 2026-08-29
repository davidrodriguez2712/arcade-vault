// Motor de Arkanoid — portado de references/started-games/04-arkanoid/game.js
//
// Sin dependencias de React ni de Next: se instancia con un <canvas>, se arranca
// con start() y se apaga con stop() / destroy(). El motor dibuja siempre en un
// espacio interno fijo de 800x600 (igual que el referente y que `rocas`). El
// escalado responsive vive solo en resize().
const W = 800;
const H = 600;
const PADDLE_SPEED = 400; // px/s
const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2; // 80
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const BURST_DURATION = 150; // ms
const POINTS_PER_BLOCK = 10;
const MAX_LEVEL = 5;
// Colores de bloque del referente re-mapeados a la paleta neon de globals.css
// (el canvas no lee las CSS vars sin fricción).
const NEON: Record<string, string> = {
  red: "#ff3b6b",
  yellow: "#f5ff00",
  cyan: "#00f5ff",
  magenta: "#ff006e",
  hotpink: "#ff5fbf",
  green: "#00ff88",
  gray: "#c7d0e0",
};
const PIXEL_FONT = '"Press Start 2P", monospace';
const GRID_LINE = "rgba(0, 245, 255, 0.14)";
interface BlockCell {
  col: number;
  row: number;
  color: string;
}
interface LevelDef {
  speed: number;
  blocks: BlockCell[];
}
// Los 5 niveles de levels.js: parrilla / pirámide / ajedrez / filas con huecos /
// marco + cruz. La IIFE que los genera se porta tal cual.
const LEVELS: LevelDef[] = (() => {
  const rowColors1 = ["red", "yellow", "cyan", "magenta", "hotpink", "green"];
  const rowColors2 = ["gray", "cyan", "hotpink", "yellow", "magenta", "green"];
  const rowColors4 = ["cyan", "magenta", "green", "yellow", "hotpink", "red"];
  const l1: BlockCell[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      l1.push({ col, row, color: rowColors1[row] });
  const l2: BlockCell[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < 6; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });
  const l3: BlockCell[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if ((col + row) % 2 === 0)
        l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });
  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: BlockCell[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if (!gaps4[row].includes(col))
        l4.push({ col, row, color: rowColors4[row] });
  const l5: BlockCell[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({ col, row, color: isCross && !isFrame ? "hotpink" : "cyan" });
    }
  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
})();
// ¿El foco está en un campo de formulario? Para no capturar el teclado del juego
// mientras el jugador escribe sus iniciales en el overlay de fin de partida.
const isFormFieldFocused = (target: EventTarget | null): boolean => {
  const el = target instanceof HTMLElement ? target : null;
  const tag = el?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};
// Acciones de los botones táctiles (alternativa al teclado). Ambas sostenidas.
export type TouchAction = "left" | "right";
export interface GameOverResult {
  score: number;
  level: number;
}
type GameState = "playing" | "gameover";
interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string; // hex de la paleta neon
  alive: boolean;
}
interface Burst {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  elapsed: number; // ms
}
export class ArkanoidGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rafId: number | null = null;
  private lastTime: number | null = null;
  private paused = false;
  // Estado de partida (antes globales en game.js). Se inicializa en initGame().
  private paddle = { x: 0, y: 560, w: 81, h: 14 };
  private ball = { x: 0, y: 0, w: 16, h: 16, vx: 0, vy: 0 };
  private blocks: Block[] = [];
  private bursts: Burst[] = [];
  private score = 0;
  private lives = 3;
  private currentLevel = 1;
  private state: GameState = "playing";
  // Aviso de fin de partida al envoltorio React (una sola vez por partida).
  private onGameOver: ((result: GameOverResult) => void) | null = null;
  private gameOverNotified = false;
  // Input de teclado.
  private keys: Record<string, boolean> = {};
  // Input táctil (botones en pantalla). Se combina con el teclado en update().
  private touch: Record<TouchAction, boolean> = { left: false, right: false };
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
  // Reinicia la partida desde cero.
  restart(): void {
    this.initGame();
  }
  // Registra el callback de fin de partida. Se dispara una vez, al perder la
  // última vida o al limpiar todos los bloques del nivel 5.
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
  // Entrada de los botones táctiles. `left` / `right` son booleanos sostenidos
  // que se combinan con las flechas en update().
  setInput(action: TouchAction, pressed: boolean): void {
    this.touch[action] = pressed;
  }
  // ── Input ──────────────────────────────────────────────────────────────────
  private onKeyDown = (e: KeyboardEvent): void => {
    if (isFormFieldFocused(e.target)) return;
    this.keys[e.code] = true;
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.code] = false;
  };
  // ── Partida ────────────────────────────────────────────────────────────────
  private initPaddle(): void {
    this.paddle.x = (W - this.paddle.w) / 2;
  }
  private initBall(): void {
    const speed = LEVELS[this.currentLevel - 1].speed;
    this.ball.x = this.paddle.x + (this.paddle.w - this.ball.w) / 2;
    this.ball.y = this.paddle.y - this.ball.h;
    this.ball.vx = BASE_BALL_VX * speed;
    this.ball.vy = BASE_BALL_VY * speed;
  }
  private loadLevel(n: number): void {
    this.currentLevel = n;
    const level = LEVELS[n - 1];
    this.blocks = level.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: NEON[b.color] ?? "#c7d0e0",
      alive: true,
    }));
    this.bursts = [];
    this.initBall();
  }
  private initGame(): void {
    this.score = 0;
    this.lives = 3;
    this.state = "playing";
    this.gameOverNotified = false;
    this.paused = false;
    this.bursts = [];
    this.initPaddle();
    this.loadLevel(1);
  }
  private collideAABB(block: Block): boolean {
    const { ball } = this;
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }
  private endGame(): void {
    this.state = "gameover";
    if (!this.gameOverNotified) {
      this.gameOverNotified = true;
      this.onGameOver?.({ score: this.score, level: this.currentLevel });
    }
  }
  // ── Update ─────────────────────────────────────────────────────────────────
  private update(dt: number): void {
    if (this.state === "gameover") return;
    const { paddle, ball } = this;
    // Paleta: teclado o botón táctil, mientras esté pulsado.
    const left = this.keys["ArrowLeft"] || this.touch.left;
    const right = this.keys["ArrowRight"] || this.touch.right;
    if (left) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (right) paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);
    // Bola.
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    // Rebotes contra las tres paredes (izquierda, derecha, techo).
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
    }
    // Rebote en la paleta.
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
    }
    // Colisión con bloques: como en el referente, un bloque por frame.
    for (const block of this.blocks) {
      if (!block.alive) continue;
      if (this.collideAABB(block)) {
        block.alive = false;
        this.bursts.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        this.score += POINTS_PER_BLOCK;
        ball.vy = -ball.vy;
        if (this.blocks.every((b) => !b.alive)) {
          if (this.currentLevel < MAX_LEVEL) {
            this.loadLevel(this.currentLevel + 1); // conserva el score
          } else {
            this.endGame();
            return;
          }
        }
        break;
      }
    }
    // Destellos de ruptura.
    for (const b of this.bursts) b.elapsed += dt * 1000;
    this.bursts = this.bursts.filter((b) => b.elapsed < BURST_DURATION);
    // Bola perdida por abajo.
    if (ball.y > H) {
      this.lives--;
      if (this.lives <= 0) {
        this.lives = 0;
        this.endGame();
        return;
      }
      this.initBall();
    }
  }
  // ── Draw ───────────────────────────────────────────────────────────────────
  private drawBlock(b: Block): void {
    const { ctx } = this;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, 4);
  }
  private drawHud(): void {
    const { ctx } = this;
    ctx.font = `12px ${PIXEL_FONT}`;
    ctx.textBaseline = "top";
    ctx.fillStyle = "#e6e9ff";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE ${this.score.toLocaleString("es-ES")}`, 12, 12);
    ctx.textAlign = "center";
    ctx.fillStyle = "#8a8fb5";
    ctx.fillText(`NIVEL ${this.currentLevel}`, W / 2, 12);
    // Vidas como bolas pequeñas arriba a la derecha.
    const r = 5;
    const gap = 16;
    for (let i = 0; i < this.lives; i++) {
      const cx = W - 14 - i * gap;
      ctx.fillStyle = "#00f5ff";
      ctx.beginPath();
      ctx.arc(cx, 20, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  private draw(): void {
    const { ctx, paddle, ball } = this;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    // Línea de suelo sutil bajo la paleta.
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, paddle.y + paddle.h + 10);
    ctx.lineTo(W, paddle.y + paddle.h + 10);
    ctx.stroke();
    // Bloques.
    for (const b of this.blocks) if (b.alive) this.drawBlock(b);
    // Destellos de ruptura.
    for (const b of this.bursts) {
      const t = b.elapsed / BURST_DURATION;
      const grow = t * 12;
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - grow, b.y - grow, b.w + grow * 2, b.h + grow * 2);
      ctx.globalAlpha = 1;
    }
    // Paleta.
    ctx.fillStyle = "#00f5ff";
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(paddle.x, paddle.y, paddle.w, 3);
    // Bola.
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(
      ball.x + ball.w / 2,
      ball.y + ball.h / 2,
      ball.w / 2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
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
    // El texto de GAME OVER / victoria lo pinta el overlay React del envoltorio.
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
