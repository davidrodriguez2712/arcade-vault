-- SPEC 06 — Tabla de juegos y leaderboard en Supabase
-- Aplicada al proyecto remoto itmhyidlxraapcjzprvn con mcp__supabase__apply_migration.
--
-- Crea:
--   public.games   — catálogo (siembra con los 8 juegos actuales de app/lib/games.ts),
--                    lectura pública, sin escritura por API.
--   public.scores  — una fila por partida guardada; inserción anónima por iniciales,
--                    validada por CHECK de columna + RLS (solo juegos con has_leaderboard).

-- ============================================================
-- Tabla games
-- ============================================================
create table public.games (
  id              text primary key,
  title           text not null,
  short           text not null,
  long            text not null,
  cat             text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover           text not null,
  color           text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  best            integer not null default 0,
  plays           text not null default '0',
  sort_order      integer not null,
  has_leaderboard boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table public.games enable row level security;

create policy "games are public readable"
  on public.games
  for select
  to anon, authenticated
  using (true);

-- ============================================================
-- Tabla scores
-- ============================================================
create table public.scores (
  id         uuid primary key default gen_random_uuid(),
  game_id    text not null references public.games (id) on delete cascade,
  name       text not null check (name ~ '^[A-Za-z0-9_]{1,12}$'),
  score      integer not null check (score >= 0 and score <= 100000000),
  level      integer not null default 1 check (level >= 1 and level <= 10000),
  created_at timestamptz not null default now()
);

create index scores_game_id_score_idx
  on public.scores (game_id, score desc, created_at desc);

alter table public.scores enable row level security;

create policy "scores are public readable"
  on public.scores
  for select
  to anon, authenticated
  using (true);

create policy "anyone can submit a score for a leaderboard game"
  on public.scores
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1
      from public.games g
      where g.id = game_id
        and g.has_leaderboard
    )
  );

-- ============================================================
-- Siembra del catálogo (valores actuales de app/lib/games.ts)
-- ============================================================
insert into public.games (id, title, short, long, cat, cover, color, best, plays, sort_order, has_leaderboard) values
  ('bloque-buster', 'BLOQUE BUSTER', 'Rebota la pelota y destruye muros de neón.', 'Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?', 'ARCADE', 'cover-bricks', 'cyan', 28450, '12.4K', 0, false),
  ('caida', 'CAÍDA', 'Encaja las piezas antes de que el techo te aplaste.', 'Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.', 'PUZZLE', 'cover-tetro', 'magenta', 184220, '31.8K', 1, false),
  ('serpentina', 'SERPENTINA', 'Crece sin morder tu propia cola.', 'Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.', 'ARCADE', 'cover-snake', 'green', 7820, '9.1K', 2, false),
  ('gloton', 'GLOTÓN', 'Devora puntos y escapa de los fantasmas.', 'Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.', 'ARCADE', 'cover-glot', 'yellow', 96400, '27.2K', 3, false),
  ('invasores', 'INVASORES', 'Defiende el planeta de filas alienígenas.', 'Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.', 'SHOOTER', 'cover-invaders', 'green', 54190, '18.0K', 4, false),
  ('rocas', 'ROCAS', 'Pulveriza asteroides en gravedad cero.', 'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Recoge el potenciador 3x para desatar el disparo triple.', 'SHOOTER', 'cover-rocas', 'yellow', 41200, '15.6K', 5, true),
  ('ranaria', 'RANARIA', 'Cruza la autopista de pixeles.', 'Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo.', 'ARCADE', 'cover-rana', 'green', 18900, '6.4K', 6, false),
  ('duelo-pixel', 'DUELO PIXEL', 'Dos paletas. Una pelota. Reflejos máximos.', 'El duelo más puro: dos paletas verticales se enfrentan por rebotar una pelota luminosa. Modo solitario contra la CPU o partida local a dos jugadores.', 'VERSUS', 'cover-duelo', 'cyan', 24, '4.2K', 7, false);
