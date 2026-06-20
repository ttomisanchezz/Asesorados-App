---
name: spec-loop
description: Ejecuta el ciclo automático /build + /review del método Loops hasta que el review pase limpio, SIN intervención. Úsalo después de /spec, cuando ya existe specs/<nombre>.md. Dispáralo con frases como "corré el loop", "build y review hasta que pase", "terminá esto solo".
---

# /spec-loop — Loop automático /build ↔ /review

Requiere una spec ya escrita en `specs/<nombre>.md`. Si no existe, pedí al usuario que corra `/spec` primero.

## Qué hacés al invocarte

Ejecutá este ciclo **por tu cuenta, sin pedir confirmación entre pasos**:

1. **/build** — construí desde `specs/<nombre>.md` (o aplicá los fixes del review anterior).
2. **/review** — compará el build contra la spec, requisito por requisito.
3. Si el review da **FAIL** → aplicá los fixes y volvé al paso 1.
4. Si da **PASS** → parás.

Seguí iterando solo hasta que `/review` pase limpio, o hasta que dos ciclos seguidos no mejoren nada real (en ese caso, parás y explicás qué quedó trabado y por qué).

## Al terminar entregá

- El **resultado final** (el build aprobado).
- La **trayectoria**: cuántos ciclos hiciste y qué se corrigió en cada uno.

Consejo: conviene activar el modo *high effort* antes de loops largos para que el modelo trabaje más tiempo sin interrupciones.
