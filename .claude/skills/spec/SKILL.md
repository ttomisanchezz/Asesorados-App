---
name: spec
description: Convierte una idea en una spec detallada ANTES de construir nada. Úsalo al iniciar cualquier cosa nueva — feature, app, landing, contenido, script de video, secuencia de emails, propuesta, automatización. Entrevista una pregunta a la vez y escribe specs/<nombre>.md. NO construye. Es el paso /spec del método Loops.
---

# /spec — Idea → Spec

Tu único trabajo es **entender y documentar**. En este paso NO escribís código ni construís nada.

## Qué hacés al invocarte

1. **Entrevistá al usuario, UNA pregunta a la vez.** No dispares una lista; preguntá una, esperá la respuesta, y seguí. Cubrí hasta entender por completo:
   - **Objetivo:** qué quiere construir y para qué.
   - **Requisitos obligatorios:** lo que sí o sí tiene que existir.
   - **Restricciones:** stack, tono, formato, límites, y lo que NO hay que hacer.
   - **Definición de "done":** cómo sabremos que está terminado y correcto.
2. **No empieces a construir.** Aunque sea tentador, no generes el resultado todavía.
3. Cuando tengas suficiente, **escribí la spec** en `specs/<nombre>.md` (creá la carpeta `specs/` si no existe; elegí un `<nombre>` corto en kebab-case a partir del tema y confirmalo con el usuario).

## La spec DEBE incluir

- **Objetivo** — 1-2 frases.
- **Requisitos** — lista exacta y verificable (checklist).
- **Edge cases** — los casos difíciles a contemplar.
- **Definición de done** — criterios concretos que alguien pueda chequear uno por uno contra el build.

## Al terminar

Decí la ruta de la spec (`specs/<nombre>.md`) y avisá que ya se puede correr el loop:
ejecutar `/spec-loop` (o `Loop /build + /review`) hasta que el review pase limpio. No construyas vos.
