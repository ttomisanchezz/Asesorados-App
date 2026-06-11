import { defineConfig } from 'vitest/config'

// Tests de la capa de datos y lógica pura. Entorno node (sin DOM): los services
// y helpers no dependen de React. Los componentes se validan aparte con el
// script de validación contra prod (scripts/validate-users.mjs).
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.{js,jsx}'],
    clearMocks: true,
  },
})
