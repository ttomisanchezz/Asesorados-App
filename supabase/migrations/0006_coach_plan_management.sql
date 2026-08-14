-- Finalización del panel coach: historial/versionado seguro de planes.
-- Idempotente y ejecutable después de 0005.

alter table public.nutrition_plans
  add column if not exists title text;

alter table public.clients
  add column if not exists gender text;

-- Si existieran duplicados activos históricos, conservar únicamente el más nuevo
-- antes de instalar la garantía de base de datos.
with ranked as (
  select id,
         row_number() over (
           partition by client_id
           order by created_at desc nulls last, id desc
         ) as position
  from public.nutrition_plans
  where active is true
)
update public.nutrition_plans p
set active = false
from ranked r
where p.id = r.id and r.position > 1;

with ranked as (
  select id,
         row_number() over (
           partition by client_id
           order by created_at desc nulls last, id desc
         ) as position
  from public.workout_plans
  where active is true
)
update public.workout_plans p
set active = false
from ranked r
where p.id = r.id and r.position > 1;

create unique index if not exists nutrition_plans_one_active_per_client
  on public.nutrition_plans (client_id)
  where active is true;

create unique index if not exists workout_plans_one_active_per_client
  on public.workout_plans (client_id)
  where active is true;

-- SECURITY INVOKER mantiene RLS: además verificamos explícitamente rol y dueño.
-- Toda la función corre en una única transacción, por lo que no puede dejar al
-- cliente sin plan activo si el insert falla.
create or replace function public.create_nutrition_plan_version(
  p_client_id uuid,
  p_title text default null,
  p_calories integer default null,
  p_protein integer default null,
  p_carbs integer default null,
  p_fats integer default null,
  p_meals jsonb default '[]'::jsonb,
  p_notes text default null
)
returns public.nutrition_plans
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  created public.nutrition_plans;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.clients c
    join public.profiles p on p.id = c.coach_id
    where c.id = p_client_id
      and c.coach_id = auth.uid()
      and p.role = 'coach'
  ) then
    raise exception 'No autorizado para administrar este cliente'
      using errcode = '42501';
  end if;

  update public.nutrition_plans
  set active = false
  where client_id = p_client_id and active is true;

  insert into public.nutrition_plans (
    coach_id, client_id, title, calories, protein, carbs, fats, meals, notes, active
  ) values (
    auth.uid(), p_client_id, nullif(trim(p_title), ''), p_calories, p_protein,
    p_carbs, p_fats, coalesce(p_meals, '[]'::jsonb), nullif(trim(p_notes), ''), true
  )
  returning * into created;

  return created;
end;
$$;

create or replace function public.create_workout_plan_version(
  p_client_id uuid,
  p_title text default null,
  p_days jsonb default '[]'::jsonb,
  p_exercises jsonb default '[]'::jsonb,
  p_notes text default null
)
returns public.workout_plans
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  created public.workout_plans;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.clients c
    join public.profiles p on p.id = c.coach_id
    where c.id = p_client_id
      and c.coach_id = auth.uid()
      and p.role = 'coach'
  ) then
    raise exception 'No autorizado para administrar este cliente'
      using errcode = '42501';
  end if;

  update public.workout_plans
  set active = false
  where client_id = p_client_id and active is true;

  insert into public.workout_plans (
    coach_id, client_id, title, days, exercises, notes, active
  ) values (
    auth.uid(), p_client_id, nullif(trim(p_title), ''), coalesce(p_days, '[]'::jsonb),
    coalesce(p_exercises, '[]'::jsonb), nullif(trim(p_notes), ''), true
  )
  returning * into created;

  return created;
end;
$$;

-- Última actividad real para desempatar el listado semanal sin descargar todo
-- el historial al navegador. SECURITY INVOKER conserva las políticas RLS.
create or replace function public.get_coach_client_latest_activity(p_client_ids uuid[])
returns table (client_id uuid, last_activity_at timestamptz)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select activity.client_id, max(activity.activity_at) as last_activity_at
  from (
    select client_id, performed_at as activity_at from public.workout_sessions
    union all
    select client_id, logged_at from public.nutrition_logs
    union all
    select client_id, coalesce(created_at, log_date::timestamptz) from public.nutrition_compliance
    union all
    select client_id, coalesce(created_at, log_date::timestamptz) from public.nutrition_meal_checks
    union all
    select client_id, created_at from public.checkins
    union all
    select client_id, created_at from public.progress_metrics
    union all
    select client_id, created_at from public.checkin_photos
  ) activity
  join public.clients c on c.id = activity.client_id
  where activity.client_id = any(p_client_ids)
    and c.coach_id = auth.uid()
  group by activity.client_id;
$$;

revoke all on function public.create_nutrition_plan_version(
  uuid, text, integer, integer, integer, integer, jsonb, text
) from public;
grant execute on function public.create_nutrition_plan_version(
  uuid, text, integer, integer, integer, integer, jsonb, text
) to authenticated;

revoke all on function public.create_workout_plan_version(
  uuid, text, jsonb, jsonb, text
) from public;
grant execute on function public.create_workout_plan_version(
  uuid, text, jsonb, jsonb, text
) to authenticated;

revoke all on function public.get_coach_client_latest_activity(uuid[]) from public;
grant execute on function public.get_coach_client_latest_activity(uuid[]) to authenticated;
