-- =============================================================================
-- FASE C — NUTRICIÓN: cumplimiento del plan + registro de comidas
-- Ejecutar en: Supabase Dashboard > SQL Editor (después de 0002)
-- Idempotente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. NUTRITION_COMPLIANCE — una fila por cliente por día.
--    El asesorado marca si siguió el plan que le pasó el coach.
-- -----------------------------------------------------------------------------
create table if not exists public.nutrition_compliance (
  id          uuid        primary key default gen_random_uuid(),
  client_id   uuid        not null references public.clients(id) on delete cascade,
  log_date    date        not null default current_date,
  status      text        not null
                          check (status in ('cumplido', 'parcial', 'no_cumplido')),
  note        text,
  created_at  timestamptz default now(),
  unique (client_id, log_date)
);

-- -----------------------------------------------------------------------------
-- 2. NUTRITION_LOGS — una comida registrada por el asesorado (texto libre).
--    No se calculan macros automáticamente: calories/protein son opcionales.
-- -----------------------------------------------------------------------------
create table if not exists public.nutrition_logs (
  id          uuid        primary key default gen_random_uuid(),
  client_id   uuid        not null references public.clients(id) on delete cascade,
  logged_at   timestamptz default now(),
  meal_label  text,       -- opcional: "Desayuno", "Colación", etc.
  description text        not null,  -- lo que comió
  calories    integer,    -- opcional
  protein     integer,    -- opcional
  created_at  timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- 3. RLS — mismo patrón que workout_sessions en 0002.
-- -----------------------------------------------------------------------------
alter table public.nutrition_compliance enable row level security;
alter table public.nutrition_logs       enable row level security;

-- NUTRITION_COMPLIANCE -----------------------------------------------------
-- Asesorado: CRUD completo sobre SU cumplimiento (clients.user_id = auth.uid()).
drop policy if exists "ncompliance: asesorado gestiona el suyo" on public.nutrition_compliance;
create policy "ncompliance: asesorado gestiona el suyo"
  on public.nutrition_compliance for all
  using (
    exists (select 1 from public.clients c
      where c.id = nutrition_compliance.client_id and c.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.clients c
      where c.id = nutrition_compliance.client_id and c.user_id = auth.uid())
  );

-- Coach: ve/gestiona el cumplimiento de SUS clientes (clients.coach_id = auth.uid()).
drop policy if exists "ncompliance: coach gestiona el de sus clientes" on public.nutrition_compliance;
create policy "ncompliance: coach gestiona el de sus clientes"
  on public.nutrition_compliance for all
  using (
    exists (select 1 from public.clients c
      where c.id = nutrition_compliance.client_id and c.coach_id = auth.uid())
  )
  with check (
    exists (select 1 from public.clients c
      where c.id = nutrition_compliance.client_id and c.coach_id = auth.uid())
  );

-- NUTRITION_LOGS -----------------------------------------------------------
drop policy if exists "nlogs: asesorado gestiona los suyos" on public.nutrition_logs;
create policy "nlogs: asesorado gestiona los suyos"
  on public.nutrition_logs for all
  using (
    exists (select 1 from public.clients c
      where c.id = nutrition_logs.client_id and c.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.clients c
      where c.id = nutrition_logs.client_id and c.user_id = auth.uid())
  );

drop policy if exists "nlogs: coach gestiona los de sus clientes" on public.nutrition_logs;
create policy "nlogs: coach gestiona los de sus clientes"
  on public.nutrition_logs for all
  using (
    exists (select 1 from public.clients c
      where c.id = nutrition_logs.client_id and c.coach_id = auth.uid())
  )
  with check (
    exists (select 1 from public.clients c
      where c.id = nutrition_logs.client_id and c.coach_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 4. ÍNDICES
-- -----------------------------------------------------------------------------
create index if not exists idx_ncompliance_client on public.nutrition_compliance(client_id, log_date desc);
create index if not exists idx_nlogs_client        on public.nutrition_logs(client_id, logged_at desc);

-- =============================================================================
-- FIN FASE C
-- =============================================================================
