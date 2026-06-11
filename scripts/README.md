# Scripts de validación

Validan que la app esté completa y segura para TODOS los asesorados, contra la base real.

## `validate-users.mjs` — readiness por usuario (Node)

Audita cada asesorado: login, objetivo, peso, nutrición con macros y rutina con ejercicios.
Sale con código ≠ 0 si alguno no está listo (sirve para CI).

```bash
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
npm run test:data
```

> La `service_role` key **no** se commitea ni vive en `.env.local` (ahí solo va la `anon`).
> Pasala por variable de entorno en el momento de correr.

## `validate-users.sql` — completitud + aislamiento RLS (SQL Editor)

Pegar en el SQL Editor de Supabase. Hace dos cosas:

1. **Completitud**: misma readiness que el `.mjs`, por asesorado.
2. **RLS**: impersona a cada usuario y verifica que vea **solo lo suyo** (0 filas ajenas de ficha, nutrición y rutina).

## Tests automatizados de la app

La lógica de la app (helpers puros + normalizers de los services) se testea con Vitest:

```bash
npm test
```
