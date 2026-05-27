-- =============================================================================
-- Asesorados App — Schema inicial
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PROFILES
-- Extiende auth.users con rol y nombre.
-- Se crea automáticamente al registrar un usuario (ver trigger más abajo).
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        text        not null default 'client'
                          check (role in ('coach', 'client')),
  created_at  timestamptz default now()
);

-- Trigger: crea el perfil automáticamente cuando se registra un usuario
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'client')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 2. CLIENTS
-- Cada asesorado pertenece a un coach.
-- user_id es nullable: se llena cuando el asesorado crea su cuenta de auth.
-- -----------------------------------------------------------------------------
create table if not exists public.clients (
  id                    uuid        primary key default gen_random_uuid(),
  coach_id              uuid        not null references public.profiles(id) on delete cascade,
  user_id               uuid        references public.profiles(id) on delete set null,
  slug                  text        unique,
  full_name             text        not null,
  email                 text,
  phone                 text,
  objective             text,
  age                   integer,
  weight                numeric(5,2),
  target_weight         numeric(5,2),
  height                numeric(5,1),
  experience            text,
  available_days        jsonb       default '[]',
  limitations           text,
  status                text        not null default 'active'
                        check (status in ('active', 'paused', 'finished')),
  adherence_nutrition   integer     default 0 check (adherence_nutrition between 0 and 100),
  adherence_training    integer     default 0 check (adherence_training between 0 and 100),
  avatar_initials       text,
  avatar_color          text,
  internal_notes        text,
  weekly_goal           text,
  next_review           date,
  last_checkin          date,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- Trigger: actualiza updated_at automáticamente
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_updated_at
  before update on public.clients
  for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. NUTRITION_PLANS
-- Un cliente puede tener múltiples planes; solo uno activo a la vez.
-- meals y meals se guardan como JSONB para flexibilidad.
-- -----------------------------------------------------------------------------
create table if not exists public.nutrition_plans (
  id          uuid        primary key default gen_random_uuid(),
  coach_id    uuid        not null references public.profiles(id) on delete cascade,
  client_id   uuid        not null references public.clients(id) on delete cascade,
  calories    integer,
  protein     integer,
  carbs       integer,
  fats        integer,
  meals       jsonb       default '[]',
  -- Formato meals: [{ name, calories, description }]
  notes       text,
  active      boolean     default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create trigger nutrition_plans_updated_at
  before update on public.nutrition_plans
  for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. WORKOUT_PLANS
-- Rutina activa del cliente.
-- exercises se guarda como JSONB: [{ name, sets, reps, load, notes }]
-- -----------------------------------------------------------------------------
create table if not exists public.workout_plans (
  id          uuid        primary key default gen_random_uuid(),
  coach_id    uuid        not null references public.profiles(id) on delete cascade,
  client_id   uuid        not null references public.clients(id) on delete cascade,
  title       text,
  days        jsonb       default '[]',
  -- Formato days: ["Lunes", "Miércoles", "Viernes"]
  exercises   jsonb       default '[]',
  -- Formato exercises: [{ name, sets, reps, load, notes }]
  notes       text,
  active      boolean     default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create trigger workout_plans_updated_at
  before update on public.workout_plans
  for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. CHECKINS
-- Registro semanal del asesorado. El coach agrega feedback después.
-- -----------------------------------------------------------------------------
create table if not exists public.checkins (
  id                    uuid        primary key default gen_random_uuid(),
  coach_id              uuid        not null references public.profiles(id) on delete cascade,
  client_id             uuid        not null references public.clients(id) on delete cascade,
  weight                numeric(5,2),
  energy                integer     check (energy between 1 and 5),
  hunger                integer     check (hunger between 1 and 5),
  sleep                 integer     check (sleep between 1 and 5),
  stress                integer     check (stress between 1 and 5),
  nutrition_adherence   integer     check (nutrition_adherence between 0 and 100),
  training_adherence    integer     check (training_adherence between 0 and 100),
  client_comment        text,
  coach_feedback        text,
  decision              text        check (decision in ('maintain', 'adjust', 'review')),
  created_at            timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- 6. PROGRESS_METRICS
-- Medidas corporales históricas.
-- -----------------------------------------------------------------------------
create table if not exists public.progress_metrics (
  id          uuid        primary key default gen_random_uuid(),
  coach_id    uuid        not null references public.profiles(id) on delete cascade,
  client_id   uuid        not null references public.clients(id) on delete cascade,
  weight      numeric(5,2),
  waist       numeric(5,1),
  chest       numeric(5,1),
  hip         numeric(5,1),
  arm         numeric(5,1),
  leg         numeric(5,1),
  notes       text,
  created_at  timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- 7. COACH_NOTES
-- Notas internas del coach sobre el asesorado.
-- -----------------------------------------------------------------------------
create table if not exists public.coach_notes (
  id          uuid        primary key default gen_random_uuid(),
  coach_id    uuid        not null references public.profiles(id) on delete cascade,
  client_id   uuid        not null references public.clients(id) on delete cascade,
  note        text        not null,
  created_at  timestamptz default now()
);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.profiles        enable row level security;
alter table public.clients         enable row level security;
alter table public.nutrition_plans enable row level security;
alter table public.workout_plans   enable row level security;
alter table public.checkins        enable row level security;
alter table public.progress_metrics enable row level security;
alter table public.coach_notes     enable row level security;

-- ---- PROFILES ----

create policy "profile: usuario ve el propio"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profile: usuario actualiza el propio"
  on public.profiles for update
  using (auth.uid() = id);

-- ---- CLIENTS ----

-- Coach: control total sobre sus clientes
create policy "clients: coach gestiona los suyos"
  on public.clients for all
  using (auth.uid() = coach_id);

-- Asesorado: solo puede leer su propio registro
create policy "clients: asesorado ve el suyo"
  on public.clients for select
  using (auth.uid() = user_id);

-- ---- NUTRITION_PLANS ----

create policy "nutrition: coach gestiona los suyos"
  on public.nutrition_plans for all
  using (auth.uid() = coach_id);

create policy "nutrition: asesorado ve el suyo"
  on public.nutrition_plans for select
  using (
    exists (
      select 1 from public.clients c
      where c.id = nutrition_plans.client_id
        and c.user_id = auth.uid()
    )
  );

-- ---- WORKOUT_PLANS ----

create policy "workout: coach gestiona los suyos"
  on public.workout_plans for all
  using (auth.uid() = coach_id);

create policy "workout: asesorado ve el suyo"
  on public.workout_plans for select
  using (
    exists (
      select 1 from public.clients c
      where c.id = workout_plans.client_id
        and c.user_id = auth.uid()
    )
  );

-- ---- CHECKINS ----

-- Coach: control total
create policy "checkins: coach gestiona los suyos"
  on public.checkins for all
  using (auth.uid() = coach_id);

-- Asesorado: puede leer y crear sus propios check-ins
create policy "checkins: asesorado lee los suyos"
  on public.checkins for select
  using (
    exists (
      select 1 from public.clients c
      where c.id = checkins.client_id
        and c.user_id = auth.uid()
    )
  );

create policy "checkins: asesorado crea el suyo"
  on public.checkins for insert
  with check (
    exists (
      select 1 from public.clients c
      where c.id = checkins.client_id
        and c.user_id = auth.uid()
    )
  );

-- ---- PROGRESS_METRICS ----

create policy "progress: coach gestiona los suyos"
  on public.progress_metrics for all
  using (auth.uid() = coach_id);

create policy "progress: asesorado ve los suyos"
  on public.progress_metrics for select
  using (
    exists (
      select 1 from public.clients c
      where c.id = progress_metrics.client_id
        and c.user_id = auth.uid()
    )
  );

-- ---- COACH_NOTES ----

-- Solo el coach puede ver sus notas internas
create policy "notes: coach gestiona las suyas"
  on public.coach_notes for all
  using (auth.uid() = coach_id);

-- =============================================================================
-- ÍNDICES útiles para queries frecuentes
-- =============================================================================

create index if not exists idx_clients_coach_id   on public.clients(coach_id);
create index if not exists idx_clients_user_id    on public.clients(user_id);
create index if not exists idx_checkins_client_id on public.checkins(client_id);
create index if not exists idx_checkins_created   on public.checkins(created_at desc);
create index if not exists idx_nutrition_client   on public.nutrition_plans(client_id, active);
create index if not exists idx_workout_client     on public.workout_plans(client_id, active);
create index if not exists idx_progress_client    on public.progress_metrics(client_id, created_at desc);

-- =============================================================================
-- FIN DEL SCHEMA
-- Próxima migración planeada: video_reviews (no ejecutar todavía)
-- =============================================================================
