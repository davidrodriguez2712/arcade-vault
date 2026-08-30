# Backlog de juegos — Arcade Vault

Memoria del agente `game-planner` (`.claude/agents/game-planner.md`). Registra qué juegos se han
sugerido, considerado o descartado para el catálogo, y por qué. El agente lo lee antes de proponer y
añade una entrada después. Precede al comando `/add-game`.

## Roster actual

| ID              | Título        | Categoría | Color   | Estado     |
| --------------- | ------------- | --------- | ------- | ---------- |
| `bloque-buster` | BLOQUE BUSTER | ARCADE    | cyan    | motor real |
| `caida`         | CAÍDA         | PUZZLE    | magenta | motor real |
| `serpentina`    | SERPENTINA    | ARCADE    | green   | motor real |
| `rocas`         | ROCAS         | SHOOTER   | yellow  | motor real |
| `gloton`        | GLOTÓN        | ARCADE    | yellow  | simulada   |
| `invasores`     | INVASORES     | SHOOTER   | green   | simulada   |
| `ranaria`       | RANARIA       | ARCADE    | green   | simulada   |
| `duelo-pixel`   | DUELO PIXEL   | VERSUS    | cyan    | simulada   |

Fuente: `app/lib/games.ts` (`FALLBACK_GAME_IDS`) + `app/components/games/registry.ts`
(`REAL_GAME_PLAYERS`). Un `id` con motor real no se vuelve a proponer.

## Formato de entrada

```
## AAAA-MM-DD — <Nombre del juego> (`<id>`)

- Veredicto: Recomendado | Considerado | Descartado
- Categoría: ARCADE · color: cyan
- Encaje: <una frase>
- Origen: portar (`references/started-games/...`) | desde cero
- Motor: espacio interno <WxH> · scoring <...> · level <...>
- Handoff: /add-game "<descripción>"
- Motivo (si Considerado/Descartado): <una frase>
- Resultado: (a mano) spec NN / implementado / abandonado
```

## Registro de sugerencias

Más reciente al final.

## 2026-08-29 — INVASORES (`invasores`)

- Veredicto: Recomendado
- Categoría: SHOOTER · color: green · id existente (ficha simulada → motor real)
- Encaje: un jugador, puntuación entera creciente (10/20/30 por alien + OVNI bonus), canvas 2D,
  motor agnóstico viable, teclado, mecánica de formación descendente distinta del vuelo libre de
  `rocas`.
- Origen: desde cero (no hay carpeta en `references/started-games/`)
- Motor: espacio interno 800×600 · scoring 10/20/30 por fila + OVNI 50–300 · level = número de oleada
- Handoff: /add-game "portar space invaders a la entrada invasores"

## 2026-08-29 — RANARIA (`ranaria`)

- Veredicto: Considerado
- Categoría: ARCADE · color: green
- Encaje: buen encaje (un jugador, 10 por avance + 50 por rana en casa + bonus de tiempo, carriles
  agnósticos de framework). Segunda opción más fuerte.
- Origen: desde cero
- Motor: espacio interno 800×600 · scoring avance/casa/tiempo · level = ronda de dificultad
- Handoff: /add-game "portar frogger a la entrada ranaria"
- Motivo: Encaje sólido pero menos icónico que Invasores y sin hueco de categoría que llenar
  (ARCADE ya tiene 2 motores). Reservado para la siguiente ronda.

## 2026-08-29 — GLOTÓN (`gloton`)

- Veredicto: Considerado
- Categoría: ARCADE · color: yellow
- Encaje: mecánica distinta y puntuación clara, pero la IA de 4 fantasmas (personalidades +
  pathfinding en laberinto) infla el esfuerzo del motor por encima del tamaño de una spec 05–09.
- Origen: desde cero
- Motor: espacio interno ~600×660 · scoring puntos/píldoras/fantasmas · level = número de tablero
- Handoff: /add-game "portar pac-man a la entrada gloton"
- Motivo: Esfuerzo de motor alto (IA de fantasmas) frente a candidatos más baratos con igual encaje.

## 2026-08-29 — DUELO PIXEL (`duelo-pixel`)

- Veredicto: Descartado
- Categoría: VERSUS · color: cyan
- Encaje: falla dos criterios: no es de un solo jugador y el marcador a 11 no es una puntuación
  entera, clara y **creciente** sin límite para el leaderboard.
- Motivo: Categoría VERSUS incompatible con "un solo jugador" y con el modelo de puntuación del
  Salón de la Fama. Necesitaría rediseño de scoring (rallies/supervivencia vs CPU) antes de volver
  a evaluarse.

## 2026-08-29 — RANARIA (`ranaria`) — 2ª ronda

- Veredicto: Recomendado
- Categoría: ARCADE · color: green · id existente (ficha simulada → motor real)
- Cambio de veredicto: pasa de Considerado a Recomendado. INVASORES (recomendación previa de hoy)
  sigue pendiente de implementar; RANARIA era la reserva explícita "para la siguiente ronda" y es
  ahora el candidato más barato con encaje sólido: sin IA (los coches/troncos son carriles con
  velocidad constante), muerte por colisión/agua/tiempo, puntuación entera creciente.
- Encaje: un jugador; scoring +10 por avance de fila, +50 al llevar una rana a casa (+bonus de
  tiempo restante), +200 al completar las 5 casas; canvas 2D; motor agnóstico (grilla de carriles,
  sin importar react/next); teclado; mecánica de cruce por carriles distinta de rocas/caida/
  bloque-buster/serpentina.
- Origen: desde cero (no existe `references/started-games/` para Frogger)
- Motor: espacio interno 800×600 (4:3), grilla de celda 50 px, banda HUD arriba · scoring
  avance/casa/tiempo/fila completa · `scores.level` = ronda de dificultad alcanzada (sube al llenar
  las 5 casas: más tráfico y más rápido)
- Controles: flechas / WASD, un paso por pulsación · TouchAction = "up" | "down" | "left" | "right"
  (D-pad, gated por `@media (pointer: coarse)`), reutiliza el patrón de SERPENTINA
- Riesgos: detección de colisión con troncos/tortugas (viajar montado, caer al agua entre gaps);
  temporizador por rana; tuning de dificultad por ronda.
- Fuera de la 1ª spec: cocodrilos, serpientes y nutrias en los troncos, mosca de bonus, rana
  acompañante, sonido, persistencia local, recalcular `games.best` / `games.plays`.
- Handoff: /add-game "portar frogger a la entrada ranaria"
- Resultado: (pendiente)

## 2026-08-29 — GLOTÓN (`gloton`) — reevaluado

- Veredicto: Considerado
- Categoría: ARCADE · color: yellow
- Encaje: mecánica y scoring claros, pero la IA de 4 fantasmas (personalidades + pathfinding en
  laberinto + modos scatter/chase/frightened) sigue por encima del tamaño de una spec 05–09.
- Motivo: Mismo veredicto que la 1ª ronda: esfuerzo de motor alto frente a RANARIA, que llena igual
  el catálogo con un motor mucho más barato. Reconsiderar cuando queden pocas fichas simuladas.

## 2026-08-29 — JOYAS (`joyas`) — fila nueva

- Veredicto: Considerado
- Categoría: PUZZLE · color: yellow · fila nueva (`sort_order` = 8, el siguiente libre)
- Encaje: match-3 tipo Bejeweled. Un jugador; puntúa +10/ficha en cada combo con multiplicador por
  cascada; `level` sube cada N puntos (tablero más rápido / menos tiempo). Canvas 2D, motor de
  grilla agnóstico, teclado (cursor + intercambio) + TouchAction. Llenaría el hueco de PUZZLE, que
  hoy solo tiene CAÍDA.
- Origen: desde cero
- Motor: espacio interno 800×600, grilla 8×8
- Motivo: Buen candidato y única opción que abre categoría, pero requiere fila nueva + los 6 campos
  - copy, mientras RANARIA reutiliza una ficha existente (la migración solo hace
    `has_leaderboard = true`). Primera opción para la ronda que agote las fichas simuladas.

## 2026-08-29 — Lote de 20 candidatos (4 game-planner en paralelo)

Ronda de brainstorming a petición del usuario: 4 agentes en paralelo, 5 juegos por categoría, sin
tocar esta memoria durante la ejecución. Todos son **filas nuevas** salvo aviso. Ninguno reutiliza
un `id` con motor real. `sort_order` = siguiente libre al lanzar `/add-game` (verificar en `games`).

**Colisión de id:** BOMBAS lo piden dos candidatos — Bomberman (ARCADE clásico) y Kaboom! (varios).
Resolución sugerida: `bombas` = Bomberman; Kaboom! pasa a `kaboom` o `bombardero`.

### ARCADE clásico

- **SALTARÍN (`saltarin`, Q\*bert)** — Considerado, P1 del grupo. ARCADE · magenta. Pirámide isométrica
  de 28 cubos, movimiento discreto en grilla, IA mínima (bolas rectas, Coily greedy). Scoring
  +25/cubo, +500 Coily al vacío, bonus de ronda. `level` = ronda. TouchAction diagonal
  "up-left"|"up-right"|"down-left"|"down-right". Riesgo: proyección iso + caída fuera de pirámide.
  Handoff: /add-game "crear el juego saltarin, un clon de q*bert isométrico"
- **TOPO (`topo`, Dig Dug)** — Considerado, P2. ARCADE · yellow. Grilla 16×12, terreno destructible,
  roca que aplasta. IA de 2-4 bichos simplificable. Scoring pump-pop 200–600 por profundidad, roca
  1000–2500. TouchAction +"pump". Riesgo: máscara de tierra excavada, ghost-through-dirt.
  Handoff: /add-game "crear el juego topo, un clon de dig dug con túneles excavables"
- **BOMBAS (`bombas`, Bomberman 1 jugador)** — Considerado, P3. ARCADE · green. Grilla 15×13, blast
  en cruz frenada por muros + cadenas. IA = paseo aleatorio con leve persecución (la más barata).
  Scoring +10 muro, +100/200/400/800 enemigo encadenado. TouchAction +"bomb".
  Handoff: /add-game "crear el juego bombas, un clon de bomberman de un jugador por fases"
- **CHEF (`chef`, BurgerTime)** — Considerado, P4. ARCADE · cyan. Grafo plataformas+escaleras, pisar
  ingredientes para armar hamburguesas. IA = BFS por el grafo (punto más caro del grupo). Scoring
  +50/tramo, +500/hamburguesa, multiplicador al tirar capa con enemigos. TouchAction +"pepper".
  Handoff: /add-game "crear el juego chef, un clon de burgertime en plataformas y escaleras"
- **BARRILES (`barriles`, Donkey Kong)** — Considerado, P5. ARCADE · magenta. Vigas inclinadas +
  escaleras, barriles deterministas (sin IA). Scoring +100 saltar barril, +300/500/800 martillo,
  bonus por cuenta atrás. TouchAction +"jump". Riesgo: física de salto + colisión en vigas
  inclinadas; DK es nativo vertical → rediseño de layout a ~4:3 (720×600).
  Handoff: /add-game "crear el juego barriles, un clon de donkey kong con vigas y escaleras"
- Descartes: Lode Runner (IA guardias + muchos niveles; reserva para PUZZLE), Pengo (IA Sno-Bees),
  DK Jr./Kangaroo/Congo Bongo (misma mecánica trepa-salto), Amidar/Crush Roller (IA tipo Pac-Man).

### SHOOTER

- **MISILES (`misiles`, Missile Command)** — Considerado, P1. SHOOTER · magenta. Misiles entrantes =
  rectas, cero IA. Motor más barato del grupo. Scoring +25/ojiva, +5/misil sin usar, +100/ciudad
  viva. `level` = oleada. Riesgo: el táctil natural es tocar-para-apuntar (coords de canvas), se
  sale de la unión TouchAction tipo D-pad — decidir coords directas vs D-pad de retícula.
  Handoff: /add-game "crear el juego misiles (missile command): defiende 6 ciudades interceptando misiles con 3 baterías, espacio interno 800x600, leaderboard por oleadas"
- **CIEMPIÉS (`ciempies`, Centipede)** — Considerado, P2. SHOOTER · cyan. Zig-zag rebotando en el
  hongal, cada disparo parte el ciempiés en dos. Scoring +1 hongo, +10 segmento, +100 cabeza,
  +300/600/900 araña. Riesgo: grilla del hongal ~30×30 + lista enlazada de segmentos con split.
  Handoff: /add-game "crear el juego ciempies (centipede): dispara al ciempiés que baja por un hongal y se parte en dos con cada impacto, araña/pulga/escorpión, espacio interno 800x600, leaderboard por oleadas"
- **INCURSIÓN (`incursion`, Scramble)** — Considerado, P3. SHOOTER · yellow. Shooter de scroll
  horizontal con relieve + combustible. Sin IA (cohetes verticales, tanques estáticos, OVNIs
  senoidales). Terreno = heightmaps por tramo. TouchAction +"bomb". Riesgo: dos armas + fuel como
  vida.
  Handoff: /add-game "crear el juego incursion (scramble): shooter de scroll horizontal a ras de cañón con láser, bombas y depósito de fuel que baja, espacio interno 800x600, leaderboard por tramos"
- **VÓRTICE (`vortice`, Tempest)** — Considerado, P4. SHOOTER · magenta. Estética vector pura, tubo
  pseudo-3D. Enemigos trepan carriles con reglas simples. Scoring 50–150/enemigo, +level×100 al
  limpiar. TouchAction "left"|"right"|"fire"|"zap". Riesgo: el mayor del grupo — proyección del pozo
  y geometrías de tubo; límite superior de tamaño de spec.
  Handoff: /add-game "crear el juego vortice (tempest): shooter de tubo pseudo-3D, giras por el borde del pozo y disparas a flippers/tankers/spikers que trepan, espacio interno 800x600, leaderboard por tubos"
- **ESCUADRÓN (`escuadron`, shmup vertical tipo 1942)** — Considerado, P5. SHOOTER · cyan. Vuelo
  libre con scroll vertical (distinto de la formación fija de `invasores` y del vuelo inercial de
  `rocas`). Enemigos por tablas de spawn + splines, sin IA reactiva. Playfield vertical → corredor
  central ~480px + HUD lateral (patrón CAÍDA/SERPENTINA). Riesgo: guionizar oleadas + jefe por
  sector.
  Handoff: /add-game "crear el juego escuadron: matamarcianos de scroll vertical con vuelo libre, oleadas de cazas por trayectorias y un acorazado por sector, espacio interno 800x600 con corredor central y HUD lateral, leaderboard por sectores"
- Descartes: Galaga/Galaxian (se solapa con `invasores`), Robotron (twin-stick incompatible con el
  modelo de controles), Defender (IA mutantes + wraparound + minimapa), Gorf (5 modos), Duck Hunt
  (contenido fino; MISILES cubre mejor el nicho de apuntado).

### PUZZLE (hoy solo CAÍDA)

- **JOYAS (`joyas`, match-3 Bejeweled)** — Considerado, P1. Ya estaba en memoria. PUZZLE · yellow.
  Grilla 8×8. Scoring +10/gema, match-4 +50, match-5 +100, ×N por cascada, sin techo. `level` cada
  1000 pts. Riesgo: matches en T/L, cascadas recursivas, detección "sin jugadas" O(n²).
  Handoff: /add-game "match-3 estilo Bejeweled como fila nueva PUZZLE con id joyas"
- **2048 (`2048`)** — Considerado, P2. PUZZLE · cyan. Slide+merge 4×4. Mejor encaje de leaderboard de
  todo el lote (la puntuación _es_ una suma monótona) con el motor más barato. `level` = exponente
  de la ficha más alta. TouchAction swipe idéntico a SERPENTINA. Riesgo estético: no es clásico de
  recreativa, se apoya en el reskin CRT.
  Handoff: /add-game "2048 como fila nueva PUZZLE con id 2048"
- **BURBUJAS (`burbujas`, Puzzle Bobble)** — Considerado, P3. PUZZLE · magenta. Bubble shooter +
  match-3 en rejilla hexagonal, cañón inferior. Scoring +10/burbuja del match, bonus exponencial por
  racimo desprendido. `level` = avance del techo. Riesgo: rebote + snap a hex con offset por fila,
  flood-fill de racimo y de flotantes.
  Handoff: /add-game "puzzle bobble (bust-a-move) como fila nueva PUZZLE con id burbujas"
- **COLAPSO (`colapso`, SameGame)** — Considerado, P4. PUZZLE · green. Grilla 15×12, eliminar grupos
  del mismo color, colapso de columnas. Scoring n·(n-1) por grupo, +1000 tablero limpio. Motor muy
  barato. Motivo P4: repite el terreno "limpiar tiles de color" de JOYAS — elegir una.
  Handoff: /add-game "samegame/colapso de bloques como fila nueva PUZZLE con id colapso"
- **PANELES (`paneles`, Tetris Attack / Panel de Pon)** — Considerado, P5. PUZZLE · cyan. Marea que
  sube + swap horizontal + match-3, chains automáticas por gravedad. Encaje de leaderboard excelente
  (chains endless). Motivo P5: motor más caro y arriesgado del grupo (chains con ventana temporal,
  subida sub-celda) y vuelve a pisar el match-3 de color.
  Handoff: /add-game "tetris attack / panel de pon como fila nueva PUZZLE con id paneles"
- Descartes (scoring no entero-creciente): Lights Out y Flood-it (menos movimientos), Minesweeper
  (por tiempo + admite adivinar + clic derecho en táctil), Sokoban (por pasos + mucho contenido a
  mano). Puyo Puyo/Columns/Dr. Mario: buen scoring pero el núcleo pieza-que-cae solapa con CAÍDA.

### Varios

- **ALUNIZAJE (`alunizaje`, Lunar Lander)** — Considerado, P1. ARCADE · cyan. Vector = CRT puro.
  Físicas agnósticas (gravedad, empuje, rotación, colisión con terreno vectorial). Scoring bono por
  alunizaje × mult. de zona + fuel restante, acumulativo. `level` = nº de alunizajes. TouchAction
  "left"|"right"|"thrust". Riesgo: tuning de la sensación de físicas, terreno procedural jugable.
  Handoff: /add-game "crear lunar lander como fila nueva alunizaje, categoria ARCADE color cyan"
- **CIRCUITO (`circuito`, Pole Position)** — Considerado, P2. ARCADE · magenta. Abre el género de
  conducción (inexistente hoy). Carretera por segmentos, pseudo-3D. Scoring distancia + adelantos +
  bono de meta con tiempo. `level` = vuelta. Riesgo: render pseudo-3D por scanline + rendimiento.
  Handoff: /add-game "crear pole position como fila nueva circuito, categoria ARCADE color magenta"
- **BOMBAS/KABOOM (`kaboom` — id renombrado por colisión con Bomberman)** — Considerado, P3. ARCADE ·
  green. Kaboom!: atrapar bombas con 3 cubos. Motor más barato del lote, reflejos puros, sin IA.
  Scoring bomba del grupo N vale N. `level` = nº de grupo. TouchAction "left"|"right". Riesgo:
  calibrar velocidad jugador vs bombas; puede quedar "corto" → compensar con pulido CRT.
  Handoff: /add-game "crear kaboom como fila nueva kaboom, categoria ARCADE color green"
- **PINBALL (`pinball`)** — Considerado, P4. ARCADE · yellow. Mesa ~460px centrada + paneles
  laterales (patrón CAÍDA). Scoring por elemento + multiplicador de bola, 3 bolas. Riesgo alto:
  colisión bola-flipper rotatorio, tunneling a alta velocidad (CCD/sub-stepping), diseñar una mesa
  divertida, aspecto vertical.
  Handoff: /add-game "crear pinball como fila nueva pinball, categoria ARCADE color yellow"
- **ATLETISMO (`atletismo`, Track & Field)** — Considerado, P5. ARCADE · cyan. Aporreo de teclas.
  1ª spec limitada a 2 pruebas (100m lisos + salto de longitud). Scoring por marca vs líneas de
  calificación, total acumulado; fin si no superas el mínimo. TouchAction "left-tap"|"right-tap"|
  "action". Riesgo: scope multi-prueba (cada disciplina es un minijuego).
  Handoff: /add-game "crear track and field como fila nueva atletismo con 2 pruebas (100m y salto de longitud), categoria ARCADE color cyan"
- Descartes/reservas: Rally-X (más motor: persecución + fuel + laberinto con radar), Moon Patrol
  (triple mecánica), Pac-Man `gloton` (IA fantasmas, ya descartado), Tron/Pong `duelo-pixel`
  (VERSUS), Q*bert/Dig Dug marcados aquí como descarte por IA perseguidora (el agente de ARCADE
  clásico sí los recomienda con IA simplificada — discrepancia entre agentes, decide al implementar).

### Prioridad transversal sugerida (motor barato + mejor encaje de leaderboard)

1. 2048 · 2. JOYAS · 3. MISILES · 4. ALUNIZAJE · 5. KABOOM · 6. COLAPSO · 7. SALTARÍN
   · 8. CIEMPIÉS. El resto entra después según qué categoría se quiera reforzar.
