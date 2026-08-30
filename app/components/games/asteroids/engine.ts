// Motor de Asteroides — portado de references/started-games/02-asteroids/game.js
//
// Sin dependencias de React ni de Next: se instancia con un <canvas>, se arranca
// con start() y se apaga con stop() / destroy(). El motor dibuja siempre en un
// espacio interno fijo de 800x600 (el escalado responsive vive en resize()).
const W = 800;
const H = 600;
// ── Utils ────────────────────────────────────────────────────────────────────
interface Vec {
  x: number;
  y: number;
}
import type { SkinName } from "../skins";
const wrap = (v: number, max: number): number => ((v % max) + max) % max;
// ¿El foco está en un campo de formulario? Se usa para no capturar el teclado
// del juego mientras el jugador escribe (overlay de fin de partida).
const isFormFieldFocused = (target: EventTarget | null): boolean => {
  const el = target instanceof HTMLElement ? target : null;
  const tag = el?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};
const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number): number =>
  min + Math.random() * (max - min);
const randInt = (min: number, max: number): number =>
  Math.floor(rand(min, max + 1));
// ── Constantes ───────────────────────────────────────────────────────────────
const POWERUP_DROP_CHANCE = 0.15;
const POWERUP_DURATION = 5;
const POWERUP_TTL = 12;
const TRIPLE_SPREAD = 0.18;
const RADII = [0, 16, 30, 50]; // radio por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
const POINTS = [0, 100, 50, 20]; // puntos por tamaño
// ── Skins ────────────────────────────────────────────────────────────────────
// Un rol de color por uso real del canvas. Ningún literal de color queda suelto
// en los draw(): todo sale de ASTEROIDS_SKINS[skin].<rol>.
export interface AsteroidsPalette {
  bg: string; // fondo del campo de juego
  ship: string; // silueta de la nave y los iconos de vida del HUD
  thruster: string; // llama del propulsor
  bullet: string; // proyectiles
  asteroid: string; // contorno de las rocas
  particle: string; // partículas de explosión (triple "r,g,b" para rgba con alfa)
  hud: string; // texto principal del HUD (SCORE / NIVEL)
  hudDim: string; // subtítulo del overlay (pausa)
  accent: string; // power-up 3x y contador de disparo triple
  overlayTitle: string; // título grande del overlay (pausa)
  glow: number; // shadowBlur del render (0 = sin brillo)
}
export const ASTEROIDS_SKINS: Record<SkinName, AsteroidsPalette> = {
  // Copia literal de los colores originales del juego (game.js portado).
  clasico: {
    bg: "#000",
    ship: "#fff",
    thruster: "rgba(255, 130, 0, 0.85)",
    bullet: "#fff",
    asteroid: "#fff",
    particle: "255,255,255",
    hud: "#fff",
    hudDim: "rgba(255,255,255,0.65)",
    accent: "#0ff",
    overlayTitle: "#fff",
    glow: 0,
  },
  // Paleta casa de Arcade Vault: cian/magenta/amarillo/verde saturados sobre
  // negro con brillo CRT marcado.
  neon: {
    bg: "#04030a",
    ship: "#00f5ff",
    thruster: "rgba(245, 255, 0, 0.9)",
    bullet: "#f5ff00",
    asteroid: "#ff006e",
    particle: "0,255,136",
    hud: "#00f5ff",
    hudDim: "rgba(0,245,255,0.6)",
    accent: "#00ff88",
    overlayTitle: "#ff006e",
    glow: 12,
  },
  // Monitor de fósforo ámbar: monocromo cálido, sin glow, aire de terminal 80s.
  retro: {
    bg: "#0a0600",
    ship: "#ffb000",
    thruster: "rgba(255, 176, 0, 0.7)",
    bullet: "#ffe4b0",
    asteroid: "#d98e2a",
    particle: "255,176,0",
    hud: "#ffb000",
    hudDim: "rgba(255,176,0,0.55)",
    accent: "#ffd98a",
    overlayTitle: "#ffb000",
    glow: 0,
  },
};
// ── Bullet ───────────────────────────────────────────────────────────────────
export class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl = 1.1;
  radius = 2;
  dead = false;
  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
  }
  update(dt: number): void {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D, pal: AsteroidsPalette): void {
    ctx.save();
    ctx.shadowBlur = pal.glow;
    ctx.shadowColor = pal.bullet;
    ctx.fillStyle = pal.bullet;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
// ── Asteroid ─────────────────────────────────────────────────────────────────
export class Asteroid {
  x: number;
  y: number;
  size: number;
  radius: number;
  dead = false;
  vx: number;
  vy: number;
  rotSpeed: number;
  rot: number;
  verts: [number, number][] = [];
  constructor(x: number, y: number, size = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];
    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);
    // Polígono irregular
    const n = randInt(8, 13);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }
  update(dt: number): void {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }
  split(out: Asteroid[]): void {
    if (this.size <= 1) return;
    out.push(new Asteroid(this.x, this.y, this.size - 1));
    out.push(new Asteroid(this.x, this.y, this.size - 1));
  }
  draw(ctx: CanvasRenderingContext2D, pal: AsteroidsPalette): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.shadowBlur = pal.glow;
    ctx.shadowColor = pal.asteroid;
    ctx.strokeStyle = pal.asteroid;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++) {
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}
// ── PowerUp ──────────────────────────────────────────────────────────────────
export class PowerUp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius = 12;
  ttl = POWERUP_TTL;
  dead = false;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 40);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }
  update(dt: number): void {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D, pal: AsteroidsPalette): void {
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
    const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI / 4);
    ctx.shadowBlur = pal.glow;
    ctx.shadowColor = pal.accent;
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2;
    const r = this.radius * pulse;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.save();
    ctx.shadowBlur = pal.glow;
    ctx.shadowColor = pal.accent;
    ctx.fillStyle = pal.accent;
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("3x", this.x, this.y);
    ctx.restore();
  }
}
// ── Ship ─────────────────────────────────────────────────────────────────────
// Acciones de los botones táctiles (alternativa al teclado).
export type TouchAction = "left" | "right" | "thrust" | "fire";
export interface ShipInput {
  left: boolean;
  right: boolean;
  thrust: boolean;
}
export class Ship {
  x = W / 2;
  y = H / 2;
  angle = -Math.PI / 2;
  vx = 0;
  vy = 0;
  radius = 12;
  thrusting = false;
  invincible = 3;
  shootCooldown = 0;
  dead = false;
  tripleShot = 0;
  constructor() {
    this.reset();
  }
  reset(): void {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.radius = 12;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.dead = false;
  }
  update(dt: number, input: ShipInput): void {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.tripleShot > 0) this.tripleShot -= dt;
    const ROT = 3.5; // rad/s
    const THRUST = 260; // px/s²
    const DRAG = 0.987;
    if (input.left) this.angle -= ROT * dt;
    if (input.right) this.angle += ROT * dt;
    this.thrusting = input.thrust;
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }
    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }
  // Empuja los proyectiles nuevos en `out` (el array de balas del motor) en vez
  // de devolver un array temporal + spread en la ruta de update.
  tryShoot(out: Bullet[]): void {
    if (this.shootCooldown > 0 || this.dead) return;
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0) {
      out.push(new Bullet(ox, oy, this.angle - TRIPLE_SPREAD));
      out.push(new Bullet(ox, oy, this.angle));
      out.push(new Bullet(ox, oy, this.angle + TRIPLE_SPREAD));
      return;
    }
    out.push(new Bullet(ox, oy, this.angle));
  }
  draw(ctx: CanvasRenderingContext2D, pal: AsteroidsPalette): void {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
      return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.shadowBlur = pal.glow;
    ctx.shadowColor = pal.ship;
    ctx.strokeStyle = pal.ship;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo(20, 0); // nariz
    ctx.lineTo(-12, -9); // ala izquierda
    ctx.lineTo(-7, 0); // muesca trasera
    ctx.lineTo(-12, 9); // ala derecha
    ctx.closePath();
    ctx.stroke();
    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = pal.thruster;
      ctx.stroke();
    }
    ctx.restore();
  }
}
// ── Partículas (explosión) ───────────────────────────────────────────────────
export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead = false;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
  }
  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }
  // `colors` es la tabla precomputada de 101 strings `rgba(r,g,b,0.00..1.00)`
  // de la skin activa (ver AsteroidsGame.rebuildParticleColors). El índice
  // `Math.round(alpha*100)` reproduce el `alpha.toFixed(2)` original sin crear
  // un string por partícula y por frame.
  draw(ctx: CanvasRenderingContext2D, colors: string[]): void {
    const alpha = this.ttl / this.life;
    let idx = Math.round(alpha * 100);
    if (idx < 0) idx = 0;
    else if (idx > 100) idx = 100;
    ctx.strokeStyle = colors[idx];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}
// ── Motor ────────────────────────────────────────────────────────────────────
type GameState = "playing" | "dead" | "gameover";
export interface GameOverResult {
  score: number;
  level: number;
}
export class AsteroidsGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rafId: number | null = null;
  private lastTime: number | null = null;
  private paused = false;
  // Estado de partida (antes globales en game.js).
  private ship!: Ship;
  private bullets: Bullet[] = [];
  private asteroids: Asteroid[] = [];
  private particles: Particle[] = [];
  private powerUps: PowerUp[] = [];
  private score = 0;
  private lives = 3;
  private level = 1;
  private state: GameState = "playing";
  // Skin activa. Solo afecta al render; se cambia al vuelo con setSkin() sin
  // reiniciar la partida ni tocar la puntuación.
  private skin: SkinName = "clasico";
  private deadTimer = 0;
  private powerUpSpawned = false;
  private killsSinceSpawn = 0;
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
    thrust: false,
    fire: false,
  };
  // ── Scratch reutilizado (cero allocations en la ruta caliente) ──────────────
  // Objeto de input de la nave: se rellena in situ cada frame en vez de crear
  // un literal nuevo.
  private readonly shipInput: ShipInput = {
    left: false,
    right: false,
    thrust: false,
  };
  // Buffer para los asteroides recién partidos de un frame; se vacía con
  // `.length = 0` y se reusa (antes era `const newAsteroids = []` por frame).
  private readonly splitBuffer: Asteroid[] = [];
  // Tabla de 101 colores de partícula (`rgba(...,0.00)` … `rgba(...,1.00)`) de
  // la skin activa. Se reconstruye solo al cambiar skin.
  private readonly particleColors: string[] = [];
  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas.");
    this.canvas = canvas;
    this.ctx = ctx;
    this.rebuildParticleColors();
  }
  // Compacta un array borrando in situ los elementos con `dead === true`,
  // conservando el orden. Sustituye a `arr.filter((x) => !x.dead)` (que crea un
  // array nuevo por llamada y por frame).
  private static compact<T extends { dead: boolean }>(arr: T[]): void {
    let w = 0;
    for (let r = 0; r < arr.length; r++) {
      const item = arr[r];
      if (!item.dead) arr[w++] = item;
    }
    arr.length = w;
  }
  // Precalcula los strings rgba de partícula para la skin activa. Los draw()
  // solo indexan por `Math.round(alpha * 100)`.
  private rebuildParticleColors(): void {
    const rgb = ASTEROIDS_SKINS[this.skin].particle;
    const arr = this.particleColors;
    for (let i = 0; i <= 100; i++) {
      arr[i] = `rgba(${rgb},${(i / 100).toFixed(2)})`;
    }
    arr.length = 101;
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
  // Registra el callback de fin de partida. Se dispara una vez, al perder la
  // última vida, con la puntuación y el nivel alcanzados.
  setOnGameOver(cb: (result: GameOverResult) => void): void {
    this.onGameOver = cb;
  }
  // Reinicia la partida desde cero (lo que hace `Espacio` en GAME OVER).
  restart(): void {
    this.initGame();
  }
  // Cambia la paleta de render al vuelo. No reinicia ni pausa la partida.
  setSkin(name: SkinName): void {
    this.skin = name;
    this.rebuildParticleColors();
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
  // devicePixelRatio y deja una transform que mapea el espacio interno
  // 800x600 sobre ese backing store (proporción 4:3, letterbox vía CSS).
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
  // Entrada de los botones táctiles. 'fire' se traduce a una pulsación de
  // 'Space' en el flanco de subida, para que la consuma el mismo pressed().
  setInput(action: TouchAction, pressed: boolean): void {
    if (action === "fire") {
      if (pressed && !this.touch.fire) this.justPressed["Space"] = true;
      this.touch.fire = pressed;
      return;
    }
    this.touch[action] = pressed;
  }
  // ── Input ──────────────────────────────────────────────────────────────────
  private onKeyDown = (e: KeyboardEvent): void => {
    // Ignora el teclado mientras se escribe en un campo (p. ej. las iniciales
    // del overlay de fin de partida): así Espacio no reinicia ni las flechas
    // mueven la nave mientras el jugador teclea su nombre.
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
  // ── Ciclo de partida ───────────────────────────────────────────────────────
  private spawnAsteroids(count: number): void {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      this.asteroids.push(new Asteroid(x, y, 3));
    }
  }
  private initGame(): void {
    this.ship = new Ship();
    this.bullets = [];
    this.asteroids = [];
    this.particles = [];
    this.powerUps = [];
    this.powerUpSpawned = false;
    this.killsSinceSpawn = 0;
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.state = "playing";
    this.gameOverNotified = false;
    this.spawnAsteroids(4);
  }
  private nextLevel(): void {
    this.level++;
    this.bullets = [];
    this.particles = [];
    this.powerUps = [];
    this.powerUpSpawned = false;
    this.killsSinceSpawn = 0;
    this.ship.reset();
    this.spawnAsteroids(3 + this.level);
  }
  private explode(x: number, y: number, count = 8): void {
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y));
  }
  private killShip(): void {
    this.explode(this.ship.x, this.ship.y, 14);
    this.ship.dead = true;
    this.lives--;
    if (this.lives <= 0) {
      this.state = "gameover";
      if (!this.gameOverNotified) {
        this.gameOverNotified = true;
        this.onGameOver?.({ score: this.score, level: this.level });
      }
    } else {
      this.state = "dead";
      this.deadTimer = 2;
    }
  }
  // ── Update ─────────────────────────────────────────────────────────────────
  private update(dt: number): void {
    if (this.state === "gameover") {
      if (this.pressed("Space")) this.initGame();
      for (let i = 0; i < this.particles.length; i++)
        this.particles[i].update(dt);
      AsteroidsGame.compact(this.particles);
      return;
    }
    if (this.state === "dead") {
      this.deadTimer -= dt;
      for (let i = 0; i < this.particles.length; i++)
        this.particles[i].update(dt);
      AsteroidsGame.compact(this.particles);
      for (let i = 0; i < this.asteroids.length; i++)
        this.asteroids[i].update(dt);
      if (this.deadTimer <= 0) {
        this.state = "playing";
        this.ship.reset();
      }
      return;
    }
    // Disparar
    if (this.pressed("Space")) {
      this.ship.tryShoot(this.bullets);
    }
    const input = this.shipInput;
    input.left = !!this.keys["ArrowLeft"] || this.touch.left;
    input.right = !!this.keys["ArrowRight"] || this.touch.right;
    input.thrust = !!this.keys["ArrowUp"] || this.touch.thrust;
    this.ship.update(dt, input);
    for (let i = 0; i < this.bullets.length; i++) this.bullets[i].update(dt);
    for (let i = 0; i < this.asteroids.length; i++)
      this.asteroids[i].update(dt);
    for (let i = 0; i < this.particles.length; i++)
      this.particles[i].update(dt);
    for (let i = 0; i < this.powerUps.length; i++) this.powerUps[i].update(dt);
    AsteroidsGame.compact(this.bullets);
    AsteroidsGame.compact(this.particles);
    AsteroidsGame.compact(this.powerUps);
    for (let i = 0; i < this.powerUps.length; i++) {
      const p = this.powerUps[i];
      if (!p.dead && dist(this.ship, p) < this.ship.radius + p.radius) {
        p.dead = true;
        this.ship.tripleShot = POWERUP_DURATION;
      }
    }
    // Bala vs asteroide
    const newAsteroids = this.splitBuffer;
    newAsteroids.length = 0;
    for (let bi = 0; bi < this.bullets.length; bi++) {
      const b = this.bullets[bi];
      for (let ai = 0; ai < this.asteroids.length; ai++) {
        const a = this.asteroids[ai];
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          this.score += POINTS[a.size];
          this.explode(a.x, a.y, a.size * 5);
          a.split(newAsteroids);
          if (!this.powerUpSpawned) {
            this.killsSinceSpawn++;
            const guaranteed = this.killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              this.powerUps.push(new PowerUp(a.x, a.y));
              this.powerUpSpawned = true;
            }
          }
        }
      }
    }
    AsteroidsGame.compact(this.asteroids);
    for (let i = 0; i < newAsteroids.length; i++) {
      this.asteroids.push(newAsteroids[i]);
    }
    newAsteroids.length = 0;
    AsteroidsGame.compact(this.bullets);
    // Nave vs asteroide
    if (this.ship.invincible <= 0) {
      for (let i = 0; i < this.asteroids.length; i++) {
        const a = this.asteroids[i];
        if (dist(this.ship, a) < this.ship.radius + a.radius * 0.82) {
          this.killShip();
          break;
        }
      }
    }
    // Nivel completado
    if (this.asteroids.length === 0) this.nextLevel();
  }
  // ── Draw ───────────────────────────────────────────────────────────────────
  private drawLifeIcon(x: number, y: number): void {
    const { ctx } = this;
    const pal = ASTEROIDS_SKINS[this.skin];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.shadowBlur = pal.glow;
    ctx.shadowColor = pal.ship;
    ctx.strokeStyle = pal.ship;
    ctx.lineWidth = 1.2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  private drawHUD(): void {
    const { ctx } = this;
    const pal = ASTEROIDS_SKINS[this.skin];
    ctx.save();
    ctx.shadowBlur = pal.glow;
    ctx.shadowColor = pal.hud;
    ctx.fillStyle = pal.hud;
    ctx.font = "15px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE  ${this.score}`, 14, 26);
    ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${this.level}`, W / 2, 26);
    ctx.restore();
    for (let i = 0; i < this.lives; i++) {
      this.drawLifeIcon(W - 16 - i * 22, 18);
    }
    if (this.ship.tripleShot > 0) {
      ctx.save();
      ctx.shadowBlur = pal.glow;
      ctx.shadowColor = pal.accent;
      ctx.textAlign = "left";
      ctx.fillStyle = pal.accent;
      ctx.fillText(`3x  ${this.ship.tripleShot.toFixed(1)}s`, 14, 46);
      ctx.restore();
    }
  }
  private drawOverlay(title: string, sub: string): void {
    const { ctx } = this;
    const pal = ASTEROIDS_SKINS[this.skin];
    ctx.textAlign = "center";
    ctx.fillStyle = pal.overlayTitle;
    ctx.font = "bold 46px monospace";
    ctx.fillText(title, W / 2, H / 2 - 18);
    ctx.font = "18px monospace";
    ctx.fillStyle = pal.hudDim;
    ctx.fillText(sub, W / 2, H / 2 + 22);
  }
  private draw(): void {
    const { ctx } = this;
    const pal = ASTEROIDS_SKINS[this.skin];
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const colors = this.particleColors;
    for (let i = 0; i < this.particles.length; i++)
      this.particles[i].draw(ctx, colors);
    for (let i = 0; i < this.asteroids.length; i++)
      this.asteroids[i].draw(ctx, pal);
    for (let i = 0; i < this.powerUps.length; i++)
      this.powerUps[i].draw(ctx, pal);
    for (let i = 0; i < this.bullets.length; i++)
      this.bullets[i].draw(ctx, pal);
    this.ship.draw(ctx, pal);
    this.drawHUD();
    // El texto de GAME OVER lo pinta ahora el overlay React del envoltorio;
    // aquí se sigue pintando el último frame congelado por debajo.
    if (this.paused && this.state !== "gameover") {
      this.drawOverlay("EN PAUSA", "ESC / P PARA CONTINUAR");
    }
  }
  // ── Loop ───────────────────────────────────────────────────────────────────
  private loop = (ts: number): void => {
    const dt =
      this.lastTime === null ? 0 : Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    // En pausa el loop sigue pintando el último frame, pero no simula.
    if (!this.paused) this.update(dt);
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };
}
