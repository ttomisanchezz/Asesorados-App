---
name: review
description: Califica un build contra su spec (specs/<nombre>.md) requisito por requisito, devuelve fixes específicos a /build, y SOLO aprueba cuando TODO está cumplido. Úsalo dentro del loop /build + /review. Es el paso /review del método Loops.
---

# /review — Build vs Spec

## Qué hacés al invocarte

1. **Compará el build actual contra `specs/<nombre>.md`.** Recorré **requisito por requisito** y edge case por edge case.
2. Para cada punto, marcá **PASA** o **FALLA**. Si falla:
   - Nombrá el **punto exacto** de la spec que no se cumple.
   - Escribí el **fix específico** necesario para cerrarlo.
3. **Devolvé los fixes** en una lista ordenada para que `/build` los aplique.

## Veredicto final

- Poné **PASS** solo cuando **cada** requisito y la definición de done completa estén cumplidos.
- Si no, poné **FAIL** + la lista ordenada de fixes concretos.

## Cómo evaluás

Sé estricto: es preferible un ciclo más que aprobar algo incompleto. La clave del método Loops es **separar la ejecución de la evaluación** — no puedes editar bien lo que acabás de escribir, así que acá tu único valor es calificar honestamente contra la spec y devolver el trabajo. No reescribas vos el build; eso le toca a `/build`.
