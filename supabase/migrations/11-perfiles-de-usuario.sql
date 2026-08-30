-- SPEC 12 — Registro, inicio de sesión y autenticación: tabla de perfiles
-- Aplicada al proyecto remoto itmhyidlxraapcjzprvn con mcp__supabase__apply_migration.
--
-- Crea:
--   public.profiles          — una fila por auth.users; username público único
--                              (sin distinción de mayúsculas). Lectura pública,
--                              UPDATE solo del dueño. Sin INSERT ni DELETE por API
--                              (la fila la crea el trigger de abajo).
--   public.handle_new_user() — trigger que rellena profiles en cada alta,
--                              derivando el username del alta
--                              (options.data.username) o del prefijo del email,
--                              con sufijo numérico si el candidato ya existe.
--
-- No se toca public.games ni public.scores: el leaderboard sigue siendo anónimo.

-- ============================================================
-- Tabla profiles
-- ============================================================
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unicidad del username sin distinción de mayúsculas.
create unique index profiles_username_lower_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

create policy "profiles are public readable"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

create policy "users update their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ============================================================
-- Alta de usuario -> fila en profiles
-- ============================================================
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_name  text;
  base      text;
  candidate text;
  suffix    int := 1;
begin
  raw_name := coalesce(
    new.raw_user_meta_data ->> 'username',
    split_part(coalesce(new.email, ''), '@', 1)
  );

  -- Normalizar: minúsculas y solo [a-z0-9_].
  base := lower(regexp_replace(coalesce(raw_name, ''), '[^a-zA-Z0-9_]', '', 'g'));

  -- Respetar el CHECK de longitud (3..16 caracteres).
  if length(base) < 3 then
    base := 'player' || base;
  end if;
  base := left(base, 16);

  -- Buscar un hueco libre (case-insensitive): base, base2, base3, ...
  candidate := base;
  while exists (
    select 1 from public.profiles p where lower(p.username) = lower(candidate)
  ) loop
    suffix := suffix + 1;
    candidate := left(base, 16 - length(suffix::text)) || suffix::text;
  end loop;

  insert into public.profiles (id, username) values (new.id, candidate);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- El trigger la invoca internamente; nadie debe poder llamarla como RPC
-- (`/rest/v1/rpc/handle_new_user`). Sin esto el linter de seguridad avisa.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- ============================================================
-- ¿Está libre este username? (case-insensitive)
-- ============================================================
-- La usan los Server Actions de alta y de cambio de nombre para avisar antes de
-- tocar la DB. SECURITY INVOKER: se apoya en la política de SELECT pública de
-- profiles; no hace falta `security definer`. El índice único sobre
-- lower(username) sigue siendo la garantía real ante carreras.
create function public.username_available(name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(name)
  );
$$;
