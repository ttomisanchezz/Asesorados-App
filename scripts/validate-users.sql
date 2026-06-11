-- ===========================================================================
-- validate-users.sql — Validación de la app contra datos reales (Supabase).
-- Correr en el SQL Editor del proyecto. Dos chequeos:
--   1) Completitud por asesorado (readiness para el link)
--   2) Aislamiento RLS por usuario (cada uno ve SOLO lo suyo)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) COMPLETITUD POR ASESORADO
--    Los ejercicios viven en days[].exercises, NO en la columna `exercises`.
-- ---------------------------------------------------------------------------
with aw as (
  select distinct on (client_id) client_id, days from public.workout_plans
  where active = true order by client_id, created_at desc
),
an as (
  select distinct on (client_id) client_id, calories, protein, carbs, fats from public.nutrition_plans
  where active = true order by client_id, created_at desc
)
select
  c.full_name,
  (c.user_id is not null)                                            as login,
  (c.objective is not null and c.objective <> '')                    as objetivo,
  (c.weight is not null)                                             as peso,
  (an.calories is not null and an.protein is not null
    and an.carbs is not null and an.fats is not null)               as macros_ok,
  coalesce((select sum(case when jsonb_typeof(d->'exercises')='array'
        then jsonb_array_length(d->'exercises') else 0 end)
     from jsonb_array_elements(coalesce(aw.days,'[]'::jsonb)) d),0)  as ejercicios,
  case when c.user_id is not null
        and an.calories is not null and an.protein is not null
        and an.carbs is not null and an.fats is not null
        and coalesce((select sum(case when jsonb_typeof(d->'exercises')='array'
              then jsonb_array_length(d->'exercises') else 0 end)
           from jsonb_array_elements(coalesce(aw.days,'[]'::jsonb)) d),0) > 0
       then 'LISTO' else 'FALTA' end                                 as estado
from public.clients c
left join aw on aw.client_id = c.id
left join an on an.client_id = c.id
order by c.full_name;

-- ---------------------------------------------------------------------------
-- 2) AISLAMIENTO RLS — impersona a cada usuario autenticado y verifica que ve
--    solo su propia ficha / nutrición / rutina (0 filas ajenas).
-- ---------------------------------------------------------------------------
begin;
create temp table rls_test(
  name text, c_own int, c_others int, n_own int, n_others int, w_own int, w_others int
) on commit drop;

do $$
declare r record; c_own int; c_oth int; n_own int; n_oth int; w_own int; w_oth int;
begin
  for r in select id, user_id, full_name from public.clients where user_id is not null loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', r.user_id::text, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into c_own from public.clients         c where c.id = r.id;
    select count(*) into c_oth from public.clients         c where c.id <> r.id;
    select count(*) into n_own from public.nutrition_plans n where n.client_id = r.id;
    select count(*) into n_oth from public.nutrition_plans n where n.client_id <> r.id;
    select count(*) into w_own from public.workout_plans   w where w.client_id = r.id;
    select count(*) into w_oth from public.workout_plans   w where w.client_id <> r.id;
    reset role;
    insert into rls_test values (r.full_name, c_own, c_oth, n_own, n_oth, w_own, w_oth);
  end loop;
end $$;

select name,
  c_own as ve_su_ficha, c_others as ve_fichas_ajenas,
  n_own as ve_su_nutri, n_others as ve_nutri_ajena,
  w_own as ve_su_rutina, w_others as ve_rutina_ajena,
  case when c_own = 1 and c_others = 0 and n_others = 0 and w_others = 0
       then 'OK RLS' else 'FALLA RLS' end as rls
from rls_test order by name;
rollback;
