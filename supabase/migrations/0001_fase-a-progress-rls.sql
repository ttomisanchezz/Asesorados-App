-- =============================================================================
-- FASE A — CAMBIO 2: el asesorado puede registrar su propio peso
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Idempotente: se puede correr más de una vez sin romper nada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. RLS faltante: INSERT y UPDATE de progress_metrics para el asesorado.
--    Antes solo existían "for all (coach)" y "for select (asesorado)", por eso
--    el insert del asesorado caía con error 42501 (RLS violation).
-- -----------------------------------------------------------------------------

drop policy if exists "progress: asesorado inserta el suyo" on public.progress_metrics;
create policy "progress: asesorado inserta el suyo"
  on public.progress_metrics for insert
  with check (
    exists (
      select 1 from public.clients c
      where c.id = progress_metrics.client_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "progress: asesorado actualiza el suyo" on public.progress_metrics;
create policy "progress: asesorado actualiza el suyo"
  on public.progress_metrics for update
  using (
    exists (
      select 1 from public.clients c
      where c.id = progress_metrics.client_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.clients c
      where c.id = progress_metrics.client_id
        and c.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 2. Sincronización segura de clients.weight (peso denormalizado).
--    NO le damos UPDATE sobre clients al asesorado (una policy de UPDATE no
--    restringe columnas: podría cambiarse coach_id, objetivo, etc.). En su lugar
--    un trigger SECURITY DEFINER mantiene clients.weight = último peso real.
-- -----------------------------------------------------------------------------

create or replace function public.sync_client_weight()
returns trigger language plpgsql security definer as $$
begin
  if NEW.weight is not null then
    update public.clients c
      set weight = NEW.weight
      where c.id = NEW.client_id
        and not exists (
          select 1 from public.progress_metrics p
          where p.client_id = NEW.client_id
            and p.weight is not null
            and p.created_at > NEW.created_at
        );
  end if;
  return NEW;
end;
$$;

drop trigger if exists progress_metrics_sync_weight on public.progress_metrics;
create trigger progress_metrics_sync_weight
  after insert or update on public.progress_metrics
  for each row execute procedure public.sync_client_weight();

-- =============================================================================
-- FIN FASE A
-- =============================================================================
