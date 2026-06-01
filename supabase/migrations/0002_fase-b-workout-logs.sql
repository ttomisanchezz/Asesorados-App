-- =============================================================================
-- FASE B — CAMBIO 1: registro de entrenamientos por serie
-- Ejecutar en: Supabase Dashboard > SQL Editor (después de 0001)
-- Idempotente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. WORKOUT_SESSIONS — una fila por entrenamiento realizado (un día del plan).
-- -----------------------------------------------------------------------------
create table if not exists public.workout_sessions (
  id              uuid        primary key default gen_random_uuid(),
  client_id       uuid        not null references public.clients(id) on delete cascade,
  workout_plan_id uuid        references public.workout_plans(id) on delete set null,
  day_key         text,       -- identificador del día del plan: "Día 1", etc.
  day_name        text,       -- enfoque/título del día: "Pierna — glúteo"
  performed_at    timestamptz default now(),
  notes           text,
  created_at      timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- 2. WORKOUT_EXERCISE_LOGS — una fila por SERIE realizada dentro de una sesión.
--    client_id está denormalizado para RLS simple y para la query de
--    "último peso por ejercicio".
-- -----------------------------------------------------------------------------
create table if not exists public.workout_exercise_logs (
  id              uuid        primary key default gen_random_uuid(),
  session_id      uuid        not null references public.workout_sessions(id) on delete cascade,
  client_id       uuid        not null references public.clients(id) on delete cascade,
  exercise_name   text        not null,
  exercise_order  integer,
  set_number      integer     not null,
  target_reps     text,       -- rango objetivo, ej "10-12" (texto, no se calcula)
  actual_reps     integer,
  weight          numeric(6,2),
  rir             numeric(3,1),
  notes           text,
  created_at      timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- 3. RLS
-- -----------------------------------------------------------------------------
alter table public.workout_sessions      enable row level security;
alter table public.workout_exercise_logs enable row level security;

-- WORKOUT_SESSIONS ---------------------------------------------------------
-- Asesorado: CRUD completo sobre SUS sesiones (clients.user_id = auth.uid()).
drop policy if exists "wsessions: asesorado gestiona las suyas" on public.workout_sessions;
create policy "wsessions: asesorado gestiona las suyas"
  on public.workout_sessions for all
  using (
    exists (select 1 from public.clients c
      where c.id = workout_sessions.client_id and c.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.clients c
      where c.id = workout_sessions.client_id and c.user_id = auth.uid())
  );

-- Coach: ve/gestiona las sesiones de SUS clientes (clients.coach_id = auth.uid()).
drop policy if exists "wsessions: coach gestiona las de sus clientes" on public.workout_sessions;
create policy "wsessions: coach gestiona las de sus clientes"
  on public.workout_sessions for all
  using (
    exists (select 1 from public.clients c
      where c.id = workout_sessions.client_id and c.coach_id = auth.uid())
  )
  with check (
    exists (select 1 from public.clients c
      where c.id = workout_sessions.client_id and c.coach_id = auth.uid())
  );

-- WORKOUT_EXERCISE_LOGS ----------------------------------------------------
drop policy if exists "wlogs: asesorado gestiona los suyos" on public.workout_exercise_logs;
create policy "wlogs: asesorado gestiona los suyos"
  on public.workout_exercise_logs for all
  using (
    exists (select 1 from public.clients c
      where c.id = workout_exercise_logs.client_id and c.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.clients c
      where c.id = workout_exercise_logs.client_id and c.user_id = auth.uid())
  );

drop policy if exists "wlogs: coach gestiona los de sus clientes" on public.workout_exercise_logs;
create policy "wlogs: coach gestiona los de sus clientes"
  on public.workout_exercise_logs for all
  using (
    exists (select 1 from public.clients c
      where c.id = workout_exercise_logs.client_id and c.coach_id = auth.uid())
  )
  with check (
    exists (select 1 from public.clients c
      where c.id = workout_exercise_logs.client_id and c.coach_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 4. ÍNDICES
-- -----------------------------------------------------------------------------
create index if not exists idx_wsessions_client      on public.workout_sessions(client_id, performed_at desc);
create index if not exists idx_wlogs_session          on public.workout_exercise_logs(session_id);
-- Clave para "último peso por ejercicio":
create index if not exists idx_wlogs_client_exercise  on public.workout_exercise_logs(client_id, exercise_name, created_at desc);

-- =============================================================================
-- FIN FASE B (parte 1: estructura)
-- =============================================================================
