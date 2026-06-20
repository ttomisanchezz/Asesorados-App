---
name: build
description: Construye EXACTAMENTE lo que dice una spec de specs/<nombre>.md, sin agregar features, sin refactorizar de más, sin inventar requisitos. Úsalo después de /spec, normalmente dentro del loop /build + /review. Es el paso /build del método Loops.
---

# /build — Spec → Build

## Qué hacés al invocarte

1. **Leé la spec** en `specs/<nombre>.md`. Si hay varias y no se aclaró cuál, preguntá o usá la indicada.
2. **Construí EXACTAMENTE lo que dice la spec.** Nada más:
   - ❌ No agregues features que no estén en la spec.
   - ❌ No refactorices código sin relación.
   - ❌ No inventes requisitos.
3. Implementá **todos** los requisitos y edge cases listados.

## Si venís de un /review

Aplicá **solo los fixes** que el review devolvió. No rehagas lo que ya pasó ni cambies cosas que no estaban en la lista de fixes.

## Al terminar

Listá **qué requisitos de la spec cubriste**, referenciando cada uno por su nombre/número, para que `/review` los pueda verificar uno por uno. Si un requisito es genuinamente imposible o ambiguo, decilo explícitamente en vez de adivinar.
