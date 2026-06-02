-- =============================================================================
-- FASE D — FOTOS DE PROGRESO EN CHECK-INS
-- Ejecutar en: Supabase Dashboard > SQL Editor (después de 0003)
-- Idempotente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CHECKIN_PHOTOS — metadatos de cada foto subida por el asesorado.
--    El archivo en sí vive en Storage (bucket 'progress-photos'); acá solo
--    guardamos el path y datos de contexto.
-- -----------------------------------------------------------------------------
create table if not exists public.checkin_photos (
  id            uuid        primary key default gen_random_uuid(),
  client_id     uuid        not null references public.clients(id) on delete cascade,
  checkin_id    uuid        references public.checkins(id) on delete set null,  -- opcional, vincula al check-in
  storage_path  text        not null,  -- path dentro del bucket: {client_id}/{uuid}.{ext}
  pose          text,       -- opcional: 'frente' | 'perfil' | 'espalda'
  taken_at      date        default current_date,
  created_at    timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- 2. RLS sobre checkin_photos — mismo patrón que las tablas de 0002/0003.
-- -----------------------------------------------------------------------------
alter table public.checkin_photos enable row level security;

-- Asesorado: CRUD completo sobre SUS fotos (clients.user_id = auth.uid()).
drop policy if exists "cphotos: asesorado gestiona las suyas" on public.checkin_photos;
create policy "cphotos: asesorado gestiona las suyas"
  on public.checkin_photos for all
  using (
    exists (select 1 from public.clients c
      where c.id = checkin_photos.client_id and c.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.clients c
      where c.id = checkin_photos.client_id and c.user_id = auth.uid())
  );

-- Coach: ve/gestiona las fotos de SUS clientes (clients.coach_id = auth.uid()).
drop policy if exists "cphotos: coach gestiona las de sus clientes" on public.checkin_photos;
create policy "cphotos: coach gestiona las de sus clientes"
  on public.checkin_photos for all
  using (
    exists (select 1 from public.clients c
      where c.id = checkin_photos.client_id and c.coach_id = auth.uid())
  )
  with check (
    exists (select 1 from public.clients c
      where c.id = checkin_photos.client_id and c.coach_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 3. ÍNDICE
-- -----------------------------------------------------------------------------
create index if not exists idx_cphotos_client on public.checkin_photos(client_id, created_at desc);

-- =============================================================================
-- 4. STORAGE — bucket privado 'progress-photos'
--    Convención de path: {client_id}/{uuid}.{ext}
--    (storage.foldername(name))[1] = primer segmento del path = client_id::text
-- =============================================================================

-- Bucket privado (no público). Idempotente vía on conflict.
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

-- Asesorado: subir (INSERT) sus propias fotos.
drop policy if exists "cphotos storage: asesorado sube las suyas" on storage.objects;
create policy "cphotos storage: asesorado sube las suyas"
  on storage.objects for insert
  with check (
    bucket_id = 'progress-photos'
    and exists (
      select 1 from public.clients c
      where c.id::text = (storage.foldername(name))[1]
        and c.user_id = auth.uid()
    )
  );

-- Asesorado: ver (SELECT) sus propias fotos.
drop policy if exists "cphotos storage: asesorado ve las suyas" on storage.objects;
create policy "cphotos storage: asesorado ve las suyas"
  on storage.objects for select
  using (
    bucket_id = 'progress-photos'
    and exists (
      select 1 from public.clients c
      where c.id::text = (storage.foldername(name))[1]
        and c.user_id = auth.uid()
    )
  );

-- Asesorado: borrar (DELETE) sus propias fotos.
drop policy if exists "cphotos storage: asesorado borra las suyas" on storage.objects;
create policy "cphotos storage: asesorado borra las suyas"
  on storage.objects for delete
  using (
    bucket_id = 'progress-photos'
    and exists (
      select 1 from public.clients c
      where c.id::text = (storage.foldername(name))[1]
        and c.user_id = auth.uid()
    )
  );

-- Coach: ver (SELECT) las fotos de sus clientes.
drop policy if exists "cphotos storage: coach ve las de sus clientes" on storage.objects;
create policy "cphotos storage: coach ve las de sus clientes"
  on storage.objects for select
  using (
    bucket_id = 'progress-photos'
    and exists (
      select 1 from public.clients c
      where c.id::text = (storage.foldername(name))[1]
        and c.coach_id = auth.uid()
    )
  );

-- =============================================================================
-- NOTA OPERATIVA
-- Si en este entorno la creación del bucket por SQL no surte efecto (algunos
-- proyectos restringen el INSERT en storage.buckets), creá a mano en el
-- dashboard un bucket PRIVADO llamado exactamente 'progress-photos'
-- (Storage > New bucket > Public = OFF). Las policias de arriba ya quedan listas.
-- =============================================================================

-- =============================================================================
-- FIN FASE D
-- =============================================================================
