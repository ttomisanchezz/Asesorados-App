# Asesorados App

Plataforma de gestión para coaching de fitness y nutrición. Dos roles:

- **Coach**: dashboard, fichas de asesorados, planes de nutrición y entrenamiento, check-ins y progreso.
- **Asesorado (client)**: panel propio con su plan, rutina con registro de series, cumplimiento nutricional, fotos de progreso y evolución de peso.

## Stack

- React 19 + Vite
- Tailwind CSS 3.4
- Supabase (Auth, Database con RLS, Storage privado con signed URLs)
- Vercel (SPA rewrites en `vercel.json`)
- Vitest (tests de services y libs)

## Variables de entorno

Crear `.env.local` (nunca se commitea) con:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Sin estas variables la app corre en **modo demo** (mock data, sin auth). La `service_role` key **nunca** va en el frontend: solo se usa en scripts, vía variable de entorno.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run preview` | Sirve el build localmente |
| `npm run lint` | ESLint sobre todo el repo |
| `npm test` | Vitest (services con Supabase mockeado + libs) |
| `npm run test:data` | Valida usuarios/vínculos contra la DB real (read-only) |

## Estructura

```
src/
  app/          Router + App (AuthProvider)
  components/   auth (ProtectedRoute), layout (coach), panel (asesorado), ui
  context/      AuthContext (sesión + rol desde profiles)
  lib/          supabaseClient, helpers puros (mealPlan, foodLogs, photoGroups)
  pages/        Coach: Dashboard, Clients, ClientDetail, Nutrition, Training,
                Checkins, Progress, Settings
                Asesorado: MiPanel, MiNutricion, MiRutina, MisCheckins, MiProgreso
  services/     Acceso a Supabase (única capa que toca el client)
scripts/        Imports y vinculación auth↔clients (dry-run por defecto)
supabase/       schema.sql + migraciones aplicadas
```

## Convenciones

- El cliente de Supabase se usa **solo en `src/services/`**, nunca en componentes.
- Toda escritura corre con la sesión del navegador y la autoriza **RLS** (el asesorado solo toca lo suyo).
- Las fotos van al bucket privado `progress-photos` y se sirven con signed URLs (1 h).
- En rutinas reales, los ejercicios viven anidados en `workout_plans.days[].exercises` (la columna `exercises` de nivel plan queda vacía).
- Los scripts destructivos requieren `--apply` explícito; sin flag son dry-run.
