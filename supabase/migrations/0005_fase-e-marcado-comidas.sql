-- =============================================================================
-- FASE E — NUTRICIÓN: marcado de comidas consumidas + % de cumplimiento real
-- Ejecutar en: Supabase Dashboard > SQL Editor (después de 0004)
-- Idempotente.
--
-- El asesorado deja de auto-reportar "Cumplí / A medias / No cumplí" a mano:
-- ahora marca, por cada comida del plan, la OPCIÓN que efectivamente comió.
-- El cumplimiento del día se deriva de esas marcas (comidas marcadas / comidas
-- del plan de ese día) y se sincroniza a nutrition_compliance, que es la fuente
-- que ya alimenta la adherencia del coach (dashboard + ficha del asesorado).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. NUTRITION_MEAL_CHECKS — una fila por comida del plan marcada en un día.
--    Una sola opción por comida (son alternativas): unique (client, día, comida).
--    meal_key identifica la comida dentro del plan: "schemeIndex:mealIndex".
--    Los campos *_label/_title están denormalizados para que el coach vea
--    contexto legible aunque el plan cambie más adelante.
-- -----------------------------------------------------------------------------
create table if not exists public.nutrition_meal_checks (
  id            uuid        primary key default gen_random_uuid(),
  client_id     uuid        not null references public.clients(id) on delete cascade,
  log_date      date        not null default current_date,
  meal_key      text        not null,   -- "schemeIndex:mealIndex" dentro del plan
  scheme_label  text,                    -- ej. "Lunes" (vacío en planes diarios)
  meal_name     text,                    -- ej. "Almuerzo"
  option_index  integer,                 -- índice de la opción que comió
  option_title  text,                    -- ej. "Opción 2"
  created_at    timestamptz default now(),
  unique (client_id, log_date, meal_key)
);

-- -----------------------------------------------------------------------------
-- 2. NUTRITION_COMPLIANCE — columnas de ratio para un % honesto.
--    Antes el cumplimiento era solo un enum (cumplido/parcial/no_cumplido) que
--    perdía precisión (3 de 4 comidas = "parcial" = 50%). meals_done/meals_total
--    permiten calcular el % real (3/4 = 75%). Quedan nullable: las filas viejas
--    siguen valiéndose del enum.
-- -----------------------------------------------------------------------------
alter table public.nutrition_compliance add column if not exists meals_done  integer;
alter table public.nutrition_compliance add column if not exists meals_total integer;

-- -----------------------------------------------------------------------------
-- 3. RLS — mismo patrón que nutrition_compliance en 0003.
-- -----------------------------------------------------------------------------
alter table public.nutrition_meal_checks enable row level security;

-- Asesorado: CRUD completo sobre SUS marcas (clients.user_id = auth.uid()).
drop policy if exists "nmealchecks: asesorado gestiona las suyas" on public.nutrition_meal_checks;
create policy "nmealchecks: asesorado gestiona las suyas"
  on public.nutrition_meal_checks for all
  using (
    exists (select 1 from public.clients c
      where c.id = nutrition_meal_checks.client_id and c.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.clients c
      where c.id = nutrition_meal_checks.client_id and c.user_id = auth.uid())
  );

-- Coach: ve/gestiona las marcas de SUS clientes (clients.coach_id = auth.uid()).
drop policy if exists "nmealchecks: coach gestiona las de sus clientes" on public.nutrition_meal_checks;
create policy "nmealchecks: coach gestiona las de sus clientes"
  on public.nutrition_meal_checks for all
  using (
    exists (select 1 from public.clients c
      where c.id = nutrition_meal_checks.client_id and c.coach_id = auth.uid())
  )
  with check (
    exists (select 1 from public.clients c
      where c.id = nutrition_meal_checks.client_id and c.coach_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 4. ÍNDICES
-- -----------------------------------------------------------------------------
create index if not exists idx_nmealchecks_client on public.nutrition_meal_checks(client_id, log_date desc);

-- =============================================================================
-- FIN FASE E
-- =============================================================================
